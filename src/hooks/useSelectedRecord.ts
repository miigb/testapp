import { useEffect } from 'react'
import type { DsEntryForm, DsRecord, EntryForm, ModuleId, PenhorasEntryForm, PenhorasRecord, ReceiptRecord } from '../types'
import { api } from '../api'
import { recordToForm } from '../lib/recordHelpers'
import { dsRecordToForm } from '../lib/dsHelpers'
import { penhorasRecordToForm } from '../lib/penhorasHelpers'

interface UseSelectedRecordParams {
  activeModule: ModuleId
  // Recibos
  selectedRecordId: string | null
  records: ReceiptRecord[]
  selectedRecord: ReceiptRecord | null
  setSelectedRecord: (record: ReceiptRecord | null) => void
  setSelectedRecordEdit: (form: EntryForm | null) => void
  setIsRecordEditing: (editing: boolean) => void
  // DS
  selectedDsRecordId: string | null
  dsRecords: DsRecord[]
  selectedDsRecord: DsRecord | null
  setSelectedDsRecord: (record: DsRecord | null) => void
  setSelectedDsRecordEdit: (form: DsEntryForm | null) => void
  setIsDsRecordEditing: (editing: boolean) => void
  // Penhoras
  selectedPenhorasRecordId: string | null
  penhorasRecords: PenhorasRecord[]
  selectedPenhorasRecord: PenhorasRecord | null
  setSelectedPenhorasRecord: (record: PenhorasRecord | null) => void
  setSelectedPenhorasRecordEdit: (form: PenhorasEntryForm | null) => void
  setIsPenhorasRecordEditing: (editing: boolean) => void
}

export function useSelectedRecord({
  activeModule,
  selectedRecordId,
  records,
  selectedRecord,
  setSelectedRecord,
  setSelectedRecordEdit,
  setIsRecordEditing,
  selectedDsRecordId,
  dsRecords,
  selectedDsRecord,
  setSelectedDsRecord,
  setSelectedDsRecordEdit,
  setIsDsRecordEditing,
  selectedPenhorasRecordId,
  penhorasRecords,
  selectedPenhorasRecord,
  setSelectedPenhorasRecord,
  setSelectedPenhorasRecordEdit,
  setIsPenhorasRecordEditing,
}: UseSelectedRecordParams) {
  useEffect(() => {
    if (activeModule !== 'recibos') {
      setSelectedRecord(null)
      setSelectedRecordEdit(null)
      return
    }
    if (!selectedRecordId) {
      setSelectedRecord(null)
      setSelectedRecordEdit(null)
      setIsRecordEditing(false)
      return
    }

    void (async () => {
      try {
        const record = await api.getRecord(selectedRecordId)
        setSelectedRecord(record)
        setSelectedRecordEdit(recordToForm(record))
      } catch {
        const fallback = records.find((item) => item.id === selectedRecordId) ?? null
        setSelectedRecord(fallback)
        setSelectedRecordEdit(fallback ? recordToForm(fallback) : null)
      }
    })()
  }, [selectedRecordId, records, activeModule])

  useEffect(() => {
    if (!selectedRecord) {
      setSelectedRecordEdit(null)
      setIsRecordEditing(false)
      return
    }

    setSelectedRecordEdit(recordToForm(selectedRecord))
  }, [selectedRecord])

  useEffect(() => {
    if (activeModule !== 'ds') {
      setSelectedDsRecord(null)
      setSelectedDsRecordEdit(null)
      return
    }
    if (!selectedDsRecordId) {
      setSelectedDsRecord(null)
      setSelectedDsRecordEdit(null)
      setIsDsRecordEditing(false)
      return
    }

    void (async () => {
      try {
        const record = await api.getDsRecord(selectedDsRecordId)
        setSelectedDsRecord(record)
        setSelectedDsRecordEdit(dsRecordToForm(record))
      } catch {
        const fallback = dsRecords.find((item) => item.id === selectedDsRecordId) ?? null
        setSelectedDsRecord(fallback)
        setSelectedDsRecordEdit(fallback ? dsRecordToForm(fallback) : null)
      }
    })()
  }, [selectedDsRecordId, dsRecords, activeModule])

  useEffect(() => {
    if (!selectedDsRecord) {
      setSelectedDsRecordEdit(null)
      setIsDsRecordEditing(false)
      return
    }

    setSelectedDsRecordEdit(dsRecordToForm(selectedDsRecord))
  }, [selectedDsRecord])

  useEffect(() => {
    if (activeModule !== 'penhoras') {
      setSelectedPenhorasRecord(null)
      setSelectedPenhorasRecordEdit(null)
      return
    }
    if (!selectedPenhorasRecordId) {
      setSelectedPenhorasRecord(null)
      setSelectedPenhorasRecordEdit(null)
      setIsPenhorasRecordEditing(false)
      return
    }

    void (async () => {
      try {
        const record = await api.getPenhorasRecord(selectedPenhorasRecordId)
        setSelectedPenhorasRecord(record)
        setSelectedPenhorasRecordEdit(penhorasRecordToForm(record))
      } catch {
        const fallback = penhorasRecords.find((item) => item.id === selectedPenhorasRecordId) ?? null
        setSelectedPenhorasRecord(fallback)
        setSelectedPenhorasRecordEdit(fallback ? penhorasRecordToForm(fallback) : null)
      }
    })()
  }, [selectedPenhorasRecordId, penhorasRecords, activeModule])

  useEffect(() => {
    if (!selectedPenhorasRecord) {
      setSelectedPenhorasRecordEdit(null)
      setIsPenhorasRecordEditing(false)
      return
    }

    setSelectedPenhorasRecordEdit(penhorasRecordToForm(selectedPenhorasRecord))
  }, [selectedPenhorasRecord])
}
