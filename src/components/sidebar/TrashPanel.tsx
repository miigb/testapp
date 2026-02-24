import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { TrashItem } from './TrashItem'
import type { TrashEntry } from '../../hooks/useTrash'

interface TrashPanelProps {
  items: TrashEntry[]
  loading: boolean
  onRestore: (module: string, id: string) => Promise<void>
  onPermanentDelete?: (module: string, id: string) => Promise<void>
  onEmptyTrash?: (module?: 'recibos' | 'ds' | 'penhoras' | 'tarefas') => Promise<void>
  isAdmin?: boolean
}

type TrashFilter = 'todos' | 'recibos' | 'ds' | 'penhoras' | 'tarefas'

const TRASH_TABS: { id: TrashFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'recibos', label: 'Recibos' },
  { id: 'ds', label: 'DS' },
  { id: 'penhoras', label: 'Penhoras' },
  { id: 'tarefas', label: 'Tarefas' },
]

export function TrashPanel({ items, loading, onRestore, onPermanentDelete, onEmptyTrash, isAdmin }: TrashPanelProps) {
  const [filter, setFilter] = useState<TrashFilter>('todos')
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  const filtered = filter === 'todos' ? items : items.filter((i) => i.module === filter)

  async function handleEmptyTrash() {
    if (!onEmptyTrash) return
    await onEmptyTrash(filter === 'todos' ? undefined : filter)
    setConfirmEmpty(false)
  }

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

      {isAdmin && items.length > 0 && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)' }}>
          {confirmEmpty ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>
                {filter === 'todos' ? 'Eliminar tudo permanentemente?' : `Eliminar todos os itens de ${TRASH_TABS.find((t) => t.id === filter)?.label ?? filter} permanentemente?`}
              </span>
              <button
                type="button"
                className="primary-btn"
                style={{ padding: '4px 12px', fontSize: '0.72rem', background: '#ef4444', borderColor: '#ef4444' }}
                onClick={() => void handleEmptyTrash()}
              >
                Confirmar
              </button>
              <button
                type="button"
                className="subtle-btn"
                style={{ padding: '4px 12px', fontSize: '0.72rem' }}
                onClick={() => setConfirmEmpty(false)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="subtle-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: '#ef4444' }}
              onClick={() => setConfirmEmpty(true)}
            >
              <Trash2 size={13} />
              Esvaziar Lixeira
            </button>
          )}
        </div>
      )}

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
            onPermanentDelete={isAdmin && onPermanentDelete ? () => void onPermanentDelete(item.module, item.id) : undefined}
          />
        ))
      )}
    </>
  )
}
