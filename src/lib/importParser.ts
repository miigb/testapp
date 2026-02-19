import ExcelJS from 'exceljs'

import type { ParsedImport, ReceiptRecord, RecordType } from '../types'

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

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function parseNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined
  }

  const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseDateToISO(value: unknown): string | undefined {
  if (!value) {
    return undefined
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10)
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
