import { useState, useCallback } from 'react'
import { api } from '../api'
import type { PenhorasRecord, PenhorasRecordFilters } from '../types'
import { DEFAULT_PENHORAS_FILTERS } from '../constants'

export function usePenhorasRecords(
    globalSearch: string,
    setFeedback: (msg: string) => void
) {
    const [penhorasRecords, setPenhorasRecords] = useState<PenhorasRecord[]>([])
    const [penhorasTotalRecords, setPenhorasTotalRecords] = useState(0)
    const [penhorasRecordsLoading, setPenhorasRecordsLoading] = useState(false)
    const [penhorasFilters, setPenhorasFilters] = useState<PenhorasRecordFilters>(DEFAULT_PENHORAS_FILTERS)

    const refreshPenhorasRecords = useCallback(async () => {
        setPenhorasRecordsLoading(true)
        try {
            const response = await api.getPenhorasRecords({ ...penhorasFilters, q: globalSearch })
            setPenhorasRecords(response.items)
            setPenhorasTotalRecords(response.total)
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'Falha ao carregar registos Penhoras.')
        } finally {
            setPenhorasRecordsLoading(false)
        }
    }, [penhorasFilters, globalSearch, setFeedback])

    return {
        penhorasRecords,
        setPenhorasRecords,
        penhorasTotalRecords,
        penhorasRecordsLoading,
        penhorasFilters,
        setPenhorasFilters,
        refreshPenhorasRecords,
    }
}
