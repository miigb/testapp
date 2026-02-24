import type { MouseEvent as ReactMouseEvent } from 'react'
import { GripVertical, Pin, PinOff, X } from 'lucide-react'
import { CALCULATOR_KEYS } from '../../constants'
import type { CalculatorKey } from '../../constants'

export interface CalculatorWindowProps {
  windowRef: React.RefObject<HTMLDivElement | null>
  position: { x: number; y: number } | null
  zIndex: number
  isPinned: boolean
  isDragging: boolean
  expression: string
  result: string | null
  error: string
  onBringToFront: () => void
  onStartDrag: (event: ReactMouseEvent<HTMLDivElement>) => void
  onTogglePinned: () => void
  onClose: () => void
  onKeyPress: (key: CalculatorKey) => void
}

export function CalculatorWindow({
  windowRef,
  position,
  zIndex,
  isPinned,
  isDragging,
  expression,
  result,
  error,
  onBringToFront,
  onStartDrag,
  onTogglePinned,
  onClose,
  onKeyPress,
}: CalculatorWindowProps) {
  return (
    <section
      ref={windowRef}
      className={`tool-window calculator-window ${position ? 'positioned' : 'centered'} ${isDragging ? 'dragging' : ''} ${isPinned ? 'pinned' : ''}`}
      style={position ? { left: `${position.x}px`, top: `${position.y}px`, zIndex } : { zIndex }}
      onMouseDown={onBringToFront}
      role="dialog"
      aria-modal="false"
      aria-label="Calculadora"
    >
      <div className="tool-window-header calculator-header" onMouseDown={onStartDrag}>
        <div className="tool-window-title">
          <GripVertical size={14} />
          <div>
            <h3>Calculadora</h3>
          </div>
        </div>
        <div className="tool-window-controls" onMouseDown={(event) => event.stopPropagation()}>
          <button
            className={`subtle-btn icon-btn micro ${isPinned ? 'active' : ''}`}
            type="button"
            onClick={onTogglePinned}
            title={isPinned ? 'Desafixar janela' : 'Fixar no topo'}
            aria-label={isPinned ? 'Desafixar janela' : 'Fixar no topo'}
          >
            {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button className="subtle-btn icon-btn micro" type="button" onClick={onClose} title="Fechar calculadora" aria-label="Fechar calculadora">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className={`calculator-display ${error ? 'error' : ''}`}>
        <div className="calculator-expression">
          {(expression || '0').replace(/\*/g, '×').replace(/\//g, '÷').replace(/\./g, ',')}
        </div>
        <div className="calculator-result">{error || result || '0'}</div>
      </div>

      <div className="calculator-keypad">
        {CALCULATOR_KEYS.map((key) => (
          <button
            key={key.label}
            className={`calculator-key tone-${key.tone ?? 'default'} ${key.wide ? 'wide' : ''}`}
            type="button"
            onClick={() => onKeyPress(key)}
          >
            {key.label}
          </button>
        ))}
      </div>
    </section>
  )
}
