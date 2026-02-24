import 'dotenv/config'

import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'
import { z } from 'zod'

import { createCorsMiddleware } from './middleware/cors'
import { createErrorHandler } from './middleware/errorHandler'
import { aiRouter } from './routes/ai'
import { createRecordsRouter } from './routes/records'
import { createDsRouter } from './routes/ds'
import { createPenhorasRouter } from './routes/penhoras'
import { createStatusesRouter } from './routes/statuses'

import {
  saveViewSchema,
  taxRuleSchema,
  calculationSettingsSchema,
} from './schemas/records'
import {
  buildUniqueRecordKey,
  toPrismaRecordData,
} from './utils'
import {
  databaseSetupHint,
  savedViewDto,
  toApiTaxRule,
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

app.use('/api/ai', aiRouter)
app.use('/api', createRecordsRouter(prisma))
app.use('/api/ds', createDsRouter(prisma))
app.use('/api/penhoras', createPenhorasRouter(prisma))
app.use('/api', createStatusesRouter(prisma))

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, db: 'up', now: new Date().toISOString() })
  } catch {
    res.status(503).json({ ok: false, db: 'down', now: new Date().toISOString() })
  }
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
