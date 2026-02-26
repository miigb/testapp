import { Bell, Calculator, CheckSquare, PanelRightClose, StickyNote, SquareFunction, Trash2, Wrench } from 'lucide-react'
import type { TodoItem, TodoFilters, TodoComment, NotificationItem, NotificationPreferences, UserSummary } from '../../types'
import type { TrashEntry } from '../../hooks/useTrash'
import { TodosPanel } from './TodosPanel'
import { NotificationsPanel } from './NotificationsPanel'
import { TrashPanel } from './TrashPanel'
import './Sidebar.css'

export type SidebarTab = 'todos' | 'notifications' | 'trash' | 'tools'

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
  onEmptyTrash?: (module?: 'recibos' | 'ds' | 'penhoras' | 'tarefas') => Promise<void>
  isAdmin?: boolean

  // Tools
  notesOpen: boolean
  calculatorOpen: boolean
  smartNotesOpen: boolean
  onToggleQuickTool: (tool: 'notes' | 'calculator' | 'smart-notes') => void
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
  notesOpen,
  calculatorOpen,
  smartNotesOpen,
  onToggleQuickTool,
}: SidebarProps) {
  return (
    <div className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-header">
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'todos' ? 'active' : ''}`}
          onClick={() => onTabChange('todos')}
          title="Tarefas"
          aria-label="Tarefas"
        >
          <CheckSquare size={16} />
          {todos.length > 0 && (
            <span className="sidebar-tab-badge">{todos.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => onTabChange('notifications')}
          title="Notificações"
          aria-label="Notificações"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="sidebar-tab-badge">{unreadCount}</span>
          )}
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'trash' ? 'active' : ''}`}
          onClick={() => onTabChange('trash')}
          title="Lixeira"
          aria-label="Lixeira"
        >
          <Trash2 size={16} />
          {trashCount > 0 && (
            <span className="sidebar-tab-badge">{trashCount}</span>
          )}
        </button>
        <button
          type="button"
          className={`sidebar-tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => onTabChange('tools')}
          title="Ferramentas"
          aria-label="Ferramentas"
        >
          <Wrench size={16} />
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

        {activeTab === 'tools' && (
          <div className="tools-panel">
            <div className="tools-panel-header">Ferramentas</div>
            <div className="tools-panel-grid">
              <button
                type="button"
                className={`tools-panel-card ${notesOpen ? 'active' : ''}`}
                onClick={() => onToggleQuickTool('notes')}
              >
                <StickyNote size={20} />
                <span className="tools-panel-card-label">Notas Rápidas</span>
                <kbd className="tools-panel-card-shortcut">Alt+N</kbd>
              </button>
              <button
                type="button"
                className={`tools-panel-card ${calculatorOpen ? 'active' : ''}`}
                onClick={() => onToggleQuickTool('calculator')}
              >
                <Calculator size={20} />
                <span className="tools-panel-card-label">Calculadora</span>
                <kbd className="tools-panel-card-shortcut">Alt+C</kbd>
              </button>
              <button
                type="button"
                className={`tools-panel-card ${smartNotesOpen ? 'active' : ''}`}
                onClick={() => onToggleQuickTool('smart-notes')}
              >
                <SquareFunction size={20} />
                <span className="tools-panel-card-label">Notas com Cálculo</span>
                <kbd className="tools-panel-card-shortcut">Alt+S</kbd>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
