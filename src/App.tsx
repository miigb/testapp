import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FilterX,
  FileClock,
  FileSearch,
  Hammer,
  GripVertical,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  OctagonAlert,
  Pencil,
  ReceiptText,
  Save,
  SearchCheck,
  ShieldAlert,
  Trash2,
  Undo2,
  UserRound,
  X,
} from 'lucide-react'

import { api } from './api'
import { applyFormAutoCalculations, parseFormNumber } from './lib/calculations'
import { parseImportedWorkbook } from './lib/importParser'
import type {
  AnalyticsSummary,
  CalculationSettings,
  EntryForm,
  ImportPreviewResponse,
  ParsedImport,
  RecordSuggestions,
  ReceiptRecord,
  RecordFilters,
  RecordType,
  SavedView,
  StatusDefinition,
  TabId,
  TaxRule,
} from './types'

const TABS: { id: TabId; label: string }[] = [
  { id: 'entrada', label: 'Entrada' },
  { id: 'consulta', label: 'Consulta' },
  { id: 'tabela', label: 'Tabela' },
  { id: 'dashboards', label: 'Dashboards' },
  { id: 'configuracao', label: 'Configuração' },
]

const DEFAULT_TABLE_FILTERS: RecordFilters = {
  tipo: 'todos',
  estadoId: 'todos',
  mes: 'todos',
  ano: 'todos',
  page: 1,
  pageSize: 300,
}

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

const DASHBOARD_WIDGET_MIN_HEIGHT = 96
const DASHBOARD_WIDGET_MAX_HEIGHT = 2200
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

const THEME_OPTIONS: Array<{ id: ThemeId; label: string }> = [
  { id: 'light', label: 'Claro (Legacy)' },
  { id: 'dark', label: 'Escuro (Legacy)' },
  { id: 'tokyo-day', label: 'Tokio Day (Legacy)' },
  { id: 'tokyo-night', label: 'Tokio Night (Legacy)' },
  { id: 'synthwave-84', label: "SynthWave '84 (Legacy)" },
  { id: 'one-dark-pro', label: 'One Dark Pro' },
  { id: 'night-owl', label: 'Night Owl' },
  { id: 'atom-one-light', label: 'Atom One Light' },
  { id: 'github-light', label: 'GitHub Light' },
  { id: 'github-dark', label: 'GitHub Dark' },
  { id: 'github-gray', label: 'GitHub Gray' },
]

const TOTAL_METRIC_OPTIONS: Array<{ key: TotalMetricKey; label: string; currency?: boolean }> = [
  { key: 'registos', label: 'N.º de registos' },
  { key: 'valorIndicado', label: 'Valor indicado', currency: true },
  { key: 'valorSemIva', label: 'Valor sem IVA', currency: true },
  { key: 'iva', label: 'IVA', currency: true },
  { key: 'retencao', label: 'Retenção', currency: true },
  { key: 'meu5', label: 'Meu 5%', currency: true },
  { key: 'valorEmissao', label: 'Valor emissão', currency: true },
  { key: 'outrasTaxas', label: 'Outras taxas', currency: true },
  { key: 'levantadoComIva', label: 'Levantado c/ IVA', currency: true },
]

function resolveInitialTheme(): ThemeId {
  const stored = localStorage.getItem('mesa-recibos-theme')
  if (
    stored === 'light' ||
    stored === 'dark' ||
    stored === 'tokyo-day' ||
    stored === 'tokyo-night' ||
    stored === 'synthwave-84' ||
    stored === 'one-dark-pro' ||
    stored === 'night-owl' ||
    stored === 'atom-one-light' ||
    stored === 'github-light' ||
    stored === 'github-dark' ||
    stored === 'github-gray'
  ) {
    return stored
  }

  return 'github-light'
}

function resolveInitialLayoutMode(): LayoutMode {
  const stored = localStorage.getItem('mesa-recibos-layout')
  if (stored === 'wide' || stored === 'narrow') {
    return stored
  }
  return 'narrow'
}

function resolveInitialDisabledSavedViewIds(): string[] {
  try {
    const stored = localStorage.getItem('mesa-recibos-disabled-saved-views')
    if (!stored) return []
    const parsed = JSON.parse(stored) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string')
    }
  } catch {
    // no-op
  }
  return []
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

// Quick rollback switch for the new integrated header bar layout.
const ENABLE_UNIFIED_HEADER_LAYOUT = true
// Quick rollback switch for the experimental visual redesign pass.
const ENABLE_NEO_REDESIGN_EXPERIMENT = false

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const EMPTY_CALC_SETTINGS: CalculationSettings = {
  id: 'default',
  autoApplyRules: true,
  autoComputeValorSemIva: true,
  autoComputeValorEmissao: false,
  roundTo: 2,
  taxRules: [],
}

const EMPTY_RECORD_SUGGESTIONS: RecordSuggestions = {
  processo: [],
  pe: [],
  reciboNumero: [],
  gestor: [],
  exequente: [],
}

const LOGO_DEV_TOKEN = (import.meta.env.VITE_LOGO_DEV_TOKEN as string | undefined) ?? 'pk_J_6gnc2JTzKtdVlXmGyzvA'

const EXEQUENTE_DOMAIN_MAP: Record<string, string> = {
  MONTEPIO: 'montepio.pt',
  CGD: 'cgd.pt',
  'CGD.': 'cgd.pt',
  CAIXA: 'cgd.pt',
  'CAIXA GERAL': 'cgd.pt',
  'CAIXA GERL': 'cgd.pt',
  CGA: 'cgd.pt',
  SANTANDER: 'santander.pt',
  'SANTANDER -SPS': 'santander.pt',
  BCP: 'millenniumbcp.pt',
  'NOVO BANCO': 'novobanco.pt',
  BPI: 'bancobpi.pt',
  CREDIBOM: 'credibom.pt',
  SERVDEBT: 'servdebt.com',
  SERVDBET: 'servdebt.com',
  EOS: 'eos-solutions.pt',
  'DUO CAPITAL': 'duocapital.com',
  NOS: 'nos.pt',
  ORTHONAVE: 'orthonave.pt',
  DOCAPESCA: 'docapesca.pt',
  'DATA REDE': 'datarede.pt',
  'ARES LUSITANI': 'areslusitani.pt',
  'LC ASSET': 'lcasset.pt',
  RCI: 'rcibankandservices.com',
  ZARCO: 'zarco.pt',
  ALGEBRA: 'algebra-capital.com',
  HEFESTO: 'hefesto.pt',
  HEFETO: 'hefesto.pt',
  HEFETSO: 'hefesto.pt',
  HESFESTO: 'hefesto.pt',
  BTL: 'btlireland.com',
  'BTL IRELAND': 'btlireland.com',
}

const EXEQUENTE_KEYWORD_DOMAIN: Array<{ keyword: string; domain: string }> = [
  { keyword: 'SANTANDER', domain: 'santander.pt' },
  { keyword: 'MONTEPIO', domain: 'montepio.pt' },
  { keyword: 'CAIXA', domain: 'cgd.pt' },
  { keyword: 'CGD', domain: 'cgd.pt' },
  { keyword: 'SERVDEBT', domain: 'servdebt.com' },
  { keyword: 'CREDIBOM', domain: 'credibom.pt' },
  { keyword: 'EOS', domain: 'eos-solutions.pt' },
  { keyword: 'NOVO BANCO', domain: 'novobanco.pt' },
  { keyword: 'BPI', domain: 'bancobpi.pt' },
  { keyword: 'BCP', domain: 'millenniumbcp.pt' },
  { keyword: 'NOS', domain: 'nos.pt' },
]

const STATUS_ICON_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'hammer', label: 'Martelo', icon: Hammer },
  { value: 'clock3', label: 'Relógio', icon: Clock3 },
  { value: 'search-check', label: 'Validação', icon: SearchCheck },
  { value: 'receipt-text', label: 'Recibo', icon: ReceiptText },
  { value: 'octagon-alert', label: 'Bloqueado', icon: OctagonAlert },
  { value: 'check-circle2', label: 'Concluído', icon: CheckCircle2 },
  { value: 'shield-alert', label: 'Alerta', icon: ShieldAlert },
  { value: 'file-search', label: 'Pesquisa', icon: FileSearch },
  { value: 'file-clock', label: 'Pendente', icon: FileClock },
  { value: 'ban', label: 'Cancelado', icon: Ban },
  { value: 'alert-triangle', label: 'Aviso', icon: AlertTriangle },
  { value: 'circle', label: 'Sem estado', icon: Circle },
]

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

function toColor(color: string): string {
  const value = color.trim().toUpperCase()
  if (/^#[0-9A-F]{6}$/.test(value)) return value
  return '#BFC4CC'
}

function colorWithAlpha(color: string, alphaHex: string): string {
  if (typeof document !== 'undefined') {
    const theme = document.documentElement.getAttribute('data-theme')
    const darkTheme =
      theme === 'dark' ||
      theme === 'tokyo-night' ||
      theme === 'synthwave-84' ||
      theme === 'one-dark-pro' ||
      theme === 'night-owl' ||
      theme === 'github-dark'
    if (darkTheme && alphaHex === '1F') {
      return `${toColor(color)}14`
    }
  }
  return `${toColor(color)}${alphaHex}`
}

function getUniqueRecordReferences(record: ReceiptRecord): string[] {
  const candidates = [record.processo, record.pe, record.reciboNumero]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))

  return candidates.filter((value, index, list) => list.findIndex((candidate) => normalizeText(candidate) === normalizeText(value)) === index)
}

function getPrimaryRecordReference(record: ReceiptRecord): string {
  return getUniqueRecordReferences(record)[0] ?? 'Sem referência'
}

function getSecondaryRecordReference(record: ReceiptRecord): string | undefined {
  return getUniqueRecordReferences(record)[1]
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

function sanitizeDashboardFilters(input: unknown): RecordFilters {
  const payload = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const parseNumeric = (value: unknown, min: number, max: number) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < min || numeric > max) return 'todos' as const
    return numeric
  }

  return {
    tipo: payload.tipo === 'exequente' || payload.tipo === 'executado' ? payload.tipo : 'todos',
    estadoId: typeof payload.estadoId === 'string' && payload.estadoId.trim() ? payload.estadoId : 'todos',
    mes: parseNumeric(payload.mes, 1, 12),
    ano: parseNumeric(payload.ano, 2000, 9999),
    exequente: typeof payload.exequente === 'string' ? payload.exequente : '',
    gestor: typeof payload.gestor === 'string' ? payload.gestor : '',
    page: 1,
    pageSize: 300,
  }
}

function defaultDashboardWidgetLayout(type: DashboardWidgetType): {
  size: DashboardWidgetSize
  minHeight: number
  column: DashboardWidgetColumn
  colSpan: number
} {
  if (type.startsWith('kpi-')) {
    return { size: 'kpi', minHeight: 110, column: 'side', colSpan: 1 }
  }
  if (type === 'chart-mensal-emissao' || type === 'chart-status' || type === 'chart-tipo') {
    return { size: 'wide', minHeight: 210, column: 'main', colSpan: 2 }
  }
  return { size: 'normal', minHeight: 180, column: 'main', colSpan: 1 }
}

function sanitizeDashboardWidgetSize(value: unknown, fallback: DashboardWidgetSize): DashboardWidgetSize {
  if (value === 'kpi' || value === 'normal' || value === 'wide') {
    return value
  }
  return fallback
}

function sanitizeDashboardWidgetColumn(value: unknown, fallback: DashboardWidgetColumn): DashboardWidgetColumn {
  if (value === 'main' || value === 'side') {
    return value
  }
  return fallback
}

function clampDashboardWidgetHeight(value: number): number {
  if (!Number.isFinite(value)) return DASHBOARD_WIDGET_MIN_HEIGHT
  return Math.min(DASHBOARD_WIDGET_MAX_HEIGHT, Math.max(DASHBOARD_WIDGET_MIN_HEIGHT, Math.round(value)))
}

function clampDashboardWidgetColSpan(value: number): number {
  if (!Number.isFinite(value)) return DASHBOARD_WIDGET_MIN_COL_SPAN
  return Math.min(DASHBOARD_WIDGET_MAX_COL_SPAN, Math.max(DASHBOARD_WIDGET_MIN_COL_SPAN, Math.round(value)))
}

function parseDashboardWidgets(input: unknown): DashboardWidget[] {
  if (!Array.isArray(input)) return []
  const allowed = new Set<DashboardWidgetType>(DASHBOARD_WIDGET_LIBRARY.map((widget) => widget.type))
  return input
    .map((item) => {
      if (typeof item !== 'object' || item === null) return null
      const widget = item as { id?: unknown; type?: unknown; size?: unknown; minHeight?: unknown; column?: unknown; colSpan?: unknown }
      if (typeof widget.type !== 'string' || !allowed.has(widget.type as DashboardWidgetType)) return null
      const baseLayout = defaultDashboardWidgetLayout(widget.type as DashboardWidgetType)
      const numericHeight = Number(widget.minHeight)
      const numericColSpan = Number(widget.colSpan)
      const parsedColumn = sanitizeDashboardWidgetColumn(widget.column, baseLayout.column)
      return {
        id: typeof widget.id === 'string' && widget.id.trim() ? widget.id : crypto.randomUUID(),
        type: widget.type as DashboardWidgetType,
        size: sanitizeDashboardWidgetSize(widget.size, baseLayout.size),
        minHeight: clampDashboardWidgetHeight(Number.isFinite(numericHeight) ? numericHeight : baseLayout.minHeight),
        column: parsedColumn,
        colSpan: parsedColumn === 'side' ? 1 : clampDashboardWidgetColSpan(Number.isFinite(numericColSpan) ? numericColSpan : baseLayout.colSpan),
      }
    })
    .filter((widget): widget is DashboardWidget => Boolean(widget))
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

type UndoAction = {
  id: string
  label: string
  run: () => Promise<void>
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

function renderStatusIcon(iconName: string, size = 14) {
  if (iconName === 'hammer') return <Hammer size={size} />
  if (iconName === 'clock3') return <Clock3 size={size} />
  if (iconName === 'search-check') return <SearchCheck size={size} />
  if (iconName === 'receipt-text') return <ReceiptText size={size} />
  if (iconName === 'octagon-alert') return <OctagonAlert size={size} />
  if (iconName === 'check-circle2') return <CheckCircle2 size={size} />
  if (iconName === 'shield-alert') return <ShieldAlert size={size} />
  if (iconName === 'file-search') return <FileSearch size={size} />
  if (iconName === 'file-clock') return <FileClock size={size} />
  if (iconName === 'ban') return <Ban size={size} />
  if (iconName === 'alert-triangle') return <AlertTriangle size={size} />
  return <Circle size={size} />
}

function getExequenteLogoUrl(name?: string): string | undefined {
  if (!name || !LOGO_DEV_TOKEN) {
    return undefined
  }

  const normalized = normalizeText(name)

  // If user typed a domain-like value, use it directly.
  if (/^[A-Z0-9.-]+\\.[A-Z]{2,}$/i.test(name.trim())) {
    return `https://img.logo.dev/${name.trim().toLowerCase()}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=64&format=png`
  }

  const mappedDomain = EXEQUENTE_DOMAIN_MAP[normalized]
  if (mappedDomain) {
    return `https://img.logo.dev/${mappedDomain}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=64&format=png`
  }

  const keywordMatch = EXEQUENTE_KEYWORD_DOMAIN.find((entry) => normalized.includes(entry.keyword))
  if (keywordMatch) {
    return `https://img.logo.dev/${keywordMatch.domain}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=64&format=png`
  }

  return undefined
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('entrada')
  const [statuses, setStatuses] = useState<StatusDefinition[]>([])
  const [records, setRecords] = useState<ReceiptRecord[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [calculationSettings, setCalculationSettings] = useState<CalculationSettings>(EMPTY_CALC_SETTINGS)

  const [bootstrapLoading, setBootstrapLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [feedbackClosing, setFeedbackClosing] = useState(false)

  const [globalSearch, setGlobalSearch] = useState('')
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<ReceiptRecord | null>(null)
  const [selectedRecordEdit, setSelectedRecordEdit] = useState<EntryForm | null>(null)
  const [isRecordEditing, setIsRecordEditing] = useState(false)
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const [theme, setTheme] = useState<ThemeId>(resolveInitialTheme)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(resolveInitialLayoutMode)
  const [disabledSavedViewIds, setDisabledSavedViewIds] = useState<string[]>(resolveInitialDisabledSavedViewIds)
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null)
  const [totalsHoverOpen, setTotalsHoverOpen] = useState(false)
  const [selectedTotalMetrics, setSelectedTotalMetrics] = useState<TotalMetricKey[]>([
    'registos',
    'valorSemIva',
    'iva',
    'levantadoComIva',
  ])

  const [filters, setFilters] = useState<RecordFilters>(DEFAULT_TABLE_FILTERS)
  const [dashboardFilters, setDashboardFilters] = useState<RecordFilters>(DEFAULT_DASHBOARD_FILTERS)
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([])
  const [dashboardName, setDashboardName] = useState('Dashboard')
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(null)
  const [dashboardSummary, setDashboardSummary] = useState<AnalyticsSummary | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardFocusMode, setDashboardFocusMode] = useState(false)
  const [dashboardConfigOpen, setDashboardConfigOpen] = useState(true)
  const [dashboardPickerOpen, setDashboardPickerOpen] = useState(false)
  const [dashboardFiltersOpen, setDashboardFiltersOpen] = useState(false)
  const [draggedDashboardWidgetId, setDraggedDashboardWidgetId] = useState<string | null>(null)
  const [dropDashboardWidgetId, setDropDashboardWidgetId] = useState<string | null>(null)
  const [resizingDashboardWidgetId, setResizingDashboardWidgetId] = useState<string | null>(null)

  const [entryForm, setEntryForm] = useState<EntryForm>(getInitialEntryForm(''))

  const [bulkStatusId, setBulkStatusId] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
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

  const [settingsDraft, setSettingsDraft] = useState<CalculationSettings>(EMPTY_CALC_SETTINGS)
  const [recordSuggestions, setRecordSuggestions] = useState<RecordSuggestions>(EMPTY_RECORD_SUGGESTIONS)
  const widgetResizeRef = useRef<{ widgetId: string; startY: number; startHeight: number } | null>(null)

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
  const brandLogoSrc = isDarkLikeTheme(theme) ? '/mesa-de-recibos-logo-dark.svg' : '/mesa-de-recibos-logo.svg'

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

  const recentRecords = useMemo(() => [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 12), [records])

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
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('mesa-recibos-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('mesa-recibos-layout', layoutMode)
  }, [layoutMode])

  useEffect(() => {
    localStorage.setItem('mesa-recibos-disabled-saved-views', JSON.stringify(disabledSavedViewIds))
  }, [disabledSavedViewIds])

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
    void (async () => {
      setBootstrapLoading(true)
      setPageError('')
      try {
        const bootstrap = await api.bootstrap()
        setStatuses(bootstrap.statuses)
        setSavedViews(bootstrap.savedViews)
        setCalculationSettings(bootstrap.calculationSettings)
        setSettingsDraft(bootstrap.calculationSettings)

        const fallbackStatus = bootstrap.statuses.find((status) => status.active) ?? bootstrap.statuses[0]
        if (fallbackStatus) {
          setEntryForm(getInitialEntryForm(fallbackStatus.id))
          setBulkStatusId(fallbackStatus.id)
        }

        await migrateLegacyLocalStorageIfPresent()

        if (bootstrap.recordCount === 0) {
          const seed = await api.seedDatabase(false)
          setFeedback(`Dados base carregados: ${seed.created} novos registos.`)
        }

        await refreshRecords()
      } catch (error) {
        setPageError(error instanceof Error ? error.message : 'Falha ao carregar aplicação.')
      } finally {
        setBootstrapLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!bootstrapLoading) {
      void refreshRecords()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, globalSearch])

  useEffect(() => {
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
  }, [selectedRecordId, records])

  useEffect(() => {
    if (!selectedRecord) {
      setSelectedRecordEdit(null)
      setIsRecordEditing(false)
      return
    }

    setSelectedRecordEdit(recordToForm(selectedRecord))
  }, [selectedRecord])

  useEffect(() => {
    if (!activeDashboardId) return
    const viewStillExists = dashboardViews.some((view) => view.id === activeDashboardId)
    if (!viewStillExists) {
      setActiveDashboardId(null)
      setDashboardName('Dashboard')
      setDashboardFilters(DEFAULT_DASHBOARD_FILTERS)
      setDashboardWidgets([])
    }
  }, [activeDashboardId, dashboardViews])

  useEffect(() => {
    if (activeTab !== 'dashboards') return
    void refreshDashboardSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dashboardFilters, globalSearch])

  useEffect(() => {
    if (activeTab !== 'dashboards' && dashboardFocusMode) {
      setDashboardFocusMode(false)
    }
  }, [activeTab, dashboardFocusMode])

  useEffect(() => {
    if (!resizingDashboardWidgetId) return

    function onPointerMove(event: MouseEvent) {
      const resizeState = widgetResizeRef.current
      if (!resizeState) return
      const deltaY = event.clientY - resizeState.startY
      const nextHeight = clampDashboardWidgetHeight(resizeState.startHeight + deltaY)
      setDashboardWidgets((current) =>
        current.map((widget) => (widget.id === resizeState.widgetId ? { ...widget, minHeight: nextHeight } : widget)),
      )
    }

    function stopResize() {
      widgetResizeRef.current = null
      setResizingDashboardWidgetId(null)
    }

    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', stopResize, { once: true })
    return () => {
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('mouseup', stopResize)
    }
  }, [resizingDashboardWidgetId])

  function pushUndo(label: string, run: () => Promise<void>) {
    setUndoStack((current) => {
      const next = [...current, { id: crypto.randomUUID(), label, run }]
      return next.slice(-20)
    })
  }

  async function runUndo() {
    const action = latestUndo
    if (!action) return

    setUndoStack((current) => current.slice(0, -1))
    try {
      await action.run()
      await refreshRecords()
      setFeedback(`Anulado: ${action.label}.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao anular a última ação.')
    }
  }

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

  async function refreshRecords() {
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
  }

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

  function loadDashboardView(view: SavedView) {
    const payload = (view.filters ?? {}) as Record<string, unknown>
    const viewFilters = payload.filters && typeof payload.filters === 'object' ? payload.filters : payload
    setActiveDashboardId(view.id)
    setDashboardName(view.name || 'Dashboard')
    setDashboardFilters(sanitizeDashboardFilters(viewFilters))
    setDashboardWidgets(parseDashboardWidgets(payload.widgets))
  }

  function addDashboardWidget(type: DashboardWidgetType) {
    const baseLayout = defaultDashboardWidgetLayout(type)
    setDashboardWidgets((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type,
        size: baseLayout.size,
        minHeight: baseLayout.minHeight,
        column: baseLayout.column,
        colSpan: baseLayout.column === 'side' ? 1 : baseLayout.colSpan,
      },
    ])
  }

  function removeDashboardWidget(widgetId: string) {
    setDashboardWidgets((current) => current.filter((widget) => widget.id !== widgetId))
  }

  function moveDashboardWidget(widgetId: string, direction: -1 | 1) {
    setDashboardWidgets((current) => {
      const index = current.findIndex((widget) => widget.id === widgetId)
      if (index < 0) return current
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  function reorderDashboardWidgets(sourceWidgetId: string, targetWidgetId: string) {
    if (sourceWidgetId === targetWidgetId) return
    setDashboardWidgets((current) => {
      const sourceIndex = current.findIndex((widget) => widget.id === sourceWidgetId)
      const targetIndex = current.findIndex((widget) => widget.id === targetWidgetId)
      if (sourceIndex < 0 || targetIndex < 0) return current

      const next = [...current]
      const [source] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, source)
      return next
    })
  }

  function adjustDashboardWidgetWidth(widgetId: string, delta: number) {
    setDashboardWidgets((current) =>
      current.map((widget) => {
        if (widget.id !== widgetId) return widget
        if (widget.column === 'side') return widget
        const baseLayout = defaultDashboardWidgetLayout(widget.type)
        const nextColSpan = clampDashboardWidgetColSpan((widget.colSpan || baseLayout.colSpan) + delta)
        return {
          ...widget,
          colSpan: nextColSpan,
          size: nextColSpan >= 2 ? 'wide' : widget.type.startsWith('kpi-') ? 'kpi' : 'normal',
        }
      }),
    )
  }

  function toggleDashboardWidgetColumn(widgetId: string) {
    setDashboardWidgets((current) =>
      current.map((widget) => {
        if (widget.id !== widgetId) return widget
        const baseLayout = defaultDashboardWidgetLayout(widget.type)
        const nextColumn = widget.column === 'side' ? 'main' : 'side'
        const nextColSpan = nextColumn === 'side' ? 1 : clampDashboardWidgetColSpan(widget.colSpan || baseLayout.colSpan)
        return {
          ...widget,
          column: nextColumn,
          colSpan: nextColSpan,
          size: nextColSpan >= 2 ? 'wide' : widget.type.startsWith('kpi-') ? 'kpi' : 'normal',
        }
      }),
    )
  }

  function adjustDashboardWidgetHeight(widgetId: string, delta: number) {
    setDashboardWidgets((current) =>
      current.map((widget) =>
        widget.id === widgetId
          ? {
              ...widget,
              minHeight: clampDashboardWidgetHeight(widget.minHeight + delta),
            }
          : widget,
      ),
    )
  }

  function startDashboardWidgetResize(event: ReactMouseEvent<HTMLButtonElement>, widget: DashboardWidget) {
    event.preventDefault()
    event.stopPropagation()
    widgetResizeRef.current = {
      widgetId: widget.id,
      startY: event.clientY,
      startHeight: widget.minHeight,
    }
    setResizingDashboardWidgetId(widget.id)
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
        pushUndo(`estado de ${previous.pe || previous.processo || previous.reciboNumero || 'registo'}`, async () => {
          await updateRecordStatus(recordId, previous.estadoId, { registerUndo: false })
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
        pushUndo('alteração de estado em lote', async () => {
          await Promise.all(before.map((item) => api.updateRecordStatus(item.id, item.estadoId)))
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
        pushUndo('edição em lote', async () => {
          await Promise.all(before.map((record) => api.patchRecord(record.id, recordToPatchPayload(record))))
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
      pushUndo(`edição de ${previous.pe || previous.processo || previous.reciboNumero || 'registo'}`, async () => {
        await api.patchRecord(previous.id, recordToPatchPayload(previous))
      })
      setIsRecordEditing(false)
      await refreshRecords()
      setSelectedRecordId(previous.id)
      setFeedback('Registo atualizado.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar registo.')
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

  function exportCurrentTableToCsv() {
    const header = ['Tipo', 'Ano', 'Mês', 'PE', 'Processo', 'Recibo', 'Gestor', 'Exequente', 'Valor sem IVA', 'IVA', 'Retenção', 'Meu 5%', 'Estado']
    const rows = records.map((record) => {
      const status = getStatus(statuses, record.estadoId)
      return [
        record.tipo,
        String(record.ano),
        MONTHS[record.mes - 1] ?? String(record.mes),
        record.pe ?? '',
        record.processo ?? '',
        record.reciboNumero ?? '',
        record.gestor ?? '',
        record.exequente ?? '',
        record.valorSemIva?.toString() ?? '',
        record.iva?.toString() ?? '',
        record.retencao?.toString() ?? '',
        record.meu5?.toString() ?? '',
        status?.label ?? '',
      ]
    })

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `mesa-recibos-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
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

  async function saveCurrentView(scope: 'tabela', filtersPayload: Record<string, unknown>) {
    const name = window.prompt('Nome da vista')
    if (!name) return

    try {
      const created = await api.createSavedView({ name, scope, filters: filtersPayload })
      setSavedViews((current) => [created, ...current])
      setFeedback('Vista guardada.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao guardar vista.')
    }
  }

  async function deleteSavedView(viewId: string) {
    const confirmed = window.confirm('Eliminar esta vista guardada?')
    if (!confirmed) return

    try {
      await api.deleteSavedView(viewId)
      const nextSavedViews = savedViews.filter((view) => view.id !== viewId)
      const nextDisabledIds = disabledSavedViewIds.filter((id) => id !== viewId)
      setSavedViews(nextSavedViews)
      setDisabledSavedViewIds(nextDisabledIds)
      if (activeSavedViewId === viewId) {
        const fallbackView = nextSavedViews
          .filter((view) => view.scope === 'tabela')
          .find((view) => !nextDisabledIds.includes(view.id))
        if (fallbackView) {
          applyView(fallbackView, { enableIfDisabled: false })
        } else {
          clearTableFilters({ silent: true })
        }
      }
      setFeedback('Vista eliminada.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao eliminar vista.')
    }
  }

  function toggleSavedViewDisabled(viewId: string) {
    const isDisabled = disabledSavedViewIds.includes(viewId)

    if (isDisabled) {
      setDisabledSavedViewIds((current) => current.filter((id) => id !== viewId))
      const view = tableViews.find((item) => item.id === viewId)
      if (view) {
        applyView(view, { enableIfDisabled: false })
      }
      return
    }

    const nextDisabledIds = [...disabledSavedViewIds, viewId]
    setDisabledSavedViewIds(nextDisabledIds)

    if (activeSavedViewId === viewId) {
      const fallbackView = tableViews.find((view) => view.id !== viewId && !nextDisabledIds.includes(view.id))
      if (fallbackView) {
        applyView(fallbackView, { enableIfDisabled: false })
      } else {
        clearTableFilters({ silent: true })
      }
    }
  }

  function clearTableFilters(options?: { silent?: boolean }) {
    setFilters(DEFAULT_TABLE_FILTERS)
    setGlobalSearch('')
    setActiveSavedViewId(null)
    if (!options?.silent) {
      setFeedback('Filtros limpos.')
    }
  }

  function applyView(view: SavedView, options?: { enableIfDisabled?: boolean }) {
    const payload = view.filters
    setActiveSavedViewId(view.id)
    if (options?.enableIfDisabled ?? true) {
      setDisabledSavedViewIds((current) => current.filter((id) => id !== view.id))
    }
    setFilters((current) => ({
      ...current,
      tipo: (payload.tipo as RecordFilters['tipo']) ?? 'todos',
      estadoId: (payload.estadoId as RecordFilters['estadoId']) ?? 'todos',
      mes: (payload.mes as RecordFilters['mes']) ?? 'todos',
      ano: (payload.ano as RecordFilters['ano']) ?? 'todos',
      exequente: (payload.exequente as RecordFilters['exequente']) ?? '',
      gestor: (payload.gestor as RecordFilters['gestor']) ?? '',
      page: 1,
    }))
    setGlobalSearch(typeof payload.q === 'string' ? payload.q : '')
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
        className={`dashboard-widget-card size-${widget.size} span-${effectiveColSpan} ${draggedDashboardWidgetId === widget.id ? 'dragging' : ''} ${
          dropDashboardWidgetId === widget.id ? 'drop-target' : ''
        } ${resizingDashboardWidgetId === widget.id ? 'resizing' : ''}`}
        style={{ height: `${widget.minHeight}px` }}
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
            onMouseDown={(event) => startDashboardWidgetResize(event, widget)}
          >
            ⇳
          </button>
        </div>
      </article>
    )
  }

  const topActionButtons = (
    <div className="top-actions">
      <button
        className="subtle-btn icon-btn"
        type="button"
        disabled={!latestUndo}
        onClick={() => void runUndo()}
        title={latestUndo ? `Anular: ${latestUndo.label}` : 'Sem ações para anular'}
        aria-label={latestUndo ? `Anular: ${latestUndo.label}` : 'Sem ações para anular'}
      >
        <Undo2 size={15} />
      </button>
      <button
        className="subtle-btn icon-btn"
        type="button"
        onClick={() => setLayoutMode((current) => (current === 'wide' ? 'narrow' : 'wide'))}
        title={layoutMode === 'wide' ? 'Compacto' : 'Expandir'}
        aria-label={layoutMode === 'wide' ? 'Compacto' : 'Expandir'}
      >
        {layoutMode === 'wide' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
      <button
        className="primary-btn icon-btn"
        type="button"
        onClick={() => setActiveTab('entrada')}
        title="Novo registo"
        aria-label="Novo registo"
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
    return <div className={`app-shell ${layoutMode === 'wide' ? 'wide' : ''} ${ENABLE_NEO_REDESIGN_EXPERIMENT ? 'neo-experiment' : ''}`}><div className="panel">A carregar aplicação...</div></div>
  }

  if (pageError) {
    return <div className={`app-shell ${layoutMode === 'wide' ? 'wide' : ''} ${ENABLE_NEO_REDESIGN_EXPERIMENT ? 'neo-experiment' : ''}`}><div className="panel">Erro: {pageError}</div></div>
  }

  return (
    <div
      className={`app-shell ${layoutMode === 'wide' || isDashboardFocusMode ? 'wide' : ''} ${ENABLE_NEO_REDESIGN_EXPERIMENT ? 'neo-experiment' : ''} ${
        isDashboardFocusMode ? 'dashboard-focus-mode' : ''
      }`}
    >
      <header className={`topbar ${ENABLE_UNIFIED_HEADER_LAYOUT ? 'unified' : ''}`}>
        <div className="brand-block">
          <img className="brand-logo-img" src={brandLogoSrc} alt="Mesa de Recibos" />
          <div className="brand-subtitle">Postgres + API · Entrada e consulta de recibos</div>
        </div>

        {ENABLE_UNIFIED_HEADER_LAYOUT ? (
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
                    setGlobalSearch(event.target.value)
                  }}
                  placeholder="Pesquisar por processo, PE, recibo, exequente, gestor ou nota..."
                />
                {topActionButtons}
              </div>
            )}
          </div>
        ) : (
          <>
            {!isDashboardFocusMode && (
              <>
                <input
                  className="global-search"
                  value={globalSearch}
                  onChange={(event) => {
                    setActiveSavedViewId(null)
                    setGlobalSearch(event.target.value)
                  }}
                  placeholder="Pesquisar por processo, PE, recibo, exequente, gestor ou nota..."
                />
                {topActionButtons}
              </>
            )}
          </>
        )}
      </header>

      {!ENABLE_UNIFIED_HEADER_LAYOUT && <nav className="tab-nav">{tabButtons}</nav>}

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

      <main className="main-grid">
        {activeTab === 'entrada' && (
          <section className="panel entrada-layout">
            <aside className="panel side-list">
              <div className="row-between">
                <h2>Registos recentes</h2>
                <span className="recent-mode-badge">Lista</span>
              </div>
              <div className="small-note">Últimas alterações</div>
              <div className="recent-list compact">
                {recentRecords.length === 0 ? (
                  <div className="empty-text">Ainda não existem registos.</div>
                ) : (
                  recentRecords.map((record) => {
                    const status = getStatus(statuses, record.estadoId)
                    const reference = getPrimaryRecordReference(record)
                    return (
                      <button
                        key={record.id}
                        className="recent-card"
                        type="button"
                        onClick={() => {
                          setSelectedRecordId(record.id)
                          setActiveTab('consulta')
                        }}
                      >
                        <span>{reference}</span>
                        <EntityIdentity gestor={record.gestor} exequente={record.exequente} />
                        {status && <StatusPill status={status} compact />}
                      </button>
                    )
                  })
                )}
              </div>
            </aside>

            <div className="panel">
              <div className="row-between">
                <div>
                  <h2>Novo registo</h2>
                  <p className="small-note">Campos fiscais calculados automaticamente com base na configuração.</p>
                </div>
                <button className="subtle-btn" type="button" onClick={() => setEntryForm(applyFormAutoCalculations(entryForm, calculationSettings, true))}>
                  Recalcular
                </button>
              </div>

              <form className="entry-form" onSubmit={(event) => void submitEntry(event, 'save')}>
                <div className="field-grid three">
                  <LabeledSelect
                    label="Tipo"
                    value={entryForm.tipo}
                    onChange={(value) => handleEntryInput('tipo', value as RecordType)}
                    options={[
                      { value: 'exequente', label: 'Exequente' },
                      { value: 'executado', label: 'Executado' },
                    ]}
                  />
                  <LabeledSelect
                    label="Mês"
                    value={String(entryForm.mes)}
                    onChange={(value) => handleEntryInput('mes', Number(value))}
                    options={MONTHS.map((label, index) => ({ value: String(index + 1), label }))}
                  />
                  <LabeledInput
                    label="Ano"
                    value={String(entryForm.ano)}
                    onChange={(value) => handleEntryInput('ano', Number(value) || new Date().getFullYear())}
                  />
                </div>

                <div className="field-grid three">
                  <LabeledInput label="Processo" value={entryForm.processo} onChange={(value) => handleEntryInput('processo', value)} suggestions={recordSuggestions.processo} />
                  <LabeledInput label="PE" value={entryForm.pe} onChange={(value) => handleEntryInput('pe', value)} suggestions={recordSuggestions.pe} />
                  <LabeledInput label="N.º de recibo" value={entryForm.reciboNumero} onChange={(value) => handleEntryInput('reciboNumero', value)} suggestions={recordSuggestions.reciboNumero} />
                </div>

                <div className="field-grid four">
                  <LabeledInput type="date" label="Data de levantamento" value={entryForm.dataLevantamento} onChange={(value) => handleEntryInput('dataLevantamento', value)} />
                  <LabeledInput type="date" label="Data de recibo" value={entryForm.dataRecibo} onChange={(value) => handleEntryInput('dataRecibo', value)} />
                  <LabeledInput
                    label="Gestor"
                    value={entryForm.gestor}
                    onChange={(value) => handleEntryInput('gestor', value)}
                    suggestions={gestorSuggestions}
                  />
                  <LabeledInput
                    label="Exequente"
                    value={entryForm.exequente}
                    onChange={(value) => handleEntryInput('exequente', value)}
                    suggestions={exequenteSuggestions}
                  />
                </div>

                <div className="field-grid five">
                  <LabeledInput label="Valor indicado" value={entryForm.valorIndicado} onChange={(value) => handleEntryInput('valorIndicado', value)} />
                  <LabeledInput label="Valor sem IVA" value={entryForm.valorSemIva} onChange={(value) => handleEntryInput('valorSemIva', value)} />
                  <LabeledInput label="IVA" value={entryForm.iva} onChange={(value) => handleEntryInput('iva', value)} />
                  <LabeledInput label="Retenção" value={entryForm.retencao} onChange={(value) => handleEntryInput('retencao', value)} />
                  <LabeledInput label="Meu 5%" value={entryForm.meu5} onChange={(value) => handleEntryInput('meu5', value)} />
                </div>

                <div className="field-grid five">
                  <LabeledInput label="GPESE" value={entryForm.gpeSe} onChange={(value) => handleEntryInput('gpeSe', value)} />
                  <LabeledInput label="Outras taxas" value={entryForm.outrasTaxas} onChange={(value) => handleEntryInput('outrasTaxas', value)} />
                  <LabeledInput label="Valor emissão" value={entryForm.valorEmissao} onChange={(value) => handleEntryInput('valorEmissao', value)} />
                  <LabeledInput label="Descrição valor" value={entryForm.descricaoValor} onChange={(value) => handleEntryInput('descricaoValor', value)} />
                  <LabeledSelect
                    label="Estado"
                    value={entryForm.estadoId}
                    onChange={(value) => handleEntryInput('estadoId', value)}
                    options={activeStatuses.map((status) => ({ value: status.id, label: status.label }))}
                  />
                </div>

                <div className="field-grid one">
                  <LabeledInput label="Indicações de levantamento" value={entryForm.indicacoes} onChange={(value) => handleEntryInput('indicacoes', value)} />
                </div>

                <div className="actions-row">
                  <button type="button" className="subtle-btn" onClick={() => defaultStatus && setEntryForm(getInitialEntryForm(defaultStatus.id))}>
                    Limpar
                  </button>
                  <button type="button" className="subtle-btn" onClick={() => void saveNewEntry()}>
                    Guardar e novo
                  </button>
                  <button type="submit" className="primary-btn">Guardar</button>
                </div>
              </form>
            </div>
          </section>
        )}

        {(activeTab === 'consulta' || activeTab === 'tabela') && (
          <section className="panel">
            <div className="row-between wrap">
              <div>
                <h2>{activeTab === 'consulta' ? 'Consulta' : 'Tabela'}</h2>
                <p className="small-note">Filtros avançados por ano, mês, tipo e estado.</p>
              </div>

              <div className="saved-view-bar">
                {tableViews.map((view) => {
                  const isDisabled = disabledSavedViewIds.includes(view.id)
                  const isActive = activeSavedViewId === view.id && !isDisabled
                  return (
                    <div key={view.id} className={`saved-view-chip ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`}>
                      <button
                        className="subtle-btn saved-view-apply"
                        type="button"
                        onClick={() => applyView(view)}
                        disabled={isDisabled}
                        title={isDisabled ? 'Vista desativada' : `Aplicar vista: ${view.name}`}
                      >
                        {view.name}
                      </button>
                      <button
                        className="subtle-btn icon-btn micro"
                        type="button"
                        onClick={() => toggleSavedViewDisabled(view.id)}
                        title={isDisabled ? 'Ativar vista' : 'Desativar vista'}
                        aria-label={isDisabled ? 'Ativar vista' : 'Desativar vista'}
                      >
                        {isDisabled ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        className="subtle-btn icon-btn micro danger"
                        type="button"
                        onClick={() => void deleteSavedView(view.id)}
                        title="Eliminar vista"
                        aria-label="Eliminar vista"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
                <div
                  className="totals-hover-wrap"
                  onMouseEnter={() => setTotalsHoverOpen(true)}
                  onMouseLeave={() => setTotalsHoverOpen(false)}
                >
                  <button
                    className="subtle-btn totals-trigger"
                    type="button"
                    onClick={() => setTotalsHoverOpen((current) => !current)}
                    aria-expanded={totalsHoverOpen}
                    aria-haspopup="dialog"
                  >
                    Totais
                  </button>
                  {totalsHoverOpen && (
                    <div className="totals-hover-panel" role="dialog" aria-label="Selecionar totais">
                      <div className="totals-options">
                        {TOTAL_METRIC_OPTIONS.map((option) => (
                          <label key={option.key} className="totals-option">
                            <input
                              type="checkbox"
                              checked={selectedTotalMetrics.includes(option.key)}
                              onChange={() => toggleTotalMetric(option.key)}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="totals-values">
                        {selectedTotalMetrics.map((metricKey) => {
                          const option = TOTAL_METRIC_OPTIONS.find((item) => item.key === metricKey)
                          if (!option) return null
                          const value = totalsSnapshot[metricKey]
                          return (
                            <div key={metricKey} className="totals-value-item">
                              <span>{option.label}</span>
                              <strong>{option.currency ? formatCurrency(typeof value === 'number' ? value : undefined) : String(value)}</strong>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <button className="subtle-btn" type="button" onClick={() => clearTableFilters()}>
                  <FilterX size={15} />
                  Limpar filtros
                </button>
                <button
                  className="subtle-btn"
                  type="button"
                  onClick={() => void saveCurrentView('tabela', { ...filters, q: globalSearch })}
                >
                  Guardar vista
                </button>
              </div>
            </div>

            <div className="filters-row seven">
              <LabeledSelect
                label="Tipo"
                value={String(filters.tipo ?? 'todos')}
                onChange={(value) => patchFilters('tipo', value as RecordFilters['tipo'])}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'exequente', label: 'Exequentes' },
                  { value: 'executado', label: 'Executados' },
                ]}
              />
              <LabeledSelect
                label="Estado"
                value={String(filters.estadoId ?? 'todos')}
                onChange={(value) => patchFilters('estadoId', value as RecordFilters['estadoId'])}
                options={[{ value: 'todos', label: 'Todos' }, ...orderedStatuses.map((status) => ({ value: status.id, label: status.label }))]}
              />
              <LabeledSelect
                label="Mês"
                value={String(filters.mes ?? 'todos')}
                onChange={(value) => patchFilters('mes', value === 'todos' ? 'todos' : Number(value))}
                options={[{ value: 'todos', label: 'Todos' }, ...MONTHS.map((label, index) => ({ value: String(index + 1), label }))]}
              />
              <LabeledSelect
                label="Ano"
                value={String(filters.ano ?? 'todos')}
                onChange={(value) => patchFilters('ano', value === 'todos' ? 'todos' : Number(value))}
                options={[{ value: 'todos', label: 'Todos' }, ...years.map((year) => ({ value: String(year), label: String(year) }))]}
              />
              <LabeledSelect
                label="Exequente"
                value={String(filters.exequente ?? '')}
                onChange={(value) => patchFilters('exequente', value)}
                options={[{ value: '', label: 'Todos' }, ...exequenteFilterOptions.map((value) => ({ value, label: value }))]}
              />
              <LabeledSelect
                label="Gestor"
                value={String(filters.gestor ?? '')}
                onChange={(value) => patchFilters('gestor', value)}
                options={[{ value: '', label: 'Todos' }, ...gestorFilterOptions.map((value) => ({ value, label: value }))]}
              />
              <div className="field">
                <span>Total</span>
                <div className="counter-box">{recordsLoading ? 'A carregar...' : `${totalRecords} registos`}</div>
              </div>
            </div>

            {activeTab === 'tabela' && (
              <div className="bulk-panel">
                <div className="bulk-panel-header">
                  <button
                    className="subtle-btn"
                    type="button"
                    onClick={() => {
                      setBulkSectionOpen((current) => {
                        const next = !current
                        if (!next) setBulkPanelOpen(false)
                        return next
                      })
                    }}
                    aria-expanded={bulkSectionOpen}
                  >
                    {bulkSectionOpen ? 'Ocultar ações em lote' : 'Mostrar ações em lote'}
                  </button>
                  <span className="bulk-selected-badge">{selectedIds.length} selecionados</span>
                </div>

                {bulkSectionOpen && (
                  <>
                    <div className="bulk-row bulk-row-top">
                      <label className="inline-check">
                        <input type="checkbox" checked={allSelectedInTable} onChange={toggleSelectAllRecords} />
                        Selecionar todos
                      </label>
                      <button className="subtle-btn" type="button" onClick={exportCurrentTableToCsv}>
                        Exportar CSV
                      </button>
                    </div>

                    <div className="bulk-row bulk-row-main">
                      <label className="field bulk-inline-field">
                        <span>Novo estado</span>
                        <select value={bulkStatusId} onChange={(event) => setBulkStatusId(event.target.value)}>
                          {orderedStatuses.map((status) => (
                            <option key={status.id} value={status.id}>{status.label}</option>
                          ))}
                        </select>
                      </label>
                      <button className="primary-btn" type="button" onClick={() => void runBulkStatusUpdate()} disabled={selectedIds.length === 0}>
                        Aplicar estado
                      </button>
                      <button className="subtle-btn" type="button" onClick={() => setBulkPanelOpen((current) => !current)}>
                        {bulkPanelOpen ? 'Ocultar edição avançada' : 'Editar campos em lote'}
                      </button>
                    </div>

                    {bulkPanelOpen && (
                      <div className="bulk-advanced">
                        <div className="bulk-advanced-grid">
                          <label className="field">
                            <span>Gestor (lote)</span>
                            <AutocompleteInput
                              value={bulkGestor}
                              onChange={(value) => setBulkGestor(value)}
                              suggestions={gestorSuggestions}
                              placeholder="Gestor"
                            />
                          </label>
                          <label className="field">
                            <span>Exequente (lote)</span>
                            <AutocompleteInput
                              value={bulkExequente}
                              onChange={(value) => setBulkExequente(value)}
                              suggestions={exequenteSuggestions}
                              placeholder="Exequente"
                            />
                          </label>
                          <label className="field">
                            <span>Indicações (lote)</span>
                            <input
                              value={bulkIndicacoes}
                              onChange={(event) => setBulkIndicacoes(event.target.value)}
                              placeholder="Indicações"
                              aria-label="Indicações em lote"
                            />
                          </label>
                        </div>
                        <div className="bulk-row bulk-row-advanced-actions">
                          <label className="inline-check">
                            <input
                              type="checkbox"
                              checked={bulkForceRecalculate}
                              onChange={(event) => setBulkForceRecalculate(event.target.checked)}
                            />
                            Recalcular impostos automaticamente
                          </label>
                          <button className="subtle-btn" type="button" onClick={() => void runBulkFieldUpdate()} disabled={selectedIds.length === 0}>
                            Aplicar edição avançada
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {records.length === 0 ? (
              <div className="empty-text">Sem resultados para os filtros selecionados.</div>
            ) : activeTab === 'consulta' ? (
              <div className="card-list">
                {records.map((record) => {
                  const status = getStatus(statuses, record.estadoId)
                  const primaryReference = getPrimaryRecordReference(record)
                  const secondaryReference = getSecondaryRecordReference(record)
                  const monthYear = `${MONTHS[record.mes - 1] ?? `Mês ${record.mes}`} ${record.ano}`
                  return (
                    <article key={record.id} className="result-card clickable-row" onClick={() => setSelectedRecordId(record.id)}>
                      <div className="result-main">
                        <div className="result-title">{primaryReference}</div>
                        <div className="muted">{secondaryReference ? `${secondaryReference} · ${monthYear}` : monthYear}</div>
                      </div>
                      <div className="result-entity muted">
                        <EntityIdentity gestor={record.gestor} exequente={record.exequente} />
                      </div>
                      <div className="result-value">{formatCurrency(record.valorEmissao ?? record.valorSemIva ?? record.valorIndicado)}</div>
                      <div className="card-actions">
                        <button
                          className="subtle-btn"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedRecordId(record.id)
                            setIsRecordEditing(true)
                          }}
                        >
                          Editar
                        </button>
                      </div>
                      <div className="result-status">
                        {status ? <StatusPill status={status} /> : <span className="muted">Sem estado</span>}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="records-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Tipo</th>
                      <th>Ano/Mês</th>
                      <th>PE</th>
                      <th>Processo</th>
                      <th>Recibo</th>
                      <th>Gestor/Exequente</th>
                      <th>Sem IVA</th>
                      <th>IVA</th>
                      <th>Retenção</th>
                      <th>Meu 5%</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const status = getStatus(statuses, record.estadoId)
                      return (
                        <tr
                          key={record.id}
                          style={{ backgroundColor: status ? colorWithAlpha(status.color, '1F') : undefined }}
                          onClick={() => setSelectedRecordId(record.id)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(record.id)}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleSelectRecord(record.id)}
                            />
                          </td>
                          <td>{record.tipo === 'exequente' ? 'Exequente' : 'Executado'}</td>
                          <td>{record.ano}/{String(record.mes).padStart(2, '0')}</td>
                          <td>{record.pe || '-'}</td>
                          <td>{record.processo || '-'}</td>
                          <td>{record.reciboNumero || '-'}</td>
                          <td>
                            <EntityIdentity gestor={record.gestor} exequente={record.exequente} />
                          </td>
                          <td>{formatCurrency(record.valorSemIva)}</td>
                          <td>{formatCurrency(record.iva)}</td>
                          <td>{formatCurrency(record.retencao)}</td>
                          <td>{formatCurrency(record.meu5)}</td>
                          <td>
                            <div className="status-cell-actions">
                              <select
                                value={record.estadoId}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => void updateRecordStatus(record.id, event.target.value)}
                              >
                                {orderedStatuses.map((statusOption) => (
                                  <option key={statusOption.id} value={statusOption.id}>{statusOption.label}</option>
                                ))}
                              </select>
                              <button
                                className="subtle-btn compact"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setSelectedRecordId(record.id)
                                  setIsRecordEditing(true)
                                }}
                              >
                                Editar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'dashboards' && (
          <section className="panel dashboard-experiment">
            {!isDashboardFocusMode && (
              <>
                <div className="row-between wrap">
                  <div>
                    <h2>Dashboards</h2>
                    <p className="small-note">Começa vazio e adiciona widgets pré-configurados para foco imediato.</p>
                  </div>
                  <div className="dashboard-top-actions">
                    <button className="subtle-btn" type="button" onClick={() => setDashboardFocusMode(true)}>
                      <Maximize2 size={15} />
                      Expandir dashboard
                    </button>
                    <button className="subtle-btn" type="button" onClick={() => setDashboardConfigOpen((current) => !current)}>
                      {dashboardConfigOpen ? <EyeOff size={15} /> : <Eye size={15} />}
                      {dashboardConfigOpen ? 'Ocultar painel' : 'Mostrar painel'}
                    </button>
                    <button
                      className="subtle-btn"
                      type="button"
                      onClick={() => {
                        resetDashboardDraft()
                        setDashboardPickerOpen(true)
                      }}
                    >
                      <Plus size={15} />
                      Novo dashboard
                    </button>
                    <button className="subtle-btn" type="button" onClick={() => void saveDashboard()}>
                      <Save size={15} />
                      Guardar
                    </button>
                    <button className="subtle-btn" type="button" onClick={() => void saveDashboard({ asNew: true })}>
                      Guardar como
                    </button>
                    <button className="subtle-btn" type="button" disabled={!activeDashboardId} onClick={() => void deleteDashboard()}>
                      <Trash2 size={15} />
                      Eliminar
                    </button>
                  </div>
                </div>

                {dashboardConfigOpen ? (
                  <>
                    <div className="dashboard-hero-grid">
                      <div className="dashboard-hero-card">
                        <span>Total registos</span>
                        <strong>{dashboardLoading ? '...' : new Intl.NumberFormat('pt-PT').format(dashboardSummary?.totals.registos ?? 0)}</strong>
                      </div>
                      <div className="dashboard-hero-card">
                        <span>Total emissão</span>
                        <strong>{dashboardLoading ? '...' : formatCurrency(dashboardSummary?.totals.valorEmissao)}</strong>
                      </div>
                      <div className="dashboard-hero-card">
                        <span>Levantado c/ IVA</span>
                        <strong>{dashboardLoading ? '...' : formatCurrency(dashboardSummary?.totals.levantadoComIva)}</strong>
                      </div>
                    </div>

                    <div className="dashboard-controls-grid simple">
                      <label className="field">
                        <span>Dashboard ativo</span>
                        <select
                          value={activeDashboardId ?? ''}
                          onChange={(event) => {
                            const nextId = event.target.value
                            if (!nextId) {
                              resetDashboardDraft()
                              return
                            }
                            const found = dashboardViews.find((view) => view.id === nextId)
                            if (found) {
                              loadDashboardView(found)
                            }
                          }}
                        >
                          <option value="">Rascunho não guardado</option>
                          {dashboardViews.map((view) => (
                            <option key={view.id} value={view.id}>
                              {view.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <LabeledInput label="Nome" value={dashboardName} onChange={(value) => setDashboardName(value)} />
                    </div>

                    <div className="dashboard-filter-toolbar">
                      <button className="subtle-btn" type="button" onClick={() => setDashboardFiltersOpen((current) => !current)}>
                        {dashboardFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
                      </button>
                      <span className="muted">
                        {dashboardActiveFilterCount} filtros ativos · {dashboardLoading ? 'A calcular...' : `${dashboardSummary?.totals.registos ?? 0} registos`}
                      </span>
                      <button
                        className="subtle-btn"
                        type="button"
                        onClick={() => setDashboardFilters(DEFAULT_DASHBOARD_FILTERS)}
                        disabled={dashboardActiveFilterCount === 0}
                      >
                        <FilterX size={15} />
                        Limpar
                      </button>
                    </div>

                    {dashboardFiltersOpen && (
                      <div className="dashboard-filters-grid">
                        <LabeledSelect
                          label="Tipo"
                          value={String(dashboardFilters.tipo ?? 'todos')}
                          onChange={(value) => patchDashboardFilters('tipo', value as RecordFilters['tipo'])}
                          options={[
                            { value: 'todos', label: 'Todos' },
                            { value: 'exequente', label: 'Exequentes' },
                            { value: 'executado', label: 'Executados' },
                          ]}
                        />
                        <LabeledSelect
                          label="Estado"
                          value={String(dashboardFilters.estadoId ?? 'todos')}
                          onChange={(value) => patchDashboardFilters('estadoId', value as RecordFilters['estadoId'])}
                          options={[{ value: 'todos', label: 'Todos' }, ...orderedStatuses.map((status) => ({ value: status.id, label: status.label }))]}
                        />
                        <LabeledSelect
                          label="Mês"
                          value={String(dashboardFilters.mes ?? 'todos')}
                          onChange={(value) => patchDashboardFilters('mes', value === 'todos' ? 'todos' : Number(value))}
                          options={[{ value: 'todos', label: 'Todos' }, ...MONTHS.map((label, index) => ({ value: String(index + 1), label }))]}
                        />
                        <LabeledSelect
                          label="Ano"
                          value={String(dashboardFilters.ano ?? 'todos')}
                          onChange={(value) => patchDashboardFilters('ano', value === 'todos' ? 'todos' : Number(value))}
                          options={[{ value: 'todos', label: 'Todos' }, ...years.map((year) => ({ value: String(year), label: String(year) }))]}
                        />
                        <LabeledSelect
                          label="Exequente"
                          value={String(dashboardFilters.exequente ?? '')}
                          onChange={(value) => patchDashboardFilters('exequente', value)}
                          options={[{ value: '', label: 'Todos' }, ...exequenteFilterOptions.map((value) => ({ value, label: value }))]}
                        />
                        <LabeledSelect
                          label="Gestor"
                          value={String(dashboardFilters.gestor ?? '')}
                          onChange={(value) => patchDashboardFilters('gestor', value)}
                          options={[{ value: '', label: 'Todos' }, ...gestorFilterOptions.map((value) => ({ value, label: value }))]}
                        />
                      </div>
                    )}

                    <div className="dashboard-picker-wrap">
                      <button className="subtle-btn" type="button" onClick={() => setDashboardPickerOpen((current) => !current)}>
                        {dashboardPickerOpen ? 'Ocultar widgets' : 'Adicionar widgets'}
                      </button>
                      {dashboardPickerOpen && (
                        <div className="dashboard-widget-library">
                          {DASHBOARD_WIDGET_LIBRARY.map((widget) => (
                            <button
                              key={widget.type}
                              className="dashboard-widget-option"
                              type="button"
                              onClick={() => addDashboardWidget(widget.type)}
                            >
                              <strong>{widget.label}</strong>
                              <span>{widget.hint}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="dashboard-collapsed-note muted">
                    Painel de configuração oculto. Use “Mostrar painel” para editar filtros e widgets.
                  </div>
                )}
              </>
            )}

            {dashboardWidgets.length === 0 ? (
              <div className="empty-text dashboard-empty">
                Dashboard vazio. Clique em <strong>Adicionar widgets</strong> para começar.
              </div>
            ) : (
              <div className={`dashboard-grid ${dashboardHasSideStack ? 'with-side-stack' : ''}`}>
                {dashboardHasSideStack ? (
                  <>
                    <div className="dashboard-main-widgets">{dashboardMainWidgets.map((widget) => renderDashboardWidget(widget))}</div>
                    <aside className="dashboard-side-widgets">{dashboardSideWidgets.map((widget) => renderDashboardWidget(widget))}</aside>
                  </>
                ) : dashboardSideWidgets.length > 0 && dashboardMainWidgets.length === 0 ? (
                  <aside className="dashboard-side-widgets">{dashboardSideWidgets.map((widget) => renderDashboardWidget(widget))}</aside>
                ) : (
                  dashboardWidgets.map((widget) => renderDashboardWidget(widget))
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'importar' && (
          <section className="panel">
            <h2>Importar ficheiro</h2>
            <p className="small-note">Preview com conflitos e estratégia: ignorar, atualizar ou duplicar.</p>

            <div className="import-box">
              <input type="file" accept=".xlsx" onChange={(event) => void handleImportFile(event)} />
              <div className="actions-row start">
                <button className="subtle-btn" type="button" onClick={() => void exportCurrentSnapshot()}>
                  <Download size={15} />
                  Exportar snapshot atual
                </button>
                <button className="subtle-btn" type="button" onClick={() => void loadSeed(false)}>Carregar seed sem substituir</button>
                <button className="subtle-btn" type="button" onClick={() => void loadSeed(true)}>Substituir por seed</button>
              </div>
              {importLoading && <div className="small-note">A processar ficheiro...</div>}
            </div>

            {importPreview && (
              <>
                <div className="import-meta">
                  <div><strong>Ficheiro:</strong> {importPreview.fileName}</div>
                  <div><strong>Linhas:</strong> {importPreview.rows.length}</div>
                  <div><strong>Cores:</strong> {Object.keys(importPreview.colorCount).length}</div>
                </div>

                <div className="import-map-list">
                  {Object.entries(importPreview.colorCount).map(([colorKey, count]) => (
                    <div key={colorKey} className="import-map-item">
                      <div className="color-cell">
                        <span className="color-dot" style={{ backgroundColor: colorKey.startsWith('#') ? colorKey : '#BFC4CC' }} />
                        <span>{colorKey}</span>
                        <span className="muted">{count} linhas</span>
                      </div>
                      <select
                        value={importColorMapping[colorKey] ?? defaultStatus?.id ?? ''}
                        onChange={(event) => setImportColorMapping((current) => ({ ...current, [colorKey]: event.target.value }))}
                      >
                        {orderedStatuses.map((status) => (
                          <option key={status.id} value={status.id}>{status.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="actions-row start wrap">
                  <button className="subtle-btn" type="button" onClick={() => void refreshImportConflictPreview()}>
                    Rever conflitos
                  </button>
                  <label className="inline-check">
                    <input type="checkbox" checked={importForceRecalculate} onChange={(event) => setImportForceRecalculate(event.target.checked)} />
                    Forçar recálculo fiscal
                  </label>
                  <LabeledSelect
                    label="Estratégia de conflito"
                    value={importStrategy}
                    onChange={(value) => setImportStrategy(value as 'skip' | 'update' | 'duplicate')}
                    options={[
                      { value: 'update', label: 'Atualizar existentes' },
                      { value: 'skip', label: 'Ignorar duplicados' },
                      { value: 'duplicate', label: 'Criar duplicado' },
                    ]}
                  />
                  <button className="primary-btn" type="button" onClick={() => void runImportCommit()}>
                    Confirmar importação
                  </button>
                </div>

                {importServerPreview && (
                  <div className="import-summary">
                    <span>Total: {importServerPreview.summary.total}</span>
                    <span>Válidas: {importServerPreview.summary.valid}</span>
                    <span>Conflitos: {importServerPreview.summary.conflicts}</span>
                    <span>Novas: {importServerPreview.summary.creates}</span>
                    <span>Inválidas: {importServerPreview.summary.invalid}</span>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {activeTab === 'configuracao' && (
          <section className="panel">
            <h2>Configuração</h2>
            <p className="small-note">Estados, regras de cálculo fiscal e comissões configuráveis.</p>
            <div className="actions-row start">
              <button className="subtle-btn" type="button" onClick={() => setActiveTab('importar')}>
                Importar ficheiro
              </button>
            </div>

            <h3>Tema</h3>
            <div className="theme-select-wrap">
              <label className="field">
                <span>Selecionar tema</span>
                <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeId)}>
                  {THEME_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <h3>Estados</h3>
            <div className="status-list">
              {orderedStatuses.map((status) => (
                <div key={status.id} className="status-item">
                  <span className="status-icon-preview">
                    <StatusIcon name={status.icon} size={16} />
                  </span>
                  <select className="status-icon" value={status.icon} onChange={(event) => updateStatusLocal(status.id, { icon: event.target.value })}>
                    {STATUS_ICON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input value={status.label} onChange={(event) => updateStatusLocal(status.id, { label: event.target.value })} />
                  <input type="color" value={toColor(status.color)} onChange={(event) => updateStatusLocal(status.id, { color: event.target.value })} />
                  <input type="number" className="small-number" value={status.order} onChange={(event) => updateStatusLocal(status.id, { order: Number(event.target.value) || 0 })} />
                  <label className="inline-check">
                    <input type="checkbox" checked={status.active} onChange={(event) => updateStatusLocal(status.id, { active: event.target.checked })} />
                    Ativo
                  </label>
                  <button className="danger-link" type="button" onClick={() => void removeStatus(status.id)}>Remover</button>
                </div>
              ))}
            </div>

            <div className="actions-row start">
              <button className="subtle-btn" type="button" onClick={() => void addStatus()}>Novo estado</button>
              <button className="subtle-btn" type="button" onClick={() => void saveStatuses()}>Guardar estados</button>
            </div>

            <h3>Auto-cálculo</h3>
            <div className="field-grid four">
              <label className="inline-check">
                <input type="checkbox" checked={settingsDraft.autoApplyRules} onChange={(event) => updateSettingsDraft({ autoApplyRules: event.target.checked })} />
                Aplicar regras automaticamente
              </label>
              <label className="inline-check">
                <input type="checkbox" checked={settingsDraft.autoComputeValorSemIva} onChange={(event) => updateSettingsDraft({ autoComputeValorSemIva: event.target.checked })} />
                Calcular valor sem IVA
              </label>
              <label className="inline-check">
                <input type="checkbox" checked={settingsDraft.autoComputeValorEmissao} onChange={(event) => updateSettingsDraft({ autoComputeValorEmissao: event.target.checked })} />
                Calcular valor emissão
              </label>
              <label className="field">
                <span>Casas decimais</span>
                <input type="number" value={settingsDraft.roundTo} onChange={(event) => updateSettingsDraft({ roundTo: Number(event.target.value) || 2 })} />
              </label>
            </div>

            <div className="rules-table">
              <table className="rules-grid-table">
                <thead>
                  <tr>
                    <th>Regra</th>
                    <th>Taxa</th>
                    <th>Campo base</th>
                    <th>Campo destino</th>
                    <th>Ativa</th>
                  </tr>
                </thead>
                <tbody>
                  {settingsDraft.taxRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <input value={rule.label} onChange={(event) => updateTaxRule(rule.id, { label: event.target.value })} />
                      </td>
                      <td>
                        <input type="number" step="0.0001" value={rule.rate} onChange={(event) => updateTaxRule(rule.id, { rate: Number(event.target.value) || 0 })} />
                      </td>
                      <td>
                        <select value={rule.baseField} onChange={(event) => updateTaxRule(rule.id, { baseField: event.target.value as TaxRule['baseField'] })}>
                          <option value="valorSemIva">Valor sem IVA</option>
                          <option value="valorIndicado">Valor indicado</option>
                          <option value="valorEmissao">Valor emissão</option>
                        </select>
                      </td>
                      <td>
                        <select value={rule.targetField} onChange={(event) => updateTaxRule(rule.id, { targetField: event.target.value as TaxRule['targetField'] })}>
                          <option value="iva">IVA</option>
                          <option value="retencao">Retenção</option>
                          <option value="meu5">Meu 5%</option>
                          <option value="outrasTaxas">Outras taxas</option>
                        </select>
                      </td>
                      <td>
                        <input type="checkbox" checked={rule.enabled} onChange={(event) => updateTaxRule(rule.id, { enabled: event.target.checked })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="actions-row start">
              <button className="primary-btn" type="button" onClick={() => void saveCalculationSettings()}>Guardar cálculos</button>
            </div>
          </section>
        )}

        {selectedRecord && (
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
        )}
      </main>
    </div>
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

type StatusPillProps = {
  status: StatusDefinition
  compact?: boolean
}

function StatusPill({ status, compact }: StatusPillProps) {
  return (
    <span className={`status-pill ${compact ? 'compact' : ''}`} style={{ borderColor: status.color, backgroundColor: colorWithAlpha(status.color, '26') }}>
      {renderStatusIcon(status.icon, 14)}
      {!compact && <span>{status.label}</span>}
    </span>
  )
}

type StatusIconProps = {
  name: string
  size?: number
}

function StatusIcon({ name, size = 14 }: StatusIconProps) {
  return renderStatusIcon(name, size)
}

type ExequenteLogoProps = {
  name?: string
  size?: number
}

function ExequenteLogo({ name, size = 18 }: ExequenteLogoProps) {
  const [hasError, setHasError] = useState(false)
  const logoUrl = getExequenteLogoUrl(name)
  const letter = name?.trim().charAt(0)?.toUpperCase() || '•'

  if (!logoUrl || hasError) {
    return (
      <span className="logo-fallback" style={{ width: size, height: size }}>
        {letter}
      </span>
    )
  }

  return (
    <img
      className="exequente-logo"
      src={logoUrl}
      alt={name ?? 'Logo exequente'}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  )
}

type EntityIdentityProps = {
  gestor?: string
  exequente?: string
}

function GestorAvatar({ gestor, size = 18 }: { gestor?: string; size?: number }) {
  const initial = gestor?.trim()?.charAt(0)?.toUpperCase()
  return (
    <span className="gestor-avatar" style={{ width: size, height: size }}>
      {initial || <UserRound size={Math.max(11, size - 6)} />}
    </span>
  )
}

function EntityIdentity({ gestor, exequente }: EntityIdentityProps) {
  const gestorValue = gestor?.trim()
  const exequenteValue = exequente?.trim()
  const label = gestorValue || exequenteValue

  if (gestorValue) {
    return (
      <span className="entity-with-logo">
        <GestorAvatar gestor={gestorValue} />
        <span>{label}</span>
      </span>
    )
  }

  if (!exequenteValue) {
    return (
      <span className="entity-with-logo entity-empty" aria-label="Sem entidade">
        <span className="entity-empty-icon">
          <Minus size={11} />
        </span>
      </span>
    )
  }

  return (
    <span className="entity-with-logo">
      <ExequenteLogo name={exequenteValue} />
      <span>{exequenteValue}</span>
    </span>
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
