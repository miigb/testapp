import 'dotenv/config'

import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Prisma, PrismaClient, type DsStatus, type PenhorasStatus } from '@prisma/client'
import { z } from 'zod'

import { createCorsMiddleware } from './middleware/cors'
import { createErrorHandler } from './middleware/errorHandler'
import { aiRouter } from './routes/ai'
import { createRecordsRouter } from './routes/records'

import { DEFAULT_DS_STATUSES, DEFAULT_PENHORAS_STATUSES } from './defaults'
import {
  saveViewSchema,
  taxRuleSchema,
  calculationSettingsSchema,
  statusSchema,
} from './schemas/records'
import {
  dsRecordInputSchema,
  dsRecordPatchSchema,
  dsImportPreviewSchema,
  dsImportCommitSchema,
} from './schemas/ds'
import {
  penhorasRecordInputSchema,
  penhorasRecordPatchSchema,
  penhorasImportPreviewSchema,
  penhorasImportCommitSchema,
} from './schemas/penhoras'
import {
  buildUniqueRecordKey,
  normalizeText,
  toIsoDateOrUndefined,
  toNumberOrUndefined,
  toPrismaRecordData,
} from './utils'
import {
  databaseSetupHint,
  statusDto,
  dsStatusDto,
  penhorasStatusDto,
  savedViewDto,
  normalizeStatusToken,
  toApiTaxRule,
  parseLooseNumber,
  detectDsIvaKind,
  toDateOrNull,
  queryValue,
} from './services/shared'
import { ensureDefaults, asRecordInput } from './services/records'

// Fail fast in production when required env vars are missing
if (process.env.NODE_ENV === 'production') {
  const required = ['DATABASE_URL']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }
}

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 4000)

const app = express()
const prisma = new PrismaClient()

app.use(createCorsMiddleware())
app.use(express.json({ limit: '30mb' }))

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
  return normalized === '' || normalized === '-' || normalized === '--' || normalized === '—'
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

function isLegendPenhorasRow(input: Pick<PenhorasInputData, 'pe' | 'acto' | 'identificacao' | 'pedido' | 'gestor' | 'dataPedido'>): boolean {
  if (!isLegendPenhorasActo(input.acto)) return false
  return (
    isPlaceholderToken(input.pe) &&
    isPlaceholderToken(input.identificacao) &&
    isPlaceholderToken(input.pedido) &&
    isPlaceholderToken(input.gestor) &&
    !input.dataPedido
  )
}

async function runPenhorasDataMaintenance() {
  const legendTokens = [...new Set(PENHORAS_LEGEND_ACTO_VALUES.map((value) => normalizeWhitespace(value).toUpperCase()))]

  await prisma.$executeRaw`
    DELETE FROM "PenhorasRecord"
    WHERE "dataPedido" IS NULL
      AND COALESCE(NULLIF(TRIM("pe"), ''), '-') IN ('-', '--', '—')
      AND COALESCE(NULLIF(TRIM("identificacao"), ''), '-') IN ('-', '--', '—')
      AND COALESCE(NULLIF(TRIM("pedido"), ''), '-') IN ('-', '--', '—')
      AND COALESCE(NULLIF(TRIM("gestor"), ''), '-') IN ('-', '--', '—')
      AND UPPER(REGEXP_REPLACE(COALESCE(TRIM("acto"), ''), '\s+', ' ', 'g')) IN (${Prisma.join(legendTokens)})
  `

  await prisma.$executeRaw`
    UPDATE "PenhorasRecord"
    SET "gestor" = NULL
    WHERE "gestor" IS NOT NULL
      AND TRIM("gestor") IN ('-', '--', '—')
  `

  await prisma.$executeRaw`
    UPDATE "PenhorasRecord"
    SET "gestor" = UPPER(REGEXP_REPLACE(TRIM("gestor"), '\s+', ' ', 'g'))
    WHERE "gestor" IS NOT NULL
      AND TRIM("gestor") <> ''
      AND UPPER(REGEXP_REPLACE(TRIM("gestor"), '\s+', ' ', 'g')) <> "gestor"
  `
}

async function ensureDsDefaults() {
  for (const status of DEFAULT_DS_STATUSES) {
    await prisma.dsStatus.upsert({
      where: { key: status.key },
      update: {
        label: status.label,
        icon: status.icon,
        color: status.color,
      },
      create: status,
    })
  }

  const statuses = await prisma.dsStatus.findMany({ orderBy: [{ order: 'asc' }, { label: 'asc' }] })
  return {
    statuses,
    statusByKey: new Map(statuses.map((status) => [status.key, status.id])),
  }
}

async function ensurePenhorasDefaults() {
  if (!penhorasDataMaintenancePromise) {
    penhorasDataMaintenancePromise = runPenhorasDataMaintenance().catch((error) => {
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

type DsDefaults = Awaited<ReturnType<typeof ensureDsDefaults>>
type PenhorasDefaults = Awaited<ReturnType<typeof ensurePenhorasDefaults>>

function getDefaultDsStatusId(defaults: DsDefaults): string | undefined {
  return (
    defaults.statusByKey.get('ds-sem-estado') ??
    defaults.statusByKey.get('ds-falta-recibo-gestora') ??
    defaults.statuses[0]?.id
  )
}

function resolveDsStatusId(
  rawStatus: string | undefined,
  defaults: DsDefaults,
  fallbackStatusId: string,
  context?: Pick<DsInputData, 'faltaReciboGestora' | 'recibo'>,
): string {
  if (!rawStatus) {
    if (!context?.recibo?.trim()) {
      return defaults.statusByKey.get('ds-falta-recibo-gestora') ?? fallbackStatusId
    }
    return defaults.statusByKey.get('ds-pagas-banco-comissao-gestora') ?? fallbackStatusId
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

  if (normalized.includes('AGUARDA') && normalized.includes('PAGAMENTO')) {
    return defaults.statusByKey.get('ds-aguarda-pagamento-banco') ?? fallbackStatusId
  }
  if (normalized.includes('FALTA') && normalized.includes('RECIBO')) {
    return defaults.statusByKey.get('ds-falta-recibo-gestora') ?? fallbackStatusId
  }
  if (normalized.includes('PAGAS PELO BANCO') || normalized.includes('COMISSAO PAGA GESTORA') || normalized.includes('PAGA GESTORA')) {
    return defaults.statusByKey.get('ds-pagas-banco-comissao-gestora') ?? fallbackStatusId
  }

  return fallbackStatusId
}

function getDefaultPenhorasStatusId(defaults: PenhorasDefaults): string | undefined {
  return (
    defaults.statusByKey.get('penhoras-aguarda-registo') ??
    defaults.statusByKey.get('penhoras-registados') ??
    defaults.statuses[0]?.id
  )
}

function derivePenhorasStatusFromToken(normalizedToken: string, defaults: PenhorasDefaults): string | undefined {
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

function resolvePenhorasStatusId(
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

type DsInputData = {
  gestora?: string
  proponentes?: string
  referencia?: string
  produto?: string
  entidadeBancaria?: string
  liderCalculo?: string
  recibo?: string
  faltaReciboGestora?: string
  valorRaw?: string
  valor?: number
  dataEscritura?: string
  dataFechoCrm?: string
  comissaoLojaRaw?: string
  comissaoLoja?: number
  ivaCgdRaw?: string
  ivaCgdValor?: number
  ivaCgdKind?: 'sem_iva' | 'total_levantado' | 'valor' | 'outro'
  totalComissaoLojaCmIvaRaw?: string
  totalComissaoLojaCmIva?: number
  comissaoGestorRaw?: string
  comissaoGestor?: number
  percentagemRaw?: string
  percentagem?: number
  pagComissaoGestor?: string
  sourceFile?: string
  sourceSheet?: string
  sourceRowNumber?: number
  importBatchId?: string
  rawPayload?: Record<string, unknown>
  statusId?: string
}

function asDsRecordInput(raw: Record<string, unknown>): DsInputData | null {
  const text = (value: unknown) => {
    if (value === null || value === undefined) return undefined
    const normalized = String(value).trim()
    return normalized || undefined
  }

  const dataEscritura = toIsoDateOrUndefined(raw.dataEscritura)
  const referencia = text(raw.referencia)
  const proponentes = text(raw.proponentes)

  if (!dataEscritura && !referencia && !proponentes) {
    return null
  }

  const ivaRaw = text(raw.ivaCgdRaw) ?? text(raw['ivaCgd']) ?? text(raw['IVA CGD'])
  return {
    gestora: text(raw.gestora),
    proponentes,
    referencia,
    produto: text(raw.produto),
    entidadeBancaria: text(raw.entidadeBancaria),
    liderCalculo: text(raw.liderCalculo),
    recibo: text(raw.recibo),
    faltaReciboGestora: text(raw.faltaReciboGestora),
    valorRaw: text(raw.valorRaw) ?? text(raw.valor),
    valor: toNumberOrUndefined(raw.valor) ?? parseLooseNumber(raw.valorRaw),
    dataEscritura,
    dataFechoCrm: toIsoDateOrUndefined(raw.dataFechoCrm),
    comissaoLojaRaw: text(raw.comissaoLojaRaw) ?? text(raw.comissaoLoja),
    comissaoLoja: toNumberOrUndefined(raw.comissaoLoja) ?? parseLooseNumber(raw.comissaoLojaRaw),
    ivaCgdRaw: ivaRaw,
    ivaCgdValor: toNumberOrUndefined(raw.ivaCgdValor) ?? parseLooseNumber(ivaRaw),
    ivaCgdKind: (raw.ivaCgdKind as DsInputData['ivaCgdKind']) ?? detectDsIvaKind(ivaRaw),
    totalComissaoLojaCmIvaRaw: text(raw.totalComissaoLojaCmIvaRaw) ?? text(raw.totalComissaoLojaCmIva),
    totalComissaoLojaCmIva:
      toNumberOrUndefined(raw.totalComissaoLojaCmIva) ?? parseLooseNumber(raw.totalComissaoLojaCmIvaRaw),
    comissaoGestorRaw: text(raw.comissaoGestorRaw) ?? text(raw.comissaoGestor),
    comissaoGestor: toNumberOrUndefined(raw.comissaoGestor) ?? parseLooseNumber(raw.comissaoGestorRaw),
    percentagemRaw: text(raw.percentagemRaw) ?? text(raw.percentagem),
    percentagem: toNumberOrUndefined(raw.percentagem) ?? parseLooseNumber(raw.percentagemRaw),
    pagComissaoGestor: toIsoDateOrUndefined(raw.pagComissaoGestor),
    sourceFile: text(raw.sourceFile),
    sourceSheet: text(raw.sourceSheet),
    sourceRowNumber: toNumberOrUndefined(raw.sourceRowNumber),
    importBatchId: text(raw.importBatchId),
    rawPayload: raw,
    statusId: text(raw.statusId) ?? text(raw.estadoId),
  }
}

function toPrismaDsRecordData(input: DsInputData): Prisma.DsRecordUncheckedCreateInput {
  return {
    gestora: input.gestora ?? null,
    proponentes: input.proponentes ?? null,
    referencia: input.referencia ?? null,
    produto: input.produto ?? null,
    entidadeBancaria: input.entidadeBancaria ?? null,
    liderCalculo: input.liderCalculo ?? null,
    recibo: input.recibo ?? null,
    faltaReciboGestora: input.faltaReciboGestora ?? null,
    valorRaw: input.valorRaw ?? null,
    valor: typeof input.valor === 'number' ? input.valor : null,
    dataEscritura: toDateOrNull(input.dataEscritura),
    dataFechoCrm: toDateOrNull(input.dataFechoCrm),
    comissaoLojaRaw: input.comissaoLojaRaw ?? null,
    comissaoLoja: typeof input.comissaoLoja === 'number' ? input.comissaoLoja : null,
    ivaCgdRaw: input.ivaCgdRaw ?? null,
    ivaCgdValor: typeof input.ivaCgdValor === 'number' ? input.ivaCgdValor : null,
    ivaCgdKind: input.ivaCgdKind ?? null,
    totalComissaoLojaCmIvaRaw: input.totalComissaoLojaCmIvaRaw ?? null,
    totalComissaoLojaCmIva: typeof input.totalComissaoLojaCmIva === 'number' ? input.totalComissaoLojaCmIva : null,
    comissaoGestorRaw: input.comissaoGestorRaw ?? null,
    comissaoGestor: typeof input.comissaoGestor === 'number' ? input.comissaoGestor : null,
    percentagemRaw: input.percentagemRaw ?? null,
    percentagem: typeof input.percentagem === 'number' ? input.percentagem : null,
    pagComissaoGestor: toDateOrNull(input.pagComissaoGestor),
    sourceFile: input.sourceFile ?? null,
    sourceSheet: input.sourceSheet ?? null,
    sourceRowNumber: typeof input.sourceRowNumber === 'number' ? Math.round(input.sourceRowNumber) : null,
    importBatchId: input.importBatchId ?? null,
    rawPayload: input.rawPayload ?? undefined,
    statusId: input.statusId ?? '',
  }
}

function prismaDsRecordToDto(record: {
  id: string
  gestora: string | null
  proponentes: string | null
  referencia: string | null
  produto: string | null
  entidadeBancaria: string | null
  liderCalculo: string | null
  recibo: string | null
  faltaReciboGestora: string | null
  valorRaw: string | null
  valor: unknown
  dataEscritura: Date | null
  dataFechoCrm: Date | null
  comissaoLojaRaw: string | null
  comissaoLoja: unknown
  ivaCgdRaw: string | null
  ivaCgdValor: unknown
  ivaCgdKind: string | null
  totalComissaoLojaCmIvaRaw: string | null
  totalComissaoLojaCmIva: unknown
  comissaoGestorRaw: string | null
  comissaoGestor: unknown
  percentagemRaw: string | null
  percentagem: unknown
  pagComissaoGestor: Date | null
  sourceFile: string | null
  sourceSheet: string | null
  sourceRowNumber: number | null
  importBatchId: string | null
  rawPayload: Prisma.JsonValue | null
  statusId: string
  createdAt: Date
  updatedAt: Date
  status?: DsStatus
}) {
  const numeric = (value: unknown) => {
    if (value === null || value === undefined) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return {
    id: record.id,
    gestora: record.gestora ?? undefined,
    proponentes: record.proponentes ?? undefined,
    referencia: record.referencia ?? undefined,
    produto: record.produto ?? undefined,
    entidadeBancaria: record.entidadeBancaria ?? undefined,
    liderCalculo: record.liderCalculo ?? undefined,
    recibo: record.recibo ?? undefined,
    faltaReciboGestora: record.faltaReciboGestora ?? undefined,
    valorRaw: record.valorRaw ?? undefined,
    valor: numeric(record.valor),
    dataEscritura: record.dataEscritura ? record.dataEscritura.toISOString().slice(0, 10) : undefined,
    dataFechoCrm: record.dataFechoCrm ? record.dataFechoCrm.toISOString().slice(0, 10) : undefined,
    comissaoLojaRaw: record.comissaoLojaRaw ?? undefined,
    comissaoLoja: numeric(record.comissaoLoja),
    ivaCgdRaw: record.ivaCgdRaw ?? undefined,
    ivaCgdValor: numeric(record.ivaCgdValor),
    ivaCgdKind: record.ivaCgdKind ?? undefined,
    totalComissaoLojaCmIvaRaw: record.totalComissaoLojaCmIvaRaw ?? undefined,
    totalComissaoLojaCmIva: numeric(record.totalComissaoLojaCmIva),
    comissaoGestorRaw: record.comissaoGestorRaw ?? undefined,
    comissaoGestor: numeric(record.comissaoGestor),
    percentagemRaw: record.percentagemRaw ?? undefined,
    percentagem: numeric(record.percentagem),
    pagComissaoGestor: record.pagComissaoGestor ? record.pagComissaoGestor.toISOString().slice(0, 10) : undefined,
    sourceFile: record.sourceFile ?? undefined,
    sourceSheet: record.sourceSheet ?? undefined,
    sourceRowNumber: record.sourceRowNumber ?? undefined,
    importBatchId: record.importBatchId ?? undefined,
    rawPayload: (record.rawPayload as Record<string, unknown> | undefined) ?? undefined,
    statusId: record.statusId,
    estadoId: record.statusId,
    status: record.status ? dsStatusDto(record.status) : undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function buildDsRecordKey(record: Pick<DsInputData, 'gestora' | 'referencia' | 'dataEscritura' | 'proponentes' | 'produto' | 'valor'>): string {
  const primary = [normalizeText(record.gestora), normalizeText(record.referencia), record.dataEscritura ?? ''].join('|')
  if (primary.replace(/\|/g, '').trim()) return primary
  return [
    normalizeText(record.gestora),
    normalizeText(record.proponentes),
    normalizeText(record.produto),
    record.dataEscritura ?? '',
    typeof record.valor === 'number' ? record.valor.toFixed(2) : '',
  ].join('|')
}

function buildDsRecordWhere(query: Record<string, unknown>): Prisma.DsRecordWhereInput {
  const where: Prisma.DsRecordWhereInput = {}

  const textQuery = queryValue(query, 'q')?.trim()
  if (textQuery) {
    where.OR = [
      { referencia: { contains: textQuery, mode: 'insensitive' } },
      { proponentes: { contains: textQuery, mode: 'insensitive' } },
      { gestora: { contains: textQuery, mode: 'insensitive' } },
      { produto: { contains: textQuery, mode: 'insensitive' } },
      { entidadeBancaria: { contains: textQuery, mode: 'insensitive' } },
      { recibo: { contains: textQuery, mode: 'insensitive' } },
    ]
  }

  const estadoId = queryValue(query, 'estadoId')?.trim()
  if (estadoId) {
    where.status = {
      is: {
        OR: [
          { id: estadoId },
          { key: { equals: estadoId, mode: 'insensitive' } },
          { label: { equals: estadoId, mode: 'insensitive' } },
        ],
      },
    }
  }

  const gestora = queryValue(query, 'gestora')?.trim()
  if (gestora) where.gestora = { contains: gestora, mode: 'insensitive' }

  const entidade = queryValue(query, 'entidadeBancaria')?.trim()
  if (entidade) where.entidadeBancaria = { contains: entidade, mode: 'insensitive' }

  const produto = queryValue(query, 'produto')?.trim()
  if (produto) where.produto = { contains: produto, mode: 'insensitive' }

  const reciboEstado = queryValue(query, 'reciboEstado')?.trim()
  if (reciboEstado === 'com-recibo') where.recibo = { not: null }
  if (reciboEstado === 'sem-recibo') {
    where.AND = [...((where.AND as DsRecordWhereInput[]) ?? []), { OR: [{ recibo: null }, { recibo: '' }] }]
  }

  const ano = Number(queryValue(query, 'ano'))
  const mes = Number(queryValue(query, 'mes'))
  if (Number.isFinite(ano) && ano > 2000) {
    if (Number.isFinite(mes) && mes >= 1 && mes <= 12) {
      where.dataEscritura = {
        gte: new Date(Date.UTC(ano, mes - 1, 1)),
        lt: new Date(Date.UTC(ano, mes, 1)),
      }
    } else {
      where.dataEscritura = {
        gte: new Date(Date.UTC(ano, 0, 1)),
        lt: new Date(Date.UTC(ano + 1, 0, 1)),
      }
    }
  }

  return where
}

type PenhorasInputData = {
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

function asPenhorasRecordInput(raw: Record<string, unknown>): PenhorasInputData | null {
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

function toPrismaPenhorasRecordData(input: PenhorasInputData): Prisma.PenhorasRecordUncheckedCreateInput {
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

function prismaPenhorasRecordToDto(record: {
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

function buildPenhorasRecordKey(record: Pick<PenhorasInputData, 'pe' | 'acto' | 'dataPedido' | 'identificacao' | 'pedido' | 'gestor'>): string {
  return [
    normalizeText(record.pe),
    normalizeText(record.acto),
    record.dataPedido ?? '',
    normalizeText(record.identificacao),
    normalizeText(record.pedido),
    normalizeText(record.gestor),
  ].join('|')
}

function buildPenhorasRecordWhere(query: Record<string, unknown>): Prisma.PenhorasRecordWhereInput {
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

type PrismaCurrentDsRecord = {
  id: string
  gestora: string | null
  proponentes: string | null
  referencia: string | null
  produto: string | null
  entidadeBancaria: string | null
  liderCalculo: string | null
  recibo: string | null
  faltaReciboGestora: string | null
  valorRaw: string | null
  valor: unknown
  dataEscritura: Date | null
  dataFechoCrm: Date | null
  comissaoLojaRaw: string | null
  comissaoLoja: unknown
  ivaCgdRaw: string | null
  ivaCgdValor: unknown
  ivaCgdKind: 'sem_iva' | 'total_levantado' | 'valor' | 'outro' | null
  totalComissaoLojaCmIvaRaw: string | null
  totalComissaoLojaCmIva: unknown
  comissaoGestorRaw: string | null
  comissaoGestor: unknown
  percentagemRaw: string | null
  percentagem: unknown
  pagComissaoGestor: Date | null
  sourceFile: string | null
  sourceSheet: string | null
  sourceRowNumber: number | null
  importBatchId: string | null
  rawPayload: Prisma.JsonValue | null
  statusId: string
}

function mergeDsRecordWithPatch(current: PrismaCurrentDsRecord, patch: z.infer<typeof dsRecordPatchSchema>): DsInputData {
  const currentAsInput: DsInputData = {
    gestora: current.gestora ?? undefined,
    proponentes: current.proponentes ?? undefined,
    referencia: current.referencia ?? undefined,
    produto: current.produto ?? undefined,
    entidadeBancaria: current.entidadeBancaria ?? undefined,
    liderCalculo: current.liderCalculo ?? undefined,
    recibo: current.recibo ?? undefined,
    faltaReciboGestora: current.faltaReciboGestora ?? undefined,
    valorRaw: current.valorRaw ?? undefined,
    valor: toNumberOrUndefined(current.valor),
    dataEscritura: current.dataEscritura ? current.dataEscritura.toISOString().slice(0, 10) : undefined,
    dataFechoCrm: current.dataFechoCrm ? current.dataFechoCrm.toISOString().slice(0, 10) : undefined,
    comissaoLojaRaw: current.comissaoLojaRaw ?? undefined,
    comissaoLoja: toNumberOrUndefined(current.comissaoLoja),
    ivaCgdRaw: current.ivaCgdRaw ?? undefined,
    ivaCgdValor: toNumberOrUndefined(current.ivaCgdValor),
    ivaCgdKind: current.ivaCgdKind ?? undefined,
    totalComissaoLojaCmIvaRaw: current.totalComissaoLojaCmIvaRaw ?? undefined,
    totalComissaoLojaCmIva: toNumberOrUndefined(current.totalComissaoLojaCmIva),
    comissaoGestorRaw: current.comissaoGestorRaw ?? undefined,
    comissaoGestor: toNumberOrUndefined(current.comissaoGestor),
    percentagemRaw: current.percentagemRaw ?? undefined,
    percentagem: toNumberOrUndefined(current.percentagem),
    pagComissaoGestor: current.pagComissaoGestor ? current.pagComissaoGestor.toISOString().slice(0, 10) : undefined,
    sourceFile: current.sourceFile ?? undefined,
    sourceSheet: current.sourceSheet ?? undefined,
    sourceRowNumber: current.sourceRowNumber ?? undefined,
    importBatchId: current.importBatchId ?? undefined,
    rawPayload: (current.rawPayload as Record<string, unknown> | undefined) ?? undefined,
    statusId: current.statusId,
  }

  const merged = { ...currentAsInput, ...patch }
  merged.dataEscritura = toIsoDateOrUndefined(merged.dataEscritura)
  merged.dataFechoCrm = toIsoDateOrUndefined(merged.dataFechoCrm)
  merged.pagComissaoGestor = toIsoDateOrUndefined(merged.pagComissaoGestor)
  if (!merged.ivaCgdKind) {
    merged.ivaCgdKind = detectDsIvaKind(merged.ivaCgdRaw)
  }
  if (typeof merged.ivaCgdValor !== 'number') {
    merged.ivaCgdValor = parseLooseNumber(merged.ivaCgdRaw)
  }

  return merged
}

type PrismaCurrentPenhorasRecord = {
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

function mergePenhorasRecordWithPatch(
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

app.use('/api/ai', aiRouter)
app.use('/api', createRecordsRouter(prisma))

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, db: 'up', now: new Date().toISOString() })
  } catch {
    res.status(503).json({ ok: false, db: 'down', now: new Date().toISOString() })
  }
})

app.get('/api/ds/bootstrap', async (_req, res) => {
  try {
    const defaults = await ensureDsDefaults()
    const savedViews = await prisma.savedView.findMany({
      where: { scope: { startsWith: 'ds-' } },
      orderBy: { updatedAt: 'desc' },
    })
    const recordCount = await prisma.dsRecord.count()

    res.json({
      statuses: defaults.statuses.map(dsStatusDto),
      savedViews: savedViews.map(savedViewDto),
      recordCount,
    })
  } catch (error) {
    console.error(error)
    res.status(503).json({ error: databaseSetupHint() })
  }
})

app.get('/api/ds/records', async (req, res) => {
  const page = Number(req.query.page ?? 1)
  const pageSize = Math.min(Number(req.query.pageSize ?? 100), 300)
  const skip = Math.max(page - 1, 0) * pageSize

  const where = buildDsRecordWhere(req.query as Record<string, unknown>)

  const [items, total] = await Promise.all([
    prisma.dsRecord.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ dataEscritura: 'desc' }, { updatedAt: 'desc' }],
      include: { status: true },
    }),
    prisma.dsRecord.count({ where }),
  ])

  res.json({
    items: items.map(prismaDsRecordToDto),
    total,
    page,
    pageSize,
  })
})

app.get('/api/ds/records/:id', async (req, res) => {
  const record = await prisma.dsRecord.findUnique({
    where: { id: req.params.id },
    include: { status: true },
  })

  if (!record) {
    return res.status(404).json({ error: 'Registo DS não encontrado.' })
  }

  return res.json(prismaDsRecordToDto(record))
})

app.post('/api/ds/records', async (req, res) => {
  const parsed = dsRecordInputSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload DS inválido.', details: parsed.error.flatten() })
  }

  const defaults = await ensureDsDefaults()
  const fallbackStatusId = getDefaultDsStatusId(defaults)
  if (!fallbackStatusId) {
    return res.status(500).json({ error: 'Estado DS padrão indisponível.' })
  }

  const input = asDsRecordInput(parsed.data as Record<string, unknown>)
  if (!input) {
    return res.status(400).json({ error: 'Linha DS sem dados mínimos.' })
  }
  input.statusId = resolveDsStatusId(input.statusId, defaults, fallbackStatusId, input)

  const created = await prisma.dsRecord.create({
    data: toPrismaDsRecordData(input),
    include: { status: true },
  })

  return res.status(201).json(prismaDsRecordToDto(created))
})

app.patch('/api/ds/records/:id', async (req, res) => {
  const parsed = dsRecordPatchSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload DS inválido.', details: parsed.error.flatten() })
  }

  const current = await prisma.dsRecord.findUnique({
    where: { id: req.params.id },
  })
  if (!current) {
    return res.status(404).json({ error: 'Registo DS não encontrado.' })
  }

  const merged = mergeDsRecordWithPatch(current, parsed.data)
  if (!merged.statusId || typeof merged.statusId === 'string') {
    const defaults = await ensureDsDefaults()
    const fallbackStatusId = getDefaultDsStatusId(defaults)
    if (!fallbackStatusId) {
      return res.status(500).json({ error: 'Estado DS padrão indisponível.' })
    }
    merged.statusId = resolveDsStatusId(merged.statusId, defaults, fallbackStatusId, merged)
  }

  const updated = await prisma.dsRecord.update({
    where: { id: req.params.id },
    data: toPrismaDsRecordData(merged),
    include: { status: true },
  })

  return res.json(prismaDsRecordToDto(updated))
})

app.patch('/api/ds/records/:id/status', async (req, res) => {
  const body = z.object({ statusId: z.string().min(1) }).safeParse(req.body)
  if (!body.success) {
    return res.status(400).json({ error: 'Status DS inválido.' })
  }

  const old = await prisma.dsRecord.findUnique({ where: { id: req.params.id } })
  if (!old) {
    return res.status(404).json({ error: 'Registo DS não encontrado.' })
  }

  const defaults = await ensureDsDefaults()
  const fallbackStatusId = getDefaultDsStatusId(defaults)
  if (!fallbackStatusId) {
    return res.status(500).json({ error: 'Estado DS padrão indisponível.' })
  }
  const resolvedStatusId = resolveDsStatusId(body.data.statusId, defaults, fallbackStatusId)
  const statusExists = defaults.statuses.some((status) => status.id === resolvedStatusId)
  if (!statusExists) {
    return res.status(400).json({ error: 'Status DS inválido.' })
  }

  const updated = await prisma.dsRecord.update({
    where: { id: req.params.id },
    data: { statusId: resolvedStatusId },
    include: { status: true },
  })

  return res.json(prismaDsRecordToDto(updated))
})

app.get('/api/ds/statuses', async (_req, res) => {
  const defaults = await ensureDsDefaults()
  res.json(defaults.statuses.map(dsStatusDto))
})

app.post('/api/ds/statuses', async (req, res) => {
  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const created = await prisma.dsStatus.create({ data: parsed.data })
  res.status(201).json(dsStatusDto(created))
})

app.patch('/api/ds/statuses/:id', async (req, res) => {
  const parsed = statusSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const updated = await prisma.dsStatus.update({ where: { id: req.params.id }, data: parsed.data })
  res.json(dsStatusDto(updated))
})

app.delete('/api/ds/statuses/:id', async (req, res) => {
  const existingStatus = await prisma.dsStatus.findUnique({ where: { id: req.params.id } })
  if (!existingStatus) {
    return res.status(404).json({ error: 'Estado DS não encontrado.' })
  }

  const reassignToStatusId = typeof req.query.reassignToStatusId === 'string' ? req.query.reassignToStatusId.trim() : ''
  const dependencyCount = await prisma.dsRecord.count({ where: { statusId: req.params.id } })
  if (dependencyCount > 0) {
    if (!reassignToStatusId) {
      return res.status(409).json({ error: 'Estado DS em uso. Marque como inativo em vez de remover.' })
    }

    if (reassignToStatusId === req.params.id) {
      return res.status(400).json({ error: 'Estado DS de reatribuição inválido.' })
    }

    const targetStatus = await prisma.dsStatus.findUnique({ where: { id: reassignToStatusId } })
    if (!targetStatus) {
      return res.status(404).json({ error: 'Estado DS de reatribuição não encontrado.' })
    }

    await prisma.$transaction([
      prisma.dsRecord.updateMany({
        where: { statusId: req.params.id },
        data: { statusId: reassignToStatusId },
      }),
      prisma.dsStatus.delete({ where: { id: req.params.id } }),
    ])

    return res.json({ ok: true, reassigned: dependencyCount })
  }

  await prisma.dsStatus.delete({ where: { id: req.params.id } })
  return res.json({ ok: true })
})

app.post('/api/ds/import/preview', async (req, res) => {
  const parsed = dsImportPreviewSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload DS inválido.', details: parsed.error.flatten() })
  }

  const existing = await prisma.dsRecord.findMany({
    select: { id: true, gestora: true, referencia: true, dataEscritura: true, proponentes: true, produto: true, valor: true },
  })
  const existingByKey = new Map(
    existing.map((row) => [
      buildDsRecordKey({
        gestora: row.gestora ?? undefined,
        referencia: row.referencia ?? undefined,
        dataEscritura: row.dataEscritura ? row.dataEscritura.toISOString().slice(0, 10) : undefined,
        proponentes: row.proponentes ?? undefined,
        produto: row.produto ?? undefined,
        valor: toNumberOrUndefined(row.valor),
      }),
      row.id,
    ]),
  )

  const dsDefaults = await ensureDsDefaults()

  const items = parsed.data.rows.map((raw, index) => {
    const input = asDsRecordInput(raw)
    if (!input) {
      return { index, valid: false, action: 'error', reason: 'Linha DS sem dados mínimos.' }
    }

    const fallbackStatusId = getDefaultDsStatusId(dsDefaults)
    if (!fallbackStatusId) {
      return { index, valid: false, action: 'error', reason: 'Estado DS padrão indisponível.' }
    }
    const statusId = resolveDsStatusId(input.statusId, dsDefaults, fallbackStatusId, input)
    const key = buildDsRecordKey(input)
    const existingId = existingByKey.get(key)
    return {
      index,
      valid: true,
      key,
      statusId,
      conflict: Boolean(existingId),
      existingId,
      suggestedAction: existingId ? 'update' : 'create',
    }
  })

  const summary = {
    total: items.length,
    valid: items.filter((item) => item.valid).length,
    conflicts: items.filter((item) => item.valid && item.conflict).length,
    creates: items.filter((item) => item.valid && !item.conflict).length,
    invalid: items.filter((item) => !item.valid).length,
  }

  return res.json({ summary, items })
})

app.post('/api/ds/import/commit', async (req, res) => {
  const parsed = dsImportCommitSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload DS inválido.', details: parsed.error.flatten() })
  }

  const defaults = await ensureDsDefaults()
  const fallbackStatusId = getDefaultDsStatusId(defaults)
  if (!fallbackStatusId) {
    return res.status(500).json({ error: 'Estado DS padrão indisponível.' })
  }

  const importBatchId = `ds-${Date.now()}`
  const existing = await prisma.dsRecord.findMany({
    select: { id: true, gestora: true, referencia: true, dataEscritura: true, proponentes: true, produto: true, valor: true },
  })
  const existingByKey = new Map(
    existing.map((row) => [
      buildDsRecordKey({
        gestora: row.gestora ?? undefined,
        referencia: row.referencia ?? undefined,
        dataEscritura: row.dataEscritura ? row.dataEscritura.toISOString().slice(0, 10) : undefined,
        proponentes: row.proponentes ?? undefined,
        produto: row.produto ?? undefined,
        valor: toNumberOrUndefined(row.valor),
      }),
      row.id,
    ]),
  )

  let created = 0
  let updated = 0
  let skipped = 0
  let invalid = 0
  let duplicatesCreated = 0
  let duplicateCounter = 1

  for (const raw of parsed.data.rows) {
    const input = asDsRecordInput(raw)
    if (!input) {
      invalid += 1
      continue
    }
    input.statusId = resolveDsStatusId(input.statusId, defaults, fallbackStatusId, input)
    input.importBatchId = input.importBatchId || importBatchId

    let key = buildDsRecordKey(input)
    const existingId = existingByKey.get(key)

    if (existingId) {
      if (parsed.data.strategy === 'skip') {
        skipped += 1
        continue
      }

      if (parsed.data.strategy === 'update') {
        await prisma.dsRecord.update({
          where: { id: existingId },
          data: toPrismaDsRecordData(input),
        })
        updated += 1
        continue
      }

      if (parsed.data.strategy === 'duplicate') {
        const baseReference = input.referencia || 'SEM-REF'
        while (existingByKey.has(key)) {
          duplicateCounter += 1
          input.referencia = `${baseReference}-dup-${duplicateCounter}`
          key = buildDsRecordKey(input)
        }
      }
    }

    const createdRow = await prisma.dsRecord.create({
      data: toPrismaDsRecordData(input),
      select: { id: true },
    })
    existingByKey.set(key, createdRow.id)
    created += 1
    if (existingId && parsed.data.strategy === 'duplicate') {
      duplicatesCreated += 1
    }
  }

  return res.json({
    ok: true,
    summary: {
      created,
      updated,
      skipped,
      invalid,
      duplicatesCreated,
      strategy: parsed.data.strategy,
    },
  })
})

app.get('/api/penhoras/bootstrap', async (_req, res) => {
  try {
    const defaults = await ensurePenhorasDefaults()
    const savedViews = await prisma.savedView.findMany({
      where: { scope: { startsWith: 'penhoras-' } },
      orderBy: { updatedAt: 'desc' },
    })
    const recordCount = await prisma.penhorasRecord.count()

    res.json({
      statuses: defaults.statuses.map(penhorasStatusDto),
      savedViews: savedViews.map(savedViewDto),
      recordCount,
    })
  } catch (error) {
    console.error(error)
    res.status(503).json({ error: databaseSetupHint() })
  }
})

app.get('/api/penhoras/records', async (req, res) => {
  const page = Number(req.query.page ?? 1)
  const pageSize = Math.min(Number(req.query.pageSize ?? 100), 300)
  const skip = Math.max(page - 1, 0) * pageSize

  const where = buildPenhorasRecordWhere(req.query as Record<string, unknown>)

  const [items, total] = await Promise.all([
    prisma.penhorasRecord.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ dataPedido: 'desc' }, { updatedAt: 'desc' }],
      include: { status: true },
    }),
    prisma.penhorasRecord.count({ where }),
  ])

  res.json({
    items: items.map(prismaPenhorasRecordToDto),
    total,
    page,
    pageSize,
  })
})

app.get('/api/penhoras/records/:id', async (req, res) => {
  const record = await prisma.penhorasRecord.findUnique({
    where: { id: req.params.id },
    include: { status: true },
  })

  if (!record) {
    return res.status(404).json({ error: 'Registo Penhoras não encontrado.' })
  }

  return res.json(prismaPenhorasRecordToDto(record))
})

app.post('/api/penhoras/records', async (req, res) => {
  const parsed = penhorasRecordInputSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload Penhoras inválido.', details: parsed.error.flatten() })
  }

  const defaults = await ensurePenhorasDefaults()
  const fallbackStatusId = getDefaultPenhorasStatusId(defaults)
  if (!fallbackStatusId) {
    return res.status(500).json({ error: 'Estado Penhoras padrão indisponível.' })
  }

  const input = asPenhorasRecordInput(parsed.data as Record<string, unknown>)
  if (!input) {
    return res.status(400).json({ error: 'Linha Penhoras sem dados mínimos.' })
  }
  input.statusId = resolvePenhorasStatusId(input.statusId, defaults, fallbackStatusId, input)

  const created = await prisma.penhorasRecord.create({
    data: toPrismaPenhorasRecordData(input),
    include: { status: true },
  })

  return res.status(201).json(prismaPenhorasRecordToDto(created))
})

app.patch('/api/penhoras/records/:id', async (req, res) => {
  const parsed = penhorasRecordPatchSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload Penhoras inválido.', details: parsed.error.flatten() })
  }

  const current = await prisma.penhorasRecord.findUnique({
    where: { id: req.params.id },
  })
  if (!current) {
    return res.status(404).json({ error: 'Registo Penhoras não encontrado.' })
  }

  const merged = mergePenhorasRecordWithPatch(current, parsed.data)
  if (!merged.statusId || typeof merged.statusId === 'string') {
    const defaults = await ensurePenhorasDefaults()
    const fallbackStatusId = getDefaultPenhorasStatusId(defaults)
    if (!fallbackStatusId) {
      return res.status(500).json({ error: 'Estado Penhoras padrão indisponível.' })
    }
    merged.statusId = resolvePenhorasStatusId(merged.statusId, defaults, fallbackStatusId, merged)
  }

  const updated = await prisma.penhorasRecord.update({
    where: { id: req.params.id },
    data: toPrismaPenhorasRecordData(merged),
    include: { status: true },
  })

  return res.json(prismaPenhorasRecordToDto(updated))
})

app.patch('/api/penhoras/records/:id/status', async (req, res) => {
  const body = z.object({ statusId: z.string().min(1) }).safeParse(req.body)
  if (!body.success) {
    return res.status(400).json({ error: 'Status Penhoras inválido.' })
  }

  const old = await prisma.penhorasRecord.findUnique({ where: { id: req.params.id } })
  if (!old) {
    return res.status(404).json({ error: 'Registo Penhoras não encontrado.' })
  }

  const defaults = await ensurePenhorasDefaults()
  const fallbackStatusId = getDefaultPenhorasStatusId(defaults)
  if (!fallbackStatusId) {
    return res.status(500).json({ error: 'Estado Penhoras padrão indisponível.' })
  }
  const resolvedStatusId = resolvePenhorasStatusId(body.data.statusId, defaults, fallbackStatusId)
  const statusExists = defaults.statuses.some((status) => status.id === resolvedStatusId)
  if (!statusExists) {
    return res.status(400).json({ error: 'Status Penhoras inválido.' })
  }

  const updated = await prisma.penhorasRecord.update({
    where: { id: req.params.id },
    data: { statusId: resolvedStatusId },
    include: { status: true },
  })

  return res.json(prismaPenhorasRecordToDto(updated))
})

app.get('/api/penhoras/statuses', async (_req, res) => {
  const defaults = await ensurePenhorasDefaults()
  res.json(defaults.statuses.map(penhorasStatusDto))
})

app.post('/api/penhoras/statuses', async (req, res) => {
  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const created = await prisma.penhorasStatus.create({ data: parsed.data })
  res.status(201).json(penhorasStatusDto(created))
})

app.patch('/api/penhoras/statuses/:id', async (req, res) => {
  const parsed = statusSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const updated = await prisma.penhorasStatus.update({ where: { id: req.params.id }, data: parsed.data })
  res.json(penhorasStatusDto(updated))
})

app.delete('/api/penhoras/statuses/:id', async (req, res) => {
  const existingStatus = await prisma.penhorasStatus.findUnique({ where: { id: req.params.id } })
  if (!existingStatus) {
    return res.status(404).json({ error: 'Estado Penhoras não encontrado.' })
  }

  const reassignToStatusId = typeof req.query.reassignToStatusId === 'string' ? req.query.reassignToStatusId.trim() : ''
  const dependencyCount = await prisma.penhorasRecord.count({ where: { statusId: req.params.id } })
  if (dependencyCount > 0) {
    if (!reassignToStatusId) {
      return res.status(409).json({ error: 'Estado Penhoras em uso. Marque como inativo em vez de remover.' })
    }

    if (reassignToStatusId === req.params.id) {
      return res.status(400).json({ error: 'Estado Penhoras de reatribuição inválido.' })
    }

    const targetStatus = await prisma.penhorasStatus.findUnique({ where: { id: reassignToStatusId } })
    if (!targetStatus) {
      return res.status(404).json({ error: 'Estado Penhoras de reatribuição não encontrado.' })
    }

    await prisma.$transaction([
      prisma.penhorasRecord.updateMany({
        where: { statusId: req.params.id },
        data: { statusId: reassignToStatusId },
      }),
      prisma.penhorasStatus.delete({ where: { id: req.params.id } }),
    ])

    return res.json({ ok: true, reassigned: dependencyCount })
  }

  await prisma.penhorasStatus.delete({ where: { id: req.params.id } })
  return res.json({ ok: true })
})

app.post('/api/penhoras/import/preview', async (req, res) => {
  const parsed = penhorasImportPreviewSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload Penhoras inválido.', details: parsed.error.flatten() })
  }

  const defaults = await ensurePenhorasDefaults()
  const fallbackStatusId = getDefaultPenhorasStatusId(defaults)
  if (!fallbackStatusId) {
    return res.status(500).json({ error: 'Estado Penhoras padrão indisponível.' })
  }

  const existing = await prisma.penhorasRecord.findMany({
    select: { id: true, pe: true, acto: true, dataPedido: true, identificacao: true, pedido: true, gestor: true },
  })
  const existingByKey = new Map(
    existing.map((row) => [
      buildPenhorasRecordKey({
        pe: row.pe ?? undefined,
        acto: row.acto ?? undefined,
        dataPedido: row.dataPedido ? row.dataPedido.toISOString().slice(0, 10) : undefined,
        identificacao: row.identificacao ?? undefined,
        pedido: row.pedido ?? undefined,
        gestor: row.gestor ?? undefined,
      }),
      row.id,
    ]),
  )

  const items = parsed.data.rows.map((raw, index) => {
    const input = asPenhorasRecordInput(raw)
    if (!input) {
      return { index, valid: false, action: 'error', reason: 'Linha Penhoras sem dados mínimos.' }
    }

    const statusId = resolvePenhorasStatusId(input.statusId, defaults, fallbackStatusId, input)
    const key = buildPenhorasRecordKey(input)
    const existingId = existingByKey.get(key)
    return {
      index,
      valid: true,
      key,
      statusId,
      conflict: Boolean(existingId),
      existingId,
      suggestedAction: existingId ? 'update' : 'create',
    }
  })

  const summary = {
    total: items.length,
    valid: items.filter((item) => item.valid).length,
    conflicts: items.filter((item) => item.valid && item.conflict).length,
    creates: items.filter((item) => item.valid && !item.conflict).length,
    invalid: items.filter((item) => !item.valid).length,
  }

  return res.json({ summary, items })
})

app.post('/api/penhoras/import/commit', async (req, res) => {
  const parsed = penhorasImportCommitSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload Penhoras inválido.', details: parsed.error.flatten() })
  }

  const defaults = await ensurePenhorasDefaults()
  const fallbackStatusId = getDefaultPenhorasStatusId(defaults)
  if (!fallbackStatusId) {
    return res.status(500).json({ error: 'Estado Penhoras padrão indisponível.' })
  }

  const importBatchId = `penhoras-${Date.now()}`
  const existing = await prisma.penhorasRecord.findMany({
    select: { id: true, pe: true, acto: true, dataPedido: true, identificacao: true, pedido: true, gestor: true },
  })
  const existingByKey = new Map(
    existing.map((row) => [
      buildPenhorasRecordKey({
        pe: row.pe ?? undefined,
        acto: row.acto ?? undefined,
        dataPedido: row.dataPedido ? row.dataPedido.toISOString().slice(0, 10) : undefined,
        identificacao: row.identificacao ?? undefined,
        pedido: row.pedido ?? undefined,
        gestor: row.gestor ?? undefined,
      }),
      row.id,
    ]),
  )

  let created = 0
  let updated = 0
  let skipped = 0
  let invalid = 0
  let duplicatesCreated = 0
  let duplicateCounter = 1

  for (const raw of parsed.data.rows) {
    const input = asPenhorasRecordInput(raw)
    if (!input) {
      invalid += 1
      continue
    }
    input.statusId = resolvePenhorasStatusId(input.statusId, defaults, fallbackStatusId, input)
    input.importBatchId = input.importBatchId || importBatchId

    let key = buildPenhorasRecordKey(input)
    const existingId = existingByKey.get(key)

    if (existingId) {
      if (parsed.data.strategy === 'skip') {
        skipped += 1
        continue
      }

      if (parsed.data.strategy === 'update') {
        await prisma.penhorasRecord.update({
          where: { id: existingId },
          data: toPrismaPenhorasRecordData(input),
        })
        updated += 1
        continue
      }

      if (parsed.data.strategy === 'duplicate') {
        const basePedido = input.pedido || String(Date.now())
        while (existingByKey.has(key)) {
          duplicateCounter += 1
          input.pedido = `${basePedido}-dup-${duplicateCounter}`
          key = buildPenhorasRecordKey(input)
        }
      }
    }

    const createdRow = await prisma.penhorasRecord.create({
      data: toPrismaPenhorasRecordData(input),
      select: { id: true },
    })
    existingByKey.set(key, createdRow.id)
    created += 1
    if (existingId && parsed.data.strategy === 'duplicate') {
      duplicatesCreated += 1
    }
  }

  return res.json({
    ok: true,
    summary: {
      created,
      updated,
      skipped,
      invalid,
      duplicatesCreated,
      strategy: parsed.data.strategy,
    },
  })
})

app.get('/api/statuses', async (_req, res) => {
  const defaults = await ensureDefaults(prisma)
  res.json(defaults.statuses.map(statusDto))
})

app.post('/api/statuses', async (req, res) => {
  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const created = await prisma.status.create({ data: parsed.data })
  res.status(201).json(statusDto(created))
})

app.patch('/api/statuses/:id', async (req, res) => {
  const parsed = statusSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const updated = await prisma.status.update({ where: { id: req.params.id }, data: parsed.data })
  res.json(statusDto(updated))
})

app.delete('/api/statuses/:id', async (req, res) => {
  const existingStatus = await prisma.status.findUnique({ where: { id: req.params.id } })
  if (!existingStatus) {
    return res.status(404).json({ error: 'Estado não encontrado.' })
  }

  const reassignToStatusId = typeof req.query.reassignToStatusId === 'string' ? req.query.reassignToStatusId.trim() : ''
  const dependencyCount = await prisma.record.count({ where: { statusId: req.params.id } })
  if (dependencyCount > 0) {
    if (!reassignToStatusId) {
      return res.status(409).json({ error: 'Estado em uso. Marque como inativo em vez de remover.' })
    }

    if (reassignToStatusId === req.params.id) {
      return res.status(400).json({ error: 'Estado de reatribuição inválido.' })
    }

    const targetStatus = await prisma.status.findUnique({ where: { id: reassignToStatusId } })
    if (!targetStatus) {
      return res.status(404).json({ error: 'Estado de reatribuição não encontrado.' })
    }

    await prisma.$transaction([
      prisma.record.updateMany({
        where: { statusId: req.params.id },
        data: { statusId: reassignToStatusId },
      }),
      prisma.status.delete({ where: { id: req.params.id } }),
    ])

    return res.json({ ok: true, reassigned: dependencyCount })
  }

  await prisma.status.delete({ where: { id: req.params.id } })
  return res.json({ ok: true })
})

app.get('/api/calculation-settings', async (_req, res) => {
  const defaults = await ensureDefaults(prisma)
  res.json({
    ...defaults.calculationSettings,
    taxRules: defaults.taxRules.map(toApiTaxRule),
  })
})

app.patch('/api/calculation-settings', async (req, res) => {
  const parsed = calculationSettingsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const settingsData = {
    autoApplyRules: parsed.data.autoApplyRules,
    autoComputeValorSemIva: parsed.data.autoComputeValorSemIva,
    autoComputeValorEmissao: parsed.data.autoComputeValorEmissao,
    roundTo: parsed.data.roundTo,
  }

  await prisma.calculationSettings.update({
    where: { id: 'default' },
    data: settingsData,
  })

  if (parsed.data.taxRules) {
    for (const rule of parsed.data.taxRules) {
      await prisma.taxRule.upsert({
        where: { code: rule.code },
        update: {
          label: rule.label,
          rate: new Prisma.Decimal(rule.rate),
          enabled: rule.enabled,
          targetField: rule.targetField,
          baseField: rule.baseField,
          order: rule.order,
        },
        create: {
          code: rule.code,
          label: rule.label,
          rate: new Prisma.Decimal(rule.rate),
          enabled: rule.enabled,
          targetField: rule.targetField,
          baseField: rule.baseField,
          order: rule.order,
        },
      })
    }
  }

  const defaults = await ensureDefaults(prisma)
  res.json({
    ...defaults.calculationSettings,
    taxRules: defaults.taxRules.map(toApiTaxRule),
  })
})

app.get('/api/saved-views', async (req, res) => {
  const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined
  const views = await prisma.savedView.findMany({
    where: scope ? { scope } : undefined,
    orderBy: { updatedAt: 'desc' },
  })
  res.json(views.map(savedViewDto))
})

app.post('/api/saved-views', async (req, res) => {
  const parsed = saveViewSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const created = await prisma.savedView.create({ data: { ...parsed.data, filters: parsed.data.filters as Prisma.InputJsonValue } })
  res.status(201).json(savedViewDto(created))
})

app.patch('/api/saved-views/:id', async (req, res) => {
  const parsed = saveViewSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const updated = await prisma.savedView.update({
    where: { id: req.params.id },
    data: parsed.data.filters !== undefined
      ? { ...parsed.data, filters: parsed.data.filters as Prisma.InputJsonValue }
      : { name: parsed.data.name, scope: parsed.data.scope },
  })
  res.json(savedViewDto(updated))
})

app.delete('/api/saved-views/:id', async (req, res) => {
  await prisma.savedView.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

app.post('/api/seed', async (req, res) => {
  const body = z.object({ replace: z.boolean().optional() }).safeParse(req.body)
  if (!body.success) {
    return res.status(400).json({ error: 'Payload inválido.' })
  }

  const defaults = await ensureDefaults(prisma)

  if (body.data.replace) {
    await prisma.$transaction([prisma.recordHistory.deleteMany(), prisma.record.deleteMany()])
  }

  const seedPath = path.join(process.cwd(), 'public', 'seed-records.json')
  const raw = await fs.readFile(seedPath, 'utf8')
  const parsed = z
    .object({
      records: z.array(z.record(z.string(), z.unknown())),
    })
    .safeParse(JSON.parse(raw))

  if (!parsed.success) {
    return res.status(500).json({ error: 'Formato de seed inválido.' })
  }

  const statusKeyMap = defaults.statusByKey

  const result = await (async () => {
    let created = 0
    let updated = 0
    let invalid = 0

    const existingRecords = await prisma.record.findMany({
      select: {
        id: true,
        tipo: true,
        ano: true,
        mes: true,
        processo: true,
        pe: true,
        reciboNumero: true,
      },
    })
    const existingByKey = new Map(existingRecords.map((record) => [buildUniqueRecordKey(record), record.id]))

    for (const recordRaw of parsed.data.records) {
      const record = asRecordInput(recordRaw)
      if (!record) {
        invalid += 1
        continue
      }

      const rawStatus = typeof recordRaw.statusId === 'string' ? recordRaw.statusId : undefined
      const mappedStatusId = (rawStatus ? statusKeyMap.get(rawStatus) : undefined) || defaults.statusByKey.get('status-sem') || defaults.statuses[0]?.id
      if (!mappedStatusId) {
        invalid += 1
        continue
      }

      const key = buildUniqueRecordKey(record)
      const existingId = existingByKey.get(key)

      if (existingId) {
        await prisma.record.update({
          where: { id: existingId },
          data: {
            ...toPrismaRecordData(record),
            statusId: mappedStatusId,
          },
        })
        updated += 1
      } else {
        const createdRecord = await prisma.record.create({
          data: {
            ...toPrismaRecordData(record),
            statusId: mappedStatusId,
          },
          select: { id: true },
        })
        existingByKey.set(key, createdRecord.id)
        created += 1
      }
    }

    return { created, updated, invalid }
  })()

  res.json({ ok: true, ...result })
})

app.post('/api/migrate/local-storage', async (req, res) => {
  const body = z
    .object({
      records: z.array(z.record(z.string(), z.unknown())).optional(),
      statuses: z.array(z.record(z.string(), z.unknown())).optional(),
      clearOnly: z.boolean().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    return res.status(400).json({ error: 'Payload inválido.' })
  }

  if (body.data.clearOnly) {
    return res.json({ ok: true, migrated: 0 })
  }

  const defaults = await ensureDefaults(prisma)

  if (Array.isArray(body.data.statuses)) {
    for (const raw of body.data.statuses) {
      const key = typeof raw.key === 'string' ? raw.key : typeof raw.id === 'string' ? raw.id : undefined
      const label = typeof raw.label === 'string' ? raw.label : undefined
      const icon = typeof raw.icon === 'string' ? raw.icon : '🟦'
      const color = typeof raw.color === 'string' ? raw.color : '#BFC4CC'
      const active = typeof raw.active === 'boolean' ? raw.active : true
      const order = typeof raw.order === 'number' ? raw.order : 999

      if (!key || !label) {
        continue
      }

      await prisma.status.upsert({
        where: { key },
        update: { label, icon, color, active, order },
        create: { key, label, icon, color, active, order },
      })
    }
  }

  const refreshedStatuses = await prisma.status.findMany()
  const statusByKey = new Map(refreshedStatuses.map((status) => [status.key, status.id]))

  let migrated = 0
  let skipped = 0

  if (Array.isArray(body.data.records)) {
    const existingRecords = await prisma.record.findMany({
      select: {
        id: true,
        tipo: true,
        ano: true,
        mes: true,
        processo: true,
        pe: true,
        reciboNumero: true,
      },
    })
    const existingByKey = new Map(existingRecords.map((record) => [buildUniqueRecordKey(record), record.id]))

    for (const raw of body.data.records) {
      const record = asRecordInput(raw)
      if (!record) {
        skipped += 1
        continue
      }

      const sourceStatusId = typeof raw.statusId === 'string' ? raw.statusId : undefined
      const statusId =
        (sourceStatusId ? statusByKey.get(sourceStatusId) || statusByKey.get(`status-${sourceStatusId}`) : undefined) ||
        defaults.statusByKey.get('status-sem') ||
        defaults.statuses[0]?.id

      if (!statusId) {
        skipped += 1
        continue
      }

      const key = buildUniqueRecordKey(record)
      if (existingByKey.has(key)) {
        skipped += 1
        continue
      }

      const created = await prisma.record.create({
        data: {
          ...toPrismaRecordData(record),
          statusId,
        },
        select: { id: true },
      })

      existingByKey.set(key, created.id)
      migrated += 1
    }
  }

  res.json({ ok: true, migrated, skipped })
})

// In production, serve the built frontend from dist/ under the same origin.
// This avoids CORS complexity and keeps deployment simple (single Railway service).
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../dist')
  app.use(express.static(distPath))
  // For client-side routing: any non-API GET falls through to index.html
  app.get(/^(?!\/api\/).*$/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.use(createErrorHandler(databaseSetupHint))

app.listen(PORT, () => {
  console.log(`[api] running on http://localhost:${PORT}`)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
