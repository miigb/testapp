import { useState, useCallback, useEffect } from 'react'
import { api } from '../api'
import type { TodoItem, TodoComment, TodoFilters, UserSummary } from '../types'

const DEFAULT_FILTERS: TodoFilters = {
  status: 'all',
  priority: 'all',
  assigneeId: 'all',
  scope: 'all',
}

export function useTodos(currentUserId: number | undefined) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<TodoFilters>(DEFAULT_FILTERS)
  const [users, setUsers] = useState<UserSummary[]>([])

  const refreshTodos = useCallback(async () => {
    if (!currentUserId) return
    setLoading(true)
    try {
      const params: { status?: string; priority?: string; assigneeId?: number } = {}
      if (filters.status && filters.status !== 'all') params.status = filters.status
      if (filters.priority && filters.priority !== 'all') params.priority = filters.priority
      if (filters.scope === 'mine') {
        params.assigneeId = currentUserId
      } else if (filters.assigneeId && filters.assigneeId !== 'all') {
        params.assigneeId = filters.assigneeId as number
      }
      const result = await api.getTodos(params)
      setTodos(result.items)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [filters, currentUserId])

  useEffect(() => {
    void refreshTodos()
  }, [refreshTodos])

  // Load user list once
  useEffect(() => {
    api.getUsersSummary()
      .then((list) => setUsers(list as UserSummary[]))
      .catch(() => { /* ignore */ })
  }, [])

  const createTodo = useCallback(async (payload: {
    title: string
    description?: string
    priority?: string
    dueDate?: string
    assigneeId?: number
    linkedModule?: string
    linkedRecordId?: string
  }) => {
    const created = await api.createTodo(payload)
    setTodos((prev) => [created, ...prev])
    return created
  }, [])

  const updateTodo = useCallback(async (id: number, payload: Partial<{
    title: string
    description: string | null
    priority: string
    status: string
    dueDate: string | null
    assigneeId: number | null
  }>) => {
    const updated = await api.updateTodo(id, payload)
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)))
    return updated
  }, [])

  const deleteTodo = useCallback(async (id: number) => {
    await api.deleteTodo(id)
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const restoreTodo = useCallback(async (id: number) => {
    const restored = await api.restoreTodo(id)
    setTodos((prev) => [restored, ...prev])
    return restored
  }, [])

  // Subtask operations
  const addSubtask = useCallback(async (todoId: number, title: string) => {
    const subtask = await api.addSubtask(todoId, title)
    setTodos((prev) =>
      prev.map((t) => (t.id === todoId ? { ...t, subtasks: [...t.subtasks, subtask] } : t)),
    )
    return subtask
  }, [])

  const toggleSubtask = useCallback(async (todoId: number, subtaskId: number, completed: boolean) => {
    const updated = await api.updateSubtask(todoId, subtaskId, { completed })
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todoId
          ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subtaskId ? updated : s)) }
          : t,
      ),
    )
  }, [])

  const deleteSubtask = useCallback(async (todoId: number, subtaskId: number) => {
    await api.deleteSubtask(todoId, subtaskId)
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todoId
          ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
          : t,
      ),
    )
  }, [])

  // Comments
  const fetchComments = useCallback(async (todoId: number): Promise<TodoComment[]> => {
    return api.getTodoComments(todoId)
  }, [])

  const addComment = useCallback(async (todoId: number, content: string) => {
    const comment = await api.addTodoComment(todoId, content)
    // Increment comment count on the todo
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todoId
          ? { ...t, _count: { comments: (t._count?.comments ?? 0) + 1 } }
          : t,
      ),
    )
    return comment
  }, [])

  return {
    todos,
    loading,
    filters,
    setFilters,
    users,
    createTodo,
    updateTodo,
    deleteTodo,
    restoreTodo,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    fetchComments,
    addComment,
    refreshTodos,
  }
}
