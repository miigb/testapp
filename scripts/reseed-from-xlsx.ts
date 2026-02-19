import fs from 'node:fs/promises'
import path from 'node:path'

import { parseImportedWorkbook } from '../src/lib/importParser'

type SeedRecord = Record<string, unknown>

const DEFAULT_XLSX = '/Users/miguelbrito/Downloads/RECIBOS EMITIDOS 2025.xlsx'

const COLOR_TO_STATUS_KEY: Record<string, string> = {
  '#00B0F0': 'status-prep',
  '#FFFF00': 'status-aguarda',
  '#92D050': 'status-validacao',
  '#4C78A8': 'status-emitido',
  '#FF0000': 'status-bloqueado',
  '#0B8A5D': 'status-concluido',
}

function normalizeColor(value: unknown): string {
  if (typeof value !== 'string') return 'SEM_COR'
  const trimmed = value.trim().toUpperCase()
  if (/^#[0-9A-F]{6}$/.test(trimmed)) return trimmed
  return trimmed || 'SEM_COR'
}

function statusKeyForColor(sourceColor: unknown): string {
  const normalized = normalizeColor(sourceColor)
  return COLOR_TO_STATUS_KEY[normalized] ?? 'status-sem'
}

async function main() {
  const filePath = process.argv[2] ?? DEFAULT_XLSX
  const outputPath = path.join(process.cwd(), 'public', 'seed-records.json')

  const buffer = await fs.readFile(filePath)
  const parsed = await parseImportedWorkbook(path.basename(filePath), buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))

  const now = new Date().toISOString()
  const records: SeedRecord[] = parsed.rows.map((row) => ({
    ...row,
    statusId: statusKeyForColor(row.sourceColor),
    createdAt: now,
    updatedAt: now,
    history: [],
  }))

  const payload = {
    version: 1,
    generatedAt: now,
    sourceFile: filePath,
    count: records.length,
    records,
  }

  await fs.writeFile(outputPath, `${JSON.stringify(payload)}\n`, 'utf8')

  console.log(`[seed] source=${filePath}`)
  console.log(`[seed] rows=${records.length}`)
  console.log(`[seed] output=${outputPath}`)
}

main().catch((error) => {
  console.error('[seed] failed', error)
  process.exitCode = 1
})
