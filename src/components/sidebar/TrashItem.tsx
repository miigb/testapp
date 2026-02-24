import { RotateCcw, Trash2 } from 'lucide-react'
import type { TrashEntry } from '../../hooks/useTrash'

interface TrashItemProps {
  item: TrashEntry
  onRestore: () => void
  onPermanentDelete?: () => void
}

const MODULE_LABELS: Record<string, string> = {
  recibos: 'Recibos',
  ds: 'DS',
  penhoras: 'Penhoras',
  tarefas: 'Tarefas',
}

const PERMANENT_DELETE_DAYS = 30

function daysSince(dateStr: string): number {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diffMs / 86400000)
}

function daysSinceLabel(dateStr: string): string {
  const days = daysSince(dateStr)
  if (days === 0) return 'Eliminado hoje'
  if (days === 1) return 'Eliminado há 1 dia'
  return `Eliminado há ${days} dias`
}

function daysUntilPermanent(dateStr: string): number {
  const days = daysSince(dateStr)
  return Math.max(0, PERMANENT_DELETE_DAYS - days)
}

export function TrashItem({ item, onRestore, onPermanentDelete }: TrashItemProps) {
  const remaining = daysUntilPermanent(item.deletedAt)

  return (
    <div className="trash-item">
      <span className={`trash-module-badge ${item.module}`}>
        {MODULE_LABELS[item.module] || item.module}
      </span>
      <div className="trash-item-info">
        <div className="trash-item-name">{item.label}</div>
        <div className="trash-item-date">
          {daysSinceLabel(item.deletedAt)}
          {item.deletedBy && ` por ${item.deletedBy.displayName}`}
        </div>
        <div className="trash-item-date" style={{ color: remaining <= 5 ? '#ef4444' : undefined }}>
          {remaining === 0
            ? 'Eliminação permanente iminente'
            : `Eliminação permanente em ${remaining} dia${remaining !== 1 ? 's' : ''}`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        <button
          type="button"
          className="trash-restore-btn"
          onClick={onRestore}
          title="Restaurar"
        >
          <RotateCcw size={13} />
          Restaurar
        </button>
        {onPermanentDelete && (
          <button
            type="button"
            className="trash-restore-btn"
            onClick={onPermanentDelete}
            title="Eliminar permanentemente"
            style={{ color: '#ef4444', borderColor: '#ef4444' }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
