import type { MouseEvent as ReactMouseEvent } from 'react'
import { GripVertical, Maximize2, Minimize2, Minus, Plus, Trash2 } from 'lucide-react'
import type { DsDashboardWidget } from '../../lib/dashboardWidgets'
import {
  clampDashboardWidgetColSpan,
  DASHBOARD_WIDGET_MIN_COL_SPAN,
  DASHBOARD_WIDGET_MAX_COL_SPAN,
} from '../../lib/dashboardWidgets'
import { formatCurrency } from '../../lib/formatters'

type BarRow = { id: string; label: string; value: number; secondary?: string }

function DashboardKpi({ label, value, currency = false }: { label: string; value: number; currency?: boolean }) {
  return (
    <div className="dashboard-kpi">
      <span>{label}</span>
      <strong>{currency ? formatCurrency(value) : new Intl.NumberFormat('pt-PT').format(value)}</strong>
    </div>
  )
}

function DashboardBars({ rows, currency = false }: { rows: BarRow[]; currency?: boolean }) {
  if (rows.length === 0) {
    return <div className="empty-text">Sem dados para este widget.</div>
  }
  const maxValue = Math.max(...rows.map((row) => row.value), 1)
  return (
    <div className="dashboard-bars">
      {rows.map((row) => {
        const width = `${Math.max(4, (row.value / maxValue) * 100)}%`
        return (
          <div key={row.id} className="dashboard-bar-row">
            <div className="dashboard-bar-meta">
              <span>{row.label}</span>
              <strong>{currency ? formatCurrency(row.value) : new Intl.NumberFormat('pt-PT').format(row.value)}</strong>
            </div>
            <div className="dashboard-bar-track">
              <div className="dashboard-bar-fill" style={{ width }} />
            </div>
            {row.secondary ? <span className="muted dashboard-bar-secondary">{row.secondary}</span> : null}
          </div>
        )
      })}
    </div>
  )
}

export interface DsDashboardWidgetCardProps {
  widget: DsDashboardWidget
  isLoading: boolean
  byStatus: BarRow[]
  topGestoras: BarRow[]
  topEntidades: BarRow[]
  byMonth: BarRow[]
  totals: { comRecibo: number; semRecibo: number; comissaoGestor: number }
  draggedWidgetId: string | null
  dropWidgetId: string | null
  resizingWidgetId: string | null
  onSetDraggedId: (id: string | null) => void
  onSetDropId: (id: string | null) => void
  onReorder: (sourceId: string, targetId: string) => void
  onToggleColumn: (id: string) => void
  onAdjustWidth: (id: string, delta: number) => void
  onAdjustHeight: (id: string, delta: number) => void
  onMove: (id: string, direction: number) => void
  onRemove: (id: string) => void
  onStartResize: (event: ReactMouseEvent<HTMLButtonElement>, widgetId: string, minHeight: number) => void
}

export function DsDashboardWidgetCard({
  widget,
  isLoading,
  byStatus,
  topGestoras,
  topEntidades,
  byMonth,
  totals,
  draggedWidgetId,
  dropWidgetId,
  resizingWidgetId,
  onSetDraggedId,
  onSetDropId,
  onReorder,
  onToggleColumn,
  onAdjustWidth,
  onAdjustHeight,
  onMove,
  onRemove,
  onStartResize,
}: DsDashboardWidgetCardProps) {
  const effectiveColSpan = widget.column === 'side' ? 1 : clampDashboardWidgetColSpan(widget.colSpan || 1)
  const canShrinkWidth = widget.column !== 'side' && effectiveColSpan > DASHBOARD_WIDGET_MIN_COL_SPAN
  const canGrowWidth = widget.column !== 'side' && effectiveColSpan < DASHBOARD_WIDGET_MAX_COL_SPAN

  const headerLabel =
    widget.type === 'ds-status'
      ? 'Estado DS'
      : widget.type === 'ds-top-gestoras'
        ? 'Top gestoras'
        : widget.type === 'ds-top-entidades'
          ? 'Top entidades'
          : widget.type === 'ds-mensal'
            ? 'Tendência mensal (12 meses)'
            : 'Recibos'

  let content: React.ReactNode
  if (widget.type === 'ds-status') {
    content = <DashboardBars rows={byStatus} />
  } else if (widget.type === 'ds-top-gestoras') {
    content = <DashboardBars rows={topGestoras} />
  } else if (widget.type === 'ds-top-entidades') {
    content = <DashboardBars rows={topEntidades} />
  } else if (widget.type === 'ds-mensal') {
    content = <DashboardBars rows={byMonth} currency />
  } else {
    content = (
      <>
        <DashboardKpi label="Com recibo" value={totals.comRecibo} />
        <DashboardKpi label="Sem recibo" value={totals.semRecibo} />
        <DashboardKpi label="Comissão gestor" value={totals.comissaoGestor} currency />
      </>
    )
  }

  return (
    <article
      className={`dashboard-widget-card ds-dashboard-widget-card size-${widget.size} span-${effectiveColSpan} ${draggedWidgetId === widget.id ? 'dragging' : ''} ${dropWidgetId === widget.id ? 'drop-target' : ''} ${resizingWidgetId === widget.id ? 'resizing' : ''}`}
      style={{ minHeight: `${widget.minHeight}px` }}
      draggable={!resizingWidgetId}
      onDragStart={(event) => {
        if (resizingWidgetId) {
          event.preventDefault()
          return
        }
        onSetDraggedId(widget.id)
        onSetDropId(widget.id)
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', widget.id)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        if (dropWidgetId !== widget.id) {
          onSetDropId(widget.id)
        }
      }}
      onDrop={(event) => {
        event.preventDefault()
        const sourceWidgetId = event.dataTransfer.getData('text/plain') || draggedWidgetId
        if (sourceWidgetId) {
          onReorder(sourceWidgetId, widget.id)
        }
        onSetDraggedId(null)
        onSetDropId(null)
      }}
      onDragEnd={() => {
        onSetDraggedId(null)
        onSetDropId(null)
      }}
    >
      <div className="dashboard-widget-head">
        <h4>{headerLabel}</h4>
        <div className="dashboard-widget-actions">
          <button className="subtle-btn icon-btn micro drag-handle-btn" type="button" title="Arrastar widget">
            <GripVertical size={14} />
          </button>
          <button
            className="subtle-btn icon-btn micro"
            type="button"
            title={widget.column === 'side' ? 'Mover para coluna principal' : 'Mover para coluna lateral'}
            onClick={() => onToggleColumn(widget.id)}
          >
            {widget.column === 'side' ? '↤' : '↦'}
          </button>
          <button
            className="subtle-btn icon-btn micro"
            type="button"
            title={widget.column === 'side' ? 'Mova para a coluna principal para ajustar largura' : 'Diminuir largura'}
            onClick={() => onAdjustWidth(widget.id, -1)}
            disabled={!canShrinkWidth}
          >
            <Minimize2 size={14} />
          </button>
          <button
            className="subtle-btn icon-btn micro"
            type="button"
            title={widget.column === 'side' ? 'Mova para a coluna principal para ajustar largura' : 'Aumentar largura'}
            onClick={() => onAdjustWidth(widget.id, 1)}
            disabled={!canGrowWidth}
          >
            <Maximize2 size={14} />
          </button>
          <button
            className="subtle-btn icon-btn micro"
            type="button"
            title="Diminuir altura"
            onClick={() => onAdjustHeight(widget.id, -80)}
          >
            <Minus size={14} />
          </button>
          <button
            className="subtle-btn icon-btn micro"
            type="button"
            title="Aumentar altura"
            onClick={() => onAdjustHeight(widget.id, 80)}
          >
            <Plus size={14} />
          </button>
          <button
            className="subtle-btn icon-btn micro"
            type="button"
            title="Mover para cima"
            onClick={() => onMove(widget.id, -1)}
          >
            ↑
          </button>
          <button
            className="subtle-btn icon-btn micro"
            type="button"
            title="Mover para baixo"
            onClick={() => onMove(widget.id, 1)}
          >
            ↓
          </button>
          <button
            className="subtle-btn icon-btn micro danger"
            type="button"
            title="Remover widget"
            onClick={() => onRemove(widget.id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="dashboard-widget-content">
        {isLoading ? <div className="small-note">A carregar dados…</div> : content}
      </div>
      <div className="dashboard-widget-footer">
        <button
          className="subtle-btn icon-btn micro resize-widget-handle"
          type="button"
          title="Arrastar para redimensionar altura"
          onMouseDown={(event) => onStartResize(event, widget.id, widget.minHeight)}
        >
          ⇳
        </button>
      </div>
    </article>
  )
}
