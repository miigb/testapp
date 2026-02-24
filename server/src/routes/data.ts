import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

import { buildUniqueRecordKey, toPrismaRecordData } from '../utils'
import { ensureDefaults, asRecordInput } from '../services/records'

export function createDataRouter(prisma: PrismaClient): Router {
  const router = Router()

  router.post('/seed', async (req, res) => {
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

  router.post('/migrate/local-storage', async (req, res) => {
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

  return router
}
