import { useState, useEffect } from 'react'
import { api } from '../api'
import type { StatusDefinition, SavedView, CalculationSettings, EntryForm, DsEntryForm, PenhorasEntryForm } from '../types'
import { getInitialEntryForm } from '../lib/recordHelpers'
import { getInitialDsEntryForm } from '../lib/dsHelpers'
import { getInitialPenhorasEntryForm } from '../lib/penhorasHelpers'

export interface BootstrapControls {
    userId: number | undefined
    setSavedViews: React.Dispatch<React.SetStateAction<SavedView[]>>
    setEntryForm: React.Dispatch<React.SetStateAction<EntryForm>>
    setBulkStatusId: React.Dispatch<React.SetStateAction<string>>
    setDsEntryForm: React.Dispatch<React.SetStateAction<DsEntryForm>>
    setPenhorasEntryForm: React.Dispatch<React.SetStateAction<PenhorasEntryForm>>
    setFeedback: (msg: string) => void
    setSettingsDraft: React.Dispatch<React.SetStateAction<CalculationSettings>>
}

export function useBootstrap({
    userId,
    setSavedViews,
    setEntryForm,
    setBulkStatusId,
    setDsEntryForm,
    setPenhorasEntryForm,
    setFeedback,
    setSettingsDraft,
}: BootstrapControls) {
    const [bootstrapLoading, setBootstrapLoading] = useState(true)
    const [pageError, setPageError] = useState('')

    const [statuses, setStatuses] = useState<StatusDefinition[]>([])
    const [calculationSettings, setCalculationSettings] = useState<CalculationSettings>({
        id: 'default',
        autoApplyRules: true,
        autoComputeValorSemIva: true,
        autoComputeValorEmissao: false,
        roundTo: 2,
        taxRules: [],
    })
    const [dsStatuses, setDsStatuses] = useState<StatusDefinition[]>([])
    const [penhorasStatuses, setPenhorasStatuses] = useState<StatusDefinition[]>([])

    async function migrateLegacyLocalStorageIfPresent() {
        const rawRecords = localStorage.getItem('mesa-recibos-records')
        const rawStatuses = localStorage.getItem('mesa-recibos-statuses')

        if (!rawRecords && !rawStatuses) {
            return
        }

        try {
            const recordsPayload = rawRecords ? (JSON.parse(rawRecords) as unknown[]) : undefined
            const statusesPayload = rawStatuses ? (JSON.parse(rawStatuses) as unknown[]) : undefined
            const response = await api.migrateLocalStorage({ records: recordsPayload, statuses: statusesPayload })
            setFeedback(`Migração concluída: ${response.migrated} registos transferidos do armazenamento local.`)
            localStorage.removeItem('mesa-recibos-records')
            localStorage.removeItem('mesa-recibos-statuses')
            localStorage.removeItem('mesa-recibos-seed-v1')
        } catch {
            setFeedback('Não foi possível migrar automaticamente dados antigos do browser.')
        }
    }

    useEffect(() => {
        if (!userId) {
            setBootstrapLoading(false)
            return
        }
        void (async () => {
            setBootstrapLoading(true)
            setPageError('')
            try {
                const [bootstrap, dsBootstrap, penhorasBootstrap] = await Promise.all([
                    api.bootstrap(),
                    api.dsBootstrap().catch(() => null),
                    api.penhorasBootstrap().catch(() => null),
                ])
                setStatuses(bootstrap.statuses)
                const combinedSavedViews = [
                    ...bootstrap.savedViews,
                    ...(dsBootstrap?.savedViews ?? []),
                    ...(penhorasBootstrap?.savedViews ?? []),
                ]
                    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                    .filter((view, index, list) => list.findIndex((candidate) => candidate.id === view.id) === index)
                setSavedViews(combinedSavedViews)
                setCalculationSettings(bootstrap.calculationSettings)
                setSettingsDraft(bootstrap.calculationSettings)

                if (dsBootstrap) {
                    setDsStatuses(dsBootstrap.statuses)
                }
                if (penhorasBootstrap) {
                    setPenhorasStatuses(penhorasBootstrap.statuses)
                }

                const fallbackStatus = bootstrap.statuses.find((status) => status.active) ?? bootstrap.statuses[0]
                if (fallbackStatus) {
                    setEntryForm(getInitialEntryForm(fallbackStatus.id))
                    setBulkStatusId(fallbackStatus.id)
                }

                const dsFallbackStatus = dsBootstrap?.statuses.find((status) => status.active) ?? dsBootstrap?.statuses[0]
                if (dsFallbackStatus) {
                    setDsEntryForm(getInitialDsEntryForm(dsFallbackStatus.id))
                }

                const penhorasFallbackStatus =
                    penhorasBootstrap?.statuses.find((status) => status.active) ?? penhorasBootstrap?.statuses[0]
                if (penhorasFallbackStatus) {
                    setPenhorasEntryForm(getInitialPenhorasEntryForm(penhorasFallbackStatus.id))
                }

                await migrateLegacyLocalStorageIfPresent()

                if (bootstrap.recordCount === 0) {
                    const seed = await api.seedDatabase(false)
                    setFeedback(`Dados base carregados: ${seed.created} novos registos.`)
                }
            } catch (error) {
                setPageError(error instanceof Error ? error.message : 'Falha ao carregar aplicação.')
            } finally {
                setBootstrapLoading(false)
            }
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])

    return {
        bootstrapLoading,
        pageError,
        setPageError,
        statuses,
        setStatuses,
        calculationSettings,
        setCalculationSettings,
        dsStatuses,
        setDsStatuses,
        penhorasStatuses,
        setPenhorasStatuses,
    }
}
