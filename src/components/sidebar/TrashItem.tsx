import { RotateCcw } from 'lucide-react'

interface TrashEntry {
  id: string
  module: 'recibos' | 'ds' | 'penhoras' | 'tarefas'
  label: string
  deletedAt: string
}

interface TrashItemProps {
  item: TrashEntry
  onRestore: () => void
}

const MODULE_LABELS: Record<string, string> = {
  recibos: 'Recibos',
  ds: 'DS',
  penhoras: 'Penhoras',
  tarefas: 'Tarefas',
}

function daysSince(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diffMs / 86400000)
  if (days === 0) return 'Eliminado hoje'
  if (days === 1) return 'Eliminado há 1 dia'
  return `Eliminado há ${days} dias`
}

export function TrashItem({ item, onRestore }: TrashItemProps) {
  return (
    <div className="trash-item">
      <span className={`trash-module-badge ${item.module}`}>
        {MODULE_LABELS[item.module] || item.module}
      </span>
      <div className="trash-item-info">
        <div className="trash-item-name">{item.label}</div>
        <div className="trash-item-date">{daysSince(item.deletedAt)}</div>
      </div>
      <button
        type="button"
        className="trash-restore-btn"
        onClick={onRestore}
        title="Restaurar"
      >
        <RotateCcw size={13} />
        Restaurar
      </button>
    </div>
  )
}
