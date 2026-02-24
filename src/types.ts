export type TabId = 'entrada' | 'consulta' | 'tabela' | 'dashboards' | 'importar' | 'configuracao'
export type ModuleId = 'recibos' | 'ds' | 'penhoras'
export type SavedViewScope = 'tabela' | 'ds-tabela' | 'ds-dashboard' | 'penhoras-tabela' | 'penhoras-dashboard'

export type RecordType = 'exequente' | 'executado'

export type HistoryEvent = {
  id: string
  at: string
  message: string
}

export type StatusDefinition = {
  id: string
  key: string
  label: string
  icon: string
  color: string
  active: boolean
  order: number
}

export type TaxTargetField = 'iva' | 'retencao' | 'meu5' | 'outrasTaxas'
export type TaxBaseField = 'valorIndicado' | 'valorSemIva' | 'valorEmissao'

export type TaxRule = {
  id: string
  code: string
  label: string
  rate: number
  enabled: boolean
  targetField: TaxTargetField
  baseField: TaxBaseField
  order: number
}

export type CalculationSettings = {
  id: string
  autoApplyRules: boolean
  autoComputeValorSemIva: boolean
  autoComputeValorEmissao: boolean
  roundTo: number
  taxRules: TaxRule[]
}

export type ReceiptRecord = {
  id: string
  tipo: RecordType
  mes: number
  ano: number
  processo?: string
  pe?: string
  reciboNumero?: string
  dataLevantamento?: string
  dataRecibo?: string
  valorIndicado?: number
  valorSemIva?: number
  iva?: number
  retencao?: number
  valorEmissao?: number
  meu5?: number
  outrasTaxas?: number
  gestor?: string
  exequente?: string
  descricaoValor?: string
  estadoId: string
  indicacoes?: string
  sourceColor?: string
  sourceSheet?: string
  deletedAt?: string | null
  deletedBy?: { id: number; username: string; displayName: string } | null
  createdAt: string
  updatedAt: string
  history: HistoryEvent[]
  status?: StatusDefinition
}

export type EntryForm = {
  tipo: RecordType
  mes: number
  ano: number
  processo: string
  pe: string
  reciboNumero: string
  dataLevantamento: string
  dataRecibo: string
  valorIndicado: string
  valorSemIva: string
  iva: string
  retencao: string
  valorEmissao: string
  meu5: string
  outrasTaxas: string
  gpeSe: string
  gestor: string
  exequente: string
  descricaoValor: string
  estadoId: string
  indicacoes: string
}

export type SavedView = {
  id: string
  name: string
  scope: string
  filters: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type BootstrapResponse = {
  statuses: StatusDefinition[]
  calculationSettings: CalculationSettings
  savedViews: SavedView[]
  recordCount: number
}

export type RecordsResponse = {
  items: ReceiptRecord[]
  total: number
  page: number
  pageSize: number
}

export type RecordFilters = {
  q?: string
  tipo?: RecordType | 'todos'
  estadoId?: string | 'todos'
  mes?: number | 'todos'
  ano?: number | 'todos'
  exequente?: string
  gestor?: string
  page?: number
  pageSize?: number
}

export type ParsedImport = {
  fileName: string
  parsedAt: string
  rows: Partial<ReceiptRecord>[]
  colorCount: Record<string, number>
}

export type DsParsedImport = {
  fileName: string
  parsedAt: string
  rows: Array<Record<string, unknown>>
  colorCount: Record<string, number>
}

export type PenhorasParsedImport = {
  fileName: string
  parsedAt: string
  rows: Array<Record<string, unknown>>
  colorCount: Record<string, number>
}

export type ImportPreviewItem = {
  index: number
  valid: boolean
  key?: string
  statusId?: string
  conflict?: boolean
  existingId?: string
  suggestedAction?: 'create' | 'update'
  action?: string
  reason?: string
}

export type ImportPreviewResponse = {
  summary: {
    total: number
    valid: number
    conflicts: number
    creates: number
    invalid: number
  }
  items: ImportPreviewItem[]
}

export type DsRecord = {
  id: string
  gestora?: string
  proponentes?: string
  referencia?: string
  produto?: string
  entidadeBancaria?: string
  liderCalculo?: string
  recibo?: string
  faltaReciboGestora?: string
  valorRaw?: string
  valor?: number
  dataEscritura?: string
  dataFechoCrm?: string
  comissaoLojaRaw?: string
  comissaoLoja?: number
  ivaCgdRaw?: string
  ivaCgdValor?: number
  ivaCgdKind?: 'sem_iva' | 'total_levantado' | 'valor' | 'outro'
  totalComissaoLojaCmIvaRaw?: string
  totalComissaoLojaCmIva?: number
  comissaoGestorRaw?: string
  comissaoGestor?: number
  percentagemRaw?: string
  percentagem?: number
  pagComissaoGestor?: string
  sourceFile?: string
  sourceSheet?: string
  sourceRowNumber?: number
  importBatchId?: string
  rawPayload?: Record<string, unknown>
  estadoId: string
  status?: StatusDefinition
  deletedAt?: string | null
  deletedBy?: { id: number; username: string; displayName: string } | null
  createdAt: string
  updatedAt: string
}

export type DsEntryForm = {
  gestora: string
  proponentes: string
  referencia: string
  produto: string
  entidadeBancaria: string
  liderCalculo: string
  recibo: string
  faltaReciboGestora: string
  valor: string
  dataEscritura: string
  dataFechoCrm: string
  comissaoLoja: string
  ivaCgdRaw: string
  totalComissaoLojaCmIva: string
  comissaoGestor: string
  percentagem: string
  pagComissaoGestor: string
  estadoId: string
}

export type DsBootstrapResponse = {
  statuses: StatusDefinition[]
  savedViews: SavedView[]
  recordCount: number
}

export type DsRecordsResponse = {
  items: DsRecord[]
  total: number
  page: number
  pageSize: number
}

export type DsRecordFilters = {
  q?: string
  estadoId?: string | 'todos'
  gestora?: string
  entidadeBancaria?: string
  produto?: string
  reciboEstado?: 'todos' | 'com-recibo' | 'sem-recibo'
  ano?: number | 'todos'
  mes?: number | 'todos'
  page?: number
  pageSize?: number
}

export type PenhorasRecord = {
  id: string
  pe?: string
  acto?: string
  dataPedido?: string
  identificacao?: string
  pedido?: string
  gestor?: string
  sourceFile?: string
  sourceSheet?: string
  sourceRowNumber?: number
  importBatchId?: string
  rawPayload?: Record<string, unknown>
  estadoId: string
  status?: StatusDefinition
  deletedAt?: string | null
  deletedBy?: { id: number; username: string; displayName: string } | null
  createdAt: string
  updatedAt: string
}

export type PenhorasEntryForm = {
  pe: string
  acto: string
  dataPedido: string
  identificacao: string
  pedido: string
  gestor: string
  estadoId: string
}

export type PenhorasBootstrapResponse = {
  statuses: StatusDefinition[]
  savedViews: SavedView[]
  recordCount: number
}

export type PenhorasRecordsResponse = {
  items: PenhorasRecord[]
  total: number
  page: number
  pageSize: number
}

export type PenhorasRecordFilters = {
  q?: string
  estadoId?: string | 'todos'
  gestor?: string
  acto?: string
  ano?: number | 'todos'
  mes?: number | 'todos'
  page?: number
  pageSize?: number
}

export type RecordSuggestions = {
  processo: string[]
  pe: string[]
  reciboNumero: string[]
  gestor: string[]
  exequente: string[]
}

// Auth types
export type UserRole = 'ADMIN' | 'USER'

export type User = {
  id: number
  username: string
  displayName: string
  email: string | null
  role: UserRole
  avatarColor: string | null
  active: boolean
  createdAt: string
}

export type LoginCredentials = {
  username: string
  password: string
}

export type RegisterData = {
  username: string
  displayName: string
  email?: string
  password: string
}

export type AnalyticsTotals = {
  registos: number
  valorIndicado: number
  valorSemIva: number
  iva: number
  retencao: number
  meu5: number
  valorEmissao: number
  outrasTaxas: number
  levantadoComIva: number
}

export type AnalyticsStatusBucket = {
  statusId: string
  statusKey: string
  statusLabel: string
  statusColor: string
  statusIcon: string
  count: number
  valorSemIva: number
  iva: number
  valorEmissao: number
}

export type AnalyticsTypeBucket = {
  tipo: RecordType
  count: number
  valorSemIva: number
  iva: number
  valorEmissao: number
}

export type AnalyticsMonthBucket = {
  ano: number
  mes: number
  count: number
  valorSemIva: number
  iva: number
  valorEmissao: number
}

export type AnalyticsEntityBucket = {
  name: string
  count: number
  valorSemIva: number
  valorEmissao: number
}

export type AnalyticsSummary = {
  totals: AnalyticsTotals
  byStatus: AnalyticsStatusBucket[]
  byType: AnalyticsTypeBucket[]
  byMonth: AnalyticsMonthBucket[]
  topGestores: AnalyticsEntityBucket[]
  topExequentes: AnalyticsEntityBucket[]
}

export type TrashResponse<T> = {
  items: (T & { deletedAt: string | null; deletedBy: { id: number; username: string; displayName: string } | null })[]
  total: number
  page: number
  pageSize: number
}

// ── Todos & Notifications ─────────────────────────────────────────────

export type UserSummary = Pick<User, 'id' | 'username' | 'displayName' | 'avatarColor'>

export interface TodoItem {
  id: number
  title: string
  description: string | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE'
  dueDate: string | null
  createdById: number
  createdBy: UserSummary
  assigneeId: number | null
  assignee: UserSummary | null
  linkedModule: string | null
  linkedRecordId: string | null
  subtasks: TodoSubtask[]
  _count?: { comments: number }
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface TodoSubtask {
  id: number
  title: string
  completed: boolean
  order: number
}

export interface TodoComment {
  id: number
  content: string
  author: UserSummary
  createdAt: string
}

export interface NotificationItem {
  id: number
  type: string
  title: string
  message: string
  read: boolean
  linkedModule: string | null
  linkedRecordId: string | null
  linkedTodoId: number | null
  createdAt: string
}

export interface NotificationPreferences {
  taskAssigned: boolean
  taskCompleted: boolean
  taskCommented: boolean
  taskDueSoon: boolean
  recordStatusChange: boolean
  mention: boolean
}

export type TodoFilters = {
  status?: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'all'
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'all'
  assigneeId?: number | 'all'
  scope?: 'mine' | 'all'
}

export type TodosResponse = {
  items: TodoItem[]
  total: number
}

export type NotificationsResponse = {
  items: NotificationItem[]
  total: number
  page: number
  pageSize: number
}
