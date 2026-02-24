import { useState, useCallback } from 'react'
import type { CalculatorKey } from '../constants'

export function useCalculator() {
  const [calculatorExpression, setCalculatorExpression] = useState('')
  const [calculatorResult, setCalculatorResult] = useState<string | null>(null)
  const [calculatorError, setCalculatorError] = useState('')

  const evaluateCalculator = useCallback(() => {
    const normalized = calculatorExpression
      .replace(/,/g, '.')
      .replace(/[×x]/g, '*')
      .replace(/[÷]/g, '/')
      .trim()

    if (!normalized) {
      setCalculatorResult(null)
      setCalculatorError('')
      return
    }

    if (!/^[0-9+\-*/().\s%]+$/.test(normalized)) {
      setCalculatorError('Expressão inválida.')
      setCalculatorResult(null)
      return
    }

    const expressionWithPercent = normalized.replace(/(\d+(\.\d+)?)%/g, '($1/100)')

    try {
      const computed = Function(`"use strict"; return (${expressionWithPercent})`)()
      if (typeof computed !== 'number' || !Number.isFinite(computed)) {
        setCalculatorError('Resultado inválido.')
        setCalculatorResult(null)
        return
      }
      setCalculatorError('')
      setCalculatorResult(
        new Intl.NumberFormat('pt-PT', {
          maximumFractionDigits: 6,
        }).format(computed),
      )
    } catch {
      setCalculatorError('Não foi possível calcular.')
      setCalculatorResult(null)
    }
  }, [calculatorExpression])

  function clearCalculator() {
    setCalculatorExpression('')
    setCalculatorResult(null)
    setCalculatorError('')
  }

  function appendCalculatorValue(value: string) {
    setCalculatorExpression((current) => `${current}${value}`)
    setCalculatorError('')
  }

  function backspaceCalculator() {
    setCalculatorExpression((current) => current.slice(0, -1))
    setCalculatorError('')
  }

  function handleCalculatorKeyPress(key: CalculatorKey) {
    if (key.action === 'clear') {
      clearCalculator()
      return
    }
    if (key.action === 'backspace') {
      backspaceCalculator()
      return
    }
    if (key.action === 'equals') {
      evaluateCalculator()
      return
    }
    if (key.value) {
      appendCalculatorValue(key.value)
    }
  }

  return {
    calculatorExpression,
    setCalculatorExpression,
    calculatorResult,
    calculatorError,
    evaluateCalculator,
    clearCalculator,
    appendCalculatorValue,
    backspaceCalculator,
    handleCalculatorKeyPress,
  }
}
