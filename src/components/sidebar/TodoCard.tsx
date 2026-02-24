import type { TodoItem } from '../../types'

interface TodoCardProps {
  todo: TodoItem
  onClick: () => void
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

function formatDueDate(dueDate: string): string {
  const date = new Date(dueDate)
  return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

export function TodoCard({ todo, onClick }: TodoCardProps) {
  const completedSubtasks = todo.subtasks.filter((s) => s.completed).length
  const totalSubtasks = todo.subtasks.length
  const overdue = todo.status !== 'DONE' && isOverdue(todo.dueDate)

  return (
    <div
      className={`todo-card ${todo.status === 'DONE' ? 'done' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick() }}
    >
      <div className="todo-card-header">
        <span className={`todo-priority-dot ${todo.priority}`} title={todo.priority} />
        <span className="todo-card-title">{todo.title}</span>
      </div>

      <div className="todo-card-meta">
        {todo.assignee && (
          <span
            className="todo-assignee-chip"
            title={todo.assignee.displayName}
            style={{ background: todo.assignee.avatarColor || 'var(--brand)' }}
          >
            {todo.assignee.displayName.charAt(0).toUpperCase()}
          </span>
        )}

        {todo.dueDate && (
          <span className={overdue ? 'overdue' : ''}>
            {formatDueDate(todo.dueDate)}
          </span>
        )}

        {todo.linkedModule && (
          <span className="todo-linked-chip">
            {todo.linkedModule}{todo.linkedRecordId ? ` #${todo.linkedRecordId.slice(0, 6)}` : ''}
          </span>
        )}

        {totalSubtasks > 0 && (
          <span className="todo-subtask-progress">
            {completedSubtasks}/{totalSubtasks}
          </span>
        )}

        {(todo._count?.comments ?? 0) > 0 && (
          <span>{todo._count!.comments} com.</span>
        )}
      </div>
    </div>
  )
}
