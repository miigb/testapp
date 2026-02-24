import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

import {
  penhorasRecordInputSchema,
  penhorasRecordPatchSchema,
  penhorasImportPreviewSchema,
  penhorasImportCommitSchema,
} from '../schemas/penhoras'
import { statusSchema } from '../schemas/records'
import {
  databaseSetupHint,
  penhorasStatusDto,
  savedViewDto,
} from '../services/shared'
import {
  ensurePenhorasDefaults,
  getDefaultPenhorasStatusId,
  resolvePenhorasStatusId,
  asPenhorasRecordInput,
  toPrismaPenhorasRecordData,
  prismaPenhorasRecordToDto,
  buildPenhorasRecordKey,
  buildPenhorasRecordWhere,
  mergePenhorasRecordWithPatch,
} from '../services/penhoras'

export function createPenhorasRouter(prisma: PrismaClient): Router {
  const router = Router()

  router.get('/bootstrap', async (_req, res) => {
    try {
      const defaults = await ensurePenhorasDefaults(prisma)
      const savedViews = await prisma.savedView.findMany({
        where: { scope: { startsWith: 'penhoras-' } },
        orderBy: { updatedAt: 'desc' },
      })
      const recordCount = await prisma.penhorasRecord.count()

      res.json({
        statuses: defaults.statuses.map(penhorasStatusDto),
        savedViews: savedViews.map(savedViewDto),
        recordCount,
      })
    } catch (error) {
      console.error(error)
      res.status(503).json({ error: databaseSetupHint() })
    }
  })

  router.get('/records', async (req, res) => {
    const page = Number(req.query.page ?? 1)
    const pageSize = Math.min(Number(req.query.pageSize ?? 100), 300)
    const skip = Math.max(page - 1, 0) * pageSize

    const where = buildPenhorasRecordWhere(req.query as Record<string, unknown>)

    const [items, total] = await Promise.all([
      prisma.penhorasRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ dataPedido: 'desc' }, { updatedAt: 'desc' }],
        include: { status: true },
      }),
      prisma.penhorasRecord.count({ where }),
    ])

    res.json({
      items: items.map(prismaPenhorasRecordToDto),
      total,
      page,
      pageSize,
    })
  })

  router.get('/records/:id', async (req, res) => {
    const record = await prisma.penhorasRecord.findUnique({
      where: { id: req.params.id },
      include: { status: true },
    })

    if (!record) {
      return res.status(404).json({ error: 'Registo Penhoras não encontrado.' })
    }

    return res.json(prismaPenhorasRecordToDto(record))
  })

  router.post('/records', async (req, res) => {
    const parsed = penhorasRecordInputSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload Penhoras inválido.', details: parsed.error.flatten() })
    }

    const defaults = await ensurePenhorasDefaults(prisma)
    const fallbackStatusId = getDefaultPenhorasStatusId(defaults)
    if (!fallbackStatusId) {
      return res.status(500).json({ error: 'Estado Penhoras padrão indisponível.' })
    }

    const input = asPenhorasRecordInput(parsed.data as Record<string, unknown>)
    if (!input) {
      return res.status(400).json({ error: 'Linha Penhoras sem dados mínimos.' })
    }
    input.statusId = resolvePenhorasStatusId(input.statusId, defaults, fallbackStatusId, input)

    const created = await prisma.penhorasRecord.create({
      data: toPrismaPenhorasRecordData(input),
      include: { status: true },
    })

    return res.status(201).json(prismaPenhorasRecordToDto(created))
  })

  router.patch('/records/:id', async (req, res) => {
    const parsed = penhorasRecordPatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload Penhoras inválido.', details: parsed.error.flatten() })
    }

    const current = await prisma.penhorasRecord.findUnique({
      where: { id: req.params.id },
    })
    if (!current) {
      return res.status(404).json({ error: 'Registo Penhoras não encontrado.' })
    }

    const merged = mergePenhorasRecordWithPatch(current, parsed.data)
    if (!merged.statusId || typeof merged.statusId === 'string') {
      const defaults = await ensurePenhorasDefaults(prisma)
      const fallbackStatusId = getDefaultPenhorasStatusId(defaults)
      if (!fallbackStatusId) {
        return res.status(500).json({ error: 'Estado Penhoras padrão indisponível.' })
      }
      merged.statusId = resolvePenhorasStatusId(merged.statusId, defaults, fallbackStatusId, merged)
    }

    const updated = await prisma.penhorasRecord.update({
      where: { id: req.params.id },
      data: toPrismaPenhorasRecordData(merged),
      include: { status: true },
    })

    return res.json(prismaPenhorasRecordToDto(updated))
  })

  router.patch('/records/:id/status', async (req, res) => {
    const body = z.object({ statusId: z.string().min(1) }).safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Status Penhoras inválido.' })
    }

    const old = await prisma.penhorasRecord.findUnique({ where: { id: req.params.id } })
    if (!old) {
      return res.status(404).json({ error: 'Registo Penhoras não encontrado.' })
    }

    const defaults = await ensurePenhorasDefaults(prisma)
    const fallbackStatusId = getDefaultPenhorasStatusId(defaults)
    if (!fallbackStatusId) {
      return res.status(500).json({ error: 'Estado Penhoras padrão indisponível.' })
    }
    const resolvedStatusId = resolvePenhorasStatusId(body.data.statusId, defaults, fallbackStatusId)
    const statusExists = defaults.statuses.some((status) => status.id === resolvedStatusId)
    if (!statusExists) {
      return res.status(400).json({ error: 'Status Penhoras inválido.' })
    }

    const updated = await prisma.penhorasRecord.update({
      where: { id: req.params.id },
      data: { statusId: resolvedStatusId },
      include: { status: true },
    })

    return res.json(prismaPenhorasRecordToDto(updated))
  })

  router.get('/statuses', async (_req, res) => {
    const defaults = await ensurePenhorasDefaults(prisma)
    res.json(defaults.statuses.map(penhorasStatusDto))
  })

  router.post('/statuses', async (req, res) => {
    const parsed = statusSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const created = await prisma.penhorasStatus.create({ data: parsed.data })
    res.status(201).json(penhorasStatusDto(created))
  })

  router.patch('/statuses/:id', async (req, res) => {
    const parsed = statusSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const updated = await prisma.penhorasStatus.update({ where: { id: req.params.id }, data: parsed.data })
    res.json(penhorasStatusDto(updated))
  })

  router.delete('/statuses/:id', async (req, res) => {
    const existingStatus = await prisma.penhorasStatus.findUnique({ where: { id: req.params.id } })
    if (!existingStatus) {
      return res.status(404).json({ error: 'Estado Penhoras não encontrado.' })
    }

    const reassignToStatusId = typeof req.query.reassignToStatusId === 'string' ? req.query.reassignToStatusId.trim() : ''
    const dependencyCount = await prisma.penhorasRecord.count({ where: { statusId: req.params.id } })
    if (dependencyCount > 0) {
      if (!reassignToStatusId) {
        return res.status(409).json({ error: 'Estado Penhoras em uso. Marque como inativo em vez de remover.' })
      }

      if (reassignToStatusId === req.params.id) {
        return res.status(400).json({ error: 'Estado Penhoras de reatribuição inválido.' })
      }

      const targetStatus = await prisma.penhorasStatus.findUnique({ where: { id: reassignToStatusId } })
      if (!targetStatus) {
        return res.status(404).json({ error: 'Estado Penhoras de reatribuição não encontrado.' })
      }

      await prisma.$transaction([
        prisma.penhorasRecord.updateMany({
          where: { statusId: req.params.id },
          data: { statusId: reassignToStatusId },
        }),
        prisma.penhorasStatus.delete({ where: { id: req.params.id } }),
      ])

      return res.json({ ok: true, reassigned: dependencyCount })
    }

    await prisma.penhorasStatus.delete({ where: { id: req.params.id } })
    return res.json({ ok: true })
  })

  router.post('/import/preview', async (req, res) => {
    const parsed = penhorasImportPreviewSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload Penhoras inválido.', details: parsed.error.flatten() })
    }

    const defaults = await ensurePenhorasDefaults(prisma)
    const fallbackStatusId = getDefaultPenhorasStatusId(defaults)
    if (!fallbackStatusId) {
      return res.status(500).json({ error: 'Estado Penhoras padrão indisponível.' })
    }

    const existing = await prisma.penhorasRecord.findMany({
      select: { id: true, pe: true, acto: true, dataPedido: true, identificacao: true, pedido: true, gestor: true },
    })
    const existingByKey = new Map(
      existing.map((row) => [
        buildPenhorasRecordKey({
          pe: row.pe ?? undefined,
          acto: row.acto ?? undefined,
          dataPedido: row.dataPedido ? row.dataPedido.toISOString().slice(0, 10) : undefined,
          identificacao: row.identificacao ?? undefined,
          pedido: row.pedido ?? undefined,
          gestor: row.gestor ?? undefined,
        }),
        row.id,
      ]),
    )

    const items = parsed.data.rows.map((raw, index) => {
      const input = asPenhorasRecordInput(raw)
      if (!input) {
        return { index, valid: false, action: 'error', reason: 'Linha Penhoras sem dados mínimos.' }
      }

      const statusId = resolvePenhorasStatusId(input.statusId, defaults, fallbackStatusId, input)
      const key = buildPenhorasRecordKey(input)
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

    return res.json({ summary, items })
  })

  router.post('/import/commit', async (req, res) => {
    const parsed = penhorasImportCommitSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload Penhoras inválido.', details: parsed.error.flatten() })
    }

    const defaults = await ensurePenhorasDefaults(prisma)
    const fallbackStatusId = getDefaultPenhorasStatusId(defaults)
    if (!fallbackStatusId) {
      return res.status(500).json({ error: 'Estado Penhoras padrão indisponível.' })
    }

    const importBatchId = `penhoras-${Date.now()}`
    const existing = await prisma.penhorasRecord.findMany({
      select: { id: true, pe: true, acto: true, dataPedido: true, identificacao: true, pedido: true, gestor: true },
    })
    const existingByKey = new Map(
      existing.map((row) => [
        buildPenhorasRecordKey({
          pe: row.pe ?? undefined,
          acto: row.acto ?? undefined,
          dataPedido: row.dataPedido ? row.dataPedido.toISOString().slice(0, 10) : undefined,
          identificacao: row.identificacao ?? undefined,
          pedido: row.pedido ?? undefined,
          gestor: row.gestor ?? undefined,
        }),
        row.id,
      ]),
    )

    let created = 0
    let updated = 0
    let skipped = 0
    let invalid = 0
    let duplicatesCreated = 0
    let duplicateCounter = 1

    for (const raw of parsed.data.rows) {
      const input = asPenhorasRecordInput(raw)
      if (!input) {
        invalid += 1
        continue
      }
      input.statusId = resolvePenhorasStatusId(input.statusId, defaults, fallbackStatusId, input)
      input.importBatchId = input.importBatchId || importBatchId

      let key = buildPenhorasRecordKey(input)
      const existingId = existingByKey.get(key)

      if (existingId) {
        if (parsed.data.strategy === 'skip') {
          skipped += 1
          continue
        }

        if (parsed.data.strategy === 'update') {
          await prisma.penhorasRecord.update({
            where: { id: existingId },
            data: toPrismaPenhorasRecordData(input),
          })
          updated += 1
          continue
        }

        if (parsed.data.strategy === 'duplicate') {
          const basePedido = input.pedido || String(Date.now())
          while (existingByKey.has(key)) {
            duplicateCounter += 1
            input.pedido = `${basePedido}-dup-${duplicateCounter}`
            key = buildPenhorasRecordKey(input)
          }
        }
      }

      const createdRow = await prisma.penhorasRecord.create({
        data: toPrismaPenhorasRecordData(input),
        select: { id: true },
      })
      existingByKey.set(key, createdRow.id)
      created += 1
      if (existingId && parsed.data.strategy === 'duplicate') {
        duplicatesCreated += 1
      }
    }

    return res.json({
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

  return router
}
