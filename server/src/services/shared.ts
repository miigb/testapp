import { Prisma, type TaxRule } from '@prisma/client'

import { normalizeText, type RecordInputData } from '../utils'

export function databaseSetupHint() {
  return 'Base de dados indisponível. Configure DATABASE_URL e execute: npm run prisma:push'
}

/** Maps any status record (Status, DsStatus, or PenhorasStatus — all share the same shape) to a DTO. */
export function toStatusDto(status: { id: string; key: string; label: string; icon: string; color: string; active: boolean; order: number }) {
  return {
    id: status.id,
    key: status.key,
    label: status.label,
    icon: status.icon,
    color: status.color,
    active: status.active,
    order: status.order,
  }
}

/** Alias for recibos status records */
export const statusDto = toStatusDto
/** Alias for DS status records */
export const dsStatusDto = toStatusDto
/** Alias for penhoras status records */
export const penhorasStatusDto = toStatusDto

/** Maps a SavedView record to a DTO. */
export function savedViewDto(view: { id: string; name: string; scope: string; filters: unknown; createdAt: Date; updatedAt: Date }) {
  return {
    id: view.id,
    name: view.name,
    scope: view.scope,
    filters: view.filters,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  }
}

export function normalizeStatusToken(value: unknown): string {
  return normalizeText(value).replace(/[\s_./-]+/g, ' ').trim()
}

export function duplicateVariant(record: RecordInputData, duplicateIndex: number): RecordInputData {
  const suffix = `dup-${duplicateIndex}`
  if (record.reciboNumero) {
    return { ...record, reciboNumero: `${record.reciboNumero}-${suffix}` }
  }
  if (record.processo) {
    return { ...record, processo: `${record.processo}-${suffix}` }
  }
  return { ...record, reciboNumero: suffix }
}

export function toApiTaxRule(rule: TaxRule) {
  return {
    id: rule.id,
    code: rule.code,
    label: rule.label,
    rate: Number(rule.rate),
    enabled: rule.enabled,
    targetField: rule.targetField,
    baseField: rule.baseField,
    order: rule.order,
  }
}

export function parseLooseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value).trim()
  if (!text) return undefined

  const totalMatch = text.match(/TOTAL[:\s]*([0-9.,]+)/i)
  if (totalMatch) {
    const numeric = Number(totalMatch[1].replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(numeric) ? numeric : undefined
  }

  const numbers = [...text.matchAll(/[0-9]+(?:[.,][0-9]+)?/g)].map((match) => match[0])
  if (numbers.length === 0) return undefined

  if ((text.includes('+') || text.includes(' + ')) && numbers.length > 1) {
    const sum = numbers.reduce((acc, item) => {
      const parsed = Number(item.replace(/\./g, '').replace(',', '.'))
      return acc + (Number.isFinite(parsed) ? parsed : 0)
    }, 0)
    return Number.isFinite(sum) ? sum : undefined
  }

  const parsed = Number(numbers[0].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

export function detectDsIvaKind(rawValue?: string): 'sem_iva' | 'total_levantado' | 'valor' | 'outro' | undefined {
  if (!rawValue?.trim()) return undefined
  const normalized = normalizeText(rawValue)
  if (normalized.includes('SEM IVA')) return 'sem_iva'
  if (normalized.includes('TOTAL LEVANTADO')) return 'total_levantado'
  if (parseLooseNumber(rawValue) !== undefined) return 'valor'
  return 'outro'
}

export function toDateOrNull(value?: string): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function normalizeSuggestionValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const raw of values) {
    const value = raw?.trim()
    if (!value) continue
    const key = normalizeText(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    normalized.push(value)
  }

  return normalized.sort((a, b) => a.localeCompare(b, 'pt-PT', { sensitivity: 'base', numeric: true }))
}

export function queryValue(query: Record<string, unknown>, key: string): string | undefined {
  const raw = query[key]
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return undefined
}

export function toNumberFromDecimal(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value)
}
