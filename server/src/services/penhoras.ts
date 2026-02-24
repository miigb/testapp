import { Prisma, type PrismaClient, type PenhorasStatus } from '@prisma/client'
import { z } from 'zod'

import { penhorasRecordPatchSchema } from '../schemas/penhoras'
import { normalizeText, toIsoDateOrUndefined, toNumberOrUndefined } from '../utils'
import { normalizeStatusToken, penhorasStatusDto, queryValue, toDateOrNull } from './shared'
import { DEFAULT_PENHORAS_STATUSES } from '../defaults'

const PENHORAS_LEGEND_ACTO_VALUES = [
  'LEGENDA',
  'LEGENDA:',
  'REGISTADOS',
  'RECUSADOS/DESISTENCIA',
  'RECUSADOS / DESISTENCIA',
  'AGUARDA REGISTO',
  'ATRASADOS - FEITOS REFORCOS A CADA 10 DIAS',
  'ATRASADOS - FEITOS REFORÇOS A CADA 10 DIAS',
] as const

const PENHORAS_LEGEND_ACTO_NORMALIZED = new Set(
  PENHORAS_LEGEND_ACTO_VALUES.map((value) => normalizeText(value).replace(/\s+/g, ' ').trim()),
)

let penhorasDataMaintenancePromise: Promise<void> | null = null

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function isPlaceholderToken(value: string | undefined): boolean {
  if (!value) return true
  const normalized = normalizeWhitespace(value)
  return normalized === '' || normalized === '-' || normalized === '--' || normalized === '\u2014'
}

function normalizePenhorasTextInput(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const normalized = normalizeWhitespace(String(value))
  return isPlaceholderToken(normalized) ? undefined : normalized
}

function normalizePenhorasGestorInput(value: unknown): string | undefined {
  const normalized = normalizePenhorasTextInput(value)
  return normalized ? normalized.toUpperCase() : undefined
}

function isLegendPenhorasActo(value: string | undefined): boolean {
  if (!value) return false
  const normalized = normalizeText(value).replace(/\s+/g, ' ').trim()
  return PENHORAS_LEGEND_ACTO_NORMALIZED.has(normalized)
}

export function isLegendPenhorasRow(input: Pick<PenhorasInputData, 'pe' | 'acto' | 'identificacao' | 'pedido' | 'gestor' | 'dataPedido'>): boolean {
  if (!isLegendPenhorasActo(input.acto)) return false
  return (
    isPlaceholderToken(input.pe) &&
    isPlaceholderToken(input.identificacao) &&
    isPlaceholderToken(input.pedido) &&
    isPlaceholderToken(input.gestor) &&
    !input.dataPedido
  )
}

export async function runPenhorasDataMaintenance(prisma: PrismaClient) {
  const legendTokens = [...new Set(PENHORAS_LEGEND_ACTO_VALUES.map((value) => normalizeWhitespace(value).toUpperCase()))]

  await prisma.$executeRaw`
    DELETE FROM "PenhorasRecord"
    WHERE "dataPedido" IS NULL
      AND COALESCE(NULLIF(TRIM("pe"), ''), '-') IN ('-', '--', '\u2014')
      AND COALESCE(NULLIF(TRIM("identificacao"), ''), '-') IN ('-', '--', '\u2014')
      AND COALESCE(NULLIF(TRIM("pedido"), ''), '-') IN ('-', '--', '\u2014')
      AND COALESCE(NULLIF(TRIM("gestor"), ''), '-') IN ('-', '--', '\u2014')
      AND UPPER(REGEXP_REPLACE(COALESCE(TRIM("acto"), ''), '\s+', ' ', 'g')) IN (${Prisma.join(legendTokens)})
  `

  await prisma.$executeRaw`
    UPDATE "PenhorasRecord"
    SET "gestor" = NULL
    WHERE "gestor" IS NOT NULL
      AND TRIM("gestor") IN ('-', '--', '\u2014')
  `

  await prisma.$executeRaw`
    UPDATE "PenhorasRecord"
    SET "gestor" = UPPER(REGEXP_REPLACE(TRIM("gestor"), '\s+', ' ', 'g'))
    WHERE "gestor" IS NOT NULL
      AND TRIM("gestor") <> ''
      AND UPPER(REGEXP_REPLACE(TRIM("gestor"), '\s+', ' ', 'g')) <> "gestor"
  `
}

export async function ensurePenhorasDefaults(prisma: PrismaClient) {
  if (!penhorasDataMaintenancePromise) {
    penhorasDataMaintenancePromise = runPenhorasDataMaintenance(prisma).catch((error) => {
      penhorasDataMaintenancePromise = null
      throw error
    })
  }
  await penhorasDataMaintenancePromise

  for (const status of DEFAULT_PENHORAS_STATUSES) {
    await prisma.penhorasStatus.upsert({
      where: { key: status.key },
      update: {
        label: status.label,
        icon: status.icon,
        color: status.color,
        active: status.active,
        order: status.order,
      },
      create: status,
    })
  }

  let statuses = await prisma.penhorasStatus.findMany({ orderBy: [{ order: 'asc' }, { label: 'asc' }] })
  const statusByKey = new Map(statuses.map((status) => [status.key, status.id]))

  const legacyPenhorasMap: Record<string, string> = {
    'penhoras-penhora-efetuada': 'penhoras-registados',
    'penhoras-cancelamento': 'penhoras-recusados-desistencia',
    'penhoras-sem-estado': 'penhoras-aguarda-registo',
  }

  let legacyChanged = false
  for (const [legacyKey, targetKey] of Object.entries(legacyPenhorasMap)) {
    const legacy = statuses.find((status) => status.key === legacyKey)
    const targetId = statusByKey.get(targetKey)
    if (!legacy || !targetId || legacy.id === targetId) {
      continue
    }

    await prisma.penhorasRecord.updateMany({
      where: { statusId: legacy.id },
      data: { statusId: targetId },
    })

    await prisma.penhorasStatus.update({
      where: { id: legacy.id },
      data: {
        active: false,
        order: 9990,
      },
    })

    legacyChanged = true
  }

  if (legacyChanged) {
    statuses = await prisma.penhorasStatus.findMany({ orderBy: [{ order: 'asc' }, { label: 'asc' }] })
  }

  return {
    statuses,
    statusByKey: new Map(statuses.map((status) => [status.key, status.id])),
  }
}

export type PenhorasDefaults = Awaited<ReturnType<typeof ensurePenhorasDefaults>>

export function getDefaultPenhorasStatusId(defaults: PenhorasDefaults): string | undefined {
  return (
    defaults.statusByKey.get('penhoras-aguarda-registo') ??
    defaults.statusByKey.get('penhoras-registados') ??
    defaults.statuses[0]?.id
  )
}

export function derivePenhorasStatusFromToken(normalizedToken: string, defaults: PenhorasDefaults): string | undefined {
  if (!normalizedToken) return undefined

  if (normalizedToken.includes('RECUS') || normalizedToken.includes('DESIST')) {
    return defaults.statusByKey.get('penhoras-recusados-desistencia')
  }

  if (normalizedToken.includes('ATRASAD') || normalizedToken.includes('REFORC')) {
    return defaults.statusByKey.get('penhoras-atrasados-reforcos-10-dias')
  }

  if (normalizedToken.includes('AGUARDA') && normalizedToken.includes('REGIST')) {
    return defaults.statusByKey.get('penhoras-aguarda-registo')
  }

  if (normalizedToken.includes('REGISTAD')) {
    return defaults.statusByKey.get('penhoras-registados')
  }

  // Compatibility with legacy status naming.
  if (normalizedToken.includes('CANCELAMENTO')) {
    return defaults.statusByKey.get('penhoras-recusados-desistencia')
  }
  if (normalizedToken.includes('PENHORA')) {
    return defaults.statusByKey.get('penhoras-registados')
  }
  if (normalizedToken.includes('SEM ESTADO')) {
    return defaults.statusByKey.get('penhoras-aguarda-registo')
  }

  return undefined
}

export function resolvePenhorasStatusId(
  rawStatus: string | undefined,
  defaults: PenhorasDefaults,
  fallbackStatusId: string,
  context?: Pick<PenhorasInputData, 'acto'>,
): string {
  if (!rawStatus) {
    const fromActo = derivePenhorasStatusFromToken(normalizeStatusToken(context?.acto), defaults)
    return fromActo ?? fallbackStatusId
  }

  if (defaults.statuses.some((status) => status.id === rawStatus)) {
    return rawStatus
  }

  const normalized = normalizeStatusToken(rawStatus)
  if (!normalized) return fallbackStatusId

  const byKey = defaults.statuses.find((status) => normalizeStatusToken(status.key) === normalized)
  if (byKey) return byKey.id

  const byLabel = defaults.statuses.find((status) => normalizeStatusToken(status.label) === normalized)
  if (byLabel) return byLabel.id

  return derivePenhorasStatusFromToken(normalized, defaults) ?? fallbackStatusId
}

export type PenhorasInputData = {
  pe?: string
  acto?: string
  dataPedido?: string
  identificacao?: string
  pedido?: string
  gestor?: string
  sourceFile?: string
  sourceSheet?: string
  sourceRowNumber?: number
  importBatchId?: string
  rawPayload?: Record<string, unknown>
  statusId?: string
}

export function asPenhorasRecordInput(raw: Record<string, unknown>): PenhorasInputData | null {
  const dataPedido = toIsoDateOrUndefined(raw.dataPedido)
  const pe = normalizePenhorasTextInput(raw.pe)
  const acto = normalizePenhorasTextInput(raw.acto)
  const identificacao = normalizePenhorasTextInput(raw.identificacao)
  const pedido = normalizePenhorasTextInput(raw.pedido)
  const gestor = normalizePenhorasGestorInput(raw.gestor)

  if (isLegendPenhorasRow({ pe, acto, identificacao, pedido, gestor, dataPedido })) {
    return null
  }

  if (!pe && !acto && !identificacao && !dataPedido) {
    return null
  }

  return {
    pe,
    acto,
    dataPedido,
    identificacao,
    pedido,
    gestor,
    sourceFile: normalizePenhorasTextInput(raw.sourceFile),
    sourceSheet: normalizePenhorasTextInput(raw.sourceSheet),
    sourceRowNumber: toNumberOrUndefined(raw.sourceRowNumber),
    importBatchId: normalizePenhorasTextInput(raw.importBatchId),
    rawPayload: raw,
    statusId: normalizePenhorasTextInput(raw.statusId) ?? normalizePenhorasTextInput(raw.estadoId),
  }
}

export function toPrismaPenhorasRecordData(input: PenhorasInputData): Prisma.PenhorasRecordUncheckedCreateInput {
  const normalizedGestor = normalizePenhorasGestorInput(input.gestor)
  return {
    pe: input.pe ?? null,
    acto: input.acto ?? null,
    dataPedido: toDateOrNull(input.dataPedido),
    identificacao: input.identificacao ?? null,
    pedido: input.pedido ?? null,
    gestor: normalizedGestor ?? null,
    sourceFile: input.sourceFile ?? null,
    sourceSheet: input.sourceSheet ?? null,
    sourceRowNumber: typeof input.sourceRowNumber === 'number' ? Math.round(input.sourceRowNumber) : null,
    importBatchId: input.importBatchId ?? null,
    rawPayload: input.rawPayload ?? undefined,
    statusId: input.statusId ?? '',
  }
}

export function prismaPenhorasRecordToDto(record: {
  id: string
  pe: string | null
  acto: string | null
  dataPedido: Date | null
  identificacao: string | null
  pedido: string | null
  gestor: string | null
  sourceFile: string | null
  sourceSheet: string | null
  sourceRowNumber: number | null
  importBatchId: string | null
  rawPayload: Prisma.JsonValue | null
  statusId: string
  createdAt: Date
  updatedAt: Date
  status?: PenhorasStatus
}) {
  return {
    id: record.id,
    pe: record.pe ?? undefined,
    acto: record.acto ?? undefined,
    dataPedido: record.dataPedido ? record.dataPedido.toISOString().slice(0, 10) : undefined,
    identificacao: record.identificacao ?? undefined,
    pedido: record.pedido ?? undefined,
    gestor: record.gestor ?? undefined,
    sourceFile: record.sourceFile ?? undefined,
    sourceSheet: record.sourceSheet ?? undefined,
    sourceRowNumber: record.sourceRowNumber ?? undefined,
    importBatchId: record.importBatchId ?? undefined,
    rawPayload: (record.rawPayload as Record<string, unknown> | undefined) ?? undefined,
    statusId: record.statusId,
    estadoId: record.statusId,
    status: record.status ? penhorasStatusDto(record.status) : undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export function buildPenhorasRecordKey(record: Pick<PenhorasInputData, 'pe' | 'acto' | 'dataPedido' | 'identificacao' | 'pedido' | 'gestor'>): string {
  return [
    normalizeText(record.pe),
    normalizeText(record.acto),
    record.dataPedido ?? '',
    normalizeText(record.identificacao),
    normalizeText(record.pedido),
    normalizeText(record.gestor),
  ].join('|')
}

export function buildPenhorasRecordWhere(query: Record<string, unknown>): Prisma.PenhorasRecordWhereInput {
  const where: Prisma.PenhorasRecordWhereInput = {}

  const textQuery = queryValue(query, 'q')?.trim()
  if (textQuery) {
    where.OR = [
      { pe: { contains: textQuery, mode: 'insensitive' } },
      { acto: { contains: textQuery, mode: 'insensitive' } },
      { identificacao: { contains: textQuery, mode: 'insensitive' } },
      { pedido: { contains: textQuery, mode: 'insensitive' } },
      { gestor: { contains: textQuery, mode: 'insensitive' } },
    ]
  }

  const estadoId = queryValue(query, 'estadoId')?.trim()
  if (estadoId) {
    where.status = {
      is: {
        OR: [{ id: estadoId }, { key: { equals: estadoId, mode: 'insensitive' } }, { label: { equals: estadoId, mode: 'insensitive' } }],
      },
    }
  }

  const gestor = queryValue(query, 'gestor')?.trim()
  if (gestor) where.gestor = { contains: gestor, mode: 'insensitive' }

  const acto = queryValue(query, 'acto')?.trim()
  if (acto) where.acto = { contains: acto, mode: 'insensitive' }

  const ano = Number(queryValue(query, 'ano'))
  const mes = Number(queryValue(query, 'mes'))
  if (Number.isFinite(ano) && ano > 2000) {
    if (Number.isFinite(mes) && mes >= 1 && mes <= 12) {
      where.dataPedido = {
        gte: new Date(Date.UTC(ano, mes - 1, 1)),
        lt: new Date(Date.UTC(ano, mes, 1)),
      }
    } else {
      where.dataPedido = {
        gte: new Date(Date.UTC(ano, 0, 1)),
        lt: new Date(Date.UTC(ano + 1, 0, 1)),
      }
    }
  }

  return where
}

export type PrismaCurrentPenhorasRecord = {
  id: string
  pe: string | null
  acto: string | null
  dataPedido: Date | null
  identificacao: string | null
  pedido: string | null
  gestor: string | null
  sourceFile: string | null
  sourceSheet: string | null
  sourceRowNumber: number | null
  importBatchId: string | null
  rawPayload: Prisma.JsonValue | null
  statusId: string
}

export function mergePenhorasRecordWithPatch(
  current: PrismaCurrentPenhorasRecord,
  patch: z.infer<typeof penhorasRecordPatchSchema>,
): PenhorasInputData {
  const currentAsInput: PenhorasInputData = {
    pe: current.pe ?? undefined,
    acto: current.acto ?? undefined,
    dataPedido: current.dataPedido ? current.dataPedido.toISOString().slice(0, 10) : undefined,
    identificacao: current.identificacao ?? undefined,
    pedido: current.pedido ?? undefined,
    gestor: current.gestor ?? undefined,
    sourceFile: current.sourceFile ?? undefined,
    sourceSheet: current.sourceSheet ?? undefined,
    sourceRowNumber: current.sourceRowNumber ?? undefined,
    importBatchId: current.importBatchId ?? undefined,
    rawPayload: (current.rawPayload as Record<string, unknown> | undefined) ?? undefined,
    statusId: current.statusId,
  }

  const merged = { ...currentAsInput, ...patch }
  merged.pe = normalizePenhorasTextInput(merged.pe)
  merged.acto = normalizePenhorasTextInput(merged.acto)
  merged.identificacao = normalizePenhorasTextInput(merged.identificacao)
  merged.pedido = normalizePenhorasTextInput(merged.pedido)
  merged.gestor = normalizePenhorasGestorInput(merged.gestor)
  merged.sourceFile = normalizePenhorasTextInput(merged.sourceFile)
  merged.sourceSheet = normalizePenhorasTextInput(merged.sourceSheet)
  merged.importBatchId = normalizePenhorasTextInput(merged.importBatchId)
  merged.statusId = normalizePenhorasTextInput(merged.statusId)
  merged.dataPedido = toIsoDateOrUndefined(merged.dataPedido)
  return merged
}

export { penhorasStatusDto }
