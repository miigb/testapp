import type { Dispatch, SetStateAction } from 'react'

import { api } from '../api'
import { formToPayload, recordToPatchPayload } from '../lib/recordHelpers'
import { dsFormToPayload } from '../lib/dsHelpers'
import { penhorasFormToPayload } from '../lib/penhorasHelpers'
import type {
  DsEntryForm,
  DsRecord,
  EntryForm,
  PenhorasEntryForm,
  PenhorasRecord,
  ReceiptRecord,
} from '../types'

interface UseRecordActionsParams {
  records: ReceiptRecord[]
  dsRecords: DsRecord[]
  penhorasRecords: PenhorasRecord[]
  selectedIds: string[]
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  allSelectedInTable: boolean
  pushUndo: (entry: { label: string; run: () => Promise<void> }) => void
  selectedRecordId: string | null
  setSelectedRecordId: Dispatch<SetStateAction<string | null>>
  selectedRecord: ReceiptRecord | null
  selectedDsRecord: DsRecord | null
  selectedPenhorasRecord: PenhorasRecord | null
  selectedRecordEdit: EntryForm | null
  selectedDsRecordEdit: DsEntryForm | null
  selectedPenhorasRecordEdit: PenhorasEntryForm | null
  setIsRecordEditing: Dispatch<SetStateAction<boolean>>
  setIsDsRecordEditing: Dispatch<SetStateAction<boolean>>
  setIsPenhorasRecordEditing: Dispatch<SetStateAction<boolean>>
  setSelectedDsRecordId: Dispatch<SetStateAction<string | null>>
  setSelectedPenhorasRecordId: Dispatch<SetStateAction<string | null>>
  bulkStatusId: string
  bulkGestor: string
  bulkExequente: string
  bulkIndicacoes: string
  bulkForceRecalculate: boolean
  refreshRecords: () => Promise<void>
  refreshDsRecords: () => Promise<void>
  refreshPenhorasRecords: () => Promise<void>
  setFeedback: (message: string) => void
}

export function useRecordActions({
  records,
  dsRecords,
  penhorasRecords,
  selectedIds,
  setSelectedIds,
  allSelectedInTable,
  pushUndo,
  selectedRecordId,
  setSelectedRecordId,
  selectedRecord,
  selectedDsRecord,
  selectedPenhorasRecord,
  selectedRecordEdit,
  selectedDsRecordEdit,
  selectedPenhorasRecordEdit,
  setIsRecordEditing,
  setIsDsRecordEditing,
  setIsPenhorasRecordEditing,
  setSelectedDsRecordId,
  setSelectedPenhorasRecordId,
  bulkStatusId,
  bulkGestor,
  bulkExequente,
  bulkIndicacoes,
  bulkForceRecalculate,
  refreshRecords,
  refreshDsRecords,
  refreshPenhorasRecords,
  setFeedback,
}: UseRecordActionsParams) {
  async function updateRecordStatus(
    recordId: string,
    statusId: string,
    options?: {
      registerUndo?: boolean
    },
  ) {
    const registerUndo = options?.registerUndo ?? true
    const previous = records.find((record) => record.id === recordId)
    if (previous && previous.estadoId === statusId) return

    try {
      await api.updateRecordStatus(recordId, statusId)
      if (registerUndo && previous) {
        pushUndo({
          label: `estado de ${previous.pe || previous.processo || previous.reciboNumero || 'registo'}`,
          run: async () => {
            await updateRecordStatus(recordId, previous.estadoId, { registerUndo: false })
          },
        })
      }
      await refreshRecords()
      if (selectedRecordId === recordId) {
        setSelectedRecordId(recordId)
      }
      setFeedback('Estado atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar estado.')
    }
  }

  async function updateDsRecordStatus(recordId: string, statusId: string) {
    const previous = dsRecords.find((record) => record.id === recordId)
    if (previous && previous.estadoId === statusId) return

    try {
      await api.updateDsRecordStatus(recordId, statusId)
      await refreshDsRecords()
      setFeedback('Estado DS atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar estado DS.')
    }
  }

  async function updatePenhorasRecordStatus(recordId: string, statusId: string) {
    const previous = penhorasRecords.find((record) => record.id === recordId)
    if (previous && previous.estadoId === statusId) return

    try {
      await api.updatePenhorasRecordStatus(recordId, statusId)
      await refreshPenhorasRecords()
      setFeedback('Estado Penhoras atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar estado Penhoras.')
    }
  }

  async function runBulkStatusUpdate() {
    if (!bulkStatusId || selectedIds.length === 0) {
      return
    }

    try {
      const before = records
        .filter((record) => selectedIds.includes(record.id))
        .map((record) => ({ id: record.id, estadoId: record.estadoId }))
      const result = await api.bulkStatus(selectedIds, bulkStatusId)
      if (before.length > 0) {
        pushUndo({
          label: 'alteração de estado em lote',
          run: async () => {
            await Promise.all(before.map((item) => api.updateRecordStatus(item.id, item.estadoId)))
          },
        })
      }
      setFeedback(`Atualização em lote concluída: ${result.updated} registos.`)
      setSelectedIds([])
      await refreshRecords()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha na atualização em lote.')
    }
  }

  async function runBulkFieldUpdate() {
    if (selectedIds.length === 0) return

    const patch: Partial<ReceiptRecord> = {}
    if (bulkGestor.trim()) patch.gestor = bulkGestor.trim()
    if (bulkExequente.trim()) patch.exequente = bulkExequente.trim()
    if (bulkIndicacoes.trim()) patch.indicacoes = bulkIndicacoes.trim()

    if (Object.keys(patch).length === 0 && !bulkForceRecalculate) {
      setFeedback('Defina pelo menos um campo para atualizar em lote ou ative recálculo fiscal.')
      return
    }

    const before = records.filter((record) => selectedIds.includes(record.id))

    try {
      const result = await api.bulkUpdate(selectedIds, patch, { forceRecalculate: bulkForceRecalculate })
      if (before.length > 0) {
        pushUndo({
          label: 'edição em lote',
          run: async () => {
            await Promise.all(before.map((record) => api.patchRecord(record.id, recordToPatchPayload(record))))
          },
        })
      }
      setFeedback(`Edição em lote concluída: ${result.updated} registos.`)
      setSelectedIds([])
      await refreshRecords()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha na edição em lote.')
    }
  }

  async function saveSelectedRecordEdits() {
    if (!selectedRecord || !selectedRecordEdit) return

    const previous = selectedRecord

    try {
      await api.patchRecord(selectedRecord.id, formToPayload(selectedRecordEdit))
      pushUndo({
        label: `edição de ${previous.pe || previous.processo || previous.reciboNumero || 'registo'}`,
        run: async () => {
          await api.patchRecord(previous.id, recordToPatchPayload(previous))
        },
      })
      setIsRecordEditing(false)
      await refreshRecords()
      setSelectedRecordId(previous.id)
      setFeedback('Registo atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar registo.')
    }
  }

  async function saveSelectedDsRecordEdits() {
    if (!selectedDsRecord || !selectedDsRecordEdit) return

    try {
      await api.patchDsRecord(selectedDsRecord.id, dsFormToPayload(selectedDsRecordEdit))
      setIsDsRecordEditing(false)
      await refreshDsRecords()
      setSelectedDsRecordId(selectedDsRecord.id)
      setFeedback('Registo DS atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar registo DS.')
    }
  }

  async function saveSelectedPenhorasRecordEdits() {
    if (!selectedPenhorasRecord || !selectedPenhorasRecordEdit) return

    try {
      await api.patchPenhorasRecord(selectedPenhorasRecord.id, penhorasFormToPayload(selectedPenhorasRecordEdit))
      setIsPenhorasRecordEditing(false)
      await refreshPenhorasRecords()
      setSelectedPenhorasRecordId(selectedPenhorasRecord.id)
      setFeedback('Registo Penhoras atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar registo Penhoras.')
    }
  }

  function toggleSelectRecord(recordId: string) {
    setSelectedIds((current) => (current.includes(recordId) ? current.filter((id) => id !== recordId) : [...current, recordId]))
  }

  function toggleSelectAllRecords() {
    if (allSelectedInTable) {
      setSelectedIds([])
      return
    }
    setSelectedIds(records.map((record) => record.id))
  }

  return {
    updateRecordStatus,
    updateDsRecordStatus,
    updatePenhorasRecordStatus,
    runBulkStatusUpdate,
    runBulkFieldUpdate,
    saveSelectedRecordEdits,
    saveSelectedDsRecordEdits,
    saveSelectedPenhorasRecordEdits,
    toggleSelectRecord,
    toggleSelectAllRecords,
  }
}
