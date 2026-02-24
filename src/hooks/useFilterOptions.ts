import { useMemo } from 'react'
import type { DsRecord, PenhorasRecord, ReceiptRecord } from '../types'

interface UseFilterOptionsParams {
  records: ReceiptRecord[]
  dsRecords: DsRecord[]
  penhorasRecords: PenhorasRecord[]
  recordSuggestions: { gestor: string[]; exequente: string[] }
}

export function useFilterOptions({ records, dsRecords, penhorasRecords, recordSuggestions }: UseFilterOptionsParams) {
  const years = useMemo(() => {
    const values = new Set(records.map((record) => record.ano))
    return [...values].sort((a, b) => b - a)
  }, [records])

  const exequenteFilterOptions = useMemo(
    () => [...new Set(records.map((record) => record.exequente).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) => a.localeCompare(b)),
    [records],
  )

  const gestorFilterOptions = useMemo(
    () => [...new Set(records.map((record) => record.gestor).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) => a.localeCompare(b)),
    [records],
  )

  const dsYears = useMemo(() => {
    const values = new Set(
      dsRecords
        .map((record) => (record.dataEscritura ? new Date(record.dataEscritura).getUTCFullYear() : undefined))
        .filter((value): value is number => Number.isFinite(value)),
    )
    return [...values].sort((a, b) => b - a)
  }, [dsRecords])

  const dsGestoraFilterOptions = useMemo(
    () =>
      [...new Set(dsRecords.map((record) => record.gestora).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [dsRecords],
  )

  const dsEntidadeFilterOptions = useMemo(
    () =>
      [...new Set(dsRecords.map((record) => record.entidadeBancaria).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [dsRecords],
  )

  const dsProdutoFilterOptions = useMemo(
    () =>
      [...new Set(dsRecords.map((record) => record.produto).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [dsRecords],
  )

  const dsProponentesSuggestions = useMemo(
    () =>
      [...new Set(dsRecords.map((record) => record.proponentes).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [dsRecords],
  )

  const dsReferenciaSuggestions = useMemo(
    () =>
      [...new Set(dsRecords.map((record) => record.referencia).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [dsRecords],
  )

  const dsReciboSuggestions = useMemo(
    () => [...new Set(dsRecords.map((record) => record.recibo).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) => a.localeCompare(b)),
    [dsRecords],
  )

  const penhorasYears = useMemo(() => {
    const values = new Set(
      penhorasRecords
        .map((record) => (record.dataPedido ? new Date(record.dataPedido).getUTCFullYear() : undefined))
        .filter((value): value is number => Number.isFinite(value)),
    )
    return [...values].sort((a, b) => b - a)
  }, [penhorasRecords])

  const penhorasGestorFilterOptions = useMemo(
    () =>
      [...new Set(penhorasRecords.map((record) => record.gestor).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [penhorasRecords],
  )

  const penhorasActoFilterOptions = useMemo(
    () =>
      [...new Set(penhorasRecords.map((record) => record.acto).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [penhorasRecords],
  )

  const penhorasPeSuggestions = useMemo(
    () => [...new Set(penhorasRecords.map((record) => record.pe).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) => a.localeCompare(b)),
    [penhorasRecords],
  )

  const gestorSuggestions = useMemo(
    () => (recordSuggestions.gestor.length > 0 ? recordSuggestions.gestor : gestorFilterOptions),
    [recordSuggestions.gestor, gestorFilterOptions],
  )

  const exequenteSuggestions = useMemo(
    () => (recordSuggestions.exequente.length > 0 ? recordSuggestions.exequente : exequenteFilterOptions),
    [recordSuggestions.exequente, exequenteFilterOptions],
  )

  return {
    years,
    exequenteFilterOptions,
    gestorFilterOptions,
    dsYears,
    dsGestoraFilterOptions,
    dsEntidadeFilterOptions,
    dsProdutoFilterOptions,
    dsProponentesSuggestions,
    dsReferenciaSuggestions,
    dsReciboSuggestions,
    penhorasYears,
    penhorasGestorFilterOptions,
    penhorasActoFilterOptions,
    penhorasPeSuggestions,
    gestorSuggestions,
    exequenteSuggestions,
  }
}
