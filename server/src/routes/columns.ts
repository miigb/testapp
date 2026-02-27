import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'

import { requireAdmin } from '../middleware/auth'
import {
  columnConfigParams,
  updateColumnBody,
  reorderColumnsBody,
  createCustomColumnBody,
  discoverColumnsBody,
} from '../schemas/columnConfig'
import { discoverImportColumns } from '../lib/discoverImportColumns'

export function createColumnsRouter(prisma: PrismaClient): Router {
  const router = Router()

  // ─── Public route (requireAuth applied at mount level in index.ts) ───

  /** GET /api/columns/:module/:view — visible columns ordered by position */
  router.get('/columns/:module/:view', async (req, res) => {
    const parsed = columnConfigParams.safeParse(req.params)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Parâmetros inválidos.', details: parsed.error.flatten() })
    }

    const columns = await prisma.columnConfig.findMany({
      where: {
        module: parsed.data.module,
        view: parsed.data.view,
        visible: true,
      },
      orderBy: { position: 'asc' },
    })

    res.json(columns)
  })

  // ─── Admin routes ────────────────────────────────────────────────────

  /** GET /api/admin/columns/:module/:view — ALL columns (including hidden) */
  router.get('/admin/columns/:module/:view', requireAdmin, async (req, res) => {
    const parsed = columnConfigParams.safeParse(req.params)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Parâmetros inválidos.', details: parsed.error.flatten() })
    }

    const columns = await prisma.columnConfig.findMany({
      where: {
        module: parsed.data.module,
        view: parsed.data.view,
      },
      orderBy: { position: 'asc' },
    })

    res.json(columns)
  })

  /**
   * POST /api/admin/columns/from-import — discover unmapped columns
   * Accepts raw Excel header names, diffs against existing ColumnConfig
   * keys for the module, returns headers that aren't yet tracked.
   * IMPORTANT: Must be registered BEFORE /:id and /:module/:view routes.
   */
  router.post('/admin/columns/from-import', requireAdmin, async (req, res) => {
    const parsed = discoverColumnsBody.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const discoveredColumns = await discoverImportColumns(
      prisma,
      parsed.data.module,
      parsed.data.headers,
    )

    res.json({ discoveredColumns })
  })

  /**
   * PATCH /api/admin/columns/reorder — bulk update positions
   * IMPORTANT: Must be registered BEFORE the /:id route so Express
   * does not match "reorder" as an :id parameter.
   */
  router.patch('/admin/columns/reorder', requireAdmin, async (req, res) => {
    const parsed = reorderColumnsBody.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    await prisma.$transaction(
      parsed.data.columns.map((col) =>
        prisma.columnConfig.update({
          where: { id: col.id },
          data: { position: col.position },
        }),
      ),
    )

    res.json({ ok: true })
  })

  /** PATCH /api/admin/columns/:id — update single column */
  router.patch('/admin/columns/:id', requireAdmin, async (req, res) => {
    const parsed = updateColumnBody.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const updated = await prisma.columnConfig.update({
      where: { id: req.params.id },
      data: parsed.data,
    })

    res.json(updated)
  })

  /** POST /api/admin/columns/:module/:view — create custom column */
  router.post('/admin/columns/:module/:view', requireAdmin, async (req, res) => {
    const paramsParsed = columnConfigParams.safeParse(req.params)
    if (!paramsParsed.success) {
      return res.status(400).json({ error: 'Parâmetros inválidos.', details: paramsParsed.error.flatten() })
    }

    const bodyParsed = createCustomColumnBody.safeParse(req.body)
    if (!bodyParsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: bodyParsed.error.flatten() })
    }

    // Determine next position (max existing + 1)
    const maxPos = await prisma.columnConfig.aggregate({
      where: {
        module: paramsParsed.data.module,
        view: paramsParsed.data.view,
      },
      _max: { position: true },
    })
    const nextPosition = (maxPos._max.position ?? -1) + 1

    const created = await prisma.columnConfig.create({
      data: {
        module: paramsParsed.data.module,
        view: paramsParsed.data.view,
        key: bodyParsed.data.key,
        label: bodyParsed.data.label,
        type: bodyParsed.data.type,
        isCustom: true,
        isReference: bodyParsed.data.isReference,
        referenceConfig: bodyParsed.data.referenceConfig ?? undefined,
        visible: true,
        position: nextPosition,
        createdById: req.user!.id,
      },
    })

    res.status(201).json(created)
  })

  /** DELETE /api/admin/columns/:id — not implemented yet */
  router.delete('/admin/columns/:id', requireAdmin, async (_req, res) => {
    res.status(501).json({ error: 'Eliminação de colunas ainda não implementada.' })
  })

  return router
}
