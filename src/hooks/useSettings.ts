import type { Dispatch, SetStateAction } from 'react'

import { api } from '../api'
import { applyFormAutoCalculations } from '../lib/calculations'
import type { CalculationSettings, EntryForm, StatusDefinition, TaxRule } from '../types'

interface UseSettingsParams {
  settingsDraft: CalculationSettings
  setSettingsDraft: Dispatch<SetStateAction<CalculationSettings>>
  setCalculationSettings: Dispatch<SetStateAction<CalculationSettings>>
  statuses: StatusDefinition[]
  setStatuses: Dispatch<SetStateAction<StatusDefinition[]>>
  dsStatuses: StatusDefinition[]
  setDsStatuses: Dispatch<SetStateAction<StatusDefinition[]>>
  penhorasStatuses: StatusDefinition[]
  setPenhorasStatuses: Dispatch<SetStateAction<StatusDefinition[]>>
  orderedStatuses: StatusDefinition[]
  dsOrderedStatuses: StatusDefinition[]
  penhorasOrderedStatuses: StatusDefinition[]
  refreshRecords: () => Promise<void>
  refreshDsRecords: () => Promise<void>
  refreshPenhorasRecords: () => Promise<void>
  setFeedback: (message: string) => void
  setEntryForm: Dispatch<SetStateAction<EntryForm>>
}

export function useSettings({
  settingsDraft,
  setSettingsDraft,
  setCalculationSettings,
  statuses,
  setStatuses,
  dsStatuses,
  setDsStatuses,
  penhorasStatuses,
  setPenhorasStatuses,
  orderedStatuses,
  dsOrderedStatuses,
  penhorasOrderedStatuses,
  refreshRecords,
  refreshDsRecords,
  refreshPenhorasRecords,
  setFeedback,
  setEntryForm,
}: UseSettingsParams) {
  function updateSettingsDraft(patch: Partial<CalculationSettings>) {
    setSettingsDraft((current) => ({ ...current, ...patch }))
  }

  function updateTaxRule(ruleId: string, patch: Partial<TaxRule>) {
    setSettingsDraft((current) => ({
      ...current,
      taxRules: current.taxRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
    }))
  }

  async function saveCalculationSettings() {
    try {
      const updated = await api.updateCalculationSettings(settingsDraft)
      setCalculationSettings(updated)
      setSettingsDraft(updated)
      setFeedback('Configuração de cálculos guardada.')
      setEntryForm((current) => applyFormAutoCalculations(current, updated))
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar configurações.')
    }
  }

  async function saveStatuses() {
    try {
      for (const status of statuses) {
        await api.updateStatus(status.id, {
          key: status.key,
          label: status.label,
          icon: status.icon,
          color: status.color,
          active: status.active,
          order: status.order,
        })
      }
      setFeedback('Estados atualizados.')
      const refreshedStatuses = await api.getStatuses()
      setStatuses(refreshedStatuses)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar estados.')
    }
  }

  async function saveDsStatuses() {
    try {
      for (const status of dsStatuses) {
        await api.updateDsStatus(status.id, {
          key: status.key,
          label: status.label,
          icon: status.icon,
          color: status.color,
          active: status.active,
          order: status.order,
        })
      }
      setFeedback('Estados DS atualizados.')
      const refreshedStatuses = await api.getDsStatuses()
      setDsStatuses(refreshedStatuses)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar estados DS.')
    }
  }

  async function savePenhorasStatuses() {
    try {
      for (const status of penhorasStatuses) {
        await api.updatePenhorasStatus(status.id, {
          key: status.key,
          label: status.label,
          icon: status.icon,
          color: status.color,
          active: status.active,
          order: status.order,
        })
      }
      setFeedback('Estados Penhoras atualizados.')
      const refreshedStatuses = await api.getPenhorasStatuses()
      setPenhorasStatuses(refreshedStatuses)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar estados Penhoras.')
    }
  }

  async function addStatus() {
    try {
      const created = await api.createStatus({
        key: `custom-${crypto.randomUUID().slice(0, 8)}`,
        label: 'Novo estado',
        icon: 'circle',
        color: '#D9E2EC',
        active: true,
        order: statuses.length + 1,
      })
      setStatuses((current) => [...current, created])
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao criar estado.')
    }
  }

  async function addDsStatus() {
    try {
      const created = await api.createDsStatus({
        key: `ds-custom-${crypto.randomUUID().slice(0, 8)}`,
        label: 'Novo estado DS',
        icon: 'circle',
        color: '#D9E2EC',
        active: true,
        order: dsStatuses.length + 1,
      })
      setDsStatuses((current) => [...current, created])
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao criar estado DS.')
    }
  }

  async function addPenhorasStatus() {
    try {
      const created = await api.createPenhorasStatus({
        key: `penhoras-custom-${crypto.randomUUID().slice(0, 8)}`,
        label: 'Novo estado Penhoras',
        icon: 'circle',
        color: '#D9E2EC',
        active: true,
        order: penhorasStatuses.length + 1,
      })
      setPenhorasStatuses((current) => [...current, created])
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao criar estado Penhoras.')
    }
  }

  async function removeStatus(statusId: string) {
    try {
      await api.deleteStatus(statusId)
      setStatuses((current) => current.filter((status) => status.id !== statusId))
      setFeedback('Estado removido.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao remover estado.'
      if (message.includes('Estado em uso')) {
        const fallbackStatus =
          orderedStatuses.find((status) => status.id !== statusId && status.active) ??
          orderedStatuses.find((status) => status.id !== statusId)
        if (!fallbackStatus) {
          setFeedback('Não existe estado alternativo para reatribuição dos registos.')
          return
        }

        const confirmed = window.confirm(
          `Este estado está em uso. Pretende reatribuir os registos para "${fallbackStatus.label}" e remover mesmo assim?`,
        )
        if (!confirmed) {
          return
        }

        try {
          await api.deleteStatus(statusId, { reassignToStatusId: fallbackStatus.id })
          const refreshedStatuses = await api.getStatuses()
          setStatuses(refreshedStatuses)
          await refreshRecords()
          setFeedback(`Estado removido e registos reatribuídos para "${fallbackStatus.label}".`)
          return
        } catch (reassignError) {
          setFeedback(reassignError instanceof Error ? reassignError.message : 'Falha ao remover estado com reatribuição.')
          return
        }
      }
      setFeedback(message)
    }
  }

  async function removeDsStatus(statusId: string) {
    try {
      await api.deleteDsStatus(statusId)
      setDsStatuses((current) => current.filter((status) => status.id !== statusId))
      setFeedback('Estado DS removido.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao remover estado DS.'
      if (message.includes('Estado DS em uso')) {
        const fallbackStatus =
          dsOrderedStatuses.find((status) => status.id !== statusId && status.active) ??
          dsOrderedStatuses.find((status) => status.id !== statusId)
        if (!fallbackStatus) {
          setFeedback('Não existe estado DS alternativo para reatribuição.')
          return
        }
        const confirmed = window.confirm(
          `Este estado DS está em uso. Pretende reatribuir os registos para "${fallbackStatus.label}" e remover mesmo assim?`,
        )
        if (!confirmed) return
        try {
          await api.deleteDsStatus(statusId, { reassignToStatusId: fallbackStatus.id })
          const refreshedStatuses = await api.getDsStatuses()
          setDsStatuses(refreshedStatuses)
          await refreshDsRecords()
          setFeedback(`Estado DS removido e registos reatribuídos para "${fallbackStatus.label}".`)
          return
        } catch (reassignError) {
          setFeedback(reassignError instanceof Error ? reassignError.message : 'Falha ao remover estado DS com reatribuição.')
          return
        }
      }
      setFeedback(message)
    }
  }

  async function removePenhorasStatus(statusId: string) {
    try {
      await api.deletePenhorasStatus(statusId)
      setPenhorasStatuses((current) => current.filter((status) => status.id !== statusId))
      setFeedback('Estado Penhoras removido.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao remover estado Penhoras.'
      if (message.includes('Estado Penhoras em uso')) {
        const fallbackStatus =
          penhorasOrderedStatuses.find((status) => status.id !== statusId && status.active) ??
          penhorasOrderedStatuses.find((status) => status.id !== statusId)
        if (!fallbackStatus) {
          setFeedback('Não existe estado Penhoras alternativo para reatribuição.')
          return
        }
        const confirmed = window.confirm(
          `Este estado Penhoras está em uso. Pretende reatribuir os registos para "${fallbackStatus.label}" e remover mesmo assim?`,
        )
        if (!confirmed) return
        try {
          await api.deletePenhorasStatus(statusId, { reassignToStatusId: fallbackStatus.id })
          const refreshedStatuses = await api.getPenhorasStatuses()
          setPenhorasStatuses(refreshedStatuses)
          await refreshPenhorasRecords()
          setFeedback(`Estado Penhoras removido e registos reatribuídos para "${fallbackStatus.label}".`)
          return
        } catch (reassignError) {
          setFeedback(reassignError instanceof Error ? reassignError.message : 'Falha ao remover estado Penhoras com reatribuição.')
          return
        }
      }
      setFeedback(message)
    }
  }

  function updateStatusLocal(statusId: string, patch: Partial<StatusDefinition>) {
    setStatuses((current) => current.map((status) => (status.id === statusId ? { ...status, ...patch } : status)))
  }

  function updateDsStatusLocal(statusId: string, patch: Partial<StatusDefinition>) {
    setDsStatuses((current) => current.map((status) => (status.id === statusId ? { ...status, ...patch } : status)))
  }

  function updatePenhorasStatusLocal(statusId: string, patch: Partial<StatusDefinition>) {
    setPenhorasStatuses((current) => current.map((status) => (status.id === statusId ? { ...status, ...patch } : status)))
  }

  return {
    updateSettingsDraft,
    updateTaxRule,
    saveCalculationSettings,
    saveStatuses,
    saveDsStatuses,
    savePenhorasStatuses,
    addStatus,
    addDsStatus,
    addPenhorasStatus,
    removeStatus,
    removeDsStatus,
    removePenhorasStatus,
    updateStatusLocal,
    updateDsStatusLocal,
    updatePenhorasStatusLocal,
  }
}
