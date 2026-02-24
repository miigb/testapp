import { useState, useCallback, useEffect } from 'react'
import { api } from '../api'

export interface TrashEntry {
  id: string
  module: 'recibos' | 'ds' | 'penhoras' | 'tarefas'
  label: string
  deletedAt: string
  deletedBy?: { displayName: string }
}

export function useTrash(userId: number | undefined) {
  const [items, setItems] = useState<TrashEntry[]>([])
  const [loading, setLoading] = useState(false)

  const refreshTrash = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [recibosResult, dsResult, penhorasResult, todosResult] = await Promise.allSettled([
        api.getRecordsTrash(1, 200),
        api.getDsRecordsTrash(1, 200),
        api.getPenhorasRecordsTrash(1, 200),
        api.getTodos({ deleted: true }),
      ])

      const entries: TrashEntry[] = []

      if (recibosResult.status === 'fulfilled') {
        for (const item of recibosResult.value.items) {
          const deletedByObj = item.deletedBy as { displayName: string } | null | undefined
          entries.push({
            id: item.id,
            module: 'recibos',
            label: item.processo || item.pe || item.reciboNumero || `Recibo #${item.id.slice(0, 6)}`,
            deletedAt: item.deletedAt || item.updatedAt,
            deletedBy: deletedByObj ?? undefined,
          })
        }
      }

      if (dsResult.status === 'fulfilled') {
        for (const item of dsResult.value.items) {
          const deletedByObj = item.deletedBy as { displayName: string } | null | undefined
          entries.push({
            id: item.id,
            module: 'ds',
            label: item.referencia || item.proponentes || `DS #${item.id.slice(0, 6)}`,
            deletedAt: item.deletedAt || item.updatedAt,
            deletedBy: deletedByObj ?? undefined,
          })
        }
      }

      if (penhorasResult.status === 'fulfilled') {
        for (const item of penhorasResult.value.items) {
          const deletedByObj = item.deletedBy as { displayName: string } | null | undefined
          entries.push({
            id: item.id,
            module: 'penhoras',
            label: item.pe || item.identificacao || `Penhora #${item.id.slice(0, 6)}`,
            deletedAt: item.deletedAt || item.updatedAt,
            deletedBy: deletedByObj ?? undefined,
          })
        }
      }

      if (todosResult.status === 'fulfilled') {
        for (const item of todosResult.value.items) {
          const deletedByObj = item.deletedBy
          entries.push({
            id: String(item.id),
            module: 'tarefas',
            label: item.title,
            deletedAt: item.deletedAt || item.updatedAt,
            deletedBy: deletedByObj ?? undefined,
          })
        }
      }

      // Sort by most recently deleted first
      entries.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
      setItems(entries)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refreshTrash()
  }, [refreshTrash])

  const restore = useCallback(async (module: string, id: string) => {
    switch (module) {
      case 'recibos':
        await api.restoreRecord(id)
        break
      case 'ds':
        await api.restoreDsRecord(id)
        break
      case 'penhoras':
        await api.restorePenhorasRecord(id)
        break
      case 'tarefas':
        await api.restoreTodo(Number(id))
        break
    }
    setItems((prev) => prev.filter((item) => !(item.id === id && item.module === module)))
  }, [])

  const permanentDelete = useCallback(async (module: string, id: string) => {
    switch (module) {
      case 'recibos':
        await api.permanentDeleteRecord(id)
        break
      case 'ds':
        await api.permanentDeleteDsRecord(id)
        break
      case 'penhoras':
        await api.permanentDeletePenhorasRecord(id)
        break
      case 'tarefas':
        await api.permanentDeleteTodo(Number(id))
        break
    }
    setItems((prev) => prev.filter((item) => !(item.id === id && item.module === module)))
  }, [])

  const emptyTrash = useCallback(async (module?: 'recibos' | 'ds' | 'penhoras' | 'tarefas') => {
    if (module) {
      switch (module) {
        case 'recibos':
          await api.emptyRecibosTrash()
          break
        case 'ds':
          await api.emptyDsTrash()
          break
        case 'penhoras':
          await api.emptyPenhorasTrash()
          break
        case 'tarefas':
          await api.emptyTodosTrash()
          break
      }
      setItems((prev) => prev.filter((item) => item.module !== module))
    } else {
      await Promise.allSettled([
        api.emptyRecibosTrash(),
        api.emptyDsTrash(),
        api.emptyPenhorasTrash(),
        api.emptyTodosTrash(),
      ])
      setItems([])
    }
  }, [])

  return {
    items,
    loading,
    totalCount: items.length,
    restore,
    permanentDelete,
    emptyTrash,
    refreshTrash,
  }
}
