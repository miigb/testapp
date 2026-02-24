import { Bell, CheckSquare, PanelRightClose, Trash2 } from 'lucide-react'
import type { TodoItem, TodoFilters, TodoComment, NotificationItem, NotificationPreferences, UserSummary } from '../../types'
import { TodosPanel } from './TodosPanel'
import { NotificationsPanel } from './NotificationsPanel'
import { TrashPanel } from './TrashPanel'
import './Sidebar.css'

export type SidebarTab = 'todos' | 'notifications' | 'trash'

interface TrashEntry {
  id: string
  module: 'recibos' | 'ds' | 'penhoras' | 'tarefas'
  label: string
  deletedAt: string
  deletedBy?: string
}

export interface SidebarProps {
  open: boolean
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  onClose: () => void

  // Todos
  todos: TodoItem[]
  todosLoading: boolean
  todoFilters: TodoFilters
  onTodoFiltersChange: (filters: TodoFilters) => void
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

  // Notifications
  notifications: NotificationItem[]
  notificationsLoading: boolean
  unreadCount: number
  notifPreferences: NotificationPreferences | null
  onMarkRead: (id: number) => Promise<void>
  onMarkAllRead: () => Promise<void>
  onUpdateNotifPrefs: (patch: Partial<NotificationPreferences>) => Promise<unknown>

  // Todos pre-fill link (from drawer create-todo button)
  pendingTodoLink?: { module: string; recordId: string } | null
  onClearPendingTodoLink?: () => void

  // Notifications navigation
  onNotificationNavigate?: (module: string, recordId: string) => void

  // Trash
  trashItems: TrashEntry[]
  trashLoading: boolean
  trashCount: number
  onRestore: (module: string, id: string) => Promise<void>
  onPermanentDelete?: (module: string, id: string) => Promise<void>
  onEmptyTrash?: () => Promise<void>
  isAdmin?: boolean
}

export function Sidebar({
  open,
  activeTab,
  onTabChange,
  onClose,
  todos,
  todosLoading,
  todoFilters,
  onTodoFiltersChange,
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
  pendingTodoLink,
  onClearPendingTodoLink,
  notifications,
  notificationsLoading,
  unreadCount,
  notifPreferences,
  onMarkRead,
  onMarkAllRead,
  onUpdateNotifPrefs,
  onNotificationNavigate,
  trashItems,
  trashLoading,
  trashCount,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
  isAdmin,
}: SidebarProps) {
  return (
    <div className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'todos' ? 'active' : ''}`}
          onClick={() => onTabChange('todos')}
          title="Tarefas"
        >
          <CheckSquare size={15} />
          Tarefas
          {todos.length > 0 && (
            <span className="sidebar-tab-badge">{todos.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => onTabChange('notifications')}
          title="Notificações"
        >
          <Bell size={15} />
          Notificações
          {unreadCount > 0 && (
            <span className="sidebar-tab-badge">{unreadCount}</span>
          )}
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'trash' ? 'active' : ''}`}
          onClick={() => onTabChange('trash')}
          title="Lixeira"
        >
          <Trash2 size={15} />
          Lixeira
          {trashCount > 0 && (
            <span className="sidebar-tab-badge">{trashCount}</span>
          )}
        </button>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onClose}
          title="Fechar painel lateral"
          aria-label="Fechar painel lateral"
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      <div className="sidebar-body">
        {activeTab === 'todos' && (
          <TodosPanel
            todos={todos}
            loading={todosLoading}
            filters={todoFilters}
            onFiltersChange={onTodoFiltersChange}
            users={users}
            currentUserId={currentUserId}
            onCreateTodo={onCreateTodo}
            onUpdateTodo={onUpdateTodo}
            onDeleteTodo={onDeleteTodo}
            onAddSubtask={onAddSubtask}
            onToggleSubtask={onToggleSubtask}
            onDeleteSubtask={onDeleteSubtask}
            onFetchComments={onFetchComments}
            onAddComment={onAddComment}
            pendingTodoLink={pendingTodoLink}
            onClearPendingTodoLink={onClearPendingTodoLink}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsPanel
            notifications={notifications}
            loading={notificationsLoading}
            unreadCount={unreadCount}
            preferences={notifPreferences}
            onMarkRead={onMarkRead}
            onMarkAllRead={onMarkAllRead}
            onUpdatePreferences={onUpdateNotifPrefs}
            onNavigate={onNotificationNavigate}
          />
        )}

        {activeTab === 'trash' && (
          <TrashPanel
            items={trashItems}
            loading={trashLoading}
            onRestore={onRestore}
            onPermanentDelete={onPermanentDelete}
            onEmptyTrash={onEmptyTrash}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </div>
  )
}
