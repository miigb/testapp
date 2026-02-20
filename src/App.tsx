import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { jsPDF } from 'jspdf'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Ban,
  Calculator,
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
  Pin,
  PinOff,
  Plus,
  Minus,
  OctagonAlert,
  Pencil,
  ReceiptText,
  Save,
  SearchCheck,
  ShieldAlert,
  SquareFunction,
  StickyNote,
  Trash2,
  Undo2,
  UserRound,
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

const DEFAULT_DS_FILTERS: DsRecordFilters = {
  estadoId: 'todos',
  reciboEstado: 'todos',
  ano: 'todos',
  mes: 'todos',
  page: 1,
  pageSize: 300,
}

const DEFAULT_PENHORAS_FILTERS: PenhorasRecordFilters = {
  estadoId: 'todos',
  ano: 'todos',
  mes: 'todos',
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
type DashboardWidgetScope = 'recibos' | 'ds' | 'penhoras'

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

type DsDashboardWidgetType = 'ds-status' | 'ds-top-gestoras' | 'ds-top-entidades' | 'ds-mensal' | 'ds-recibos'
type PenhorasDashboardWidgetType = 'penhoras-status' | 'penhoras-top-gestores' | 'penhoras-mensal'

const DS_DASHBOARD_WIDGET_LIBRARY: Array<{ type: DsDashboardWidgetType; label: string; hint: string }> = [
  { type: 'ds-status', label: 'Estado DS', hint: 'Distribuição por estado' },
  { type: 'ds-top-gestoras', label: 'Top gestoras', hint: 'Ranking por volume' },
  { type: 'ds-top-entidades', label: 'Top entidades', hint: 'Ranking por volume' },
  { type: 'ds-mensal', label: 'Tendência mensal', hint: 'Últimos 12 meses' },
  { type: 'ds-recibos', label: 'Recibos', hint: 'KPI de recibos/comissões' },
]

const PENHORAS_DASHBOARD_WIDGET_LIBRARY: Array<{ type: PenhorasDashboardWidgetType; label: string; hint: string }> = [
  { type: 'penhoras-status', label: 'Estado Penhoras', hint: 'Distribuição por estado' },
  { type: 'penhoras-top-gestores', label: 'Top gestores', hint: 'Ranking por volume' },
  { type: 'penhoras-mensal', label: 'Tendência mensal', hint: 'Últimos 12 meses' },
]

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

const DEFAULT_DS_DASHBOARD_WIDGETS: DsDashboardWidget[] = [
  { id: 'ds-status', type: 'ds-status', size: 'normal', minHeight: 210, column: 'main', colSpan: 1 },
  { id: 'ds-top-gestoras', type: 'ds-top-gestoras', size: 'normal', minHeight: 210, column: 'main', colSpan: 1 },
  { id: 'ds-top-entidades', type: 'ds-top-entidades', size: 'normal', minHeight: 210, column: 'main', colSpan: 1 },
  { id: 'ds-mensal', type: 'ds-mensal', size: 'wide', minHeight: 220, column: 'main', colSpan: 2 },
  { id: 'ds-recibos', type: 'ds-recibos', size: 'kpi', minHeight: 180, column: 'side', colSpan: 1 },
]

const DEFAULT_PENHORAS_DASHBOARD_WIDGETS: PenhorasDashboardWidget[] = [
  { id: 'penhoras-status', type: 'penhoras-status', size: 'normal', minHeight: 210, column: 'main', colSpan: 1 },
  { id: 'penhoras-top-gestores', type: 'penhoras-top-gestores', size: 'normal', minHeight: 210, column: 'main', colSpan: 1 },
  { id: 'penhoras-mensal', type: 'penhoras-mensal', size: 'wide', minHeight: 220, column: 'main', colSpan: 2 },
]

function cloneDefaultDsDashboardWidgets(): DsDashboardWidget[] {
  return DEFAULT_DS_DASHBOARD_WIDGETS.map((widget) => ({ ...widget }))
}

function cloneDefaultPenhorasDashboardWidgets(): PenhorasDashboardWidget[] {
  return DEFAULT_PENHORAS_DASHBOARD_WIDGETS.map((widget) => ({ ...widget }))
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
type SmartNotesErrorRow = {
  lineNumber: number
  source: string
  error: string
}
type SavedSmartNotesEntry = {
  signature: string
  expression: string
  result: number
  source: string
  savedAt: string
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

function resolveInitialTheme(): ThemeId {
  const stored = localStorage.getItem('mesa-recibos-theme')
  const validThemeIds = new Set<string>(THEME_OPTIONS.map((t) => t.id))
  if (stored && validThemeIds.has(stored)) {
    return stored as ThemeId
  }
  return 'github-light'
}

function resolveInitialLayoutMode(): LayoutMode {
  return 'wide'
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

function resolveInitialQuickNotes(): string {
  const stored = localStorage.getItem('mesa-recibos-quick-notes')
  return typeof stored === 'string' ? stored : ''
}

function resolveInitialSmartNotes(): string {
  const stored = localStorage.getItem('mesa-recibos-smart-notes')
  return typeof stored === 'string' ? stored : ''
}

function resolveInitialSmartNotesPinnedSignatures(): string[] {
  try {
    const stored = localStorage.getItem('mesa-recibos-smart-notes-pinned')
    if (!stored) return []
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string').slice(0, 200)
  } catch {
    return []
  }
}

function resolveInitialSmartNotesSavedEntries(): SavedSmartNotesEntry[] {
  try {
    const stored = localStorage.getItem('mesa-recibos-smart-notes-saved')
    if (!stored) return []
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is SavedSmartNotesEntry => {
        if (!item || typeof item !== 'object') return false
        const candidate = item as Partial<SavedSmartNotesEntry>
        return (
          typeof candidate.signature === 'string' &&
          typeof candidate.expression === 'string' &&
          typeof candidate.result === 'number' &&
          typeof candidate.source === 'string' &&
          typeof candidate.savedAt === 'string'
        )
      })
      .slice(0, 200)
  } catch {
    return []
  }
}

function parseSmartNumber(value: string): number | null {
  const scaleMatch = value.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*([kKmMbB])?$/)
  if (!scaleMatch) return null
  const normalized = scaleMatch[1].replace(/\s+/g, '').replace(',', '.')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  const suffix = scaleMatch[2]?.toLowerCase()
  if (!suffix) return parsed
  if (suffix === 'k') return parsed * 1_000
  if (suffix === 'm') return parsed * 1_000_000
  if (suffix === 'b') return parsed * 1_000_000_000
  return parsed
}

function buildSmartNotesSignature(expression: string, result: number): string {
  return `${expression.trim().toLowerCase()}::${result.toFixed(6)}`
}

function evaluateSmartNotesLine(
  line: string,
  context: { previousResults: number[]; variables: Map<string, number> },
): { expression: string; result: number; signature: string; variableKey?: string } | { error: string } | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  const assignmentMatch = trimmed.match(/^([A-Za-zÀ-ÿ_][\wÀ-ÿ ]{0,40})\s*=\s*(.+)$/)
  const rawExpression = assignmentMatch ? assignmentMatch[2].trim() : trimmed.includes('=') ? trimmed.split('=').slice(1).join('=').trim() : trimmed
  if (!rawExpression) return null

  const totalLineMatch = rawExpression.match(/\b(total|subtotal|soma|sum)\b/i)
  if (totalLineMatch && !/[0-9+\-*/%]/.test(rawExpression)) {
    if (context.previousResults.length === 0) {
      return { error: 'Sem valores anteriores para total.' }
    }
    const total = context.previousResults.reduce((sum, value) => sum + value, 0)
    return {
      expression: 'total',
      result: total,
      signature: buildSmartNotesSignature('total', total),
      variableKey: assignmentMatch?.[1]?.trim().toLowerCase().replace(/\s+/g, '_'),
    }
  }

  const percentOfMatch = rawExpression.match(/(-?\d+(?:[.,]\d+)?)\s*%\s*(?:de|do|da|sobre)\s*(-?\d+(?:[.,]\d+)?)/i)
  if (percentOfMatch) {
    const percent = parseSmartNumber(percentOfMatch[1])
    const base = parseSmartNumber(percentOfMatch[2])
    if (percent === null || base === null) {
      return { error: 'Percentagem inválida.' }
    }
    const computed = (base * percent) / 100
    return {
      expression: `${percentOfMatch[1]}% de ${percentOfMatch[2]}`,
      result: computed,
      signature: buildSmartNotesSignature(`${percentOfMatch[1]}% de ${percentOfMatch[2]}`, computed),
      variableKey: assignmentMatch?.[1]?.trim().toLowerCase().replace(/\s+/g, '_'),
    }
  }

  const totalReplacement =
    context.previousResults.length > 0 ? String(context.previousResults.reduce((sum, value) => sum + value, 0)) : '0'

  const withScaledNumbers = rawExpression.replace(/(-?\d+(?:[.,]\d+)?)\s*([kKmMbB])\b/g, (_, amount: string, suffix: string) => {
    const parsed = parseSmartNumber(`${amount}${suffix}`)
    return parsed === null ? `${amount}${suffix}` : String(parsed)
  })

  const withVariables = withScaledNumbers.replace(/\b([A-Za-zÀ-ÿ_][\wÀ-ÿ]*)\b/g, (token) => {
    const mapped = context.variables.get(token.toLowerCase())
    return mapped === undefined ? token : String(mapped)
  })

  const normalized = withVariables
    .replace(/\b(total|subtotal|soma|sum)\b/gi, totalReplacement)
    .replace(/[€$£]/g, ' ')
    .replace(/\b(eur|euro|euros|usd|dolar|dólar|dolares|dólares)\b/gi, ' ')
    .replace(/[×x]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/\b(dividido\s+por|sobre|per)\b/gi, ' / ')
    .replace(/\b(vezes|multiplicado\s+por)\b/gi, ' * ')
    .replace(/\b(mais|plus)\b/gi, ' + ')
    .replace(/\b(menos|minus)\b/gi, ' - ')
    .replace(/&/g, ' + ')
    .replace(/\be\b/gi, ' + ')
    .replace(/,/g, '.')
    .replace(/[^0-9+\-*/().% ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return null
  if (!/^[0-9+\-*/().%\s]+$/.test(normalized)) {
    return { error: 'Expressão não suportada.' }
  }

  const numberTokens = normalized.match(/-?\d+(?:\.\d+)?/g) ?? []
  const hasOperator = /[+\-*/()%]/.test(normalized)
  let finalExpression = normalized

  if (!hasOperator) {
    if (numberTokens.length === 0) return null
    finalExpression = numberTokens.join(' + ')
  }

  finalExpression = finalExpression.replace(/^[+*/\s]+|[+\-*/\s]+$/g, '').trim()
  if (!finalExpression) {
    return { error: 'Não foi possível interpretar.' }
  }

  const expressionWithPercent = finalExpression.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)')

  try {
    const computed = Function(`"use strict"; return (${expressionWithPercent})`)()
    if (typeof computed !== 'number' || !Number.isFinite(computed)) {
      return { error: 'Resultado inválido.' }
    }
    return {
      expression: finalExpression,
      result: computed,
      signature: buildSmartNotesSignature(finalExpression, computed),
      variableKey: assignmentMatch?.[1]?.trim().toLowerCase().replace(/\s+/g, '_'),
    }
  } catch {
    return { error: 'Não foi possível interpretar.' }
  }
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

function sanitizeDsFilters(input: unknown): DsRecordFilters {
  const payload = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const parseNumeric = (value: unknown, min: number, max: number) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < min || numeric > max) return 'todos' as const
    return numeric
  }

  return {
    estadoId: typeof payload.estadoId === 'string' && payload.estadoId.trim() ? payload.estadoId : 'todos',
    gestora: typeof payload.gestora === 'string' ? payload.gestora : '',
    entidadeBancaria: typeof payload.entidadeBancaria === 'string' ? payload.entidadeBancaria : '',
    produto: typeof payload.produto === 'string' ? payload.produto : '',
    reciboEstado:
      payload.reciboEstado === 'com-recibo' || payload.reciboEstado === 'sem-recibo' ? payload.reciboEstado : 'todos',
    ano: parseNumeric(payload.ano, 2000, 9999),
    mes: parseNumeric(payload.mes, 1, 12),
    page: 1,
    pageSize: 300,
  }
}

function sanitizePenhorasFilters(input: unknown): PenhorasRecordFilters {
  const payload = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  const parseNumeric = (value: unknown, min: number, max: number) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < min || numeric > max) return 'todos' as const
    return numeric
  }

  return {
    estadoId: typeof payload.estadoId === 'string' && payload.estadoId.trim() ? payload.estadoId : 'todos',
    gestor: typeof payload.gestor === 'string' ? payload.gestor : '',
    acto: typeof payload.acto === 'string' ? payload.acto : '',
    ano: parseNumeric(payload.ano, 2000, 9999),
    mes: parseNumeric(payload.mes, 1, 12),
    page: 1,
    pageSize: 300,
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

function defaultDsDashboardWidgetLayout(type: DsDashboardWidgetType): {
  size: DashboardWidgetSize
  minHeight: number
  column: DashboardWidgetColumn
  colSpan: number
} {
  const found = DEFAULT_DS_DASHBOARD_WIDGETS.find((widget) => widget.type === type)
  if (found) {
    return {
      size: found.size,
      minHeight: found.minHeight,
      column: found.column,
      colSpan: found.colSpan,
    }
  }
  return { size: 'normal', minHeight: 180, column: 'main', colSpan: 1 }
}

function defaultPenhorasDashboardWidgetLayout(type: PenhorasDashboardWidgetType): {
  size: DashboardWidgetSize
  minHeight: number
  column: DashboardWidgetColumn
  colSpan: number
} {
  const found = DEFAULT_PENHORAS_DASHBOARD_WIDGETS.find((widget) => widget.type === type)
  if (found) {
    return {
      size: found.size,
      minHeight: found.minHeight,
      column: found.column,
      colSpan: found.colSpan,
    }
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

function parseDsDashboardWidgets(input: unknown): DsDashboardWidget[] {
  if (!Array.isArray(input)) return []
  const allowed = new Set<DsDashboardWidgetType>(DEFAULT_DS_DASHBOARD_WIDGETS.map((widget) => widget.type))
  return input
    .map((item) => {
      if (typeof item !== 'object' || item === null) return null
      const widget = item as { id?: unknown; type?: unknown; size?: unknown; minHeight?: unknown; column?: unknown; colSpan?: unknown }
      if (typeof widget.type !== 'string' || !allowed.has(widget.type as DsDashboardWidgetType)) return null
      const baseLayout = defaultDsDashboardWidgetLayout(widget.type as DsDashboardWidgetType)
      const numericHeight = Number(widget.minHeight)
      const numericColSpan = Number(widget.colSpan)
      const parsedColumn = sanitizeDashboardWidgetColumn(widget.column, baseLayout.column)
      return {
        id: typeof widget.id === 'string' && widget.id.trim() ? widget.id : crypto.randomUUID(),
        type: widget.type as DsDashboardWidgetType,
        size: sanitizeDashboardWidgetSize(widget.size, baseLayout.size),
        minHeight: clampDashboardWidgetHeight(Number.isFinite(numericHeight) ? numericHeight : baseLayout.minHeight),
        column: parsedColumn,
        colSpan: parsedColumn === 'side' ? 1 : clampDashboardWidgetColSpan(Number.isFinite(numericColSpan) ? numericColSpan : baseLayout.colSpan),
      }
    })
    .filter((widget): widget is DsDashboardWidget => Boolean(widget))
}

function parsePenhorasDashboardWidgets(input: unknown): PenhorasDashboardWidget[] {
  if (!Array.isArray(input)) return []
  const allowed = new Set<PenhorasDashboardWidgetType>(DEFAULT_PENHORAS_DASHBOARD_WIDGETS.map((widget) => widget.type))
  return input
    .map((item) => {
      if (typeof item !== 'object' || item === null) return null
      const widget = item as { id?: unknown; type?: unknown; size?: unknown; minHeight?: unknown; column?: unknown; colSpan?: unknown }
      if (typeof widget.type !== 'string' || !allowed.has(widget.type as PenhorasDashboardWidgetType)) return null
      const baseLayout = defaultPenhorasDashboardWidgetLayout(widget.type as PenhorasDashboardWidgetType)
      const numericHeight = Number(widget.minHeight)
      const numericColSpan = Number(widget.colSpan)
      const parsedColumn = sanitizeDashboardWidgetColumn(widget.column, baseLayout.column)
      return {
        id: typeof widget.id === 'string' && widget.id.trim() ? widget.id : crypto.randomUUID(),
        type: widget.type as PenhorasDashboardWidgetType,
        size: sanitizeDashboardWidgetSize(widget.size, baseLayout.size),
        minHeight: clampDashboardWidgetHeight(Number.isFinite(numericHeight) ? numericHeight : baseLayout.minHeight),
        column: parsedColumn,
        colSpan: parsedColumn === 'side' ? 1 : clampDashboardWidgetColSpan(Number.isFinite(numericColSpan) ? numericColSpan : baseLayout.colSpan),
      }
    })
    .filter((widget): widget is PenhorasDashboardWidget => Boolean(widget))
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
  const [activeModule, setActiveModule] = useState<ModuleId>('recibos')
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
  const [selectedDsRecordId, setSelectedDsRecordId] = useState<string | null>(null)
  const [selectedDsRecord, setSelectedDsRecord] = useState<DsRecord | null>(null)
  const [selectedDsRecordEdit, setSelectedDsRecordEdit] = useState<DsEntryForm | null>(null)
  const [isDsRecordEditing, setIsDsRecordEditing] = useState(false)
  const [selectedPenhorasRecordId, setSelectedPenhorasRecordId] = useState<string | null>(null)
  const [selectedPenhorasRecord, setSelectedPenhorasRecord] = useState<PenhorasRecord | null>(null)
  const [selectedPenhorasRecordEdit, setSelectedPenhorasRecordEdit] = useState<PenhorasEntryForm | null>(null)
  const [isPenhorasRecordEditing, setIsPenhorasRecordEditing] = useState(false)
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const [theme, setTheme] = useState<ThemeId>(resolveInitialTheme)
  const [layoutMode] = useState<LayoutMode>(resolveInitialLayoutMode)
  const [toolsExpanded, setToolsExpanded] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [smartNotesOpen, setSmartNotesOpen] = useState(false)
  const [toolPinned, setToolPinned] = useState<Record<QuickToolId, boolean>>({
    notes: false,
    calculator: false,
    'smart-notes': false,
  })
  const [toolLayers, setToolLayers] = useState<Record<QuickToolId, number>>({
    notes: 1,
    calculator: 2,
    'smart-notes': 3,
  })
  const [toolPositions, setToolPositions] = useState<Record<QuickToolId, { x: number; y: number } | null>>({
    notes: null,
    calculator: null,
    'smart-notes': null,
  })
  const [draggingTool, setDraggingTool] = useState<QuickToolId | null>(null)
  const [quickNotes, setQuickNotes] = useState(resolveInitialQuickNotes)
  const [smartNotesText, setSmartNotesText] = useState(resolveInitialSmartNotes)
  const [smartNotesPinnedSignatures, setSmartNotesPinnedSignatures] = useState<string[]>(resolveInitialSmartNotesPinnedSignatures)
  const [smartNotesSavedEntries, setSmartNotesSavedEntries] = useState<SavedSmartNotesEntry[]>(resolveInitialSmartNotesSavedEntries)
  const [calculatorExpression, setCalculatorExpression] = useState('')
  const [calculatorResult, setCalculatorResult] = useState<string | null>(null)
  const [calculatorError, setCalculatorError] = useState('')
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
  const [dsDashboardWidgets, setDsDashboardWidgets] = useState<DsDashboardWidget[]>(cloneDefaultDsDashboardWidgets)
  const [penhorasDashboardWidgets, setPenhorasDashboardWidgets] = useState<PenhorasDashboardWidget[]>(cloneDefaultPenhorasDashboardWidgets)
  const [dsDashboardConfigOpen, setDsDashboardConfigOpen] = useState(true)
  const [dsDashboardPickerOpen, setDsDashboardPickerOpen] = useState(false)
  const [dsDashboardWidgetsOpen, setDsDashboardWidgetsOpen] = useState(true)
  const [penhorasDashboardConfigOpen, setPenhorasDashboardConfigOpen] = useState(true)
  const [penhorasDashboardPickerOpen, setPenhorasDashboardPickerOpen] = useState(false)
  const [penhorasDashboardWidgetsOpen, setPenhorasDashboardWidgetsOpen] = useState(true)
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

  const [dsStatuses, setDsStatuses] = useState<StatusDefinition[]>([])
  const [dsRecords, setDsRecords] = useState<DsRecord[]>([])
  const [dsTotalRecords, setDsTotalRecords] = useState(0)
  const [dsFilters, setDsFilters] = useState<DsRecordFilters>(DEFAULT_DS_FILTERS)
  const [dsRecordsLoading, setDsRecordsLoading] = useState(false)
  const [dsImportLoading, setDsImportLoading] = useState(false)
  const [dsImportPreview, setDsImportPreview] = useState<DsParsedImport | null>(null)
  const [dsImportServerPreview, setDsImportServerPreview] = useState<ImportPreviewResponse | null>(null)
  const [dsImportStrategy, setDsImportStrategy] = useState<'skip' | 'update' | 'duplicate'>('update')
  const [dsEntryForm, setDsEntryForm] = useState<DsEntryForm>(getInitialDsEntryForm(''))
  const [activeDsSavedViewId, setActiveDsSavedViewId] = useState<string | null>(null)

  const [penhorasStatuses, setPenhorasStatuses] = useState<StatusDefinition[]>([])
  const [penhorasRecords, setPenhorasRecords] = useState<PenhorasRecord[]>([])
  const [penhorasTotalRecords, setPenhorasTotalRecords] = useState(0)
  const [penhorasFilters, setPenhorasFilters] = useState<PenhorasRecordFilters>(DEFAULT_PENHORAS_FILTERS)
  const [penhorasRecordsLoading, setPenhorasRecordsLoading] = useState(false)
  const [penhorasImportLoading, setPenhorasImportLoading] = useState(false)
  const [penhorasImportPreview, setPenhorasImportPreview] = useState<PenhorasParsedImport | null>(null)
  const [penhorasImportServerPreview, setPenhorasImportServerPreview] = useState<ImportPreviewResponse | null>(null)
  const [penhorasImportStrategy, setPenhorasImportStrategy] = useState<'skip' | 'update' | 'duplicate'>('update')
  const [penhorasEntryForm, setPenhorasEntryForm] = useState<PenhorasEntryForm>(getInitialPenhorasEntryForm(''))
  const [activePenhorasSavedViewId, setActivePenhorasSavedViewId] = useState<string | null>(null)

  const [settingsDraft, setSettingsDraft] = useState<CalculationSettings>(EMPTY_CALC_SETTINGS)
  const [recordSuggestions, setRecordSuggestions] = useState<RecordSuggestions>(EMPTY_RECORD_SUGGESTIONS)
  const widgetResizeRef = useRef<{ scope: DashboardWidgetScope; widgetId: string; startY: number; startHeight: number } | null>(null)
  const toolLayerRef = useRef(4)
  const toolDragRef = useRef<{ tool: QuickToolId; pointerOffsetX: number; pointerOffsetY: number } | null>(null)
  const notesWindowRef = useRef<HTMLDivElement | null>(null)
  const calculatorWindowRef = useRef<HTMLDivElement | null>(null)
  const smartNotesWindowRef = useRef<HTMLDivElement | null>(null)

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
  const smartNotesEvaluation = useMemo(() => {
    const context = {
      previousResults: [] as number[],
      variables: new Map<string, number>(),
    }
    const results: SmartNotesResultRow[] = []
    const errors: SmartNotesErrorRow[] = []

    for (const [index, line] of smartNotesText.split('\n').entries()) {
      const parsed = evaluateSmartNotesLine(line, context)
      if (!parsed) continue

      if ('error' in parsed) {
        errors.push({
          lineNumber: index + 1,
          source: line.trim(),
          error: parsed.error,
        })
        continue
      }

      context.previousResults.push(parsed.result)
      if (parsed.variableKey) {
        context.variables.set(parsed.variableKey, parsed.result)
      }

      results.push({
        lineNumber: index + 1,
        source: line.trim(),
        expression: parsed.expression,
        result: parsed.result,
        signature: parsed.signature,
      })
    }

    return { results, errors }
  }, [smartNotesText])
  const smartNotesResults = smartNotesEvaluation.results
  const smartNotesErrors = smartNotesEvaluation.errors
  const smartNotesPinnedSet = useMemo(() => new Set(smartNotesPinnedSignatures), [smartNotesPinnedSignatures])
  const smartNotesSavedSet = useMemo(() => new Set(smartNotesSavedEntries.map((entry) => entry.signature)), [smartNotesSavedEntries])
  const smartNotesDisplayResults = useMemo(() => {
    return [...smartNotesResults].sort((a, b) => {
      const aPinned = smartNotesPinnedSet.has(a.signature) ? 1 : 0
      const bPinned = smartNotesPinnedSet.has(b.signature) ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned
      return a.lineNumber - b.lineNumber
    })
  }, [smartNotesResults, smartNotesPinnedSet])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('mesa-recibos-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('mesa-recibos-layout', layoutMode)
  }, [layoutMode])

  useEffect(() => {
    localStorage.setItem('mesa-recibos-quick-notes', quickNotes)
  }, [quickNotes])

  useEffect(() => {
    localStorage.setItem('mesa-recibos-smart-notes', smartNotesText)
  }, [smartNotesText])

  useEffect(() => {
    localStorage.setItem('mesa-recibos-smart-notes-pinned', JSON.stringify(smartNotesPinnedSignatures))
  }, [smartNotesPinnedSignatures])

  useEffect(() => {
    localStorage.setItem('mesa-recibos-smart-notes-saved', JSON.stringify(smartNotesSavedEntries.slice(0, 200)))
  }, [smartNotesSavedEntries])

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
        setToolLayers((current) => {
          const nextLayer = toolLayerRef.current++
          return { ...current, notes: nextLayer }
        })
        return
      }
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault()
        setToolsExpanded(true)
        setCalculatorOpen(true)
        setToolLayers((current) => {
          const nextLayer = toolLayerRef.current++
          return { ...current, calculator: nextLayer }
        })
        return
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        setToolsExpanded(true)
        setSmartNotesOpen(true)
        setToolLayers((current) => {
          const nextLayer = toolLayerRef.current++
          return { ...current, 'smart-notes': nextLayer }
        })
      }
    }

    window.addEventListener('keydown', handleQuickToolShortcuts)
    return () => {
      window.removeEventListener('keydown', handleQuickToolShortcuts)
    }
  }, [])

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
        const [bootstrap, dsBootstrap, penhorasBootstrap] = await Promise.all([
          api.bootstrap(),
          api.dsBootstrap().catch(() => null),
          api.penhorasBootstrap().catch(() => null),
        ])
        setStatuses(bootstrap.statuses)
        const combinedSavedViews = [...bootstrap.savedViews, ...(dsBootstrap?.savedViews ?? []), ...(penhorasBootstrap?.savedViews ?? [])]
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

        const penhorasFallbackStatus = penhorasBootstrap?.statuses.find((status) => status.active) ?? penhorasBootstrap?.statuses[0]
        if (penhorasFallbackStatus) {
          setPenhorasEntryForm(getInitialPenhorasEntryForm(penhorasFallbackStatus.id))
        }

        await migrateLegacyLocalStorageIfPresent()

        if (bootstrap.recordCount === 0) {
          const seed = await api.seedDatabase(false)
          setFeedback(`Dados base carregados: ${seed.created} novos registos.`)
        }

        await refreshRecords()
        await refreshDsRecords()
        await refreshPenhorasRecords()
      } catch (error) {
        setPageError(error instanceof Error ? error.message : 'Falha ao carregar aplicação.')
      } finally {
        setBootstrapLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!bootstrapLoading && activeModule === 'recibos') {
      void refreshRecords()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, globalSearch, bootstrapLoading, activeModule])

  useEffect(() => {
    if (bootstrapLoading || activeModule !== 'ds') return
    void refreshDsRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapLoading, activeModule, dsFilters, globalSearch])

  useEffect(() => {
    if (bootstrapLoading || activeModule !== 'penhoras') return
    void refreshPenhorasRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapLoading, activeModule, penhorasFilters, globalSearch])

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
  }, [activeDashboardId, dashboardViews])

  useEffect(() => {
    if (!activeDsSavedViewId) return
    const viewStillExists = savedViews.some((view) => view.id === activeDsSavedViewId && view.scope.startsWith('ds-'))
    if (!viewStillExists) {
      setActiveDsSavedViewId(null)
    }
  }, [activeDsSavedViewId, savedViews])

  useEffect(() => {
    if (!activePenhorasSavedViewId) return
    const viewStillExists = savedViews.some((view) => view.id === activePenhorasSavedViewId && view.scope.startsWith('penhoras-'))
    if (!viewStillExists) {
      setActivePenhorasSavedViewId(null)
    }
  }, [activePenhorasSavedViewId, savedViews])

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
      if (resizeState.scope === 'recibos') {
        setDashboardWidgets((current) =>
          current.map((widget) => (widget.id === resizeState.widgetId ? { ...widget, minHeight: nextHeight } : widget)),
        )
      } else if (resizeState.scope === 'ds') {
        setDsDashboardWidgets((current) =>
          current.map((widget) => (widget.id === resizeState.widgetId ? { ...widget, minHeight: nextHeight } : widget)),
        )
      } else {
        setPenhorasDashboardWidgets((current) =>
          current.map((widget) => (widget.id === resizeState.widgetId ? { ...widget, minHeight: nextHeight } : widget)),
        )
      }
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

  async function refreshDsRecords() {
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
  }

  async function refreshPenhorasRecords() {
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

  function addDsDashboardWidget(type: DsDashboardWidgetType) {
    const baseLayout = defaultDsDashboardWidgetLayout(type)
    setDsDashboardWidgets((current) => [
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

  function addPenhorasDashboardWidget(type: PenhorasDashboardWidgetType) {
    const baseLayout = defaultPenhorasDashboardWidgetLayout(type)
    setPenhorasDashboardWidgets((current) => [
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

  function removeDsDashboardWidget(widgetId: string) {
    setDsDashboardWidgets((current) => current.filter((widget) => widget.id !== widgetId))
  }

  function moveDsDashboardWidget(widgetId: string, direction: -1 | 1) {
    setDsDashboardWidgets((current) => {
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

  function reorderDsDashboardWidgets(sourceWidgetId: string, targetWidgetId: string) {
    if (sourceWidgetId === targetWidgetId) return
    setDsDashboardWidgets((current) => {
      const sourceIndex = current.findIndex((widget) => widget.id === sourceWidgetId)
      const targetIndex = current.findIndex((widget) => widget.id === targetWidgetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const next = [...current]
      const [source] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, source)
      return next
    })
  }

  function adjustDsDashboardWidgetWidth(widgetId: string, delta: number) {
    setDsDashboardWidgets((current) =>
      current.map((widget) => {
        if (widget.id !== widgetId) return widget
        if (widget.column === 'side') return widget
        const baseLayout = defaultDsDashboardWidgetLayout(widget.type)
        const nextColSpan = clampDashboardWidgetColSpan((widget.colSpan || baseLayout.colSpan) + delta)
        return {
          ...widget,
          colSpan: nextColSpan,
          size: nextColSpan >= 2 ? 'wide' : widget.type === 'ds-recibos' ? 'kpi' : 'normal',
        }
      }),
    )
  }

  function toggleDsDashboardWidgetColumn(widgetId: string) {
    setDsDashboardWidgets((current) =>
      current.map((widget) => {
        if (widget.id !== widgetId) return widget
        const baseLayout = defaultDsDashboardWidgetLayout(widget.type)
        const nextColumn = widget.column === 'side' ? 'main' : 'side'
        const nextColSpan = nextColumn === 'side' ? 1 : clampDashboardWidgetColSpan(widget.colSpan || baseLayout.colSpan)
        return {
          ...widget,
          column: nextColumn,
          colSpan: nextColSpan,
          size: nextColSpan >= 2 ? 'wide' : widget.type === 'ds-recibos' ? 'kpi' : 'normal',
        }
      }),
    )
  }

  function adjustDsDashboardWidgetHeight(widgetId: string, delta: number) {
    setDsDashboardWidgets((current) =>
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

  function removePenhorasDashboardWidget(widgetId: string) {
    setPenhorasDashboardWidgets((current) => current.filter((widget) => widget.id !== widgetId))
  }

  function movePenhorasDashboardWidget(widgetId: string, direction: -1 | 1) {
    setPenhorasDashboardWidgets((current) => {
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

  function reorderPenhorasDashboardWidgets(sourceWidgetId: string, targetWidgetId: string) {
    if (sourceWidgetId === targetWidgetId) return
    setPenhorasDashboardWidgets((current) => {
      const sourceIndex = current.findIndex((widget) => widget.id === sourceWidgetId)
      const targetIndex = current.findIndex((widget) => widget.id === targetWidgetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const next = [...current]
      const [source] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, source)
      return next
    })
  }

  function adjustPenhorasDashboardWidgetWidth(widgetId: string, delta: number) {
    setPenhorasDashboardWidgets((current) =>
      current.map((widget) => {
        if (widget.id !== widgetId) return widget
        if (widget.column === 'side') return widget
        const baseLayout = defaultPenhorasDashboardWidgetLayout(widget.type)
        const nextColSpan = clampDashboardWidgetColSpan((widget.colSpan || baseLayout.colSpan) + delta)
        return {
          ...widget,
          colSpan: nextColSpan,
          size: nextColSpan >= 2 ? 'wide' : 'normal',
        }
      }),
    )
  }

  function togglePenhorasDashboardWidgetColumn(widgetId: string) {
    setPenhorasDashboardWidgets((current) =>
      current.map((widget) => {
        if (widget.id !== widgetId) return widget
        const baseLayout = defaultPenhorasDashboardWidgetLayout(widget.type)
        const nextColumn = widget.column === 'side' ? 'main' : 'side'
        const nextColSpan = nextColumn === 'side' ? 1 : clampDashboardWidgetColSpan(widget.colSpan || baseLayout.colSpan)
        return {
          ...widget,
          column: nextColumn,
          colSpan: nextColSpan,
          size: nextColSpan >= 2 ? 'wide' : 'normal',
        }
      }),
    )
  }

  function adjustPenhorasDashboardWidgetHeight(widgetId: string, delta: number) {
    setPenhorasDashboardWidgets((current) =>
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

  function startDashboardWidgetResize(
    event: ReactMouseEvent<HTMLButtonElement>,
    scope: DashboardWidgetScope,
    widgetId: string,
    currentHeight: number,
  ) {
    event.preventDefault()
    event.stopPropagation()
    widgetResizeRef.current = {
      scope,
      widgetId,
      startY: event.clientY,
      startHeight: currentHeight,
    }
    setResizingDashboardWidgetId(widgetId)
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

  async function saveCurrentView(
    scope: 'tabela' | 'ds-tabela' | 'ds-dashboard' | 'penhoras-tabela' | 'penhoras-dashboard',
    filtersPayload: Record<string, unknown>,
  ) {
    const name = window.prompt('Nome da vista')
    if (!name) return

    try {
      const created = await api.createSavedView({ name, scope, filters: filtersPayload })
      setSavedViews((current) => [created, ...current])
      setFeedback(scope.startsWith('ds-') ? 'Vista DS guardada.' : scope.startsWith('penhoras-') ? 'Vista Penhoras guardada.' : 'Vista guardada.')
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : scope.startsWith('ds-')
            ? 'Falha ao guardar vista DS.'
            : scope.startsWith('penhoras-')
              ? 'Falha ao guardar vista Penhoras.'
              : 'Falha ao guardar vista.',
      )
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

  async function deleteDsSavedView(viewId: string) {
    const confirmed = window.confirm('Eliminar esta vista DS guardada?')
    if (!confirmed) return

    try {
      await api.deleteSavedView(viewId)
      const nextSavedViews = savedViews.filter((view) => view.id !== viewId)
      const nextDisabledIds = disabledSavedViewIds.filter((id) => id !== viewId)
      setSavedViews(nextSavedViews)
      setDisabledSavedViewIds(nextDisabledIds)

      if (activeDsSavedViewId === viewId) {
        const fallbackView = nextSavedViews
          .filter((view) => (view.scope === 'ds-tabela' || view.scope === 'ds-dashboard') && !nextDisabledIds.includes(view.id))
          .find(Boolean)
        if (fallbackView) {
          applyDsView(fallbackView, { enableIfDisabled: false })
        } else {
          clearDsFilters({ silent: true })
        }
      }
      setFeedback('Vista DS eliminada.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao eliminar vista DS.')
    }
  }

  function toggleDsSavedViewDisabled(viewId: string) {
    const isDisabled = disabledSavedViewIds.includes(viewId)
    const dsViews = savedViews.filter((view) => view.scope === 'ds-tabela' || view.scope === 'ds-dashboard')

    if (isDisabled) {
      setDisabledSavedViewIds((current) => current.filter((id) => id !== viewId))
      const view = dsViews.find((item) => item.id === viewId)
      if (view) {
        applyDsView(view, { enableIfDisabled: false })
      }
      return
    }

    const nextDisabledIds = [...disabledSavedViewIds, viewId]
    setDisabledSavedViewIds(nextDisabledIds)

    if (activeDsSavedViewId === viewId) {
      const fallbackView = dsViews.find((view) => view.id !== viewId && !nextDisabledIds.includes(view.id))
      if (fallbackView) {
        applyDsView(fallbackView, { enableIfDisabled: false })
      } else {
        clearDsFilters({ silent: true })
      }
    }
  }

  function clearDsFilters(options?: { silent?: boolean }) {
    setDsFilters(DEFAULT_DS_FILTERS)
    setGlobalSearch('')
    setActiveDsSavedViewId(null)
    if (!options?.silent) {
      setFeedback('Filtros DS limpos.')
    }
  }

  function applyDsView(view: SavedView, options?: { enableIfDisabled?: boolean }) {
    const payload = view.filters
    setActiveDsSavedViewId(view.id)
    if (options?.enableIfDisabled ?? true) {
      setDisabledSavedViewIds((current) => current.filter((id) => id !== view.id))
    }
    setDsFilters(sanitizeDsFilters(payload))
    if (view.scope === 'ds-dashboard') {
      const parsedWidgets = parseDsDashboardWidgets((payload as Record<string, unknown>).widgets)
      if (parsedWidgets.length > 0) {
        setDsDashboardWidgets(parsedWidgets)
      }
    }
    setGlobalSearch(typeof payload.q === 'string' ? payload.q : '')
  }

  async function deletePenhorasSavedView(viewId: string) {
    const confirmed = window.confirm('Eliminar esta vista Penhoras guardada?')
    if (!confirmed) return

    try {
      await api.deleteSavedView(viewId)
      const nextSavedViews = savedViews.filter((view) => view.id !== viewId)
      const nextDisabledIds = disabledSavedViewIds.filter((id) => id !== viewId)
      setSavedViews(nextSavedViews)
      setDisabledSavedViewIds(nextDisabledIds)

      if (activePenhorasSavedViewId === viewId) {
        const fallbackView = nextSavedViews
          .filter((view) => (view.scope === 'penhoras-tabela' || view.scope === 'penhoras-dashboard') && !nextDisabledIds.includes(view.id))
          .find(Boolean)
        if (fallbackView) {
          applyPenhorasView(fallbackView, { enableIfDisabled: false })
        } else {
          clearPenhorasFilters({ silent: true })
        }
      }
      setFeedback('Vista Penhoras eliminada.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Falha ao eliminar vista Penhoras.')
    }
  }

  function togglePenhorasSavedViewDisabled(viewId: string) {
    const isDisabled = disabledSavedViewIds.includes(viewId)
    const penhorasViews = savedViews.filter((view) => view.scope === 'penhoras-tabela' || view.scope === 'penhoras-dashboard')

    if (isDisabled) {
      setDisabledSavedViewIds((current) => current.filter((id) => id !== viewId))
      const view = penhorasViews.find((item) => item.id === viewId)
      if (view) {
        applyPenhorasView(view, { enableIfDisabled: false })
      }
      return
    }

    const nextDisabledIds = [...disabledSavedViewIds, viewId]
    setDisabledSavedViewIds(nextDisabledIds)

    if (activePenhorasSavedViewId === viewId) {
      const fallbackView = penhorasViews.find((view) => view.id !== viewId && !nextDisabledIds.includes(view.id))
      if (fallbackView) {
        applyPenhorasView(fallbackView, { enableIfDisabled: false })
      } else {
        clearPenhorasFilters({ silent: true })
      }
    }
  }

  function clearPenhorasFilters(options?: { silent?: boolean }) {
    setPenhorasFilters(DEFAULT_PENHORAS_FILTERS)
    setGlobalSearch('')
    setActivePenhorasSavedViewId(null)
    if (!options?.silent) {
      setFeedback('Filtros Penhoras limpos.')
    }
  }

  function applyPenhorasView(view: SavedView, options?: { enableIfDisabled?: boolean }) {
    const payload = view.filters
    setActivePenhorasSavedViewId(view.id)
    if (options?.enableIfDisabled ?? true) {
      setDisabledSavedViewIds((current) => current.filter((id) => id !== view.id))
    }
    setPenhorasFilters(sanitizePenhorasFilters(payload))
    if (view.scope === 'penhoras-dashboard') {
      const parsedWidgets = parsePenhorasDashboardWidgets((payload as Record<string, unknown>).widgets)
      if (parsedWidgets.length > 0) {
        setPenhorasDashboardWidgets(parsedWidgets)
      }
    }
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
        className={`dashboard-widget-card ds-dashboard-widget-card size-${widget.size} span-${effectiveColSpan} ${draggedDashboardWidgetId === widget.id ? 'dragging' : ''
          } ${dropDashboardWidgetId === widget.id ? 'drop-target' : ''} ${resizingDashboardWidgetId === widget.id ? 'resizing' : ''}`}
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

  function toggleQuickTool(tool: QuickToolId) {
    setToolsExpanded(true)
    const isOpen = tool === 'notes' ? notesOpen : tool === 'calculator' ? calculatorOpen : smartNotesOpen
    if (isOpen) {
      if (tool === 'notes') {
        setNotesOpen(false)
      } else if (tool === 'calculator') {
        setCalculatorOpen(false)
      } else {
        setSmartNotesOpen(false)
      }
      if (draggingTool === tool) {
        toolDragRef.current = null
        setDraggingTool(null)
      }
      return
    }

    if (tool === 'notes') {
      setNotesOpen(true)
    } else if (tool === 'calculator') {
      setCalculatorOpen(true)
    } else {
      setSmartNotesOpen(true)
    }

    setToolLayers((current) => {
      const nextLayer = toolLayerRef.current++
      return { ...current, [tool]: nextLayer }
    })
  }

  function toggleQuickToolPinned(tool: QuickToolId) {
    setToolPinned((current) => ({ ...current, [tool]: !current[tool] }))
    setToolLayers((current) => {
      const nextLayer = toolLayerRef.current++
      return { ...current, [tool]: nextLayer }
    })
  }

  function bringToolToFront(tool: QuickToolId) {
    setToolLayers((current) => {
      const nextLayer = toolLayerRef.current++
      return { ...current, [tool]: nextLayer }
    })
  }

  function getToolWindowElement(tool: QuickToolId): HTMLDivElement | null {
    if (tool === 'notes') return notesWindowRef.current
    if (tool === 'calculator') return calculatorWindowRef.current
    return smartNotesWindowRef.current
  }

  function startToolWindowDrag(tool: QuickToolId, event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const element = getToolWindowElement(tool)
    if (!element) return

    bringToolToFront(tool)
    const rect = element.getBoundingClientRect()
    setToolPositions((current) => ({ ...current, [tool]: { x: rect.left, y: rect.top } }))
    toolDragRef.current = {
      tool,
      pointerOffsetX: event.clientX - rect.left,
      pointerOffsetY: event.clientY - rect.top,
    }
    setDraggingTool(tool)
    event.preventDefault()
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
    if (!draggingTool) return

    function handleToolWindowMouseMove(event: MouseEvent) {
      const dragState = toolDragRef.current
      if (!dragState) return
      const element = getToolWindowElement(dragState.tool)
      if (!element) return

      const margin = 10
      const width = element.offsetWidth
      const height = element.offsetHeight
      const maxX = Math.max(margin, window.innerWidth - width - margin)
      const maxY = Math.max(margin, window.innerHeight - height - margin)
      const rawX = event.clientX - dragState.pointerOffsetX
      const rawY = event.clientY - dragState.pointerOffsetY
      const nextX = Math.min(maxX, Math.max(margin, rawX))
      const nextY = Math.min(maxY, Math.max(margin, rawY))

      setToolPositions((current) => ({ ...current, [dragState.tool]: { x: nextX, y: nextY } }))
    }

    function stopToolWindowDrag() {
      toolDragRef.current = null
      setDraggingTool(null)
    }

    window.addEventListener('mousemove', handleToolWindowMouseMove)
    window.addEventListener('mouseup', stopToolWindowDrag, { once: true })
    return () => {
      window.removeEventListener('mousemove', handleToolWindowMouseMove)
      window.removeEventListener('mouseup', stopToolWindowDrag)
    }
  }, [draggingTool])

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
        onClick={() => void runUndo()}
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
  const notesWindowZIndex = (toolPinned.notes ? 2600 : 1700) + toolLayers.notes
  const calculatorWindowZIndex = (toolPinned.calculator ? 2600 : 1700) + toolLayers.calculator
  const smartNotesWindowZIndex = (toolPinned['smart-notes'] ? 2600 : 1700) + toolLayers['smart-notes']

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
          <section className="panel entrada-layout">
            <aside className="panel side-list">
              <div className="row-between">
                <h2>Registos recentes DS</h2>
                <span className="recent-mode-badge">Lista</span>
              </div>
              <div className="small-note">Últimas alterações</div>
              <div className="recent-list compact ds-recent-list">
                {dsRecentRecords.length === 0 ? (
                  <div className="empty-text">Ainda não existem registos DS.</div>
                ) : (
                  dsRecentRecords.map((record) => {
                    const status = getStatus(dsStatuses, record.estadoId)
                    const reference = record.referencia || record.proponentes || 'Sem referência'
                    const details = [record.gestora, record.produto].filter((value): value is string => Boolean(value?.trim())).join(' · ')
                    return (
                      <button
                        key={record.id}
                        className="recent-card ds-recent-card"
                        type="button"
                        onClick={() => {
                          setSelectedDsRecordId(record.id)
                          setActiveTab('consulta')
                        }}
                      >
                        <span className="ds-recent-ref">{reference}</span>
                        <span className="muted ds-recent-meta">{details || '-'}</span>
                        {status ? (
                          <StatusPill status={status} compact />
                        ) : (
                          <span className="status-pill compact ds-status-fallback">
                            <Circle size={14} />
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </aside>

            <div className="panel ds-panel ds-entry-panel">
              <div className="row-between">
                <div>
                  <h2>Entrada DS</h2>
                  <p className="small-note">Registo manual de escrituras concretizadas no módulo DS.</p>
                </div>
              </div>

              <form className="entry-form ds-entry-form" onSubmit={(event) => void submitDsEntry(event, 'save')}>
                <section className="ds-form-section">
                  <h3 className="ds-form-section-title">Identificação</h3>
                  <div className="field-grid three">
                    <LabeledInput
                      label="Gestora"
                      value={dsEntryForm.gestora}
                      onChange={(value) => handleDsEntryInput('gestora', value)}
                      suggestions={dsGestoraFilterOptions}
                    />
                    <LabeledInput
                      label="Proponentes"
                      value={dsEntryForm.proponentes}
                      onChange={(value) => handleDsEntryInput('proponentes', value)}
                      suggestions={dsProponentesSuggestions}
                    />
                    <LabeledInput
                      label="Referência"
                      value={dsEntryForm.referencia}
                      onChange={(value) => handleDsEntryInput('referencia', value)}
                      suggestions={dsReferenciaSuggestions}
                    />
                  </div>
                </section>

                <section className="ds-form-section">
                  <h3 className="ds-form-section-title">Contexto operacional</h3>
                  <div className="field-grid three">
                    <LabeledInput
                      label="Produto"
                      value={dsEntryForm.produto}
                      onChange={(value) => handleDsEntryInput('produto', value)}
                      suggestions={dsProdutoFilterOptions}
                    />
                    <LabeledInput
                      label="Entidade bancária"
                      value={dsEntryForm.entidadeBancaria}
                      onChange={(value) => handleDsEntryInput('entidadeBancaria', value)}
                      suggestions={dsEntidadeFilterOptions}
                    />
                    <LabeledInput
                      label="Líder cálculo"
                      value={dsEntryForm.liderCalculo}
                      onChange={(value) => handleDsEntryInput('liderCalculo', value)}
                    />
                  </div>

                  <div className="field-grid three">
                    <LabeledInput
                      label="Recibo"
                      value={dsEntryForm.recibo}
                      onChange={(value) => handleDsEntryInput('recibo', value)}
                      suggestions={dsReciboSuggestions}
                    />
                    <LabeledInput
                      label="Falta recibo gestora"
                      value={dsEntryForm.faltaReciboGestora}
                      onChange={(value) => handleDsEntryInput('faltaReciboGestora', value)}
                    />
                    <LabeledSelect
                      label="Estado"
                      value={dsEntryForm.estadoId}
                      onChange={(value) => handleDsEntryInput('estadoId', value)}
                      options={
                        dsOrderedStatuses.length > 0
                          ? dsOrderedStatuses.map((status) => ({ value: status.id, label: status.label }))
                          : [{ value: dsEntryForm.estadoId || '', label: 'Sem estado' }]
                      }
                    />
                  </div>
                </section>

                <section className="ds-form-section">
                  <h3 className="ds-form-section-title">Financeiro</h3>
                  <div className="field-grid three">
                    <LabeledInput label="Valor" value={dsEntryForm.valor} onChange={(value) => handleDsEntryInput('valor', value)} />
                    <LabeledInput label="Comissão loja" value={dsEntryForm.comissaoLoja} onChange={(value) => handleDsEntryInput('comissaoLoja', value)} />
                    <LabeledInput
                      label="Total comissão loja c/ IVA"
                      value={dsEntryForm.totalComissaoLojaCmIva}
                      onChange={(value) => handleDsEntryInput('totalComissaoLojaCmIva', value)}
                    />
                  </div>

                  <div className="field-grid three">
                    <LabeledInput label="IVA CGD (raw)" value={dsEntryForm.ivaCgdRaw} onChange={(value) => handleDsEntryInput('ivaCgdRaw', value)} />
                    <LabeledInput label="Comissão gestor" value={dsEntryForm.comissaoGestor} onChange={(value) => handleDsEntryInput('comissaoGestor', value)} />
                    <LabeledInput label="Percentagem" value={dsEntryForm.percentagem} onChange={(value) => handleDsEntryInput('percentagem', value)} />
                  </div>
                </section>

                <section className="ds-form-section">
                  <h3 className="ds-form-section-title">Datas e pagamento</h3>
                  <div className="field-grid three">
                    <LabeledInput
                      label="Data escritura"
                      type="date"
                      value={dsEntryForm.dataEscritura}
                      onChange={(value) => handleDsEntryInput('dataEscritura', value)}
                    />
                    <LabeledInput
                      label="Data fecho CRM"
                      type="date"
                      value={dsEntryForm.dataFechoCrm}
                      onChange={(value) => handleDsEntryInput('dataFechoCrm', value)}
                    />
                    <LabeledInput
                      label="Pagamento comissão gestor"
                      value={dsEntryForm.pagComissaoGestor}
                      onChange={(value) => handleDsEntryInput('pagComissaoGestor', value)}
                    />
                  </div>
                </section>

                <div className="actions-row ds-entry-actions">
                  <button
                    className="subtle-btn"
                    type="button"
                    onClick={() => setDsEntryForm(getInitialDsEntryForm(dsDefaultStatus?.id ?? dsEntryForm.estadoId))}
                  >
                    Limpar
                  </button>
                  <button className="subtle-btn" type="button" onClick={() => void saveNewDsEntry()}>
                    Guardar e novo
                  </button>
                  <button className="primary-btn" type="submit">
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {activeModule === 'ds' && activeTab === 'dashboards' && (
          <section className="panel dashboard-experiment ds-panel ds-dashboard-panel">
            {!isDashboardFocusMode && (
              <>
                <div className="row-between wrap">
                  <div>
                    <h2>Dashboards DS</h2>
                    <p className="small-note">Visão rápida de performance da operação DS com filtros e vistas guardadas.</p>
                  </div>
                  <div className="saved-view-bar ds-saved-view-bar">
                    {dsDashboardViews.map((view) => {
                      const isDisabled = disabledSavedViewIds.includes(view.id)
                      const isActive = activeDsSavedViewId === view.id && !isDisabled
                      return (
                        <div key={view.id} className={`saved-view-chip ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`}>
                          <button
                            className="subtle-btn saved-view-apply"
                            type="button"
                            onClick={() => applyDsView(view)}
                            disabled={isDisabled}
                            title={isDisabled ? 'Vista DS desativada' : `Aplicar vista: ${view.name}`}
                          >
                            {view.name}
                          </button>
                          <button
                            className="subtle-btn icon-btn micro"
                            type="button"
                            onClick={() => toggleDsSavedViewDisabled(view.id)}
                            title={isDisabled ? 'Ativar vista DS' : 'Desativar vista DS'}
                            aria-label={isDisabled ? 'Ativar vista DS' : 'Desativar vista DS'}
                          >
                            {isDisabled ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button
                            className="subtle-btn icon-btn micro danger"
                            type="button"
                            onClick={() => void deleteDsSavedView(view.id)}
                            title="Eliminar vista DS"
                            aria-label="Eliminar vista DS"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                    <button className="subtle-btn" type="button" onClick={() => clearDsFilters()}>
                      <FilterX size={15} />
                      Limpar filtros
                    </button>
                    <button
                      className="subtle-btn"
                      type="button"
                      onClick={() => void saveCurrentView('ds-dashboard', { ...dsFilters, q: globalSearch, widgets: dsDashboardWidgets })}
                    >
                      Guardar vista
                    </button>
                  </div>
                </div>

                <div className="dashboard-top-actions">
                  <button
                    className="subtle-btn"
                    type="button"
                    onClick={() => {
                      setDashboardFocusMode(true)
                      setDsDashboardWidgetsOpen(true)
                    }}
                  >
                    <Maximize2 size={15} />
                    Expandir dashboard
                  </button>
                  <button className="subtle-btn" type="button" onClick={() => setDsDashboardConfigOpen((current) => !current)}>
                    {dsDashboardConfigOpen ? <EyeOff size={15} /> : <Eye size={15} />}
                    {dsDashboardConfigOpen ? 'Ocultar painel' : 'Mostrar painel'}
                  </button>
                  <button className="subtle-btn" type="button" onClick={() => setDsDashboardWidgetsOpen((current) => !current)}>
                    {dsDashboardWidgetsOpen ? 'Ocultar widgets' : 'Mostrar widgets'}
                  </button>
                  <button className="subtle-btn" type="button" onClick={() => setDsDashboardPickerOpen((current) => !current)}>
                    <Plus size={15} />
                    {dsDashboardPickerOpen ? 'Ocultar catálogo' : 'Adicionar widgets'}
                  </button>
                  <button className="subtle-btn" type="button" onClick={() => setDsDashboardWidgets(cloneDefaultDsDashboardWidgets())}>
                    Repor widgets
                  </button>
                </div>

                {dsDashboardConfigOpen ? (
                  <>
                    <div className="dashboard-hero-grid ds-dashboard-hero">
                      <article className="dashboard-hero-card ds-dashboard-hero-card">
                        <span>Total registos</span>
                        <strong>{new Intl.NumberFormat('pt-PT').format(dsDashboardTotals.registos)}</strong>
                      </article>
                      <article className="dashboard-hero-card ds-dashboard-hero-card">
                        <span>Total comissão loja</span>
                        <strong>{formatCurrency(dsDashboardTotals.comissaoLoja)}</strong>
                      </article>
                      <article className="dashboard-hero-card ds-dashboard-hero-card">
                        <span>Total comissão loja c/ IVA</span>
                        <strong>{formatCurrency(dsDashboardTotals.totalComissaoLojaCmIva)}</strong>
                      </article>
                    </div>

                    <div className="filters-row eight ds-filters-row">
                      <LabeledSelect
                        label="Estado"
                        value={String(dsFilters.estadoId ?? 'todos')}
                        onChange={(value) => patchDsFilters('estadoId', value as DsRecordFilters['estadoId'])}
                        options={[{ value: 'todos', label: 'Todos' }, ...dsOrderedStatuses.map((status) => ({ value: status.id, label: status.label }))]}
                      />
                      <LabeledSelect
                        label="Ano"
                        value={String(dsFilters.ano ?? 'todos')}
                        onChange={(value) => patchDsFilters('ano', value === 'todos' ? 'todos' : Number(value))}
                        options={[{ value: 'todos', label: 'Todos' }, ...dsYears.map((year) => ({ value: String(year), label: String(year) }))]}
                      />
                      <LabeledSelect
                        label="Mês"
                        value={String(dsFilters.mes ?? 'todos')}
                        onChange={(value) => patchDsFilters('mes', value === 'todos' ? 'todos' : Number(value))}
                        options={[{ value: 'todos', label: 'Todos' }, ...MONTHS.map((label, index) => ({ value: String(index + 1), label }))]}
                      />
                      <LabeledSelect
                        label="Gestora"
                        value={String(dsFilters.gestora ?? '')}
                        onChange={(value) => patchDsFilters('gestora', value)}
                        options={[{ value: '', label: 'Todas' }, ...dsGestoraFilterOptions.map((value) => ({ value, label: value }))]}
                      />
                      <LabeledSelect
                        label="Entidade"
                        value={String(dsFilters.entidadeBancaria ?? '')}
                        onChange={(value) => patchDsFilters('entidadeBancaria', value)}
                        options={[{ value: '', label: 'Todas' }, ...dsEntidadeFilterOptions.map((value) => ({ value, label: value }))]}
                      />
                      <LabeledSelect
                        label="Produto"
                        value={String(dsFilters.produto ?? '')}
                        onChange={(value) => patchDsFilters('produto', value)}
                        options={[{ value: '', label: 'Todos' }, ...dsProdutoFilterOptions.map((value) => ({ value, label: value }))]}
                      />
                      <LabeledSelect
                        label="Recibo"
                        value={String(dsFilters.reciboEstado ?? 'todos')}
                        onChange={(value) => patchDsFilters('reciboEstado', value as DsRecordFilters['reciboEstado'])}
                        options={[
                          { value: 'todos', label: 'Todos' },
                          { value: 'com-recibo', label: 'Com recibo' },
                          { value: 'sem-recibo', label: 'Sem recibo' },
                        ]}
                      />
                      <div className="field">
                        <span>Total</span>
                        <div className="counter-box">{dsRecordsLoading ? 'A carregar...' : `${dsTotalRecords} registos`}</div>
                      </div>
                    </div>

                    <div className="dashboard-picker-wrap">
                      <button className="subtle-btn" type="button" onClick={() => setDsDashboardPickerOpen((current) => !current)}>
                        {dsDashboardPickerOpen ? 'Ocultar widgets' : 'Adicionar widgets'}
                      </button>
                      {dsDashboardPickerOpen && (
                        <div className="dashboard-widget-library">
                          {DS_DASHBOARD_WIDGET_LIBRARY.map((widget) => (
                            <button
                              key={widget.type}
                              className="dashboard-widget-option"
                              type="button"
                              onClick={() => addDsDashboardWidget(widget.type)}
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
                    Painel de configuração oculto. Use “Mostrar painel” para editar filtros.
                  </div>
                )}
              </>
            )}

            {dsDashboardWidgetsOpen || isDashboardFocusMode ? (
              dsDashboardWidgets.length === 0 ? (
                <div className="empty-text dashboard-empty">
                  Sem widgets ativos.
                  <button className="subtle-btn" type="button" onClick={() => setDsDashboardWidgets(cloneDefaultDsDashboardWidgets())}>
                    Repor widgets
                  </button>
                </div>
              ) : (
                <div className={`dashboard-grid ds-dashboard-grid ${dsDashboardHasSideStack ? 'with-side-stack' : ''}`}>
                  {dsDashboardHasSideStack ? (
                    <>
                      <div className="dashboard-main-widgets">{dsDashboardMainWidgets.map((widget) => renderDsDashboardWidget(widget))}</div>
                      <aside className="dashboard-side-widgets">{dsDashboardSideWidgets.map((widget) => renderDsDashboardWidget(widget))}</aside>
                    </>
                  ) : dsDashboardSideWidgets.length > 0 && dsDashboardMainWidgets.length === 0 ? (
                    <aside className="dashboard-side-widgets">{dsDashboardSideWidgets.map((widget) => renderDsDashboardWidget(widget))}</aside>
                  ) : (
                    dsDashboardWidgets.map((widget) => renderDsDashboardWidget(widget))
                  )}
                </div>
              )
            ) : (
              <div className="dashboard-collapsed-note muted">
                Widgets ocultos. Use “Mostrar widgets” para voltar a apresentar o dashboard.
              </div>
            )}
          </section>
        )}

        {activeModule === 'ds' && (activeTab === 'consulta' || activeTab === 'tabela') && (
          <section className="panel ds-panel ds-results-panel">
            <div className="row-between wrap">
              <div>
                <h2>{activeTab === 'consulta' ? 'Consulta DS' : 'Tabela DS'}</h2>
                <p className="small-note">Registos de escrituras DS isolados do módulo de recibos.</p>
              </div>
              <div className="saved-view-bar ds-saved-view-bar">
                {dsTableViews.map((view) => {
                  const isDisabled = disabledSavedViewIds.includes(view.id)
                  const isActive = activeDsSavedViewId === view.id && !isDisabled
                  return (
                    <div key={view.id} className={`saved-view-chip ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`}>
                      <button
                        className="subtle-btn saved-view-apply"
                        type="button"
                        onClick={() => applyDsView(view)}
                        disabled={isDisabled}
                        title={isDisabled ? 'Vista DS desativada' : `Aplicar vista: ${view.name}`}
                      >
                        {view.name}
                      </button>
                      <button
                        className="subtle-btn icon-btn micro"
                        type="button"
                        onClick={() => toggleDsSavedViewDisabled(view.id)}
                        title={isDisabled ? 'Ativar vista DS' : 'Desativar vista DS'}
                        aria-label={isDisabled ? 'Ativar vista DS' : 'Desativar vista DS'}
                      >
                        {isDisabled ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        className="subtle-btn icon-btn micro danger"
                        type="button"
                        onClick={() => void deleteDsSavedView(view.id)}
                        title="Eliminar vista DS"
                        aria-label="Eliminar vista DS"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
                <button className="subtle-btn" type="button" onClick={() => clearDsFilters()}>
                  <FilterX size={15} />
                  Limpar filtros
                </button>
                <button className="subtle-btn" type="button" onClick={() => void saveCurrentView('ds-tabela', { ...dsFilters, q: globalSearch })}>
                  Guardar vista
                </button>
              </div>
            </div>

            <div className="filters-row eight ds-filters-row">
              <LabeledSelect
                label="Estado"
                value={String(dsFilters.estadoId ?? 'todos')}
                onChange={(value) => patchDsFilters('estadoId', value as DsRecordFilters['estadoId'])}
                options={[{ value: 'todos', label: 'Todos' }, ...dsOrderedStatuses.map((status) => ({ value: status.id, label: status.label }))]}
              />
              <LabeledSelect
                label="Ano"
                value={String(dsFilters.ano ?? 'todos')}
                onChange={(value) => patchDsFilters('ano', value === 'todos' ? 'todos' : Number(value))}
                options={[{ value: 'todos', label: 'Todos' }, ...dsYears.map((year) => ({ value: String(year), label: String(year) }))]}
              />
              <LabeledSelect
                label="Mês"
                value={String(dsFilters.mes ?? 'todos')}
                onChange={(value) => patchDsFilters('mes', value === 'todos' ? 'todos' : Number(value))}
                options={[{ value: 'todos', label: 'Todos' }, ...MONTHS.map((label, index) => ({ value: String(index + 1), label }))]}
              />
              <LabeledSelect
                label="Gestora"
                value={String(dsFilters.gestora ?? '')}
                onChange={(value) => patchDsFilters('gestora', value)}
                options={[{ value: '', label: 'Todas' }, ...dsGestoraFilterOptions.map((value) => ({ value, label: value }))]}
              />
              <LabeledSelect
                label="Entidade"
                value={String(dsFilters.entidadeBancaria ?? '')}
                onChange={(value) => patchDsFilters('entidadeBancaria', value)}
                options={[{ value: '', label: 'Todas' }, ...dsEntidadeFilterOptions.map((value) => ({ value, label: value }))]}
              />
              <LabeledSelect
                label="Produto"
                value={String(dsFilters.produto ?? '')}
                onChange={(value) => patchDsFilters('produto', value)}
                options={[{ value: '', label: 'Todos' }, ...dsProdutoFilterOptions.map((value) => ({ value, label: value }))]}
              />
              <LabeledSelect
                label="Recibo"
                value={String(dsFilters.reciboEstado ?? 'todos')}
                onChange={(value) => patchDsFilters('reciboEstado', value as DsRecordFilters['reciboEstado'])}
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'com-recibo', label: 'Com recibo' },
                  { value: 'sem-recibo', label: 'Sem recibo' },
                ]}
              />
              <div className="field">
                <span>Total</span>
                <div className="counter-box">{dsRecordsLoading ? 'A carregar...' : `${dsTotalRecords} registos`}</div>
              </div>
            </div>

            {dsRecords.length === 0 ? (
              <div className="empty-text">Sem resultados DS para os filtros selecionados.</div>
            ) : activeTab === 'consulta' ? (
              <div className="card-list ds-card-list">
                {dsRecords.map((record) => {
                  const status = getStatus(dsStatuses, record.estadoId)
                  return (
                    <article key={record.id} className="result-card ds-result-card clickable-row" onClick={() => setSelectedDsRecordId(record.id)}>
                      <div className="result-main ds-result-main">
                        <div className="result-title ds-result-title">{record.proponentes || 'Sem proponentes'}</div>
                        <div className="muted ds-result-secondary">
                          <span>Gestor/a: {record.gestora || '-'}</span>
                          <span>Referência: {record.referencia || '-'}</span>
                        </div>
                      </div>
                      <div className="result-entity muted ds-result-meta">
                        {`Escritura: ${record.dataEscritura || '-'} · ${record.produto || 'Produto por definir'}`}
                      </div>
                      <div className="ds-result-metrics">
                        <strong>{formatCurrency(record.valor)}</strong>
                        <span>Comissão loja: {formatCurrency(record.comissaoLoja)}</span>
                      </div>
                      <div className="card-actions ds-card-actions">
                        <button
                          className="subtle-btn"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedDsRecordId(record.id)
                            setIsDsRecordEditing(true)
                          }}
                        >
                          Editar
                        </button>
                      </div>
                      <div className="result-status ds-result-status">
                        {record.faltaReciboGestora?.trim() && (
                          <span className="ds-warning-pill" title={record.faltaReciboGestora}>
                            <AlertTriangle size={13} />
                            <span>{record.faltaReciboGestora}</span>
                          </span>
                        )}
                        {status ? <StatusPill status={status} /> : <span className="muted ds-status-pill-empty">Sem estado</span>}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="table-wrapper ds-table-wrapper">
                <table className="records-table ds-records-table">
                  <thead>
                    <tr>
                      <th>Gestor/a</th>
                      <th>Proponentes</th>
                      <th>Valor</th>
                      <th>Data Escritura</th>
                      <th>Comissão Loja</th>
                      <th>Estado</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dsRecords.map((record) => {
                      const status = getStatus(dsStatuses, record.estadoId)
                      return (
                        <tr
                          key={record.id}
                          style={{ backgroundColor: status ? colorWithAlpha(status.color, '1F') : undefined }}
                          onClick={() => setSelectedDsRecordId(record.id)}
                        >
                          <td>{record.gestora || '-'}</td>
                          <td>{record.proponentes || '-'}</td>
                          <td>{formatCurrency(record.valor)}</td>
                          <td>{record.dataEscritura || '-'}</td>
                          <td>{formatCurrency(record.comissaoLoja)}</td>
                          <td>
                            <select
                              className="ds-status-select"
                              value={record.estadoId}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => void updateDsRecordStatus(record.id, event.target.value)}
                            >
                              {dsOrderedStatuses.map((statusOption) => (
                                <option key={statusOption.id} value={statusOption.id}>{statusOption.label}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button
                              className="subtle-btn compact"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedDsRecordId(record.id)
                                setIsDsRecordEditing(true)
                              }}
                            >
                              Editar
                            </button>
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

        {activeModule === 'ds' && activeTab === 'importar' && (
          <section className="panel ds-panel ds-import-panel">
            <h2>Importar DS</h2>
            <p className="small-note">Importação da folha de escrituras concretizadas com preview e conflitos.</p>
            <div className="import-box">
              <input type="file" accept=".xlsx" onChange={(event) => void handleDsImportFile(event)} />
              <div className="actions-row start">
                <button className="subtle-btn" type="button" onClick={() => void refreshDsImportPreview()}>
                  Rever conflitos DS
                </button>
                <LabeledSelect
                  label="Estratégia"
                  value={dsImportStrategy}
                  onChange={(value) => setDsImportStrategy(value as 'skip' | 'update' | 'duplicate')}
                  options={[
                    { value: 'update', label: 'Atualizar existentes' },
                    { value: 'skip', label: 'Ignorar duplicados' },
                    { value: 'duplicate', label: 'Criar duplicado' },
                  ]}
                />
                <button className="primary-btn" type="button" onClick={() => void runDsImportCommit()} disabled={!dsImportPreview || dsImportLoading}>
                  Confirmar importação DS
                </button>
              </div>
              {dsImportLoading && <div className="small-note">A processar ficheiro DS...</div>}
            </div>
            {dsImportServerPreview && (
              <div className="import-summary">
                <span>Total: {dsImportServerPreview.summary.total}</span>
                <span>Válidas: {dsImportServerPreview.summary.valid}</span>
                <span>Conflitos: {dsImportServerPreview.summary.conflicts}</span>
                <span>Novas: {dsImportServerPreview.summary.creates}</span>
                <span>Inválidas: {dsImportServerPreview.summary.invalid}</span>
              </div>
            )}
          </section>
        )}

        {activeModule === 'ds' && activeTab === 'configuracao' && (
          <section className="panel ds-panel ds-settings-panel">
            <h2>Configuração DS</h2>
            <p className="small-note">Estados independentes do módulo de recibos.</p>
            <div className="actions-row start">
              <button className="subtle-btn" type="button" onClick={() => setActiveTab('importar')}>
                Importar DS
              </button>
            </div>
            <div className="status-list">
              {dsOrderedStatuses.map((status) => (
                <div key={status.id} className="status-item">
                  <span className="status-icon-preview">
                    <StatusIcon name={status.icon} size={16} />
                  </span>
                  <select className="status-icon" value={status.icon} onChange={(event) => updateDsStatusLocal(status.id, { icon: event.target.value })}>
                    {STATUS_ICON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input value={status.label} onChange={(event) => updateDsStatusLocal(status.id, { label: event.target.value })} />
                  <input type="color" value={toColor(status.color)} onChange={(event) => updateDsStatusLocal(status.id, { color: event.target.value })} />
                  <input type="number" className="small-number" value={status.order} onChange={(event) => updateDsStatusLocal(status.id, { order: Number(event.target.value) || 0 })} />
                  <label className="inline-check">
                    <input type="checkbox" checked={status.active} onChange={(event) => updateDsStatusLocal(status.id, { active: event.target.checked })} />
                    Ativo
                  </label>
                  <button className="danger-link" type="button" onClick={() => void removeDsStatus(status.id)}>Remover</button>
                </div>
              ))}
            </div>
            <div className="actions-row start">
              <button className="subtle-btn" type="button" onClick={() => void addDsStatus()}>Novo estado DS</button>
              <button className="subtle-btn" type="button" onClick={() => void saveDsStatuses()}>Guardar estados DS</button>
            </div>
          </section>
        )}

        {activeModule === 'penhoras' && activeTab === 'entrada' && (
          <section className="panel entrada-layout">
            <aside className="panel side-list">
              <div className="row-between">
                <h2>Registos recentes Penhoras</h2>
                <span className="recent-mode-badge">Lista</span>
              </div>
              <div className="small-note">Últimas alterações</div>
              <div className="recent-list compact penhoras-recent-list">
                {penhorasRecentRecords.length === 0 ? (
                  <div className="empty-text">Ainda não existem registos de penhoras.</div>
                ) : (
                  penhorasRecentRecords.map((record) => {
                    const status = getStatus(penhorasStatuses, record.estadoId)
                    const reference = record.pe || record.pedido || record.identificacao || 'Sem referência'
                    const details = [record.gestor, record.acto].filter((value): value is string => Boolean(value?.trim())).join(' · ')
                    return (
                      <button
                        key={record.id}
                        className="recent-card penhoras-recent-card"
                        type="button"
                        onClick={() => {
                          setSelectedPenhorasRecordId(record.id)
                          setActiveTab('consulta')
                        }}
                      >
                        <span className="penhoras-recent-ref">{reference}</span>
                        <span className="muted penhoras-recent-meta">{details || '-'}</span>
                        {status ? (
                          <StatusPill status={status} compact />
                        ) : (
                          <span className="status-pill compact ds-status-fallback">
                            <Circle size={14} />
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </aside>

            <div className="panel ds-panel penhoras-panel penhoras-entry-panel">
              <div className="row-between">
                <div>
                  <h2>Entrada Penhoras</h2>
                  <p className="small-note">Registo manual de penhoras com dados isolados dos módulos de recibos e DS.</p>
                </div>
              </div>

              <form className="entry-form ds-entry-form" onSubmit={(event) => void submitPenhorasEntry(event, 'save')}>
                <section className="ds-form-section">
                  <h3 className="ds-form-section-title">Identificação</h3>
                  <div className="field-grid three">
                    <LabeledInput
                      label="PE"
                      value={penhorasEntryForm.pe}
                      onChange={(value) => handlePenhorasEntryInput('pe', value)}
                      suggestions={penhorasPeSuggestions}
                    />
                    <LabeledInput
                      label="Acto"
                      value={penhorasEntryForm.acto}
                      onChange={(value) => handlePenhorasEntryInput('acto', value)}
                      suggestions={penhorasActoFilterOptions}
                    />
                    <LabeledInput
                      label="Data pedido"
                      type="date"
                      value={penhorasEntryForm.dataPedido}
                      onChange={(value) => handlePenhorasEntryInput('dataPedido', value)}
                    />
                  </div>
                </section>

                <section className="ds-form-section">
                  <h3 className="ds-form-section-title">Contexto operacional</h3>
                  <div className="field-grid three">
                    <LabeledInput
                      label="Identificação"
                      value={penhorasEntryForm.identificacao}
                      onChange={(value) => handlePenhorasEntryInput('identificacao', value)}
                    />
                    <LabeledInput
                      label="Pedido"
                      value={penhorasEntryForm.pedido}
                      onChange={(value) => handlePenhorasEntryInput('pedido', value)}
                    />
                    <LabeledInput
                      label="Gestor"
                      value={penhorasEntryForm.gestor}
                      onChange={(value) => handlePenhorasEntryInput('gestor', value)}
                      suggestions={penhorasGestorFilterOptions}
                    />
                  </div>
                  <div className="field-grid three">
                    <LabeledSelect
                      label="Estado"
                      value={penhorasEntryForm.estadoId}
                      onChange={(value) => handlePenhorasEntryInput('estadoId', value)}
                      options={
                        penhorasActiveStatuses.length > 0
                          ? penhorasActiveStatuses.map((status) => ({ value: status.id, label: status.label }))
                          : [{ value: penhorasEntryForm.estadoId || '', label: 'Sem estado' }]
                      }
                    />
                  </div>
                </section>

                <div className="actions-row ds-entry-actions">
                  <button
                    className="subtle-btn"
                    type="button"
                    onClick={() => setPenhorasEntryForm(getInitialPenhorasEntryForm(penhorasDefaultStatus?.id ?? penhorasEntryForm.estadoId))}
                  >
                    Limpar
                  </button>
                  <button className="subtle-btn" type="button" onClick={() => void saveNewPenhorasEntry()}>
                    Guardar e novo
                  </button>
                  <button className="primary-btn" type="submit">
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {activeModule === 'penhoras' && activeTab === 'dashboards' && (
          <section className="panel dashboard-experiment ds-panel penhoras-panel penhoras-dashboard-panel">
            {!isDashboardFocusMode && (
              <>
                <div className="row-between wrap">
                  <div>
                    <h2>Dashboards Penhoras</h2>
                    <p className="small-note">Acompanhamento de volume, estado e distribuição temporal dos registos de penhoras.</p>
                  </div>
                  <div className="saved-view-bar ds-saved-view-bar">
                    {penhorasDashboardViews.map((view) => {
                      const isDisabled = disabledSavedViewIds.includes(view.id)
                      const isActive = activePenhorasSavedViewId === view.id && !isDisabled
                      return (
                        <div key={view.id} className={`saved-view-chip ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`}>
                          <button
                            className="subtle-btn saved-view-apply"
                            type="button"
                            onClick={() => applyPenhorasView(view)}
                            disabled={isDisabled}
                            title={isDisabled ? 'Vista Penhoras desativada' : `Aplicar vista: ${view.name}`}
                          >
                            {view.name}
                          </button>
                          <button
                            className="subtle-btn icon-btn micro"
                            type="button"
                            onClick={() => togglePenhorasSavedViewDisabled(view.id)}
                            title={isDisabled ? 'Ativar vista Penhoras' : 'Desativar vista Penhoras'}
                            aria-label={isDisabled ? 'Ativar vista Penhoras' : 'Desativar vista Penhoras'}
                          >
                            {isDisabled ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button
                            className="subtle-btn icon-btn micro danger"
                            type="button"
                            onClick={() => void deletePenhorasSavedView(view.id)}
                            title="Eliminar vista Penhoras"
                            aria-label="Eliminar vista Penhoras"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                    <button className="subtle-btn" type="button" onClick={() => clearPenhorasFilters()}>
                      <FilterX size={15} />
                      Limpar filtros
                    </button>
                    <button
                      className="subtle-btn"
                      type="button"
                      onClick={() =>
                        void saveCurrentView('penhoras-dashboard', { ...penhorasFilters, q: globalSearch, widgets: penhorasDashboardWidgets })
                      }
                    >
                      Guardar vista
                    </button>
                  </div>
                </div>

                <div className="dashboard-top-actions">
                  <button
                    className="subtle-btn"
                    type="button"
                    onClick={() => {
                      setDashboardFocusMode(true)
                      setPenhorasDashboardWidgetsOpen(true)
                    }}
                  >
                    <Maximize2 size={15} />
                    Expandir dashboard
                  </button>
                  <button className="subtle-btn" type="button" onClick={() => setPenhorasDashboardConfigOpen((current) => !current)}>
                    {penhorasDashboardConfigOpen ? <EyeOff size={15} /> : <Eye size={15} />}
                    {penhorasDashboardConfigOpen ? 'Ocultar painel' : 'Mostrar painel'}
                  </button>
                  <button className="subtle-btn" type="button" onClick={() => setPenhorasDashboardWidgetsOpen((current) => !current)}>
                    {penhorasDashboardWidgetsOpen ? 'Ocultar widgets' : 'Mostrar widgets'}
                  </button>
                  <button className="subtle-btn" type="button" onClick={() => setPenhorasDashboardPickerOpen((current) => !current)}>
                    <Plus size={15} />
                    {penhorasDashboardPickerOpen ? 'Ocultar catálogo' : 'Adicionar widgets'}
                  </button>
                  <button className="subtle-btn" type="button" onClick={() => setPenhorasDashboardWidgets(cloneDefaultPenhorasDashboardWidgets())}>
                    Repor widgets
                  </button>
                </div>

                {penhorasDashboardConfigOpen ? (
                  <>
                    <div className="dashboard-hero-grid ds-dashboard-hero">
                      <article className="dashboard-hero-card ds-dashboard-hero-card">
                        <span>Total registos</span>
                        <strong>{new Intl.NumberFormat('pt-PT').format(penhorasDashboardTotals.registos)}</strong>
                      </article>
                      <article className="dashboard-hero-card ds-dashboard-hero-card">
                        <span>Com data pedido</span>
                        <strong>{new Intl.NumberFormat('pt-PT').format(penhorasDashboardTotals.comDataPedido)}</strong>
                      </article>
                      <article className="dashboard-hero-card ds-dashboard-hero-card">
                        <span>Recusados/Desistência</span>
                        <strong>{new Intl.NumberFormat('pt-PT').format(penhorasDashboardTotals.recusados)}</strong>
                      </article>
                    </div>

                    <div className="filters-row seven ds-filters-row">
                      <LabeledSelect
                        label="Estado"
                        value={String(penhorasFilters.estadoId ?? 'todos')}
                        onChange={(value) => patchPenhorasFilters('estadoId', value as PenhorasRecordFilters['estadoId'])}
                        options={[{ value: 'todos', label: 'Todos' }, ...penhorasActiveStatuses.map((status) => ({ value: status.id, label: status.label }))]}
                      />
                      <LabeledSelect
                        label="Ano"
                        value={String(penhorasFilters.ano ?? 'todos')}
                        onChange={(value) => patchPenhorasFilters('ano', value === 'todos' ? 'todos' : Number(value))}
                        options={[{ value: 'todos', label: 'Todos' }, ...penhorasYears.map((year) => ({ value: String(year), label: String(year) }))]}
                      />
                      <LabeledSelect
                        label="Mês"
                        value={String(penhorasFilters.mes ?? 'todos')}
                        onChange={(value) => patchPenhorasFilters('mes', value === 'todos' ? 'todos' : Number(value))}
                        options={[{ value: 'todos', label: 'Todos' }, ...MONTHS.map((label, index) => ({ value: String(index + 1), label }))]}
                      />
                      <LabeledSelect
                        label="Gestor"
                        value={String(penhorasFilters.gestor ?? '')}
                        onChange={(value) => patchPenhorasFilters('gestor', value)}
                        options={[{ value: '', label: 'Todos' }, ...penhorasGestorFilterOptions.map((value) => ({ value, label: value }))]}
                      />
                      <LabeledSelect
                        label="Acto"
                        value={String(penhorasFilters.acto ?? '')}
                        onChange={(value) => patchPenhorasFilters('acto', value)}
                        options={[{ value: '', label: 'Todos' }, ...penhorasActoFilterOptions.map((value) => ({ value, label: value }))]}
                      />
                      <div className="field">
                        <span>Total</span>
                        <div className="counter-box">{penhorasRecordsLoading ? 'A carregar...' : `${penhorasTotalRecords} registos`}</div>
                      </div>
                      <div className="field">
                        <span>Aguarda registo</span>
                        <div className="counter-box">{new Intl.NumberFormat('pt-PT').format(penhorasDashboardTotals.pendentes)}</div>
                      </div>
                    </div>

                    <div className="dashboard-picker-wrap">
                      <button className="subtle-btn" type="button" onClick={() => setPenhorasDashboardPickerOpen((current) => !current)}>
                        {penhorasDashboardPickerOpen ? 'Ocultar widgets' : 'Adicionar widgets'}
                      </button>
                      {penhorasDashboardPickerOpen && (
                        <div className="dashboard-widget-library">
                          {PENHORAS_DASHBOARD_WIDGET_LIBRARY.map((widget) => (
                            <button
                              key={widget.type}
                              className="dashboard-widget-option"
                              type="button"
                              onClick={() => addPenhorasDashboardWidget(widget.type)}
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
                    Painel de configuração oculto. Use “Mostrar painel” para editar filtros.
                  </div>
                )}
              </>
            )}

            {penhorasDashboardWidgetsOpen || isDashboardFocusMode ? (
              penhorasDashboardWidgets.length === 0 ? (
                <div className="empty-text dashboard-empty">
                  Sem widgets ativos.
                  <button className="subtle-btn" type="button" onClick={() => setPenhorasDashboardWidgets(cloneDefaultPenhorasDashboardWidgets())}>
                    Repor widgets
                  </button>
                </div>
              ) : (
                <div className={`dashboard-grid ds-dashboard-grid ${penhorasDashboardHasSideStack ? 'with-side-stack' : ''}`}>
                  {penhorasDashboardHasSideStack ? (
                    <>
                      <div className="dashboard-main-widgets">
                        {penhorasDashboardMainWidgets.map((widget) => renderPenhorasDashboardWidget(widget))}
                      </div>
                      <aside className="dashboard-side-widgets">
                        {penhorasDashboardSideWidgets.map((widget) => renderPenhorasDashboardWidget(widget))}
                      </aside>
                    </>
                  ) : penhorasDashboardSideWidgets.length > 0 && penhorasDashboardMainWidgets.length === 0 ? (
                    <aside className="dashboard-side-widgets">
                      {penhorasDashboardSideWidgets.map((widget) => renderPenhorasDashboardWidget(widget))}
                    </aside>
                  ) : (
                    penhorasDashboardWidgets.map((widget) => renderPenhorasDashboardWidget(widget))
                  )}
                </div>
              )
            ) : (
              <div className="dashboard-collapsed-note muted">
                Widgets ocultos. Use “Mostrar widgets” para voltar a apresentar o dashboard.
              </div>
            )}
          </section>
        )}

        {activeModule === 'penhoras' && (activeTab === 'consulta' || activeTab === 'tabela') && (
          <section className="panel ds-panel penhoras-panel penhoras-results-panel">
            <div className="row-between wrap">
              <div>
                <h2>{activeTab === 'consulta' ? 'Consulta Penhoras' : 'Tabela Penhoras'}</h2>
                <p className="small-note">Registos de penhoras isolados dos módulos de recibos e DS.</p>
              </div>
              <div className="saved-view-bar ds-saved-view-bar">
                {penhorasTableViews.map((view) => {
                  const isDisabled = disabledSavedViewIds.includes(view.id)
                  const isActive = activePenhorasSavedViewId === view.id && !isDisabled
                  return (
                    <div key={view.id} className={`saved-view-chip ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`}>
                      <button
                        className="subtle-btn saved-view-apply"
                        type="button"
                        onClick={() => applyPenhorasView(view)}
                        disabled={isDisabled}
                        title={isDisabled ? 'Vista Penhoras desativada' : `Aplicar vista: ${view.name}`}
                      >
                        {view.name}
                      </button>
                      <button
                        className="subtle-btn icon-btn micro"
                        type="button"
                        onClick={() => togglePenhorasSavedViewDisabled(view.id)}
                        title={isDisabled ? 'Ativar vista Penhoras' : 'Desativar vista Penhoras'}
                        aria-label={isDisabled ? 'Ativar vista Penhoras' : 'Desativar vista Penhoras'}
                      >
                        {isDisabled ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        className="subtle-btn icon-btn micro danger"
                        type="button"
                        onClick={() => void deletePenhorasSavedView(view.id)}
                        title="Eliminar vista Penhoras"
                        aria-label="Eliminar vista Penhoras"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
                <button className="subtle-btn" type="button" onClick={() => clearPenhorasFilters()}>
                  <FilterX size={15} />
                  Limpar filtros
                </button>
                <button className="subtle-btn" type="button" onClick={() => void saveCurrentView('penhoras-tabela', { ...penhorasFilters, q: globalSearch })}>
                  Guardar vista
                </button>
              </div>
            </div>

            <div className="filters-row seven ds-filters-row">
              <LabeledSelect
                label="Estado"
                value={String(penhorasFilters.estadoId ?? 'todos')}
                onChange={(value) => patchPenhorasFilters('estadoId', value as PenhorasRecordFilters['estadoId'])}
                options={[{ value: 'todos', label: 'Todos' }, ...penhorasActiveStatuses.map((status) => ({ value: status.id, label: status.label }))]}
              />
              <LabeledSelect
                label="Ano"
                value={String(penhorasFilters.ano ?? 'todos')}
                onChange={(value) => patchPenhorasFilters('ano', value === 'todos' ? 'todos' : Number(value))}
                options={[{ value: 'todos', label: 'Todos' }, ...penhorasYears.map((year) => ({ value: String(year), label: String(year) }))]}
              />
              <LabeledSelect
                label="Mês"
                value={String(penhorasFilters.mes ?? 'todos')}
                onChange={(value) => patchPenhorasFilters('mes', value === 'todos' ? 'todos' : Number(value))}
                options={[{ value: 'todos', label: 'Todos' }, ...MONTHS.map((label, index) => ({ value: String(index + 1), label }))]}
              />
              <LabeledSelect
                label="Gestor"
                value={String(penhorasFilters.gestor ?? '')}
                onChange={(value) => patchPenhorasFilters('gestor', value)}
                options={[{ value: '', label: 'Todos' }, ...penhorasGestorFilterOptions.map((value) => ({ value, label: value }))]}
              />
              <LabeledSelect
                label="Acto"
                value={String(penhorasFilters.acto ?? '')}
                onChange={(value) => patchPenhorasFilters('acto', value)}
                options={[{ value: '', label: 'Todos' }, ...penhorasActoFilterOptions.map((value) => ({ value, label: value }))]}
              />
              <div className="field">
                <span>Total</span>
                <div className="counter-box">{penhorasRecordsLoading ? 'A carregar...' : `${penhorasTotalRecords} registos`}</div>
              </div>
              <div className="field">
                <span>Aguarda registo</span>
                <div className="counter-box">{new Intl.NumberFormat('pt-PT').format(penhorasDashboardTotals.pendentes)}</div>
              </div>
            </div>

            {penhorasRecords.length === 0 ? (
              <div className="empty-text">Sem resultados Penhoras para os filtros selecionados.</div>
            ) : activeTab === 'consulta' ? (
              <div className="card-list ds-card-list">
                {penhorasRecords.map((record) => {
                  const status = getStatus(penhorasStatuses, record.estadoId)
                  return (
                    <article key={record.id} className="result-card penhoras-result-card clickable-row" onClick={() => setSelectedPenhorasRecordId(record.id)}>
                      <div className="result-main ds-result-main">
                        <div className="result-title ds-result-title">{record.identificacao || record.pe || 'Sem identificação'}</div>
                        <div className="muted ds-result-secondary">
                          <span>PE: {record.pe || '-'}</span>
                          <span> · Pedido: {record.pedido || '-'}</span>
                        </div>
                      </div>
                      <div className="result-entity muted ds-result-meta">{`Gestor: ${record.gestor || '-'} · ${record.acto || 'Acto por definir'}`}</div>
                      <div className="ds-result-metrics">
                        <strong>{record.dataPedido || '-'}</strong>
                        <span>Data pedido</span>
                      </div>
                      <div className="card-actions ds-card-actions">
                        <button
                          className="subtle-btn"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedPenhorasRecordId(record.id)
                            setIsPenhorasRecordEditing(true)
                          }}
                        >
                          Editar
                        </button>
                      </div>
                      <div className="result-status ds-result-status">
                        {status ? <StatusPill status={status} /> : <span className="muted ds-status-pill-empty">Sem estado</span>}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="table-wrapper ds-table-wrapper">
                <table className="records-table ds-records-table">
                  <thead>
                    <tr>
                      <th>PE</th>
                      <th>Acto</th>
                      <th>Data Pedido</th>
                      <th>Identificação</th>
                      <th>Pedido</th>
                      <th>Gestor</th>
                      <th>Estado</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {penhorasRecords.map((record) => {
                      const status = getStatus(penhorasStatuses, record.estadoId)
                      const hasStatusOption = penhorasActiveStatuses.some((statusOption) => statusOption.id === record.estadoId)
                      const statusValue = hasStatusOption ? record.estadoId : ''
                      return (
                        <tr
                          key={record.id}
                          style={{ backgroundColor: status ? colorWithAlpha(status.color, '1F') : undefined }}
                          onClick={(event) => {
                            const target = event.target as HTMLElement
                            if (target.closest('button, select, option, input, textarea, a')) return
                            setSelectedPenhorasRecordId(record.id)
                          }}
                        >
                          <td>{record.pe || '-'}</td>
                          <td>{record.acto || '-'}</td>
                          <td>{record.dataPedido || '-'}</td>
                          <td>{record.identificacao || '-'}</td>
                          <td>{record.pedido || '-'}</td>
                          <td>{record.gestor || '-'}</td>
                          <td>
                            <select
                              className="ds-status-select"
                              value={statusValue}
                              onMouseDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => void updatePenhorasRecordStatus(record.id, event.target.value)}
                            >
                              {!hasStatusOption && <option value="">Selecionar estado...</option>}
                              {penhorasActiveStatuses.map((statusOption) => (
                                <option key={statusOption.id} value={statusOption.id}>{statusOption.label}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button
                              className="subtle-btn compact"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedPenhorasRecordId(record.id)
                                setIsPenhorasRecordEditing(true)
                              }}
                            >
                              Editar
                            </button>
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

        {activeModule === 'penhoras' && activeTab === 'importar' && (
          <section className="panel ds-panel penhoras-panel ds-import-panel">
            <h2>Importar Penhoras</h2>
            <p className="small-note">Importação dedicada de penhoras com pré-visualização e resolução de conflitos.</p>
            <div className="import-box">
              <input type="file" accept=".xlsx" onChange={(event) => void handlePenhorasImportFile(event)} />
              <div className="actions-row start">
                <button className="subtle-btn" type="button" onClick={() => void refreshPenhorasImportPreview()}>
                  Rever conflitos Penhoras
                </button>
                <LabeledSelect
                  label="Estratégia"
                  value={penhorasImportStrategy}
                  onChange={(value) => setPenhorasImportStrategy(value as 'skip' | 'update' | 'duplicate')}
                  options={[
                    { value: 'update', label: 'Atualizar existentes' },
                    { value: 'skip', label: 'Ignorar duplicados' },
                    { value: 'duplicate', label: 'Criar duplicado' },
                  ]}
                />
                <button
                  className="primary-btn"
                  type="button"
                  onClick={() => void runPenhorasImportCommit()}
                  disabled={!penhorasImportPreview || penhorasImportLoading}
                >
                  Confirmar importação Penhoras
                </button>
              </div>
              {penhorasImportLoading && <div className="small-note">A processar ficheiro Penhoras...</div>}
            </div>
            {penhorasImportPreview && (
              <div className="import-summary">
                <span>Ficheiro: {penhorasImportPreview.fileName}</span>
                <span>Linhas: {penhorasImportPreview.rows.length}</span>
              </div>
            )}
            {penhorasImportServerPreview && (
              <div className="import-summary">
                <span>Total: {penhorasImportServerPreview.summary.total}</span>
                <span>Válidas: {penhorasImportServerPreview.summary.valid}</span>
                <span>Conflitos: {penhorasImportServerPreview.summary.conflicts}</span>
                <span>Novas: {penhorasImportServerPreview.summary.creates}</span>
                <span>Inválidas: {penhorasImportServerPreview.summary.invalid}</span>
              </div>
            )}
          </section>
        )}

        {activeModule === 'penhoras' && activeTab === 'configuracao' && (
          <section className="panel ds-panel penhoras-panel ds-settings-panel">
            <h2>Configuração Penhoras</h2>
            <p className="small-note">Estados e importação dedicados ao módulo Penhoras.</p>
            <div className="actions-row start">
              <button className="subtle-btn" type="button" onClick={() => setActiveTab('importar')}>
                Importar Penhoras
              </button>
            </div>
            <div className="status-list">
              {penhorasOrderedStatuses.map((status) => (
                <div key={status.id} className="status-item">
                  <span className="status-icon-preview">
                    <StatusIcon name={status.icon} size={16} />
                  </span>
                  <select className="status-icon" value={status.icon} onChange={(event) => updatePenhorasStatusLocal(status.id, { icon: event.target.value })}>
                    {STATUS_ICON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input value={status.label} onChange={(event) => updatePenhorasStatusLocal(status.id, { label: event.target.value })} />
                  <input type="color" value={toColor(status.color)} onChange={(event) => updatePenhorasStatusLocal(status.id, { color: event.target.value })} />
                  <input
                    type="number"
                    className="small-number"
                    value={status.order}
                    onChange={(event) => updatePenhorasStatusLocal(status.id, { order: Number(event.target.value) || 0 })}
                  />
                  <label className="inline-check">
                    <input type="checkbox" checked={status.active} onChange={(event) => updatePenhorasStatusLocal(status.id, { active: event.target.checked })} />
                    Ativo
                  </label>
                  <button className="danger-link" type="button" onClick={() => void removePenhorasStatus(status.id)}>Remover</button>
                </div>
              ))}
            </div>
            <div className="actions-row start">
              <button className="subtle-btn" type="button" onClick={() => void addPenhorasStatus()}>Novo estado Penhoras</button>
              <button className="subtle-btn" type="button" onClick={() => void savePenhorasStatuses()}>Guardar estados Penhoras</button>
            </div>
          </section>
        )}

        {activeModule === 'recibos' && activeTab === 'entrada' && (
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

        {activeModule === 'recibos' && (activeTab === 'consulta' || activeTab === 'tabela') && (
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

        {activeModule === 'recibos' && activeTab === 'dashboards' && (
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

        {activeModule === 'recibos' && activeTab === 'importar' && (
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

        {activeModule === 'recibos' && activeTab === 'configuracao' && (
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

        {activeModule === 'ds' && (activeTab === 'consulta' || activeTab === 'tabela') && selectedDsRecord && (
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
        )}

        {activeModule === 'penhoras' && (activeTab === 'consulta' || activeTab === 'tabela') && selectedPenhorasRecord && (
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
        )}

        {activeModule === 'recibos' && selectedRecord && (
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
