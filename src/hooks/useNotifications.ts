import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../api'
import type { NotificationItem, NotificationPreferences } from '../types'

export function useNotifications(userId: number | undefined) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

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

  // SSE for real-time notifications
  useEffect(() => {
    if (!userId) return

    let reconnectTimeout: ReturnType<typeof setTimeout>

    function connect() {
      const es = new EventSource('/api/notifications/stream')
      eventSourceRef.current = es

      es.addEventListener('notification', (event) => {
        try {
          const notification = JSON.parse(event.data) as NotificationItem
          setNotifications((prev) => [notification, ...prev])
          setUnreadCount((prev) => prev + 1)
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
        eventSourceRef.current = null
        // Auto-reconnect after 5s
        reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
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
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
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
