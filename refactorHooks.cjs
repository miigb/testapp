const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Add new imports
const importBlock = `
import { useTheme } from './hooks/useTheme'
import { useUndoStack } from './hooks/useUndoStack'
import { useQuickTools } from './hooks/useQuickTools'
import { useRecords } from './hooks/useRecords'
import { useDsRecords } from './hooks/useDsRecords'
import { usePenhorasRecords } from './hooks/usePenhorasRecords'
import { useSmartNotes } from './hooks/useSmartNotes'
import { useSavedViews } from './hooks/useSavedViews'
import { useDashboard } from './hooks/useDashboard'
import { useBootstrap } from './hooks/useBootstrap'
`;
content = content.replace("import type { SmartNotesResultRow, SmartNotesErrorRow } from './lib/smartNotes'", "import type { SmartNotesResultRow, SmartNotesErrorRow } from './lib/smartNotes'\n" + importBlock);

// 2. We need to replace a MASSIVE chunk of state declarations inside App() with the hook calls.
// We'll target from \`const [activeModule\` all the way down to \`setSettingsDraft\`
const stateStart = content.indexOf("const [activeModule, setActiveModule]");
const stateEndStr = "const [settingsDraft, setSettingsDraft] = useState<CalculationSettings>(EMPTY_CALC_SETTINGS)";
const stateEnd = content.indexOf(stateEndStr) + stateEndStr.length;

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
  content = content.slice(0, stateStart) + newStatesAndHooks.trim() + "\n" + content.slice(stateEnd);
}

function stripFunction(fnName) {
  let startIndex = content.indexOf('function ' + fnName + '(');
  if (startIndex === -1) {
    startIndex = content.indexOf('async function ' + fnName + '(');
  }

  if (startIndex !== -1) {
    let brackets = 0;
    let endIndex = -1;
    let foundFirstBrace = false;

    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        brackets++;
        foundFirstBrace = true;
      }
      if (content[i] === '}') {
        brackets--;
      }

      if (foundFirstBrace && brackets === 0) {
        endIndex = i;
        break;
      }
    }

    if (endIndex !== -1) {
      console.log("Stripping function:", fnName);
      content = content.slice(0, startIndex) + content.slice(endIndex + 1);
    }
  } else {
    console.log("Could not find function to strip:", fnName);
  }
}

function stripUseEffect(hookSnippet) {
  const lines = content.split('\\n');
  const index = lines.findIndex(l => l.includes(hookSnippet));
  if (index !== -1) {
    let brackets = 0;
    let endIndex = -1;
    for (let i = index; i < lines.length; i++) {
      if (lines[i].includes('{')) brackets += (lines[i].match(/{/g) || []).length;
      if (lines[i].includes('}')) brackets -= (lines[i].match(/}/g) || []).length;

      if (brackets === 0 && i !== index) {
        endIndex = i;
        if (lines[i + 1] && lines[i + 1].includes('// eslint-disable')) {
          endIndex = i + 2;
          if (lines[i + 2] && lines[i + 2].includes('}, [')) endIndex = i + 2;
        } else if (lines[i + 1] && lines[i + 1].includes('}, [')) {
          endIndex = i + 1;
        }
        break;
      }
    }
    if (endIndex !== -1) {
      console.log("Stripping useEffect starting with:", hookSnippet);
      lines.splice(index, endIndex - index + 1);
      content = lines.join('\\n');
    }
  }
}

const functionsToStrip = [
  "migrateLegacyLocalStorageIfPresent",
  "refreshRecords",
  "refreshDsRecords",
  "refreshPenhorasRecords",
  "toggleQuickTool",
  "toggleQuickToolPinned",
  "bringToolToFront",
  "getToolWindowElement",
  "startToolWindowDrag",
  "evaluateCalculator", // if defined as a func
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
  "startDashboardWidgetResize"
];

functionsToStrip.forEach(stripFunction);

// Strip evaluateCalculator (it's a useCallback)
const evalCalcStart = content.indexOf("const evaluateCalculator = useCallback(() => {");
if (evalCalcStart !== -1) {
  let brackets = 0;
  let endIdx = -1;
  let foundBrace = false;
  for (let i = evalCalcStart; i < content.length; i++) {
    if (content[i] === '{') { brackets++; foundBrace = true; }
    if (content[i] === '}') {
      brackets--;
      if (foundBrace && brackets === 0) {
        const closing = content.indexOf("}, [calculatorExpression])", i - 5);
        if (closing !== -1) {
          endIdx = closing + "}, [calculatorExpression])".length;
          break;
        }
      }
    }
  }
  if (endIdx !== -1) {
    console.log("Stripping evaluateCalculator useCallback");
    content = content.slice(0, evalCalcStart) + content.slice(endIdx);
  }
}


// Strip UseEffects:
stripUseEffect("setBootstrapLoading(true)");
stripUseEffect("document.documentElement.setAttribute('data-theme', theme)");
stripUseEffect("localStorage.setItem('mesa-recibos-layout', layoutMode)");
stripUseEffect("localStorage.setItem('mesa-recibos-quick-notes', quickNotes)");
stripUseEffect("localStorage.setItem('mesa-recibos-smart-notes', smartNotesText)");
stripUseEffect("localStorage.setItem('mesa-recibos-smart-notes-pinned', JSON.stringify(smartNotesPinnedSignatures))");
stripUseEffect("localStorage.setItem('mesa-recibos-smart-notes-saved', JSON.stringify(smartNotesSavedEntries.slice(0, 200)))");
stripUseEffect("localStorage.setItem('mesa-recibos-disabled-saved-views', JSON.stringify(disabledSavedViewIds))");
stripUseEffect("if (activeTab !== 'dashboards' && dashboardFocusMode) {");
stripUseEffect("if (!resizingDashboardWidgetId) return");
stripUseEffect("if (!draggingTool) return");

fs.writeFileSync('src/App.tsx', content);

console.log("Refactoring complete");
