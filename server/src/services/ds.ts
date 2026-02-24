import { Prisma, type DsStatus, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

import { dsRecordPatchSchema } from '../schemas/ds'
import { DEFAULT_DS_STATUSES } from '../defaults'
import { normalizeText, toIsoDateOrUndefined, toNumberOrUndefined } from '../utils'
import {
  normalizeStatusToken,
  parseLooseNumber,
  detectDsIvaKind,
  toDateOrNull,
  queryValue,
} from './shared'

export async function ensureDsDefaults(prisma: PrismaClient) {
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

export type DsDefaults = Awaited<ReturnType<typeof ensureDsDefaults>>

export function getDefaultDsStatusId(defaults: DsDefaults): string | undefined {
  return (
    defaults.statusByKey.get('ds-sem-estado') ??
    defaults.statusByKey.get('ds-falta-recibo-gestora') ??
    defaults.statuses[0]?.id
  )
}

export function resolveDsStatusId(
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

export type DsInputData = {
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

export function asDsRecordInput(raw: Record<string, unknown>): DsInputData | null {
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

export function toPrismaDsRecordData(input: DsInputData): Prisma.DsRecordUncheckedCreateInput {
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

export function prismaDsRecordToDto(record: {
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

export function buildDsRecordKey(record: Pick<DsInputData, 'gestora' | 'referencia' | 'dataEscritura' | 'proponentes' | 'produto' | 'valor'>): string {
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

export function buildDsRecordWhere(query: Record<string, unknown>): Prisma.DsRecordWhereInput {
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
    where.AND = [...((where.AND as Prisma.DsRecordWhereInput[]) ?? []), { OR: [{ recibo: null }, { recibo: '' }] }]
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

export type PrismaCurrentDsRecord = {
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

export function mergeDsRecordWithPatch(current: PrismaCurrentDsRecord, patch: z.infer<typeof dsRecordPatchSchema>): DsInputData {
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

// Re-export dsStatusDto from shared for convenience in routes
import { dsStatusDto } from './shared'
export { dsStatusDto }
