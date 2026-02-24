import { useState } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
import type { LoginCredentials, RegisterData } from '../../types'
import './LoginPage.css'

type LoginPageProps = {
  onLogin: (credentials: LoginCredentials) => Promise<void>
  onRegister: (data: RegisterData) => Promise<void>
  authError: string
  setAuthError: (error: string) => void
}

export function LoginPage({ onLogin, onRegister, authError, setAuthError }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function switchMode() {
    setMode((current) => (current === 'login' ? 'register' : 'login'))
    setAuthError('')
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await onLogin({ username, password })
      } else {
        await onRegister({
          username,
          displayName,
          password,
          ...(email.trim() ? { email: email.trim() } : {}),
        })
      }
    } catch {
      // error is already set via authError prop
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="panel">
          <div className="login-header">
            <h1>
              {mode === 'login' ? <LogIn size={22} /> : <UserPlus size={22} />}
              {mode === 'login' ? 'Iniciar sessao' : 'Criar conta'}
            </h1>
            <p>
              {mode === 'login'
                ? 'Introduza as suas credenciais para aceder.'
                : 'Preencha os dados para criar uma nova conta.'}
            </p>
          </div>

          <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
            {mode === 'register' && (
              <div className="login-field">
                <label htmlFor="login-displayName">Nome completo</label>
                <input
                  id="login-displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Ex: Joana Silva"
                />
              </div>
            )}

            <div className="login-field">
              <label htmlFor="login-username">Utilizador</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="Ex: joana.silva"
              />
            </div>

            {mode === 'register' && (
              <div className="login-field">
                <label htmlFor="login-email">Email (opcional)</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="Ex: joana@empresa.pt"
                />
              </div>
            )}

            <div className="login-field">
              <label htmlFor="login-password">Palavra-passe</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {authError && <div className="login-error">{authError}</div>}

            <div className="login-actions">
              <button className="primary-btn" type="submit" disabled={submitting}>
                {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
                {submitting
                  ? 'A processar...'
                  : mode === 'login'
                    ? 'Entrar'
                    : 'Criar conta'}
              </button>
            </div>

            <div className="login-toggle">
              <button type="button" onClick={switchMode}>
                {mode === 'login'
                  ? 'Nao tem conta? Criar conta'
                  : 'Ja tem conta? Iniciar sessao'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
