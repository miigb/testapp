import 'dotenv/config'

import cors from 'cors'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Prisma, PrismaClient, type SavedView, type Status, type TaxRule } from '@prisma/client'
import { z } from 'zod'

import { DEFAULT_STATUSES, DEFAULT_TAX_RULES } from './defaults'
import {
  applyCalculations,
  buildUniqueRecordKey,
  normalizeText,
  prismaRecordToDto,
  toIsoDateOrUndefined,
  toNumberOrUndefined,
  toPrismaRecordData,
  type RecordInputData,
} from './utils'

const app = express()
const prisma = new PrismaClient()

app.use(cors())
app.use(express.json({ limit: '30mb' }))

const PORT = Number(process.env.API_PORT ?? 4000)

function databaseSetupHint() {
  return 'Base de dados indisponível. Configure DATABASE_URL e execute: npm run prisma:push'
}

const recordInputSchema = z.object({
  tipo: z.enum(['exequente', 'executado']),
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(2000).max(2100),
  processo: z.string().trim().optional(),
  pe: z.string().trim().optional(),
  reciboNumero: z.string().trim().optional(),
  dataLevantamento: z.string().optional(),
  dataRecibo: z.string().optional(),
  valorIndicado: z.number().optional(),
  valorSemIva: z.number().optional(),
  iva: z.number().optional(),
  retencao: z.number().optional(),
  valorEmissao: z.number().optional(),
  meu5: z.number().optional(),
  outrasTaxas: z.number().optional(),
  gestor: z.string().trim().optional(),
  exequente: z.string().trim().optional(),
  descricaoValor: z.string().trim().optional(),
  indicacoes: z.string().trim().optional(),
  sourceColor: z.string().optional(),
  sourceSheet: z.string().optional(),
  statusId: z.string().optional(),
  estadoId: z.string().optional(),
})

const recordPatchSchema = recordInputSchema.partial()

const importCommitSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  colorMapping: z.record(z.string(), z.string()).optional(),
  strategy: z.enum(['skip', 'update', 'duplicate']).default('skip'),
  forceRecalculate: z.boolean().optional(),
})

const importPreviewSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  colorMapping: z.record(z.string(), z.string()).optional(),
})

const saveViewSchema = z.object({
  name: z.string().min(1),
  scope: z.string().min(1),
  filters: z.record(z.string(), z.unknown()),
})

const taxRuleSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  label: z.string().min(1),
  rate: z.number().min(0),
  enabled: z.boolean(),
  targetField: z.enum(['iva', 'retencao', 'meu5', 'outrasTaxas']),
  baseField: z.enum(['valorIndicado', 'valorSemIva', 'valorEmissao']),
  order: z.number().int(),
})

const calculationSettingsSchema = z.object({
  autoApplyRules: z.boolean().optional(),
  autoComputeValorSemIva: z.boolean().optional(),
  autoComputeValorEmissao: z.boolean().optional(),
  roundTo: z.number().int().min(0).max(6).optional(),
  taxRules: z.array(taxRuleSchema).optional(),
})

const statusSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().min(1),
  color: z.string().min(1),
  active: z.boolean(),
  order: z.number().int(),
})

const bulkUpdateSchema = z.object({
  recordIds: z.array(z.string().min(1)).min(1),
  patch: recordPatchSchema,
  forceRecalculate: z.boolean().optional(),
})

type PrismaCurrentRecord = {
  id: string
  tipo: 'exequente' | 'executado'
  mes: number
  ano: number
  processo: string | null
  pe: string | null
  reciboNumero: string | null
  dataLevantamento: Date | null
  dataRecibo: Date | null
  valorIndicado: unknown
  valorSemIva: unknown
  iva: unknown
  retencao: unknown
  valorEmissao: unknown
  meu5: unknown
  outrasTaxas: unknown
  gestor: string | null
  exequente: string | null
  descricaoValor: string | null
  indicacoes: string | null
  sourceColor: string | null
  sourceSheet: string | null
  statusId: string
}

function mergeRecordWithPatch(current: PrismaCurrentRecord, patch: z.infer<typeof recordPatchSchema>): RecordInputData {
  const merged: RecordInputData = {
    tipo: patch.tipo ?? current.tipo,
    mes: patch.mes ?? current.mes,
    ano: patch.ano ?? current.ano,
    processo: patch.processo ?? current.processo ?? undefined,
    pe: patch.pe ?? current.pe ?? undefined,
    reciboNumero: patch.reciboNumero ?? current.reciboNumero ?? undefined,
    dataLevantamento: toIsoDateOrUndefined(patch.dataLevantamento) ?? (current.dataLevantamento ? current.dataLevantamento.toISOString().slice(0, 10) : undefined),
    dataRecibo: toIsoDateOrUndefined(patch.dataRecibo) ?? (current.dataRecibo ? current.dataRecibo.toISOString().slice(0, 10) : undefined),
    valorIndicado: patch.valorIndicado ?? Number(current.valorIndicado ?? NaN),
    valorSemIva: patch.valorSemIva ?? Number(current.valorSemIva ?? NaN),
    iva: patch.iva ?? Number(current.iva ?? NaN),
    retencao: patch.retencao ?? Number(current.retencao ?? NaN),
    valorEmissao: patch.valorEmissao ?? Number(current.valorEmissao ?? NaN),
    meu5: patch.meu5 ?? Number(current.meu5 ?? NaN),
    outrasTaxas: patch.outrasTaxas ?? Number(current.outrasTaxas ?? NaN),
    gestor: patch.gestor ?? current.gestor ?? undefined,
    exequente: patch.exequente ?? current.exequente ?? undefined,
    descricaoValor: patch.descricaoValor ?? current.descricaoValor ?? undefined,
    indicacoes: patch.indicacoes ?? current.indicacoes ?? undefined,
    sourceColor: patch.sourceColor ?? current.sourceColor ?? undefined,
    sourceSheet: patch.sourceSheet ?? current.sourceSheet ?? undefined,
    statusId: patch.statusId ?? patch.estadoId ?? current.statusId,
  }

  for (const key of ['valorIndicado', 'valorSemIva', 'iva', 'retencao', 'valorEmissao', 'meu5', 'outrasTaxas'] as const) {
    if (!Number.isFinite(merged[key] ?? NaN)) {
      merged[key] = undefined
    }
  }

  return merged
}

function asRecordInput(raw: Record<string, unknown>): RecordInputData | null {
  const tipoRaw = raw.tipo
  const tipo = tipoRaw === 'executado' ? 'executado' : tipoRaw === 'exequente' ? 'exequente' : undefined
  const mes = toNumberOrUndefined(raw.mes)
  const ano = toNumberOrUndefined(raw.ano)

  if (!tipo || !mes || !ano) {
    return null
  }

  const getText = (value: unknown) => {
    if (value === undefined || value === null) {
      return undefined
    }
    const text = String(value).trim()
    return text || undefined
  }

  const record: RecordInputData = {
    tipo,
    mes,
    ano,
    processo: getText(raw.processo),
    pe: getText(raw.pe),
    reciboNumero: getText(raw.reciboNumero),
    dataLevantamento: toIsoDateOrUndefined(raw.dataLevantamento),
    dataRecibo: toIsoDateOrUndefined(raw.dataRecibo),
    valorIndicado: toNumberOrUndefined(raw.valorIndicado),
    valorSemIva: toNumberOrUndefined(raw.valorSemIva),
    iva: toNumberOrUndefined(raw.iva),
    retencao: toNumberOrUndefined(raw.retencao),
    valorEmissao: toNumberOrUndefined(raw.valorEmissao),
    meu5: toNumberOrUndefined(raw.meu5),
    outrasTaxas: toNumberOrUndefined(raw.outrasTaxas),
    gestor: getText(raw.gestor),
    exequente: getText(raw.exequente),
    descricaoValor: getText(raw.descricaoValor),
    indicacoes: getText(raw.indicacoes),
    sourceColor: getText(raw.sourceColor),
    sourceSheet: getText(raw.sourceSheet),
    statusId: getText(raw.statusId) ?? getText(raw.estadoId),
  }

  return record
}

function statusDto(status: Status) {
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

function savedViewDto(view: SavedView) {
  return {
    id: view.id,
    name: view.name,
    scope: view.scope,
    filters: view.filters,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  }
}

async function ensureDefaults() {
  await prisma.calculationSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      autoApplyRules: true,
      autoComputeValorSemIva: true,
      autoComputeValorEmissao: false,
      roundTo: 2,
    },
  })

  for (const status of DEFAULT_STATUSES) {
    await prisma.status.upsert({
      where: { key: status.key },
      update: {
        label: status.label,
        icon: status.icon,
        color: status.color,
      },
      create: status,
    })
  }

  for (const rule of DEFAULT_TAX_RULES) {
    await prisma.taxRule.upsert({
      where: { code: rule.code },
      update: {
        label: rule.label,
      },
      create: {
        ...rule,
        rate: new Prisma.Decimal(rule.rate),
      },
    })
  }

  const [statuses, calculationSettings, taxRules] = await Promise.all([
    prisma.status.findMany({ orderBy: [{ order: 'asc' }, { label: 'asc' }] }),
    prisma.calculationSettings.findUniqueOrThrow({ where: { id: 'default' } }),
    prisma.taxRule.findMany({ orderBy: [{ order: 'asc' }, { label: 'asc' }] }),
  ])

  return {
    statuses,
    calculationSettings,
    taxRules,
    statusByKey: new Map(statuses.map((status) => [status.key, status.id])),
  }
}

function detectStatusIdFromColor(
  sourceColor: string | undefined,
  colorMapping: Record<string, string> | undefined,
  statuses: Status[],
  fallbackStatusId: string,
) {
  if (!sourceColor) {
    return fallbackStatusId
  }

  if (colorMapping?.[sourceColor]) {
    return colorMapping[sourceColor]
  }

  const exact = statuses.find((status) => normalizeText(status.color) === normalizeText(sourceColor))
  return exact?.id ?? fallbackStatusId
}

function duplicateVariant(record: RecordInputData, duplicateIndex: number): RecordInputData {
  const suffix = `dup-${duplicateIndex}`
  if (record.reciboNumero) {
    return { ...record, reciboNumero: `${record.reciboNumero}-${suffix}` }
  }
  if (record.processo) {
    return { ...record, processo: `${record.processo}-${suffix}` }
  }
  return { ...record, reciboNumero: suffix }
}

function toApiTaxRule(rule: TaxRule) {
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

function normalizeSuggestionValues(values: Array<string | null | undefined>): string[] {
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

function queryValue(query: Record<string, unknown>, key: string): string | undefined {
  const raw = query[key]
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return undefined
}

function buildRecordWhere(query: Record<string, unknown>): Prisma.RecordWhereInput {
  const where: Prisma.RecordWhereInput = {}

  const textQuery = queryValue(query, 'q')?.trim()
  if (textQuery) {
    where.OR = [
      { processo: { contains: textQuery, mode: 'insensitive' } },
      { pe: { contains: textQuery, mode: 'insensitive' } },
      { reciboNumero: { contains: textQuery, mode: 'insensitive' } },
      { gestor: { contains: textQuery, mode: 'insensitive' } },
      { exequente: { contains: textQuery, mode: 'insensitive' } },
      { indicacoes: { contains: textQuery, mode: 'insensitive' } },
    ]
  }

  const tipoRaw = queryValue(query, 'tipo')
  const tipo = tipoRaw === 'exequente' || tipoRaw === 'executado' ? tipoRaw : undefined
  if (tipo) {
    where.tipo = tipo
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

  const mes = Number(queryValue(query, 'mes'))
  if (Number.isFinite(mes) && mes >= 1 && mes <= 12) {
    where.mes = mes
  }

  const ano = Number(queryValue(query, 'ano'))
  if (Number.isFinite(ano) && ano > 2000) {
    where.ano = ano
  }

  const exequente = queryValue(query, 'exequente')?.trim()
  if (exequente) {
    where.exequente = { contains: exequente, mode: 'insensitive' }
  }

  const gestor = queryValue(query, 'gestor')?.trim()
  if (gestor) {
    where.gestor = { contains: gestor, mode: 'insensitive' }
  }

  return where
}

function toNumberFromDecimal(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value)
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() })
})

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const defaults = await ensureDefaults()
    const savedViews = await prisma.savedView.findMany({ orderBy: { updatedAt: 'desc' } })
    const recordCount = await prisma.record.count()

    res.json({
      statuses: defaults.statuses.map(statusDto),
      calculationSettings: {
        ...defaults.calculationSettings,
        taxRules: defaults.taxRules.map(toApiTaxRule),
      },
      savedViews: savedViews.map(savedViewDto),
      recordCount,
    })
  } catch (error) {
    console.error(error)
    res.status(503).json({ error: databaseSetupHint() })
  }
})

app.get('/api/records', async (req, res) => {
  const page = Number(req.query.page ?? 1)
  const pageSize = Math.min(Number(req.query.pageSize ?? 100), 300)
  const skip = Math.max(page - 1, 0) * pageSize

  const where = buildRecordWhere(req.query as Record<string, unknown>)

  const [items, total] = await Promise.all([
    prisma.record.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        status: true,
      },
    }),
    prisma.record.count({ where }),
  ])

  res.json({
    items: items.map(prismaRecordToDto),
    total,
    page,
    pageSize,
  })
})

app.get('/api/analytics/summary', async (req, res) => {
  const where = buildRecordWhere(req.query as Record<string, unknown>)

  const [statuses, totalsAggregate, byStatusRows, byTypeRows, byMonthRows, byGestorRows, byExequenteRows] = await Promise.all([
    prisma.status.findMany(),
    prisma.record.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        valorIndicado: true,
        valorSemIva: true,
        iva: true,
        retencao: true,
        meu5: true,
        valorEmissao: true,
        outrasTaxas: true,
      },
    }),
    prisma.record.groupBy({
      by: ['statusId'],
      where,
      _count: { _all: true },
      _sum: { valorSemIva: true, iva: true, valorEmissao: true },
    }),
    prisma.record.groupBy({
      by: ['tipo'],
      where,
      _count: { _all: true },
      _sum: { valorSemIva: true, iva: true, valorEmissao: true },
    }),
    prisma.record.groupBy({
      by: ['ano', 'mes'],
      where,
      _count: { _all: true },
      _sum: { valorSemIva: true, iva: true, valorEmissao: true },
      orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
    }),
    prisma.record.groupBy({
      by: ['gestor'],
      where: {
        AND: [where, { gestor: { not: null } }],
      },
      _count: { _all: true },
      _sum: { valorSemIva: true, valorEmissao: true },
      orderBy: { _count: { gestor: 'desc' } },
      take: 12,
    }),
    prisma.record.groupBy({
      by: ['exequente'],
      where: {
        AND: [where, { exequente: { not: null } }],
      },
      _count: { _all: true },
      _sum: { valorSemIva: true, valorEmissao: true },
      orderBy: { _count: { exequente: 'desc' } },
      take: 12,
    }),
  ])

  const statusMap = new Map(statuses.map((status) => [status.id, status]))

  const totals = {
    registos: totalsAggregate._count._all,
    valorIndicado: toNumberFromDecimal(totalsAggregate._sum.valorIndicado),
    valorSemIva: toNumberFromDecimal(totalsAggregate._sum.valorSemIva),
    iva: toNumberFromDecimal(totalsAggregate._sum.iva),
    retencao: toNumberFromDecimal(totalsAggregate._sum.retencao),
    meu5: toNumberFromDecimal(totalsAggregate._sum.meu5),
    valorEmissao: toNumberFromDecimal(totalsAggregate._sum.valorEmissao),
    outrasTaxas: toNumberFromDecimal(totalsAggregate._sum.outrasTaxas),
    levantadoComIva: toNumberFromDecimal(totalsAggregate._sum.valorSemIva) + toNumberFromDecimal(totalsAggregate._sum.iva),
  }

  const byStatus = byStatusRows
    .map((row) => {
      const status = statusMap.get(row.statusId)
      return {
        statusId: row.statusId,
        statusKey: status?.key ?? row.statusId,
        statusLabel: status?.label ?? row.statusId,
        statusColor: status?.color ?? '#BFC4CC',
        statusIcon: status?.icon ?? 'circle',
        count: row._count._all,
        valorSemIva: toNumberFromDecimal(row._sum.valorSemIva),
        iva: toNumberFromDecimal(row._sum.iva),
        valorEmissao: toNumberFromDecimal(row._sum.valorEmissao),
      }
    })
    .sort((a, b) => b.count - a.count)

  const byType = byTypeRows
    .map((row) => ({
      tipo: row.tipo,
      count: row._count._all,
      valorSemIva: toNumberFromDecimal(row._sum.valorSemIva),
      iva: toNumberFromDecimal(row._sum.iva),
      valorEmissao: toNumberFromDecimal(row._sum.valorEmissao),
    }))
    .sort((a, b) => b.count - a.count)

  const byMonth = byMonthRows.map((row) => ({
    ano: row.ano,
    mes: row.mes,
    count: row._count._all,
    valorSemIva: toNumberFromDecimal(row._sum.valorSemIva),
    iva: toNumberFromDecimal(row._sum.iva),
    valorEmissao: toNumberFromDecimal(row._sum.valorEmissao),
  }))

  const topGestores = byGestorRows
    .map((row) => {
      const name = row.gestor?.trim()
      if (!name) return null
      return {
        name,
        count: row._count._all,
        valorSemIva: toNumberFromDecimal(row._sum.valorSemIva),
        valorEmissao: toNumberFromDecimal(row._sum.valorEmissao),
      }
    })
    .filter((row): row is { name: string; count: number; valorSemIva: number; valorEmissao: number } => Boolean(row))
    .slice(0, 8)

  const topExequentes = byExequenteRows
    .map((row) => {
      const name = row.exequente?.trim()
      if (!name) return null
      return {
        name,
        count: row._count._all,
        valorSemIva: toNumberFromDecimal(row._sum.valorSemIva),
        valorEmissao: toNumberFromDecimal(row._sum.valorEmissao),
      }
    })
    .filter((row): row is { name: string; count: number; valorSemIva: number; valorEmissao: number } => Boolean(row))
    .slice(0, 8)

  res.json({
    totals,
    byStatus,
    byType,
    byMonth,
    topGestores,
    topExequentes,
  })
})

app.get('/api/records/suggestions', async (req, res) => {
  const rawLimit = Number(req.query.limit ?? 120)
  const limit = Math.max(20, Math.min(400, Number.isFinite(rawLimit) ? rawLimit : 120))

  const [processoRows, peRows, reciboRows, gestorRows, exequenteRows] = await Promise.all([
    prisma.record.findMany({
      where: { processo: { not: null } },
      select: { processo: true },
      distinct: ['processo'],
      take: limit,
      orderBy: { processo: 'asc' },
    }),
    prisma.record.findMany({
      where: { pe: { not: null } },
      select: { pe: true },
      distinct: ['pe'],
      take: limit,
      orderBy: { pe: 'asc' },
    }),
    prisma.record.findMany({
      where: { reciboNumero: { not: null } },
      select: { reciboNumero: true },
      distinct: ['reciboNumero'],
      take: limit,
      orderBy: { reciboNumero: 'asc' },
    }),
    prisma.record.findMany({
      where: { gestor: { not: null } },
      select: { gestor: true },
      distinct: ['gestor'],
      take: limit,
      orderBy: { gestor: 'asc' },
    }),
    prisma.record.findMany({
      where: { exequente: { not: null } },
      select: { exequente: true },
      distinct: ['exequente'],
      take: limit,
      orderBy: { exequente: 'asc' },
    }),
  ])

  res.json({
    processo: normalizeSuggestionValues(processoRows.map((row) => row.processo)),
    pe: normalizeSuggestionValues(peRows.map((row) => row.pe)),
    reciboNumero: normalizeSuggestionValues(reciboRows.map((row) => row.reciboNumero)),
    gestor: normalizeSuggestionValues(gestorRows.map((row) => row.gestor)),
    exequente: normalizeSuggestionValues(exequenteRows.map((row) => row.exequente)),
  })
})

app.get('/api/records/export', async (_req, res) => {
  const [records, statuses, calculationSettings, taxRules, savedViews] = await Promise.all([
    prisma.record.findMany({
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }, { updatedAt: 'desc' }],
      include: {
        status: true,
        history: { orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.status.findMany({ orderBy: [{ order: 'asc' }, { label: 'asc' }] }),
    prisma.calculationSettings.findUniqueOrThrow({ where: { id: 'default' } }),
    prisma.taxRule.findMany({ orderBy: [{ order: 'asc' }, { label: 'asc' }] }),
    prisma.savedView.findMany({ orderBy: { updatedAt: 'desc' } }),
  ])

  res.json({
    exportedAt: new Date().toISOString(),
    totals: { records: records.length, statuses: statuses.length, savedViews: savedViews.length },
    statuses: statuses.map(statusDto),
    calculationSettings: {
      ...calculationSettings,
      taxRules: taxRules.map(toApiTaxRule),
    },
    savedViews: savedViews.map(savedViewDto),
    records: records.map(prismaRecordToDto),
  })
})

app.get('/api/records/:id', async (req, res) => {
  const record = await prisma.record.findUnique({
    where: { id: req.params.id },
    include: {
      status: true,
      history: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!record) {
    return res.status(404).json({ error: 'Registo não encontrado.' })
  }

  return res.json(prismaRecordToDto(record))
})

app.post('/api/records', async (req, res) => {
  const parsed = recordInputSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const defaults = await ensureDefaults()
  const forceRecalculate = req.body.forceRecalculate === true
  const statusId = parsed.data.statusId || parsed.data.estadoId || defaults.statusByKey.get('status-prep') || defaults.statuses[0]?.id

  if (!statusId) {
    return res.status(500).json({ error: 'Não foi possível resolver estado padrão.' })
  }

  const calculated = applyCalculations(
    {
      ...parsed.data,
      dataLevantamento: toIsoDateOrUndefined(parsed.data.dataLevantamento),
      dataRecibo: toIsoDateOrUndefined(parsed.data.dataRecibo),
      statusId,
    },
    defaults.calculationSettings,
    defaults.taxRules,
    forceRecalculate,
  )

  try {
    const created = await prisma.record.create({
      data: {
        ...toPrismaRecordData(calculated),
        statusId,
        history: {
          create: {
            message: 'Registo criado via API.',
          },
        },
      },
      include: { status: true },
    })

    return res.status(201).json(prismaRecordToDto(created))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'Registo duplicado para o mesmo período.' })
    }
    throw error
  }
})

app.patch('/api/records/:id', async (req, res) => {
  const parsed = recordPatchSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const current = await prisma.record.findUnique({ where: { id: req.params.id } })
  if (!current) {
    return res.status(404).json({ error: 'Registo não encontrado.' })
  }

  const defaults = await ensureDefaults()
  const merged = mergeRecordWithPatch(current, parsed.data)

  const forceRecalculate = req.body.forceRecalculate === true
  const calculated = applyCalculations(merged, defaults.calculationSettings, defaults.taxRules, forceRecalculate)

  const updated = await prisma.record.update({
    where: { id: req.params.id },
    data: {
      ...toPrismaRecordData(calculated),
      statusId: calculated.statusId,
      history: {
        create: {
          message: 'Registo atualizado via API.',
        },
      },
    },
    include: { status: true },
  })

  return res.json(prismaRecordToDto(updated))
})

app.patch('/api/records/:id/status', async (req, res) => {
  const body = z.object({ statusId: z.string().min(1) }).safeParse(req.body)
  if (!body.success) {
    return res.status(400).json({ error: 'Status inválido.' })
  }

  const old = await prisma.record.findUnique({ where: { id: req.params.id }, include: { status: true } })
  if (!old) {
    return res.status(404).json({ error: 'Registo não encontrado.' })
  }

  const updated = await prisma.record.update({
    where: { id: req.params.id },
    data: {
      statusId: body.data.statusId,
      history: {
        create: {
          message: `Estado alterado para ${body.data.statusId}.`,
        },
      },
    },
    include: { status: true },
  })

  return res.json(prismaRecordToDto(updated))
})

app.post('/api/records/bulk/status', async (req, res) => {
  const body = z
    .object({
      recordIds: z.array(z.string()).min(1),
      statusId: z.string().min(1),
    })
    .safeParse(req.body)

  if (!body.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: body.error.flatten() })
  }

  const now = new Date()

  await prisma.$transaction([
    prisma.record.updateMany({
      where: { id: { in: body.data.recordIds } },
      data: {
        statusId: body.data.statusId,
        updatedAt: now,
      },
    }),
    prisma.recordHistory.createMany({
      data: body.data.recordIds.map((recordId) => ({
        recordId,
        message: `Estado alterado em lote para ${body.data.statusId}.`,
      })),
    }),
  ])

  return res.json({ ok: true, updated: body.data.recordIds.length })
})

app.post('/api/records/bulk/update', async (req, res) => {
  const parsed = bulkUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  if (Object.keys(parsed.data.patch).length === 0) {
    return res.status(400).json({ error: 'Indique pelo menos um campo para atualizar em lote.' })
  }

  const defaults = await ensureDefaults()
  const records = await prisma.record.findMany({
    where: { id: { in: parsed.data.recordIds } },
  })

  if (records.length === 0) {
    return res.json({ ok: true, updated: 0 })
  }

  const updates = records.map((current) => {
    const merged = mergeRecordWithPatch(current, parsed.data.patch)
    const calculated = applyCalculations(
      merged,
      defaults.calculationSettings,
      defaults.taxRules,
      parsed.data.forceRecalculate === true,
    )
    return { id: current.id, calculated }
  })

  await prisma.$transaction([
    ...updates.map((item) =>
      prisma.record.update({
        where: { id: item.id },
        data: {
          ...toPrismaRecordData(item.calculated),
          statusId: item.calculated.statusId,
        },
      }),
    ),
    prisma.recordHistory.createMany({
      data: updates.map((item) => ({
        recordId: item.id,
        message: 'Registo atualizado em lote.',
      })),
    }),
  ])

  return res.json({ ok: true, updated: updates.length })
})

app.get('/api/statuses', async (_req, res) => {
  const defaults = await ensureDefaults()
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
  const defaults = await ensureDefaults()
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

  const defaults = await ensureDefaults()
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

  const created = await prisma.savedView.create({ data: parsed.data })
  res.status(201).json(savedViewDto(created))
})

app.patch('/api/saved-views/:id', async (req, res) => {
  const parsed = saveViewSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const updated = await prisma.savedView.update({ where: { id: req.params.id }, data: parsed.data })
  res.json(savedViewDto(updated))
})

app.delete('/api/saved-views/:id', async (req, res) => {
  await prisma.savedView.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

app.post('/api/import/preview', async (req, res) => {
  const parsed = importPreviewSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const defaults = await ensureDefaults()
  const fallbackStatusId = defaults.statusByKey.get('status-sem') || defaults.statuses[0]?.id
  if (!fallbackStatusId) {
    return res.status(500).json({ error: 'Estado padrão indisponível.' })
  }

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

  const items = parsed.data.rows.map((raw, index) => {
    const row = asRecordInput(raw)
    if (!row) {
      return {
        index,
        valid: false,
        action: 'error',
        reason: 'Linha sem campos mínimos (tipo, mês, ano).',
      }
    }

    const statusId = row.statusId || detectStatusIdFromColor(row.sourceColor, parsed.data.colorMapping, defaults.statuses, fallbackStatusId)
    const key = buildUniqueRecordKey(row)
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

  res.json({ summary, items })
})

app.post('/api/import/commit', async (req, res) => {
  const parsed = importCommitSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
  }

  const defaults = await ensureDefaults()
  const fallbackStatusId = defaults.statusByKey.get('status-sem') || defaults.statuses[0]?.id
  if (!fallbackStatusId) {
    return res.status(500).json({ error: 'Estado padrão indisponível.' })
  }

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

  let created = 0
  let updated = 0
  let skipped = 0
  let invalid = 0
  let duplicatesCreated = 0

  let duplicateCounter = 1

  for (const raw of parsed.data.rows) {
    const row = asRecordInput(raw)
    if (!row) {
      invalid += 1
      continue
    }

    const statusId = row.statusId || detectStatusIdFromColor(row.sourceColor, parsed.data.colorMapping, defaults.statuses, fallbackStatusId)
    const prepared = applyCalculations(
      {
        ...row,
        statusId,
      },
      defaults.calculationSettings,
      defaults.taxRules,
      parsed.data.forceRecalculate === true,
    )

    let key = buildUniqueRecordKey(prepared)
    const existingId = existingByKey.get(key)

    if (existingId) {
      if (parsed.data.strategy === 'skip') {
        skipped += 1
        continue
      }

      if (parsed.data.strategy === 'update') {
        await prisma.record.update({
          where: { id: existingId },
          data: {
            ...toPrismaRecordData(prepared),
            statusId,
            history: {
              create: {
                message: 'Atualizado por importação.',
              },
            },
          },
        })
        updated += 1
        continue
      }

      if (parsed.data.strategy === 'duplicate') {
        let candidate = duplicateVariant(prepared, duplicateCounter)
        let candidateKey = buildUniqueRecordKey(candidate)

        while (existingByKey.has(candidateKey)) {
          duplicateCounter += 1
          candidate = duplicateVariant(prepared, duplicateCounter)
          candidateKey = buildUniqueRecordKey(candidate)
        }

        const createdRecord = await prisma.record.create({
          data: {
            ...toPrismaRecordData(candidate),
            statusId,
            history: {
              create: {
                message: 'Criado por importação (duplicado resolvido).',
              },
            },
          },
          select: { id: true },
        })

        existingByKey.set(candidateKey, createdRecord.id)
        created += 1
        duplicatesCreated += 1
        duplicateCounter += 1
        continue
      }
    }

    try {
      const createdRecord = await prisma.record.create({
        data: {
          ...toPrismaRecordData(prepared),
          statusId,
          history: {
            create: {
              message: 'Criado por importação.',
            },
          },
        },
        select: { id: true },
      })

      key = buildUniqueRecordKey(prepared)
      existingByKey.set(key, createdRecord.id)
      created += 1
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        skipped += 1
        continue
      }
      throw error
    }
  }

  res.json({
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

app.post('/api/seed', async (req, res) => {
  const body = z.object({ replace: z.boolean().optional() }).safeParse(req.body)
  if (!body.success) {
    return res.status(400).json({ error: 'Payload inválido.' })
  }

  const defaults = await ensureDefaults()

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

  const defaults = await ensureDefaults()

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

app.use((err: unknown, _req: express.Request, res: express.Response) => {
  console.error(err)
  if (err instanceof Prisma.PrismaClientInitializationError || err instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(503).json({ error: databaseSetupHint() })
  }
  return res.status(500).json({ error: 'Erro interno do servidor.' })
})

app.listen(PORT, () => {
  console.log(`[api] running on http://localhost:${PORT}`)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
