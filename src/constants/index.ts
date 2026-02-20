import type { LucideIcon } from 'lucide-react'
import {
    AlertTriangle,
    Ban,
    CheckCircle2,
    Circle,
    Clock3,
    FileClock,
    FileSearch,
    Hammer,
    OctagonAlert,
    ReceiptText,
    SearchCheck,
    ShieldAlert,
} from 'lucide-react'
import type { CalculationSettings, DsRecordFilters, PenhorasRecordFilters, RecordFilters, RecordSuggestions, TabId } from '../types'
import type { ThemeId } from '../lib/localStorage'

export const TABS: { id: TabId; label: string }[] = [
    { id: 'entrada', label: 'Entrada' },
    { id: 'consulta', label: 'Consulta' },
    { id: 'tabela', label: 'Tabela' },
    { id: 'dashboards', label: 'Dashboards' },
    { id: 'configuracao', label: 'Configuração' },
]

export const DEFAULT_TABLE_FILTERS: RecordFilters = {
    tipo: 'todos',
    estadoId: 'todos',
    mes: 'todos',
    ano: 'todos',
    page: 1,
    pageSize: 300,
}

export const DEFAULT_DASHBOARD_FILTERS: RecordFilters = {
    tipo: 'todos',
    estadoId: 'todos',
    mes: 'todos',
    ano: 'todos',
    exequente: '',
    gestor: '',
    page: 1,
    pageSize: 300,
}

export const DEFAULT_DS_FILTERS: DsRecordFilters = {
    estadoId: 'todos',
    reciboEstado: 'todos',
    ano: 'todos',
    mes: 'todos',
    page: 1,
    pageSize: 300,
}

export const DEFAULT_PENHORAS_FILTERS: PenhorasRecordFilters = {
    estadoId: 'todos',
    ano: 'todos',
    mes: 'todos',
    page: 1,
    pageSize: 300,
}

export type LayoutMode = 'narrow' | 'wide'
export type QuickToolId = 'notes' | 'calculator' | 'smart-notes'
export type TotalMetricKey =
    | 'registos'
    | 'valorIndicado'
    | 'valorSemIva'
    | 'iva'
    | 'retencao'
    | 'meu5'
    | 'valorEmissao'
    | 'outrasTaxas'
    | 'levantadoComIva'

export const THEME_OPTIONS: Array<{ id: ThemeId; label: string }> = [
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

export const TOTAL_METRIC_OPTIONS: Array<{ key: TotalMetricKey; label: string; currency?: boolean }> = [
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

export type CalculatorKey = {
    label: string
    value?: string
    action?: 'clear' | 'backspace' | 'equals'
    tone?: 'default' | 'muted' | 'accent'
    wide?: boolean
}

export const CALCULATOR_KEYS: CalculatorKey[] = [
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

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export const EMPTY_CALC_SETTINGS: CalculationSettings = {
    id: 'default',
    autoApplyRules: true,
    autoComputeValorSemIva: true,
    autoComputeValorEmissao: false,
    roundTo: 2,
    taxRules: [],
}

export const EMPTY_RECORD_SUGGESTIONS: RecordSuggestions = {
    processo: [],
    pe: [],
    reciboNumero: [],
    gestor: [],
    exequente: [],
}

export const STATUS_ICON_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
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
