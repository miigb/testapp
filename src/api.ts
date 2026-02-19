import type {
  AnalyticsSummary,
  BootstrapResponse,
  CalculationSettings,
  ImportPreviewResponse,
  ParsedImport,
  RecordFilters,
  RecordSuggestions,
  RecordsResponse,
  ReceiptRecord,
  SavedView,
  StatusDefinition,
} from './types'

type RecordWithStatusAliases = ReceiptRecord & {
  statusId?: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
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
    estadoId: record.estadoId || record.statusId || record.status?.id || '',
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

function queryFromFilters(filters: RecordFilters): string {
  const params = new URLSearchParams()

  if (filters.q) params.set('q', filters.q)
  if (filters.tipo && filters.tipo !== 'todos') params.set('tipo', filters.tipo)
  if (filters.estadoId && filters.estadoId !== 'todos') params.set('estadoId', filters.estadoId)
  if (filters.mes && filters.mes !== 'todos') params.set('mes', String(filters.mes))
  if (filters.ano && filters.ano !== 'todos') params.set('ano', String(filters.ano))
  if (filters.exequente) params.set('exequente', filters.exequente)
  if (filters.gestor) params.set('gestor', filters.gestor)
  params.set('page', String(filters.page ?? 1))
  params.set('pageSize', String(filters.pageSize ?? 300))

  return params.toString()
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
}
