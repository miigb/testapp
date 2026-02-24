import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../api'
import type { NotificationItem, NotificationPreferences } from '../types'

/** Register service worker and request notification permission */
async function setupPushNotifications(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return null
  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    return registration
  } catch {
    return null
  }
}

/** Show a native browser notification when tab is not visible */
function showNativeNotification(
  notification: NotificationItem,
  registration: ServiceWorkerRegistration | null,
) {
  if (document.visibilityState === 'visible') return
  if (Notification.permission !== 'granted') return
  if (!registration) return

  registration.showNotification(notification.title ?? 'Nova notificação', {
    body: notification.message ?? '',
    icon: '/favicon.ico',
    tag: `notif-${notification.id}`,
  })
}

export function useNotifications(userId: number | undefined) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)

  // Fetch initial notifications and unread count
  const refreshNotifications = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [notifResult, countResult] = await Promise.allSettled([
        api.getNotifications({ pageSize: 50 }),
        api.getUnreadCount(),
      ])
      if (notifResult.status === 'fulfilled') {
        setNotifications(notifResult.value.items)
      }
      if (countResult.status === 'fulfilled') {
        setUnreadCount(countResult.value.count)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refreshNotifications()
  }, [refreshNotifications])

  // Load preferences
  useEffect(() => {
    if (!userId) return
    api.getNotificationPreferences()
      .then(setPreferences)
      .catch(() => { /* ignore */ })
  }, [userId])

  // Register Service Worker for push notifications
  useEffect(() => {
    if (!userId) return
    setupPushNotifications().then((reg) => {
      swRegistrationRef.current = reg
    })
  }, [userId])

  // SSE for real-time notifications
  useEffect(() => {
    if (!userId) return

    let destroyed = false
    let reconnectTimeout: ReturnType<typeof setTimeout>

    function connect() {
      if (destroyed) return

      const es = new EventSource('/api/notifications/stream')
      eventSourceRef.current = es

      es.addEventListener('notification', (event) => {
        try {
          const notification = JSON.parse(event.data) as NotificationItem
          setNotifications((prev) => [notification, ...prev])
          setUnreadCount((prev) => prev + 1)
          // Show native notification if tab is in background
          showNativeNotification(notification, swRegistrationRef.current)
        } catch {
          // ignore parse errors
        }
      })

      es.addEventListener('unread-count', (event) => {
        try {
          const data = JSON.parse(event.data) as { count: number }
          setUnreadCount(data.count)
        } catch {
          // ignore
        }
      })

      es.onerror = () => {
        es.close()
        if (eventSourceRef.current === es) {
          eventSourceRef.current = null
        }
        // Auto-reconnect after 5s only if not destroyed
        if (!destroyed) {
          reconnectTimeout = setTimeout(connect, 5000)
        }
      }
    }

    connect()

    return () => {
      destroyed = true
      clearTimeout(reconnectTimeout)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [userId])

  const markRead = useCallback(async (id: number) => {
    await api.markNotificationRead(id)
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n
        if (!n.read) setUnreadCount((c) => Math.max(0, c - 1))
        return { ...n, read: true }
      }),
    )
  }, [])

  const markAllRead = useCallback(async () => {
    await api.markAllNotificationsRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  const updatePreferences = useCallback(async (patch: Partial<NotificationPreferences>) => {
    const updated = await api.updateNotificationPreferences(patch)
    setPreferences(updated)
    return updated
  }, [])

  return {
    notifications,
    unreadCount,
    loading,
    preferences,
    markRead,
    markAllRead,
    updatePreferences,
    refreshNotifications,
  }
}
