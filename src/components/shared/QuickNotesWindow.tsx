import type { MouseEvent as ReactMouseEvent } from 'react'
import { GripVertical, Pin, PinOff, X } from 'lucide-react'

export interface QuickNotesWindowProps {
  windowRef: React.RefObject<HTMLDivElement>
  position: { x: number; y: number } | null
  zIndex: number
  isPinned: boolean
  isDragging: boolean
  quickNotes: string
  onBringToFront: () => void
  onStartDrag: (event: ReactMouseEvent<HTMLDivElement>) => void
  onTogglePinned: () => void
  onClose: () => void
  onChangeNotes: (value: string) => void
  onClearNotes: () => void
  onExportTxt: () => void
  onExportPdf: () => void
}

export function QuickNotesWindow({
  windowRef,
  position,
  zIndex,
  isPinned,
  isDragging,
  quickNotes,
  onBringToFront,
  onStartDrag,
  onTogglePinned,
  onClose,
  onChangeNotes,
  onClearNotes,
  onExportTxt,
  onExportPdf,
}: QuickNotesWindowProps) {
  return (
    <section
      ref={windowRef}
      className={`tool-window notes-window ${position ? 'positioned' : 'centered'} ${isDragging ? 'dragging' : ''} ${isPinned ? 'pinned' : ''}`}
      style={position ? { left: `${position.x}px`, top: `${position.y}px`, zIndex } : { zIndex }}
      onMouseDown={onBringToFront}
      aria-label="Notas rápidas"
    >
      <div className="tool-window-header" onMouseDown={onStartDrag}>
        <div className="tool-window-title">
          <GripVertical size={14} />
          <div>
            <h3>Notas rápidas</h3>
            <p className="small-note">Bloco pessoal guardado automaticamente no browser.</p>
          </div>
        </div>
        <div className="tool-window-controls" onMouseDown={(event) => event.stopPropagation()}>
          <button
            className={`subtle-btn icon-btn micro ${isPinned ? 'active' : ''}`}
            type="button"
            onClick={onTogglePinned}
            title={isPinned ? 'Desafixar janela' : 'Fixar no topo'}
            aria-label={isPinned ? 'Desafixar janela' : 'Fixar no topo'}
          >
            {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button className="subtle-btn icon-btn micro" type="button" onClick={onClose} title="Fechar notas" aria-label="Fechar notas">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="quick-tool-body">
        <textarea
          className="quick-notes-input"
          value={quickNotes}
          onChange={(event) => onChangeNotes(event.target.value)}
          placeholder="Escreva aqui notas rápidas para qualquer módulo..."
        />
        <div className="actions-row start">
          <button className="subtle-btn" type="button" onClick={onExportTxt}>
            Exportar TXT
          </button>
          <button className="subtle-btn" type="button" onClick={onExportPdf}>
            Exportar PDF
          </button>
          <button className="subtle-btn" type="button" onClick={onClearNotes}>
            Apagar notas
          </button>
          <span className="muted">Guardado automaticamente</span>
        </div>
      </div>
    </section>
  )
}
