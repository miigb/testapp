import { useState } from 'react'
import { BellOff, Settings } from 'lucide-react'
import type { NotificationItem, NotificationPreferences } from '../../types'
import { NotificationCard } from './NotificationCard'

interface NotificationsPanelProps {
  notifications: NotificationItem[]
  loading: boolean
  unreadCount: number
  preferences: NotificationPreferences | null
  onMarkRead: (id: number) => Promise<void>
  onMarkAllRead: () => Promise<void>
  onUpdatePreferences: (patch: Partial<NotificationPreferences>) => Promise<unknown>
  onNavigate?: (module: string, recordId: string) => void
}

function groupNotifications(notifications: NotificationItem[]): { label: string; items: NotificationItem[] }[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)

  const groups: { label: string; items: NotificationItem[] }[] = [
    { label: 'Hoje', items: [] },
    { label: 'Ontem', items: [] },
    { label: 'Anteriores', items: [] },
  ]

  for (const n of notifications) {
    const d = new Date(n.createdAt)
    if (d >= today) groups[0].items.push(n)
    else if (d >= yesterday) groups[1].items.push(n)
    else groups[2].items.push(n)
  }

  return groups.filter((g) => g.items.length > 0)
}

const PREF_LABELS: { key: keyof NotificationPreferences; label: string }[] = [
  { key: 'taskAssigned', label: 'Tarefa atribuída' },
  { key: 'taskCompleted', label: 'Tarefa concluída' },
  { key: 'taskCommented', label: 'Comentário em tarefa' },
  { key: 'taskDueSoon', label: 'Tarefa a expirar' },
  { key: 'recordStatusChange', label: 'Mudança de estado de registo' },
  { key: 'mention', label: 'Menção' },
]

export function NotificationsPanel({
  notifications,
  loading,
  unreadCount,
  preferences,
  onMarkRead,
  onMarkAllRead,
  onUpdatePreferences,
  onNavigate,
}: NotificationsPanelProps) {
  const [showPrefs, setShowPrefs] = useState(false)

  if (showPrefs && preferences) {
    return (
      <div className="notif-prefs">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="notif-prefs-title">Preferências de notificações</span>
          <button
            type="button"
            className="subtle-btn icon-btn micro"
            onClick={() => setShowPrefs(false)}
            title="Voltar"
          >
            Voltar
          </button>
        </div>
        {PREF_LABELS.map(({ key, label }) => (
          <div key={key} className="notif-pref-row">
            <label>{label}</label>
            <input
              type="checkbox"
              checked={preferences[key]}
              onChange={(e) => void onUpdatePreferences({ [key]: e.target.checked })}
            />
          </div>
        ))}
      </div>
    )
  }

  const groups = groupNotifications(notifications)

  return (
    <>
      <div className="notifications-header">
        {unreadCount > 0 ? (
          <button type="button" onClick={() => void onMarkAllRead()}>
            Marcar todas como lidas
          </button>
        ) : (
          <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>Tudo em dia</span>
        )}
        <button
          type="button"
          className="subtle-btn icon-btn micro"
          onClick={() => setShowPrefs(true)}
          title="Preferências"
        >
          <Settings size={14} />
        </button>
      </div>

      {loading ? (
        <div className="sidebar-empty">
          <div className="sidebar-empty-text">A carregar notificações...</div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="sidebar-empty">
          <BellOff size={32} className="sidebar-empty-icon" />
          <div className="sidebar-empty-text">Sem notificações.</div>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <div className="notifications-group-label">{group.label}</div>
            {group.items.map((n) => (
              <NotificationCard
                key={n.id}
                notification={n}
                onMarkRead={(id) => void onMarkRead(id)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))
      )}
    </>
  )
}
