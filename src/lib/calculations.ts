import type { CalculationSettings, EntryForm } from '../types'

function parseNumber(value: string): number | undefined {
  if (!value.trim()) return undefined

  const raw = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[€$£]/g, '')

  const sign = raw.startsWith('-') ? '-' : ''
  let normalized = raw.replace(/^[+-]/, '')
  const commaCount = (normalized.match(/,/g) || []).length
  const dotCount = (normalized.match(/\./g) || []).length

  const isThousandPattern = (separator: ',' | '.') => {
    const escaped = separator === '.' ? '\\.' : separator
    return new RegExp(`^\\d{1,3}(?:${escaped}\\d{3})+$`).test(normalized)
  }

  if (commaCount > 0 && dotCount > 0) {
    const lastComma = normalized.lastIndexOf(',')
    const lastDot = normalized.lastIndexOf('.')
    const decimalSeparator: ',' | '.' = lastComma > lastDot ? ',' : '.'
    const thousandSeparator: ',' | '.' = decimalSeparator === ',' ? '.' : ','
    normalized = normalized.split(thousandSeparator).join('')
    if (decimalSeparator === ',') {
      const separatorIndex = normalized.lastIndexOf(',')
      normalized = `${normalized.slice(0, separatorIndex).replace(/,/g, '')}.${normalized.slice(separatorIndex + 1)}`
    } else {
      const separatorIndex = normalized.lastIndexOf('.')
      normalized = `${normalized.slice(0, separatorIndex).replace(/\./g, '')}.${normalized.slice(separatorIndex + 1)}`
      normalized = normalized.replace(/,/g, '')
    }
  } else if (commaCount > 0) {
    if (isThousandPattern(',')) {
      normalized = normalized.replace(/,/g, '')
    } else {
      const separatorIndex = normalized.lastIndexOf(',')
      normalized = `${normalized.slice(0, separatorIndex).replace(/,/g, '')}.${normalized.slice(separatorIndex + 1)}`
    }
  } else if (dotCount > 0) {
    if (isThousandPattern('.')) {
      normalized = normalized.replace(/\./g, '')
    } else if (dotCount > 1) {
      const separatorIndex = normalized.lastIndexOf('.')
      normalized = `${normalized.slice(0, separatorIndex).replace(/\./g, '')}.${normalized.slice(separatorIndex + 1)}`
    }
  }

  const cleaned = `${sign}${normalized}`.replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

function formatNumber(value: number | undefined, precision: number): string {
  if (typeof value !== 'number') return ''
  return value.toFixed(precision).replace('.', ',')
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function getBaseValue(form: EntryForm, baseField: 'valorIndicado' | 'valorSemIva' | 'valorEmissao'): number | undefined {
  if (baseField === 'valorIndicado') return parseNumber(form.valorIndicado)
  if (baseField === 'valorSemIva') return parseNumber(form.valorSemIva)
  return parseNumber(form.valorEmissao)
}

function inferValorSemIvaFromValorIndicado(next: EntryForm, settings: CalculationSettings, precision: number, forceRecalculate: boolean) {
  if (next.valorSemIva.trim() && !forceRecalculate) {
    return
  }

  const valorIndicado = parseNumber(next.valorIndicado)
  if (typeof valorIndicado !== 'number') {
    return
  }

  const ivaRule = settings.taxRules
    .filter((rule) => rule.enabled && rule.targetField === 'iva' && rule.baseField === 'valorSemIva')
    .sort((a, b) => a.order - b.order)[0]

  if (!ivaRule || ivaRule.rate <= -1) {
    return
  }

  next.valorSemIva = formatNumber(round(valorIndicado / (1 + ivaRule.rate), precision), precision)
}

export function applyFormAutoCalculations(form: EntryForm, settings: CalculationSettings, forceRecalculate = false): EntryForm {
  if (!settings.autoApplyRules) {
    return form
  }

  const precision = Math.max(0, Math.min(6, settings.roundTo ?? 2))
  const next = { ...form }
  inferValorSemIvaFromValorIndicado(next, settings, precision, forceRecalculate)

  for (const rule of settings.taxRules.filter((candidate) => candidate.enabled).sort((a, b) => a.order - b.order)) {
    const baseValue = getBaseValue(next, rule.baseField)
    if (typeof baseValue !== 'number') continue

    const computed = round(baseValue * rule.rate, precision)

    if (rule.targetField === 'iva' && (forceRecalculate || !next.iva.trim())) next.iva = formatNumber(computed, precision)
    if (rule.targetField === 'retencao' && (forceRecalculate || !next.retencao.trim())) next.retencao = formatNumber(computed, precision)
    if (rule.targetField === 'meu5' && (forceRecalculate || !next.meu5.trim())) next.meu5 = formatNumber(computed, precision)
    if (rule.targetField === 'outrasTaxas' && (forceRecalculate || !next.outrasTaxas.trim())) next.outrasTaxas = formatNumber(computed, precision)
  }

  const valorSemIva = parseNumber(next.valorSemIva)
  const iva = parseNumber(next.iva)
  const valorIndicado = parseNumber(next.valorIndicado)

  if ((forceRecalculate || !next.valorSemIva.trim()) && settings.autoComputeValorSemIva && typeof valorIndicado === 'number' && typeof iva === 'number') {
    next.valorSemIva = formatNumber(round(valorIndicado - iva, precision), precision)
  }

  if ((forceRecalculate || !next.valorEmissao.trim()) && settings.autoComputeValorEmissao && typeof valorSemIva === 'number' && typeof iva === 'number') {
    next.valorEmissao = formatNumber(round(valorSemIva + iva, precision), precision)
  }

  return next
}

export function parseFormNumber(value: string): number | undefined {
  return parseNumber(value)
}
