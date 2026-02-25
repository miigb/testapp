import type {
  AnalyticsSummary,
  BootstrapResponse,
  CalculationSettings,
  DsBootstrapResponse,
  PenhorasBootstrapResponse,
  DsRecord,
  DsRecordFilters,
  DsRecordsResponse,
  ImportPreviewResponse,
  LoginCredentials,
  NotificationItem,
  NotificationPreferences,
  NotificationsResponse,
  PenhorasRecord,
  PenhorasRecordFilters,
  PenhorasRecordsResponse,
  ParsedImport,
  RecordFilters,
  RecordSuggestions,
  RecordsResponse,
  ReceiptRecord,
  RegisterData,
  SavedView,
  StatusDefinition,
  TodoComment,
  TodoItem,
  TodoSubtask,
  TodosResponse,
  TrashResponse,
  User,
  UserRole,
  UserSummary,
} from './types'

type RecordWithStatusAliases = ReceiptRecord & {
  statusId?: string
}

type DsRecordWithStatusAliases = DsRecord & {
  statusId?: string
}

type PenhorasRecordWithStatusAliases = PenhorasRecord & {
  statusId?: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    let message = `Erro ${response.status}`
    try {
      const payload = (await response.json()) as { error?: string }
      if (payload.error) {
        message = payload.error
      }
    } catch {
      // no-op
    }
    throw new Error(message)
  }

  return (await response.json()) as T
}

function normalizeRecord(record: RecordWithStatusAliases): ReceiptRecord {
  return {
    ...record,
    estadoId: record.statusId || record.status?.id || record.estadoId || '',
  }
}

function normalizeRecordPayload(payload: Partial<ReceiptRecord>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...payload }
  if (typeof payload.estadoId === 'string' && payload.estadoId.trim()) {
    normalized.statusId = payload.estadoId
  }
  delete normalized.estadoId
  return normalized
}

/**
 * Generic helper — converts a flat filters record into a URLSearchParams string.
 * String values equal to 'todos' are omitted (treated as "no filter").
 * Numbers are coerced to strings. undefined values are always omitted.
 */
function buildFilterParams(
  entries: Record<string, string | number | undefined>,
  pagination: { page: number; pageSize: number },
): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === 'todos') continue
    params.set(key, String(value))
  }
  params.set('page', String(pagination.page ?? 1))
  params.set('pageSize', String(pagination.pageSize ?? 300))
  return params.toString()
}

function queryFromFilters(filters: RecordFilters): string {
  return buildFilterParams(
    {
      q: filters.q,
      tipo: filters.tipo,
      estadoId: filters.estadoId,
      mes: filters.mes as number | undefined,
      ano: filters.ano as number | undefined,
      exequente: filters.exequente,
      gestor: filters.gestor,
    },
    { page: filters.page ?? 1, pageSize: filters.pageSize ?? 300 },
  )
}

function queryFromDsFilters(filters: DsRecordFilters): string {
  return buildFilterParams(
    {
      q: filters.q,
      estadoId: filters.estadoId,
      gestora: filters.gestora,
      entidadeBancaria: filters.entidadeBancaria,
      produto: filters.produto,
      reciboEstado: filters.reciboEstado,
      mes: filters.mes as number | undefined,
      ano: filters.ano as number | undefined,
    },
    { page: filters.page ?? 1, pageSize: filters.pageSize ?? 300 },
  )
}

function queryFromPenhorasFilters(filters: PenhorasRecordFilters): string {
  return buildFilterParams(
    {
      q: filters.q,
      estadoId: filters.estadoId,
      gestor: filters.gestor,
      acto: filters.acto,
      mes: filters.mes as number | undefined,
      ano: filters.ano as number | undefined,
    },
    { page: filters.page ?? 1, pageSize: filters.pageSize ?? 300 },
  )
}

function normalizeDsRecord(record: DsRecordWithStatusAliases): DsRecord {
  return {
    ...record,
    estadoId: record.statusId || record.status?.id || record.estadoId || '',
  }
}

function normalizePenhorasRecord(record: PenhorasRecordWithStatusAliases): PenhorasRecord {
  return {
    ...record,
    estadoId: record.statusId || record.status?.id || record.estadoId || '',
  }
}

export const api = {
  bootstrap() {
    return request<BootstrapResponse>('/api/bootstrap')
  },

  getRecords(filters: RecordFilters) {
    return request<RecordsResponse>(`/api/records?${queryFromFilters(filters)}`).then((response) => ({
      ...response,
      items: response.items.map((item) => normalizeRecord(item as RecordWithStatusAliases)),
    }))
  },

  getAnalyticsSummary(filters: RecordFilters) {
    return request<AnalyticsSummary>(`/api/analytics/summary?${queryFromFilters(filters)}`)
  },

  getRecordSuggestions(limit = 140) {
    const query = new URLSearchParams({ limit: String(limit) }).toString()
    return request<RecordSuggestions>(`/api/records/suggestions?${query}`)
  },

  exportRecordsSnapshot() {
    return request<Record<string, unknown>>('/api/records/export')
  },

  getRecord(id: string) {
    return request<ReceiptRecord>(`/api/records/${id}`).then((record) => normalizeRecord(record as RecordWithStatusAliases))
  },

  createRecord(payload: Partial<ReceiptRecord> & { tipo: 'exequente' | 'executado'; mes: number; ano: number }) {
    return request<ReceiptRecord>('/api/records', {
      method: 'POST',
      body: JSON.stringify(normalizeRecordPayload(payload)),
    }).then((record) => normalizeRecord(record as RecordWithStatusAliases))
  },

  patchRecord(id: string, payload: Partial<ReceiptRecord>) {
    return request<ReceiptRecord>(`/api/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(normalizeRecordPayload(payload)),
    }).then((record) => normalizeRecord(record as RecordWithStatusAliases))
  },

  updateRecordStatus(id: string, statusId: string) {
    return request<ReceiptRecord>(`/api/records/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ statusId }),
    })
  },

  bulkStatus(recordIds: string[], statusId: string) {
    return request<{ ok: boolean; updated: number }>('/api/records/bulk/status', {
      method: 'POST',
      body: JSON.stringify({ recordIds, statusId }),
    })
  },

  bulkUpdate(
    recordIds: string[],
    patch: Partial<ReceiptRecord>,
    options?: {
      forceRecalculate?: boolean
    },
  ) {
    return request<{ ok: boolean; updated: number }>('/api/records/bulk/update', {
      method: 'POST',
      body: JSON.stringify({
        recordIds,
        patch,
        forceRecalculate: options?.forceRecalculate,
      }),
    })
  },

  getStatuses() {
    return request<StatusDefinition[]>('/api/statuses')
  },

  createStatus(payload: Omit<StatusDefinition, 'id'>) {
    return request<StatusDefinition>('/api/statuses', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateStatus(id: string, payload: Partial<Omit<StatusDefinition, 'id'>>) {
    return request<StatusDefinition>(`/api/statuses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  deleteStatus(id: string, options?: { reassignToStatusId?: string }) {
    const query = options?.reassignToStatusId ? `?reassignToStatusId=${encodeURIComponent(options.reassignToStatusId)}` : ''
    return request<{ ok: boolean; reassigned?: number }>(`/api/statuses/${id}${query}`, {
      method: 'DELETE',
    })
  },

  getCalculationSettings() {
    return request<CalculationSettings>('/api/calculation-settings')
  },

  updateCalculationSettings(payload: Partial<CalculationSettings>) {
    return request<CalculationSettings>('/api/calculation-settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  getSavedViews(scope?: string) {
    const query = scope ? `?scope=${encodeURIComponent(scope)}` : ''
    return request<SavedView[]>(`/api/saved-views${query}`)
  },

  createSavedView(payload: Pick<SavedView, 'name' | 'scope' | 'filters'>) {
    return request<SavedView>('/api/saved-views', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateSavedView(id: string, payload: Partial<Pick<SavedView, 'name' | 'scope' | 'filters'>>) {
    return request<SavedView>(`/api/saved-views/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  deleteSavedView(id: string) {
    return request<{ ok: true }>(`/api/saved-views/${id}`, {
      method: 'DELETE',
    })
  },

  previewImport(payload: { rows: ParsedImport['rows']; colorMapping?: Record<string, string> }) {
    return request<ImportPreviewResponse>('/api/import/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  commitImport(payload: {
    rows: ParsedImport['rows']
    colorMapping?: Record<string, string>
    strategy: 'skip' | 'update' | 'duplicate'
    forceRecalculate?: boolean
  }) {
    return request<{ ok: true; summary: Record<string, unknown> }>('/api/import/commit', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  seedDatabase(replace = false) {
    return request<{ ok: true; created: number; updated: number; invalid: number }>('/api/seed', {
      method: 'POST',
      body: JSON.stringify({ replace }),
    })
  },

  migrateLocalStorage(payload: {
    records?: unknown[]
    statuses?: unknown[]
    clearOnly?: boolean
  }) {
    return request<{ ok: true; migrated: number; skipped?: number }>('/api/migrate/local-storage', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  dsBootstrap() {
    return request<DsBootstrapResponse>('/api/ds/bootstrap')
  },

  getDsRecords(filters: DsRecordFilters) {
    return request<DsRecordsResponse>(`/api/ds/records?${queryFromDsFilters(filters)}`).then((response) => ({
      ...response,
      items: response.items.map((item) => normalizeDsRecord(item as DsRecordWithStatusAliases)),
    }))
  },

  getDsRecord(id: string) {
    return request<DsRecord>(`/api/ds/records/${id}`).then((record) => normalizeDsRecord(record as DsRecordWithStatusAliases))
  },

  createDsRecord(payload: Partial<DsRecord>) {
    return request<DsRecord>('/api/ds/records', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((record) => normalizeDsRecord(record as DsRecordWithStatusAliases))
  },

  patchDsRecord(id: string, payload: Partial<DsRecord>) {
    return request<DsRecord>(`/api/ds/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then((record) => normalizeDsRecord(record as DsRecordWithStatusAliases))
  },

  updateDsRecordStatus(id: string, statusId: string) {
    return request<DsRecord>(`/api/ds/records/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ statusId }),
    }).then((record) => normalizeDsRecord(record as DsRecordWithStatusAliases))
  },

  getDsStatuses() {
    return request<StatusDefinition[]>('/api/ds/statuses')
  },

  createDsStatus(payload: Omit<StatusDefinition, 'id'>) {
    return request<StatusDefinition>('/api/ds/statuses', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateDsStatus(id: string, payload: Partial<Omit<StatusDefinition, 'id'>>) {
    return request<StatusDefinition>(`/api/ds/statuses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  deleteDsStatus(id: string, options?: { reassignToStatusId?: string }) {
    const query = options?.reassignToStatusId ? `?reassignToStatusId=${encodeURIComponent(options.reassignToStatusId)}` : ''
    return request<{ ok: boolean; reassigned?: number }>(`/api/ds/statuses/${id}${query}`, {
      method: 'DELETE',
    })
  },

  previewDsImport(payload: { rows: Array<Record<string, unknown>> }) {
    return request<ImportPreviewResponse>('/api/ds/import/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  commitDsImport(payload: { rows: Array<Record<string, unknown>>; strategy: 'skip' | 'update' | 'duplicate' }) {
    return request<{ ok: true; summary: Record<string, unknown> }>('/api/ds/import/commit', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  penhorasBootstrap() {
    return request<PenhorasBootstrapResponse>('/api/penhoras/bootstrap')
  },

  getPenhorasRecords(filters: PenhorasRecordFilters) {
    return request<PenhorasRecordsResponse>(`/api/penhoras/records?${queryFromPenhorasFilters(filters)}`).then((response) => ({
      ...response,
      items: response.items.map((item) => normalizePenhorasRecord(item as PenhorasRecordWithStatusAliases)),
    }))
  },

  getPenhorasRecord(id: string) {
    return request<PenhorasRecord>(`/api/penhoras/records/${id}`).then((record) => normalizePenhorasRecord(record as PenhorasRecordWithStatusAliases))
  },

  createPenhorasRecord(payload: Partial<PenhorasRecord>) {
    return request<PenhorasRecord>('/api/penhoras/records', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((record) => normalizePenhorasRecord(record as PenhorasRecordWithStatusAliases))
  },

  patchPenhorasRecord(id: string, payload: Partial<PenhorasRecord>) {
    return request<PenhorasRecord>(`/api/penhoras/records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then((record) => normalizePenhorasRecord(record as PenhorasRecordWithStatusAliases))
  },

  updatePenhorasRecordStatus(id: string, statusId: string) {
    return request<PenhorasRecord>(`/api/penhoras/records/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ statusId }),
    }).then((record) => normalizePenhorasRecord(record as PenhorasRecordWithStatusAliases))
  },

  getPenhorasStatuses() {
    return request<StatusDefinition[]>('/api/penhoras/statuses')
  },

  createPenhorasStatus(payload: Omit<StatusDefinition, 'id'>) {
    return request<StatusDefinition>('/api/penhoras/statuses', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updatePenhorasStatus(id: string, payload: Partial<Omit<StatusDefinition, 'id'>>) {
    return request<StatusDefinition>(`/api/penhoras/statuses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  deletePenhorasStatus(id: string, options?: { reassignToStatusId?: string }) {
    const query = options?.reassignToStatusId ? `?reassignToStatusId=${encodeURIComponent(options.reassignToStatusId)}` : ''
    return request<{ ok: boolean; reassigned?: number }>(`/api/penhoras/statuses/${id}${query}`, {
      method: 'DELETE',
    })
  },

  previewPenhorasImport(payload: { rows: Array<Record<string, unknown>> }) {
    return request<ImportPreviewResponse>('/api/penhoras/import/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  commitPenhorasImport(payload: { rows: Array<Record<string, unknown>>; strategy: 'skip' | 'update' | 'duplicate' }) {
    return request<{ ok: true; summary: Record<string, unknown> }>('/api/penhoras/import/commit', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  // Auth
  login(credentials: LoginCredentials) {
    return request<User>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  },

  logout() {
    return request<{ ok: true }>('/api/auth/logout', {
      method: 'POST',
    })
  },

  getMe() {
    return request<User>('/api/auth/me')
  },

  register(data: RegisterData) {
    return request<User>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getUsers() {
    return request<User[]>('/api/auth/users')
  },

  updateUser(id: number, data: Partial<{ displayName: string; email: string | null; role: UserRole; active: boolean; avatarColor: string; allowedModules: string[] }>) {
    return request<User>(`/api/auth/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  deactivateUser(id: number) {
    return request<{ ok: true }>(`/api/auth/users/${id}`, {
      method: 'DELETE',
    })
  },

  // Trash — Recibos
  deleteRecord(id: string) {
    return request<{ success: true }>(`/api/records/${id}`, { method: 'DELETE' })
  },
  restoreRecord(id: string) {
    return request<ReceiptRecord>(`/api/records/${id}/restore`, { method: 'POST' })
  },
  permanentDeleteRecord(id: string) {
    return request<{ success: true }>(`/api/records/${id}/permanent`, { method: 'DELETE' })
  },
  getRecordsTrash(page = 1, pageSize = 100) {
    return request<TrashResponse<ReceiptRecord>>(`/api/records/trash?page=${page}&pageSize=${pageSize}`)
  },

  // Trash — DS
  deleteDsRecord(id: string) {
    return request<{ success: true }>(`/api/ds/records/${id}`, { method: 'DELETE' })
  },
  restoreDsRecord(id: string) {
    return request<DsRecord>(`/api/ds/records/${id}/restore`, { method: 'POST' })
  },
  permanentDeleteDsRecord(id: string) {
    return request<{ success: true }>(`/api/ds/records/${id}/permanent`, { method: 'DELETE' })
  },
  getDsRecordsTrash(page = 1, pageSize = 100) {
    return request<TrashResponse<DsRecord>>(`/api/ds/records/trash?page=${page}&pageSize=${pageSize}`)
  },

  // Trash — Penhoras
  deletePenhorasRecord(id: string) {
    return request<{ success: true }>(`/api/penhoras/records/${id}`, { method: 'DELETE' })
  },
  restorePenhorasRecord(id: string) {
    return request<PenhorasRecord>(`/api/penhoras/records/${id}/restore`, { method: 'POST' })
  },
  permanentDeletePenhorasRecord(id: string) {
    return request<{ success: true }>(`/api/penhoras/records/${id}/permanent`, { method: 'DELETE' })
  },
  getPenhorasRecordsTrash(page = 1, pageSize = 100) {
    return request<TrashResponse<PenhorasRecord>>(`/api/penhoras/records/trash?page=${page}&pageSize=${pageSize}`)
  },

  // ── Todos ─────────────────────────────────────────────────────────────

  getTodos(params?: { status?: string; priority?: string; assigneeId?: number; deleted?: boolean }) {
    const search = new URLSearchParams()
    if (params?.status && params.status !== 'all') search.set('status', params.status)
    if (params?.priority && params.priority !== 'all') search.set('priority', params.priority)
    if (params?.assigneeId && params.assigneeId !== -1) search.set('assigneeId', String(params.assigneeId))
    if (params?.deleted) search.set('deleted', 'true')
    const qs = search.toString()
    return request<TodosResponse>(`/api/todos${qs ? `?${qs}` : ''}`)
  },

  createTodo(payload: {
    title: string
    description?: string
    priority?: string
    dueDate?: string
    assigneeId?: number
    linkedModule?: string
    linkedRecordId?: string
  }) {
    return request<TodoItem>('/api/todos', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateTodo(id: number, payload: Partial<{
    title: string
    description: string | null
    priority: string
    status: string
    dueDate: string | null
    assigneeId: number | null
  }>) {
    return request<TodoItem>(`/api/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  deleteTodo(id: number) {
    return request<{ success: true }>(`/api/todos/${id}`, { method: 'DELETE' })
  },

  restoreTodo(id: number) {
    return request<TodoItem>(`/api/todos/${id}/restore`, { method: 'POST' })
  },

  permanentDeleteTodo(id: number) {
    return request<{ success: true }>(`/api/todos/${id}/permanent`, { method: 'DELETE' })
  },

  // Empty trash endpoints
  emptyRecibosTrash() {
    return request<{ success: true; deleted: number }>('/api/records/trash/empty', { method: 'POST' })
  },
  emptyDsTrash() {
    return request<{ success: true; deleted: number }>('/api/ds/records/trash/empty', { method: 'POST' })
  },
  emptyPenhorasTrash() {
    return request<{ success: true; deleted: number }>('/api/penhoras/records/trash/empty', { method: 'POST' })
  },
  emptyTodosTrash() {
    return request<{ success: true; deleted: number }>('/api/todos/trash/empty', { method: 'POST' })
  },

  // Subtasks
  addSubtask(todoId: number, title: string) {
    return request<TodoSubtask>(`/api/todos/${todoId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    })
  },

  updateSubtask(todoId: number, subtaskId: number, payload: Partial<{ title: string; completed: boolean }>) {
    return request<TodoSubtask>(`/api/todos/${todoId}/subtasks/${subtaskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  deleteSubtask(todoId: number, subtaskId: number) {
    return request<{ success: true }>(`/api/todos/${todoId}/subtasks/${subtaskId}`, { method: 'DELETE' })
  },

  // Comments
  getTodoComments(todoId: number) {
    return request<TodoComment[]>(`/api/todos/${todoId}/comments`)
  },

  addTodoComment(todoId: number, content: string) {
    return request<TodoComment>(`/api/todos/${todoId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  },

  // ── Notifications ─────────────────────────────────────────────────────

  getNotifications(params?: { page?: number; pageSize?: number; read?: boolean }) {
    const search = new URLSearchParams()
    if (params?.page !== undefined) search.set('page', String(params.page))
    if (params?.pageSize) search.set('pageSize', String(params.pageSize))
    if (params?.read !== undefined) search.set('read', String(params.read))
    const qs = search.toString()
    return request<NotificationsResponse>(`/api/notifications${qs ? `?${qs}` : ''}`)
  },

  getUnreadCount() {
    return request<{ count: number }>('/api/notifications/unread-count')
  },

  markNotificationRead(id: number) {
    return request<NotificationItem>(`/api/notifications/${id}/read`, { method: 'PATCH' })
  },

  markAllNotificationsRead() {
    return request<{ success: true }>('/api/notifications/read-all', { method: 'POST' })
  },

  getNotificationPreferences() {
    return request<NotificationPreferences>('/api/notifications/preferences')
  },

  updateNotificationPreferences(payload: Partial<NotificationPreferences>) {
    return request<NotificationPreferences>('/api/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },

  // ── Users (summary) ──────────────────────────────────────────────────

  getUsersSummary() {
    return request<UserSummary[]>('/api/auth/users/summary')
  },
}
