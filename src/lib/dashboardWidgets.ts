/**
 * Dashboard widget type definitions and constants shared across all modules.
 * Pure data — no side effects, no React dependencies.
 */

// ---- Shared widget layout types ----------------------------------------

export type DashboardWidgetSize = 'kpi' | 'normal' | 'wide'
export type DashboardWidgetColumn = 'main' | 'side'
export type DashboardWidgetScope = 'recibos' | 'ds' | 'penhoras'

export const DASHBOARD_WIDGET_MIN_HEIGHT = 96
export const DASHBOARD_WIDGET_MAX_HEIGHT = 2200
export const DASHBOARD_WIDGET_MIN_COL_SPAN = 1
export const DASHBOARD_WIDGET_MAX_COL_SPAN = 3

// ---- Recibos dashboard widgets -----------------------------------------

export type DashboardWidgetType =
    | 'kpi-registos'
    | 'kpi-valor-sem-iva'
    | 'kpi-iva'
    | 'kpi-retencao'
    | 'kpi-levantado-com-iva'
    | 'chart-status'
    | 'chart-tipo'
    | 'chart-mensal-emissao'
    | 'list-top-gestores'
    | 'list-top-exequentes'

export type DashboardWidget = {
    id: string
    type: DashboardWidgetType
    size: DashboardWidgetSize
    minHeight: number
    column: DashboardWidgetColumn
    colSpan: number
}

export const DASHBOARD_WIDGET_LIBRARY: Array<{ type: DashboardWidgetType; label: string; hint: string }> = [
    { type: 'kpi-registos', label: 'Total registos', hint: 'KPI' },
    { type: 'kpi-valor-sem-iva', label: 'Total sem IVA', hint: 'KPI' },
    { type: 'kpi-iva', label: 'Total IVA', hint: 'KPI' },
    { type: 'kpi-retencao', label: 'Total retenção', hint: 'KPI' },
    { type: 'kpi-levantado-com-iva', label: 'Levantado c/ IVA', hint: 'KPI' },
    { type: 'chart-status', label: 'Distribuição por estado', hint: 'Gráfico barras' },
    { type: 'chart-tipo', label: 'Distribuição por tipo', hint: 'Gráfico barras' },
    { type: 'chart-mensal-emissao', label: 'Tendência mensal emissão', hint: 'Últimos 12 meses' },
    { type: 'list-top-gestores', label: 'Top gestores', hint: 'Ranking' },
    { type: 'list-top-exequentes', label: 'Top exequentes', hint: 'Ranking' },
]

// ---- DS dashboard widgets ----------------------------------------------

export type DsDashboardWidgetType = 'ds-status' | 'ds-top-gestoras' | 'ds-top-entidades' | 'ds-mensal' | 'ds-recibos'

export type DsDashboardWidget = {
    id: string
    type: DsDashboardWidgetType
    size: DashboardWidgetSize
    minHeight: number
    column: DashboardWidgetColumn
    colSpan: number
}

export const DS_DASHBOARD_WIDGET_LIBRARY: Array<{ type: DsDashboardWidgetType; label: string; hint: string }> = [
    { type: 'ds-status', label: 'Estado DS', hint: 'Distribuição por estado' },
    { type: 'ds-top-gestoras', label: 'Top gestoras', hint: 'Ranking por volume' },
    { type: 'ds-top-entidades', label: 'Top entidades', hint: 'Ranking por volume' },
    { type: 'ds-mensal', label: 'Tendência mensal', hint: 'Últimos 12 meses' },
    { type: 'ds-recibos', label: 'Recibos', hint: 'KPI de recibos/comissões' },
]

export const DEFAULT_DS_DASHBOARD_WIDGETS: DsDashboardWidget[] = [
    { id: 'ds-status', type: 'ds-status', size: 'normal', minHeight: 210, column: 'main', colSpan: 1 },
    { id: 'ds-top-gestoras', type: 'ds-top-gestoras', size: 'normal', minHeight: 210, column: 'main', colSpan: 1 },
    { id: 'ds-top-entidades', type: 'ds-top-entidades', size: 'normal', minHeight: 210, column: 'main', colSpan: 1 },
    { id: 'ds-mensal', type: 'ds-mensal', size: 'wide', minHeight: 220, column: 'main', colSpan: 2 },
    { id: 'ds-recibos', type: 'ds-recibos', size: 'kpi', minHeight: 180, column: 'side', colSpan: 1 },
]

export function cloneDefaultDsDashboardWidgets(): DsDashboardWidget[] {
    return DEFAULT_DS_DASHBOARD_WIDGETS.map((widget) => ({ ...widget }))
}

// ---- Penhoras dashboard widgets ----------------------------------------

export type PenhorasDashboardWidgetType = 'penhoras-status' | 'penhoras-top-gestores' | 'penhoras-mensal'

export type PenhorasDashboardWidget = {
    id: string
    type: PenhorasDashboardWidgetType
    size: DashboardWidgetSize
    minHeight: number
    column: DashboardWidgetColumn
    colSpan: number
}

export const PENHORAS_DASHBOARD_WIDGET_LIBRARY: Array<{ type: PenhorasDashboardWidgetType; label: string; hint: string }> = [
    { type: 'penhoras-status', label: 'Estado Penhoras', hint: 'Distribuição por estado' },
    { type: 'penhoras-top-gestores', label: 'Top gestores', hint: 'Ranking por volume' },
    { type: 'penhoras-mensal', label: 'Tendência mensal', hint: 'Últimos 12 meses' },
]

export const DEFAULT_PENHORAS_DASHBOARD_WIDGETS: PenhorasDashboardWidget[] = [
    { id: 'penhoras-status', type: 'penhoras-status', size: 'normal', minHeight: 210, column: 'main', colSpan: 1 },
    { id: 'penhoras-top-gestores', type: 'penhoras-top-gestores', size: 'normal', minHeight: 210, column: 'main', colSpan: 1 },
    { id: 'penhoras-mensal', type: 'penhoras-mensal', size: 'wide', minHeight: 220, column: 'main', colSpan: 2 },
]

export function cloneDefaultPenhorasDashboardWidgets(): PenhorasDashboardWidget[] {
    return DEFAULT_PENHORAS_DASHBOARD_WIDGETS.map((widget) => ({ ...widget }))
}

// ---- Layout helpers ----------------------------------------------------

export function sanitizeDashboardWidgetSize(value: unknown, fallback: DashboardWidgetSize): DashboardWidgetSize {
    if (value === 'kpi' || value === 'normal' || value === 'wide') {
        return value
    }
    return fallback
}

export function sanitizeDashboardWidgetColumn(value: unknown, fallback: DashboardWidgetColumn): DashboardWidgetColumn {
    if (value === 'main' || value === 'side') {
        return value
    }
    return fallback
}

export function clampDashboardWidgetHeight(value: number): number {
    if (!Number.isFinite(value)) return DASHBOARD_WIDGET_MIN_HEIGHT
    return Math.min(DASHBOARD_WIDGET_MAX_HEIGHT, Math.max(DASHBOARD_WIDGET_MIN_HEIGHT, Math.round(value)))
}

export function clampDashboardWidgetColSpan(value: number): number {
    if (!Number.isFinite(value)) return DASHBOARD_WIDGET_MIN_COL_SPAN
    return Math.min(DASHBOARD_WIDGET_MAX_COL_SPAN, Math.max(DASHBOARD_WIDGET_MIN_COL_SPAN, Math.round(value)))
}

export function defaultDashboardWidgetLayout(type: DashboardWidgetType): {
    size: DashboardWidgetSize
    minHeight: number
    column: DashboardWidgetColumn
    colSpan: number
} {
    if (type.startsWith('kpi-')) {
        return { size: 'kpi', minHeight: 110, column: 'side', colSpan: 1 }
    }
    if (type === 'chart-mensal-emissao' || type === 'chart-status' || type === 'chart-tipo') {
        return { size: 'wide', minHeight: 210, column: 'main', colSpan: 2 }
    }
    return { size: 'normal', minHeight: 180, column: 'main', colSpan: 1 }
}

export function defaultDsDashboardWidgetLayout(type: DsDashboardWidgetType): {
    size: DashboardWidgetSize
    minHeight: number
    column: DashboardWidgetColumn
    colSpan: number
} {
    const found = DEFAULT_DS_DASHBOARD_WIDGETS.find((widget) => widget.type === type)
    if (found) {
        return {
            size: found.size,
            minHeight: found.minHeight,
            column: found.column,
            colSpan: found.colSpan,
        }
    }
    return { size: 'normal', minHeight: 180, column: 'main', colSpan: 1 }
}

export function defaultPenhorasDashboardWidgetLayout(type: PenhorasDashboardWidgetType): {
    size: DashboardWidgetSize
    minHeight: number
    column: DashboardWidgetColumn
    colSpan: number
} {
    const found = DEFAULT_PENHORAS_DASHBOARD_WIDGETS.find((widget) => widget.type === type)
    if (found) {
        return {
            size: found.size,
            minHeight: found.minHeight,
            column: found.column,
            colSpan: found.colSpan,
        }
    }
    return { size: 'normal', minHeight: 180, column: 'main', colSpan: 1 }
}

// ---- Widget list parsers (for localStorage persistence) ----------------

export function parseDashboardWidgets(input: unknown): DashboardWidget[] {
    if (!Array.isArray(input)) return []
    const allowed = new Set<DashboardWidgetType>(DASHBOARD_WIDGET_LIBRARY.map((widget) => widget.type))
    return input
        .map((item) => {
            if (typeof item !== 'object' || item === null) return null
            const widget = item as { id?: unknown; type?: unknown; size?: unknown; minHeight?: unknown; column?: unknown; colSpan?: unknown }
            if (typeof widget.type !== 'string' || !allowed.has(widget.type as DashboardWidgetType)) return null
            const baseLayout = defaultDashboardWidgetLayout(widget.type as DashboardWidgetType)
            const numericHeight = Number(widget.minHeight)
            const numericColSpan = Number(widget.colSpan)
            const parsedColumn = sanitizeDashboardWidgetColumn(widget.column, baseLayout.column)
            return {
                id: typeof widget.id === 'string' && widget.id.trim() ? widget.id : crypto.randomUUID(),
                type: widget.type as DashboardWidgetType,
                size: sanitizeDashboardWidgetSize(widget.size, baseLayout.size),
                minHeight: clampDashboardWidgetHeight(Number.isFinite(numericHeight) ? numericHeight : baseLayout.minHeight),
                column: parsedColumn,
                colSpan: parsedColumn === 'side' ? 1 : clampDashboardWidgetColSpan(Number.isFinite(numericColSpan) ? numericColSpan : baseLayout.colSpan),
            }
        })
        .filter((widget): widget is DashboardWidget => Boolean(widget))
}

export function parseDsDashboardWidgets(input: unknown): DsDashboardWidget[] {
    if (!Array.isArray(input)) return []
    const allowed = new Set<DsDashboardWidgetType>(DEFAULT_DS_DASHBOARD_WIDGETS.map((widget) => widget.type))
    return input
        .map((item) => {
            if (typeof item !== 'object' || item === null) return null
            const widget = item as { id?: unknown; type?: unknown; size?: unknown; minHeight?: unknown; column?: unknown; colSpan?: unknown }
            if (typeof widget.type !== 'string' || !allowed.has(widget.type as DsDashboardWidgetType)) return null
            const baseLayout = defaultDsDashboardWidgetLayout(widget.type as DsDashboardWidgetType)
            const numericHeight = Number(widget.minHeight)
            const numericColSpan = Number(widget.colSpan)
            const parsedColumn = sanitizeDashboardWidgetColumn(widget.column, baseLayout.column)
            return {
                id: typeof widget.id === 'string' && widget.id.trim() ? widget.id : crypto.randomUUID(),
                type: widget.type as DsDashboardWidgetType,
                size: sanitizeDashboardWidgetSize(widget.size, baseLayout.size),
                minHeight: clampDashboardWidgetHeight(Number.isFinite(numericHeight) ? numericHeight : baseLayout.minHeight),
                column: parsedColumn,
                colSpan: parsedColumn === 'side' ? 1 : clampDashboardWidgetColSpan(Number.isFinite(numericColSpan) ? numericColSpan : baseLayout.colSpan),
            }
        })
        .filter((widget): widget is DsDashboardWidget => Boolean(widget))
}

export function parsePenhorasDashboardWidgets(input: unknown): PenhorasDashboardWidget[] {
    if (!Array.isArray(input)) return []
    const allowed = new Set<PenhorasDashboardWidgetType>(DEFAULT_PENHORAS_DASHBOARD_WIDGETS.map((widget) => widget.type))
    return input
        .map((item) => {
            if (typeof item !== 'object' || item === null) return null
            const widget = item as { id?: unknown; type?: unknown; size?: unknown; minHeight?: unknown; column?: unknown; colSpan?: unknown }
            if (typeof widget.type !== 'string' || !allowed.has(widget.type as PenhorasDashboardWidgetType)) return null
            const baseLayout = defaultPenhorasDashboardWidgetLayout(widget.type as PenhorasDashboardWidgetType)
            const numericHeight = Number(widget.minHeight)
            const numericColSpan = Number(widget.colSpan)
            const parsedColumn = sanitizeDashboardWidgetColumn(widget.column, baseLayout.column)
            return {
                id: typeof widget.id === 'string' && widget.id.trim() ? widget.id : crypto.randomUUID(),
                type: widget.type as PenhorasDashboardWidgetType,
                size: sanitizeDashboardWidgetSize(widget.size, baseLayout.size),
                minHeight: clampDashboardWidgetHeight(Number.isFinite(numericHeight) ? numericHeight : baseLayout.minHeight),
                column: parsedColumn,
                colSpan: parsedColumn === 'side' ? 1 : clampDashboardWidgetColSpan(Number.isFinite(numericColSpan) ? numericColSpan : baseLayout.colSpan),
            }
        })
        .filter((widget): widget is PenhorasDashboardWidget => Boolean(widget))
}
