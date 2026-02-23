import type { MouseEvent as ReactMouseEvent } from 'react'
import { GripVertical, Pin, PinOff, Save, Trash2, X } from 'lucide-react'
import type { SavedSmartNotesEntry, SmartNotesErrorRow, SmartNotesResultRow } from '../../lib/smartNotes'
import { formatSmartNotesValue } from '../../lib/smartNotes'

export interface SmartNotesWindowProps {
  windowRef: React.RefObject<HTMLDivElement>
  position: { x: number; y: number } | null
  zIndex: number
  isPinned: boolean
  isDragging: boolean
  smartNotesText: string
  resultsCount: number
  displayResults: SmartNotesResultRow[]
  errors: SmartNotesErrorRow[]
  pinnedSet: Set<string>
  savedSet: Set<string>
  savedEntries: SavedSmartNotesEntry[]
  onBringToFront: () => void
  onStartDrag: (event: ReactMouseEvent<HTMLDivElement>) => void
  onTogglePinned: () => void
  onClose: () => void
  onChangeText: (value: string) => void
  onTogglePinnedRow: (signature: string) => void
  onToggleSavedRow: (row: SmartNotesResultRow) => void
  onRemoveLine: (lineNumber: number) => void
  onClearSaved: () => void
  onClearText: () => void
  onExportTxt: () => void
  onExportPdf: () => void
}

export function SmartNotesWindow({
  windowRef,
  position,
  zIndex,
  isPinned,
  isDragging,
  smartNotesText,
  resultsCount,
  displayResults,
  errors,
  pinnedSet,
  savedSet,
  savedEntries,
  onBringToFront,
  onStartDrag,
  onTogglePinned,
  onClose,
  onChangeText,
  onTogglePinnedRow,
  onToggleSavedRow,
  onRemoveLine,
  onClearSaved,
  onClearText,
  onExportTxt,
  onExportPdf,
}: SmartNotesWindowProps) {
  return (
    <section
      ref={windowRef}
      className={`tool-window smart-notes-window ${position ? 'positioned' : 'centered'} ${isDragging ? 'dragging' : ''} ${isPinned ? 'pinned' : ''}`}
      style={position ? { left: `${position.x}px`, top: `${position.y}px`, zIndex } : { zIndex }}
      onMouseDown={onBringToFront}
      aria-label="Notas com cálculo"
    >
      <div className="tool-window-header" onMouseDown={onStartDrag}>
        <div className="tool-window-title">
          <GripVertical size={14} />
          <div>
            <h3>Notas com cálculo</h3>
            <p className="small-note">Escreva linguagem natural e contas por linha. Ex.: "23% de 1250".</p>
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
          <button
            className="subtle-btn icon-btn micro"
            type="button"
            onClick={onClose}
            title="Fechar notas com cálculo"
            aria-label="Fechar notas com cálculo"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="smart-notes-layout">
        <textarea
          className="smart-notes-input"
          value={smartNotesText}
          onChange={(event) => onChangeText(event.target.value)}
          placeholder={`7 × 7\n3k ganhos ÷ 5 pessoas\neu gastei 200 euros e 10 euro em bebidas\ntotal`}
        />
        <aside className="smart-notes-results">
          <div className="smart-notes-results-head">
            <strong>{resultsCount} linhas calculadas</strong>
            <div className="smart-notes-head-meta">
              {savedEntries.length > 0 && <span className="muted">{savedEntries.length} guardadas</span>}
              {errors.length > 0 && <span className="muted">{errors.length} com erro</span>}
            </div>
          </div>
          {resultsCount === 0 ? (
            <div className="muted">Sem cálculos detetados.</div>
          ) : (
            <div className="smart-notes-list">
              {displayResults.map((row) => (
                <div
                  key={`${row.lineNumber}-${row.signature}`}
                  className={`smart-notes-row ${pinnedSet.has(row.signature) ? 'pinned' : ''}`}
                >
                  <span className="smart-notes-line">L{row.lineNumber}</span>
                  <div className="smart-notes-row-main">
                    <div className="smart-notes-row-text">
                      <div className="smart-notes-expression">{row.expression}</div>
                      <strong>{formatSmartNotesValue(row.result)}</strong>
                    </div>
                    <div className="smart-notes-row-actions">
                      <button
                        className={`subtle-btn icon-btn micro ${pinnedSet.has(row.signature) ? 'active' : ''}`}
                        type="button"
                        onClick={() => onTogglePinnedRow(row.signature)}
                        title={pinnedSet.has(row.signature) ? 'Desafixar' : 'Fixar no topo'}
                        aria-label={pinnedSet.has(row.signature) ? 'Desafixar' : 'Fixar no topo'}
                      >
                        <Pin size={13} />
                      </button>
                      <button
                        className={`subtle-btn icon-btn micro ${savedSet.has(row.signature) ? 'active' : ''}`}
                        type="button"
                        onClick={() => onToggleSavedRow(row)}
                        title={savedSet.has(row.signature) ? 'Remover dos guardados' : 'Guardar cálculo'}
                        aria-label={savedSet.has(row.signature) ? 'Remover dos guardados' : 'Guardar cálculo'}
                      >
                        <Save size={13} />
                      </button>
                      <button
                        className="subtle-btn icon-btn micro danger"
                        type="button"
                        onClick={() => onRemoveLine(row.lineNumber)}
                        title="Eliminar linha"
                        aria-label="Eliminar linha"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {errors.length > 0 && (
            <div className="smart-notes-errors">
              {errors.slice(0, 5).map((row) => (
                <div key={`${row.lineNumber}-${row.error}`} className="smart-notes-error-row">
                  <span>L{row.lineNumber}</span>
                  <span>{row.error}</span>
                </div>
              ))}
            </div>
          )}
          {savedEntries.length > 0 && (
            <div className="smart-notes-saved">
              <div className="smart-notes-saved-head">
                <strong>Guardados</strong>
                <button className="subtle-btn" type="button" onClick={onClearSaved}>
                  Limpar guardados
                </button>
              </div>
              <div className="smart-notes-saved-list">
                {savedEntries.slice(0, 5).map((entry) => (
                  <div key={entry.signature} className="smart-notes-saved-item">
                    <span className="muted">{entry.expression}</span>
                    <strong>{formatSmartNotesValue(entry.result)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
      <div className="actions-row start smart-notes-actions">
        <button className="subtle-btn" type="button" onClick={onExportTxt}>
          Exportar TXT
        </button>
        <button className="subtle-btn" type="button" onClick={onExportPdf}>
          Exportar PDF
        </button>
        <button className="subtle-btn" type="button" onClick={onClearText}>
          Limpar
        </button>
        <span className="muted">Alt+S</span>
      </div>
    </section>
  )
}
