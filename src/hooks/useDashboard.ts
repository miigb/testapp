import { useState, useRef, useEffect } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import {
    defaultDashboardWidgetLayout,
    defaultDsDashboardWidgetLayout,
    defaultPenhorasDashboardWidgetLayout,
    clampDashboardWidgetColSpan,
    clampDashboardWidgetHeight,
    cloneDefaultDsDashboardWidgets,
    cloneDefaultPenhorasDashboardWidgets,
} from '../lib/dashboardWidgets'
import type {
    DashboardWidget,
    DsDashboardWidget,
    PenhorasDashboardWidget,
    DashboardWidgetType,
    DsDashboardWidgetType,
    PenhorasDashboardWidgetType,
    DashboardWidgetScope,
} from '../lib/dashboardWidgets'
import type { TabId } from '../types'

export function useDashboard(activeTab: TabId) {
    const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([])
    const [dsDashboardWidgets, setDsDashboardWidgets] = useState<DsDashboardWidget[]>(cloneDefaultDsDashboardWidgets)
    const [penhorasDashboardWidgets, setPenhorasDashboardWidgets] = useState<PenhorasDashboardWidget[]>(
        cloneDefaultPenhorasDashboardWidgets,
    )

    const [dsDashboardWidgetsOpen, setDsDashboardWidgetsOpen] = useState(true)
    const [penhorasDashboardWidgetsOpen, setPenhorasDashboardWidgetsOpen] = useState(true)

    const [dashboardFocusMode, setDashboardFocusMode] = useState(false)
    const [resizingDashboardWidgetId, setResizingDashboardWidgetId] = useState<string | null>(null)

    const widgetResizeRef = useRef<{
        scope: DashboardWidgetScope
        widgetId: string
        startY: number
        startHeight: number
    } | null>(null)

    useEffect(() => {
        if (activeTab !== 'dashboards' && dashboardFocusMode) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDashboardFocusMode(false)
        }
    }, [activeTab, dashboardFocusMode])

    useEffect(() => {
        if (!resizingDashboardWidgetId) return

        function onPointerMove(event: MouseEvent) {
            const resizeState = widgetResizeRef.current
            if (!resizeState) return
            const deltaY = event.clientY - resizeState.startY
            const nextHeight = clampDashboardWidgetHeight(resizeState.startHeight + deltaY)
            if (resizeState.scope === 'recibos') {
                setDashboardWidgets((current) =>
                    current.map((widget) => (widget.id === resizeState.widgetId ? { ...widget, minHeight: nextHeight } : widget)),
                )
            } else if (resizeState.scope === 'ds') {
                setDsDashboardWidgets((current) =>
                    current.map((widget) => (widget.id === resizeState.widgetId ? { ...widget, minHeight: nextHeight } : widget)),
                )
            } else {
                setPenhorasDashboardWidgets((current) =>
                    current.map((widget) => (widget.id === resizeState.widgetId ? { ...widget, minHeight: nextHeight } : widget)),
                )
            }
        }

        function stopResize() {
            widgetResizeRef.current = null
            setResizingDashboardWidgetId(null)
        }

        window.addEventListener('mousemove', onPointerMove)
        window.addEventListener('mouseup', stopResize, { once: true })
        return () => {
            window.removeEventListener('mousemove', onPointerMove)
            window.removeEventListener('mouseup', stopResize)
        }
    }, [resizingDashboardWidgetId])

    function startDashboardWidgetResize(
        event: ReactMouseEvent<HTMLButtonElement>,
        scope: DashboardWidgetScope,
        widgetId: string,
        currentHeight: number,
    ) {
        event.preventDefault()
        event.stopPropagation()
        widgetResizeRef.current = {
            scope,
            widgetId,
            startY: event.clientY,
            startHeight: currentHeight,
        }
        setResizingDashboardWidgetId(widgetId)
    }

    // --- Recibos Dashboard Actions ---

    function addDashboardWidget(type: DashboardWidgetType) {
        const baseLayout = defaultDashboardWidgetLayout(type)
        setDashboardWidgets((current) => [
            ...current,
            {
                id: crypto.randomUUID(),
                type,
                size: baseLayout.size,
                minHeight: baseLayout.minHeight,
                column: baseLayout.column,
                colSpan: baseLayout.column === 'side' ? 1 : baseLayout.colSpan,
            },
        ])
    }

    function removeDashboardWidget(widgetId: string) {
        setDashboardWidgets((current) => current.filter((widget) => widget.id !== widgetId))
    }

    function moveDashboardWidget(widgetId: string, direction: -1 | 1) {
        setDashboardWidgets((current) => {
            const index = current.findIndex((widget) => widget.id === widgetId)
            if (index < 0) return current
            const nextIndex = index + direction
            if (nextIndex < 0 || nextIndex >= current.length) return current
            const next = [...current]
            const [item] = next.splice(index, 1)
            next.splice(nextIndex, 0, item)
            return next
        })
    }

    function reorderDashboardWidgets(sourceWidgetId: string, targetWidgetId: string) {
        if (sourceWidgetId === targetWidgetId) return
        setDashboardWidgets((current) => {
            const sourceIndex = current.findIndex((widget) => widget.id === sourceWidgetId)
            const targetIndex = current.findIndex((widget) => widget.id === targetWidgetId)
            if (sourceIndex < 0 || targetIndex < 0) return current
            const next = [...current]
            const [source] = next.splice(sourceIndex, 1)
            next.splice(targetIndex, 0, source)
            return next
        })
    }

    function adjustDashboardWidgetWidth(widgetId: string, delta: number) {
        setDashboardWidgets((current) =>
            current.map((widget) => {
                if (widget.id !== widgetId) return widget
                if (widget.column === 'side') return widget
                const baseLayout = defaultDashboardWidgetLayout(widget.type)
                const nextColSpan = clampDashboardWidgetColSpan((widget.colSpan || baseLayout.colSpan) + delta)
                return {
                    ...widget,
                    colSpan: nextColSpan,
                    size: nextColSpan >= 2 ? 'wide' : widget.type.startsWith('kpi-') ? 'kpi' : 'normal',
                }
            }),
        )
    }

    function toggleDashboardWidgetColumn(widgetId: string) {
        setDashboardWidgets((current) =>
            current.map((widget) => {
                if (widget.id !== widgetId) return widget
                const baseLayout = defaultDashboardWidgetLayout(widget.type)
                const nextColumn = widget.column === 'side' ? 'main' : 'side'
                const nextColSpan = nextColumn === 'side' ? 1 : clampDashboardWidgetColSpan(widget.colSpan || baseLayout.colSpan)
                return {
                    ...widget,
                    column: nextColumn,
                    colSpan: nextColSpan,
                    size: nextColSpan >= 2 ? 'wide' : widget.type.startsWith('kpi-') ? 'kpi' : 'normal',
                }
            }),
        )
    }

    function adjustDashboardWidgetHeight(widgetId: string, delta: number) {
        setDashboardWidgets((current) =>
            current.map((widget) =>
                widget.id === widgetId
                    ? {
                        ...widget,
                        minHeight: clampDashboardWidgetHeight(widget.minHeight + delta),
                    }
                    : widget,
            ),
        )
    }

    // --- DS Dashboard Actions ---

    function addDsDashboardWidget(type: DsDashboardWidgetType) {
        const baseLayout = defaultDsDashboardWidgetLayout(type)
        setDsDashboardWidgets((current) => [
            ...current,
            {
                id: crypto.randomUUID(),
                type,
                size: baseLayout.size,
                minHeight: baseLayout.minHeight,
                column: baseLayout.column,
                colSpan: baseLayout.column === 'side' ? 1 : baseLayout.colSpan,
            },
        ])
    }

    function removeDsDashboardWidget(widgetId: string) {
        setDsDashboardWidgets((current) => current.filter((widget) => widget.id !== widgetId))
    }

    function moveDsDashboardWidget(widgetId: string, direction: -1 | 1) {
        setDsDashboardWidgets((current) => {
            const index = current.findIndex((widget) => widget.id === widgetId)
            if (index < 0) return current
            const nextIndex = index + direction
            if (nextIndex < 0 || nextIndex >= current.length) return current
            const next = [...current]
            const [item] = next.splice(index, 1)
            next.splice(nextIndex, 0, item)
            return next
        })
    }

    function reorderDsDashboardWidgets(sourceWidgetId: string, targetWidgetId: string) {
        if (sourceWidgetId === targetWidgetId) return
        setDsDashboardWidgets((current) => {
            const sourceIndex = current.findIndex((widget) => widget.id === sourceWidgetId)
            const targetIndex = current.findIndex((widget) => widget.id === targetWidgetId)
            if (sourceIndex < 0 || targetIndex < 0) return current
            const next = [...current]
            const [source] = next.splice(sourceIndex, 1)
            next.splice(targetIndex, 0, source)
            return next
        })
    }

    function adjustDsDashboardWidgetWidth(widgetId: string, delta: number) {
        setDsDashboardWidgets((current) =>
            current.map((widget) => {
                if (widget.id !== widgetId) return widget
                if (widget.column === 'side') return widget
                const baseLayout = defaultDsDashboardWidgetLayout(widget.type)
                const nextColSpan = clampDashboardWidgetColSpan((widget.colSpan || baseLayout.colSpan) + delta)
                return {
                    ...widget,
                    colSpan: nextColSpan,
                    size: nextColSpan >= 2 ? 'wide' : widget.type === 'ds-recibos' ? 'kpi' : 'normal',
                }
            }),
        )
    }

    function toggleDsDashboardWidgetColumn(widgetId: string) {
        setDsDashboardWidgets((current) =>
            current.map((widget) => {
                if (widget.id !== widgetId) return widget
                const baseLayout = defaultDsDashboardWidgetLayout(widget.type)
                const nextColumn = widget.column === 'side' ? 'main' : 'side'
                const nextColSpan = nextColumn === 'side' ? 1 : clampDashboardWidgetColSpan(widget.colSpan || baseLayout.colSpan)
                return {
                    ...widget,
                    column: nextColumn,
                    colSpan: nextColSpan,
                    size: nextColSpan >= 2 ? 'wide' : widget.type === 'ds-recibos' ? 'kpi' : 'normal',
                }
            }),
        )
    }

    function adjustDsDashboardWidgetHeight(widgetId: string, delta: number) {
        setDsDashboardWidgets((current) =>
            current.map((widget) =>
                widget.id === widgetId
                    ? {
                        ...widget,
                        minHeight: clampDashboardWidgetHeight(widget.minHeight + delta),
                    }
                    : widget,
            ),
        )
    }

    // --- Penhoras Dashboard Actions ---

    function addPenhorasDashboardWidget(type: PenhorasDashboardWidgetType) {
        const baseLayout = defaultPenhorasDashboardWidgetLayout(type)
        setPenhorasDashboardWidgets((current) => [
            ...current,
            {
                id: crypto.randomUUID(),
                type,
                size: baseLayout.size,
                minHeight: baseLayout.minHeight,
                column: baseLayout.column,
                colSpan: baseLayout.column === 'side' ? 1 : baseLayout.colSpan,
            },
        ])
    }

    function removePenhorasDashboardWidget(widgetId: string) {
        setPenhorasDashboardWidgets((current) => current.filter((widget) => widget.id !== widgetId))
    }

    function movePenhorasDashboardWidget(widgetId: string, direction: -1 | 1) {
        setPenhorasDashboardWidgets((current) => {
            const index = current.findIndex((widget) => widget.id === widgetId)
            if (index < 0) return current
            const nextIndex = index + direction
            if (nextIndex < 0 || nextIndex >= current.length) return current
            const next = [...current]
            const [item] = next.splice(index, 1)
            next.splice(nextIndex, 0, item)
            return next
        })
    }

    function reorderPenhorasDashboardWidgets(sourceWidgetId: string, targetWidgetId: string) {
        if (sourceWidgetId === targetWidgetId) return
        setPenhorasDashboardWidgets((current) => {
            const sourceIndex = current.findIndex((widget) => widget.id === sourceWidgetId)
            const targetIndex = current.findIndex((widget) => widget.id === targetWidgetId)
            if (sourceIndex < 0 || targetIndex < 0) return current
            const next = [...current]
            const [source] = next.splice(sourceIndex, 1)
            next.splice(targetIndex, 0, source)
            return next
        })
    }

    function adjustPenhorasDashboardWidgetWidth(widgetId: string, delta: number) {
        setPenhorasDashboardWidgets((current) =>
            current.map((widget) => {
                if (widget.id !== widgetId) return widget
                if (widget.column === 'side') return widget
                const baseLayout = defaultPenhorasDashboardWidgetLayout(widget.type)
                const nextColSpan = clampDashboardWidgetColSpan((widget.colSpan || baseLayout.colSpan) + delta)
                return {
                    ...widget,
                    colSpan: nextColSpan,
                    size: nextColSpan >= 2 ? 'wide' : 'normal',
                }
            }),
        )
    }

    function togglePenhorasDashboardWidgetColumn(widgetId: string) {
        setPenhorasDashboardWidgets((current) =>
            current.map((widget) => {
                if (widget.id !== widgetId) return widget
                const baseLayout = defaultPenhorasDashboardWidgetLayout(widget.type)
                const nextColumn = widget.column === 'side' ? 'main' : 'side'
                const nextColSpan = nextColumn === 'side' ? 1 : clampDashboardWidgetColSpan(widget.colSpan || baseLayout.colSpan)
                return {
                    ...widget,
                    column: nextColumn,
                    colSpan: nextColSpan,
                    size: nextColSpan >= 2 ? 'wide' : 'normal',
                }
            }),
        )
    }

    function adjustPenhorasDashboardWidgetHeight(widgetId: string, delta: number) {
        setPenhorasDashboardWidgets((current) =>
            current.map((widget) =>
                widget.id === widgetId
                    ? {
                        ...widget,
                        minHeight: clampDashboardWidgetHeight(widget.minHeight + delta),
                    }
                    : widget,
            ),
        )
    }

    return {
        dashboardWidgets,
        setDashboardWidgets,
        dsDashboardWidgets,
        setDsDashboardWidgets,
        penhorasDashboardWidgets,
        setPenhorasDashboardWidgets,
        dsDashboardWidgetsOpen,
        setDsDashboardWidgetsOpen,
        penhorasDashboardWidgetsOpen,
        setPenhorasDashboardWidgetsOpen,
        dashboardFocusMode,
        setDashboardFocusMode,
        resizingDashboardWidgetId,
        startDashboardWidgetResize,
        addDashboardWidget,
        removeDashboardWidget,
        moveDashboardWidget,
        reorderDashboardWidgets,
        adjustDashboardWidgetWidth,
        toggleDashboardWidgetColumn,
        adjustDashboardWidgetHeight,
        addDsDashboardWidget,
        removeDsDashboardWidget,
        moveDsDashboardWidget,
        reorderDsDashboardWidgets,
        adjustDsDashboardWidgetWidth,
        toggleDsDashboardWidgetColumn,
        adjustDsDashboardWidgetHeight,
        addPenhorasDashboardWidget,
        removePenhorasDashboardWidget,
        movePenhorasDashboardWidget,
        reorderPenhorasDashboardWidgets,
        adjustPenhorasDashboardWidgetWidth,
        togglePenhorasDashboardWidgetColumn,
        adjustPenhorasDashboardWidgetHeight,
    }
}
