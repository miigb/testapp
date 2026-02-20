import { useState, useMemo, useEffect } from 'react'
import { api } from '../api'
import type { SavedView, RecordFilters, DsRecordFilters, PenhorasRecordFilters } from '../types'
import { resolveInitialDisabledSavedViewIds } from '../lib/localStorage'
import { DEFAULT_TABLE_FILTERS, DEFAULT_DS_FILTERS, DEFAULT_PENHORAS_FILTERS } from '../constants'
import { sanitizeDsFilters, sanitizePenhorasFilters, sanitizeDashboardFilters } from '../lib/sanitizers'
import { parseDsDashboardWidgets, parsePenhorasDashboardWidgets, parseDashboardWidgets } from '../lib/dashboardWidgets'
import type { DashboardWidget, DsDashboardWidget, PenhorasDashboardWidget } from '../lib/dashboardWidgets'

export interface SavedViewsControls {
    setFilters: React.Dispatch<React.SetStateAction<RecordFilters>>
    setGlobalSearch: React.Dispatch<React.SetStateAction<string>>
    setFeedback: (msg: string) => void
    setDsFilters: React.Dispatch<React.SetStateAction<DsRecordFilters>>
    setDsDashboardWidgets: React.Dispatch<React.SetStateAction<DsDashboardWidget[]>>
    setPenhorasFilters: React.Dispatch<React.SetStateAction<PenhorasRecordFilters>>
    setPenhorasDashboardWidgets: React.Dispatch<React.SetStateAction<PenhorasDashboardWidget[]>>
    setDashboardFilters: React.Dispatch<React.SetStateAction<RecordFilters>>
    setDashboardWidgets: React.Dispatch<React.SetStateAction<DashboardWidget[]>>
    setActiveDashboardId: React.Dispatch<React.SetStateAction<string | null>>
    setDashboardName: React.Dispatch<React.SetStateAction<string>>
}

export function useSavedViews({
    setFilters,
    setGlobalSearch,
    setFeedback,
    setDsFilters,
    setDsDashboardWidgets,
    setPenhorasFilters,
    setPenhorasDashboardWidgets,
    setDashboardFilters,
    setDashboardWidgets,
    setActiveDashboardId,
    setDashboardName,
}: SavedViewsControls) {
    const [savedViews, setSavedViews] = useState<SavedView[]>([])
    const [disabledSavedViewIds, setDisabledSavedViewIds] = useState<string[]>(resolveInitialDisabledSavedViewIds)
    const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null)
    const [activeDsSavedViewId, setActiveDsSavedViewId] = useState<string | null>(null)
    const [activePenhorasSavedViewId, setActivePenhorasSavedViewId] = useState<string | null>(null)

    const tableViews = useMemo(() => savedViews.filter((view) => view.scope === 'tabela'), [savedViews])

    useEffect(() => {
        localStorage.setItem('mesa-recibos-disabled-saved-views', JSON.stringify(disabledSavedViewIds))
    }, [disabledSavedViewIds])

    async function saveCurrentView(
        scope: 'tabela' | 'ds-tabela' | 'ds-dashboard' | 'penhoras-tabela' | 'penhoras-dashboard',
        filtersPayload: Record<string, unknown>,
    ) {
        const name = window.prompt('Nome da vista')
        if (!name) return

        try {
            const created = await api.createSavedView({ name, scope, filters: filtersPayload })
            setSavedViews((current) => [created, ...current])
            setFeedback(
                scope.startsWith('ds-')
                    ? 'Vista DS guardada.'
                    : scope.startsWith('penhoras-')
                        ? 'Vista Penhoras guardada.'
                        : 'Vista guardada.',
            )
        } catch (error) {
            setFeedback(
                error instanceof Error
                    ? error.message
                    : scope.startsWith('ds-')
                        ? 'Falha ao guardar vista DS.'
                        : scope.startsWith('penhoras-')
                            ? 'Falha ao guardar vista Penhoras.'
                            : 'Falha ao guardar vista.',
            )
        }
    }

    function clearTableFilters(options?: { silent?: boolean }) {
        setFilters(DEFAULT_TABLE_FILTERS)
        setGlobalSearch('')
        setActiveSavedViewId(null)
        if (!options?.silent) {
            setFeedback('Filtros limpos.')
        }
    }

    function applyView(view: SavedView, options?: { enableIfDisabled?: boolean }) {
        const payload = view.filters
        setActiveSavedViewId(view.id)
        if (options?.enableIfDisabled ?? true) {
            setDisabledSavedViewIds((current) => current.filter((id) => id !== view.id))
        }
        setFilters((current) => ({
            ...current,
            tipo: (payload.tipo as RecordFilters['tipo']) ?? 'todos',
            estadoId: (payload.estadoId as RecordFilters['estadoId']) ?? 'todos',
            mes: (payload.mes as RecordFilters['mes']) ?? 'todos',
            ano: (payload.ano as RecordFilters['ano']) ?? 'todos',
            exequente: (payload.exequente as RecordFilters['exequente']) ?? '',
            gestor: (payload.gestor as RecordFilters['gestor']) ?? '',
            page: 1,
        }))
        setGlobalSearch(typeof payload.q === 'string' ? payload.q : '')
    }

    async function deleteSavedView(viewId: string) {
        const confirmed = window.confirm('Eliminar esta vista guardada?')
        if (!confirmed) return

        try {
            await api.deleteSavedView(viewId)
            const nextSavedViews = savedViews.filter((view) => view.id !== viewId)
            const nextDisabledIds = disabledSavedViewIds.filter((id) => id !== viewId)
            setSavedViews(nextSavedViews)
            setDisabledSavedViewIds(nextDisabledIds)
            if (activeSavedViewId === viewId) {
                const fallbackView = nextSavedViews
                    .filter((view) => view.scope === 'tabela')
                    .find((view) => !nextDisabledIds.includes(view.id))
                if (fallbackView) {
                    applyView(fallbackView, { enableIfDisabled: false })
                } else {
                    clearTableFilters({ silent: true })
                }
            }
            setFeedback('Vista eliminada.')
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'Falha ao eliminar vista.')
        }
    }

    function toggleSavedViewDisabled(viewId: string) {
        const isDisabled = disabledSavedViewIds.includes(viewId)

        if (isDisabled) {
            setDisabledSavedViewIds((current) => current.filter((id) => id !== viewId))
            const view = tableViews.find((item) => item.id === viewId)
            if (view) {
                applyView(view, { enableIfDisabled: false })
            }
            return
        }

        const nextDisabledIds = [...disabledSavedViewIds, viewId]
        setDisabledSavedViewIds(nextDisabledIds)

        if (activeSavedViewId === viewId) {
            const fallbackView = tableViews.find((view) => view.id !== viewId && !nextDisabledIds.includes(view.id))
            if (fallbackView) {
                applyView(fallbackView, { enableIfDisabled: false })
            } else {
                clearTableFilters({ silent: true })
            }
        }
    }

    function clearDsFilters(options?: { silent?: boolean }) {
        setDsFilters(DEFAULT_DS_FILTERS)
        setGlobalSearch('')
        setActiveDsSavedViewId(null)
        if (!options?.silent) {
            setFeedback('Filtros DS limpos.')
        }
    }

    function applyDsView(view: SavedView, options?: { enableIfDisabled?: boolean }) {
        const payload = view.filters
        setActiveDsSavedViewId(view.id)
        if (options?.enableIfDisabled ?? true) {
            setDisabledSavedViewIds((current) => current.filter((id) => id !== view.id))
        }
        setDsFilters(sanitizeDsFilters(payload))
        if (view.scope === 'ds-dashboard') {
            const parsedWidgets = parseDsDashboardWidgets((payload as Record<string, unknown>).widgets)
            if (parsedWidgets.length > 0) {
                setDsDashboardWidgets(parsedWidgets)
            }
        }
        setGlobalSearch(typeof payload.q === 'string' ? payload.q : '')
    }

    async function deleteDsSavedView(viewId: string) {
        const confirmed = window.confirm('Eliminar esta vista DS guardada?')
        if (!confirmed) return

        try {
            await api.deleteSavedView(viewId)
            const nextSavedViews = savedViews.filter((view) => view.id !== viewId)
            const nextDisabledIds = disabledSavedViewIds.filter((id) => id !== viewId)
            setSavedViews(nextSavedViews)
            setDisabledSavedViewIds(nextDisabledIds)

            if (activeDsSavedViewId === viewId) {
                const fallbackView = nextSavedViews
                    .filter(
                        (view) => (view.scope === 'ds-tabela' || view.scope === 'ds-dashboard') && !nextDisabledIds.includes(view.id),
                    )
                    .find(Boolean)
                if (fallbackView) {
                    applyDsView(fallbackView, { enableIfDisabled: false })
                } else {
                    clearDsFilters({ silent: true })
                }
            }
            setFeedback('Vista DS eliminada.')
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'Falha ao eliminar vista DS.')
        }
    }

    function toggleDsSavedViewDisabled(viewId: string) {
        const isDisabled = disabledSavedViewIds.includes(viewId)
        const dsViews = savedViews.filter((view) => view.scope === 'ds-tabela' || view.scope === 'ds-dashboard')

        if (isDisabled) {
            setDisabledSavedViewIds((current) => current.filter((id) => id !== viewId))
            const view = dsViews.find((item) => item.id === viewId)
            if (view) {
                applyDsView(view, { enableIfDisabled: false })
            }
            return
        }

        const nextDisabledIds = [...disabledSavedViewIds, viewId]
        setDisabledSavedViewIds(nextDisabledIds)

        if (activeDsSavedViewId === viewId) {
            const fallbackView = dsViews.find((view) => view.id !== viewId && !nextDisabledIds.includes(view.id))
            if (fallbackView) {
                applyDsView(fallbackView, { enableIfDisabled: false })
            } else {
                clearDsFilters({ silent: true })
            }
        }
    }

    function clearPenhorasFilters(options?: { silent?: boolean }) {
        setPenhorasFilters(DEFAULT_PENHORAS_FILTERS)
        setGlobalSearch('')
        setActivePenhorasSavedViewId(null)
        if (!options?.silent) {
            setFeedback('Filtros Penhoras limpos.')
        }
    }

    function applyPenhorasView(view: SavedView, options?: { enableIfDisabled?: boolean }) {
        const payload = view.filters
        setActivePenhorasSavedViewId(view.id)
        if (options?.enableIfDisabled ?? true) {
            setDisabledSavedViewIds((current) => current.filter((id) => id !== view.id))
        }
        setPenhorasFilters(sanitizePenhorasFilters(payload))
        if (view.scope === 'penhoras-dashboard') {
            const parsedWidgets = parsePenhorasDashboardWidgets((payload as Record<string, unknown>).widgets)
            if (parsedWidgets.length > 0) {
                setPenhorasDashboardWidgets(parsedWidgets)
            }
        }
        setGlobalSearch(typeof payload.q === 'string' ? payload.q : '')
    }

    async function deletePenhorasSavedView(viewId: string) {
        const confirmed = window.confirm('Eliminar esta vista Penhoras guardada?')
        if (!confirmed) return

        try {
            await api.deleteSavedView(viewId)
            const nextSavedViews = savedViews.filter((view) => view.id !== viewId)
            const nextDisabledIds = disabledSavedViewIds.filter((id) => id !== viewId)
            setSavedViews(nextSavedViews)
            setDisabledSavedViewIds(nextDisabledIds)

            if (activePenhorasSavedViewId === viewId) {
                const fallbackView = nextSavedViews
                    .filter(
                        (view) =>
                            (view.scope === 'penhoras-tabela' || view.scope === 'penhoras-dashboard') &&
                            !nextDisabledIds.includes(view.id),
                    )
                    .find(Boolean)
                if (fallbackView) {
                    applyPenhorasView(fallbackView, { enableIfDisabled: false })
                } else {
                    clearPenhorasFilters({ silent: true })
                }
            }
            setFeedback('Vista Penhoras eliminada.')
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'Falha ao eliminar vista Penhoras.')
        }
    }

    function togglePenhorasSavedViewDisabled(viewId: string) {
        const isDisabled = disabledSavedViewIds.includes(viewId)
        const penhorasViews = savedViews.filter(
            (view) => view.scope === 'penhoras-tabela' || view.scope === 'penhoras-dashboard',
        )

        if (isDisabled) {
            setDisabledSavedViewIds((current) => current.filter((id) => id !== viewId))
            const view = penhorasViews.find((item) => item.id === viewId)
            if (view) {
                applyPenhorasView(view, { enableIfDisabled: false })
            }
            return
        }

        const nextDisabledIds = [...disabledSavedViewIds, viewId]
        setDisabledSavedViewIds(nextDisabledIds)

        if (activePenhorasSavedViewId === viewId) {
            const fallbackView = penhorasViews.find((view) => view.id !== viewId && !nextDisabledIds.includes(view.id))
            if (fallbackView) {
                applyPenhorasView(fallbackView, { enableIfDisabled: false })
            } else {
                clearPenhorasFilters({ silent: true })
            }
        }
    }

    // Handle generic Dashboard Views (from old code)
    function loadDashboardView(view: SavedView) {
        const payload = (view.filters ?? {}) as Record<string, unknown>
        const viewFilters = payload.filters && typeof payload.filters === 'object' ? payload.filters : payload
        setActiveDashboardId(view.id)
        setDashboardName(view.name || 'Dashboard')
        setDashboardFilters(sanitizeDashboardFilters(viewFilters))
        setDashboardWidgets(parseDashboardWidgets(payload.widgets))
    }

    return {
        savedViews,
        setSavedViews,
        disabledSavedViewIds,
        setDisabledSavedViewIds,
        activeSavedViewId,
        setActiveSavedViewId,
        activeDsSavedViewId,
        setActiveDsSavedViewId,
        activePenhorasSavedViewId,
        setActivePenhorasSavedViewId,
        saveCurrentView,
        deleteSavedView,
        toggleSavedViewDisabled,
        clearTableFilters,
        applyView,
        deleteDsSavedView,
        toggleDsSavedViewDisabled,
        clearDsFilters,
        applyDsView,
        deletePenhorasSavedView,
        togglePenhorasSavedViewDisabled,
        clearPenhorasFilters,
        applyPenhorasView,
        loadDashboardView,
    }
}
