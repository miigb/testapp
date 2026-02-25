import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'

import { statusSchema } from '../schemas/records'
import { statusDto } from '../services/shared'
import { ensureDefaults } from '../services/records'
import { requireModuleAccess, requireWriteAccess } from '../middleware/auth'

export function createStatusesRouter(prisma: PrismaClient): Router {
  const router = Router()

  router.get('/statuses', requireModuleAccess('recibos'), async (_req, res) => {
    const defaults = await ensureDefaults(prisma)
    res.json(defaults.statuses.map(statusDto))
  })

  router.post('/statuses', requireModuleAccess('recibos'), requireWriteAccess, async (req, res) => {
    const parsed = statusSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const created = await prisma.status.create({ data: parsed.data })
    res.status(201).json(statusDto(created))
  })

  router.patch('/statuses/:id', requireModuleAccess('recibos'), requireWriteAccess, async (req, res) => {
    const parsed = statusSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const updated = await prisma.status.update({ where: { id: req.params.id }, data: parsed.data })
    res.json(statusDto(updated))
  })

  router.delete('/statuses/:id', requireModuleAccess('recibos'), requireWriteAccess, async (req, res) => {
    const existingStatus = await prisma.status.findUnique({ where: { id: req.params.id } })
    if (!existingStatus) {
      return res.status(404).json({ error: 'Estado não encontrado.' })
    }

    const reassignToStatusId = typeof req.query.reassignToStatusId === 'string' ? req.query.reassignToStatusId.trim() : ''
    const dependencyCount = await prisma.record.count({ where: { statusId: req.params.id } })
    if (dependencyCount > 0) {
      if (!reassignToStatusId) {
        return res.status(409).json({ error: 'Estado em uso. Marque como inativo em vez de remover.' })
      }

      if (reassignToStatusId === req.params.id) {
        return res.status(400).json({ error: 'Estado de reatribuição inválido.' })
      }

      const targetStatus = await prisma.status.findUnique({ where: { id: reassignToStatusId } })
      if (!targetStatus) {
        return res.status(404).json({ error: 'Estado de reatribuição não encontrado.' })
      }

      await prisma.$transaction([
        prisma.record.updateMany({
          where: { statusId: req.params.id },
          data: { statusId: reassignToStatusId },
        }),
        prisma.status.delete({ where: { id: req.params.id } }),
      ])

      return res.json({ ok: true, reassigned: dependencyCount })
    }

    await prisma.status.delete({ where: { id: req.params.id } })
    return res.json({ ok: true })
  })

  return router
}
