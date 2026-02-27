import { useState, useCallback, useRef, useEffect } from 'react'
import { X, GripVertical, Eye, EyeOff, Pencil, Check, Plus, ChevronDown, ChevronRight, Loader2, Upload, FileSpreadsheet } from 'lucide-react'
import ExcelJS from 'exceljs'
import { useAdminColumnConfig } from '../../hooks/useColumnConfig'
import type { ColumnConfig } from '../../types/columnConfig'
import './ColumnManager.css'

// ── Types ─────────────────────────────────────────────────────────

type ModuleName = 'recibos' | 'ds' | 'penhoras'
type ViewName = 'table' | 'detail'

interface DiscoveredColumn {
  header: string
  suggestedKey: string
  suggestedLabel: string
}

interface SelectedColumn {
  header: string
  key: string
  label: string
}

// ── Excel header extraction ──────────────────────────────────────

async function extractExcelHeaders(buffer: ArrayBuffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const allHeaders: string[] = []
  const seen = new Set<string>()

  workbook.eachSheet((sheet) => {
    // Try first 10 rows to find headers (some sheets use row 4+)
    const maxProbe = Math.min(10, sheet.rowCount)
    for (let rowNumber = 1; rowNumber <= maxProbe; rowNumber += 1) {
      const row = sheet.getRow(rowNumber)
      const values = Array.isArray(row.values) ? (row.values.slice(1) as ExcelJS.CellValue[]) : []

      for (const cell of values) {
        const text = cellToString(cell).trim()
        if (text && !seen.has(text.toLowerCase())) {
          seen.add(text.toLowerCase())
          allHeaders.push(text)
        }
      }
    }
  })

  return allHeaders
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((s) => s.text).join('')
    }
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('result' in value && value.result !== undefined) return String(value.result)
  }
  return ''
}

export interface ColumnManagerProps {
  module: ModuleName
  open: boolean
  onClose: () => void
}

// ── Module labels ─────────────────────────────────────────────────

const MODULE_LABELS: Record<ModuleName, string> = {
  recibos: 'Recibos',
  ds: 'DS',
  penhoras: 'Penhoras',
}

const VIEW_LABELS: Record<ViewName, string> = {
  table: 'Tabela',
  detail: 'Detalhe',
}

// ── Drag state ────────────────────────────────────────────────────

interface DragState {
  draggedId: string
  dragOverId: string | null
}

// ── Main Component ────────────────────────────────────────────────

export function ColumnManager({ module, open, onClose }: ColumnManagerProps) {
  const [activeView, setActiveView] = useState<ViewName>('table')
  const [showHidden, setShowHidden] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    columns,
    isLoading,
    error,
    toggleVisibility,
    renameColumn,
    reorderColumns,
    createCustomColumn,
  } = useAdminColumnConfig(module, activeView)

  // ── Import sub-flow state ────────────────────────────────────────

  const [importMode, setImportMode] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [discovered, setDiscovered] = useState<DiscoveredColumn[]>([])
  const [selected, setSelected] = useState<Map<string, SelectedColumn>>(new Map())
  const [importCreating, setImportCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Derived lists ───────────────────────────────────────────────

  const visibleColumns = columns.filter((col) => col.visible).sort((a, b) => a.position - b.position)
  const hiddenColumns = columns.filter((col) => !col.visible).sort((a, b) => a.position - b.position)

  // ── Feedback helper ─────────────────────────────────────────────

  const showFeedback = useCallback((msg: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    setFeedback(msg)
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2400)
  }, [])

  // ── Rename handlers ─────────────────────────────────────────────

  const startRename = useCallback((col: ColumnConfig) => {
    setEditingId(col.id)
    setEditLabel(col.label)
  }, [])

  const commitRename = useCallback(async () => {
    if (!editingId) return
    const trimmed = editLabel.trim()
    const original = columns.find((c) => c.id === editingId)
    if (!trimmed || trimmed === original?.label) {
      setEditingId(null)
      return
    }
    try {
      await renameColumn(editingId, trimmed)
      showFeedback(`Coluna renomeada para "${trimmed}"`)
    } catch {
      showFeedback('Erro ao renomear coluna.')
    } finally {
      setEditingId(null)
    }
  }, [editingId, editLabel, columns, renameColumn, showFeedback])

  const cancelRename = useCallback(() => {
    setEditingId(null)
  }, [])

  // ── Visibility toggle ──────────────────────────────────────────

  const handleToggle = useCallback(async (col: ColumnConfig) => {
    try {
      await toggleVisibility(col.id, col.visible)
      showFeedback(col.visible ? `"${col.label}" ocultada` : `"${col.label}" visível`)
    } catch {
      showFeedback('Erro ao alterar visibilidade.')
    }
  }, [toggleVisibility, showFeedback])

  // ── Drag & drop reorder ────────────────────────────────────────

  const handleDragStart = useCallback((id: string) => {
    setDragState({ draggedId: id, dragOverId: null })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault()
    setDragState((prev) => prev ? { ...prev, dragOverId: id } : null)
  }, [])

  const handleDragEnd = useCallback(async () => {
    if (!dragState?.draggedId || !dragState.dragOverId) {
      setDragState(null)
      return
    }
    if (dragState.draggedId === dragState.dragOverId) {
      setDragState(null)
      return
    }

    const ordered = [...visibleColumns]
    const fromIndex = ordered.findIndex((c) => c.id === dragState.draggedId)
    const toIndex = ordered.findIndex((c) => c.id === dragState.dragOverId)
    if (fromIndex === -1 || toIndex === -1) {
      setDragState(null)
      return
    }

    const [moved] = ordered.splice(fromIndex, 1)
    ordered.splice(toIndex, 0, moved)

    const items = ordered.map((col, idx) => ({ id: col.id, position: idx }))
    setDragState(null)

    try {
      await reorderColumns(items)
      showFeedback('Ordem atualizada')
    } catch {
      showFeedback('Erro ao reordenar colunas.')
    }
  }, [dragState, visibleColumns, reorderColumns, showFeedback])

  // ── Import handlers ────────────────────────────────────────────

  const resetImportState = useCallback(() => {
    setImportMode(false)
    setImportLoading(false)
    setImportError(null)
    setDiscovered([])
    setSelected(new Map())
    setImportCreating(false)
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportLoading(true)
    setImportError(null)
    setDiscovered([])
    setSelected(new Map())

    try {
      const headers = await extractExcelHeaders(await file.arrayBuffer())
      if (headers.length === 0) {
        setImportError('Nenhum cabeçalho encontrado no ficheiro.')
        setImportLoading(false)
        return
      }

      const response = await fetch('/api/admin/columns/from-import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, headers }),
      })

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`)
      }

      const data = (await response.json()) as { discoveredColumns: DiscoveredColumn[] }
      setDiscovered(data.discoveredColumns)

      if (data.discoveredColumns.length === 0) {
        setImportError('Todas as colunas do ficheiro já estão mapeadas.')
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Falha ao analisar ficheiro.')
    } finally {
      setImportLoading(false)
      e.target.value = ''
    }
  }, [module])

  const toggleColumnSelection = useCallback((col: DiscoveredColumn) => {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(col.header)) {
        next.delete(col.header)
      } else {
        next.set(col.header, { header: col.header, key: col.suggestedKey, label: col.suggestedLabel })
      }
      return next
    })
  }, [])

  const updateSelectedLabel = useCallback((header: string, newLabel: string) => {
    setSelected((prev) => {
      const next = new Map(prev)
      const existing = next.get(header)
      if (existing) {
        next.set(header, { ...existing, label: newLabel })
      }
      return next
    })
  }, [])

  const commitImportColumns = useCallback(async () => {
    if (selected.size === 0) return
    setImportCreating(true)

    try {
      for (const col of selected.values()) {
        await createCustomColumn({
          key: col.key,
          label: col.label.trim() || col.header,
          type: 'string',
        })
      }
      showFeedback(`${selected.size} coluna${selected.size > 1 ? 's' : ''} criada${selected.size > 1 ? 's' : ''}`)
      resetImportState()
    } catch {
      setImportError('Erro ao criar colunas. Verifique se já existem colunas com o mesmo nome.')
      setImportCreating(false)
    }
  }, [selected, createCustomColumn, showFeedback, resetImportState])

  // ── Reset state when switching views or closing ─────────────────

  useEffect(() => {
    setEditingId(null)
    setDragState(null)
  }, [activeView])

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setDragState(null)
      setShowHidden(false)
      setFeedback(null)
      resetImportState()
    }
  }, [open, resetImportState])

  // ── Keyboard support for rename input ──────────────────────────

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void commitRename()
    } else if (e.key === 'Escape') {
      cancelRename()
    }
  }, [commitRename, cancelRename])

  // ── Render ─────────────────────────────────────────────────────

  if (!open) return null

  return (
    <div className="colmgr-overlay" onClick={onClose}>
      <aside className="panel colmgr-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="colmgr-header">
          <div className="colmgr-header-left">
            <h2>Gerir Colunas — {MODULE_LABELS[module]}</h2>
            <p className="small-note">Reordene, oculte ou renomeie colunas.</p>
          </div>
          <button className="subtle-btn icon-btn" type="button" onClick={onClose} title="Fechar" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* View tabs */}
        <div className="colmgr-view-tabs">
          {(['table', 'detail'] as ViewName[]).map((view) => (
            <button
              key={view}
              type="button"
              className={`colmgr-view-tab ${activeView === view ? 'active' : ''}`}
              onClick={() => setActiveView(view)}
            >
              {VIEW_LABELS[view]}
            </button>
          ))}
        </div>

        {/* Feedback */}
        {feedback && <div className="colmgr-feedback">{feedback}</div>}

        {/* Content */}
        <div className="colmgr-body">
          {isLoading ? (
            <div className="colmgr-loading">
              <Loader2 size={20} className="spinning" />
              <span>A carregar colunas…</span>
            </div>
          ) : error ? (
            <div className="colmgr-error">{error}</div>
          ) : (
            <>
              {/* Visible columns */}
              <div className="colmgr-section-label">
                Colunas visíveis
                <span className="colmgr-count">{visibleColumns.length}</span>
              </div>
              <ul className="colmgr-list">
                {visibleColumns.map((col) => (
                  <li
                    key={col.id}
                    className={`colmgr-item ${dragState?.draggedId === col.id ? 'dragging' : ''} ${dragState?.dragOverId === col.id ? 'drag-over' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(col.id)}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragEnd={() => void handleDragEnd()}
                  >
                    <span className="colmgr-grip" title="Arrastar para reordenar">
                      <GripVertical size={14} />
                    </span>

                    {editingId === col.id ? (
                      <div className="colmgr-rename-row">
                        <input
                          className="colmgr-rename-input"
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={handleRenameKeyDown}
                          autoFocus
                        />
                        <button className="subtle-btn icon-btn micro" type="button" onClick={() => void commitRename()} title="Confirmar">
                          <Check size={13} />
                        </button>
                        <button className="subtle-btn icon-btn micro" type="button" onClick={cancelRename} title="Cancelar">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <span className="colmgr-label">{col.label}</span>
                    )}

                    <div className="colmgr-item-actions">
                      {col.isCustom && <span className="colmgr-badge custom">Custom</span>}
                      {col.isReference && <span className="colmgr-badge ref">Ref</span>}
                      {editingId !== col.id && (
                        <button className="subtle-btn icon-btn micro" type="button" onClick={() => startRename(col)} title="Renomear">
                          <Pencil size={13} />
                        </button>
                      )}
                      <button className="subtle-btn icon-btn micro" type="button" onClick={() => void handleToggle(col)} title="Ocultar coluna">
                        <Eye size={14} />
                      </button>
                    </div>
                  </li>
                ))}
                {visibleColumns.length === 0 && (
                  <li className="colmgr-empty">Nenhuma coluna visível.</li>
                )}
              </ul>

              {/* Hidden columns */}
              {hiddenColumns.length > 0 && (
                <>
                  <button
                    type="button"
                    className="colmgr-section-toggle"
                    onClick={() => setShowHidden(!showHidden)}
                  >
                    {showHidden ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Colunas ocultas
                    <span className="colmgr-count">{hiddenColumns.length}</span>
                  </button>

                  {showHidden && (
                    <ul className="colmgr-list hidden-list">
                      {hiddenColumns.map((col) => (
                        <li key={col.id} className="colmgr-item hidden">
                          <span className="colmgr-label muted">{col.label}</span>
                          <div className="colmgr-item-actions">
                            {col.isCustom && <span className="colmgr-badge custom">Custom</span>}
                            <button className="subtle-btn icon-btn micro" type="button" onClick={() => void handleToggle(col)} title="Mostrar coluna">
                              <EyeOff size={14} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {/* Import columns from Excel */}
              <div className="colmgr-import-section">
                {!importMode ? (
                  <button className="subtle-btn" type="button" onClick={() => setImportMode(true)}>
                    <Upload size={14} />
                    Adicionar via Import
                  </button>
                ) : (
                  <div className="colmgr-import-flow">
                    {/* Header row with title + cancel */}
                    <div className="colmgr-import-header">
                      <span className="colmgr-import-title">
                        <FileSpreadsheet size={14} />
                        Importar colunas
                      </span>
                      <button className="subtle-btn icon-btn micro" type="button" onClick={resetImportState} title="Cancelar">
                        <X size={13} />
                      </button>
                    </div>

                    {/* File picker */}
                    {discovered.length === 0 && !importLoading && (
                      <div className="colmgr-import-picker">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          className="colmgr-file-input"
                          onChange={(e) => void handleFileSelect(e)}
                        />
                        <p className="small-note">Selecione um ficheiro Excel para detetar colunas novas.</p>
                      </div>
                    )}

                    {/* Loading state */}
                    {importLoading && (
                      <div className="colmgr-import-loading">
                        <Loader2 size={16} className="spinning" />
                        <span>A analisar ficheiro…</span>
                      </div>
                    )}

                    {/* Error */}
                    {importError && (
                      <div className="colmgr-import-error">{importError}</div>
                    )}

                    {/* Discovered columns list */}
                    {discovered.length > 0 && (
                      <>
                        <p className="small-note" style={{ marginBottom: 6 }}>
                          {discovered.length} coluna{discovered.length > 1 ? 's' : ''} nova{discovered.length > 1 ? 's' : ''} detetada{discovered.length > 1 ? 's' : ''}. Selecione as que pretende adicionar:
                        </p>

                        <ul className="colmgr-import-list">
                          {discovered.map((col) => {
                            const isSelected = selected.has(col.header)
                            const selectedCol = selected.get(col.header)

                            return (
                              <li key={col.header} className={`colmgr-import-item ${isSelected ? 'selected' : ''}`}>
                                <label className="colmgr-import-check">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleColumnSelection(col)}
                                  />
                                  <span className="colmgr-import-header-text" title={col.header}>
                                    {col.header}
                                  </span>
                                </label>

                                {isSelected && (
                                  <input
                                    className="colmgr-import-label-input"
                                    type="text"
                                    placeholder={col.suggestedLabel}
                                    value={selectedCol?.label ?? ''}
                                    onChange={(e) => updateSelectedLabel(col.header, e.target.value)}
                                  />
                                )}
                              </li>
                            )
                          })}
                        </ul>

                        {/* Select all / deselect all */}
                        <div className="colmgr-import-select-all">
                          <button
                            className="subtle-btn micro"
                            type="button"
                            onClick={() => {
                              if (selected.size === discovered.length) {
                                setSelected(new Map())
                              } else {
                                const all = new Map<string, SelectedColumn>()
                                for (const col of discovered) {
                                  const existing = selected.get(col.header)
                                  all.set(col.header, existing ?? { header: col.header, key: col.suggestedKey, label: col.suggestedLabel })
                                }
                                setSelected(all)
                              }
                            }}
                          >
                            {selected.size === discovered.length ? 'Desselecionar todas' : 'Selecionar todas'}
                          </button>
                        </div>

                        {/* Confirm button */}
                        <button
                          className="subtle-btn colmgr-import-confirm"
                          type="button"
                          disabled={selected.size === 0 || importCreating}
                          onClick={() => void commitImportColumns()}
                        >
                          {importCreating ? (
                            <>
                              <Loader2 size={14} className="spinning" />
                              A criar…
                            </>
                          ) : (
                            <>
                              <Plus size={14} />
                              Criar {selected.size} coluna{selected.size !== 1 ? 's' : ''}
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
