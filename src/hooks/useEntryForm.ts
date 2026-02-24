import type { Dispatch, FormEvent, SetStateAction } from 'react'

import { api } from '../api'
import { applyFormAutoCalculations } from '../lib/calculations'
import { getInitialEntryForm, formToPayload } from '../lib/recordHelpers'
import { getInitialDsEntryForm, dsFormToPayload } from '../lib/dsHelpers'
import { getInitialPenhorasEntryForm, penhorasFormToPayload } from '../lib/penhorasHelpers'
import type {
  CalculationSettings,
  DsEntryForm,
  EntryForm,
  PenhorasEntryForm,
  StatusDefinition,
  TabId,
} from '../types'

interface UseEntryFormParams {
  entryForm: EntryForm
  setEntryForm: Dispatch<SetStateAction<EntryForm>>
  dsEntryForm: DsEntryForm
  setDsEntryForm: Dispatch<SetStateAction<DsEntryForm>>
  penhorasEntryForm: PenhorasEntryForm
  setPenhorasEntryForm: Dispatch<SetStateAction<PenhorasEntryForm>>
  calculationSettings: CalculationSettings
  defaultStatus: StatusDefinition | undefined
  dsDefaultStatus: StatusDefinition | undefined
  penhorasDefaultStatus: StatusDefinition | undefined
  setSelectedRecordEdit: Dispatch<SetStateAction<EntryForm | null>>
  setSelectedDsRecordEdit: Dispatch<SetStateAction<DsEntryForm | null>>
  setSelectedPenhorasRecordEdit: Dispatch<SetStateAction<PenhorasEntryForm | null>>
  refreshRecords: () => Promise<void>
  refreshDsRecords: () => Promise<void>
  refreshPenhorasRecords: () => Promise<void>
  setFeedback: (message: string) => void
  setActiveTab: Dispatch<SetStateAction<TabId>>
  setSelectedRecordId: Dispatch<SetStateAction<string | null>>
}

export function useEntryForm({
  entryForm,
  setEntryForm,
  dsEntryForm,
  setDsEntryForm,
  penhorasEntryForm,
  setPenhorasEntryForm,
  calculationSettings,
  defaultStatus,
  dsDefaultStatus,
  penhorasDefaultStatus,
  setSelectedRecordEdit,
  setSelectedDsRecordEdit,
  setSelectedPenhorasRecordEdit,
  refreshRecords,
  refreshDsRecords,
  refreshPenhorasRecords,
  setFeedback,
  setActiveTab,
  setSelectedRecordId,
}: UseEntryFormParams) {
  function handleEntryInput<K extends keyof EntryForm>(key: K, value: EntryForm[K]) {
    setEntryForm((current) => {
      const next = { ...current, [key]: value }
      if (['valorIndicado', 'valorSemIva', 'valorEmissao'].includes(String(key))) {
        return applyFormAutoCalculations(next, calculationSettings, key === 'valorIndicado')
      }
      return next
    })
  }

  function handleRecordEditInput<K extends keyof EntryForm>(key: K, value: EntryForm[K]) {
    setSelectedRecordEdit((current) => {
      if (!current) return current
      const next = { ...current, [key]: value }
      if (['valorIndicado', 'valorSemIva', 'valorEmissao'].includes(String(key))) {
        return applyFormAutoCalculations(next, calculationSettings, key === 'valorIndicado')
      }
      return next
    })
  }

  function handleDsEntryInput<K extends keyof DsEntryForm>(key: K, value: DsEntryForm[K]) {
    setDsEntryForm((current) => ({ ...current, [key]: value }))
  }

  function handleDsRecordEditInput<K extends keyof DsEntryForm>(key: K, value: DsEntryForm[K]) {
    setSelectedDsRecordEdit((current) => {
      if (!current) return current
      return { ...current, [key]: value }
    })
  }

  function handlePenhorasEntryInput<K extends keyof PenhorasEntryForm>(key: K, value: PenhorasEntryForm[K]) {
    setPenhorasEntryForm((current) => ({ ...current, [key]: value }))
  }

  function handlePenhorasRecordEditInput<K extends keyof PenhorasEntryForm>(key: K, value: PenhorasEntryForm[K]) {
    setSelectedPenhorasRecordEdit((current) => {
      if (!current) return current
      return { ...current, [key]: value }
    })
  }

  async function submitEntry(event: FormEvent<HTMLFormElement>, saveMode: 'save' | 'saveNew') {
    event.preventDefault()

    if (!entryForm.pe.trim() && !entryForm.processo.trim() && !entryForm.reciboNumero.trim()) {
      setFeedback('Preencha pelo menos Processo, PE ou N.º de recibo.')
      return
    }

    try {
      const created = await api.createRecord(formToPayload(entryForm))
      setFeedback('Registo guardado com sucesso.')
      if (saveMode === 'saveNew' && defaultStatus) {
        setEntryForm(getInitialEntryForm(defaultStatus.id))
      }
      await refreshRecords()
      setSelectedRecordId(created.id)
      setActiveTab('consulta')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar registo.')
    }
  }

  async function saveNewEntry() {
    const fakeEvent = { preventDefault: () => undefined } as FormEvent<HTMLFormElement>
    await submitEntry(fakeEvent, 'saveNew')
  }

  async function submitDsEntry(event: FormEvent<HTMLFormElement>, saveMode: 'save' | 'saveNew') {
    event.preventDefault()

    const payload = dsFormToPayload(dsEntryForm)
    const hasMinimumData = Boolean(
      payload.gestora ||
      payload.proponentes ||
      payload.referencia ||
      payload.produto ||
      payload.entidadeBancaria ||
      payload.recibo ||
      payload.valorRaw ||
      payload.comissaoLojaRaw ||
      payload.totalComissaoLojaCmIvaRaw,
    )

    if (!hasMinimumData) {
      setFeedback('Preencha pelo menos Gestora, Proponentes, Referência, Produto, Entidade, Recibo ou valores.')
      return
    }

    try {
      await api.createDsRecord(payload)
      setFeedback('Registo DS guardado com sucesso.')
      if (saveMode === 'saveNew' && dsDefaultStatus) {
        setDsEntryForm(getInitialDsEntryForm(dsDefaultStatus.id))
      } else {
        setActiveTab('consulta')
      }
      await refreshDsRecords()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar registo DS.')
    }
  }

  async function saveNewDsEntry() {
    const fakeEvent = { preventDefault: () => undefined } as FormEvent<HTMLFormElement>
    await submitDsEntry(fakeEvent, 'saveNew')
  }

  async function submitPenhorasEntry(event: FormEvent<HTMLFormElement>, saveMode: 'save' | 'saveNew') {
    event.preventDefault()

    const payload = penhorasFormToPayload(penhorasEntryForm)
    const hasMinimumData = Boolean(payload.pe || payload.acto || payload.identificacao || payload.pedido || payload.gestor || payload.dataPedido)

    if (!hasMinimumData) {
      setFeedback('Preencha pelo menos PE, Acto, Identificação, Pedido, Gestor ou Data pedido.')
      return
    }

    try {
      await api.createPenhorasRecord(payload)
      setFeedback('Registo Penhoras guardado com sucesso.')
      if (saveMode === 'saveNew' && penhorasDefaultStatus) {
        setPenhorasEntryForm(getInitialPenhorasEntryForm(penhorasDefaultStatus.id))
      } else {
        setActiveTab('consulta')
      }
      await refreshPenhorasRecords()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar registo Penhoras.')
    }
  }

  async function saveNewPenhorasEntry() {
    const fakeEvent = { preventDefault: () => undefined } as FormEvent<HTMLFormElement>
    await submitPenhorasEntry(fakeEvent, 'saveNew')
  }

  return {
    handleEntryInput,
    handleRecordEditInput,
    handleDsEntryInput,
    handleDsRecordEditInput,
    handlePenhorasEntryInput,
    handlePenhorasRecordEditInput,
    submitEntry,
    saveNewEntry,
    submitDsEntry,
    saveNewDsEntry,
    submitPenhorasEntry,
    saveNewPenhorasEntry,
  }
}
