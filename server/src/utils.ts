import type { CalculationSettings, RecordType, TaxRule, TaxTargetField } from '@prisma/client'

export type RecordInputData = {
  tipo: RecordType
  mes: number
  ano: number
  processo?: string
  pe?: string
  reciboNumero?: string
  dataLevantamento?: string
  dataRecibo?: string
  valorIndicado?: number
  valorSemIva?: number
  iva?: number
  retencao?: number
  valorEmissao?: number
  meu5?: number
  outrasTaxas?: number
  gestor?: string
  exequente?: string
  descricaoValor?: string
  indicacoes?: string
  sourceColor?: string
  sourceSheet?: string
  statusId?: string
}

const DECIMAL_FIELDS = ['valorIndicado', 'valorSemIva', 'iva', 'retencao', 'valorEmissao', 'meu5', 'outrasTaxas'] as const

type DecimalField = (typeof DECIMAL_FIELDS)[number]

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

export function buildUniqueRecordKey(record: Pick<RecordInputData, 'tipo' | 'ano' | 'mes' | 'processo' | 'pe' | 'reciboNumero'>): string {
  return [
    record.tipo,
    record.ano,
    record.mes,
    normalizeText(record.processo),
    normalizeText(record.pe),
    normalizeText(record.reciboNumero),
  ].join('|')
}

export function toNumberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function toIsoDateOrUndefined(value: unknown): string | undefined {
  if (!value) {
    return undefined
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  const text = String(value).trim()
  if (!text) {
    return undefined
  }

  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3])
    const date = new Date(Date.UTC(year, month - 1, day))
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10)
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10)
}

export function asDateOrNull(value?: string): Date | null {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function roundValue(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function getBaseValue(data: RecordInputData, baseField: TaxRule['baseField']): number | undefined {
  if (baseField === 'valorIndicado') {
    return data.valorIndicado
  }
  if (baseField === 'valorSemIva') {
    return data.valorSemIva
  }
  if (baseField === 'valorEmissao') {
    return data.valorEmissao
  }
  return undefined
}

function targetFieldKey(field: TaxTargetField): DecimalField {
  if (field === 'iva') {
    return 'iva'
  }
  if (field === 'retencao') {
    return 'retencao'
  }
  if (field === 'meu5') {
    return 'meu5'
  }
  return 'outrasTaxas'
}

function inferValorSemIvaFromValorIndicado(
  output: RecordInputData,
  taxRules: TaxRule[],
  precision: number,
  forceRecalculate: boolean,
) {
  const hasValorSemIva = typeof output.valorSemIva === 'number'
  if (hasValorSemIva && !forceRecalculate) {
    return
  }

  if (typeof output.valorIndicado !== 'number') {
    return
  }

  const ivaRule = taxRules
    .filter((candidate) => candidate.enabled && candidate.targetField === 'iva' && candidate.baseField === 'valorSemIva')
    .sort((a, b) => a.order - b.order)[0]

  if (!ivaRule) {
    return
  }

  const rate = Number(ivaRule.rate)
  if (!Number.isFinite(rate) || rate <= -1) {
    return
  }

  output.valorSemIva = roundValue(output.valorIndicado / (1 + rate), precision)
}

export function applyCalculations(
  source: RecordInputData,
  settings: CalculationSettings,
  taxRules: TaxRule[],
  forceRecalculate = false,
): RecordInputData {
  const output: RecordInputData = { ...source }

  if (!settings.autoApplyRules) {
    return output
  }

  const precision = Math.max(0, Math.min(6, settings.roundTo || 2))
  inferValorSemIvaFromValorIndicado(output, taxRules, precision, forceRecalculate)

  for (const rule of taxRules.filter((candidate) => candidate.enabled).sort((a, b) => a.order - b.order)) {
    const base = getBaseValue(output, rule.baseField)
    if (base === undefined) {
      continue
    }

    const targetKey = targetFieldKey(rule.targetField)
    const hasValue = typeof output[targetKey] === 'number'
    if (!forceRecalculate && hasValue) {
      continue
    }

    const rate = Number(rule.rate)
    if (!Number.isFinite(rate)) {
      continue
    }

    output[targetKey] = roundValue(base * rate, precision)
  }

  if (settings.autoComputeValorSemIva) {
    const hasValorSemIva = typeof output.valorSemIva === 'number'
    if (!hasValorSemIva) {
      if (typeof output.valorIndicado === 'number' && typeof output.iva === 'number') {
        output.valorSemIva = roundValue(output.valorIndicado - output.iva, precision)
      } else if (typeof output.valorEmissao === 'number' && typeof output.iva === 'number') {
        output.valorSemIva = roundValue(output.valorEmissao - output.iva, precision)
      }
    }
  }

  if (settings.autoComputeValorEmissao) {
    const hasValorEmissao = typeof output.valorEmissao === 'number'
    if (!hasValorEmissao && typeof output.valorSemIva === 'number') {
      const iva = output.iva ?? 0
      output.valorEmissao = roundValue(output.valorSemIva + iva, precision)
    }
  }

  if (typeof output.valorIndicado !== 'number' && typeof output.valorSemIva === 'number') {
    const iva = output.iva ?? 0
    output.valorIndicado = roundValue(output.valorSemIva + iva, precision)
  }

  return output
}

export function toPrismaRecordData(input: RecordInputData) {
  const data: Record<string, unknown> = {
    tipo: input.tipo,
    mes: input.mes,
    ano: input.ano,
    processo: input.processo ?? null,
    pe: input.pe ?? null,
    reciboNumero: input.reciboNumero ?? null,
    dataLevantamento: asDateOrNull(input.dataLevantamento),
    dataRecibo: asDateOrNull(input.dataRecibo),
    gestor: input.gestor ?? null,
    exequente: input.exequente ?? null,
    descricaoValor: input.descricaoValor ?? null,
    indicacoes: input.indicacoes ?? null,
    sourceColor: input.sourceColor ?? null,
    sourceSheet: input.sourceSheet ?? null,
  }

  for (const field of DECIMAL_FIELDS) {
    data[field] = typeof input[field] === 'number' ? input[field] : null
  }

  if (input.statusId) {
    data.statusId = input.statusId
  }

  return data
}

export function prismaRecordToDto(record: {
  id: string
  tipo: RecordType
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
  createdAt: Date
  updatedAt: Date
  history?: { id: string; message: string; createdAt: Date }[]
  status?: { id: string; key: string; label: string; icon: string; color: string; active: boolean; order: number }
}) {
  const numberOrUndefined = (value: unknown) => {
    if (value === null || value === undefined) {
      return undefined
    }

    const asNumber = Number(value)
    return Number.isFinite(asNumber) ? asNumber : undefined
  }

  return {
    id: record.id,
    tipo: record.tipo,
    mes: record.mes,
    ano: record.ano,
    processo: record.processo ?? undefined,
    pe: record.pe ?? undefined,
    reciboNumero: record.reciboNumero ?? undefined,
    dataLevantamento: record.dataLevantamento ? record.dataLevantamento.toISOString().slice(0, 10) : undefined,
    dataRecibo: record.dataRecibo ? record.dataRecibo.toISOString().slice(0, 10) : undefined,
    valorIndicado: numberOrUndefined(record.valorIndicado),
    valorSemIva: numberOrUndefined(record.valorSemIva),
    iva: numberOrUndefined(record.iva),
    retencao: numberOrUndefined(record.retencao),
    valorEmissao: numberOrUndefined(record.valorEmissao),
    meu5: numberOrUndefined(record.meu5),
    outrasTaxas: numberOrUndefined(record.outrasTaxas),
    gestor: record.gestor ?? undefined,
    exequente: record.exequente ?? undefined,
    descricaoValor: record.descricaoValor ?? undefined,
    indicacoes: record.indicacoes ?? undefined,
    sourceColor: record.sourceColor ?? undefined,
    sourceSheet: record.sourceSheet ?? undefined,
    statusId: record.statusId,
    estadoId: record.statusId,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    history:
      record.history?.map((item) => ({
        id: item.id,
        message: item.message,
        at: item.createdAt.toISOString(),
      })) ?? [],
  }
}
