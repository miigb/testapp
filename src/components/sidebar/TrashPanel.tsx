import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { TrashItem } from './TrashItem'

interface TrashEntry {
  id: string
  module: 'recibos' | 'ds' | 'penhoras' | 'tarefas'
  label: string
  deletedAt: string
}

interface TrashPanelProps {
  items: TrashEntry[]
  loading: boolean
  onRestore: (module: string, id: string) => Promise<void>
}

type TrashFilter = 'todos' | 'recibos' | 'ds' | 'penhoras' | 'tarefas'

const TRASH_TABS: { id: TrashFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'recibos', label: 'Recibos' },
  { id: 'ds', label: 'DS' },
  { id: 'penhoras', label: 'Penhoras' },
  { id: 'tarefas', label: 'Tarefas' },
]

export function TrashPanel({ items, loading, onRestore }: TrashPanelProps) {
  const [filter, setFilter] = useState<TrashFilter>('todos')

  const filtered = filter === 'todos' ? items : items.filter((i) => i.module === filter)

  return (
    <>
      <div className="trash-filter-bar">
        {TRASH_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`filter-pill ${filter === tab.id ? 'active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="sidebar-empty">
          <div className="sidebar-empty-text">A carregar lixeira...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sidebar-empty">
          <Trash2 size={32} className="sidebar-empty-icon" />
          <div className="sidebar-empty-text">Lixeira vazia.</div>
        </div>
      ) : (
        filtered.map((item) => (
          <TrashItem
            key={`${item.module}-${item.id}`}
            item={item}
            onRestore={() => void onRestore(item.module, item.id)}
          />
        ))
      )}
    </>
  )
}
