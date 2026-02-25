import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { User, LoginCredentials, RegisterData, ModuleId } from '../types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  // On mount, try GET /api/auth/me to check existing session
  useEffect(() => {
    let cancelled = false
    api.getMe()
      .then((me) => { if (!cancelled) setUser(me) })
      .catch(() => { if (!cancelled) setUser(null) })
      .finally(() => { if (!cancelled) setAuthLoading(false) })
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setAuthError('')
    try {
      const loggedIn = await api.login(credentials)
      setUser(loggedIn)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha no login.'
      setAuthError(message)
      throw err
    }
  }, [])

  const register = useCallback(async (data: RegisterData) => {
    setAuthError('')
    try {
      const created = await api.register(data)
      setUser(created)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha no registo.'
      setAuthError(message)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
  }, [])

  const canAccessModule = useCallback((moduleId: ModuleId): boolean => {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    return user.allowedModules.includes(moduleId)
  }, [user])

  const canWrite = useCallback((moduleId: ModuleId): boolean => {
    if (!user) return false
    if (user.role === 'CONSULTANT') return false
    return canAccessModule(moduleId)
  }, [user, canAccessModule])

  return { user, authLoading, authError, setAuthError, login, register, logout, canAccessModule, canWrite }
}
