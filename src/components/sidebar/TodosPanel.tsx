import { useState } from 'react'
import { Inbox } from 'lucide-react'
import type { TodoItem, TodoFilters, TodoComment, UserSummary } from '../../types'
import { TodoCard } from './TodoCard'
import { TodoExpandedView } from './TodoExpandedView'

interface TodosPanelProps {
  todos: TodoItem[]
  loading: boolean
  filters: TodoFilters
  onFiltersChange: (filters: TodoFilters) => void
  users: UserSummary[]
  currentUserId: number
  onCreateTodo: (payload: { title: string; description?: string; priority?: string; dueDate?: string; assigneeId?: number; linkedModule?: string; linkedRecordId?: string }) => Promise<TodoItem>
  onUpdateTodo: (id: number, payload: Partial<{ title: string; description: string | null; priority: string; status: string; dueDate: string | null; assigneeId: number | null }>) => Promise<TodoItem>
  onDeleteTodo: (id: number) => Promise<void>
  onAddSubtask: (todoId: number, title: string) => Promise<unknown>
  onToggleSubtask: (todoId: number, subtaskId: number, completed: boolean) => Promise<void>
  onDeleteSubtask: (todoId: number, subtaskId: number) => Promise<void>
  onFetchComments: (todoId: number) => Promise<TodoComment[]>
  onAddComment: (todoId: number, content: string) => Promise<TodoComment>
}

export function TodosPanel({
  todos,
  loading,
  filters,
  onFiltersChange,
  users,
  currentUserId,
  onCreateTodo,
  onUpdateTodo,
  onDeleteTodo,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onFetchComments,
  onAddComment,
}: TodosPanelProps) {
  const [quickTitle, setQuickTitle] = useState('')
  const [expandedTodoId, setExpandedTodoId] = useState<number | null>(null)

  const expandedTodo = expandedTodoId != null ? todos.find((t) => t.id === expandedTodoId) ?? null : null

  async function handleQuickAdd() {
    const title = quickTitle.trim()
    if (!title) return
    setQuickTitle('')
    await onCreateTodo({ title })
  }

  if (expandedTodo) {
    return (
      <TodoExpandedView
        todo={expandedTodo}
        users={users}
        onBack={() => setExpandedTodoId(null)}
        onUpdate={(payload) => onUpdateTodo(expandedTodo.id, payload)}
        onDelete={() => { void onDeleteTodo(expandedTodo.id); setExpandedTodoId(null) }}
        onAddSubtask={(title) => onAddSubtask(expandedTodo.id, title)}
        onToggleSubtask={(sid, completed) => onToggleSubtask(expandedTodo.id, sid, completed)}
        onDeleteSubtask={(sid) => onDeleteSubtask(expandedTodo.id, sid)}
        onFetchComments={() => onFetchComments(expandedTodo.id)}
        onAddComment={(content) => onAddComment(expandedTodo.id, content)}
      />
    )
  }

  return (
    <>
      <div className="todos-quick-add">
        <input
          type="text"
          placeholder="Nova tarefa... (Enter para criar)"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleQuickAdd() }}
        />
      </div>

      <div className="todos-filter-bar">
        <button
          type="button"
          className={`filter-pill ${filters.scope === 'mine' ? 'active' : ''}`}
          onClick={() => onFiltersChange({ ...filters, scope: filters.scope === 'mine' ? 'all' : 'mine' })}
        >
          {filters.scope === 'mine' ? 'As Minhas' : 'Todas'}
        </button>
        <button
          type="button"
          className={`filter-pill ${filters.status === 'PENDING' ? 'active' : ''}`}
          onClick={() => onFiltersChange({ ...filters, status: filters.status === 'PENDING' ? 'all' : 'PENDING' })}
        >
          Pendente
        </button>
        <button
          type="button"
          className={`filter-pill ${filters.status === 'IN_PROGRESS' ? 'active' : ''}`}
          onClick={() => onFiltersChange({ ...filters, status: filters.status === 'IN_PROGRESS' ? 'all' : 'IN_PROGRESS' })}
        >
          Em curso
        </button>
        <button
          type="button"
          className={`filter-pill ${filters.status === 'DONE' ? 'active' : ''}`}
          onClick={() => onFiltersChange({ ...filters, status: filters.status === 'DONE' ? 'all' : 'DONE' })}
        >
          Concluída
        </button>
        <button
          type="button"
          className={`filter-pill ${filters.priority === 'URGENT' ? 'active' : ''}`}
          onClick={() => onFiltersChange({ ...filters, priority: filters.priority === 'URGENT' ? 'all' : 'URGENT' })}
        >
          Urgente
        </button>
      </div>

      {loading ? (
        <div className="sidebar-empty">
          <div className="sidebar-empty-text">A carregar tarefas...</div>
        </div>
      ) : todos.length === 0 ? (
        <div className="sidebar-empty">
          <Inbox size={32} className="sidebar-empty-icon" />
          <div className="sidebar-empty-text">Sem tarefas para mostrar.</div>
        </div>
      ) : (
        <div className="todos-list">
          {todos.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onClick={() => setExpandedTodoId(todo.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}
