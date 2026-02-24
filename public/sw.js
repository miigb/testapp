// Service Worker for browser push notifications

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Handle push events from the server (future use with Web Push API)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Mesa de Recibos'
  const options = {
    body: data.body || 'Nova notificação',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: data.url || '/',
    tag: data.tag || 'default',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// When user clicks the notification, focus/open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new tab
      return self.clients.openWindow(url)
    }),
  )
})
