import { useState } from 'react'
import type { ChangeEvent } from 'react'

import { api } from '../api'
import { parseDsWorkbook, parseImportedWorkbook, parsePenhorasWorkbook } from '../lib/importParser'
import { normalizeText } from '../lib/formatters'
import type {
  DsParsedImport,
  ImportPreviewResponse,
  ParsedImport,
  PenhorasParsedImport,
  StatusDefinition,
  TabId,
} from '../types'

interface UseImportParams {
  setFeedback: (message: string) => void
  refreshRecords: () => Promise<void>
  refreshDsRecords: () => Promise<void>
  refreshPenhorasRecords: () => Promise<void>
  setActiveTab: (tab: TabId) => void
  orderedStatuses: StatusDefinition[]
  defaultStatus: StatusDefinition | undefined
}

export function useImport({
  setFeedback,
  refreshRecords,
  refreshDsRecords,
  refreshPenhorasRecords,
  setActiveTab,
  orderedStatuses,
  defaultStatus,
}: UseImportParams) {
  const [importLoading, setImportLoading] = useState(false)
  const [importPreview, setImportPreview] = useState<ParsedImport | null>(null)
  const [importColorMapping, setImportColorMapping] = useState<Record<string, string>>({})
  const [importServerPreview, setImportServerPreview] = useState<ImportPreviewResponse | null>(null)
  const [importStrategy, setImportStrategy] = useState<'skip' | 'update' | 'duplicate'>('update')
  const [importForceRecalculate, setImportForceRecalculate] = useState(false)

  const [dsImportLoading, setDsImportLoading] = useState(false)
  const [dsImportPreview, setDsImportPreview] = useState<DsParsedImport | null>(null)
  const [dsImportServerPreview, setDsImportServerPreview] = useState<ImportPreviewResponse | null>(null)
  const [dsImportStrategy, setDsImportStrategy] = useState<'skip' | 'update' | 'duplicate'>('update')

  const [penhorasImportLoading, setPenhorasImportLoading] = useState(false)
  const [penhorasImportPreview, setPenhorasImportPreview] = useState<PenhorasParsedImport | null>(null)
  const [penhorasImportServerPreview, setPenhorasImportServerPreview] = useState<ImportPreviewResponse | null>(null)
  const [penhorasImportStrategy, setPenhorasImportStrategy] = useState<'skip' | 'update' | 'duplicate'>('update')

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setImportLoading(true)
    setFeedback('')

    try {
      const parsed = await parseImportedWorkbook(file.name, await file.arrayBuffer())
      setImportPreview(parsed)

      const mapping: Record<string, string> = {}
      for (const color of Object.keys(parsed.colorCount)) {
        const statusByColor = orderedStatuses.find((status) => normalizeText(status.color) === normalizeText(color))
        mapping[color] = statusByColor?.id ?? defaultStatus?.id ?? ''
      }
      setImportColorMapping(mapping)

      const preview = await api.previewImport({ rows: parsed.rows, colorMapping: mapping })
      setImportServerPreview(preview)
      setFeedback(`Pré-visualização pronta: ${preview.summary.valid} válidas, ${preview.summary.conflicts} conflitos.`)
    } catch (error) {
      setImportPreview(null)
      setImportServerPreview(null)
      setFeedback(error instanceof Error ? error.message : 'Falha ao processar importação.')
    } finally {
      setImportLoading(false)
      event.target.value = ''
    }
  }

  async function refreshImportConflictPreview() {
    if (!importPreview) return
    try {
      const preview = await api.previewImport({ rows: importPreview.rows, colorMapping: importColorMapping })
      setImportServerPreview(preview)
      setFeedback(`Pré-visualização atualizada: ${preview.summary.valid} válidas, ${preview.summary.conflicts} conflitos.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha a rever conflitos.')
    }
  }

  async function runImportCommit() {
    if (!importPreview) return

    try {
      const result = await api.commitImport({
        rows: importPreview.rows,
        colorMapping: importColorMapping,
        strategy: importStrategy,
        forceRecalculate: importForceRecalculate,
      })
      setFeedback(`Importação concluída (${importStrategy}): ${JSON.stringify(result.summary)}`)
      setImportPreview(null)
      setImportServerPreview(null)
      await refreshRecords()
      setActiveTab('tabela')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao concluir importação.')
    }
  }

  async function handleDsImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setDsImportLoading(true)
    setFeedback('')

    try {
      const parsed = await parseDsWorkbook(file.name, await file.arrayBuffer())
      setDsImportPreview(parsed)
      const preview = await api.previewDsImport({ rows: parsed.rows })
      setDsImportServerPreview(preview)
      setFeedback(`Pré-visualização DS pronta: ${preview.summary.valid} válidas, ${preview.summary.conflicts} conflitos.`)
    } catch (error) {
      setDsImportPreview(null)
      setDsImportServerPreview(null)
      setFeedback(error instanceof Error ? error.message : 'Falha ao processar importação DS.')
    } finally {
      setDsImportLoading(false)
      event.target.value = ''
    }
  }

  async function refreshDsImportPreview() {
    if (!dsImportPreview) return
    try {
      const preview = await api.previewDsImport({ rows: dsImportPreview.rows })
      setDsImportServerPreview(preview)
      setFeedback(`Pré-visualização DS atualizada: ${preview.summary.valid} válidas, ${preview.summary.conflicts} conflitos.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha a rever conflitos DS.')
    }
  }

  async function runDsImportCommit() {
    if (!dsImportPreview) return
    try {
      const result = await api.commitDsImport({
        rows: dsImportPreview.rows,
        strategy: dsImportStrategy,
      })
      setFeedback(`Importação DS concluída (${dsImportStrategy}): ${JSON.stringify(result.summary)}`)
      setDsImportPreview(null)
      setDsImportServerPreview(null)
      await refreshDsRecords()
      setActiveTab('tabela')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao concluir importação DS.')
    }
  }

  async function handlePenhorasImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setPenhorasImportLoading(true)
    setFeedback('')

    try {
      const parsed = await parsePenhorasWorkbook(file.name, await file.arrayBuffer())
      setPenhorasImportPreview(parsed)
      const preview = await api.previewPenhorasImport({ rows: parsed.rows })
      setPenhorasImportServerPreview(preview)
      setFeedback(`Pré-visualização Penhoras pronta: ${preview.summary.valid} válidas, ${preview.summary.conflicts} conflitos.`)
    } catch (error) {
      setPenhorasImportPreview(null)
      setPenhorasImportServerPreview(null)
      setFeedback(error instanceof Error ? error.message : 'Falha ao processar importação Penhoras.')
    } finally {
      setPenhorasImportLoading(false)
      event.target.value = ''
    }
  }

  async function refreshPenhorasImportPreview() {
    if (!penhorasImportPreview) return
    try {
      const preview = await api.previewPenhorasImport({ rows: penhorasImportPreview.rows })
      setPenhorasImportServerPreview(preview)
      setFeedback(`Pré-visualização Penhoras atualizada: ${preview.summary.valid} válidas, ${preview.summary.conflicts} conflitos.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha a rever conflitos Penhoras.')
    }
  }

  async function runPenhorasImportCommit() {
    if (!penhorasImportPreview) return
    try {
      const result = await api.commitPenhorasImport({
        rows: penhorasImportPreview.rows,
        strategy: penhorasImportStrategy,
      })
      setFeedback(`Importação Penhoras concluída (${penhorasImportStrategy}): ${JSON.stringify(result.summary)}`)
      setPenhorasImportPreview(null)
      setPenhorasImportServerPreview(null)
      await refreshPenhorasRecords()
      setActiveTab('tabela')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao concluir importação Penhoras.')
    }
  }

  async function loadSeed(replace = false) {
    try {
      const response = await api.seedDatabase(replace)
      setFeedback(`Seed aplicada. Criados: ${response.created}, atualizados: ${response.updated}.`)
      await refreshRecords()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao carregar seed.')
    }
  }

  return {
    importLoading,
    importPreview,
    importColorMapping,
    setImportColorMapping,
    importServerPreview,
    importStrategy,
    setImportStrategy,
    importForceRecalculate,
    setImportForceRecalculate,
    handleImportFile,
    refreshImportConflictPreview,
    runImportCommit,

    dsImportLoading,
    dsImportPreview,
    dsImportServerPreview,
    dsImportStrategy,
    setDsImportStrategy,
    handleDsImportFile,
    refreshDsImportPreview,
    runDsImportCommit,

    penhorasImportLoading,
    penhorasImportPreview,
    penhorasImportServerPreview,
    penhorasImportStrategy,
    setPenhorasImportStrategy,
    handlePenhorasImportFile,
    refreshPenhorasImportPreview,
    runPenhorasImportCommit,

    loadSeed,
  }
}
