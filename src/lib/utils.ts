// Shared frontend utilities — used by importParser.ts and any other frontend module
// that needs text normalisation or date parsing without pulling in server code.

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

export function parseDateToISO(value: unknown): string | undefined {
  if (!value) {
    return undefined
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  // Excel serial date number
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
