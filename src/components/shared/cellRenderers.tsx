import type { ReactNode } from 'react'
import type { ColumnType, DefaultColumnDef } from '../../constants/columnDefinitions'
import type { ColumnConfig } from '../../types/columnConfig'
import { formatCurrency, formatNumber } from '../../lib/formatters'
import { EntityIdentity } from './StatusComponents'

// ── Types ─────────────────────────────────────────────────────────

/**
 * A cell renderer receives the cell value, the full record, and an
 * optional formatCurrency override (some consumers pass one as prop).
 * It returns a ReactNode for the <td> content.
 */
export type CellRenderer<R = Record<string, unknown>> = (
  value: unknown,
  record: R,
) => ReactNode

// ── Type-based default renderers ──────────────────────────────────

function renderString(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function renderNumber(value: unknown): ReactNode {
  if (typeof value === 'number') return formatNumber(value)
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function renderCurrency(value: unknown): ReactNode {
  if (typeof value === 'number') return formatCurrency(value)
  return '-'
}

function renderDate(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

const TYPE_RENDERERS: Record<ColumnType, CellRenderer> = {
  string: renderString,
  number: renderNumber,
  currency: renderCurrency,
  date: renderDate,
  select: renderString,
}

// ── Module-specific renderers ─────────────────────────────────────

/**
 * Recibos-specific cell renderers (key → renderer).
 * Only keys that differ from the default type-based renderer.
 */
const recibosRenderers: Record<string, CellRenderer> = {
  tipo: (value) => {
    if (value === 'exequente') return 'Exequente'
    if (value === 'executado') return 'Executado'
    return String(value ?? '-')
  },

  ano_mes: (_value, record) => {
    const ano = record.ano as number | undefined
    const mes = record.mes as number | undefined
    if (typeof ano !== 'number' || typeof mes !== 'number') return '-'
    return `${ano}/${String(mes).padStart(2, '0')}`
  },

  gestor_exequente: (_value, record) => {
    const gestor = record.gestor as string | undefined
    const exequente = record.exequente as string | undefined
    return <EntityIdentity gestor={gestor} exequente={exequente} />
  },
}

/**
 * DS-specific cell renderers.
 */
const dsRenderers: Record<string, CellRenderer> = {
  // All DS columns use default type-based renderers — no overrides needed.
}

/**
 * Penhoras-specific cell renderers.
 */
const penhorasRenderers: Record<string, CellRenderer> = {
  // All Penhoras columns use default type-based renderers — no overrides needed.
}

// ── Registry ──────────────────────────────────────────────────────

const MODULE_RENDERERS: Record<string, Record<string, CellRenderer>> = {
  recibos: recibosRenderers,
  ds: dsRenderers,
  penhoras: penhorasRenderers,
}

/**
 * Resolves the best renderer for a given (module, key, type) combo.
 *
 * Priority:
 * 1. Module-specific renderer for this key
 * 2. Type-based default renderer
 * 3. Fallback string renderer
 */
export function getCellRenderer(
  module: string,
  key: string,
  type: ColumnType,
): CellRenderer {
  const moduleMap = MODULE_RENDERERS[module]
  if (moduleMap?.[key]) return moduleMap[key]
  return TYPE_RENDERERS[type] ?? renderString
}

/**
 * Helper to read a field value from a record, checking both
 * top-level fields and the `customFields` JSON object.
 */
export function getFieldValue(
  record: Record<string, unknown>,
  key: string,
): unknown {
  if (key in record) return record[key]

  const customFields = record.customFields
  if (customFields && typeof customFields === 'object' && !Array.isArray(customFields)) {
    return (customFields as Record<string, unknown>)[key]
  }

  return undefined
}

/**
 * Convert static DefaultColumnDef[] into ColumnConfig[] for fallback
 * when the API hasn't responded yet.
 */
export function defaultsToColumnConfig(
  module: string,
  view: string,
  defaults: DefaultColumnDef[],
): ColumnConfig[] {
  return defaults.map((def) => ({
    id: `fallback-${def.key}`,
    module,
    view,
    key: def.key,
    label: def.label,
    type: def.type,
    visible: true,
    position: def.position,
    isCustom: false,
    isReference: false,
  }))
}
