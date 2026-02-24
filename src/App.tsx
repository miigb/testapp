import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'

import {
  Calculator,
  Minimize2,
  Pin,
  PinOff,
  Plus,
  Minus,
  Pencil,
  Save,
  SquareFunction,
  StickyNote,
  Trash2,
  Undo2,
  Wrench,
  X,
} from 'lucide-react'

import { api } from './api'
import { applyFormAutoCalculations } from './lib/calculations'
import type {
  AnalyticsSummary,
  CalculationSettings,
  DsEntryForm,
  DsRecord,
  DsRecordFilters,
  EntryForm,
  ModuleId,
  PenhorasEntryForm,
  PenhorasRecord,
  PenhorasRecordFilters,
  ReceiptRecord,
  RecordFilters,
  RecordType,
  StatusDefinition,
  TabId,
  TaxRule,
} from './types'

import { isDarkLikeTheme, useTheme } from './hooks/useTheme'
import { useUndoStack } from './hooks/useUndoStack'
import { useQuickTools } from './hooks/useQuickTools'
import { useRecords } from './hooks/useRecords'
import { useDsRecords } from './hooks/useDsRecords'
import { usePenhorasRecords } from './hooks/usePenhorasRecords'
import { useSmartNotes } from './hooks/useSmartNotes'
import { useSavedViews } from './hooks/useSavedViews'
import { useDashboard } from './hooks/useDashboard'
import { useBootstrap } from './hooks/useBootstrap'
import { useImport } from './hooks/useImport'
import { useSettings } from './hooks/useSettings'
import { useEntryForm } from './hooks/useEntryForm'
import { useRecordActions } from './hooks/useRecordActions'
import { useNotesExport } from './hooks/useNotesExport'
import { useDashboardHandlers } from './hooks/useDashboardHandlers'
import { useCalculator } from './hooks/useCalculator'
import { useDashboardAnalytics } from './hooks/useDashboardAnalytics'
import { useFilterOptions } from './hooks/useFilterOptions'
import { useSelectedRecord } from './hooks/useSelectedRecord'
import { DsConfiguracao } from './components/ds/DsConfiguracao'
import { PenhorasConfiguracao } from './components/penhoras/PenhorasConfiguracao'
import { RecibosConfiguracao } from './components/recibos/RecibosConfiguracao'
import { DsImportar } from './components/ds/DsImportar'
import { PenhorasImportar } from './components/penhoras/PenhorasImportar'
import { RecibosImportar } from './components/recibos/RecibosImportar'
import { DsDashboards } from './components/ds/DsDashboards'
import { PenhorasDashboards } from './components/penhoras/PenhorasDashboards'
import { RecibosDashboards } from './components/recibos/RecibosDashboards'
import { DsEntrada } from './components/ds/DsEntrada'
import { PenhorasEntrada } from './components/penhoras/PenhorasEntrada'
import { RecibosEntrada } from './components/recibos/RecibosEntrada'
import { DsConsultaTabela } from './components/ds/DsConsultaTabela'
import { PenhorasConsultaTabela } from './components/penhoras/PenhorasConsultaTabela'
import { RecibosConsultaTabela } from './components/recibos/RecibosConsultaTabela'
import { DsRecordDrawer } from './components/ds/DsRecordDrawer'
import { PenhorasRecordDrawer } from './components/penhoras/PenhorasRecordDrawer'
import { RecibosRecordDrawer } from './components/recibos/RecibosRecordDrawer'
import { LabeledInput, AutocompleteInput, LabeledSelect, Info } from './components/shared/FormInputs'
import { QuickNotesWindow } from './components/shared/QuickNotesWindow'
import { SmartNotesWindow } from './components/shared/SmartNotesWindow'
import { CalculatorWindow } from './components/shared/CalculatorWindow'
import { RecibosDashboardWidgetCard } from './components/recibos/RecibosDashboardWidgetCard'
import { DsDashboardWidgetCard } from './components/ds/DsDashboardWidgetCard'
import { PenhorasDashboardWidgetCard } from './components/penhoras/PenhorasDashboardWidgetCard'
import { TABS, DEFAULT_DASHBOARD_FILTERS, MONTHS, CALCULATOR_KEYS } from './constants'
import type { LayoutMode, QuickToolId, CalculatorKey, TotalMetricKey } from './constants'
import type {
  DashboardWidget,
  DsDashboardWidget,
  PenhorasDashboardWidget,
} from './lib/dashboardWidgets'
import { formatCurrency, normalizeText, toFormNumber } from './lib/formatters'
import { resolveInitialQuickNotes } from './lib/localStorage'
import {
  getInitialEntryForm,
  recordToForm,
  extractGpeSeFromIndicacoes,
  composeIndicacoes,
} from './lib/recordHelpers'
import { getInitialDsEntryForm, dsRecordToForm } from './lib/dsHelpers'
import { getInitialPenhorasEntryForm, penhorasRecordToForm } from './lib/penhorasHelpers'

function resolveInitialLayoutMode(): LayoutMode {
  return 'wide'
}

function getStatus(statuses: StatusDefinition[], statusId?: string): StatusDefinition | undefined {
  if (!statusId) return undefined
  return statuses.find((status) => status.id === statusId)
}

function App() {
  const { theme, setTheme } = useTheme()
  const { undoStack, pushUndo, handleUndo } = useUndoStack({
    onUndoSuccess: async (label) => {
      await refreshRecords()
      setFeedback(`Anulado: ${label}.`)
    },
    onUndoError: (error) => {
      setFeedback(error.message || 'Falha ao anular a última ação.')
    }
  })

  const [activeModule, setActiveModule] = useState<ModuleId>('recibos')
  const [activeTab, setActiveTab] = useState<TabId>('entrada')
  const [feedback, setFeedback] = useState('')
  const [feedbackClosing, setFeedbackClosing] = useState(false)

  const [globalSearch, setGlobalSearch] = useState('')
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<ReceiptRecord | null>(null)
  const [selectedRecordEdit, setSelectedRecordEdit] = useState<EntryForm | null>(null)
  const [isRecordEditing, setIsRecordEditing] = useState(false)

  const [selectedDsRecordId, setSelectedDsRecordId] = useState<string | null>(null)
  const [selectedDsRecord, setSelectedDsRecord] = useState<DsRecord | null>(null)
  const [selectedDsRecordEdit, setSelectedDsRecordEdit] = useState<DsEntryForm | null>(null)
  const [isDsRecordEditing, setIsDsRecordEditing] = useState(false)

  const [selectedPenhorasRecordId, setSelectedPenhorasRecordId] = useState<string | null>(null)
  const [selectedPenhorasRecord, setSelectedPenhorasRecord] = useState<PenhorasRecord | null>(null)
  const [selectedPenhorasRecordEdit, setSelectedPenhorasRecordEdit] = useState<PenhorasEntryForm | null>(null)
  const [isPenhorasRecordEditing, setIsPenhorasRecordEditing] = useState(false)

  const [layoutMode] = useState<LayoutMode>(resolveInitialLayoutMode)
  const [quickNotes, setQuickNotes] = useState(resolveInitialQuickNotes)
  const [calculatorExpression, setCalculatorExpression] = useState('')
  const [calculatorResult, setCalculatorResult] = useState<string | null>(null)
  const [calculatorError, setCalculatorError] = useState('')
  const [totalsHoverOpen, setTotalsHoverOpen] = useState(false)
  const [selectedTotalMetrics, setSelectedTotalMetrics] = useState<TotalMetricKey[]>([
    'registos',
    'valorSemIva',
    'iva',
    'levantadoComIva',
  ])

  const [entryForm, setEntryForm] = useState<EntryForm>(getInitialEntryForm(''))
  const [bulkStatusId, setBulkStatusId] = useState('')
  const [bulkGestor, setBulkGestor] = useState('')
  const [bulkExequente, setBulkExequente] = useState('')
  const [bulkIndicacoes, setBulkIndicacoes] = useState('')
  const [bulkForceRecalculate, setBulkForceRecalculate] = useState(false)
  const [bulkSectionOpen, setBulkSectionOpen] = useState(false)
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false)

  const [dsEntryForm, setDsEntryForm] = useState<DsEntryForm>(getInitialDsEntryForm(''))
  const [penhorasEntryForm, setPenhorasEntryForm] = useState<PenhorasEntryForm>(getInitialPenhorasEntryForm(''))

  const {
    records,
    totalRecords,
    recordsLoading,
    pageError,
    filters,
    setFilters,
    selectedIds,
    setSelectedIds,
    recordSuggestions,
    refreshRecords,
  } = useRecords(globalSearch)

  const {
    dsRecords,
    dsTotalRecords,
    dsRecordsLoading,
    dsFilters,
    setDsFilters,
    refreshDsRecords,
  } = useDsRecords(globalSearch, setFeedback)

  const {
    penhorasRecords,
    penhorasTotalRecords,
    penhorasRecordsLoading,
    penhorasFilters,
    setPenhorasFilters,
    refreshPenhorasRecords,
  } = usePenhorasRecords(globalSearch, setFeedback)

  const {
    smartNotesText,
    setSmartNotesText,
    setSmartNotesPinnedSignatures,
    smartNotesSavedEntries,
    setSmartNotesSavedEntries,
    smartNotesResults,
    smartNotesErrors,
    smartNotesPinnedSet,
    smartNotesSavedSet,
    smartNotesDisplayResults,
  } = useSmartNotes()

  const {
    dashboardWidgets,
    setDashboardWidgets,
    dsDashboardWidgets,
    setDsDashboardWidgets,
    penhorasDashboardWidgets,
    setPenhorasDashboardWidgets,
    dsDashboardWidgetsOpen,
    setDsDashboardWidgetsOpen,
    penhorasDashboardWidgetsOpen,
    setPenhorasDashboardWidgetsOpen,
    dashboardFocusMode,
    setDashboardFocusMode,
    resizingDashboardWidgetId,
    startDashboardWidgetResize,
    addDashboardWidget,
    removeDashboardWidget,
    moveDashboardWidget,
    reorderDashboardWidgets,
    adjustDashboardWidgetWidth,
    toggleDashboardWidgetColumn,
    adjustDashboardWidgetHeight,
    addDsDashboardWidget,
    removeDsDashboardWidget,
    moveDsDashboardWidget,
    reorderDsDashboardWidgets,
    adjustDsDashboardWidgetWidth,
    toggleDsDashboardWidgetColumn,
    adjustDsDashboardWidgetHeight,
    addPenhorasDashboardWidget,
    removePenhorasDashboardWidget,
    movePenhorasDashboardWidget,
    reorderPenhorasDashboardWidgets,
    adjustPenhorasDashboardWidgetWidth,
    togglePenhorasDashboardWidgetColumn,
    adjustPenhorasDashboardWidgetHeight,
  } = useDashboard(activeTab)

  const [dashboardName, setDashboardName] = useState('Dashboard')
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(null)
  const [dashboardSummary, setDashboardSummary] = useState<AnalyticsSummary | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardConfigOpen, setDashboardConfigOpen] = useState(true)
  const [dashboardPickerOpen, setDashboardPickerOpen] = useState(false)
  const [dashboardFilters, setDashboardFilters] = useState<RecordFilters>(DEFAULT_DASHBOARD_FILTERS)
  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(false)
  const [dsDashboardConfigOpen, setDsDashboardConfigOpen] = useState(true)
  const [dsDashboardPickerOpen, setDsDashboardPickerOpen] = useState(false)
  const [penhorasDashboardConfigOpen, setPenhorasDashboardConfigOpen] = useState(true)
  const [penhorasDashboardPickerOpen, setPenhorasDashboardPickerOpen] = useState(false)
  const [draggedDashboardWidgetId, setDraggedDashboardWidgetId] = useState<string | null>(null)
  const [dropDashboardWidgetId, setDropDashboardWidgetId] = useState<string | null>(null)

  const {
    savedViews,
    setSavedViews,
    disabledSavedViewIds,
    activeSavedViewId,
    setActiveSavedViewId,
    activeDsSavedViewId,
    setActiveDsSavedViewId,
    activePenhorasSavedViewId,
    setActivePenhorasSavedViewId,
    saveCurrentView,
    deleteSavedView,
    toggleSavedViewDisabled,
    clearTableFilters,
    applyView,
    deleteDsSavedView,
    toggleDsSavedViewDisabled,
    clearDsFilters,
    applyDsView,
    deletePenhorasSavedView,
    togglePenhorasSavedViewDisabled,
    clearPenhorasFilters,
    applyPenhorasView,
    loadDashboardView,
  } = useSavedViews({
    setFilters,
    setGlobalSearch,
    setFeedback,
    setDsFilters,
    setDsDashboardWidgets,
    setPenhorasFilters,
    setPenhorasDashboardWidgets,
    setDashboardFilters,
    setDashboardWidgets,
    setActiveDashboardId,
    setDashboardName,
  })

  // We declare evaluateCalculator here first to pass to useQuickTools, but we need it to see setCalculatorResult etc
  const evaluateCalculator = useCallback(() => {
    const normalized = calculatorExpression
      .replace(/,/g, '.')
      .replace(/[×x]/g, '*')
      .replace(/[÷]/g, '/')
      .trim()

    if (!normalized) {
      setCalculatorResult(null)
      setCalculatorError('')
      return
    }

    if (!/^[0-9+\-*/().\s%]+$/.test(normalized)) {
      setCalculatorError('Expressão inválida.')
      setCalculatorResult(null)
      return
    }

    const expressionWithPercent = normalized.replace(/(\d+(\.\d+)?)%/g, '($1/100)')

    try {
      const computed = Function(`"use strict"; return (${expressionWithPercent})`)()
      if (typeof computed !== 'number' || !Number.isFinite(computed)) {
        setCalculatorError('Resultado inválido.')
        setCalculatorResult(null)
        return
      }
      setCalculatorError('')
      setCalculatorResult(
        new Intl.NumberFormat('pt-PT', {
          maximumFractionDigits: 6,
        }).format(computed),
      )
    } catch {
      setCalculatorError('Não foi possível calcular.')
      setCalculatorResult(null)
    }
  }, [calculatorExpression])

  const {
    toolsExpanded,
    setToolsExpanded,
    notesOpen,
    setNotesOpen,
    calculatorOpen,
    setCalculatorOpen,
    smartNotesOpen,
    setSmartNotesOpen,
    toolPinned,
    toolLayers,
    toolPositions,
    draggingTool,
    notesWindowRef,
    calculatorWindowRef,
    smartNotesWindowRef,
    bringToolToFront,
    toggleQuickTool,
    toggleQuickToolPinned,
    startToolWindowDrag,
    notesWindowZIndex,
    calculatorWindowZIndex,
    smartNotesWindowZIndex,
  } = useQuickTools(evaluateCalculator)

  const [settingsDraft, setSettingsDraft] = useState<CalculationSettings>({
    id: 'default',
    autoApplyRules: true,
    autoComputeValorSemIva: true,
    autoComputeValorEmissao: false,
    roundTo: 2,
    taxRules: [],
  })

  // HOOKS - Bootstrap comes last to access all extracted setters
  const {
    bootstrapLoading,
    statuses,
    setStatuses,
    calculationSettings,
    setCalculationSettings,
    dsStatuses,
    setDsStatuses,
    penhorasStatuses,
    setPenhorasStatuses,
  } = useBootstrap({
    setSavedViews,
    setEntryForm,
    setBulkStatusId,
    setDsEntryForm,
    setPenhorasEntryForm,
    setFeedback,
    setSettingsDraft,
  })

  const orderedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
    [statuses],
  )

  const activeStatuses = useMemo(() => orderedStatuses.filter((status) => status.active), [orderedStatuses])

  const defaultStatus = useMemo(() => activeStatuses[0] ?? orderedStatuses[0], [activeStatuses, orderedStatuses])

  const {
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
  } = useImport({
    setFeedback,
    refreshRecords,
    refreshDsRecords,
    refreshPenhorasRecords,
    setActiveTab,
    orderedStatuses,
    defaultStatus,
  })

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

  const dsOrderedStatuses = useMemo(
    () => [...dsStatuses].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
    [dsStatuses],
  )
  const dsActiveStatuses = useMemo(() => dsOrderedStatuses.filter((status) => status.active), [dsOrderedStatuses])
  const dsDefaultStatus = useMemo(() => dsActiveStatuses[0] ?? dsOrderedStatuses[0], [dsActiveStatuses, dsOrderedStatuses])

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

  const penhorasOrderedStatuses = useMemo(
    () => [...penhorasStatuses].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
    [penhorasStatuses],
  )
  const penhorasActiveStatuses = useMemo(() => penhorasOrderedStatuses.filter((status) => status.active), [penhorasOrderedStatuses])
  const penhorasDefaultStatus = useMemo(() => penhorasActiveStatuses[0] ?? penhorasOrderedStatuses[0], [penhorasActiveStatuses, penhorasOrderedStatuses])

  const {
    updateSettingsDraft,
    updateTaxRule,
    saveCalculationSettings,
    saveStatuses,
    saveDsStatuses,
    savePenhorasStatuses,
    addStatus,
    addDsStatus,
    addPenhorasStatus,
    removeStatus,
    removeDsStatus,
    removePenhorasStatus,
    updateStatusLocal,
    updateDsStatusLocal,
    updatePenhorasStatusLocal,
  } = useSettings({
    settingsDraft,
    setSettingsDraft,
    setCalculationSettings,
    statuses,
    setStatuses,
    dsStatuses,
    setDsStatuses,
    penhorasStatuses,
    setPenhorasStatuses,
    orderedStatuses,
    dsOrderedStatuses,
    penhorasOrderedStatuses,
    refreshRecords,
    refreshDsRecords,
    refreshPenhorasRecords,
    setFeedback,
    setEntryForm,
  })

  const {
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
  } = useEntryForm({
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
  })

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

  const tableViews = useMemo(() => savedViews.filter((view) => view.scope === 'tabela'), [savedViews])
  const dashboardViews = useMemo(() => savedViews.filter((view) => view.scope === 'dashboard'), [savedViews])
  const dsTableViews = useMemo(() => savedViews.filter((view) => view.scope === 'ds-tabela'), [savedViews])
  const dsDashboardViews = useMemo(() => savedViews.filter((view) => view.scope === 'ds-dashboard'), [savedViews])
  const penhorasTableViews = useMemo(() => savedViews.filter((view) => view.scope === 'penhoras-tabela'), [savedViews])
  const penhorasDashboardViews = useMemo(() => savedViews.filter((view) => view.scope === 'penhoras-dashboard'), [savedViews])
  const recibosLogoSrc = isDarkLikeTheme(theme) ? '/mesa-de-recibos-logo-dark.svg' : '/mesa-de-recibos-logo.svg'
  const dsLogoSrc = isDarkLikeTheme(theme) ? '/ds-logo-dark.svg' : '/ds-logo.svg'
  const penhorasLogoSrc = isDarkLikeTheme(theme) ? '/penhoras-logo-dark.svg' : '/penhoras-logo.svg'
  const moduleCards = useMemo(
    () => [
      {
        id: 'recibos' as ModuleId,
        title: 'Mesa de Recibos',
        subtitle: 'Postgres + API · Entrada e consulta de recibos',
        logoSrc: recibosLogoSrc,
        showSubtitle: true,
      },
      {
        id: 'ds' as ModuleId,
        title: 'DS Intermediários de Crédito',
        subtitle: 'Módulo operacional dedicado',
        logoSrc: dsLogoSrc,
        showSubtitle: false,
      },
      {
        id: 'penhoras' as ModuleId,
        title: 'Penhoras Imóveis',
        subtitle: 'Registo operacional de penhoras',
        logoSrc: penhorasLogoSrc,
        showSubtitle: false,
      },
    ],
    [recibosLogoSrc, dsLogoSrc, penhorasLogoSrc],
  )
  const activeModuleIndex = moduleCards.findIndex((item) => item.id === activeModule)
  const safeActiveModuleIndex = activeModuleIndex >= 0 ? activeModuleIndex : 0
  const activeModuleCard = moduleCards[safeActiveModuleIndex] ?? moduleCards[0]
  const nextModuleCard = moduleCards[(safeActiveModuleIndex + 1) % moduleCards.length] ?? moduleCards[0]

  const totalsSnapshot = useMemo(() => {
    let valorIndicado = 0
    let valorSemIva = 0
    let iva = 0
    let retencao = 0
    let meu5 = 0
    let valorEmissao = 0
    let outrasTaxas = 0
    let levantadoComIva = 0

    for (const record of records) {
      if (typeof record.valorIndicado === 'number') valorIndicado += record.valorIndicado
      if (typeof record.valorSemIva === 'number') valorSemIva += record.valorSemIva
      if (typeof record.iva === 'number') iva += record.iva
      if (typeof record.retencao === 'number') retencao += record.retencao
      if (typeof record.meu5 === 'number') meu5 += record.meu5
      if (typeof record.valorEmissao === 'number') valorEmissao += record.valorEmissao
      if (typeof record.outrasTaxas === 'number') outrasTaxas += record.outrasTaxas

      const semIva = typeof record.valorSemIva === 'number' ? record.valorSemIva : 0
      const ivaValue = typeof record.iva === 'number' ? record.iva : 0
      if (semIva !== 0 || ivaValue !== 0) {
        levantadoComIva += semIva + ivaValue
      }
    }

    return {
      registos: records.length,
      valorIndicado,
      valorSemIva,
      iva,
      retencao,
      meu5,
      valorEmissao,
      outrasTaxas,
      levantadoComIva,
    }
  }, [records])

  const dsDashboardTotals = useMemo(() => {
    let valor = 0
    let comissaoLoja = 0
    let totalComissaoLojaCmIva = 0
    let comissaoGestor = 0
    let comRecibo = 0

    for (const record of dsRecords) {
      if (typeof record.valor === 'number') valor += record.valor
      if (typeof record.comissaoLoja === 'number') comissaoLoja += record.comissaoLoja
      if (typeof record.totalComissaoLojaCmIva === 'number') totalComissaoLojaCmIva += record.totalComissaoLojaCmIva
      if (typeof record.comissaoGestor === 'number') comissaoGestor += record.comissaoGestor
      if (record.recibo?.trim()) comRecibo += 1
    }

    return {
      registos: dsRecords.length,
      valor,
      comissaoLoja,
      totalComissaoLojaCmIva,
      comissaoGestor,
      comRecibo,
      semRecibo: Math.max(0, dsRecords.length - comRecibo),
    }
  }, [dsRecords])

  const dsDashboardByStatus = useMemo(() => {
    const buckets = new Map<string, { count: number; total: number }>()
    for (const record of dsRecords) {
      const key = record.estadoId || 'sem-estado'
      const current = buckets.get(key) ?? { count: 0, total: 0 }
      current.count += 1
      const value = record.totalComissaoLojaCmIva ?? record.comissaoLoja ?? record.valor ?? 0
      if (typeof value === 'number') current.total += value
      buckets.set(key, current)
    }

    return [...buckets.entries()]
      .map(([statusId, bucket]) => {
        const status = getStatus(dsStatuses, statusId)
        return {
          id: statusId,
          label: status?.label ?? 'Sem estado',
          value: bucket.count,
          secondary: formatCurrency(bucket.total),
        }
      })
      .sort((a, b) => b.value - a.value)
  }, [dsRecords, dsStatuses])

  const dsDashboardTopGestoras = useMemo(() => {
    const buckets = new Map<string, { count: number; total: number }>()
    for (const record of dsRecords) {
      const key = record.gestora?.trim()
      if (!key) continue
      const current = buckets.get(key) ?? { count: 0, total: 0 }
      current.count += 1
      const value = record.totalComissaoLojaCmIva ?? record.comissaoLoja ?? record.valor ?? 0
      if (typeof value === 'number') current.total += value
      buckets.set(key, current)
    }

    return [...buckets.entries()]
      .map(([name, bucket]) => ({
        id: name,
        label: name,
        value: bucket.count,
        secondary: formatCurrency(bucket.total),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [dsRecords])

  const dsDashboardTopEntidades = useMemo(() => {
    const buckets = new Map<string, { count: number; total: number }>()
    for (const record of dsRecords) {
      const key = record.entidadeBancaria?.trim()
      if (!key) continue
      const current = buckets.get(key) ?? { count: 0, total: 0 }
      current.count += 1
      const value = record.totalComissaoLojaCmIva ?? record.comissaoLoja ?? record.valor ?? 0
      if (typeof value === 'number') current.total += value
      buckets.set(key, current)
    }

    return [...buckets.entries()]
      .map(([name, bucket]) => ({
        id: name,
        label: name,
        value: bucket.count,
        secondary: formatCurrency(bucket.total),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [dsRecords])

  const dsDashboardByMonth = useMemo(() => {
    const buckets = new Map<string, { ano: number; mes: number; count: number; total: number }>()
    for (const record of dsRecords) {
      if (!record.dataEscritura) continue
      const date = new Date(record.dataEscritura)
      if (Number.isNaN(date.getTime())) continue
      const ano = date.getUTCFullYear()
      const mes = date.getUTCMonth() + 1
      const key = `${ano}-${mes}`
      const current = buckets.get(key) ?? { ano, mes, count: 0, total: 0 }
      current.count += 1
      const value = record.totalComissaoLojaCmIva ?? record.comissaoLoja ?? record.valor ?? 0
      if (typeof value === 'number') current.total += value
      buckets.set(key, current)
    }

    return [...buckets.values()]
      .sort((a, b) => (a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano))
      .slice(-12)
      .map((item) => ({
        id: `${item.ano}-${item.mes}`,
        label: `${MONTHS[item.mes - 1]?.slice(0, 3) ?? item.mes}/${item.ano}`,
        value: item.total,
        secondary: `${new Intl.NumberFormat('pt-PT').format(item.count)} registos`,
      }))
  }, [dsRecords])

  const penhorasDashboardTotals = useMemo(() => {
    let comDataPedido = 0
    let recusados = 0
    let pendentes = 0

    for (const record of penhorasRecords) {
      if (record.dataPedido) comDataPedido += 1
      const status = getStatus(penhorasStatuses, record.estadoId)
      const normalizedStatus = normalizeText(status?.key || status?.label || '')

      if (normalizedStatus.includes('RECUS') || normalizedStatus.includes('DESIST') || normalizedStatus.includes('CANCELAMENTO')) {
        recusados += 1
      } else if (
        (normalizedStatus.includes('AGUARDA') && normalizedStatus.includes('REGIST')) ||
        normalizedStatus.includes('SEM ESTADO') ||
        normalizedStatus.includes('SEM-ESTADO')
      ) {
        pendentes += 1
      }
    }

    return {
      registos: penhorasRecords.length,
      comDataPedido,
      recusados,
      pendentes,
    }
  }, [penhorasRecords, penhorasStatuses])

  const penhorasDashboardByStatus = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const record of penhorasRecords) {
      const key = record.estadoId || 'sem-estado'
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }

    return [...buckets.entries()]
      .map(([statusId, count]) => {
        const status = getStatus(penhorasStatuses, statusId)
        return {
          id: statusId,
          label: status?.label ?? 'Sem estado',
          value: count,
        }
      })
      .sort((a, b) => b.value - a.value)
  }, [penhorasRecords, penhorasStatuses])

  const penhorasDashboardTopGestores = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const record of penhorasRecords) {
      const key = record.gestor?.trim()
      if (!key) continue
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }

    return [...buckets.entries()]
      .map(([gestor, count]) => ({
        id: gestor,
        label: gestor,
        value: count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [penhorasRecords])

  const penhorasDashboardByMonth = useMemo(() => {
    const buckets = new Map<string, { ano: number; mes: number; count: number }>()
    for (const record of penhorasRecords) {
      if (!record.dataPedido) continue
      const date = new Date(record.dataPedido)
      if (Number.isNaN(date.getTime())) continue
      const ano = date.getUTCFullYear()
      const mes = date.getUTCMonth() + 1
      const key = `${ano}-${mes}`
      const current = buckets.get(key) ?? { ano, mes, count: 0 }
      current.count += 1
      buckets.set(key, current)
    }

    return [...buckets.values()]
      .sort((a, b) => (a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano))
      .slice(-12)
      .map((item) => ({
        id: `${item.ano}-${item.mes}`,
        label: `${MONTHS[item.mes - 1]?.slice(0, 3) ?? item.mes}/${item.ano}`,
        value: item.count,
      }))
  }, [penhorasRecords])

  const recentRecords = useMemo(() => [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 12), [records])
  const dsRecentRecords = useMemo(() => [...dsRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 12), [dsRecords])
  const penhorasRecentRecords = useMemo(() => [...penhorasRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 12), [penhorasRecords])

  const dashboardSavePayload = useMemo(
    () => ({
      widgets: dashboardWidgets,
      filters: {
        tipo: dashboardFilters.tipo ?? 'todos',
        estadoId: dashboardFilters.estadoId ?? 'todos',
        mes: dashboardFilters.mes ?? 'todos',
        ano: dashboardFilters.ano ?? 'todos',
        exequente: dashboardFilters.exequente ?? '',
        gestor: dashboardFilters.gestor ?? '',
      },
    }),
    [dashboardWidgets, dashboardFilters],
  )

  const dashboardSideWidgets = useMemo(() => dashboardWidgets.filter((widget) => widget.column === 'side'), [dashboardWidgets])
  const dashboardMainWidgets = useMemo(() => dashboardWidgets.filter((widget) => widget.column !== 'side'), [dashboardWidgets])
  const dashboardHasSideStack = dashboardSideWidgets.length > 0 && dashboardMainWidgets.length > 0
  const dsDashboardSideWidgets = useMemo(() => dsDashboardWidgets.filter((widget) => widget.column === 'side'), [dsDashboardWidgets])
  const dsDashboardMainWidgets = useMemo(() => dsDashboardWidgets.filter((widget) => widget.column !== 'side'), [dsDashboardWidgets])
  const dsDashboardHasSideStack = dsDashboardSideWidgets.length > 0 && dsDashboardMainWidgets.length > 0
  const penhorasDashboardSideWidgets = useMemo(
    () => penhorasDashboardWidgets.filter((widget) => widget.column === 'side'),
    [penhorasDashboardWidgets],
  )
  const penhorasDashboardMainWidgets = useMemo(
    () => penhorasDashboardWidgets.filter((widget) => widget.column !== 'side'),
    [penhorasDashboardWidgets],
  )
  const penhorasDashboardHasSideStack = penhorasDashboardSideWidgets.length > 0 && penhorasDashboardMainWidgets.length > 0
  const dashboardActiveFilterCount = useMemo(() => {
    let total = 0
    if (dashboardFilters.tipo && dashboardFilters.tipo !== 'todos') total += 1
    if (dashboardFilters.estadoId && dashboardFilters.estadoId !== 'todos') total += 1
    if (dashboardFilters.mes && dashboardFilters.mes !== 'todos') total += 1
    if (dashboardFilters.ano && dashboardFilters.ano !== 'todos') total += 1
    if (dashboardFilters.exequente && dashboardFilters.exequente.trim()) total += 1
    if (dashboardFilters.gestor && dashboardFilters.gestor.trim()) total += 1
    return total
  }, [dashboardFilters])

  const selectedRecordIdsSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const allSelectedInTable = useMemo(
    () => records.length > 0 && records.every((record) => selectedRecordIdsSet.has(record.id)),
    [records, selectedRecordIdsSet],
  )

  const selectedRecordIndicacoes = useMemo(
    () => extractGpeSeFromIndicacoes(selectedRecord?.indicacoes),
    [selectedRecord?.indicacoes],
  )

  const latestUndo = useMemo(() => undoStack[undoStack.length - 1], [undoStack])

  useEffect(() => {
    function handleQuickToolShortcuts(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isEditableTarget =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable === true
      if (isEditableTarget) return
      if (!event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setToolsExpanded(true)
        setNotesOpen(true)
        bringToolToFront('notes')
        return
      }
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault()
        setToolsExpanded(true)
        setCalculatorOpen(true)
        bringToolToFront('calculator')
        return
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        setToolsExpanded(true)
        setSmartNotesOpen(true)
        bringToolToFront('smart-notes')
      }
    }

    window.addEventListener('keydown', handleQuickToolShortcuts)
    return () => {
      window.removeEventListener('keydown', handleQuickToolShortcuts)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!feedback) {
      setFeedbackClosing(false)
      return
    }

    setFeedbackClosing(false)
    const autoCloseTimer = window.setTimeout(() => {
      setFeedbackClosing(true)
    }, 4200)

    return () => {
      window.clearTimeout(autoCloseTimer)
    }
  }, [feedback])

  useEffect(() => {
    if (!feedbackClosing) return

    const clearTimer = window.setTimeout(() => {
      setFeedback('')
      setFeedbackClosing(false)
    }, 280)

    return () => {
      window.clearTimeout(clearTimer)
    }
  }, [feedbackClosing])

  useEffect(() => {
    if (!bootstrapLoading && activeModule === 'recibos') {
      void refreshRecords()
    }
  }, [filters, globalSearch, bootstrapLoading, activeModule, refreshRecords])

  useEffect(() => {
    if (bootstrapLoading || activeModule !== 'ds') return
    void refreshDsRecords()
  }, [bootstrapLoading, activeModule, dsFilters, globalSearch, refreshDsRecords])

  useEffect(() => {
    if (bootstrapLoading || activeModule !== 'penhoras') return
    void refreshPenhorasRecords()
  }, [bootstrapLoading, activeModule, penhorasFilters, globalSearch, refreshPenhorasRecords])

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

  useEffect(() => {
    if (!activeDashboardId) return
    const viewStillExists = dashboardViews.some((view) => view.id === activeDashboardId)
    if (!viewStillExists) {
      setActiveDashboardId(null)
      setDashboardName('Dashboard')
      setDashboardFilters(DEFAULT_DASHBOARD_FILTERS)
      setDashboardWidgets([])
    }
  }, [activeDashboardId, dashboardViews, setDashboardWidgets])

  useEffect(() => {
    if (!activeDsSavedViewId) return
    const viewStillExists = savedViews.some((view) => view.id === activeDsSavedViewId && view.scope.startsWith('ds-'))
    if (!viewStillExists) {
      setActiveDsSavedViewId(null)
    }
  }, [activeDsSavedViewId, savedViews, setActiveDsSavedViewId])

  useEffect(() => {
    if (!activePenhorasSavedViewId) return
    const viewStillExists = savedViews.some((view) => view.id === activePenhorasSavedViewId && view.scope.startsWith('penhoras-'))
    if (!viewStillExists) {
      setActivePenhorasSavedViewId(null)
    }
  }, [activePenhorasSavedViewId, savedViews, setActivePenhorasSavedViewId])

  useEffect(() => {
    if (!dsDefaultStatus) return
    setDsEntryForm((current) => {
      if (current.estadoId && dsOrderedStatuses.some((status) => status.id === current.estadoId)) {
        return current
      }
      return {
        ...current,
        estadoId: dsDefaultStatus.id,
      }
    })
  }, [dsDefaultStatus, dsOrderedStatuses])

  useEffect(() => {
    if (!penhorasDefaultStatus) return
    setPenhorasEntryForm((current) => {
      if (current.estadoId && penhorasOrderedStatuses.some((status) => status.id === current.estadoId)) {
        return current
      }
      return {
        ...current,
        estadoId: penhorasDefaultStatus.id,
      }
    })
  }, [penhorasDefaultStatus, penhorasOrderedStatuses])

  useEffect(() => {
    if (activeModule !== 'recibos' || activeTab !== 'dashboards') return
    void refreshDashboardSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule, activeTab, dashboardFilters, globalSearch])

  function dismissFeedback() {
    if (!feedback) return
    setFeedbackClosing(true)
  }

  const {
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
  } = useRecordActions({
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
  })

  const {
    exportCurrentSnapshot,
    removeSmartNotesLine,
    toggleSmartNotesPinned,
    toggleSmartNotesSaved,
    exportQuickNotesTxt,
    exportQuickNotesPdf,
    exportSmartNotesTxt,
    exportSmartNotesPdf,
  } = useNotesExport({
    quickNotes,
    smartNotesText,
    setSmartNotesText,
    smartNotesResults,
    smartNotesErrors,
    setSmartNotesPinnedSignatures,
    setSmartNotesSavedEntries,
    setFeedback,
  })

  const {
    refreshDashboardSummary,
    resetDashboardDraft,
    saveDashboard,
    deleteDashboard,
    patchFilters,
    patchDsFilters,
    patchPenhorasFilters,
    patchDashboardFilters,
  } = useDashboardHandlers({
    dashboardFilters,
    globalSearch,
    setDashboardLoading,
    setDashboardSummary,
    dashboardName,
    activeDashboardId,
    dashboardSavePayload: dashboardSavePayload as Record<string, unknown>,
    setSavedViews,
    setActiveDashboardId,
    setDashboardName,
    setDashboardFilters,
    setDashboardWidgets,
    setDashboardConfigOpen,
    setActiveSavedViewId,
    setFilters,
    setActiveDsSavedViewId,
    setDsFilters,
    setActivePenhorasSavedViewId,
    setPenhorasFilters,
    setFeedback,
  })

  function toggleTotalMetric(metric: TotalMetricKey) {
    setSelectedTotalMetrics((current) => {
      if (current.includes(metric)) {
        if (current.length === 1) return current
        return current.filter((item) => item !== metric)
      }
      return [...current, metric]
    })
  }

  function renderDashboardWidget(widget: DashboardWidget) {
    return (
      <RecibosDashboardWidgetCard
        key={widget.id}
        widget={widget}
        dashboardSummary={dashboardSummary}
        draggedWidgetId={draggedDashboardWidgetId}
        dropWidgetId={dropDashboardWidgetId}
        resizingWidgetId={resizingDashboardWidgetId}
        onSetDraggedId={setDraggedDashboardWidgetId}
        onSetDropId={setDropDashboardWidgetId}
        onReorder={reorderDashboardWidgets}
        onToggleColumn={toggleDashboardWidgetColumn}
        onAdjustWidth={adjustDashboardWidgetWidth}
        onAdjustHeight={adjustDashboardWidgetHeight}
        onMove={moveDashboardWidget}
        onRemove={removeDashboardWidget}
        onStartResize={(event, widgetId, minHeight) => startDashboardWidgetResize(event, 'recibos', widgetId, minHeight)}
      />
    )
  }

  function renderDsDashboardWidget(widget: DsDashboardWidget) {
    return (
      <DsDashboardWidgetCard
        key={widget.id}
        widget={widget}
        isLoading={dsRecordsLoading && dsRecords.length === 0}
        byStatus={dsDashboardByStatus}
        topGestoras={dsDashboardTopGestoras}
        topEntidades={dsDashboardTopEntidades}
        byMonth={dsDashboardByMonth}
        totals={dsDashboardTotals}
        draggedWidgetId={draggedDashboardWidgetId}
        dropWidgetId={dropDashboardWidgetId}
        resizingWidgetId={resizingDashboardWidgetId}
        onSetDraggedId={setDraggedDashboardWidgetId}
        onSetDropId={setDropDashboardWidgetId}
        onReorder={reorderDsDashboardWidgets}
        onToggleColumn={toggleDsDashboardWidgetColumn}
        onAdjustWidth={adjustDsDashboardWidgetWidth}
        onAdjustHeight={adjustDsDashboardWidgetHeight}
        onMove={moveDsDashboardWidget}
        onRemove={removeDsDashboardWidget}
        onStartResize={(event, widgetId, minHeight) => startDashboardWidgetResize(event, 'ds', widgetId, minHeight)}
      />
    )
  }

  function renderPenhorasDashboardWidget(widget: PenhorasDashboardWidget) {
    return (
      <PenhorasDashboardWidgetCard
        key={widget.id}
        widget={widget}
        isLoading={penhorasRecordsLoading && penhorasRecords.length === 0}
        byStatus={penhorasDashboardByStatus}
        topGestores={penhorasDashboardTopGestores}
        byMonth={penhorasDashboardByMonth}
        draggedWidgetId={draggedDashboardWidgetId}
        dropWidgetId={dropDashboardWidgetId}
        resizingWidgetId={resizingDashboardWidgetId}
        onSetDraggedId={setDraggedDashboardWidgetId}
        onSetDropId={setDropDashboardWidgetId}
        onReorder={reorderPenhorasDashboardWidgets}
        onToggleColumn={togglePenhorasDashboardWidgetColumn}
        onAdjustWidth={adjustPenhorasDashboardWidgetWidth}
        onAdjustHeight={adjustPenhorasDashboardWidgetHeight}
        onMove={movePenhorasDashboardWidget}
        onRemove={removePenhorasDashboardWidget}
        onStartResize={(event, widgetId, minHeight) => startDashboardWidgetResize(event, 'penhoras', widgetId, minHeight)}
      />
    )
  }

  function clearCalculator() {
    setCalculatorExpression('')
    setCalculatorResult(null)
    setCalculatorError('')
  }

  function appendCalculatorValue(value: string) {
    setCalculatorExpression((current) => `${current}${value}`)
    setCalculatorError('')
  }

  function backspaceCalculator() {
    setCalculatorExpression((current) => current.slice(0, -1))
    setCalculatorError('')
  }

  function handleCalculatorKeyPress(key: CalculatorKey) {
    if (key.action === 'clear') {
      clearCalculator()
      return
    }
    if (key.action === 'backspace') {
      backspaceCalculator()
      return
    }
    if (key.action === 'equals') {
      evaluateCalculator()
      return
    }
    if (key.value) {
      appendCalculatorValue(key.value)
    }
  }

  useEffect(() => {
    if (!notesOpen && !calculatorOpen && !smartNotesOpen) return

    function handleQuickToolKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isEditableTarget =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable === true

      if (event.key === 'Escape') {
        event.preventDefault()
        const openTools: QuickToolId[] = []
        if (notesOpen) openTools.push('notes')
        if (calculatorOpen) openTools.push('calculator')
        if (smartNotesOpen) openTools.push('smart-notes')
        const topTool = openTools.sort((a, b) => toolLayers[b] - toolLayers[a])[0]
        if (topTool === 'notes') {
          setNotesOpen(false)
        } else if (topTool === 'calculator') {
          setCalculatorOpen(false)
        } else if (topTool === 'smart-notes') {
          setSmartNotesOpen(false)
        }
        return
      }

      if (event.key === 'Enter' && calculatorOpen && !isEditableTarget) {
        event.preventDefault()
        evaluateCalculator()
      }
    }

    window.addEventListener('keydown', handleQuickToolKeyboard)
    return () => {
      window.removeEventListener('keydown', handleQuickToolKeyboard)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesOpen, calculatorOpen, smartNotesOpen, evaluateCalculator, toolLayers])

  function switchModule(nextModule: ModuleId) {
    setActiveModule(nextModule)
    setActiveTab(nextModule === 'recibos' ? 'entrada' : 'consulta')
    if (nextModule !== 'recibos') setSelectedRecordId(null)
    if (nextModule !== 'ds') setSelectedDsRecordId(null)
    if (nextModule !== 'penhoras') setSelectedPenhorasRecordId(null)
  }

  const topActionButtons = (
    <div className="top-actions">
      <button
        className="subtle-btn icon-btn"
        type="button"
        disabled={!latestUndo}
        onClick={() => void handleUndo()}
        title={latestUndo ? `Anular: ${latestUndo.label}` : 'Sem ações para anular'}
        aria-label={latestUndo ? `Anular: ${latestUndo.label}` : 'Sem ações para anular'}
      >
        <Undo2 size={15} />
      </button>
      <button
        className={`subtle-btn icon-btn ${toolsExpanded ? 'active' : ''}`}
        type="button"
        onClick={() => setToolsExpanded((current) => !current)}
        title={toolsExpanded ? 'Ocultar ferramentas' : 'Mostrar ferramentas'}
        aria-label={toolsExpanded ? 'Ocultar ferramentas' : 'Mostrar ferramentas'}
      >
        <Wrench size={15} />
      </button>
      {toolsExpanded && (
        <div className="top-tools">
          <button
            className={`subtle-btn icon-btn micro ${notesOpen ? 'active' : ''}`}
            type="button"
            title="Notas rápidas (Alt+N)"
            aria-label="Notas rápidas"
            onClick={() => toggleQuickTool('notes')}
          >
            <StickyNote size={15} />
          </button>
          <button
            className={`subtle-btn icon-btn micro ${calculatorOpen ? 'active' : ''}`}
            type="button"
            title="Calculadora (Alt+C)"
            aria-label="Calculadora"
            onClick={() => toggleQuickTool('calculator')}
          >
            <Calculator size={15} />
          </button>
          <button
            className={`subtle-btn icon-btn micro ${smartNotesOpen ? 'active' : ''}`}
            type="button"
            title="Notas com cálculo (Alt+S)"
            aria-label="Notas com cálculo"
            onClick={() => toggleQuickTool('smart-notes')}
          >
            <SquareFunction size={15} />
          </button>
        </div>
      )}
      <button
        className="primary-btn icon-btn"
        type="button"
        onClick={() => setActiveTab('entrada')}
        title={
          activeModule === 'ds' ? 'Novo registo DS' : activeModule === 'penhoras' ? 'Novo registo Penhoras' : 'Novo registo'
        }
        aria-label={
          activeModule === 'ds' ? 'Novo registo DS' : activeModule === 'penhoras' ? 'Novo registo Penhoras' : 'Novo registo'
        }
      >
        <Plus size={16} />
      </button>
    </div>
  )

  const tabButtons = TABS.map((tab) => (
    <button
      key={tab.id}
      className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
      onClick={() => setActiveTab(tab.id)}
      type="button"
    >
      {tab.label}
    </button>
  ))

  const isDashboardFocusMode = activeTab === 'dashboards' && dashboardFocusMode

  if (bootstrapLoading) {
    return <div className={`app-shell module-${activeModule} ${layoutMode === 'wide' ? 'wide' : ''}`}><div className="panel">A carregar aplicação...</div></div>
  }

  if (pageError) {
    return <div className={`app-shell module-${activeModule} ${layoutMode === 'wide' ? 'wide' : ''}`}><div className="panel">Erro: {pageError}</div></div>
  }

  return (
    <div
      className={`app-shell module-${activeModule} ${layoutMode === 'wide' || isDashboardFocusMode ? 'wide' : ''} ${isDashboardFocusMode ? 'dashboard-focus-mode' : ''}`}
    >
      <header className="topbar unified">
        <div className={`brand-block module-brand-host ${activeModule}-active`}>
          <div className={`module-brand-stack ${activeModule}-active`}>
            <button
              type="button"
              className={`module-brand-card back module-${nextModuleCard.id}`}
              onClick={() => switchModule(nextModuleCard.id)}
              title={`Trocar para ${nextModuleCard.title}`}
              aria-label={`Trocar para ${nextModuleCard.title}`}
            >
              <img className="brand-logo-img" src={nextModuleCard.logoSrc} alt={nextModuleCard.title} />
              {nextModuleCard.showSubtitle !== false && <div className="brand-subtitle">{nextModuleCard.subtitle}</div>}
            </button>
            <button
              type="button"
              className={`module-brand-card front module-${activeModuleCard.id}`}
              onClick={() => switchModule(nextModuleCard.id)}
              title={`Módulo ativo: ${activeModuleCard.title}. Clique para trocar para ${nextModuleCard.title}.`}
              aria-label={`Módulo ativo: ${activeModuleCard.title}. Clique para trocar para ${nextModuleCard.title}.`}
            >
              <img className="brand-logo-img" src={activeModuleCard.logoSrc} alt={activeModuleCard.title} />
              {activeModuleCard.showSubtitle !== false && <div className="brand-subtitle">{activeModuleCard.subtitle}</div>}
            </button>
          </div>
        </div>

        <div className={`topbar-command ${isDashboardFocusMode ? 'focus' : ''}`}>
          <nav className="tab-nav tab-nav-inline">{tabButtons}</nav>
          {isDashboardFocusMode ? (
            <div className="focus-exit-actions">
              <button className="subtle-btn" type="button" onClick={() => setDashboardFocusMode(false)}>
                <Minimize2 size={15} />
                Voltar ao normal
              </button>
            </div>
          ) : (
            <div className="topbar-search-actions">
              <input
                className="global-search"
                value={globalSearch}
                onChange={(event) => {
                  setActiveSavedViewId(null)
                  setActiveDsSavedViewId(null)
                  setActivePenhorasSavedViewId(null)
                  setGlobalSearch(event.target.value)
                }}
                placeholder="Pesquisar por processo, PE, recibo, exequente, gestor ou nota..."
              />
              {topActionButtons}
            </div>
          )}
        </div>
      </header>

      {feedback && !isDashboardFocusMode && (
        <div className={`panel import-feedback ${feedbackClosing ? 'closing' : ''}`} role="status">
          <span>{feedback}</span>
          <button
            className="notice-close"
            type="button"
            onClick={dismissFeedback}
            aria-label="Fechar aviso"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {notesOpen && (
        <QuickNotesWindow
          windowRef={notesWindowRef}
          position={toolPositions.notes}
          zIndex={notesWindowZIndex}
          isPinned={toolPinned.notes}
          isDragging={draggingTool === 'notes'}
          quickNotes={quickNotes}
          onBringToFront={() => bringToolToFront('notes')}
          onStartDrag={(event) => startToolWindowDrag('notes', event)}
          onTogglePinned={() => toggleQuickToolPinned('notes')}
          onClose={() => setNotesOpen(false)}
          onChangeNotes={setQuickNotes}
          onClearNotes={() => setQuickNotes('')}
          onExportTxt={exportQuickNotesTxt}
          onExportPdf={exportQuickNotesPdf}
        />
      )}

      {smartNotesOpen && (
        <SmartNotesWindow
          windowRef={smartNotesWindowRef}
          position={toolPositions['smart-notes']}
          zIndex={smartNotesWindowZIndex}
          isPinned={toolPinned['smart-notes']}
          isDragging={draggingTool === 'smart-notes'}
          smartNotesText={smartNotesText}
          resultsCount={smartNotesResults.length}
          displayResults={smartNotesDisplayResults}
          errors={smartNotesErrors}
          pinnedSet={smartNotesPinnedSet}
          savedSet={smartNotesSavedSet}
          savedEntries={smartNotesSavedEntries}
          onBringToFront={() => bringToolToFront('smart-notes')}
          onStartDrag={(event) => startToolWindowDrag('smart-notes', event)}
          onTogglePinned={() => toggleQuickToolPinned('smart-notes')}
          onClose={() => setSmartNotesOpen(false)}
          onChangeText={setSmartNotesText}
          onTogglePinnedRow={toggleSmartNotesPinned}
          onToggleSavedRow={toggleSmartNotesSaved}
          onRemoveLine={removeSmartNotesLine}
          onClearSaved={() => setSmartNotesSavedEntries([])}
          onClearText={() => setSmartNotesText('')}
          onExportTxt={exportSmartNotesTxt}
          onExportPdf={exportSmartNotesPdf}
        />
      )}

      {calculatorOpen && (
        <CalculatorWindow
          windowRef={calculatorWindowRef}
          position={toolPositions.calculator}
          zIndex={calculatorWindowZIndex}
          isPinned={toolPinned.calculator}
          isDragging={draggingTool === 'calculator'}
          expression={calculatorExpression}
          result={calculatorResult}
          error={calculatorError}
          onBringToFront={() => bringToolToFront('calculator')}
          onStartDrag={(event) => startToolWindowDrag('calculator', event)}
          onTogglePinned={() => toggleQuickToolPinned('calculator')}
          onClose={() => setCalculatorOpen(false)}
          onKeyPress={handleCalculatorKeyPress}
        />
      )}

      <main className="main-grid">
        {activeModule === 'ds' && activeTab === 'entrada' && (
          <DsEntrada
            dsRecentRecords={dsRecentRecords}
            dsStatuses={dsStatuses}
            dsOrderedStatuses={dsOrderedStatuses}
            dsDefaultStatus={dsDefaultStatus}
            dsEntryForm={dsEntryForm}
            setDsEntryForm={setDsEntryForm}
            submitDsEntry={submitDsEntry}
            saveNewDsEntry={saveNewDsEntry}
            handleDsEntryInput={handleDsEntryInput}
            dsGestoraFilterOptions={dsGestoraFilterOptions}
            dsProponentesSuggestions={dsProponentesSuggestions}
            dsReferenciaSuggestions={dsReferenciaSuggestions}
            dsProdutoFilterOptions={dsProdutoFilterOptions}
            dsEntidadeFilterOptions={dsEntidadeFilterOptions}
            dsReciboSuggestions={dsReciboSuggestions}
            setActiveTab={setActiveTab}
            setSelectedDsRecordId={setSelectedDsRecordId}
          />
        )}

        {activeModule === 'ds' && activeTab === 'dashboards' && (
          <DsDashboards
            isDashboardFocusMode={isDashboardFocusMode}
            setDashboardFocusMode={setDashboardFocusMode}
            dsDashboardViews={dsDashboardViews}
            disabledSavedViewIds={disabledSavedViewIds}
            activeDsSavedViewId={activeDsSavedViewId}
            applyDsView={applyDsView}
            toggleDsSavedViewDisabled={toggleDsSavedViewDisabled}
            deleteDsSavedView={deleteDsSavedView}
            clearDsFilters={clearDsFilters}
            saveCurrentView={saveCurrentView}
            dsFilters={dsFilters}
            globalSearch={globalSearch}
            dsDashboardConfigOpen={dsDashboardConfigOpen}
            setDsDashboardConfigOpen={setDsDashboardConfigOpen}
            dsDashboardWidgetsOpen={dsDashboardWidgetsOpen}
            setDsDashboardWidgetsOpen={setDsDashboardWidgetsOpen}
            dsDashboardPickerOpen={dsDashboardPickerOpen}
            setDsDashboardPickerOpen={setDsDashboardPickerOpen}
            dsDashboardWidgets={dsDashboardWidgets}
            setDsDashboardWidgets={setDsDashboardWidgets}
            dsDashboardMainWidgets={dsDashboardMainWidgets}
            dsDashboardSideWidgets={dsDashboardSideWidgets}
            dsDashboardHasSideStack={dsDashboardHasSideStack}
            addDsDashboardWidget={addDsDashboardWidget}
            renderDsDashboardWidget={renderDsDashboardWidget}
            dsDashboardTotals={dsDashboardTotals}
            formatCurrency={formatCurrency}
            dsOrderedStatuses={dsOrderedStatuses}
            dsYears={dsYears}
            dsGestoraFilterOptions={dsGestoraFilterOptions}
            dsEntidadeFilterOptions={dsEntidadeFilterOptions}
            dsProdutoFilterOptions={dsProdutoFilterOptions}
            patchDsFilters={patchDsFilters}
            dsRecordsLoading={dsRecordsLoading}
            dsTotalRecords={dsTotalRecords}
          />
        )}

        {activeModule === 'ds' && (activeTab === 'consulta' || activeTab === 'tabela') && (
          <DsConsultaTabela
            activeTab={activeTab}
            dsRecords={dsRecords}
            dsRecordsLoading={dsRecordsLoading}
            dsTotalRecords={dsTotalRecords}
            dsStatuses={dsStatuses}
            dsOrderedStatuses={dsOrderedStatuses}
            dsFilters={dsFilters}
            patchDsFilters={patchDsFilters}
            dsYears={dsYears}
            dsGestoraFilterOptions={dsGestoraFilterOptions}
            dsEntidadeFilterOptions={dsEntidadeFilterOptions}
            dsProdutoFilterOptions={dsProdutoFilterOptions}
            dsTableViews={dsTableViews}
            disabledSavedViewIds={disabledSavedViewIds}
            activeDsSavedViewId={activeDsSavedViewId}
            applyDsView={applyDsView}
            toggleDsSavedViewDisabled={toggleDsSavedViewDisabled}
            deleteDsSavedView={deleteDsSavedView}
            clearDsFilters={clearDsFilters}
            saveCurrentView={saveCurrentView}
            globalSearch={globalSearch}
            setSelectedDsRecordId={setSelectedDsRecordId}
            setIsDsRecordEditing={setIsDsRecordEditing}
            updateDsRecordStatus={updateDsRecordStatus}
            formatCurrency={formatCurrency}
          />
        )}

        {activeModule === 'ds' && activeTab === 'importar' && (
          <DsImportar
            handleDsImportFile={handleDsImportFile}
            refreshDsImportPreview={refreshDsImportPreview}
            runDsImportCommit={runDsImportCommit}
            dsImportLoading={dsImportLoading}
            dsImportStrategy={dsImportStrategy}
            setDsImportStrategy={setDsImportStrategy}
            dsImportPreview={dsImportPreview}
            dsImportServerPreview={dsImportServerPreview}
          />
        )}

        {activeModule === 'ds' && activeTab === 'configuracao' && (
          <DsConfiguracao
            dsOrderedStatuses={dsOrderedStatuses}
            updateDsStatusLocal={updateDsStatusLocal}
            removeDsStatus={removeDsStatus}
            addDsStatus={addDsStatus}
            saveDsStatuses={saveDsStatuses}
            setActiveTab={setActiveTab}
          />
        )}

        {activeModule === 'penhoras' && activeTab === 'entrada' && (
          <PenhorasEntrada
            penhorasRecentRecords={penhorasRecentRecords}
            penhorasStatuses={penhorasStatuses}
            penhorasActiveStatuses={penhorasActiveStatuses}
            penhorasDefaultStatus={penhorasDefaultStatus}
            penhorasEntryForm={penhorasEntryForm}
            setPenhorasEntryForm={setPenhorasEntryForm}
            submitPenhorasEntry={submitPenhorasEntry}
            saveNewPenhorasEntry={saveNewPenhorasEntry}
            handlePenhorasEntryInput={handlePenhorasEntryInput}
            penhorasPeSuggestions={penhorasPeSuggestions}
            penhorasActoFilterOptions={penhorasActoFilterOptions}
            penhorasGestorFilterOptions={penhorasGestorFilterOptions}
            setActiveTab={setActiveTab}
            setSelectedPenhorasRecordId={setSelectedPenhorasRecordId}
          />
        )}

        {activeModule === 'penhoras' && activeTab === 'dashboards' && (
          <PenhorasDashboards
            isDashboardFocusMode={isDashboardFocusMode}
            setDashboardFocusMode={setDashboardFocusMode}
            penhorasDashboardViews={penhorasDashboardViews}
            disabledSavedViewIds={disabledSavedViewIds}
            activePenhorasSavedViewId={activePenhorasSavedViewId}
            applyPenhorasView={applyPenhorasView}
            togglePenhorasSavedViewDisabled={togglePenhorasSavedViewDisabled}
            deletePenhorasSavedView={deletePenhorasSavedView}
            clearPenhorasFilters={clearPenhorasFilters}
            saveCurrentView={saveCurrentView}
            penhorasFilters={penhorasFilters}
            globalSearch={globalSearch}
            penhorasDashboardConfigOpen={penhorasDashboardConfigOpen}
            setPenhorasDashboardConfigOpen={setPenhorasDashboardConfigOpen}
            penhorasDashboardWidgetsOpen={penhorasDashboardWidgetsOpen}
            setPenhorasDashboardWidgetsOpen={setPenhorasDashboardWidgetsOpen}
            penhorasDashboardPickerOpen={penhorasDashboardPickerOpen}
            setPenhorasDashboardPickerOpen={setPenhorasDashboardPickerOpen}
            penhorasDashboardWidgets={penhorasDashboardWidgets}
            setPenhorasDashboardWidgets={setPenhorasDashboardWidgets}
            penhorasDashboardMainWidgets={penhorasDashboardMainWidgets}
            penhorasDashboardSideWidgets={penhorasDashboardSideWidgets}
            penhorasDashboardHasSideStack={penhorasDashboardHasSideStack}
            addPenhorasDashboardWidget={addPenhorasDashboardWidget}
            renderPenhorasDashboardWidget={renderPenhorasDashboardWidget}
            penhorasDashboardTotals={penhorasDashboardTotals}
            penhorasActiveStatuses={penhorasActiveStatuses}
            penhorasYears={penhorasYears}
            penhorasGestorFilterOptions={penhorasGestorFilterOptions}
            penhorasActoFilterOptions={penhorasActoFilterOptions}
            patchPenhorasFilters={patchPenhorasFilters}
            penhorasRecordsLoading={penhorasRecordsLoading}
            penhorasTotalRecords={penhorasTotalRecords}
          />
        )}

        {activeModule === 'penhoras' && (activeTab === 'consulta' || activeTab === 'tabela') && (
          <PenhorasConsultaTabela
            activeTab={activeTab}
            penhorasRecords={penhorasRecords}
            penhorasRecordsLoading={penhorasRecordsLoading}
            penhorasTotalRecords={penhorasTotalRecords}
            penhorasStatuses={penhorasStatuses}
            penhorasActiveStatuses={penhorasActiveStatuses}
            penhorasFilters={penhorasFilters}
            patchPenhorasFilters={patchPenhorasFilters}
            penhorasYears={penhorasYears}
            penhorasGestorFilterOptions={penhorasGestorFilterOptions}
            penhorasActoFilterOptions={penhorasActoFilterOptions}
            penhorasTableViews={penhorasTableViews}
            disabledSavedViewIds={disabledSavedViewIds}
            activePenhorasSavedViewId={activePenhorasSavedViewId}
            applyPenhorasView={applyPenhorasView}
            togglePenhorasSavedViewDisabled={togglePenhorasSavedViewDisabled}
            deletePenhorasSavedView={deletePenhorasSavedView}
            clearPenhorasFilters={clearPenhorasFilters}
            saveCurrentView={saveCurrentView}
            globalSearch={globalSearch}
            penhorasDashboardTotals={penhorasDashboardTotals}
            setSelectedPenhorasRecordId={setSelectedPenhorasRecordId}
            setIsPenhorasRecordEditing={setIsPenhorasRecordEditing}
            updatePenhorasRecordStatus={updatePenhorasRecordStatus}
          />
        )}

        {
          activeModule === 'penhoras' && activeTab === 'importar' && (
            <PenhorasImportar
              handlePenhorasImportFile={handlePenhorasImportFile}
              refreshPenhorasImportPreview={refreshPenhorasImportPreview}
              runPenhorasImportCommit={runPenhorasImportCommit}
              penhorasImportLoading={penhorasImportLoading}
              penhorasImportStrategy={penhorasImportStrategy}
              setPenhorasImportStrategy={setPenhorasImportStrategy}
              penhorasImportPreview={penhorasImportPreview}
              penhorasImportServerPreview={penhorasImportServerPreview}
            />
          )
        }

        {
          activeModule === 'penhoras' && activeTab === 'configuracao' && (
            <PenhorasConfiguracao
              penhorasOrderedStatuses={penhorasOrderedStatuses}
              updatePenhorasStatusLocal={updatePenhorasStatusLocal}
              removePenhorasStatus={removePenhorasStatus}
              addPenhorasStatus={addPenhorasStatus}
              savePenhorasStatuses={savePenhorasStatuses}
              setActiveTab={setActiveTab}
            />
          )
        }

        {
          activeModule === 'recibos' && activeTab === 'entrada' && (
            <RecibosEntrada
              recentRecords={recentRecords}
              statuses={statuses}
              activeStatuses={activeStatuses}
              defaultStatus={defaultStatus}
              entryForm={entryForm}
              setEntryForm={setEntryForm}
              calculationSettings={calculationSettings}
              submitEntry={submitEntry}
              saveNewEntry={saveNewEntry}
              handleEntryInput={handleEntryInput}
              recordSuggestions={recordSuggestions}
              gestorSuggestions={gestorSuggestions}
              exequenteSuggestions={exequenteSuggestions}
              setActiveTab={setActiveTab}
              setSelectedRecordId={setSelectedRecordId}
            />
          )
        }

        {
          activeModule === 'recibos' && (activeTab === 'consulta' || activeTab === 'tabela') && (
            <RecibosConsultaTabela
              activeTab={activeTab}
              records={records}
              recordsLoading={recordsLoading}
              totalRecords={totalRecords}
              statuses={statuses}
              orderedStatuses={orderedStatuses}
              filters={filters}
              patchFilters={patchFilters}
              years={years}
              exequenteFilterOptions={exequenteFilterOptions}
              gestorFilterOptions={gestorFilterOptions}
              clearTableFilters={clearTableFilters}
              tableViews={tableViews}
              disabledSavedViewIds={disabledSavedViewIds}
              activeSavedViewId={activeSavedViewId}
              applyView={applyView}
              toggleSavedViewDisabled={toggleSavedViewDisabled}
              deleteSavedView={deleteSavedView}
              saveCurrentView={saveCurrentView}
              globalSearch={globalSearch}
              totalsHoverOpen={totalsHoverOpen}
              setTotalsHoverOpen={setTotalsHoverOpen}
              selectedTotalMetrics={selectedTotalMetrics}
              toggleTotalMetric={toggleTotalMetric}
              totalsSnapshot={totalsSnapshot}
              bulkSectionOpen={bulkSectionOpen}
              setBulkSectionOpen={setBulkSectionOpen}
              bulkPanelOpen={bulkPanelOpen}
              setBulkPanelOpen={setBulkPanelOpen}
              selectedIds={selectedIds}
              allSelectedInTable={allSelectedInTable}
              toggleSelectAllRecords={toggleSelectAllRecords}
              toggleSelectRecord={toggleSelectRecord}
              bulkStatusId={bulkStatusId}
              setBulkStatusId={setBulkStatusId}
              runBulkStatusUpdate={runBulkStatusUpdate}
              bulkGestor={bulkGestor}
              setBulkGestor={setBulkGestor}
              gestorSuggestions={gestorSuggestions}
              bulkExequente={bulkExequente}
              setBulkExequente={setBulkExequente}
              exequenteSuggestions={exequenteSuggestions}
              bulkIndicacoes={bulkIndicacoes}
              setBulkIndicacoes={setBulkIndicacoes}
              bulkForceRecalculate={bulkForceRecalculate}
              setBulkForceRecalculate={setBulkForceRecalculate}
              runBulkFieldUpdate={runBulkFieldUpdate}
              setSelectedRecordId={setSelectedRecordId}
              setIsRecordEditing={setIsRecordEditing}
              updateRecordStatus={updateRecordStatus}
              formatCurrency={formatCurrency}
            />
          )
        }

        {
          activeModule === 'recibos' && activeTab === 'dashboards' && (
            <RecibosDashboards
              isDashboardFocusMode={isDashboardFocusMode}
              setDashboardFocusMode={setDashboardFocusMode}
              dashboardConfigOpen={dashboardConfigOpen}
              setDashboardConfigOpen={setDashboardConfigOpen}
              resetDashboardDraft={resetDashboardDraft}
              saveDashboard={saveDashboard}
              deleteDashboard={deleteDashboard}
              activeDashboardId={activeDashboardId}
              dashboardViews={dashboardViews}
              loadDashboardView={loadDashboardView}
              dashboardName={dashboardName}
              setDashboardName={setDashboardName}
              dashboardPickerOpen={dashboardPickerOpen}
              setDashboardPickerOpen={setDashboardPickerOpen}
              addDashboardWidget={addDashboardWidget}
              dashboardFiltersOpen={dashboardFiltersOpen}
              setDashboardFiltersOpen={setDashboardFiltersOpen}
              dashboardFilters={dashboardFilters}
              setDashboardFilters={setDashboardFilters}
              patchDashboardFilters={patchDashboardFilters}
              dashboardActiveFilterCount={dashboardActiveFilterCount}
              dashboardLoading={dashboardLoading}
              dashboardSummary={dashboardSummary}
              formatCurrency={formatCurrency}
              orderedStatuses={orderedStatuses}
              years={years}
              exequenteFilterOptions={exequenteFilterOptions}
              gestorFilterOptions={gestorFilterOptions}
              dashboardWidgets={dashboardWidgets}
              dashboardMainWidgets={dashboardMainWidgets}
              dashboardSideWidgets={dashboardSideWidgets}
              dashboardHasSideStack={dashboardHasSideStack}
              renderDashboardWidget={renderDashboardWidget}
            />
          )
        }

        {
          activeModule === 'recibos' && activeTab === 'importar' && (
            <RecibosImportar
              handleImportFile={handleImportFile}
              exportCurrentSnapshot={exportCurrentSnapshot}
              loadSeed={loadSeed}
              refreshImportConflictPreview={refreshImportConflictPreview}
              runImportCommit={runImportCommit}
              importLoading={importLoading}
              importForceRecalculate={importForceRecalculate}
              setImportForceRecalculate={setImportForceRecalculate}
              importStrategy={importStrategy}
              setImportStrategy={setImportStrategy}
              importPreview={importPreview}
              importServerPreview={importServerPreview}
              importColorMapping={importColorMapping}
              setImportColorMapping={setImportColorMapping}
              orderedStatuses={orderedStatuses}
              defaultStatus={defaultStatus}
            />
          )
        }

        {
          activeModule === 'recibos' && activeTab === 'configuracao' && (
            <RecibosConfiguracao
              theme={theme}
              setTheme={setTheme}
              orderedStatuses={orderedStatuses}
              updateStatusLocal={updateStatusLocal}
              removeStatus={removeStatus}
              addStatus={addStatus}
              saveStatuses={saveStatuses}
              settingsDraft={settingsDraft}
              updateSettingsDraft={updateSettingsDraft}
              updateTaxRule={updateTaxRule}
              saveCalculationSettings={saveCalculationSettings}
              setActiveTab={setActiveTab}
            />
          )
        }

        {activeModule === 'ds' && (activeTab === 'consulta' || activeTab === 'tabela') && selectedDsRecord && (
          <DsRecordDrawer
            record={selectedDsRecord}
            recordEdit={selectedDsRecordEdit}
            isEditing={isDsRecordEditing}
            orderedStatuses={dsOrderedStatuses}
            gestoraOptions={dsGestoraFilterOptions}
            proponentesSuggestions={dsProponentesSuggestions}
            referenciaSuggestions={dsReferenciaSuggestions}
            produtoOptions={dsProdutoFilterOptions}
            entidadeOptions={dsEntidadeFilterOptions}
            reciboSuggestions={dsReciboSuggestions}
            onClose={() => setSelectedDsRecordId(null)}
            onToggleEdit={() => setIsDsRecordEditing((current) => !current)}
            onEditInput={handleDsRecordEditInput}
            onSave={() => void saveSelectedDsRecordEdits()}
            onStatusChange={(recordId, statusId) => void updateDsRecordStatus(recordId, statusId)}
          />
        )}

        {activeModule === 'penhoras' && (activeTab === 'consulta' || activeTab === 'tabela') && selectedPenhorasRecord && (
          <PenhorasRecordDrawer
            record={selectedPenhorasRecord}
            recordEdit={selectedPenhorasRecordEdit}
            isEditing={isPenhorasRecordEditing}
            activeStatuses={penhorasActiveStatuses}
            peSuggestions={penhorasPeSuggestions}
            actoOptions={penhorasActoFilterOptions}
            gestorOptions={penhorasGestorFilterOptions}
            onClose={() => setSelectedPenhorasRecordId(null)}
            onToggleEdit={() => setIsPenhorasRecordEditing((current) => !current)}
            onEditInput={handlePenhorasRecordEditInput}
            onSave={() => void saveSelectedPenhorasRecordEdits()}
            onStatusChange={(recordId, statusId) => void updatePenhorasRecordStatus(recordId, statusId)}
          />
        )}

        {activeModule === 'recibos' && selectedRecord && (
          <RecibosRecordDrawer
            record={selectedRecord}
            recordEdit={selectedRecordEdit}
            isEditing={isRecordEditing}
            orderedStatuses={orderedStatuses}
            recordSuggestions={recordSuggestions}
            gestorSuggestions={gestorSuggestions}
            exequenteSuggestions={exequenteSuggestions}
            recordIndicacoes={selectedRecordIndicacoes}
            onClose={() => setSelectedRecordId(null)}
            onToggleEdit={() => setIsRecordEditing((current) => !current)}
            onEditInput={handleRecordEditInput}
            onRecalculate={() => selectedRecordEdit && setSelectedRecordEdit(applyFormAutoCalculations(selectedRecordEdit, calculationSettings, true))}
            onSave={() => void saveSelectedRecordEdits()}
            onStatusChange={(recordId, statusId) => void updateRecordStatus(recordId, statusId)}
          />
        )}
      </main >
    </div >
  )
}

export default App
