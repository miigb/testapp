import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'

import { jsPDF } from 'jspdf'
import {
  Calculator,
  GripVertical,
  Maximize2,
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
import { applyFormAutoCalculations, parseFormNumber } from './lib/calculations'
import { parseDsWorkbook, parseImportedWorkbook, parsePenhorasWorkbook } from './lib/importParser'
import type {
  AnalyticsSummary,
  CalculationSettings,
  DsEntryForm,
  DsParsedImport,
  DsRecord,
  DsRecordFilters,
  EntryForm,
  ImportPreviewResponse,
  ModuleId,
  PenhorasEntryForm,
  PenhorasParsedImport,
  PenhorasRecord,
  PenhorasRecordFilters,
  ParsedImport,
  ReceiptRecord,
  RecordFilters,
  RecordType,
  StatusDefinition,
  TabId,
  TaxRule,
} from './types'

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

const TABS: { id: TabId; label: string }[] = [
  { id: 'entrada', label: 'Entrada' },
  { id: 'consulta', label: 'Consulta' },
  { id: 'tabela', label: 'Tabela' },
  { id: 'dashboards', label: 'Dashboards' },
  { id: 'configuracao', label: 'Configuração' },
]


const DEFAULT_DASHBOARD_FILTERS: RecordFilters = {
  tipo: 'todos',
  estadoId: 'todos',
  mes: 'todos',
  ano: 'todos',
  exequente: '',
  gestor: '',
  page: 1,
  pageSize: 300,
}



type DashboardWidgetType =
  | 'kpi-registos'
  | 'kpi-valor-sem-iva'
  | 'kpi-iva'
  | 'kpi-retencao'
  | 'kpi-levantado-com-iva'
  | 'chart-status'
  | 'chart-tipo'
  | 'chart-mensal-emissao'
  | 'list-top-gestores'
  | 'list-top-exequentes'

type DashboardWidgetSize = 'kpi' | 'normal' | 'wide'
type DashboardWidgetColumn = 'main' | 'side'

type DashboardWidget = {
  id: string
  type: DashboardWidgetType
  size: DashboardWidgetSize
  minHeight: number
  column: DashboardWidgetColumn
  colSpan: number
}

const DASHBOARD_WIDGET_MIN_COL_SPAN = 1
const DASHBOARD_WIDGET_MAX_COL_SPAN = 3

const DASHBOARD_WIDGET_LIBRARY: Array<{ type: DashboardWidgetType; label: string; hint: string }> = [
  { type: 'kpi-registos', label: 'Total registos', hint: 'KPI' },
  { type: 'kpi-valor-sem-iva', label: 'Total sem IVA', hint: 'KPI' },
  { type: 'kpi-iva', label: 'Total IVA', hint: 'KPI' },
  { type: 'kpi-retencao', label: 'Total retenção', hint: 'KPI' },
  { type: 'kpi-levantado-com-iva', label: 'Levantado c/ IVA', hint: 'KPI' },
  { type: 'chart-status', label: 'Distribuição por estado', hint: 'Gráfico barras' },
  { type: 'chart-tipo', label: 'Distribuição por tipo', hint: 'Gráfico barras' },
  { type: 'chart-mensal-emissao', label: 'Tendência mensal emissão', hint: 'Últimos 12 meses' },
  { type: 'list-top-gestores', label: 'Top gestores', hint: 'Ranking' },
  { type: 'list-top-exequentes', label: 'Top exequentes', hint: 'Ranking' },
]

type DsDashboardWidgetType = 'ds-status' | 'ds-top-gestoras' | 'ds-top-entidades' | 'ds-mensal' | 'ds-recibos'
type PenhorasDashboardWidgetType = 'penhoras-status' | 'penhoras-top-gestores' | 'penhoras-mensal'

type DsDashboardWidget = {
  id: string
  type: DsDashboardWidgetType
  size: DashboardWidgetSize
  minHeight: number
  column: DashboardWidgetColumn
  colSpan: number
}

type PenhorasDashboardWidget = {
  id: string
  type: PenhorasDashboardWidgetType
  size: DashboardWidgetSize
  minHeight: number
  column: DashboardWidgetColumn
  colSpan: number
}





type ThemeId =
  | 'light'
  | 'dark'
  | 'tokyo-day'
  | 'tokyo-night'
  | 'synthwave-84'
  | 'one-dark-pro'
  | 'night-owl'
  | 'atom-one-light'
  | 'github-light'
  | 'github-dark'
  | 'github-gray'
type LayoutMode = 'narrow' | 'wide'
type QuickToolId = 'notes' | 'calculator' | 'smart-notes'
type CalculatorKey = {
  label: string
  value?: string
  action?: 'clear' | 'backspace' | 'equals'
  tone?: 'default' | 'muted' | 'accent'
  wide?: boolean
}
type SmartNotesResultRow = {
  lineNumber: number
  source: string
  expression: string
  result: number
  signature: string
}
type TotalMetricKey =
  | 'registos'
  | 'valorIndicado'
  | 'valorSemIva'
  | 'iva'
  | 'retencao'
  | 'meu5'
  | 'valorEmissao'
  | 'outrasTaxas'
  | 'levantadoComIva'



const CALCULATOR_KEYS: CalculatorKey[] = [
  { label: 'AC', action: 'clear', tone: 'muted' },
  { label: '⌫', action: 'backspace', tone: 'muted' },
  { label: '%', value: '%', tone: 'muted' },
  { label: '÷', value: '/', tone: 'muted' },
  { label: '7', value: '7' },
  { label: '8', value: '8' },
  { label: '9', value: '9' },
  { label: '×', value: '*', tone: 'muted' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
  { label: '6', value: '6' },
  { label: '-', value: '-', tone: 'muted' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '+', value: '+', tone: 'muted' },
  { label: '(', value: '(', tone: 'muted' },
  { label: '0', value: '0' },
  { label: ',', value: ',', tone: 'muted' },
  { label: ')', value: ')', tone: 'muted' },
  { label: '=', action: 'equals', tone: 'accent', wide: true },
]

const SMART_NOTES_NUMBER_FORMATTER = new Intl.NumberFormat('pt-PT', {
  maximumFractionDigits: 6,
})

function formatSmartNotesValue(value: number): string {
  return SMART_NOTES_NUMBER_FORMATTER.format(value)
}


function resolveInitialLayoutMode(): LayoutMode {
  return 'wide'
}


function resolveInitialQuickNotes(): string {
  const stored = localStorage.getItem('mesa-recibos-quick-notes')
  return typeof stored === 'string' ? stored : ''
}







function isDarkLikeTheme(theme: ThemeId): boolean {
  return (
    theme === 'dark' ||
    theme === 'tokyo-night' ||
    theme === 'synthwave-84' ||
    theme === 'one-dark-pro' ||
    theme === 'night-owl' ||
    theme === 'github-dark'
  )
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']



function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function formatCurrency(value?: number): string {
  if (typeof value !== 'number') return '-'
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
}



function getInitialEntryForm(defaultStatusId: string): EntryForm {
  const now = new Date()
  return {
    tipo: 'exequente',
    mes: now.getMonth() + 1,
    ano: now.getFullYear(),
    processo: '',
    pe: '',
    reciboNumero: '',
    dataLevantamento: '',
    dataRecibo: '',
    valorIndicado: '',
    valorSemIva: '',
    iva: '',
    retencao: '',
    valorEmissao: '',
    meu5: '',
    outrasTaxas: '',
    gpeSe: '',
    gestor: '',
    exequente: '',
    descricaoValor: '',
    estadoId: defaultStatusId,
    indicacoes: '',
  }
}

function getInitialDsEntryForm(defaultStatusId: string): DsEntryForm {
  const now = new Date()
  return {
    gestora: '',
    proponentes: '',
    referencia: '',
    produto: '',
    entidadeBancaria: '',
    liderCalculo: '',
    recibo: '',
    faltaReciboGestora: '',
    valor: '',
    dataEscritura: now.toISOString().slice(0, 10),
    dataFechoCrm: '',
    comissaoLoja: '',
    ivaCgdRaw: '',
    totalComissaoLojaCmIva: '',
    comissaoGestor: '',
    percentagem: '',
    pagComissaoGestor: '',
    estadoId: defaultStatusId,
  }
}

function dsFormToPayload(form: DsEntryForm): Partial<DsRecord> {
  return {
    gestora: form.gestora.trim() || undefined,
    proponentes: form.proponentes.trim() || undefined,
    referencia: form.referencia.trim() || undefined,
    produto: form.produto.trim() || undefined,
    entidadeBancaria: form.entidadeBancaria.trim() || undefined,
    liderCalculo: form.liderCalculo.trim() || undefined,
    recibo: form.recibo.trim() || undefined,
    faltaReciboGestora: form.faltaReciboGestora.trim() || undefined,
    valorRaw: form.valor.trim() || undefined,
    valor: parseFormNumber(form.valor),
    dataEscritura: form.dataEscritura || undefined,
    dataFechoCrm: form.dataFechoCrm || undefined,
    comissaoLojaRaw: form.comissaoLoja.trim() || undefined,
    comissaoLoja: parseFormNumber(form.comissaoLoja),
    ivaCgdRaw: form.ivaCgdRaw.trim() || undefined,
    totalComissaoLojaCmIvaRaw: form.totalComissaoLojaCmIva.trim() || undefined,
    totalComissaoLojaCmIva: parseFormNumber(form.totalComissaoLojaCmIva),
    comissaoGestorRaw: form.comissaoGestor.trim() || undefined,
    comissaoGestor: parseFormNumber(form.comissaoGestor),
    percentagemRaw: form.percentagem.trim() || undefined,
    percentagem: parseFormNumber(form.percentagem),
    pagComissaoGestor: form.pagComissaoGestor || undefined,
    estadoId: form.estadoId,
  }
}

function dsRecordToForm(record: DsRecord): DsEntryForm {
  return {
    gestora: record.gestora ?? '',
    proponentes: record.proponentes ?? '',
    referencia: record.referencia ?? '',
    produto: record.produto ?? '',
    entidadeBancaria: record.entidadeBancaria ?? '',
    liderCalculo: record.liderCalculo ?? '',
    recibo: record.recibo ?? '',
    faltaReciboGestora: record.faltaReciboGestora ?? '',
    valor: toFormNumber(record.valor),
    dataEscritura: record.dataEscritura ?? '',
    dataFechoCrm: record.dataFechoCrm ?? '',
    comissaoLoja: toFormNumber(record.comissaoLoja),
    ivaCgdRaw: record.ivaCgdRaw ?? toFormNumber(record.ivaCgdValor),
    totalComissaoLojaCmIva: toFormNumber(record.totalComissaoLojaCmIva),
    comissaoGestor: toFormNumber(record.comissaoGestor),
    percentagem: toFormNumber(record.percentagem),
    pagComissaoGestor: record.pagComissaoGestor ?? '',
    estadoId: record.estadoId,
  }
}

function getInitialPenhorasEntryForm(defaultStatusId: string): PenhorasEntryForm {
  const now = new Date()
  return {
    pe: '',
    acto: '',
    dataPedido: now.toISOString().slice(0, 10),
    identificacao: '',
    pedido: '',
    gestor: '',
    estadoId: defaultStatusId,
  }
}

function penhorasFormToPayload(form: PenhorasEntryForm): Partial<PenhorasRecord> {
  return {
    pe: form.pe.trim() || undefined,
    acto: form.acto.trim() || undefined,
    dataPedido: form.dataPedido || undefined,
    identificacao: form.identificacao.trim() || undefined,
    pedido: form.pedido.trim() || undefined,
    gestor: form.gestor.trim() || undefined,
    estadoId: form.estadoId,
  }
}

function penhorasRecordToForm(record: PenhorasRecord): PenhorasEntryForm {
  return {
    pe: record.pe ?? '',
    acto: record.acto ?? '',
    dataPedido: record.dataPedido ?? '',
    identificacao: record.identificacao ?? '',
    pedido: record.pedido ?? '',
    gestor: record.gestor ?? '',
    estadoId: record.estadoId,
  }
}













function clampDashboardWidgetColSpan(value: number): number {
  if (!Number.isFinite(value)) return DASHBOARD_WIDGET_MIN_COL_SPAN
  return Math.min(DASHBOARD_WIDGET_MAX_COL_SPAN, Math.max(DASHBOARD_WIDGET_MIN_COL_SPAN, Math.round(value)))
}







function extractGpeSeFromIndicacoes(indicacoes?: string): { gpeSe: string; text: string } {
  if (!indicacoes) return { gpeSe: '', text: '' }

  const chunks = indicacoes
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)

  let gpeSe = ''
  const remaining: string[] = []

  for (const chunk of chunks) {
    const match = chunk.match(/^GPESE:\s*(.+)$/i)
    if (match) {
      gpeSe = match[1].trim()
      continue
    }
    remaining.push(chunk)
  }

  return { gpeSe, text: remaining.join(' | ') }
}

function composeIndicacoes(gpeSe: string, indicacoes: string): string | undefined {
  const chunks: string[] = []
  const parsedGpeSe = parseFormNumber(gpeSe)
  const trimmedGpeSe = typeof parsedGpeSe === 'number' ? toFormNumber(parsedGpeSe) : gpeSe.trim()
  const trimmedIndicacoes = indicacoes.trim()

  if (trimmedGpeSe) {
    chunks.push(`GPESE: ${trimmedGpeSe}`)
  }
  if (trimmedIndicacoes) {
    chunks.push(trimmedIndicacoes)
  }

  return chunks.length > 0 ? chunks.join(' | ') : undefined
}


function formToPayload(form: EntryForm): Partial<ReceiptRecord> & { tipo: RecordType; mes: number; ano: number } {
  return {
    tipo: form.tipo,
    mes: form.mes,
    ano: form.ano,
    processo: form.processo.trim() || undefined,
    pe: form.pe.trim() || undefined,
    reciboNumero: form.reciboNumero.trim() || undefined,
    dataLevantamento: form.dataLevantamento || undefined,
    dataRecibo: form.dataRecibo || undefined,
    valorIndicado: parseFormNumber(form.valorIndicado),
    valorSemIva: parseFormNumber(form.valorSemIva),
    iva: parseFormNumber(form.iva),
    retencao: parseFormNumber(form.retencao),
    valorEmissao: parseFormNumber(form.valorEmissao),
    meu5: parseFormNumber(form.meu5),
    outrasTaxas: parseFormNumber(form.outrasTaxas),
    gestor: form.gestor.trim() || undefined,
    exequente: form.exequente.trim() || undefined,
    descricaoValor: form.descricaoValor.trim() || undefined,
    estadoId: form.estadoId,
    indicacoes: composeIndicacoes(form.gpeSe, form.indicacoes),
  }
}

function toFormNumber(value?: number): string {
  if (typeof value !== 'number') return ''
  return value.toFixed(2).replace('.', ',')
}

function recordToForm(record: ReceiptRecord): EntryForm {
  const parsedIndicacoes = extractGpeSeFromIndicacoes(record.indicacoes)
  const parsedGpeSe = parseFormNumber(parsedIndicacoes.gpeSe)
  return {
    tipo: record.tipo,
    mes: record.mes,
    ano: record.ano,
    processo: record.processo ?? '',
    pe: record.pe ?? '',
    reciboNumero: record.reciboNumero ?? '',
    dataLevantamento: record.dataLevantamento ?? '',
    dataRecibo: record.dataRecibo ?? '',
    valorIndicado: toFormNumber(record.valorIndicado),
    valorSemIva: toFormNumber(record.valorSemIva),
    iva: toFormNumber(record.iva),
    retencao: toFormNumber(record.retencao),
    valorEmissao: toFormNumber(record.valorEmissao),
    meu5: toFormNumber(record.meu5),
    outrasTaxas: toFormNumber(record.outrasTaxas),
    gpeSe: typeof parsedGpeSe === 'number' ? toFormNumber(parsedGpeSe) : parsedIndicacoes.gpeSe,
    gestor: record.gestor ?? '',
    exequente: record.exequente ?? '',
    descricaoValor: record.descricaoValor ?? '',
    estadoId: record.estadoId,
    indicacoes: parsedIndicacoes.text,
  }
}

function recordToPatchPayload(record: ReceiptRecord): Partial<ReceiptRecord> {
  return {
    tipo: record.tipo,
    mes: record.mes,
    ano: record.ano,
    processo: record.processo,
    pe: record.pe,
    reciboNumero: record.reciboNumero,
    dataLevantamento: record.dataLevantamento,
    dataRecibo: record.dataRecibo,
    valorIndicado: record.valorIndicado,
    valorSemIva: record.valorSemIva,
    iva: record.iva,
    retencao: record.retencao,
    valorEmissao: record.valorEmissao,
    meu5: record.meu5,
    outrasTaxas: record.outrasTaxas,
    gestor: record.gestor,
    exequente: record.exequente,
    descricaoValor: record.descricaoValor,
    estadoId: record.estadoId,
    indicacoes: record.indicacoes,
    sourceColor: record.sourceColor,
    sourceSheet: record.sourceSheet,
  }
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
  const [dsEntryForm, setDsEntryForm] = useState<DsEntryForm>(getInitialDsEntryForm(''))

  const [penhorasImportLoading, setPenhorasImportLoading] = useState(false)
  const [penhorasImportPreview, setPenhorasImportPreview] = useState<PenhorasParsedImport | null>(null)
  const [penhorasImportServerPreview, setPenhorasImportServerPreview] = useState<ImportPreviewResponse | null>(null)
  const [penhorasImportStrategy, setPenhorasImportStrategy] = useState<'skip' | 'update' | 'duplicate'>('update')
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

  async function refreshDashboardSummary() {
    setDashboardLoading(true)
    try {
      const summary = await api.getAnalyticsSummary({
        ...dashboardFilters,
        q: globalSearch,
      })
      setDashboardSummary(summary)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao carregar métricas do dashboard.')
    } finally {
      setDashboardLoading(false)
    }
  }

  function dismissFeedback() {
    if (!feedback) return
    setFeedbackClosing(true)
  }

  function patchDsFilters<K extends keyof DsRecordFilters>(key: K, value: DsRecordFilters[K]) {
    setActiveDsSavedViewId(null)
    setDsFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }

  function patchPenhorasFilters<K extends keyof PenhorasRecordFilters>(key: K, value: PenhorasRecordFilters[K]) {
    setActivePenhorasSavedViewId(null)
    setPenhorasFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }

  async function saveDashboard(options?: { asNew?: boolean }) {
    const trimmedName = dashboardName.trim() || 'Dashboard'

    try {
      if (options?.asNew || !activeDashboardId) {
        const created = await api.createSavedView({
          name: trimmedName,
          scope: 'dashboard',
          filters: dashboardSavePayload as Record<string, unknown>,
        })
        setSavedViews((current) => [created, ...current])
        setActiveDashboardId(created.id)
        setDashboardName(created.name)
        setFeedback('Dashboard guardado.')
        return
      }

      const updated = await api.updateSavedView(activeDashboardId, {
        name: trimmedName,
        filters: dashboardSavePayload as Record<string, unknown>,
      })
      setSavedViews((current) => current.map((view) => (view.id === updated.id ? updated : view)))
      setFeedback('Dashboard atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar dashboard.')
    }
  }

  async function deleteDashboard() {
    if (!activeDashboardId) return
    const confirmed = window.confirm('Eliminar este dashboard?')
    if (!confirmed) return

    try {
      await api.deleteSavedView(activeDashboardId)
      setSavedViews((current) => current.filter((view) => view.id !== activeDashboardId))
      resetDashboardDraft()
      setFeedback('Dashboard eliminado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao eliminar dashboard.')
    }
  }

  function patchFilters<K extends keyof RecordFilters>(key: K, value: RecordFilters[K]) {
    setActiveSavedViewId(null)
    setFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }

  function patchDashboardFilters<K extends keyof RecordFilters>(key: K, value: RecordFilters[K]) {
    setDashboardFilters((current) => ({ ...current, [key]: value, page: 1 }))
  }

  function resetDashboardDraft() {
    setActiveDashboardId(null)
    setDashboardName('Dashboard')
    setDashboardFilters(DEFAULT_DASHBOARD_FILTERS)
    setDashboardWidgets([])
    setDashboardConfigOpen(true)
  }

  function handleEntryInput<K extends keyof EntryForm>(key: K, value: EntryForm[K]) {
    setEntryForm((current) => {
      const next = { ...current, [key]: value }
      if (['valorIndicado', 'valorSemIva', 'valorEmissao'].includes(String(key))) {
        return applyFormAutoCalculations(next, calculationSettings, key === 'valorIndicado')
      }
      return next
    })
  }

  function handleRecordEditInput<K extends keyof EntryForm>(key: K, value: EntryForm[K]) {
    setSelectedRecordEdit((current) => {
      if (!current) return current
      const next = { ...current, [key]: value }
      if (['valorIndicado', 'valorSemIva', 'valorEmissao'].includes(String(key))) {
        return applyFormAutoCalculations(next, calculationSettings, key === 'valorIndicado')
      }
      return next
    })
  }

  function handleDsEntryInput<K extends keyof DsEntryForm>(key: K, value: DsEntryForm[K]) {
    setDsEntryForm((current) => ({ ...current, [key]: value }))
  }

  function handleDsRecordEditInput<K extends keyof DsEntryForm>(key: K, value: DsEntryForm[K]) {
    setSelectedDsRecordEdit((current) => {
      if (!current) return current
      return { ...current, [key]: value }
    })
  }

  function handlePenhorasEntryInput<K extends keyof PenhorasEntryForm>(key: K, value: PenhorasEntryForm[K]) {
    setPenhorasEntryForm((current) => ({ ...current, [key]: value }))
  }

  function handlePenhorasRecordEditInput<K extends keyof PenhorasEntryForm>(key: K, value: PenhorasEntryForm[K]) {
    setSelectedPenhorasRecordEdit((current) => {
      if (!current) return current
      return { ...current, [key]: value }
    })
  }

  async function submitEntry(event: FormEvent<HTMLFormElement>, saveMode: 'save' | 'saveNew') {
    event.preventDefault()

    if (!entryForm.pe.trim() && !entryForm.processo.trim() && !entryForm.reciboNumero.trim()) {
      setFeedback('Preencha pelo menos Processo, PE ou N.º de recibo.')
      return
    }

    try {
      const created = await api.createRecord(formToPayload(entryForm))
      setFeedback('Registo guardado com sucesso.')
      if (saveMode === 'saveNew' && defaultStatus) {
        setEntryForm(getInitialEntryForm(defaultStatus.id))
      }
      await refreshRecords()
      setSelectedRecordId(created.id)
      setActiveTab('consulta')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar registo.')
    }
  }

  async function saveNewEntry() {
    const fakeEvent = { preventDefault: () => undefined } as FormEvent<HTMLFormElement>
    await submitEntry(fakeEvent, 'saveNew')
  }

  async function submitDsEntry(event: FormEvent<HTMLFormElement>, saveMode: 'save' | 'saveNew') {
    event.preventDefault()

    const payload = dsFormToPayload(dsEntryForm)
    const hasMinimumData = Boolean(
      payload.gestora ||
      payload.proponentes ||
      payload.referencia ||
      payload.produto ||
      payload.entidadeBancaria ||
      payload.recibo ||
      payload.valorRaw ||
      payload.comissaoLojaRaw ||
      payload.totalComissaoLojaCmIvaRaw,
    )

    if (!hasMinimumData) {
      setFeedback('Preencha pelo menos Gestora, Proponentes, Referência, Produto, Entidade, Recibo ou valores.')
      return
    }

    try {
      await api.createDsRecord(payload)
      setFeedback('Registo DS guardado com sucesso.')
      if (saveMode === 'saveNew' && dsDefaultStatus) {
        setDsEntryForm(getInitialDsEntryForm(dsDefaultStatus.id))
      } else {
        setActiveTab('consulta')
      }
      await refreshDsRecords()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar registo DS.')
    }
  }

  async function saveNewDsEntry() {
    const fakeEvent = { preventDefault: () => undefined } as FormEvent<HTMLFormElement>
    await submitDsEntry(fakeEvent, 'saveNew')
  }

  async function submitPenhorasEntry(event: FormEvent<HTMLFormElement>, saveMode: 'save' | 'saveNew') {
    event.preventDefault()

    const payload = penhorasFormToPayload(penhorasEntryForm)
    const hasMinimumData = Boolean(payload.pe || payload.acto || payload.identificacao || payload.pedido || payload.gestor || payload.dataPedido)

    if (!hasMinimumData) {
      setFeedback('Preencha pelo menos PE, Acto, Identificação, Pedido, Gestor ou Data pedido.')
      return
    }

    try {
      await api.createPenhorasRecord(payload)
      setFeedback('Registo Penhoras guardado com sucesso.')
      if (saveMode === 'saveNew' && penhorasDefaultStatus) {
        setPenhorasEntryForm(getInitialPenhorasEntryForm(penhorasDefaultStatus.id))
      } else {
        setActiveTab('consulta')
      }
      await refreshPenhorasRecords()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar registo Penhoras.')
    }
  }

  async function saveNewPenhorasEntry() {
    const fakeEvent = { preventDefault: () => undefined } as FormEvent<HTMLFormElement>
    await submitPenhorasEntry(fakeEvent, 'saveNew')
  }

  async function updateRecordStatus(
    recordId: string,
    statusId: string,
    options?: {
      registerUndo?: boolean
    },
  ) {
    const registerUndo = options?.registerUndo ?? true
    const previous = records.find((record) => record.id === recordId)
    if (previous && previous.estadoId === statusId) return

    try {
      await api.updateRecordStatus(recordId, statusId)
      if (registerUndo && previous) {
        pushUndo({
          label: `estado de ${previous.pe || previous.processo || previous.reciboNumero || 'registo'}`, run: async () => {
            await updateRecordStatus(recordId, previous.estadoId, { registerUndo: false })
          }
        })
      }
      await refreshRecords()
      if (selectedRecordId === recordId) {
        setSelectedRecordId(recordId)
      }
      setFeedback('Estado atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar estado.')
    }
  }

  async function updateDsRecordStatus(recordId: string, statusId: string) {
    const previous = dsRecords.find((record) => record.id === recordId)
    if (previous && previous.estadoId === statusId) return

    try {
      await api.updateDsRecordStatus(recordId, statusId)
      await refreshDsRecords()
      setFeedback('Estado DS atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar estado DS.')
    }
  }

  async function updatePenhorasRecordStatus(recordId: string, statusId: string) {
    const previous = penhorasRecords.find((record) => record.id === recordId)
    if (previous && previous.estadoId === statusId) return

    try {
      await api.updatePenhorasRecordStatus(recordId, statusId)
      await refreshPenhorasRecords()
      setFeedback('Estado Penhoras atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar estado Penhoras.')
    }
  }

  async function runBulkStatusUpdate() {
    if (!bulkStatusId || selectedIds.length === 0) {
      return
    }

    try {
      const before = records
        .filter((record) => selectedIds.includes(record.id))
        .map((record) => ({ id: record.id, estadoId: record.estadoId }))
      const result = await api.bulkStatus(selectedIds, bulkStatusId)
      if (before.length > 0) {
        pushUndo({
          label: 'alteração de estado em lote', run: async () => {
            await Promise.all(before.map((item) => api.updateRecordStatus(item.id, item.estadoId)))
          }
        })
      }
      setFeedback(`Atualização em lote concluída: ${result.updated} registos.`)
      setSelectedIds([])
      await refreshRecords()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha na atualização em lote.')
    }
  }

  async function runBulkFieldUpdate() {
    if (selectedIds.length === 0) return

    const patch: Partial<ReceiptRecord> = {}
    if (bulkGestor.trim()) patch.gestor = bulkGestor.trim()
    if (bulkExequente.trim()) patch.exequente = bulkExequente.trim()
    if (bulkIndicacoes.trim()) patch.indicacoes = bulkIndicacoes.trim()

    if (Object.keys(patch).length === 0 && !bulkForceRecalculate) {
      setFeedback('Defina pelo menos um campo para atualizar em lote ou ative recálculo fiscal.')
      return
    }

    const before = records.filter((record) => selectedIds.includes(record.id))

    try {
      const result = await api.bulkUpdate(selectedIds, patch, { forceRecalculate: bulkForceRecalculate })
      if (before.length > 0) {
        pushUndo({
          label: 'edição em lote', run: async () => {
            await Promise.all(before.map((record) => api.patchRecord(record.id, recordToPatchPayload(record))))
          }
        })
      }
      setFeedback(`Edição em lote concluída: ${result.updated} registos.`)
      setSelectedIds([])
      await refreshRecords()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha na edição em lote.')
    }
  }

  async function saveSelectedRecordEdits() {
    if (!selectedRecord || !selectedRecordEdit) return

    const previous = selectedRecord

    try {
      await api.patchRecord(selectedRecord.id, formToPayload(selectedRecordEdit))
      pushUndo({
        label: `edição de ${previous.pe || previous.processo || previous.reciboNumero || 'registo'}`, run: async () => {
          await api.patchRecord(previous.id, recordToPatchPayload(previous))
        }
      })
      setIsRecordEditing(false)
      await refreshRecords()
      setSelectedRecordId(previous.id)
      setFeedback('Registo atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar registo.')
    }
  }

  async function saveSelectedDsRecordEdits() {
    if (!selectedDsRecord || !selectedDsRecordEdit) return

    try {
      await api.patchDsRecord(selectedDsRecord.id, dsFormToPayload(selectedDsRecordEdit))
      setIsDsRecordEditing(false)
      await refreshDsRecords()
      setSelectedDsRecordId(selectedDsRecord.id)
      setFeedback('Registo DS atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar registo DS.')
    }
  }

  async function saveSelectedPenhorasRecordEdits() {
    if (!selectedPenhorasRecord || !selectedPenhorasRecordEdit) return

    try {
      await api.patchPenhorasRecord(selectedPenhorasRecord.id, penhorasFormToPayload(selectedPenhorasRecordEdit))
      setIsPenhorasRecordEditing(false)
      await refreshPenhorasRecords()
      setSelectedPenhorasRecordId(selectedPenhorasRecord.id)
      setFeedback('Registo Penhoras atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar registo Penhoras.')
    }
  }

  function toggleSelectRecord(recordId: string) {
    setSelectedIds((current) => (current.includes(recordId) ? current.filter((id) => id !== recordId) : [...current, recordId]))
  }

  function toggleSelectAllRecords() {
    if (allSelectedInTable) {
      setSelectedIds([])
      return
    }
    setSelectedIds(records.map((record) => record.id))
  }

  async function exportCurrentSnapshot() {
    try {
      const snapshot = await api.exportRecordsSnapshot()
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `mesa-recibos-snapshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
      link.click()
      URL.revokeObjectURL(link.href)
      setFeedback('Snapshot atual exportado com sucesso.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao exportar snapshot.')
    }
  }

  function buildQuickNotesFileName(extension: 'txt' | 'pdf'): string {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    return `mesa-recibos-notas-${stamp}.${extension}`
  }

  function buildSmartNotesFileName(extension: 'txt' | 'pdf'): string {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    return `mesa-recibos-notas-calculo-${stamp}.${extension}`
  }

  function buildSmartNotesExportText(): string {
    const content = smartNotesText.trim()
    if (!content) return ''

    const sections = [
      'Notas com cálculo',
      `Exportado: ${new Date().toLocaleString('pt-PT')}`,
      '',
      content,
    ]

    if (smartNotesResults.length > 0) {
      sections.push('', 'Resultados', ...smartNotesResults.map((row) => `L${row.lineNumber}: ${row.expression} = ${formatSmartNotesValue(row.result)}`))
    }

    if (smartNotesErrors.length > 0) {
      sections.push('', 'Linhas com erro', ...smartNotesErrors.map((row) => `L${row.lineNumber}: ${row.error}`))
    }

    return sections.join('\n')
  }

  function removeSmartNotesLine(lineNumber: number) {
    setSmartNotesText((current) => {
      const lines = current.split('\n')
      if (lineNumber < 1 || lineNumber > lines.length) return current
      lines.splice(lineNumber - 1, 1)
      return lines.join('\n')
    })
  }

  function toggleSmartNotesPinned(signature: string) {
    setSmartNotesPinnedSignatures((current) => {
      if (current.includes(signature)) {
        return current.filter((value) => value !== signature)
      }
      return [signature, ...current].slice(0, 200)
    })
  }

  function toggleSmartNotesSaved(row: SmartNotesResultRow) {
    setSmartNotesSavedEntries((current) => {
      const alreadySaved = current.some((entry) => entry.signature === row.signature)
      if (alreadySaved) {
        return current.filter((entry) => entry.signature !== row.signature)
      }
      return [
        {
          signature: row.signature,
          expression: row.expression,
          result: row.result,
          source: row.source,
          savedAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 200)
    })
  }

  function exportQuickNotesTxt() {
    const content = quickNotes.trim()
    if (!content) {
      setFeedback('Sem notas para exportar.')
      return
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = buildQuickNotesFileName('txt')
    link.click()
    URL.revokeObjectURL(link.href)
    setFeedback('Notas exportadas em TXT.')
  }

  function exportQuickNotesPdf() {
    const content = quickNotes.trim()
    if (!content) {
      setFeedback('Sem notas para exportar.')
      return
    }

    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 44
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Notas rápidas', margin, 42)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(new Date().toLocaleString('pt-PT'), margin, 58)

      doc.setFontSize(12)
      const lines = doc.splitTextToSize(content, pageWidth - margin * 2)
      let y = 86

      for (const line of lines) {
        if (y > pageHeight - margin) {
          doc.addPage()
          y = margin
        }
        doc.text(line, margin, y)
        y += 16
      }

      doc.save(buildQuickNotesFileName('pdf'))
      setFeedback('Notas exportadas em PDF.')
    } catch {
      setFeedback('Falha ao exportar notas em PDF.')
    }
  }

  function exportSmartNotesTxt() {
    const content = buildSmartNotesExportText()
    if (!content) {
      setFeedback('Sem notas com cálculo para exportar.')
      return
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = buildSmartNotesFileName('txt')
    link.click()
    URL.revokeObjectURL(link.href)
    setFeedback('Notas com cálculo exportadas em TXT.')
  }

  function exportSmartNotesPdf() {
    const content = buildSmartNotesExportText()
    if (!content) {
      setFeedback('Sem notas com cálculo para exportar.')
      return
    }

    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 44
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Notas com cálculo', margin, 42)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(new Date().toLocaleString('pt-PT'), margin, 58)

      doc.setFontSize(12)
      const lines = doc.splitTextToSize(content, pageWidth - margin * 2)
      let y = 86

      for (const line of lines) {
        if (y > pageHeight - margin) {
          doc.addPage()
          y = margin
        }
        doc.text(line, margin, y)
        y += 16
      }

      doc.save(buildSmartNotesFileName('pdf'))
      setFeedback('Notas com cálculo exportadas em PDF.')
    } catch {
      setFeedback('Falha ao exportar notas com cálculo em PDF.')
    }
  }

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

  function updateSettingsDraft(patch: Partial<CalculationSettings>) {
    setSettingsDraft((current) => ({ ...current, ...patch }))
  }

  function updateTaxRule(ruleId: string, patch: Partial<TaxRule>) {
    setSettingsDraft((current) => ({
      ...current,
      taxRules: current.taxRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
    }))
  }

  async function saveCalculationSettings() {
    try {
      const updated = await api.updateCalculationSettings(settingsDraft)
      setCalculationSettings(updated)
      setSettingsDraft(updated)
      setFeedback('Configuração de cálculos guardada.')
      setEntryForm((current) => applyFormAutoCalculations(current, updated))
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar configurações.')
    }
  }

  async function saveStatuses() {
    try {
      for (const status of statuses) {
        await api.updateStatus(status.id, {
          key: status.key,
          label: status.label,
          icon: status.icon,
          color: status.color,
          active: status.active,
          order: status.order,
        })
      }
      setFeedback('Estados atualizados.')
      const refreshedStatuses = await api.getStatuses()
      setStatuses(refreshedStatuses)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar estados.')
    }
  }

  async function saveDsStatuses() {
    try {
      for (const status of dsStatuses) {
        await api.updateDsStatus(status.id, {
          key: status.key,
          label: status.label,
          icon: status.icon,
          color: status.color,
          active: status.active,
          order: status.order,
        })
      }
      setFeedback('Estados DS atualizados.')
      const refreshedStatuses = await api.getDsStatuses()
      setDsStatuses(refreshedStatuses)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar estados DS.')
    }
  }

  async function savePenhorasStatuses() {
    try {
      for (const status of penhorasStatuses) {
        await api.updatePenhorasStatus(status.id, {
          key: status.key,
          label: status.label,
          icon: status.icon,
          color: status.color,
          active: status.active,
          order: status.order,
        })
      }
      setFeedback('Estados Penhoras atualizados.')
      const refreshedStatuses = await api.getPenhorasStatuses()
      setPenhorasStatuses(refreshedStatuses)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar estados Penhoras.')
    }
  }

  async function addStatus() {
    try {
      const created = await api.createStatus({
        key: `custom-${crypto.randomUUID().slice(0, 8)}`,
        label: 'Novo estado',
        icon: 'circle',
        color: '#D9E2EC',
        active: true,
        order: statuses.length + 1,
      })
      setStatuses((current) => [...current, created])
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao criar estado.')
    }
  }

  async function addDsStatus() {
    try {
      const created = await api.createDsStatus({
        key: `ds-custom-${crypto.randomUUID().slice(0, 8)}`,
        label: 'Novo estado DS',
        icon: 'circle',
        color: '#D9E2EC',
        active: true,
        order: dsStatuses.length + 1,
      })
      setDsStatuses((current) => [...current, created])
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao criar estado DS.')
    }
  }

  async function addPenhorasStatus() {
    try {
      const created = await api.createPenhorasStatus({
        key: `penhoras-custom-${crypto.randomUUID().slice(0, 8)}`,
        label: 'Novo estado Penhoras',
        icon: 'circle',
        color: '#D9E2EC',
        active: true,
        order: penhorasStatuses.length + 1,
      })
      setPenhorasStatuses((current) => [...current, created])
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao criar estado Penhoras.')
    }
  }

  async function removeStatus(statusId: string) {
    try {
      await api.deleteStatus(statusId)
      setStatuses((current) => current.filter((status) => status.id !== statusId))
      setFeedback('Estado removido.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao remover estado.'
      if (message.includes('Estado em uso')) {
        const fallbackStatus = orderedStatuses.find((status) => status.id !== statusId && status.active) ?? orderedStatuses.find((status) => status.id !== statusId)
        if (!fallbackStatus) {
          setFeedback('Não existe estado alternativo para reatribuição dos registos.')
          return
        }

        const confirmed = window.confirm(
          `Este estado está em uso. Pretende reatribuir os registos para "${fallbackStatus.label}" e remover mesmo assim?`,
        )
        if (!confirmed) {
          return
        }

        try {
          await api.deleteStatus(statusId, { reassignToStatusId: fallbackStatus.id })
          const refreshedStatuses = await api.getStatuses()
          setStatuses(refreshedStatuses)
          await refreshRecords()
          setFeedback(`Estado removido e registos reatribuídos para "${fallbackStatus.label}".`)
          return
        } catch (reassignError) {
          setFeedback(reassignError instanceof Error ? reassignError.message : 'Falha ao remover estado com reatribuição.')
          return
        }
      }
      setFeedback(message)
    }
  }

  async function removeDsStatus(statusId: string) {
    try {
      await api.deleteDsStatus(statusId)
      setDsStatuses((current) => current.filter((status) => status.id !== statusId))
      setFeedback('Estado DS removido.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao remover estado DS.'
      if (message.includes('Estado DS em uso')) {
        const fallbackStatus =
          dsOrderedStatuses.find((status) => status.id !== statusId && status.active) ??
          dsOrderedStatuses.find((status) => status.id !== statusId)
        if (!fallbackStatus) {
          setFeedback('Não existe estado DS alternativo para reatribuição.')
          return
        }
        const confirmed = window.confirm(
          `Este estado DS está em uso. Pretende reatribuir os registos para "${fallbackStatus.label}" e remover mesmo assim?`,
        )
        if (!confirmed) return
        try {
          await api.deleteDsStatus(statusId, { reassignToStatusId: fallbackStatus.id })
          const refreshedStatuses = await api.getDsStatuses()
          setDsStatuses(refreshedStatuses)
          await refreshDsRecords()
          setFeedback(`Estado DS removido e registos reatribuídos para "${fallbackStatus.label}".`)
          return
        } catch (reassignError) {
          setFeedback(reassignError instanceof Error ? reassignError.message : 'Falha ao remover estado DS com reatribuição.')
          return
        }
      }
      setFeedback(message)
    }
  }

  async function removePenhorasStatus(statusId: string) {
    try {
      await api.deletePenhorasStatus(statusId)
      setPenhorasStatuses((current) => current.filter((status) => status.id !== statusId))
      setFeedback('Estado Penhoras removido.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao remover estado Penhoras.'
      if (message.includes('Estado Penhoras em uso')) {
        const fallbackStatus =
          penhorasOrderedStatuses.find((status) => status.id !== statusId && status.active) ??
          penhorasOrderedStatuses.find((status) => status.id !== statusId)
        if (!fallbackStatus) {
          setFeedback('Não existe estado Penhoras alternativo para reatribuição.')
          return
        }
        const confirmed = window.confirm(
          `Este estado Penhoras está em uso. Pretende reatribuir os registos para "${fallbackStatus.label}" e remover mesmo assim?`,
        )
        if (!confirmed) return
        try {
          await api.deletePenhorasStatus(statusId, { reassignToStatusId: fallbackStatus.id })
          const refreshedStatuses = await api.getPenhorasStatuses()
          setPenhorasStatuses(refreshedStatuses)
          await refreshPenhorasRecords()
          setFeedback(`Estado Penhoras removido e registos reatribuídos para "${fallbackStatus.label}".`)
          return
        } catch (reassignError) {
          setFeedback(reassignError instanceof Error ? reassignError.message : 'Falha ao remover estado Penhoras com reatribuição.')
          return
        }
      }
      setFeedback(message)
    }
  }

  function toggleTotalMetric(metric: TotalMetricKey) {
    setSelectedTotalMetrics((current) => {
      if (current.includes(metric)) {
        if (current.length === 1) return current
        return current.filter((item) => item !== metric)
      }
      return [...current, metric]
    })
  }

  function updateStatusLocal(statusId: string, patch: Partial<StatusDefinition>) {
    setStatuses((current) => current.map((status) => (status.id === statusId ? { ...status, ...patch } : status)))
  }

  function updateDsStatusLocal(statusId: string, patch: Partial<StatusDefinition>) {
    setDsStatuses((current) => current.map((status) => (status.id === statusId ? { ...status, ...patch } : status)))
  }

  function updatePenhorasStatusLocal(statusId: string, patch: Partial<StatusDefinition>) {
    setPenhorasStatuses((current) => current.map((status) => (status.id === statusId ? { ...status, ...patch } : status)))
  }

  function renderDashboardKpi(label: string, value: number, currency = false) {
    return (
      <div className="dashboard-kpi">
        <span>{label}</span>
        <strong>{currency ? formatCurrency(value) : new Intl.NumberFormat('pt-PT').format(value)}</strong>
      </div>
    )
  }

  function renderDashboardBars(
    rows: Array<{ id: string; label: string; value: number; secondary?: string }>,
    options?: { currency?: boolean },
  ) {
    if (rows.length === 0) {
      return <div className="empty-text">Sem dados para este widget.</div>
    }

    const maxValue = Math.max(...rows.map((row) => row.value), 1)

    return (
      <div className="dashboard-bars">
        {rows.map((row) => {
          const width = `${Math.max(4, (row.value / maxValue) * 100)}%`
          return (
            <div key={row.id} className="dashboard-bar-row">
              <div className="dashboard-bar-meta">
                <span>{row.label}</span>
                <strong>
                  {options?.currency ? formatCurrency(row.value) : new Intl.NumberFormat('pt-PT').format(row.value)}
                </strong>
              </div>
              <div className="dashboard-bar-track">
                <div className="dashboard-bar-fill" style={{ width }} />
              </div>
              {row.secondary ? <span className="muted dashboard-bar-secondary">{row.secondary}</span> : null}
            </div>
          )
        })}
      </div>
    )
  }

  function renderDashboardWidget(widget: DashboardWidget) {
    const effectiveColSpan = widget.column === 'side' ? 1 : clampDashboardWidgetColSpan(widget.colSpan || 1)
    const canShrinkWidth = widget.column !== 'side' && effectiveColSpan > DASHBOARD_WIDGET_MIN_COL_SPAN
    const canGrowWidth = widget.column !== 'side' && effectiveColSpan < DASHBOARD_WIDGET_MAX_COL_SPAN

    if (!dashboardSummary) {
      return (
        <article key={widget.id} className={`dashboard-widget-card span-${effectiveColSpan}`}>
          <div className="small-note">A carregar dados…</div>
        </article>
      )
    }

    const headerLabel = DASHBOARD_WIDGET_LIBRARY.find((item) => item.type === widget.type)?.label ?? 'Widget'

    let content: ReactNode
    if (widget.type === 'kpi-registos') {
      content = renderDashboardKpi('Total de registos', dashboardSummary.totals.registos)
    } else if (widget.type === 'kpi-valor-sem-iva') {
      content = renderDashboardKpi('Valor sem IVA', dashboardSummary.totals.valorSemIva, true)
    } else if (widget.type === 'kpi-iva') {
      content = renderDashboardKpi('IVA', dashboardSummary.totals.iva, true)
    } else if (widget.type === 'kpi-retencao') {
      content = renderDashboardKpi('Retenção', dashboardSummary.totals.retencao, true)
    } else if (widget.type === 'kpi-levantado-com-iva') {
      content = renderDashboardKpi('Levantado com IVA', dashboardSummary.totals.levantadoComIva, true)
    } else if (widget.type === 'chart-status') {
      content = renderDashboardBars(
        dashboardSummary.byStatus.map((item) => ({
          id: item.statusId,
          label: item.statusLabel,
          value: item.count,
          secondary: formatCurrency(item.valorEmissao),
        })),
      )
    } else if (widget.type === 'chart-tipo') {
      content = renderDashboardBars(
        dashboardSummary.byType.map((item) => ({
          id: item.tipo,
          label: item.tipo === 'exequente' ? 'Exequente' : 'Executado',
          value: item.count,
          secondary: formatCurrency(item.valorEmissao),
        })),
      )
    } else if (widget.type === 'chart-mensal-emissao') {
      const monthlyRows = dashboardSummary.byMonth
        .slice(-12)
        .map((item) => ({
          id: `${item.ano}-${item.mes}`,
          label: `${MONTHS[item.mes - 1]?.slice(0, 3) ?? item.mes}/${item.ano}`,
          value: item.valorEmissao,
          secondary: `${new Intl.NumberFormat('pt-PT').format(item.count)} registos`,
        }))
      content = renderDashboardBars(monthlyRows, { currency: true })
    } else if (widget.type === 'list-top-gestores') {
      content = renderDashboardBars(
        dashboardSummary.topGestores.map((item) => ({
          id: item.name,
          label: item.name,
          value: item.count,
          secondary: formatCurrency(item.valorEmissao),
        })),
      )
    } else {
      content = renderDashboardBars(
        dashboardSummary.topExequentes.map((item) => ({
          id: item.name,
          label: item.name,
          value: item.count,
          secondary: formatCurrency(item.valorEmissao),
        })),
      )
    }

    return (
      <article
        key={widget.id}
        className={`dashboard-widget-card size-${widget.size} span-${effectiveColSpan} ${draggedDashboardWidgetId === widget.id ? 'dragging' : ''} ${dropDashboardWidgetId === widget.id ? 'drop-target' : ''
          } ${resizingDashboardWidgetId === widget.id ? 'resizing' : ''}`}
        style={{ minHeight: `${widget.minHeight}px` }}
        draggable={!resizingDashboardWidgetId}
        onDragStart={(event) => {
          if (resizingDashboardWidgetId) {
            event.preventDefault()
            return
          }
          setDraggedDashboardWidgetId(widget.id)
          setDropDashboardWidgetId(widget.id)
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', widget.id)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (dropDashboardWidgetId !== widget.id) {
            setDropDashboardWidgetId(widget.id)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          const sourceWidgetId = event.dataTransfer.getData('text/plain') || draggedDashboardWidgetId
          if (sourceWidgetId) {
            reorderDashboardWidgets(sourceWidgetId, widget.id)
          }
          setDraggedDashboardWidgetId(null)
          setDropDashboardWidgetId(null)
        }}
        onDragEnd={() => {
          setDraggedDashboardWidgetId(null)
          setDropDashboardWidgetId(null)
        }}
      >
        <div className="dashboard-widget-head">
          <h4>{headerLabel}</h4>
          <div className="dashboard-widget-actions">
            <button className="subtle-btn icon-btn micro drag-handle-btn" type="button" title="Arrastar widget">
              <GripVertical size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title={widget.column === 'side' ? 'Mover para coluna principal' : 'Mover para coluna lateral'}
              onClick={() => toggleDashboardWidgetColumn(widget.id)}
            >
              {widget.column === 'side' ? '↤' : '↦'}
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title={widget.column === 'side' ? 'Mova para a coluna principal para ajustar largura' : 'Diminuir largura'}
              onClick={() => adjustDashboardWidgetWidth(widget.id, -1)}
              disabled={!canShrinkWidth}
            >
              <Minimize2 size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title={widget.column === 'side' ? 'Mova para a coluna principal para ajustar largura' : 'Aumentar largura'}
              onClick={() => adjustDashboardWidgetWidth(widget.id, 1)}
              disabled={!canGrowWidth}
            >
              <Maximize2 size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title="Diminuir altura"
              onClick={() => adjustDashboardWidgetHeight(widget.id, -80)}
            >
              <Minus size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title="Aumentar altura"
              onClick={() => adjustDashboardWidgetHeight(widget.id, 80)}
            >
              <Plus size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title="Mover para cima"
              onClick={() => moveDashboardWidget(widget.id, -1)}
            >
              ↑
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title="Mover para baixo"
              onClick={() => moveDashboardWidget(widget.id, 1)}
            >
              ↓
            </button>
            <button
              className="subtle-btn icon-btn micro danger"
              type="button"
              title="Remover widget"
              onClick={() => removeDashboardWidget(widget.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="dashboard-widget-content">{content}</div>
        <div className="dashboard-widget-footer">
          <button
            className="subtle-btn icon-btn micro resize-widget-handle"
            type="button"
            title="Arrastar para redimensionar altura"
            onMouseDown={(event) => startDashboardWidgetResize(event, 'recibos', widget.id, widget.minHeight)}
          >
            ⇳
          </button>
        </div>
      </article>
    )
  }

  function renderDsDashboardWidget(widget: DsDashboardWidget) {
    const effectiveColSpan = widget.column === 'side' ? 1 : clampDashboardWidgetColSpan(widget.colSpan || 1)
    const canShrinkWidth = widget.column !== 'side' && effectiveColSpan > DASHBOARD_WIDGET_MIN_COL_SPAN
    const canGrowWidth = widget.column !== 'side' && effectiveColSpan < DASHBOARD_WIDGET_MAX_COL_SPAN

    const headerLabel =
      widget.type === 'ds-status'
        ? 'Estado DS'
        : widget.type === 'ds-top-gestoras'
          ? 'Top gestoras'
          : widget.type === 'ds-top-entidades'
            ? 'Top entidades'
            : widget.type === 'ds-mensal'
              ? 'Tendência mensal (12 meses)'
              : 'Recibos'

    let content: ReactNode
    if (widget.type === 'ds-status') {
      content = renderDashboardBars(dsDashboardByStatus)
    } else if (widget.type === 'ds-top-gestoras') {
      content = renderDashboardBars(dsDashboardTopGestoras)
    } else if (widget.type === 'ds-top-entidades') {
      content = renderDashboardBars(dsDashboardTopEntidades)
    } else if (widget.type === 'ds-mensal') {
      content = renderDashboardBars(dsDashboardByMonth, { currency: true })
    } else {
      content = (
        <>
          {renderDashboardKpi('Com recibo', dsDashboardTotals.comRecibo)}
          {renderDashboardKpi('Sem recibo', dsDashboardTotals.semRecibo)}
          {renderDashboardKpi('Comissão gestor', dsDashboardTotals.comissaoGestor, true)}
        </>
      )
    }

    return (
      <article
        key={widget.id}
        className={`dashboard-widget-card ds-dashboard-widget-card size-${widget.size} span-${effectiveColSpan} ${draggedDashboardWidgetId === widget.id ? 'dragging' : ''
          } ${dropDashboardWidgetId === widget.id ? 'drop-target' : ''} ${resizingDashboardWidgetId === widget.id ? 'resizing' : ''}`}
        style={{ minHeight: `${widget.minHeight}px` }}
        draggable={!resizingDashboardWidgetId}
        onDragStart={(event) => {
          if (resizingDashboardWidgetId) {
            event.preventDefault()
            return
          }
          setDraggedDashboardWidgetId(widget.id)
          setDropDashboardWidgetId(widget.id)
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', widget.id)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (dropDashboardWidgetId !== widget.id) {
            setDropDashboardWidgetId(widget.id)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          const sourceWidgetId = event.dataTransfer.getData('text/plain') || draggedDashboardWidgetId
          if (sourceWidgetId) {
            reorderDsDashboardWidgets(sourceWidgetId, widget.id)
          }
          setDraggedDashboardWidgetId(null)
          setDropDashboardWidgetId(null)
        }}
        onDragEnd={() => {
          setDraggedDashboardWidgetId(null)
          setDropDashboardWidgetId(null)
        }}
      >
        <div className="dashboard-widget-head">
          <h4>{headerLabel}</h4>
          <div className="dashboard-widget-actions">
            <button className="subtle-btn icon-btn micro drag-handle-btn" type="button" title="Arrastar widget">
              <GripVertical size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title={widget.column === 'side' ? 'Mover para coluna principal' : 'Mover para coluna lateral'}
              onClick={() => toggleDsDashboardWidgetColumn(widget.id)}
            >
              {widget.column === 'side' ? '↤' : '↦'}
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title={widget.column === 'side' ? 'Mova para a coluna principal para ajustar largura' : 'Diminuir largura'}
              onClick={() => adjustDsDashboardWidgetWidth(widget.id, -1)}
              disabled={!canShrinkWidth}
            >
              <Minimize2 size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title={widget.column === 'side' ? 'Mova para a coluna principal para ajustar largura' : 'Aumentar largura'}
              onClick={() => adjustDsDashboardWidgetWidth(widget.id, 1)}
              disabled={!canGrowWidth}
            >
              <Maximize2 size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title="Diminuir altura"
              onClick={() => adjustDsDashboardWidgetHeight(widget.id, -80)}
            >
              <Minus size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title="Aumentar altura"
              onClick={() => adjustDsDashboardWidgetHeight(widget.id, 80)}
            >
              <Plus size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title="Mover para cima"
              onClick={() => moveDsDashboardWidget(widget.id, -1)}
            >
              ↑
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title="Mover para baixo"
              onClick={() => moveDsDashboardWidget(widget.id, 1)}
            >
              ↓
            </button>
            <button
              className="subtle-btn icon-btn micro danger"
              type="button"
              title="Remover widget"
              onClick={() => removeDsDashboardWidget(widget.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="dashboard-widget-content">
          {dsRecordsLoading && dsRecords.length === 0 ? <div className="small-note">A carregar dados…</div> : content}
        </div>
        <div className="dashboard-widget-footer">
          <button
            className="subtle-btn icon-btn micro resize-widget-handle"
            type="button"
            title="Arrastar para redimensionar altura"
            onMouseDown={(event) => startDashboardWidgetResize(event, 'ds', widget.id, widget.minHeight)}
          >
            ⇳
          </button>
        </div>
      </article>
    )
  }

  function renderPenhorasDashboardWidget(widget: PenhorasDashboardWidget) {
    const effectiveColSpan = widget.column === 'side' ? 1 : clampDashboardWidgetColSpan(widget.colSpan || 1)
    const canShrinkWidth = widget.column !== 'side' && effectiveColSpan > DASHBOARD_WIDGET_MIN_COL_SPAN
    const canGrowWidth = widget.column !== 'side' && effectiveColSpan < DASHBOARD_WIDGET_MAX_COL_SPAN

    const headerLabel =
      widget.type === 'penhoras-status'
        ? 'Estado Penhoras'
        : widget.type === 'penhoras-top-gestores'
          ? 'Top gestores'
          : 'Tendência mensal (12 meses)'

    const content =
      widget.type === 'penhoras-status'
        ? renderDashboardBars(penhorasDashboardByStatus)
        : widget.type === 'penhoras-top-gestores'
          ? renderDashboardBars(penhorasDashboardTopGestores)
          : renderDashboardBars(penhorasDashboardByMonth)

    return (
      <article
        key={widget.id}
        className={`dashboard-widget-card penhoras-dashboard-widget-card size-${widget.size} span-${effectiveColSpan} ${draggedDashboardWidgetId === widget.id ? 'dragging' : ''
          } ${dropDashboardWidgetId === widget.id ? 'drop-target' : ''} ${resizingDashboardWidgetId === widget.id ? 'resizing' : ''}`}
        style={{ minHeight: `${widget.minHeight}px` }}
        draggable={!resizingDashboardWidgetId}
        onDragStart={(event) => {
          if (resizingDashboardWidgetId) {
            event.preventDefault()
            return
          }
          setDraggedDashboardWidgetId(widget.id)
          setDropDashboardWidgetId(widget.id)
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', widget.id)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (dropDashboardWidgetId !== widget.id) {
            setDropDashboardWidgetId(widget.id)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          const sourceWidgetId = event.dataTransfer.getData('text/plain') || draggedDashboardWidgetId
          if (sourceWidgetId) {
            reorderPenhorasDashboardWidgets(sourceWidgetId, widget.id)
          }
          setDraggedDashboardWidgetId(null)
          setDropDashboardWidgetId(null)
        }}
        onDragEnd={() => {
          setDraggedDashboardWidgetId(null)
          setDropDashboardWidgetId(null)
        }}
      >
        <div className="dashboard-widget-head">
          <h4>{headerLabel}</h4>
          <div className="dashboard-widget-actions">
            <button className="subtle-btn icon-btn micro drag-handle-btn" type="button" title="Arrastar widget">
              <GripVertical size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title={widget.column === 'side' ? 'Mover para coluna principal' : 'Mover para coluna lateral'}
              onClick={() => togglePenhorasDashboardWidgetColumn(widget.id)}
            >
              {widget.column === 'side' ? '↤' : '↦'}
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title={widget.column === 'side' ? 'Mova para a coluna principal para ajustar largura' : 'Diminuir largura'}
              onClick={() => adjustPenhorasDashboardWidgetWidth(widget.id, -1)}
              disabled={!canShrinkWidth}
            >
              <Minimize2 size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title={widget.column === 'side' ? 'Mova para a coluna principal para ajustar largura' : 'Aumentar largura'}
              onClick={() => adjustPenhorasDashboardWidgetWidth(widget.id, 1)}
              disabled={!canGrowWidth}
            >
              <Maximize2 size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title="Diminuir altura"
              onClick={() => adjustPenhorasDashboardWidgetHeight(widget.id, -80)}
            >
              <Minus size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title="Aumentar altura"
              onClick={() => adjustPenhorasDashboardWidgetHeight(widget.id, 80)}
            >
              <Plus size={14} />
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title="Mover para cima"
              onClick={() => movePenhorasDashboardWidget(widget.id, -1)}
            >
              ↑
            </button>
            <button
              className="subtle-btn icon-btn micro"
              type="button"
              title="Mover para baixo"
              onClick={() => movePenhorasDashboardWidget(widget.id, 1)}
            >
              ↓
            </button>
            <button
              className="subtle-btn icon-btn micro danger"
              type="button"
              title="Remover widget"
              onClick={() => removePenhorasDashboardWidget(widget.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="dashboard-widget-content">
          {penhorasRecordsLoading && penhorasRecords.length === 0 ? <div className="small-note">A carregar dados…</div> : content}
        </div>
        <div className="dashboard-widget-footer">
          <button
            className="subtle-btn icon-btn micro resize-widget-handle"
            type="button"
            title="Arrastar para redimensionar altura"
            onMouseDown={(event) => startDashboardWidgetResize(event, 'penhoras', widget.id, widget.minHeight)}
          >
            ⇳
          </button>
        </div>
      </article>
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
        <section
          ref={notesWindowRef}
          className={`tool-window notes-window ${toolPositions.notes ? 'positioned' : 'centered'} ${draggingTool === 'notes' ? 'dragging' : ''
            } ${toolPinned.notes ? 'pinned' : ''}`}
          style={toolPositions.notes ? { left: `${toolPositions.notes.x}px`, top: `${toolPositions.notes.y}px`, zIndex: notesWindowZIndex } : { zIndex: notesWindowZIndex }}
          onMouseDown={() => bringToolToFront('notes')}
          aria-label="Notas rápidas"
        >
          <div className="tool-window-header" onMouseDown={(event) => startToolWindowDrag('notes', event)}>
            <div className="tool-window-title">
              <GripVertical size={14} />
              <div>
                <h3>Notas rápidas</h3>
                <p className="small-note">Bloco pessoal guardado automaticamente no browser.</p>
              </div>
            </div>
            <div className="tool-window-controls" onMouseDown={(event) => event.stopPropagation()}>
              <button
                className={`subtle-btn icon-btn micro ${toolPinned.notes ? 'active' : ''}`}
                type="button"
                onClick={() => toggleQuickToolPinned('notes')}
                title={toolPinned.notes ? 'Desafixar janela' : 'Fixar no topo'}
                aria-label={toolPinned.notes ? 'Desafixar janela' : 'Fixar no topo'}
              >
                {toolPinned.notes ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
              <button className="subtle-btn icon-btn micro" type="button" onClick={() => setNotesOpen(false)} title="Fechar notas" aria-label="Fechar notas">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="quick-tool-body">
            <textarea
              className="quick-notes-input"
              value={quickNotes}
              onChange={(event) => setQuickNotes(event.target.value)}
              placeholder="Escreva aqui notas rápidas para qualquer módulo..."
            />
            <div className="actions-row start">
              <button className="subtle-btn" type="button" onClick={exportQuickNotesTxt}>
                Exportar TXT
              </button>
              <button className="subtle-btn" type="button" onClick={exportQuickNotesPdf}>
                Exportar PDF
              </button>
              <button className="subtle-btn" type="button" onClick={() => setQuickNotes('')}>
                Apagar notas
              </button>
              <span className="muted">Guardado automaticamente</span>
            </div>
          </div>
        </section>
      )}

      {smartNotesOpen && (
        <section
          ref={smartNotesWindowRef}
          className={`tool-window smart-notes-window ${toolPositions['smart-notes'] ? 'positioned' : 'centered'} ${draggingTool === 'smart-notes' ? 'dragging' : ''
            } ${toolPinned['smart-notes'] ? 'pinned' : ''}`}
          style={
            toolPositions['smart-notes']
              ? { left: `${toolPositions['smart-notes'].x}px`, top: `${toolPositions['smart-notes'].y}px`, zIndex: smartNotesWindowZIndex }
              : { zIndex: smartNotesWindowZIndex }
          }
          onMouseDown={() => bringToolToFront('smart-notes')}
          aria-label="Notas com cálculo"
        >
          <div className="tool-window-header" onMouseDown={(event) => startToolWindowDrag('smart-notes', event)}>
            <div className="tool-window-title">
              <GripVertical size={14} />
              <div>
                <h3>Notas com cálculo</h3>
                <p className="small-note">Escreva linguagem natural e contas por linha. Ex.: "23% de 1250".</p>
              </div>
            </div>
            <div className="tool-window-controls" onMouseDown={(event) => event.stopPropagation()}>
              <button
                className={`subtle-btn icon-btn micro ${toolPinned['smart-notes'] ? 'active' : ''}`}
                type="button"
                onClick={() => toggleQuickToolPinned('smart-notes')}
                title={toolPinned['smart-notes'] ? 'Desafixar janela' : 'Fixar no topo'}
                aria-label={toolPinned['smart-notes'] ? 'Desafixar janela' : 'Fixar no topo'}
              >
                {toolPinned['smart-notes'] ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
              <button
                className="subtle-btn icon-btn micro"
                type="button"
                onClick={() => setSmartNotesOpen(false)}
                title="Fechar notas com cálculo"
                aria-label="Fechar notas com cálculo"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="smart-notes-layout">
            <textarea
              className="smart-notes-input"
              value={smartNotesText}
              onChange={(event) => setSmartNotesText(event.target.value)}
              placeholder={`7 × 7\n3k ganhos ÷ 5 pessoas\neu gastei 200 euros e 10 euro em bebidas\ntotal`}
            />
            <aside className="smart-notes-results">
              <div className="smart-notes-results-head">
                <strong>{smartNotesResults.length} linhas calculadas</strong>
                <div className="smart-notes-head-meta">
                  {smartNotesSavedEntries.length > 0 && <span className="muted">{smartNotesSavedEntries.length} guardadas</span>}
                  {smartNotesErrors.length > 0 && <span className="muted">{smartNotesErrors.length} com erro</span>}
                </div>
              </div>
              {smartNotesResults.length === 0 ? (
                <div className="muted">Sem cálculos detetados.</div>
              ) : (
                <div className="smart-notes-list">
                  {smartNotesDisplayResults.map((row) => (
                    <div
                      key={`${row.lineNumber}-${row.signature}`}
                      className={`smart-notes-row ${smartNotesPinnedSet.has(row.signature) ? 'pinned' : ''}`}
                    >
                      <span className="smart-notes-line">L{row.lineNumber}</span>
                      <div className="smart-notes-row-main">
                        <div className="smart-notes-row-text">
                          <div className="smart-notes-expression">{row.expression}</div>
                          <strong>{formatSmartNotesValue(row.result)}</strong>
                        </div>
                        <div className="smart-notes-row-actions">
                          <button
                            className={`subtle-btn icon-btn micro ${smartNotesPinnedSet.has(row.signature) ? 'active' : ''}`}
                            type="button"
                            onClick={() => toggleSmartNotesPinned(row.signature)}
                            title={smartNotesPinnedSet.has(row.signature) ? 'Desafixar' : 'Fixar no topo'}
                            aria-label={smartNotesPinnedSet.has(row.signature) ? 'Desafixar' : 'Fixar no topo'}
                          >
                            <Pin size={13} />
                          </button>
                          <button
                            className={`subtle-btn icon-btn micro ${smartNotesSavedSet.has(row.signature) ? 'active' : ''}`}
                            type="button"
                            onClick={() => toggleSmartNotesSaved(row)}
                            title={smartNotesSavedSet.has(row.signature) ? 'Remover dos guardados' : 'Guardar cálculo'}
                            aria-label={smartNotesSavedSet.has(row.signature) ? 'Remover dos guardados' : 'Guardar cálculo'}
                          >
                            <Save size={13} />
                          </button>
                          <button
                            className="subtle-btn icon-btn micro danger"
                            type="button"
                            onClick={() => removeSmartNotesLine(row.lineNumber)}
                            title="Eliminar linha"
                            aria-label="Eliminar linha"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {smartNotesErrors.length > 0 && (
                <div className="smart-notes-errors">
                  {smartNotesErrors.slice(0, 5).map((row) => (
                    <div key={`${row.lineNumber}-${row.error}`} className="smart-notes-error-row">
                      <span>L{row.lineNumber}</span>
                      <span>{row.error}</span>
                    </div>
                  ))}
                </div>
              )}
              {smartNotesSavedEntries.length > 0 && (
                <div className="smart-notes-saved">
                  <div className="smart-notes-saved-head">
                    <strong>Guardados</strong>
                    <button className="subtle-btn" type="button" onClick={() => setSmartNotesSavedEntries([])}>
                      Limpar guardados
                    </button>
                  </div>
                  <div className="smart-notes-saved-list">
                    {smartNotesSavedEntries.slice(0, 5).map((entry) => (
                      <div key={entry.signature} className="smart-notes-saved-item">
                        <span className="muted">{entry.expression}</span>
                        <strong>{formatSmartNotesValue(entry.result)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
          <div className="actions-row start smart-notes-actions">
            <button className="subtle-btn" type="button" onClick={exportSmartNotesTxt}>
              Exportar TXT
            </button>
            <button className="subtle-btn" type="button" onClick={exportSmartNotesPdf}>
              Exportar PDF
            </button>
            <button className="subtle-btn" type="button" onClick={() => setSmartNotesText('')}>
              Limpar
            </button>
            <span className="muted">Alt+S</span>
          </div>
        </section>
      )}

      {calculatorOpen && (
        <section
          ref={calculatorWindowRef}
          className={`tool-window calculator-window ${toolPositions.calculator ? 'positioned' : 'centered'} ${draggingTool === 'calculator' ? 'dragging' : ''
            } ${toolPinned.calculator ? 'pinned' : ''}`}
          style={
            toolPositions.calculator
              ? { left: `${toolPositions.calculator.x}px`, top: `${toolPositions.calculator.y}px`, zIndex: calculatorWindowZIndex }
              : { zIndex: calculatorWindowZIndex }
          }
          onMouseDown={() => bringToolToFront('calculator')}
          role="dialog"
          aria-modal="false"
          aria-label="Calculadora"
        >
          <div className="tool-window-header calculator-header" onMouseDown={(event) => startToolWindowDrag('calculator', event)}>
            <div className="tool-window-title">
              <GripVertical size={14} />
              <div>
                <h3>Calculadora</h3>
                <p className="small-note">+, -, ×, ÷, parênteses e %</p>
              </div>
            </div>
            <div className="tool-window-controls" onMouseDown={(event) => event.stopPropagation()}>
              <button
                className={`subtle-btn icon-btn micro ${toolPinned.calculator ? 'active' : ''}`}
                type="button"
                onClick={() => toggleQuickToolPinned('calculator')}
                title={toolPinned.calculator ? 'Desafixar janela' : 'Fixar no topo'}
                aria-label={toolPinned.calculator ? 'Desafixar janela' : 'Fixar no topo'}
              >
                {toolPinned.calculator ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
              <button className="subtle-btn icon-btn micro" type="button" onClick={() => setCalculatorOpen(false)} title="Fechar calculadora" aria-label="Fechar calculadora">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className={`calculator-display ${calculatorError ? 'error' : ''}`}>
            <div className="calculator-expression">
              {(calculatorExpression || '0').replace(/\*/g, '×').replace(/\//g, '÷').replace(/\./g, ',')}
            </div>
            <div className="calculator-result">{calculatorError || calculatorResult || '0'}</div>
          </div>

          <div className="calculator-keypad">
            {CALCULATOR_KEYS.map((key) => (
              <button
                key={key.label}
                className={`calculator-key tone-${key.tone ?? 'default'} ${key.wide ? 'wide' : ''}`}
                type="button"
                onClick={() => handleCalculatorKeyPress(key)}
              >
                {key.label}
              </button>
            ))}
          </div>
        </section>
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

        {
          activeModule === 'ds' && (activeTab === 'consulta' || activeTab === 'tabela') && selectedDsRecord && (
            <div className="record-modal-overlay" onClick={() => setSelectedDsRecordId(null)}>
              <aside className="panel record-modal" onClick={(event) => event.stopPropagation()}>
                <div className="drawer-header">
                  <div className="modal-title-block">
                    <h3>{selectedDsRecord.referencia || selectedDsRecord.proponentes || 'Detalhe do registo DS'}</h3>
                    <div className="small-note modal-meta">
                      {[selectedDsRecord.gestora, selectedDsRecord.entidadeBancaria, selectedDsRecord.dataEscritura].filter(Boolean).join(' · ') || '-'}
                    </div>
                  </div>
                  <div className="actions-row modal-header-actions">
                    <button className="subtle-btn" type="button" onClick={() => setIsDsRecordEditing((current) => !current)}>
                      {isDsRecordEditing ? <X size={15} /> : <Pencil size={15} />}
                      {isDsRecordEditing ? 'Cancelar edição' : 'Editar'}
                    </button>
                    <button className="subtle-btn" type="button" onClick={() => setSelectedDsRecordId(null)}>Fechar</button>
                  </div>
                </div>

                {isDsRecordEditing && selectedDsRecordEdit ? (
                  <div className="record-edit-content">
                    <div className="field-grid three">
                      <LabeledInput
                        label="Gestora"
                        value={selectedDsRecordEdit.gestora}
                        onChange={(value) => handleDsRecordEditInput('gestora', value)}
                        suggestions={dsGestoraFilterOptions}
                      />
                      <LabeledInput
                        label="Proponentes"
                        value={selectedDsRecordEdit.proponentes}
                        onChange={(value) => handleDsRecordEditInput('proponentes', value)}
                        suggestions={dsProponentesSuggestions}
                      />
                      <LabeledInput
                        label="Referência"
                        value={selectedDsRecordEdit.referencia}
                        onChange={(value) => handleDsRecordEditInput('referencia', value)}
                        suggestions={dsReferenciaSuggestions}
                      />
                    </div>
                    <div className="field-grid three">
                      <LabeledInput
                        label="Produto"
                        value={selectedDsRecordEdit.produto}
                        onChange={(value) => handleDsRecordEditInput('produto', value)}
                        suggestions={dsProdutoFilterOptions}
                      />
                      <LabeledInput
                        label="Entidade bancária"
                        value={selectedDsRecordEdit.entidadeBancaria}
                        onChange={(value) => handleDsRecordEditInput('entidadeBancaria', value)}
                        suggestions={dsEntidadeFilterOptions}
                      />
                      <LabeledInput
                        label="Líder cálculo"
                        value={selectedDsRecordEdit.liderCalculo}
                        onChange={(value) => handleDsRecordEditInput('liderCalculo', value)}
                      />
                    </div>
                    <div className="field-grid three">
                      <LabeledInput
                        label="Recibo"
                        value={selectedDsRecordEdit.recibo}
                        onChange={(value) => handleDsRecordEditInput('recibo', value)}
                        suggestions={dsReciboSuggestions}
                      />
                      <LabeledInput
                        label="Falta recibo gestora"
                        value={selectedDsRecordEdit.faltaReciboGestora}
                        onChange={(value) => handleDsRecordEditInput('faltaReciboGestora', value)}
                      />
                      <LabeledSelect
                        label="Estado"
                        value={selectedDsRecordEdit.estadoId}
                        onChange={(value) => handleDsRecordEditInput('estadoId', value)}
                        options={dsOrderedStatuses.map((status) => ({ value: status.id, label: status.label }))}
                      />
                    </div>
                    <div className="field-grid five">
                      <LabeledInput label="Valor" value={selectedDsRecordEdit.valor} onChange={(value) => handleDsRecordEditInput('valor', value)} />
                      <LabeledInput
                        label="Comissão loja"
                        value={selectedDsRecordEdit.comissaoLoja}
                        onChange={(value) => handleDsRecordEditInput('comissaoLoja', value)}
                      />
                      <LabeledInput
                        label="IVA CGD (raw)"
                        value={selectedDsRecordEdit.ivaCgdRaw}
                        onChange={(value) => handleDsRecordEditInput('ivaCgdRaw', value)}
                      />
                      <LabeledInput
                        label="Total comissão c/ IVA"
                        value={selectedDsRecordEdit.totalComissaoLojaCmIva}
                        onChange={(value) => handleDsRecordEditInput('totalComissaoLojaCmIva', value)}
                      />
                      <LabeledInput
                        label="Comissão gestor"
                        value={selectedDsRecordEdit.comissaoGestor}
                        onChange={(value) => handleDsRecordEditInput('comissaoGestor', value)}
                      />
                    </div>
                    <div className="field-grid four">
                      <LabeledInput
                        label="Percentagem"
                        value={selectedDsRecordEdit.percentagem}
                        onChange={(value) => handleDsRecordEditInput('percentagem', value)}
                      />
                      <LabeledInput
                        type="date"
                        label="Data escritura"
                        value={selectedDsRecordEdit.dataEscritura}
                        onChange={(value) => handleDsRecordEditInput('dataEscritura', value)}
                      />
                      <LabeledInput
                        type="date"
                        label="Data fecho CRM"
                        value={selectedDsRecordEdit.dataFechoCrm}
                        onChange={(value) => handleDsRecordEditInput('dataFechoCrm', value)}
                      />
                      <LabeledInput
                        label="Pagamento comissão gestor"
                        value={selectedDsRecordEdit.pagComissaoGestor}
                        onChange={(value) => handleDsRecordEditInput('pagComissaoGestor', value)}
                      />
                    </div>
                    <div className="actions-row modal-edit-actions">
                      <button className="primary-btn" type="button" onClick={() => void saveSelectedDsRecordEdits()}>
                        <Save size={15} />
                        Guardar alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="detail-grid modal-detail-grid">
                    <Info label="Gestora" value={selectedDsRecord.gestora || '-'} />
                    <Info label="Proponentes" value={selectedDsRecord.proponentes || '-'} />
                    <Info label="Referência" value={selectedDsRecord.referencia || '-'} />
                    <Info label="Produto" value={selectedDsRecord.produto || '-'} />
                    <Info label="Entidade bancária" value={selectedDsRecord.entidadeBancaria || '-'} />
                    <Info label="Líder cálculo" value={selectedDsRecord.liderCalculo || '-'} />
                    <Info label="Recibo" value={selectedDsRecord.recibo || '-'} />
                    <Info label="Falta recibo gestora" value={selectedDsRecord.faltaReciboGestora || '-'} />
                    <Info label="Valor" value={formatCurrency(selectedDsRecord.valor)} />
                    <Info label="Comissão loja" value={formatCurrency(selectedDsRecord.comissaoLoja)} />
                    <Info label="Total comissão c/ IVA" value={formatCurrency(selectedDsRecord.totalComissaoLojaCmIva)} />
                    <Info label="Comissão gestor" value={formatCurrency(selectedDsRecord.comissaoGestor)} />
                    <Info label="IVA CGD" value={selectedDsRecord.ivaCgdRaw || formatCurrency(selectedDsRecord.ivaCgdValor)} />
                    <Info label="Percentagem" value={selectedDsRecord.percentagemRaw || toFormNumber(selectedDsRecord.percentagem) || '-'} />
                    <Info label="Data escritura" value={selectedDsRecord.dataEscritura || '-'} />
                    <Info label="Data fecho CRM" value={selectedDsRecord.dataFechoCrm || '-'} />
                    <Info label="Pag. comissão gestor" value={selectedDsRecord.pagComissaoGestor || '-'} />
                    <div className="field modal-status-field">
                      <span>Estado</span>
                      <select value={selectedDsRecord.estadoId} onChange={(event) => void updateDsRecordStatus(selectedDsRecord.id, event.target.value)}>
                        {dsOrderedStatuses.map((statusOption) => (
                          <option key={statusOption.id} value={statusOption.id}>{statusOption.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <h4 className="modal-section-title">Metadados</h4>
                <div className="history-list modal-history-list">
                  <div className="history-item">
                    <div>Criado</div>
                    <div className="muted">{new Date(selectedDsRecord.createdAt).toLocaleString('pt-PT')}</div>
                  </div>
                  <div className="history-item">
                    <div>Última atualização</div>
                    <div className="muted">{new Date(selectedDsRecord.updatedAt).toLocaleString('pt-PT')}</div>
                  </div>
                </div>
              </aside>
            </div>
          )
        }

        {
          activeModule === 'penhoras' && (activeTab === 'consulta' || activeTab === 'tabela') && selectedPenhorasRecord && (
            <div className="record-modal-overlay" onClick={() => setSelectedPenhorasRecordId(null)}>
              <aside className="panel record-modal" onClick={(event) => event.stopPropagation()}>
                <div className="drawer-header">
                  <div className="modal-title-block">
                    <h3>{selectedPenhorasRecord.pe || selectedPenhorasRecord.identificacao || 'Detalhe do registo Penhoras'}</h3>
                    <div className="small-note modal-meta">
                      {[selectedPenhorasRecord.gestor, selectedPenhorasRecord.acto, selectedPenhorasRecord.dataPedido].filter(Boolean).join(' · ') || '-'}
                    </div>
                  </div>
                  <div className="actions-row modal-header-actions">
                    <button className="subtle-btn" type="button" onClick={() => setIsPenhorasRecordEditing((current) => !current)}>
                      {isPenhorasRecordEditing ? <X size={15} /> : <Pencil size={15} />}
                      {isPenhorasRecordEditing ? 'Cancelar edição' : 'Editar'}
                    </button>
                    <button className="subtle-btn" type="button" onClick={() => setSelectedPenhorasRecordId(null)}>Fechar</button>
                  </div>
                </div>

                {isPenhorasRecordEditing && selectedPenhorasRecordEdit ? (
                  <div className="record-edit-content">
                    <div className="field-grid three">
                      <LabeledInput
                        label="PE"
                        value={selectedPenhorasRecordEdit.pe}
                        onChange={(value) => handlePenhorasRecordEditInput('pe', value)}
                        suggestions={penhorasPeSuggestions}
                      />
                      <LabeledInput
                        label="Acto"
                        value={selectedPenhorasRecordEdit.acto}
                        onChange={(value) => handlePenhorasRecordEditInput('acto', value)}
                        suggestions={penhorasActoFilterOptions}
                      />
                      <LabeledInput
                        type="date"
                        label="Data pedido"
                        value={selectedPenhorasRecordEdit.dataPedido}
                        onChange={(value) => handlePenhorasRecordEditInput('dataPedido', value)}
                      />
                    </div>
                    <div className="field-grid three">
                      <LabeledInput
                        label="Identificação"
                        value={selectedPenhorasRecordEdit.identificacao}
                        onChange={(value) => handlePenhorasRecordEditInput('identificacao', value)}
                      />
                      <LabeledInput
                        label="Pedido"
                        value={selectedPenhorasRecordEdit.pedido}
                        onChange={(value) => handlePenhorasRecordEditInput('pedido', value)}
                      />
                      <LabeledInput
                        label="Gestor"
                        value={selectedPenhorasRecordEdit.gestor}
                        onChange={(value) => handlePenhorasRecordEditInput('gestor', value)}
                        suggestions={penhorasGestorFilterOptions}
                      />
                    </div>
                    <div className="field-grid three">
                      <LabeledSelect
                        label="Estado"
                        value={selectedPenhorasRecordEdit.estadoId}
                        onChange={(value) => handlePenhorasRecordEditInput('estadoId', value)}
                        options={penhorasActiveStatuses.map((status) => ({ value: status.id, label: status.label }))}
                      />
                    </div>
                    <div className="actions-row modal-edit-actions">
                      <button className="primary-btn" type="button" onClick={() => void saveSelectedPenhorasRecordEdits()}>
                        <Save size={15} />
                        Guardar alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="detail-grid modal-detail-grid">
                    <Info label="PE" value={selectedPenhorasRecord.pe || '-'} />
                    <Info label="Acto" value={selectedPenhorasRecord.acto || '-'} />
                    <Info label="Data pedido" value={selectedPenhorasRecord.dataPedido || '-'} />
                    <Info label="Identificação" value={selectedPenhorasRecord.identificacao || '-'} />
                    <Info label="Pedido" value={selectedPenhorasRecord.pedido || '-'} />
                    <Info label="Gestor" value={selectedPenhorasRecord.gestor || '-'} />
                    <div className="field modal-status-field">
                      <span>Estado</span>
                      <select value={selectedPenhorasRecord.estadoId} onChange={(event) => void updatePenhorasRecordStatus(selectedPenhorasRecord.id, event.target.value)}>
                        {!penhorasActiveStatuses.some((statusOption) => statusOption.id === selectedPenhorasRecord.estadoId) && (
                          <option value="">Selecionar estado...</option>
                        )}
                        {penhorasActiveStatuses.map((statusOption) => (
                          <option key={statusOption.id} value={statusOption.id}>{statusOption.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <h4 className="modal-section-title">Metadados</h4>
                <div className="history-list modal-history-list">
                  <div className="history-item">
                    <div>Criado</div>
                    <div className="muted">{new Date(selectedPenhorasRecord.createdAt).toLocaleString('pt-PT')}</div>
                  </div>
                  <div className="history-item">
                    <div>Última atualização</div>
                    <div className="muted">{new Date(selectedPenhorasRecord.updatedAt).toLocaleString('pt-PT')}</div>
                  </div>
                </div>
              </aside>
            </div>
          )
        }

        {
          activeModule === 'recibos' && selectedRecord && (
            <div className="record-modal-overlay" onClick={() => setSelectedRecordId(null)}>
              <aside className="panel record-modal" onClick={(event) => event.stopPropagation()}>
                <div className="drawer-header">
                  <div className="modal-title-block">
                    <h3>{selectedRecord.processo || selectedRecord.pe || selectedRecord.reciboNumero || 'Detalhe do registo'}</h3>
                    <div className="small-note modal-meta">
                      {selectedRecord.pe || '-'} · {MONTHS[selectedRecord.mes - 1]} {selectedRecord.ano}
                    </div>
                  </div>
                  <div className="actions-row modal-header-actions">
                    <button
                      className="subtle-btn"
                      type="button"
                      onClick={() => setIsRecordEditing((current) => !current)}
                    >
                      {isRecordEditing ? <X size={15} /> : <Pencil size={15} />}
                      {isRecordEditing ? 'Cancelar edição' : 'Editar'}
                    </button>
                    <button className="subtle-btn" type="button" onClick={() => setSelectedRecordId(null)}>Fechar</button>
                  </div>
                </div>

                {isRecordEditing && selectedRecordEdit ? (
                  <div className="record-edit-content">
                    <div className="field-grid three">
                      <LabeledSelect
                        label="Tipo"
                        value={selectedRecordEdit.tipo}
                        onChange={(value) => handleRecordEditInput('tipo', value as RecordType)}
                        options={[
                          { value: 'exequente', label: 'Exequente' },
                          { value: 'executado', label: 'Executado' },
                        ]}
                      />
                      <LabeledSelect
                        label="Mês"
                        value={String(selectedRecordEdit.mes)}
                        onChange={(value) => handleRecordEditInput('mes', Number(value))}
                        options={MONTHS.map((label, index) => ({ value: String(index + 1), label }))}
                      />
                      <LabeledInput
                        label="Ano"
                        value={String(selectedRecordEdit.ano)}
                        onChange={(value) => handleRecordEditInput('ano', Number(value) || selectedRecordEdit.ano)}
                      />
                    </div>

                    <div className="field-grid three">
                      <LabeledInput label="Processo" value={selectedRecordEdit.processo} onChange={(value) => handleRecordEditInput('processo', value)} suggestions={recordSuggestions.processo} />
                      <LabeledInput label="PE" value={selectedRecordEdit.pe} onChange={(value) => handleRecordEditInput('pe', value)} suggestions={recordSuggestions.pe} />
                      <LabeledInput label="Recibo" value={selectedRecordEdit.reciboNumero} onChange={(value) => handleRecordEditInput('reciboNumero', value)} suggestions={recordSuggestions.reciboNumero} />
                    </div>

                    <div className="field-grid five">
                      <LabeledInput label="Valor indicado" value={selectedRecordEdit.valorIndicado} onChange={(value) => handleRecordEditInput('valorIndicado', value)} />
                      <LabeledInput label="Valor sem IVA" value={selectedRecordEdit.valorSemIva} onChange={(value) => handleRecordEditInput('valorSemIva', value)} />
                      <LabeledInput label="IVA" value={selectedRecordEdit.iva} onChange={(value) => handleRecordEditInput('iva', value)} />
                      <LabeledInput label="Retenção" value={selectedRecordEdit.retencao} onChange={(value) => handleRecordEditInput('retencao', value)} />
                      <LabeledInput label="Meu 5%" value={selectedRecordEdit.meu5} onChange={(value) => handleRecordEditInput('meu5', value)} />
                    </div>

                    <div className="field-grid five">
                      <LabeledInput label="GPESE" value={selectedRecordEdit.gpeSe} onChange={(value) => handleRecordEditInput('gpeSe', value)} />
                      <LabeledInput
                        label="Gestor"
                        value={selectedRecordEdit.gestor}
                        onChange={(value) => handleRecordEditInput('gestor', value)}
                        suggestions={gestorSuggestions}
                      />
                      <LabeledInput
                        label="Exequente"
                        value={selectedRecordEdit.exequente}
                        onChange={(value) => handleRecordEditInput('exequente', value)}
                        suggestions={exequenteSuggestions}
                      />
                      <LabeledInput label="Descrição valor" value={selectedRecordEdit.descricaoValor} onChange={(value) => handleRecordEditInput('descricaoValor', value)} />
                      <LabeledSelect
                        label="Estado"
                        value={selectedRecordEdit.estadoId}
                        onChange={(value) => handleRecordEditInput('estadoId', value)}
                        options={orderedStatuses.map((status) => ({ value: status.id, label: status.label }))}
                      />
                    </div>

                    <div className="field-grid one">
                      <LabeledInput label="Indicações" value={selectedRecordEdit.indicacoes} onChange={(value) => handleRecordEditInput('indicacoes', value)} />
                    </div>

                    <div className="actions-row modal-edit-actions">
                      <button
                        className="subtle-btn"
                        type="button"
                        onClick={() => setSelectedRecordEdit(applyFormAutoCalculations(selectedRecordEdit, calculationSettings, true))}
                      >
                        Recalcular
                      </button>
                      <button className="primary-btn" type="button" onClick={() => void saveSelectedRecordEdits()}>
                        <Save size={15} />
                        Guardar alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="detail-grid modal-detail-grid">
                    <Info label="Tipo" value={selectedRecord.tipo === 'exequente' ? 'Exequente' : 'Executado'} />
                    <Info label="PE" value={selectedRecord.pe || '-'} />
                    <Info label="Processo" value={selectedRecord.processo || '-'} />
                    <Info label="Recibo" value={selectedRecord.reciboNumero || '-'} />
                    <Info label="Gestor" value={selectedRecord.gestor || '-'} />
                    <Info label="Exequente" value={selectedRecord.exequente || '-'} />
                    <Info label="Valor sem IVA" value={formatCurrency(selectedRecord.valorSemIva)} />
                    <Info label="IVA" value={formatCurrency(selectedRecord.iva)} />
                    <Info label="Retenção" value={formatCurrency(selectedRecord.retencao)} />
                    <Info label="Meu 5%" value={formatCurrency(selectedRecord.meu5)} />
                    <Info label="GPESE" value={selectedRecordIndicacoes.gpeSe || '-'} />
                    <Info label="Indicações" value={selectedRecordIndicacoes.text || '-'} />
                    <div className="field modal-status-field">
                      <span>Estado</span>
                      <select value={selectedRecord.estadoId} onChange={(event) => void updateRecordStatus(selectedRecord.id, event.target.value)}>
                        {orderedStatuses.map((statusOption) => (
                          <option key={statusOption.id} value={statusOption.id}>{statusOption.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <h4 className="modal-section-title">Histórico</h4>
                <div className="history-list modal-history-list">
                  {selectedRecord.history.length === 0 ? (
                    <div className="empty-text">Sem histórico.</div>
                  ) : (
                    selectedRecord.history.map((item) => (
                      <div key={item.id} className="history-item">
                        <div>{item.message}</div>
                        <div className="muted">{new Date(item.at).toLocaleString('pt-PT')}</div>
                      </div>
                    ))
                  )}
                </div>
              </aside>
            </div>
          )
        }
      </main >
    </div >
  )
}

type LabeledInputProps = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'date' | 'number'
  suggestions?: string[]
  placeholder?: string
}

function LabeledInput({ label, value, onChange, type = 'text', suggestions, placeholder }: LabeledInputProps) {
  return (
    <label className="field">
      <span>{label}</span>
      {type === 'text' && Array.isArray(suggestions) && suggestions.length > 0 ? (
        <AutocompleteInput value={value} onChange={onChange} suggestions={suggestions} placeholder={placeholder} />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  )
}

type AutocompleteInputProps = {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
}

function AutocompleteInput({ value, onChange, suggestions, placeholder }: AutocompleteInputProps) {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const filtered = useMemo(() => {
    const unique = [...new Set(suggestions.map((item) => item.trim()).filter(Boolean))]
    const query = normalizeText(value)

    if (!query) return unique.slice(0, 160)

    const startsWith = unique.filter((item) => normalizeText(item).startsWith(query))
    const contains = unique.filter((item) => !normalizeText(item).startsWith(query) && normalizeText(item).includes(query))
    return [...startsWith, ...contains].slice(0, 160)
  }, [suggestions, value])

  function commitSelection(nextValue: string) {
    onChange(nextValue)
    setOpen(false)
    setHighlightedIndex(-1)
  }

  return (
    <div className="autocomplete-input">
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false)
            setHighlightedIndex(-1)
          }, 110)
        }}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setHighlightedIndex(-1)
        }}
        onKeyDown={(event) => {
          if (!open || filtered.length === 0) return

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setHighlightedIndex((current) => (current + 1 >= filtered.length ? 0 : current + 1))
            return
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlightedIndex((current) => (current <= 0 ? filtered.length - 1 : current - 1))
            return
          }

          if (event.key === 'Enter') {
            if (highlightedIndex >= 0) {
              event.preventDefault()
              commitSelection(filtered[highlightedIndex])
            }
            return
          }

          if (event.key === 'Escape') {
            setOpen(false)
            setHighlightedIndex(-1)
          }
        }}
      />
      {open && filtered.length > 0 && (
        <div className="autocomplete-menu" role="listbox">
          {filtered.map((option, index) => (
            <button
              key={`${option}-${index}`}
              type="button"
              className={`autocomplete-option ${highlightedIndex === index ? 'active' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault()
                commitSelection(option)
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type LabeledSelectProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

function LabeledSelect({ label, value, onChange, options }: LabeledSelectProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}


type InfoProps = {
  label: string
  value: string
}

function Info({ label, value }: InfoProps) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default App
