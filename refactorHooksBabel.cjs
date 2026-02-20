const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const originalContent = fs.readFileSync('src/App.tsx', 'utf-8');

console.log("Parsing AST...");
const ast = parser.parse(originalContent, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});

const functionsToStrip = new Set([
  "migrateLegacyLocalStorageIfPresent",
  "refreshRecords",
  "refreshDsRecords",
  "refreshPenhorasRecords",
  "toggleQuickTool",
  "toggleQuickToolPinned",
  "bringToolToFront",
  "getToolWindowElement",
  "startToolWindowDrag",
  "saveCurrentView",
  "deleteSavedView",
  "toggleSavedViewDisabled",
  "clearTableFilters",
  "applyView",
  "deleteDsSavedView",
  "toggleDsSavedViewDisabled",
  "clearDsFilters",
  "applyDsView",
  "deletePenhorasSavedView",
  "togglePenhorasSavedViewDisabled",
  "clearPenhorasFilters",
  "applyPenhorasView",
  "loadDashboardView",
  "addDashboardWidget",
  "removeDashboardWidget",
  "moveDashboardWidget",
  "reorderDashboardWidgets",
  "adjustDashboardWidgetWidth",
  "toggleDashboardWidgetColumn",
  "adjustDashboardWidgetHeight",
  "addDsDashboardWidget",
  "removeDsDashboardWidget",
  "moveDsDashboardWidget",
  "reorderDsDashboardWidgets",
  "adjustDsDashboardWidgetWidth",
  "toggleDsDashboardWidgetColumn",
  "adjustDsDashboardWidgetHeight",
  "addPenhorasDashboardWidget",
  "removePenhorasDashboardWidget",
  "movePenhorasDashboardWidget",
  "reorderPenhorasDashboardWidgets",
  "adjustPenhorasDashboardWidgetWidth",
  "togglePenhorasDashboardWidgetColumn",
  "adjustPenhorasDashboardWidgetHeight",
  "startDashboardWidgetResize" // from dashboard
]);

// Strip useEffects that match certain strings exactly matching the old logic.
const useEffectHooksToStrip = [
  "setBootstrapLoading(true)",
  "document.documentElement.setAttribute('data-theme', theme)",
  "localStorage.setItem('mesa-recibos-layout', layoutMode)",
  "localStorage.setItem('mesa-recibos-quick-notes', quickNotes)",
  "localStorage.setItem('mesa-recibos-smart-notes', smartNotesText)",
  "localStorage.setItem('mesa-recibos-smart-notes-pinned', JSON.stringify(smartNotesPinnedSignatures))",
  "localStorage.setItem('mesa-recibos-smart-notes-saved', JSON.stringify(smartNotesSavedEntries.slice(0, 200)))",
  "localStorage.setItem('mesa-recibos-disabled-saved-views', JSON.stringify(disabledSavedViewIds))",
  "if (activeTab !== 'dashboards' && dashboardFocusMode)",
  "if (!resizingDashboardWidgetId) return",
  "if (!draggingTool) return"
];

const rangesToRemove = [];

traverse(ast, {
  FunctionDeclaration(path) {
    if (path.node.id && functionsToStrip.has(path.node.id.name)) {
      rangesToRemove.push({ start: path.node.start, end: path.node.end });
      functionsToStrip.delete(path.node.id.name);
    }
  },
  VariableDeclarator(path) {
    if (path.node.id && path.node.init && (path.node.init.type === 'ArrowFunctionExpression' || path.node.init.type === 'FunctionExpression')) {
      if (functionsToStrip.has(path.node.id.name)) {
        rangesToRemove.push({ start: path.parentPath.node.start, end: path.parentPath.node.end });
        functionsToStrip.delete(path.node.id.name);
      }
    }
  },
  CallExpression(path) {
    if (path.node.callee.name === 'useEffect' || path.node.callee.name === 'useCallback') {
      const codeChunk = originalContent.slice(path.node.start, path.node.end);
      for (const str of useEffectHooksToStrip) {
        if (codeChunk.includes(str)) {
          rangesToRemove.push({ start: path.parentPath.node.start, end: path.parentPath.node.end });
          break;
        }
      }
      // Also strip evaluateCalculator useCallback
      if (codeChunk.includes("setCalculatorError('Expressão inválida.')")) {
        rangesToRemove.push({ start: path.parentPath.node.start, end: path.parentPath.node.end });
      }
    }
  }
});

rangesToRemove.sort((a, b) => b.start - a.start);

let transformedContent = originalContent;
for (const { start, end } of rangesToRemove) {
  transformedContent = transformedContent.slice(0, start) + transformedContent.slice(end);
}

// NOW replace the state block and add the imports
const importBlock = "import { useTheme } from './hooks/useTheme'\n" +
  "import { useUndoStack } from './hooks/useUndoStack'\n" +
  "import { useQuickTools } from './hooks/useQuickTools'\n" +
  "import { useRecords } from './hooks/useRecords'\n" +
  "import { useDsRecords } from './hooks/useDsRecords'\n" +
  "import { usePenhorasRecords } from './hooks/usePenhorasRecords'\n" +
  "import { useSmartNotes } from './hooks/useSmartNotes'\n" +
  "import { useSavedViews } from './hooks/useSavedViews'\n" +
  "import { useDashboard } from './hooks/useDashboard'\n" +
  "import { useBootstrap } from './hooks/useBootstrap'\n";

transformedContent = transformedContent.replace("import type { SmartNotesResultRow, SmartNotesErrorRow } from './lib/smartNotes'", "import type { SmartNotesResultRow, SmartNotesErrorRow } from './lib/smartNotes'\n" + importBlock);

const stateStart = transformedContent.indexOf("const [activeModule, setActiveModule]");
const stateEndStr = "const [settingsDraft, setSettingsDraft] = useState<CalculationSettings>(EMPTY_CALC_SETTINGS)";
const stateEnd = transformedContent.indexOf(stateEndStr) + stateEndStr.length;

if (stateStart > -1 && stateEnd > stateStart) {
  const newStatesAndHooks = `
  const { theme, setTheme, isDarkLike } = useTheme()
  const { undoStack, pushUndo, handleUndo, dismissUndo } = useUndoStack()
  
  const [activeModule, setActiveModule] = useState<ModuleId>('recibos')
  const [activeTab, setActiveTab] = useState<TabId>('entrada')
  const [statuses, setStatuses] = useState<StatusDefinition[]>([])
  const [calculationSettings, setCalculationSettings] = useState<CalculationSettings>(EMPTY_CALC_SETTINGS)

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

  const [importLoading, setImportLoading] = useState(false)
  const [importPreview, setImportPreview] = useState<ParsedImport | null>(null)
  const [importColorMapping, setImportColorMapping] = useState<Record<string, string>>({})
  const [importServerPreview, setImportServerPreview] = useState<ImportPreviewResponse | null>(null)
  const [importStrategy, setImportStrategy] = useState<'skip' | 'update' | 'duplicate'>('update')
  const [importForceRecalculate, setImportForceRecalculate] = useState(false)

  const [dsStatuses, setDsStatuses] = useState<StatusDefinition[]>([])
  const [dsImportLoading, setDsImportLoading] = useState(false)
  const [dsImportPreview, setDsImportPreview] = useState<DsParsedImport | null>(null)
  const [dsImportServerPreview, setDsImportServerPreview] = useState<ImportPreviewResponse | null>(null)
  const [dsImportStrategy, setDsImportStrategy] = useState<'skip' | 'update' | 'duplicate'>('update')
  const [dsEntryForm, setDsEntryForm] = useState<DsEntryForm>(getInitialDsEntryForm(''))

  const [penhorasStatuses, setPenhorasStatuses] = useState<StatusDefinition[]>([])
  const [penhorasImportLoading, setPenhorasImportLoading] = useState(false)
  const [penhorasImportPreview, setPenhorasImportPreview] = useState<PenhorasParsedImport | null>(null)
  const [penhorasImportServerPreview, setPenhorasImportServerPreview] = useState<ImportPreviewResponse | null>(null)
  const [penhorasImportStrategy, setPenhorasImportStrategy] = useState<'skip' | 'update' | 'duplicate'>('update')
  const [penhorasEntryForm, setPenhorasEntryForm] = useState<PenhorasEntryForm>(getInitialPenhorasEntryForm(''))

  const [settingsDraft, setSettingsDraft] = useState<CalculationSettings>(EMPTY_CALC_SETTINGS)

  // HOOKS
  const {
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
  } = useRecords(globalSearch, setFeedback)

  const {
    dsRecords,
    setDsRecords,
    dsTotalRecords,
    dsRecordsLoading,
    dsFilters,
    setDsFilters,
    refreshDsRecords,
  } = useDsRecords(globalSearch, setFeedback)

  const {
    penhorasRecords,
    setPenhorasRecords,
    penhorasTotalRecords,
    penhorasRecordsLoading,
    penhorasFilters,
    setPenhorasFilters,
    refreshPenhorasRecords,
  } = usePenhorasRecords(globalSearch, penhorasStatuses, setPenhorasStatuses, setFeedback)

  const {
    smartNotesText,
    setSmartNotesText,
    smartNotesPinnedSignatures,
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
    setDisabledSavedViewIds,
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

    if (!/^[0-9+\\-*/().\\s%]+$/.test(normalized)) {
      setCalculatorError('Expressão inválida.')
      setCalculatorResult(null)
      return
    }

    const expressionWithPercent = normalized.replace(/(\\d+(\\.\\d+)?)%/g, '($1/100)')

    try {
      const computed = Function(\`"use strict"; return (\${expressionWithPercent})\`)()
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

  const { bootstrapLoading, setPageError } = useBootstrap({
    setStatuses,
    setSavedViews,
    setCalculationSettings,
    setSettingsDraft,
    setDsStatuses,
    setPenhorasStatuses,
    setEntryForm,
    setBulkStatusId,
    setDsEntryForm,
    setPenhorasEntryForm,
    setFeedback,
    refreshRecords,
    refreshDsRecords,
    refreshPenhorasRecords,
  })
`;
  transformedContent = transformedContent.slice(0, stateStart) + newStatesAndHooks.trim() + "\n" + transformedContent.slice(stateEnd);
}

// Clean up double blank lines
transformedContent = transformedContent.replace(/\n\s*\n\s*\n/g, '\n\n');

fs.writeFileSync('src/App.tsx', transformedContent);
console.log("Refactoring complete with Babel. Remaining un-stripped:", [...functionsToStrip]);
