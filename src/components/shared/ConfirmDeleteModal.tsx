import { useState } from 'react'

type ConfirmDeleteModalProps = {
  open: boolean
  title?: string
  message?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function ConfirmDeleteModal({
  open,
  title = 'Mover para Lixeira',
  message = 'Este registo será movido para a lixeira e eliminado automaticamente após 30 dias.',
  onConfirm,
  onCancel,
}: ConfirmDeleteModalProps) {
  const [loading, setLoading] = useState(false)

  if (!open) return null

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }} onClick={loading ? undefined : onCancel}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '24px 28px',
        maxWidth: 420, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>🗑️</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h3>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#555', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #ddd',
              background: '#fff', cursor: 'pointer', fontSize: 13,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'A eliminar…' : 'Mover para Lixeira'}
          </button>
        </div>
      </div>
    </div>
  )
}
