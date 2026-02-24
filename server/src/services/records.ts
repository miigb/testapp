import { Prisma, type PrismaClient, type Status } from '@prisma/client'
import { z } from 'zod'

import { DEFAULT_STATUSES, DEFAULT_TAX_RULES } from '../defaults'
import { recordPatchSchema } from '../schemas/records'
import { normalizeText, toIsoDateOrUndefined, toNumberOrUndefined, type RecordInputData } from '../utils'
import { queryValue } from './shared'

export type PrismaCurrentRecord = {
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

export function mergeRecordWithPatch(current: PrismaCurrentRecord, patch: z.infer<typeof recordPatchSchema>): RecordInputData {
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

export function asRecordInput(raw: Record<string, unknown>): RecordInputData | null {
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


export async function ensureDefaults(prisma: PrismaClient) {
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

export function buildRecordWhere(query: Record<string, unknown>): Prisma.RecordWhereInput {
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

export function detectStatusIdFromColor(
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
