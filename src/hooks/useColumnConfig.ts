import { useState, useEffect, useCallback, useRef } from 'react'
import type { ColumnConfig } from '../types/columnConfig'

// ── Internal fetch helper (mirrors src/api.ts request pattern) ──────

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

// ── Cache + invalidation ─────────────────────────────────────────────

const columnsCache = new Map<string, ColumnConfig[]>()
const COLUMN_INVALIDATE_EVENT = 'column-config:invalidate'

function cacheKey(module: string, view: string): string {
  return `${module}::${view}`
}

/** Clear cached column config and notify all active useColumnConfig hooks. */
export function invalidateColumnCache(module?: string, view?: string): void {
  if (module && view) {
    columnsCache.delete(cacheKey(module, view))
  } else {
    columnsCache.clear()
  }
  window.dispatchEvent(
    new CustomEvent(COLUMN_INVALIDATE_EVENT, { detail: { module, view } }),
  )
}

// ── useColumnConfig ──────────────────────────────────────────────────

export interface UseColumnConfigResult {
  columns: ColumnConfig[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useColumnConfig(module: string, view: string): UseColumnConfigResult {
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    return columnsCache.get(cacheKey(module, view)) ?? []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const fetchColumns = useCallback(async () => {
    const key = cacheKey(module, view)
    cancelledRef.current = false
    setIsLoading(true)
    setError(null)

    try {
      const data = await request<ColumnConfig[]>(`/api/columns/${encodeURIComponent(module)}/${encodeURIComponent(view)}`)
      if (!cancelledRef.current) {
        columnsCache.set(key, data)
        setColumns(data)
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar colunas.')
      }
    } finally {
      if (!cancelledRef.current) {
        setIsLoading(false)
      }
    }
  }, [module, view])

  useEffect(() => {
    fetchColumns()
    return () => {
      cancelledRef.current = true
    }
  }, [fetchColumns])

  // Re-fetch when admin invalidates the cache
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ module?: string; view?: string }>).detail
      if (!detail.module || !detail.view || (detail.module === module && detail.view === view)) {
        fetchColumns()
      }
    }
    window.addEventListener(COLUMN_INVALIDATE_EVENT, handler)
    return () => window.removeEventListener(COLUMN_INVALIDATE_EVENT, handler)
  }, [module, view, fetchColumns])

  const refetch = useCallback(() => {
    fetchColumns()
  }, [fetchColumns])

  return { columns, isLoading, error, refetch }
}

// ── useAdminColumnConfig ─────────────────────────────────────────────

export interface UseAdminColumnConfigResult {
  columns: ColumnConfig[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  updateColumn: (id: string, patch: { label?: string; visible?: boolean; position?: number }) => Promise<void>
  reorderColumns: (items: { id: string; position: number }[]) => Promise<void>
  toggleVisibility: (id: string, currentlyVisible: boolean) => Promise<void>
  renameColumn: (id: string, label: string) => Promise<void>
  createCustomColumn: (data: {
    key: string
    label: string
    type: string
    isReference?: boolean
    referenceConfig?: { matchField: string }
  }) => Promise<void>
}

export function useAdminColumnConfig(module: string, view: string): UseAdminColumnConfigResult {
  const [columns, setColumns] = useState<ColumnConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const fetchColumns = useCallback(async () => {
    cancelledRef.current = false
    setIsLoading(true)
    setError(null)

    try {
      const data = await request<ColumnConfig[]>(
        `/api/admin/columns/${encodeURIComponent(module)}/${encodeURIComponent(view)}`,
      )
      if (!cancelledRef.current) {
        setColumns(data)
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar colunas (admin).')
      }
    } finally {
      if (!cancelledRef.current) {
        setIsLoading(false)
      }
    }
  }, [module, view])

  useEffect(() => {
    fetchColumns()
    return () => {
      cancelledRef.current = true
    }
  }, [fetchColumns])

  const refetch = useCallback(() => {
    fetchColumns()
  }, [fetchColumns])

  const updateColumn = useCallback(
    async (id: string, patch: { label?: string; visible?: boolean; position?: number }) => {
      await request<ColumnConfig>(
        `/api/admin/columns/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(patch),
        },
      )
      await fetchColumns()
      invalidateColumnCache(module, view)
    },
    [module, view, fetchColumns],
  )

  const reorderColumns = useCallback(
    async (items: { id: string; position: number }[]) => {
      await request<{ ok: boolean }>(
        `/api/admin/columns/reorder`,
        {
          method: 'PATCH',
          body: JSON.stringify({ columns: items }),
        },
      )
      await fetchColumns()
      invalidateColumnCache(module, view)
    },
    [module, view, fetchColumns],
  )

  const toggleVisibility = useCallback(
    async (id: string, currentlyVisible: boolean) => {
      await request<ColumnConfig>(
        `/api/admin/columns/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ visible: !currentlyVisible }),
        },
      )
      await fetchColumns()
      invalidateColumnCache(module, view)
    },
    [module, view, fetchColumns],
  )

  const renameColumn = useCallback(
    async (id: string, label: string) => {
      await request<ColumnConfig>(
        `/api/admin/columns/${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ label }),
        },
      )
      await fetchColumns()
      invalidateColumnCache(module, view)
    },
    [module, view, fetchColumns],
  )

  const createCustomColumn = useCallback(
    async (data: {
      key: string
      label: string
      type: string
      isReference?: boolean
      referenceConfig?: { matchField: string }
    }) => {
      await request<ColumnConfig>(
        `/api/admin/columns/${encodeURIComponent(module)}/${encodeURIComponent(view)}`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      )
      await fetchColumns()
      invalidateColumnCache(module, view)
    },
    [module, view, fetchColumns],
  )

  return {
    columns,
    isLoading,
    error,
    refetch,
    updateColumn,
    reorderColumns,
    toggleVisibility,
    renameColumn,
    createCustomColumn,
  }
}

// ── useColumnTransition ──────────────────────────────────────────────

/**
 * Returns `true` for a brief period when the visible column set changes,
 * allowing the table wrapper to play a subtle refresh animation.
 * Uses during-render state adjustment (React 19 pattern) to avoid
 * synchronous setState inside useEffect.
 */
export function useColumnTransition(columns: ColumnConfig[]): boolean {
  const [animating, setAnimating] = useState(false)
  const [prevFingerprint, setPrevFingerprint] = useState('')

  const fp = columns
    .filter((c) => c.visible)
    .map((c) => `${c.id}:${c.position}:${c.label}`)
    .join('|')

  // During-render adjustment: detect fingerprint change synchronously
  if (fp !== prevFingerprint) {
    const hadPrev = prevFingerprint !== ''
    setPrevFingerprint(fp)
    if (hadPrev) {
      setAnimating(true)
    }
  }

  // Clear the animation flag after a short delay
  useEffect(() => {
    if (!animating) return
    const timer = setTimeout(() => setAnimating(false), 350)
    return () => clearTimeout(timer)
  }, [animating])

  return animating
}
