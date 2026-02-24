import { useEffect, useState, useCallback } from 'react'
import { Pencil, Plus, ShieldAlert, ShieldCheck, UserX, X } from 'lucide-react'
import { api } from '../../api'
import type { User, UserRole, RegisterData } from '../../types'

interface UserManagementProps {
  currentUser: User
  onClose: () => void
}

type EditingUser = {
  id: number
  displayName: string
  email: string
  role: UserRole
}

type CreateForm = {
  username: string
  displayName: string
  email: string
  password: string
  role: UserRole
}

const emptyCreateForm: CreateForm = {
  username: '',
  displayName: '',
  email: '',
  password: '',
  role: 'USER',
}

export function UserManagement({ currentUser, onClose }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const [editingUser, setEditingUser] = useState<EditingUser | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm)
  const [createSaving, setCreateSaving] = useState(false)

  const [confirmDeactivate, setConfirmDeactivate] = useState<User | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar utilizadores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  function showFeedback(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 3000)
  }

  // ── Create User ──────────────────────────────────────────────────

  function openCreate() {
    setCreateForm(emptyCreateForm)
    setCreateOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateSaving(true)
    setError('')
    try {
      const payload: RegisterData & { role?: UserRole } = {
        username: createForm.username.trim(),
        displayName: createForm.displayName.trim(),
        password: createForm.password,
      }
      if (createForm.email.trim()) {
        payload.email = createForm.email.trim()
      }
      // Register user first, then update role if not default
      const created = await api.register(payload)
      if (createForm.role !== 'USER') {
        await api.updateUser(created.id, { role: createForm.role })
      }
      setCreateOpen(false)
      showFeedback(`Utilizador "${created.displayName}" criado com sucesso.`)
      await loadUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar utilizador')
    } finally {
      setCreateSaving(false)
    }
  }

  // ── Edit User ────────────────────────────────────────────────────

  function startEdit(user: User) {
    setEditingUser({
      id: user.id,
      displayName: user.displayName,
      email: user.email || '',
      role: user.role,
    })
  }

  async function handleSaveEdit() {
    if (!editingUser) return
    setEditSaving(true)
    setError('')
    try {
      await api.updateUser(editingUser.id, {
        displayName: editingUser.displayName.trim(),
        email: editingUser.email.trim() || null,
        role: editingUser.role,
      })
      setEditingUser(null)
      showFeedback('Utilizador atualizado com sucesso.')
      await loadUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar utilizador')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Deactivate User ──────────────────────────────────────────────

  async function handleDeactivate() {
    if (!confirmDeactivate) return
    setDeactivating(true)
    setError('')
    try {
      await api.deactivateUser(confirmDeactivate.id)
      setConfirmDeactivate(null)
      showFeedback(`Utilizador "${confirmDeactivate.displayName}" desativado.`)
      await loadUsers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao desativar utilizador')
    } finally {
      setDeactivating(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="record-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <aside className="panel record-modal admin-panel">
        {/* Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <ShieldCheck size={18} />
            <h2 className="drawer-title">Gerir Utilizadores</h2>
          </div>
          <button type="button" className="subtle-btn icon-btn micro" onClick={onClose} title="Fechar">
            <X size={16} />
          </button>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className="admin-feedback success">{feedback}</div>
        )}
        {error && (
          <div className="admin-feedback error">{error}</div>
        )}

        {/* Top actions */}
        <div className="admin-actions-row">
          <button type="button" className="primary-btn" onClick={openCreate}>
            <Plus size={14} />
            Criar Utilizador
          </button>
          <span className="admin-user-count">
            {users.length} utilizador{users.length !== 1 ? 'es' : ''}
          </span>
        </div>

        {/* Users table */}
        {loading ? (
          <div className="admin-loading">A carregar utilizadores...</div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Nome</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Papel</th>
                  <th>Estado</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isEditing = editingUser?.id === u.id
                  return (
                    <tr key={u.id} className={!u.active ? 'inactive-row' : ''}>
                      {/* Avatar */}
                      <td>
                        <span
                          className="admin-avatar"
                          style={{ background: u.avatarColor || 'var(--brand)' }}
                        >
                          {u.displayName.charAt(0).toUpperCase()}
                        </span>
                      </td>

                      {/* Display name */}
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="admin-inline-input"
                            value={editingUser.displayName}
                            onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                          />
                        ) : (
                          <span className="admin-cell-name">{u.displayName}</span>
                        )}
                      </td>

                      {/* Username */}
                      <td>
                        <span className="admin-cell-username">@{u.username}</span>
                      </td>

                      {/* Email */}
                      <td>
                        {isEditing ? (
                          <input
                            type="email"
                            className="admin-inline-input"
                            value={editingUser.email}
                            placeholder="(opcional)"
                            onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                          />
                        ) : (
                          <span className="admin-cell-email">{u.email || '—'}</span>
                        )}
                      </td>

                      {/* Role */}
                      <td>
                        {isEditing ? (
                          <select
                            className="admin-inline-select"
                            value={editingUser.role}
                            onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                          >
                            <option value="USER">Utilizador</option>
                            <option value="ADMIN">Administrador</option>
                          </select>
                        ) : (
                          <span className={`admin-role-badge ${u.role === 'ADMIN' ? 'admin' : 'user'}`}>
                            {u.role === 'ADMIN' ? (
                              <><ShieldAlert size={12} /> Admin</>
                            ) : (
                              'Utilizador'
                            )}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`admin-status-badge ${u.active ? 'active' : 'inactive'}`}>
                          {u.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="admin-row-actions">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="primary-btn compact"
                                onClick={() => void handleSaveEdit()}
                                disabled={editSaving}
                              >
                                {editSaving ? 'A guardar...' : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                className="subtle-btn compact"
                                onClick={() => setEditingUser(null)}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="subtle-btn icon-btn micro"
                                title="Editar utilizador"
                                onClick={() => startEdit(u)}
                              >
                                <Pencil size={14} />
                              </button>
                              {u.id !== currentUser.id && u.active && (
                                <button
                                  type="button"
                                  className="subtle-btn icon-btn micro danger-icon"
                                  title="Desativar utilizador"
                                  onClick={() => setConfirmDeactivate(u)}
                                >
                                  <UserX size={14} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Create User Dialog ──────────────────────────────────── */}
        {createOpen && (
          <div className="admin-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCreateOpen(false) }}>
            <div className="admin-dialog">
              <div className="admin-dialog-header">
                <h3>Criar Utilizador</h3>
                <button type="button" className="subtle-btn icon-btn micro" onClick={() => setCreateOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={(e) => void handleCreate(e)} className="admin-dialog-form">
                <label className="admin-field">
                  <span>Username <em>*</em></span>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Nome completo <em>*</em></span>
                  <input
                    type="text"
                    required
                    value={createForm.displayName}
                    onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="(opcional)"
                  />
                </label>
                <label className="admin-field">
                  <span>Palavra-passe <em>*</em></span>
                  <input
                    type="password"
                    required
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span>Papel</span>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                  >
                    <option value="USER">Utilizador</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                </label>
                <div className="admin-dialog-actions">
                  <button
                    type="button"
                    className="subtle-btn"
                    onClick={() => setCreateOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={createSaving}
                  >
                    {createSaving ? 'A criar...' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Deactivate Confirmation Dialog ──────────────────────── */}
        {confirmDeactivate && (
          <div className="admin-dialog-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeactivate(null) }}>
            <div className="admin-dialog admin-dialog-sm">
              <div className="admin-dialog-header">
                <h3>Desativar Utilizador</h3>
                <button type="button" className="subtle-btn icon-btn micro" onClick={() => setConfirmDeactivate(null)}>
                  <X size={16} />
                </button>
              </div>
              <p className="admin-dialog-body">
                Tem a certeza que pretende desativar o utilizador <strong>{confirmDeactivate.displayName}</strong> (@{confirmDeactivate.username})?
                O utilizador deixará de poder aceder ao sistema.
              </p>
              <div className="admin-dialog-actions">
                <button
                  type="button"
                  className="subtle-btn"
                  onClick={() => setConfirmDeactivate(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="primary-btn danger"
                  onClick={() => void handleDeactivate()}
                  disabled={deactivating}
                >
                  {deactivating ? 'A desativar...' : 'Desativar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
