import { useState } from 'react'
import type { NotificationPreferences as NotifPrefs } from '../../types'

interface NotificationPreferencesProps {
  preferences: NotifPrefs
  onSave: (updated: Partial<NotifPrefs>) => Promise<unknown>
  onClose: () => void
}

const PREF_ITEMS: { key: keyof NotifPrefs; label: string }[] = [
  { key: 'taskAssigned', label: 'Tarefa atribuida' },
  { key: 'taskCompleted', label: 'Tarefa concluida' },
  { key: 'taskCommented', label: 'Comentario em tarefa' },
  { key: 'taskDueSoon', label: 'Tarefa com prazo proximo' },
  { key: 'recordStatusChange', label: 'Alteracao de estado de registo' },
  { key: 'mention', label: 'Mencoes' },
]

export function NotificationPreferences({ preferences, onSave, onClose }: NotificationPreferencesProps) {
  const [local, setLocal] = useState<NotifPrefs>({ ...preferences })
  const [saving, setSaving] = useState(false)

  function toggle(key: keyof NotifPrefs) {
    setLocal((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Only send the fields that actually changed
      const patch: Partial<NotifPrefs> = {}
      for (const { key } of PREF_ITEMS) {
        if (local[key] !== preferences[key]) {
          patch[key] = local[key]
        }
      }
      if (Object.keys(patch).length > 0) {
        await onSave(patch)
      }
      onClose()
    } catch {
      // error will be handled by parent
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="notif-prefs">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="notif-prefs-title">Preferencias de notificacoes</span>
      </div>

      {PREF_ITEMS.map(({ key, label }) => (
        <div key={key} className="notif-pref-row">
          <label>{label}</label>
          <button
            type="button"
            className={`notif-pref-toggle ${local[key] ? 'on' : ''}`}
            onClick={() => toggle(key)}
            role="switch"
            aria-checked={local[key]}
            aria-label={label}
          />
        </div>
      ))}

      <div className="notif-prefs-actions">
        <button type="button" className="subtle-btn compact" onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="primary-btn compact"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? 'A guardar...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
