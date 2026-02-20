import ExcelJS from 'exceljs'

import type { DsParsedImport, ParsedImport, PenhorasParsedImport, ReceiptRecord, RecordType } from '../types'
import { normalizeText, parseDateToISO } from './utils'

const MONTH_NAME_TO_NUM: Record<string, number> = {
  JANEIRO: 1,
  FEVEREIRO: 2,
  MARCO: 3,
  MARÇO: 3,
  ABRIL: 4,
  MAIO: 5,
  JUNHO: 6,
  JULHO: 7,
  AGOSTO: 8,
  SETEMBRO: 9,
  OUTUBRO: 10,
  NOVEMBRO: 11,
  DEZEMBRO: 12,
}

type ImportField =
  | 'processo'
  | 'pe'
  | 'gpeSe'
  | 'gestor'
  | 'exequente'
  | 'descricaoValor'
  | 'indicacoes'
  | 'retencao'
  | 'meu5'
  | 'valorEmissao'
  | 'valorIndicado'
  | 'valorSemIva'
  | 'iva'
  | 'dataLevantamento'
  | 'reciboNumero'

function parseNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined
  }

  const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

function toHexColor(color: string): string {
  const value = color.trim().toUpperCase()
  if (/^#[0-9A-F]{6}$/.test(value)) {
    return value
  }
  if (/^[0-9A-F]{8}$/.test(value)) {
    return `#${value.slice(2)}`
  }
  if (/^[0-9A-F]{6}$/.test(value)) {
    return `#${value}`
  }
  return '#BFC4CC'
}

function detectTypeFromSheetName(name: string): RecordType {
  return normalizeText(name).includes('EXECUTADOS') ? 'executado' : 'exequente'
}

function parsePeriodFromSheetName(name: string): { mes: number; ano: number } {
  const normalized = normalizeText(name)
  const yearMatch = normalized.match(/(20\d{2})/)
  const ano = yearMatch ? Number(yearMatch[1]) : 2025

  let mes = new Date().getMonth() + 1
  for (const [monthName, monthNumber] of Object.entries(MONTH_NAME_TO_NUM)) {
    if (normalized.includes(monthName)) {
      mes = monthNumber
      break
    }
  }

  return { mes, ano }
}

function getCellRawValue(cellValue: ExcelJS.CellValue): unknown {
  if (cellValue === null || cellValue === undefined) {
    return undefined
  }

  if (typeof cellValue === 'object') {
    if ('result' in cellValue && typeof cellValue.result !== 'undefined') {
      return cellValue.result
    }
    if ('richText' in cellValue && Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((segment) => segment.text).join('')
    }
    if ('text' in cellValue && typeof cellValue.text === 'string') {
      return cellValue.text
    }
    if ('formula' in cellValue && typeof cellValue.formula === 'string') {
      return cellValue.result ?? cellValue.formula
    }
    if ('hyperlink' in cellValue && typeof cellValue.hyperlink === 'string') {
      return cellValue.text ?? cellValue.hyperlink
    }
    if ('error' in cellValue) {
      return undefined
    }
  }

  return cellValue
}

function getRowValues(row: ExcelJS.Row): ExcelJS.CellValue[] {
  const values = row.values
  if (!Array.isArray(values)) {
    return []
  }
  return values.slice(1) as ExcelJS.CellValue[]
}

function extractRowColor(row: ExcelJS.Row, maxColumn: number): string {
  for (let col = 1; col <= maxColumn; col += 1) {
    const cell = row.getCell(col)
    const fill = cell.fill

    if (!fill || fill.type !== 'pattern' || fill.pattern !== 'solid') {
      continue
    }

    const argb = fill.fgColor?.argb
    const theme = fill.fgColor?.theme
    const tint = (fill.fgColor as { tint?: number } | undefined)?.tint

    if (argb) {
      return toHexColor(argb)
    }
    if (typeof theme !== 'undefined') {
      return `TEMA:${theme}${typeof tint !== 'undefined' ? `:${tint}` : ''}`
    }
  }

  return 'SEM_COR'
}

function detectHeaderRow(worksheet: ExcelJS.Worksheet): number {
  const maxProbe = Math.min(15, worksheet.rowCount)

  for (let rowNumber = 1; rowNumber <= maxProbe; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const values = getRowValues(row)
      .map((value: ExcelJS.CellValue) => normalizeText(getCellRawValue(value)))
      .filter(Boolean)

    const hasProcesso = values.some((value) => value.includes('PROCESSO'))
    const hasPe = values.some((value) => value === 'PE' || value.includes(' PE'))

    if (hasProcesso && hasPe) {
      return rowNumber
    }
  }

  return 1
}

function fieldNameFromHeader(header: string): ImportField | undefined {
  const normalized = normalizeText(header)

  if (!normalized) {
    return undefined
  }
  if (normalized.includes('PROCESSO')) {
    return 'processo'
  }
  if (normalized === 'PE' || normalized.startsWith('PE/')) {
    return 'pe'
  }
  if (normalized === 'GPESE' || normalized.includes('CONTA GPESE')) {
    return 'gpeSe'
  }
  if (normalized.includes('GESTOR')) {
    return 'gestor'
  }
  if (normalized.includes('EXEQUENTE')) {
    return 'exequente'
  }
  if (normalized.includes('DESCRICAO') || normalized.includes('DESCRIÇÃO')) {
    return 'descricaoValor'
  }
  if (normalized.includes('INDICAC')) {
    return 'indicacoes'
  }
  if (normalized.includes('RETEN')) {
    return 'retencao'
  }
  if (normalized.includes('MEU 5')) {
    return 'meu5'
  }
  if (normalized.includes('VALOR EMIS')) {
    return 'valorEmissao'
  }
  if (normalized.includes('VALOR INDICADO')) {
    return 'valorIndicado'
  }
  if (normalized.includes('VALOR S/ BCP')) {
    return 'valorIndicado'
  }
  if (normalized.includes('VALOR SEM IVA') || normalized.includes('LEVANTADO S/IVA')) {
    return 'valorSemIva'
  }
  if (normalized.includes('VALOR PARA LEVANTAR') || normalized.includes('VALOR S/ MINHA %')) {
    return 'valorSemIva'
  }
  if (normalized === 'IVA') {
    return 'iva'
  }
  if (normalized.includes('LEVANTAMENTO') || normalized === 'LEVANTADO' || normalized === 'DATA') {
    return 'dataLevantamento'
  }
  if (normalized.includes('RECIBO')) {
    return 'reciboNumero'
  }

  return undefined
}

export async function parseImportedWorkbook(fileName: string, buffer: ArrayBuffer): Promise<ParsedImport> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const colorCount: Record<string, number> = {}
  const rows: Partial<ReceiptRecord>[] = []

  workbook.eachSheet((sheet) => {
    const tipo = detectTypeFromSheetName(sheet.name)
    const { mes, ano } = parsePeriodFromSheetName(sheet.name)
    const headerRowNumber = detectHeaderRow(sheet)
    const headerRow = sheet.getRow(headerRowNumber)
    const headers = getRowValues(headerRow).map((value: ExcelJS.CellValue) => String(getCellRawValue(value) ?? ''))
    const maxCol = headers.length

    for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber)
      const values = getRowValues(row).map((value: ExcelJS.CellValue) => getCellRawValue(value))

      if (!values.some((value) => value !== undefined && String(value).trim() !== '')) {
        continue
      }

      const sourceColor = extractRowColor(row, maxCol)
      colorCount[sourceColor] = (colorCount[sourceColor] ?? 0) + 1

      const record: Partial<ReceiptRecord> = {
        id: crypto.randomUUID(),
        tipo,
        mes,
        ano,
        sourceColor,
        sourceSheet: sheet.name,
      }

      for (let col = 1; col <= maxCol; col += 1) {
        const rawHeader = headers[col - 1]
        const value = values[col - 1]

        if (value === undefined || value === null || String(value).trim() === '') {
          continue
        }

        const field = fieldNameFromHeader(rawHeader)
        if (!field) {
          continue
        }

        if (field === 'reciboNumero') {
          const maybeDate = parseDateToISO(value)
          if (maybeDate) {
            record.dataRecibo = maybeDate
          } else {
            record.reciboNumero = String(value).trim()
          }
          continue
        }

        if (field === 'dataLevantamento') {
          const maybeDate = parseDateToISO(value)
          if (maybeDate) {
            record.dataLevantamento = maybeDate
          } else {
            const text = String(value).trim()
            if (text) {
              record.indicacoes = record.indicacoes ? `${record.indicacoes} | ${text}` : text
            }
          }
          continue
        }

        if (
          field === 'gpeSe' ||
          field === 'valorIndicado' ||
          field === 'valorSemIva' ||
          field === 'iva' ||
          field === 'retencao' ||
          field === 'valorEmissao' ||
          field === 'meu5'
        ) {
          const parsed = typeof value === 'number' ? value : parseNumber(String(value))
          if (parsed !== undefined) {
            if (field === 'gpeSe') {
              const gpeSeText = `GPESE: ${parsed.toFixed(2)}`
              if (!record.indicacoes?.includes('GPESE:')) {
                record.indicacoes = record.indicacoes ? `${record.indicacoes} | ${gpeSeText}` : gpeSeText
              }
              continue
            }
            ;(record as Record<ImportField, unknown>)[field] = parsed
          }
          continue
        }

        if (field === 'indicacoes') {
          const text = String(value).trim()
          record.indicacoes = record.indicacoes ? `${record.indicacoes} | ${text}` : text
          continue
        }

        if (field === 'processo' || field === 'pe' || field === 'gestor' || field === 'exequente' || field === 'descricaoValor') {
          ;(record as Record<ImportField, unknown>)[field] = String(value).trim()
        }
      }

      const meaningful = record.processo || record.pe || record.reciboNumero || record.valorSemIva || record.valorIndicado || record.valorEmissao
      if (meaningful) {
        rows.push(record)
      }
    }
  })

  return {
    fileName,
    parsedAt: new Date().toISOString(),
    rows,
    colorCount,
  }
}

type DsFieldKey =
  | 'gestora'
  | 'proponentes'
  | 'referencia'
  | 'produto'
  | 'valor'
  | 'dataEscritura'
  | 'entidadeBancaria'
  | 'dataFechoCrm'
  | 'liderCalculo'
  | 'comissaoLoja'
  | 'ivaCgd'
  | 'totalComissaoLojaCmIva'
  | 'comissaoGestor'
  | 'percentagem'
  | 'pagComissaoGestor'
  | 'recibo'
  | 'faltaReciboGestora'

function deriveDsStatusKey(faltaReciboGestora: unknown, recibo: unknown): string {
  const lastColumnText = normalizeText(faltaReciboGestora)
  const reciboText = String(recibo ?? '').trim()

  if (lastColumnText.includes('AGUARDA PAGAMENTO BANCO')) return 'ds-aguarda-pagamento-banco'
  if (lastColumnText.includes('FALTA RECIBO GESTORA')) return 'ds-falta-recibo-gestora'
  if (lastColumnText.includes('PAGAS PELO BANCO') || lastColumnText.includes('COMISSAO PAGA GESTORA')) {
    return 'ds-pagas-banco-comissao-gestora'
  }

  if (!reciboText) return 'ds-falta-recibo-gestora'
  return 'ds-pagas-banco-comissao-gestora'
}

function mapDsHeader(header: string): DsFieldKey | undefined {
  const normalized = normalizeText(header)
  if (!normalized) return undefined
  if (normalized.includes('FALTA RECIBO GESTORA')) return 'faltaReciboGestora'
  if (normalized.includes('GESTORA')) return 'gestora'
  if (normalized.includes('PROPONENTES')) return 'proponentes'
  if (normalized.includes('REFERENCIA')) return 'referencia'
  if (normalized.includes('PRODUTO')) return 'produto'
  if (normalized === 'VALOR' || normalized.startsWith('VALOR ')) return 'valor'
  if (normalized.includes('DATA ESCRITURA')) return 'dataEscritura'
  if (normalized.includes('ENTIDADE BANCARIA')) return 'entidadeBancaria'
  if (normalized.includes('DATA FECHO CRM')) return 'dataFechoCrm'
  if (normalized.includes('LIDER CALCULO')) return 'liderCalculo'
  if (normalized.includes('COMISSAO LOJA') && !normalized.includes('TOTAL')) return 'comissaoLoja'
  if (normalized.includes('IVA CGD')) return 'ivaCgd'
  if (normalized.includes('TOTAL COMISSAO LOJA')) return 'totalComissaoLojaCmIva'
  if (normalized.includes('COMISSAO GESTOR')) return 'comissaoGestor'
  if (normalized.includes('PERCENTAGEM')) return 'percentagem'
  if (normalized.includes('PAG. COMISSAO GESTOR')) return 'pagComissaoGestor'
  if (normalized === 'RECIBO') return 'recibo'
  return undefined
}

export async function parseDsWorkbook(fileName: string, buffer: ArrayBuffer): Promise<DsParsedImport> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets.find((item) => normalizeText(item.name).includes('ESCRITURAS CONCRETIZADAS')) ?? workbook.worksheets[0]

  if (!sheet) {
    return {
      fileName,
      parsedAt: new Date().toISOString(),
      rows: [],
      colorCount: {},
    }
  }

  const headerRowNumber = 4
  const headerRow = sheet.getRow(headerRowNumber)
  const headers = getRowValues(headerRow).map((value: ExcelJS.CellValue) => String(getCellRawValue(value) ?? ''))
  const maxCol = headers.length

  const rows: Array<Record<string, unknown>> = []
  const colorCount: Record<string, number> = {}

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const values = getRowValues(row).map((value: ExcelJS.CellValue) => getCellRawValue(value))
    if (!values.some((value) => value !== undefined && value !== null && String(value).trim() !== '')) continue

    const sourceColor = extractRowColor(row, maxCol)
    colorCount[sourceColor] = (colorCount[sourceColor] ?? 0) + 1

    const dsRow: Record<string, unknown> = {
      sourceFile: fileName,
      sourceSheet: sheet.name,
      sourceRowNumber: rowNumber,
      sourceColor,
    }

    for (let col = 1; col <= maxCol; col += 1) {
      const header = headers[col - 1]
      const field = mapDsHeader(header)
      if (!field) continue

      const value = values[col - 1]
      if (value === undefined || value === null || String(value).trim() === '') continue

      const textValue = String(value).trim()
      if (field === 'dataEscritura' || field === 'dataFechoCrm' || field === 'pagComissaoGestor') {
        const parsedDate = parseDateToISO(value)
        if (parsedDate) {
          dsRow[field] = parsedDate
        }
        continue
      }

      dsRow[field] = textValue

      if (field === 'valor') {
        if (typeof value === 'number') dsRow.valor = value
      }
      if (field === 'comissaoLoja') {
        if (typeof value === 'number') dsRow.comissaoLoja = value
      }
      if (field === 'totalComissaoLojaCmIva') {
        if (typeof value === 'number') dsRow.totalComissaoLojaCmIva = value
      }
      if (field === 'comissaoGestor') {
        if (typeof value === 'number') dsRow.comissaoGestor = value
      }
      if (field === 'percentagem') {
        if (typeof value === 'number') dsRow.percentagem = value
      }
    }

    if (dsRow.referencia || dsRow.proponentes || dsRow.dataEscritura) {
      dsRow.statusId = deriveDsStatusKey(dsRow.faltaReciboGestora, dsRow.recibo)
      rows.push(dsRow)
    }
  }

  return {
    fileName,
    parsedAt: new Date().toISOString(),
    rows,
    colorCount,
  }
}

type PenhorasFieldKey = 'pe' | 'acto' | 'dataPedido' | 'identificacao' | 'pedido' | 'gestor'

const PENHORAS_LEGEND_ACTO_NORMALIZED = new Set(
  [
    'LEGENDA',
    'LEGENDA:',
    'REGISTADOS',
    'RECUSADOS/DESISTENCIA',
    'RECUSADOS / DESISTENCIA',
    'AGUARDA REGISTO',
    'ATRASADOS - FEITOS REFORCOS A CADA 10 DIAS',
    'ATRASADOS - FEITOS REFORÇOS A CADA 10 DIAS',
  ].map((value) => normalizeText(value).replace(/\s+/g, ' ').trim()),
)

function isPlaceholderPenhorasValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  const trimmed = String(value).trim()
  return trimmed === '' || trimmed === '-' || trimmed === '--' || trimmed === '—'
}

function isLegendPenhorasImportRow(row: Record<string, unknown>): boolean {
  const acto = typeof row.acto === 'string' ? row.acto : undefined
  if (!acto) return false
  const normalizedActo = normalizeText(acto).replace(/\s+/g, ' ').trim()
  if (!PENHORAS_LEGEND_ACTO_NORMALIZED.has(normalizedActo)) return false

  return (
    isPlaceholderPenhorasValue(row.pe) &&
    isPlaceholderPenhorasValue(row.identificacao) &&
    isPlaceholderPenhorasValue(row.pedido) &&
    isPlaceholderPenhorasValue(row.gestor) &&
    !row.dataPedido
  )
}

function mapPenhorasHeader(header: string): PenhorasFieldKey | undefined {
  const normalized = normalizeText(header)
  if (!normalized) return undefined
  if (normalized === 'PE') return 'pe'
  if (normalized.includes('ACTO')) return 'acto'
  if (normalized.includes('DATA') && normalized.includes('PEDIDO')) return 'dataPedido'
  if (normalized.includes('IDENTIFICACAO')) return 'identificacao'
  if (normalized === 'PEDIDO') return 'pedido'
  if (normalized.includes('GESTOR')) return 'gestor'
  return undefined
}

function derivePenhorasStatusKey(acto: unknown): string {
  const normalized = normalizeText(acto)
  if (normalized.includes('RECUS') || normalized.includes('DESIST')) return 'penhoras-recusados-desistencia'
  if (normalized.includes('ATRASAD') || normalized.includes('REFORC')) return 'penhoras-atrasados-reforcos-10-dias'
  if (normalized.includes('AGUARDA') && normalized.includes('REGIST')) return 'penhoras-aguarda-registo'
  if (normalized.includes('REGISTAD')) return 'penhoras-registados'
  // Compatibility with legacy values from older spreadsheets.
  if (normalized.includes('CANCELAMENTO')) return 'penhoras-recusados-desistencia'
  if (normalized.includes('PENHORA')) return 'penhoras-registados'
  return 'penhoras-aguarda-registo'
}

export async function parsePenhorasWorkbook(fileName: string, buffer: ArrayBuffer): Promise<PenhorasParsedImport> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet =
    workbook.worksheets.find((item) => normalizeText(item.name).includes('PENHORAS')) ??
    workbook.worksheets.find((item) => normalizeText(item.name).includes('REGISTO')) ??
    workbook.worksheets[0]

  if (!sheet) {
    return {
      fileName,
      parsedAt: new Date().toISOString(),
      rows: [],
      colorCount: {},
    }
  }

  const headerRowNumber = 1
  const headerRow = sheet.getRow(headerRowNumber)
  const headers = getRowValues(headerRow).map((value: ExcelJS.CellValue) => String(getCellRawValue(value) ?? ''))
  const maxCol = headers.length

  const rows: Array<Record<string, unknown>> = []
  const colorCount: Record<string, number> = {}

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const values = getRowValues(row).map((value: ExcelJS.CellValue) => getCellRawValue(value))
    if (!values.some((value) => value !== undefined && value !== null && String(value).trim() !== '')) continue

    const sourceColor = extractRowColor(row, maxCol)
    colorCount[sourceColor] = (colorCount[sourceColor] ?? 0) + 1

    const penhorasRow: Record<string, unknown> = {
      sourceFile: fileName,
      sourceSheet: sheet.name,
      sourceRowNumber: rowNumber,
      sourceColor,
    }

    for (let col = 1; col <= maxCol; col += 1) {
      const header = headers[col - 1]
      const field = mapPenhorasHeader(header)
      if (!field) continue

      const value = values[col - 1]
      if (value === undefined || value === null || String(value).trim() === '') continue

      if (field === 'dataPedido') {
        const parsedDate = parseDateToISO(value)
        if (parsedDate) penhorasRow.dataPedido = parsedDate
        continue
      }

      if (field === 'pedido') {
        const asNumber = typeof value === 'number' ? Math.round(value) : Number(String(value).replace(/[^\d]/g, ''))
        penhorasRow.pedido = Number.isFinite(asNumber) ? String(asNumber) : String(value).trim()
        continue
      }

      if (field === 'gestor') {
        const normalizedGestor = String(value).trim()
        if (normalizedGestor && !isPlaceholderPenhorasValue(normalizedGestor)) {
          penhorasRow.gestor = normalizedGestor.toUpperCase()
        }
        continue
      }

      penhorasRow[field] = String(value).trim()
    }

    if (isLegendPenhorasImportRow(penhorasRow)) {
      continue
    }

    if (penhorasRow.pe || penhorasRow.acto || penhorasRow.identificacao || penhorasRow.dataPedido) {
      penhorasRow.statusId = derivePenhorasStatusKey(penhorasRow.acto)
      rows.push(penhorasRow)
    }
  }

  return {
    fileName,
    parsedAt: new Date().toISOString(),
    rows,
    colorCount,
  }
}
