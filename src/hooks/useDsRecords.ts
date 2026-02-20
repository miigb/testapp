import { useState, useCallback } from 'react'
import { api } from '../api'
import type { DsRecord, DsRecordFilters } from '../types'
import { DEFAULT_DS_FILTERS } from '../constants'

export function useDsRecords(globalSearch: string, setFeedback: (msg: string) => void) {
    const [dsRecords, setDsRecords] = useState<DsRecord[]>([])
    const [dsTotalRecords, setDsTotalRecords] = useState(0)
    const [dsRecordsLoading, setDsRecordsLoading] = useState(false)
    const [dsFilters, setDsFilters] = useState<DsRecordFilters>(DEFAULT_DS_FILTERS)

    const refreshDsRecords = useCallback(async () => {
        setDsRecordsLoading(true)
        try {
            const response = await api.getDsRecords({ ...dsFilters, q: globalSearch })
            setDsRecords(response.items)
            setDsTotalRecords(response.total)
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'Falha ao carregar registos DS.')
        } finally {
            setDsRecordsLoading(false)
        }
    }, [dsFilters, globalSearch, setFeedback])

    return {
        dsRecords,
        setDsRecords,
        dsTotalRecords,
        dsRecordsLoading,
        dsFilters,
        setDsFilters,
        refreshDsRecords,
    }
}
