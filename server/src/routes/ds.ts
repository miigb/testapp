import { Router } from 'express'
import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

import {
  dsRecordInputSchema,
  dsRecordPatchSchema,
  dsImportPreviewSchema,
  dsImportCommitSchema,
} from '../schemas/ds'
import { statusSchema } from '../schemas/records'
import {
  databaseSetupHint,
  dsStatusDto,
  savedViewDto,
} from '../services/shared'
import { toNumberOrUndefined } from '../utils'
import {
  ensureDsDefaults,
  getDefaultDsStatusId,
  resolveDsStatusId,
  asDsRecordInput,
  toPrismaDsRecordData,
  prismaDsRecordToDto,
  buildDsRecordKey,
  buildDsRecordWhere,
  mergeDsRecordWithPatch,
} from '../services/ds'

export function createDsRouter(prisma: PrismaClient): Router {
  const router = Router()

  router.get('/bootstrap', async (_req, res) => {
    try {
      const defaults = await ensureDsDefaults(prisma)
      const savedViews = await prisma.savedView.findMany({
        where: { scope: { startsWith: 'ds-' } },
        orderBy: { updatedAt: 'desc' },
      })
      const recordCount = await prisma.dsRecord.count({ where: { deletedAt: null } })

      res.json({
        statuses: defaults.statuses.map(dsStatusDto),
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

    const where: Prisma.DsRecordWhereInput = {
      ...buildDsRecordWhere(req.query as Record<string, unknown>),
      deletedAt: null,
    }

    const [items, total] = await Promise.all([
      prisma.dsRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ dataEscritura: 'desc' }, { updatedAt: 'desc' }],
        include: { status: true },
      }),
      prisma.dsRecord.count({ where }),
    ])

    res.json({
      items: items.map(prismaDsRecordToDto),
      total,
      page,
      pageSize,
    })
  })

  router.get('/records/trash', async (req, res) => {
    const page = Number(req.query.page ?? 1)
    const pageSize = Math.min(Number(req.query.pageSize ?? 100), 300)
    const skip = Math.max(page - 1, 0) * pageSize
    const where: Prisma.DsRecordWhereInput = { deletedAt: { not: null } }

    const [items, total] = await Promise.all([
      prisma.dsRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { deletedAt: 'desc' },
        include: {
          status: true,
          deletedBy: {
            select: { id: true, username: true, displayName: true },
          },
        },
      }),
      prisma.dsRecord.count({ where }),
    ])

    return res.json({
      items: items.map((record) => ({
        ...prismaDsRecordToDto(record),
        deletedAt: record.deletedAt?.toISOString() ?? null,
        deletedBy: record.deletedBy ?? null,
      })),
      total,
      page,
      pageSize,
    })
  })

  router.get('/records/:id', async (req, res) => {
    const record = await prisma.dsRecord.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { status: true },
    })

    if (!record) {
      return res.status(404).json({ error: 'Registo DS não encontrado.' })
    }

    return res.json(prismaDsRecordToDto(record))
  })

  router.post('/records', async (req, res) => {
    const parsed = dsRecordInputSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload DS inválido.', details: parsed.error.flatten() })
    }

    const defaults = await ensureDsDefaults(prisma)
    const fallbackStatusId = getDefaultDsStatusId(defaults)
    if (!fallbackStatusId) {
      return res.status(500).json({ error: 'Estado DS padrão indisponível.' })
    }

    const input = asDsRecordInput(parsed.data as Record<string, unknown>)
    if (!input) {
      return res.status(400).json({ error: 'Linha DS sem dados mínimos.' })
    }
    input.statusId = resolveDsStatusId(input.statusId, defaults, fallbackStatusId, input)

    const created = await prisma.dsRecord.create({
      data: toPrismaDsRecordData(input),
      include: { status: true },
    })

    return res.status(201).json(prismaDsRecordToDto(created))
  })

  router.patch('/records/:id', async (req, res) => {
    const parsed = dsRecordPatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload DS inválido.', details: parsed.error.flatten() })
    }

    const current = await prisma.dsRecord.findFirst({
      where: { id: req.params.id, deletedAt: null },
    })
    if (!current) {
      return res.status(404).json({ error: 'Registo DS não encontrado.' })
    }

    const merged = mergeDsRecordWithPatch(current, parsed.data)
    if (!merged.statusId || typeof merged.statusId === 'string') {
      const defaults = await ensureDsDefaults(prisma)
      const fallbackStatusId = getDefaultDsStatusId(defaults)
      if (!fallbackStatusId) {
        return res.status(500).json({ error: 'Estado DS padrão indisponível.' })
      }
      merged.statusId = resolveDsStatusId(merged.statusId, defaults, fallbackStatusId, merged)
    }

    const updated = await prisma.dsRecord.update({
      where: { id: req.params.id },
      data: toPrismaDsRecordData(merged),
      include: { status: true },
    })

    return res.json(prismaDsRecordToDto(updated))
  })

  router.patch('/records/:id/status', async (req, res) => {
    const body = z.object({ statusId: z.string().min(1) }).safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Status DS inválido.' })
    }

    const old = await prisma.dsRecord.findFirst({ where: { id: req.params.id, deletedAt: null } })
    if (!old) {
      return res.status(404).json({ error: 'Registo DS não encontrado.' })
    }

    const defaults = await ensureDsDefaults(prisma)
    const fallbackStatusId = getDefaultDsStatusId(defaults)
    if (!fallbackStatusId) {
      return res.status(500).json({ error: 'Estado DS padrão indisponível.' })
    }
    const resolvedStatusId = resolveDsStatusId(body.data.statusId, defaults, fallbackStatusId)
    const statusExists = defaults.statuses.some((status) => status.id === resolvedStatusId)
    if (!statusExists) {
      return res.status(400).json({ error: 'Status DS inválido.' })
    }

    const updated = await prisma.dsRecord.update({
      where: { id: req.params.id },
      data: { statusId: resolvedStatusId },
      include: { status: true },
    })

    return res.json(prismaDsRecordToDto(updated))
  })

  router.get('/statuses', async (_req, res) => {
    const defaults = await ensureDsDefaults(prisma)
    res.json(defaults.statuses.map(dsStatusDto))
  })

  router.post('/statuses', async (req, res) => {
    const parsed = statusSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const created = await prisma.dsStatus.create({ data: parsed.data })
    res.status(201).json(dsStatusDto(created))
  })

  router.patch('/statuses/:id', async (req, res) => {
    const parsed = statusSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const updated = await prisma.dsStatus.update({ where: { id: req.params.id }, data: parsed.data })
    res.json(dsStatusDto(updated))
  })

  router.delete('/statuses/:id', async (req, res) => {
    const existingStatus = await prisma.dsStatus.findUnique({ where: { id: req.params.id } })
    if (!existingStatus) {
      return res.status(404).json({ error: 'Estado DS não encontrado.' })
    }

    const reassignToStatusId = typeof req.query.reassignToStatusId === 'string' ? req.query.reassignToStatusId.trim() : ''
    const dependencyCount = await prisma.dsRecord.count({ where: { statusId: req.params.id } })
    if (dependencyCount > 0) {
      if (!reassignToStatusId) {
        return res.status(409).json({ error: 'Estado DS em uso. Marque como inativo em vez de remover.' })
      }

      if (reassignToStatusId === req.params.id) {
        return res.status(400).json({ error: 'Estado DS de reatribuição inválido.' })
      }

      const targetStatus = await prisma.dsStatus.findUnique({ where: { id: reassignToStatusId } })
      if (!targetStatus) {
        return res.status(404).json({ error: 'Estado DS de reatribuição não encontrado.' })
      }

      await prisma.$transaction([
        prisma.dsRecord.updateMany({
          where: { statusId: req.params.id },
          data: { statusId: reassignToStatusId },
        }),
        prisma.dsStatus.delete({ where: { id: req.params.id } }),
      ])

      return res.json({ ok: true, reassigned: dependencyCount })
    }

    await prisma.dsStatus.delete({ where: { id: req.params.id } })
    return res.json({ ok: true })
  })

  router.post('/import/preview', async (req, res) => {
    const parsed = dsImportPreviewSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload DS inválido.', details: parsed.error.flatten() })
    }

    const existing = await prisma.dsRecord.findMany({
      where: { deletedAt: null },
      select: { id: true, gestora: true, referencia: true, dataEscritura: true, proponentes: true, produto: true, valor: true },
    })
    const existingByKey = new Map(
      existing.map((row) => [
        buildDsRecordKey({
          gestora: row.gestora ?? undefined,
          referencia: row.referencia ?? undefined,
          dataEscritura: row.dataEscritura ? row.dataEscritura.toISOString().slice(0, 10) : undefined,
          proponentes: row.proponentes ?? undefined,
          produto: row.produto ?? undefined,
          valor: toNumberOrUndefined(row.valor),
        }),
        row.id,
      ]),
    )

    const dsDefaults = await ensureDsDefaults(prisma)

    const items = parsed.data.rows.map((raw, index) => {
      const input = asDsRecordInput(raw)
      if (!input) {
        return { index, valid: false, action: 'error', reason: 'Linha DS sem dados mínimos.' }
      }

      const fallbackStatusId = getDefaultDsStatusId(dsDefaults)
      if (!fallbackStatusId) {
        return { index, valid: false, action: 'error', reason: 'Estado DS padrão indisponível.' }
      }
      const statusId = resolveDsStatusId(input.statusId, dsDefaults, fallbackStatusId, input)
      const key = buildDsRecordKey(input)
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
    const parsed = dsImportCommitSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload DS inválido.', details: parsed.error.flatten() })
    }

    const defaults = await ensureDsDefaults(prisma)
    const fallbackStatusId = getDefaultDsStatusId(defaults)
    if (!fallbackStatusId) {
      return res.status(500).json({ error: 'Estado DS padrão indisponível.' })
    }

    const importBatchId = `ds-${Date.now()}`
    const existing = await prisma.dsRecord.findMany({
      where: { deletedAt: null },
      select: { id: true, gestora: true, referencia: true, dataEscritura: true, proponentes: true, produto: true, valor: true },
    })
    const existingByKey = new Map(
      existing.map((row) => [
        buildDsRecordKey({
          gestora: row.gestora ?? undefined,
          referencia: row.referencia ?? undefined,
          dataEscritura: row.dataEscritura ? row.dataEscritura.toISOString().slice(0, 10) : undefined,
          proponentes: row.proponentes ?? undefined,
          produto: row.produto ?? undefined,
          valor: toNumberOrUndefined(row.valor),
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
      const input = asDsRecordInput(raw)
      if (!input) {
        invalid += 1
        continue
      }
      input.statusId = resolveDsStatusId(input.statusId, defaults, fallbackStatusId, input)
      input.importBatchId = input.importBatchId || importBatchId

      let key = buildDsRecordKey(input)
      const existingId = existingByKey.get(key)

      if (existingId) {
        if (parsed.data.strategy === 'skip') {
          skipped += 1
          continue
        }

        if (parsed.data.strategy === 'update') {
          await prisma.dsRecord.update({
            where: { id: existingId },
            data: toPrismaDsRecordData(input),
          })
          updated += 1
          continue
        }

        if (parsed.data.strategy === 'duplicate') {
          const baseReference = input.referencia || 'SEM-REF'
          while (existingByKey.has(key)) {
            duplicateCounter += 1
            input.referencia = `${baseReference}-dup-${duplicateCounter}`
            key = buildDsRecordKey(input)
          }
        }
      }

      const createdRow = await prisma.dsRecord.create({
        data: toPrismaDsRecordData(input),
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

  router.delete('/records/:id', async (req, res) => {
    const record = await prisma.dsRecord.findFirst({
      where: { id: req.params.id, deletedAt: null },
    })

    if (!record) {
      return res.status(404).json({ error: 'Registo DS não encontrado.' })
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Autenticação necessária.' })
    }

    await prisma.dsRecord.update({
      where: { id: req.params.id },
      data: {
        deletedAt: new Date(),
        deletedById: req.user.userId,
      },
    })

    return res.json({ success: true })
  })

  router.post('/records/:id/restore', async (req, res) => {
    const record = await prisma.dsRecord.findFirst({
      where: { id: req.params.id, deletedAt: { not: null } },
    })

    if (!record) {
      return res.status(404).json({ error: 'Registo DS não encontrado ou não está eliminado.' })
    }

    const restored = await prisma.dsRecord.update({
      where: { id: req.params.id },
      data: {
        deletedAt: null,
        deletedById: null,
      },
      include: { status: true },
    })

    return res.json(prismaDsRecordToDto(restored))
  })

  router.delete('/records/:id/permanent', async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem eliminar permanentemente.' })
    }

    const record = await prisma.dsRecord.findFirst({
      where: { id: req.params.id, deletedAt: { not: null } },
    })

    if (!record) {
      return res.status(404).json({ error: 'Registo DS não encontrado ou não está eliminado.' })
    }

    await prisma.dsRecord.delete({
      where: { id: req.params.id },
    })

    return res.json({ success: true })
  })

  return router
}
