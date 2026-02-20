/**
 * Smart Notes engine — pure expression evaluator for the calculator/notes panel.
 * No React dependencies.
 */

const SMART_NOTES_NUMBER_FORMATTER = new Intl.NumberFormat('pt-PT', {
    maximumFractionDigits: 6,
})

export type SavedSmartNotesEntry = {
    signature: string
    expression: string
    result: number
    source: string
    savedAt: string
}

export type SmartNotesResultRow = {
    lineNumber: number
    source: string
    expression: string
    result: number
    signature: string
}

export type SmartNotesErrorRow = {
    lineNumber: number
    source: string
    error: string
}

export function formatSmartNotesValue(value: number): string {
    return SMART_NOTES_NUMBER_FORMATTER.format(value)
}

export function parseSmartNumber(value: string): number | null {
    const scaleMatch = value.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*([kKmMbB])?$/)
    if (!scaleMatch) return null
    const normalized = scaleMatch[1].replace(/\s+/g, '').replace(',', '.')
    const parsed = Number(normalized)
    if (!Number.isFinite(parsed)) return null
    const suffix = scaleMatch[2]?.toLowerCase()
    if (!suffix) return parsed
    if (suffix === 'k') return parsed * 1_000
    if (suffix === 'm') return parsed * 1_000_000
    if (suffix === 'b') return parsed * 1_000_000_000
    return parsed
}

export function buildSmartNotesSignature(expression: string, result: number): string {
    return `${expression.trim().toLowerCase()}::${result.toFixed(6)}`
}

export function evaluateSmartNotesLine(
    line: string,
    context: { previousResults: number[]; variables: Map<string, number> },
): { expression: string; result: number; signature: string; variableKey?: string } | { error: string } | null {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return null

    const assignmentMatch = trimmed.match(/^([A-Za-zÀ-ÿ_][\wÀ-ÿ ]{0,40})\s*=\s*(.+)$/)
    const rawExpression = assignmentMatch ? assignmentMatch[2].trim() : trimmed.includes('=') ? trimmed.split('=').slice(1).join('=').trim() : trimmed
    if (!rawExpression) return null

    const totalLineMatch = rawExpression.match(/\b(total|subtotal|soma|sum)\b/i)
    if (totalLineMatch && !/[0-9+\-*/%]/.test(rawExpression)) {
        if (context.previousResults.length === 0) {
            return { error: 'Sem valores anteriores para total.' }
        }
        const total = context.previousResults.reduce((sum, value) => sum + value, 0)
        return {
            expression: 'total',
            result: total,
            signature: buildSmartNotesSignature('total', total),
            variableKey: assignmentMatch?.[1]?.trim().toLowerCase().replace(/\s+/g, '_'),
        }
    }

    const percentOfMatch = rawExpression.match(/(-?\d+(?:[.,]\d+)?)\s*%\s*(?:de|do|da|sobre)\s*(-?\d+(?:[.,]\d+)?)/i)
    if (percentOfMatch) {
        const percent = parseSmartNumber(percentOfMatch[1])
        const base = parseSmartNumber(percentOfMatch[2])
        if (percent === null || base === null) {
            return { error: 'Percentagem inválida.' }
        }
        const computed = (base * percent) / 100
        return {
            expression: `${percentOfMatch[1]}% de ${percentOfMatch[2]}`,
            result: computed,
            signature: buildSmartNotesSignature(`${percentOfMatch[1]}% de ${percentOfMatch[2]}`, computed),
            variableKey: assignmentMatch?.[1]?.trim().toLowerCase().replace(/\s+/g, '_'),
        }
    }

    const totalReplacement =
        context.previousResults.length > 0 ? String(context.previousResults.reduce((sum, value) => sum + value, 0)) : '0'

    const withScaledNumbers = rawExpression.replace(/(-?\d+(?:[.,]\d+)?)\s*([kKmMbB])\b/g, (_, amount: string, suffix: string) => {
        const parsed = parseSmartNumber(`${amount}${suffix}`)
        return parsed === null ? `${amount}${suffix}` : String(parsed)
    })

    const withVariables = withScaledNumbers.replace(/\b([A-Za-zÀ-ÿ_][\wÀ-ÿ]*)\b/g, (token) => {
        const mapped = context.variables.get(token.toLowerCase())
        return mapped === undefined ? token : String(mapped)
    })

    const normalized = withVariables
        .replace(/\b(total|subtotal|soma|sum)\b/gi, totalReplacement)
        .replace(/[€$£]/g, ' ')
        .replace(/\b(eur|euro|euros|usd|dolar|dólar|dolares|dólares)\b/gi, ' ')
        .replace(/[×x]/g, '*')
        .replace(/[÷]/g, '/')
        .replace(/\b(dividido\s+por|sobre|per)\b/gi, ' / ')
        .replace(/\b(vezes|multiplicado\s+por)\b/gi, ' * ')
        .replace(/\b(mais|plus)\b/gi, ' + ')
        .replace(/\b(menos|minus)\b/gi, ' - ')
        .replace(/&/g, ' + ')
        .replace(/\be\b/gi, ' + ')
        .replace(/,/g, '.')
        .replace(/[^0-9+\-*/().% ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()

    if (!normalized) return null
    if (!/^[0-9+\-*/().%\s]+$/.test(normalized)) {
        return { error: 'Expressão não suportada.' }
    }

    const numberTokens = normalized.match(/-?\d+(?:\.\d+)?/g) ?? []
    const hasOperator = /[+\-*/()%]/.test(normalized)
    let finalExpression = normalized

    if (!hasOperator) {
        if (numberTokens.length === 0) return null
        finalExpression = numberTokens.join(' + ')
    }

    finalExpression = finalExpression.replace(/^[+*/\s]+|[+\-*/\s]+$/g, '').trim()
    if (!finalExpression) {
        return { error: 'Não foi possível interpretar.' }
    }

    const expressionWithPercent = finalExpression.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)')

    try {
        const computed = Function(`"use strict"; return (${expressionWithPercent})`)()
        if (typeof computed !== 'number' || !Number.isFinite(computed)) {
            return { error: 'Resultado inválido.' }
        }
        return {
            expression: finalExpression,
            result: computed,
            signature: buildSmartNotesSignature(finalExpression, computed),
            variableKey: assignmentMatch?.[1]?.trim().toLowerCase().replace(/\s+/g, '_'),
        }
    } catch {
        return { error: 'Não foi possível interpretar.' }
    }
}
