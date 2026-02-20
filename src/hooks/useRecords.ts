import { useState, useCallback } from 'react'
import { api } from '../api'
import type { ReceiptRecord, RecordFilters, RecordSuggestions } from '../types'
import { DEFAULT_TABLE_FILTERS, EMPTY_RECORD_SUGGESTIONS } from '../constants'

export function useRecords(globalSearch: string) {
    const [records, setRecords] = useState<ReceiptRecord[]>([])
    const [totalRecords, setTotalRecords] = useState(0)
    const [recordsLoading, setRecordsLoading] = useState(false)
    const [pageError, setPageError] = useState('')
    const [filters, setFilters] = useState<RecordFilters>(DEFAULT_TABLE_FILTERS)
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [recordSuggestions, setRecordSuggestions] = useState<RecordSuggestions>(EMPTY_RECORD_SUGGESTIONS)

    const refreshRecords = useCallback(async () => {
        setRecordsLoading(true)
        setPageError('')
        try {
            const [recordsResult, suggestionsResult] = await Promise.allSettled([
                api.getRecords({ ...filters, q: globalSearch }),
                api.getRecordSuggestions(),
            ])

            if (recordsResult.status === 'rejected') {
                throw recordsResult.reason
            }

            const response = recordsResult.value
            setRecords(response.items)
            setTotalRecords(response.total)
            setSelectedIds((current) => current.filter((id) => response.items.some((record) => record.id === id)))

            if (suggestionsResult.status === 'fulfilled') {
                setRecordSuggestions(suggestionsResult.value)
            }
        } catch (error) {
            setPageError(error instanceof Error ? error.message : 'Falha ao carregar registos.')
        } finally {
            setRecordsLoading(false)
        }
    }, [filters, globalSearch])

    return {
        records,
        setRecords,
        totalRecords,
        recordsLoading,
        pageError,
        filters,
        setFilters,
        selectedIds,
        setSelectedIds,
        recordSuggestions,
        refreshRecords,
    }
}
