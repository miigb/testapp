import { useState, useCallback } from 'react'
import { api } from '../api'
import type { PenhorasRecord, PenhorasRecordFilters, StatusDefinition } from '../types'
import { DEFAULT_PENHORAS_FILTERS } from '../constants'

export function usePenhorasRecords(
    globalSearch: string,
    penhorasStatuses: StatusDefinition[],
    setPenhorasStatuses: (statuses: StatusDefinition[]) => void,
    setFeedback: (msg: string) => void
) {
    const [penhorasRecords, setPenhorasRecords] = useState<PenhorasRecord[]>([])
    const [penhorasTotalRecords, setPenhorasTotalRecords] = useState(0)
    const [penhorasRecordsLoading, setPenhorasRecordsLoading] = useState(false)
    const [penhorasFilters, setPenhorasFilters] = useState<PenhorasRecordFilters>(DEFAULT_PENHORAS_FILTERS)

    const refreshPenhorasRecords = useCallback(async () => {
        setPenhorasRecordsLoading(true)
        try {
            const [response, fallbackStatuses] = await Promise.all([
                api.getPenhorasRecords({ ...penhorasFilters, q: globalSearch }),
                penhorasStatuses.length === 0 ? api.getPenhorasStatuses().catch(() => []) : Promise.resolve([] as StatusDefinition[]),
            ])
            setPenhorasRecords(response.items)
            setPenhorasTotalRecords(response.total)
            if (fallbackStatuses.length > 0) {
                setPenhorasStatuses(fallbackStatuses)
            }
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'Falha ao carregar registos Penhoras.')
        } finally {
            setPenhorasRecordsLoading(false)
        }
    }, [penhorasFilters, globalSearch, penhorasStatuses.length, setPenhorasStatuses, setFeedback])

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
