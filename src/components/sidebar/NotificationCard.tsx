import { Bell, CheckCircle, MessageCircle, AlertTriangle, Clock, RefreshCw, AtSign } from 'lucide-react'
import type { NotificationItem } from '../../types'

interface NotificationCardProps {
  notification: NotificationItem
  onMarkRead: (id: number) => void
  onNavigate?: (module: string, recordId: string) => void
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'TASK_ASSIGNED': return <Bell size={15} />
    case 'TASK_COMPLETED': return <CheckCircle size={15} />
    case 'TASK_COMMENTED': return <MessageCircle size={15} />
    case 'TASK_DUE_SOON': return <AlertTriangle size={15} />
    case 'RECORD_STATUS_CHANGE': return <RefreshCw size={15} />
    case 'MENTION': return <AtSign size={15} />
    default: return <Clock size={15} />
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'agora mesmo'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`
  return new Date(dateStr).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

export function NotificationCard({ notification, onMarkRead, onNavigate }: NotificationCardProps) {
  function handleClick() {
    if (!notification.read) {
      onMarkRead(notification.id)
    }
    if (onNavigate && notification.linkedModule && notification.linkedRecordId) {
      onNavigate(notification.linkedModule, notification.linkedRecordId)
    }
  }

  return (
    <div
      className={`notification-card ${notification.read ? '' : 'unread'}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick() }}
    >
      <div className="notification-icon-wrap">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
        <div className="notification-time">{relativeTime(notification.createdAt)}</div>
      </div>
      {!notification.read && <div className="notification-unread-dot" />}
    </div>
  )
}
