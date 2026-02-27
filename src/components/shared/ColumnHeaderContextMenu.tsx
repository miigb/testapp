import { useState, useRef, useEffect, useCallback } from 'react'
import { EyeOff, Pencil, ArrowLeftToLine, ArrowRightToLine, Check, X } from 'lucide-react'
import type { ColumnConfig } from '../../types/columnConfig'
import { useAdminColumnConfig } from '../../hooks/useColumnConfig'
import './ColumnHeaderContextMenu.css'

// ── Types ─────────────────────────────────────────────────────────

export interface ContextMenuPosition {
  x: number
  y: number
}

export interface ColumnContextMenuState {
  column: ColumnConfig
  position: ContextMenuPosition
}

export interface ColumnHeaderContextMenuProps {
  state: ColumnContextMenuState | null
  allColumns: ColumnConfig[]
  onClose: () => void
  onHide: (id: string, visible: boolean) => Promise<void>
  onRename: (id: string, label: string) => Promise<void>
  onReorder: (items: { id: string; position: number }[]) => Promise<void>
}

// ── Component ─────────────────────────────────────────────────────

export function ColumnHeaderContextMenu({
  state,
  allColumns,
  onClose,
  onHide,
  onRename,
  onReorder,
}: ColumnHeaderContextMenuProps) {
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [trackedColumnId, setTrackedColumnId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Reset rename state when column changes or menu closes ─────
  // React 19 recommended pattern: adjust state during render when
  // props change (replaces getDerivedStateFromProps / useEffect).

  const currentColumnId = state?.column.id ?? null
  if (currentColumnId !== trackedColumnId) {
    setTrackedColumnId(currentColumnId)
    if (renaming) {
      setRenaming(false)
      setRenameValue('')
    }
  }

  // ── Close on outside click ──────────────────────────────────────

  useEffect(() => {
    if (!state) return

    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [state, onClose])

  // ── Focus input when renaming starts ────────────────────────────

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [renaming])

  // ── Handlers ────────────────────────────────────────────────────

  const handleHide = useCallback(async () => {
    if (!state) return
    await onHide(state.column.id, state.column.visible)
    onClose()
  }, [state, onHide, onClose])

  const startRename = useCallback(() => {
    if (!state) return
    setRenameValue(state.column.label)
    setRenaming(true)
  }, [state])

  const commitRename = useCallback(async () => {
    if (!state) return
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== state.column.label) {
      await onRename(state.column.id, trimmed)
    }
    onClose()
  }, [state, renameValue, onRename, onClose])

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void commitRename()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [commitRename, onClose])

  const moveToStart = useCallback(async () => {
    if (!state) return
    const visible = allColumns.filter((c) => c.visible).sort((a, b) => a.position - b.position)
    const withoutCurrent = visible.filter((c) => c.id !== state.column.id)
    const reordered = [state.column, ...withoutCurrent]
    await onReorder(reordered.map((col, idx) => ({ id: col.id, position: idx })))
    onClose()
  }, [state, allColumns, onReorder, onClose])

  const moveToEnd = useCallback(async () => {
    if (!state) return
    const visible = allColumns.filter((c) => c.visible).sort((a, b) => a.position - b.position)
    const withoutCurrent = visible.filter((c) => c.id !== state.column.id)
    const reordered = [...withoutCurrent, state.column]
    await onReorder(reordered.map((col, idx) => ({ id: col.id, position: idx })))
    onClose()
  }, [state, allColumns, onReorder, onClose])

  // ── Render ──────────────────────────────────────────────────────

  if (!state) return null

  // Clamp to viewport
  const style: React.CSSProperties = {
    top: Math.min(state.position.y, window.innerHeight - 200),
    left: Math.min(state.position.x, window.innerWidth - 200),
  }

  return (
    <div ref={menuRef} className="col-ctx-menu" style={style}>
      {renaming ? (
        <div className="col-ctx-rename">
          <input
            ref={inputRef}
            className="col-ctx-rename-input"
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
          />
          <button className="subtle-btn icon-btn micro" type="button" onClick={() => void commitRename()} title="Confirmar">
            <Check size={13} />
          </button>
          <button className="subtle-btn icon-btn micro" type="button" onClick={onClose} title="Cancelar">
            <X size={13} />
          </button>
        </div>
      ) : (
        <>
          <button className="col-ctx-item" type="button" onClick={() => void handleHide()}>
            <EyeOff size={14} />
            Ocultar coluna
          </button>
          <button className="col-ctx-item" type="button" onClick={startRename}>
            <Pencil size={14} />
            Renomear
          </button>
          <div className="col-ctx-divider" />
          <button className="col-ctx-item" type="button" onClick={() => void moveToStart()}>
            <ArrowLeftToLine size={14} />
            Mover para início
          </button>
          <button className="col-ctx-item" type="button" onClick={() => void moveToEnd()}>
            <ArrowRightToLine size={14} />
            Mover para fim
          </button>
        </>
      )}
    </div>
  )
}

// ── Self-contained admin wrapper ──────────────────────────────────
//
// Renders only when mounted (guard with isAdmin && contextMenu).
// Calls useAdminColumnConfig internally so the table components
// don't need to import the admin hook.

export interface AdminColumnContextMenuProps {
  module: string
  state: ColumnContextMenuState
  onClose: () => void
  /** Called after every mutation so the table can refetch visible columns */
  onColumnsChanged?: () => void
}

export function AdminColumnContextMenu({
  module,
  state,
  onClose,
  onColumnsChanged,
}: AdminColumnContextMenuProps) {
  const {
    columns,
    toggleVisibility,
    renameColumn,
    reorderColumns,
  } = useAdminColumnConfig(module, 'table')

  const handleHide = useCallback(
    async (id: string, visible: boolean) => {
      await toggleVisibility(id, visible)
      onColumnsChanged?.()
    },
    [toggleVisibility, onColumnsChanged],
  )

  const handleRename = useCallback(
    async (id: string, label: string) => {
      await renameColumn(id, label)
      onColumnsChanged?.()
    },
    [renameColumn, onColumnsChanged],
  )

  const handleReorder = useCallback(
    async (items: { id: string; position: number }[]) => {
      await reorderColumns(items)
      onColumnsChanged?.()
    },
    [reorderColumns, onColumnsChanged],
  )

  return (
    <ColumnHeaderContextMenu
      state={state}
      allColumns={columns}
      onClose={onClose}
      onHide={handleHide}
      onRename={handleRename}
      onReorder={handleReorder}
    />
  )
}
