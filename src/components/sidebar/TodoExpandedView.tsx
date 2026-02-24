import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Save, Trash2, X } from 'lucide-react'
import type { TodoItem, TodoComment, UserSummary } from '../../types'

interface TodoExpandedViewProps {
  todo: TodoItem
  users: UserSummary[]
  onBack: () => void
  onUpdate: (payload: Partial<{
    title: string
    description: string | null
    priority: string
    status: string
    dueDate: string | null
    assigneeId: number | null
  }>) => Promise<TodoItem>
  onDelete: () => void
  onAddSubtask: (title: string) => Promise<unknown>
  onToggleSubtask: (subtaskId: number, completed: boolean) => Promise<void>
  onDeleteSubtask: (subtaskId: number) => Promise<void>
  onFetchComments: () => Promise<TodoComment[]>
  onAddComment: (content: string) => Promise<TodoComment>
}

export function TodoExpandedView({
  todo,
  users,
  onBack,
  onUpdate,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onFetchComments,
  onAddComment,
}: TodoExpandedViewProps) {
  const [title, setTitle] = useState(todo.title)
  const [description, setDescription] = useState(todo.description || '')
  const [priority, setPriority] = useState(todo.priority)
  const [status, setStatus] = useState(todo.status)
  const [dueDate, setDueDate] = useState(todo.dueDate || '')
  const [assigneeId, setAssigneeId] = useState<string>(todo.assigneeId ? String(todo.assigneeId) : '')
  const [newSubtask, setNewSubtask] = useState('')
  const [comments, setComments] = useState<TodoComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [saving, setSaving] = useState(false)

  // Sync when todo changes
  useEffect(() => {
    setTitle(todo.title)
    setDescription(todo.description || '')
    setPriority(todo.priority)
    setStatus(todo.status)
    setDueDate(todo.dueDate || '')
    setAssigneeId(todo.assigneeId ? String(todo.assigneeId) : '')
  }, [todo])

  // Load comments on mount
  useEffect(() => {
    onFetchComments().then(setComments).catch(() => { /* ignore */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todo.id])

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate({
        title: title.trim() || todo.title,
        description: description.trim() || null,
        priority,
        status,
        dueDate: dueDate || null,
        assigneeId: assigneeId ? Number(assigneeId) : null,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleAddSubtask() {
    const t = newSubtask.trim()
    if (!t) return
    setNewSubtask('')
    await onAddSubtask(t)
  }

  async function handleAddComment() {
    const c = newComment.trim()
    if (!c) return
    setNewComment('')
    const created = await onAddComment(c)
    setComments((prev) => [...prev, created])
  }

  return (
    <div className="todo-expanded">
      <div className="todo-expanded-header">
        <button type="button" className="back-btn" onClick={onBack} title="Voltar">
          <ArrowLeft size={16} />
        </button>
        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.85rem', color: 'var(--ink)' }}>
          Detalhes da tarefa
        </span>
      </div>

      <div className="todo-expanded-body">
        <div className="todo-field-group">
          <label className="todo-field-label">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="todo-field-group">
          <label className="todo-field-label">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Adicionar descrição..."
          />
        </div>

        <div className="todo-field-row">
          <div className="todo-field-group">
            <label className="todo-field-label">Prioridade</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TodoItem['priority'])}>
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>
          <div className="todo-field-group">
            <label className="todo-field-label">Estado</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TodoItem['status'])}>
              <option value="PENDING">Pendente</option>
              <option value="IN_PROGRESS">Em curso</option>
              <option value="DONE">Concluída</option>
            </select>
          </div>
        </div>

        <div className="todo-field-row">
          <div className="todo-field-group">
            <label className="todo-field-label">Data limite</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="todo-field-group">
            <label className="todo-field-label">Atribuído a</label>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Sem atribuição</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>{u.displayName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Subtasks */}
        <div className="todo-field-group">
          <label className="todo-field-label">Subtarefas</label>
          <div className="subtask-list">
            {todo.subtasks.map((st) => (
              <div key={st.id} className={`subtask-item ${st.completed ? 'completed' : ''}`}>
                <input
                  type="checkbox"
                  checked={st.completed}
                  onChange={(e) => void onToggleSubtask(st.id, e.target.checked)}
                />
                <span>{st.title}</span>
                <button
                  type="button"
                  className="delete-subtask-btn"
                  onClick={() => void onDeleteSubtask(st.id)}
                  title="Remover subtarefa"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="subtask-add-input">
            <input
              type="text"
              placeholder="Nova subtarefa..."
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAddSubtask() }}
            />
            <button type="button" className="subtle-btn icon-btn micro" onClick={() => void handleAddSubtask()} title="Adicionar">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Comments */}
        <div className="todo-field-group">
          <label className="todo-field-label">Comentários</label>
          <div className="todo-comments">
            {comments.map((c) => (
              <div key={c.id} className="todo-comment">
                <div className="todo-comment-header">
                  <span className="todo-comment-author">{c.author.displayName}</span>
                  <span className="todo-comment-time">
                    {new Date(c.createdAt).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="todo-comment-body">{c.content}</div>
              </div>
            ))}
          </div>
          <div className="comment-add-row">
            <input
              type="text"
              placeholder="Escrever comentário..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAddComment() }}
            />
            <button type="button" className="subtle-btn icon-btn micro" onClick={() => void handleAddComment()} title="Enviar">
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="todo-expanded-actions">
        <button
          type="button"
          className="primary-btn"
          onClick={() => void handleSave()}
          disabled={saving}
          style={{ flex: 1 }}
        >
          <Save size={14} />
          {saving ? 'A guardar...' : 'Guardar'}
        </button>
        <button
          type="button"
          className="subtle-btn"
          onClick={onDelete}
          title="Eliminar tarefa"
        >
          <Trash2 size={14} />
          Eliminar
        </button>
      </div>
    </div>
  )
}
