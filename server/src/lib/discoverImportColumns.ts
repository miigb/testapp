import type { PrismaClient } from '@prisma/client'

// ── Types ─────────────────────────────────────────────────────────

export interface DiscoveredColumn {
  /** Raw header text from the Excel file */
  header: string
  /** Auto-generated camelCase key safe for use as ColumnConfig key */
  suggestedKey: string
  /** Title-cased version of the header for use as column label */
  suggestedLabel: string
}

// ── Normalisation helpers ─────────────────────────────────────────

/**
 * Strip diacritics, lowercase, remove all non-alphanumeric chars.
 * Used to compare raw Excel headers against existing ColumnConfig keys
 * so that e.g. "VALOR SEM IVA" matches key "valorSemIva".
 */
function normalizeForComparison(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Convert a raw header string into a valid camelCase key.
 * e.g. "Data Pedido" → "dataPedido", "VALOR EMISSÃO" → "valorEmissao"
 */
function headerToKey(header: string): string {
  const stripped = header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  const parts = stripped.split(/[\s/\-_]+/).filter(Boolean)

  return parts
    .map((part, i) => {
      const lower = part.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (!lower) return ''
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .filter(Boolean)
    .join('')
}

/**
 * Title-case each word for a human-friendly column label.
 * e.g. "DATA PEDIDO" → "Data Pedido"
 */
function headerToLabel(header: string): string {
  return header
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

// ── Discovery function ────────────────────────────────────────────

/**
 * Given a list of raw Excel header names and a module, returns
 * the headers that do NOT match any existing ColumnConfig key.
 *
 * Matching is "fuzzy-normalized": both the header and the key are
 * stripped of accents, lowercased, and non-alphanumeric chars removed
 * before comparison. This ensures "PROCESSO" matches key "processo",
 * "VALOR SEM IVA" matches "valorSemIva", etc.
 */
export async function discoverImportColumns(
  prisma: PrismaClient,
  module: string,
  headers: string[],
): Promise<DiscoveredColumn[]> {
  // Fetch all existing ColumnConfig keys for this module (all views)
  const existingColumns = await prisma.columnConfig.findMany({
    where: { module },
    select: { key: true },
  })

  // Build normalised set for fuzzy comparison
  const existingNormalized = new Set(
    existingColumns.map((col) => normalizeForComparison(col.key)),
  )

  // Raw key set for suggestedKey uniqueness check
  const existingKeys = new Set(existingColumns.map((col) => col.key))

  const discovered: DiscoveredColumn[] = []
  const seenNormalized = new Set<string>()

  for (const header of headers) {
    const trimmed = header.trim()
    if (!trimmed) continue

    const normalized = normalizeForComparison(trimmed)
    if (!normalized) continue

    // Skip headers that match an existing column key
    if (existingNormalized.has(normalized)) continue

    // Skip duplicates within the same discovery batch
    if (seenNormalized.has(normalized)) continue
    seenNormalized.add(normalized)

    let suggestedKey = headerToKey(trimmed)

    // Ensure the suggested key doesn't collide with an existing key
    if (existingKeys.has(suggestedKey)) {
      suggestedKey = `custom_${suggestedKey}`
    }

    // Skip if the generated key is empty or too short
    if (!suggestedKey || suggestedKey.length < 2) continue

    discovered.push({
      header: trimmed,
      suggestedKey,
      suggestedLabel: headerToLabel(trimmed),
    })
  }

  return discovered
}

// ── Custom fields extraction ─────────────────────────────────────

/**
 * Fetch all custom ColumnConfig keys for a module.
 * Returns an empty array if no custom columns exist.
 */
export async function getCustomColumnKeys(
  prisma: PrismaClient,
  module: string,
): Promise<string[]> {
  const rows = await prisma.columnConfig.findMany({
    where: { module, isCustom: true },
    select: { key: true },
  })
  return rows.map((r) => r.key)
}

/**
 * Given a raw import row and a list of custom column keys,
 * returns a JSON object containing the custom field values
 * that are present in the row. Returns `undefined` when empty
 * so Prisma skips the field entirely.
 */
export function extractCustomFields(
  raw: Record<string, unknown>,
  customKeys: string[],
): Record<string, unknown> | undefined {
  if (customKeys.length === 0) return undefined

  const fields: Record<string, unknown> = {}
  let hasAny = false

  for (const key of customKeys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
      fields[key] = raw[key]
      hasAny = true
    }
  }

  return hasAny ? fields : undefined
}
