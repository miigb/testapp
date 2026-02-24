import type { Dispatch, SetStateAction } from 'react'

import { api } from '../api'
import { DEFAULT_DASHBOARD_FILTERS } from '../constants'
import type { DashboardWidget } from '../lib/dashboardWidgets'
import type {
  DsRecordFilters,
  PenhorasRecordFilters,
  RecordFilters,
  SavedView,
} from '../types'

interface UseDashboardHandlersParams {
  dashboardFilters: RecordFilters
  globalSearch: string
  setDashboardLoading: Dispatch<SetStateAction<boolean>>
  setDashboardSummary: Dispatch<SetStateAction<import('../types').AnalyticsSummary | null>>
  dashboardName: string
  activeDashboardId: string | null
  dashboardSavePayload: Record<string, unknown>
  setSavedViews: Dispatch<SetStateAction<SavedView[]>>
  setActiveDashboardId: Dispatch<SetStateAction<string | null>>
  setDashboardName: Dispatch<SetStateAction<string>>
  setDashboardFilters: Dispatch<SetStateAction<RecordFilters>>
  setDashboardWidgets: Dispatch<SetStateAction<DashboardWidget[]>>
  setDashboardConfigOpen: Dispatch<SetStateAction<boolean>>
  setActiveSavedViewId: Dispatch<SetStateAction<string | null>>
  setFilters: Dispatch<SetStateAction<RecordFilters>>
  setActiveDsSavedViewId: Dispatch<SetStateAction<string | null>>
  setDsFilters: Dispatch<SetStateAction<DsRecordFilters>>
  setActivePenhorasSavedViewId: Dispatch<SetStateAction<string | null>>
  setPenhorasFilters: Dispatch<SetStateAction<PenhorasRecordFilters>>
  setFeedback: (message: string) => void
}

export function useDashboardHandlers({
  dashboardFilters,
  globalSearch,
  setDashboardLoading,
  setDashboardSummary,
  dashboardName,
  activeDashboardId,
  dashboardSavePayload,
  setSavedViews,
  setActiveDashboardId,
  setDashboardName,
  setDashboardFilters,
  setDashboardWidgets,
  setDashboardConfigOpen,
  setActiveSavedViewId,
  setFilters,
  setActiveDsSavedViewId,
  setDsFilters,
  setActivePenhorasSavedViewId,
  setPenhorasFilters,
  setFeedback,
}: UseDashboardHandlersParams) {
  async function refreshDashboardSummary() {
    setDashboardLoading(true)
    try {
      const summary = await api.getAnalyticsSummary({
        ...dashboardFilters,
        q: globalSearch,
      })
      setDashboardSummary(summary)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao carregar métricas do dashboard.')
    } finally {
      setDashboardLoading(false)
    }
  }

  function resetDashboardDraft() {
    setActiveDashboardId(null)
    setDashboardName('Dashboard')
    setDashboardFilters(DEFAULT_DASHBOARD_FILTERS)
    setDashboardWidgets([])
    setDashboardConfigOpen(true)
  }

  async function saveDashboard(options?: { asNew?: boolean }) {
    const trimmedName = dashboardName.trim() || 'Dashboard'

    try {
      if (options?.asNew || !activeDashboardId) {
        const created = await api.createSavedView({
          name: trimmedName,
          scope: 'dashboard',
          filters: dashboardSavePayload,
        })
        setSavedViews((current) => [created, ...current])
        setActiveDashboardId(created.id)
        setDashboardName(created.name)
        setFeedback('Dashboard guardado.')
        return
      }

      const updated = await api.updateSavedView(activeDashboardId, {
        name: trimmedName,
        filters: dashboardSavePayload,
      })
      setSavedViews((current) => current.map((view) => (view.id === updated.id ? updated : view)))
      setFeedback('Dashboard atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar dashboard.')
    }
  }

  async function deleteDashboard() {
    if (!activeDashboardId) return
    const confirmed = window.confirm('Eliminar este dashboard?')
    if (!confirmed) return

    try {
      await api.deleteSavedView(activeDashboardId)
      setSavedViews((current) => current.filter((view) => view.id !== activeDashboardId))
      resetDashboardDraft()
      setFeedback('Dashboard eliminado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao eliminar dashboard.')
    }
  }

  function patchFilters<K extends keyof RecordFilters>(key: K, value: RecordFilters[K]) {
    setActiveSavedViewId(null)
    setFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }

  function patchDsFilters<K extends keyof DsRecordFilters>(key: K, value: DsRecordFilters[K]) {
    setActiveDsSavedViewId(null)
    setDsFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }

  function patchPenhorasFilters<K extends keyof PenhorasRecordFilters>(key: K, value: PenhorasRecordFilters[K]) {
    setActivePenhorasSavedViewId(null)
    setPenhorasFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }

  function patchDashboardFilters<K extends keyof RecordFilters>(key: K, value: RecordFilters[K]) {
    setDashboardFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }

  return {
    refreshDashboardSummary,
    resetDashboardDraft,
    saveDashboard,
    deleteDashboard,
    patchFilters,
    patchDsFilters,
    patchPenhorasFilters,
    patchDashboardFilters,
  }
}
