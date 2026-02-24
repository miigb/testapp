import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'

import { notificationPreferenceSchema } from '../schemas/notifications'
import { addSseClient } from '../services/sse'

export function createNotificationsRouter(prisma: PrismaClient): Router {
  const router = Router()

  // ---------------------------------------------------------------------------
  // GET /stream — SSE endpoint (MUST be before /:id routes)
  // ---------------------------------------------------------------------------
  router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    addSseClient(req.user!.userId, res)

    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n')
    }, 30_000)

    res.on('close', () => {
      clearInterval(heartbeat)
    })
  })

  // ---------------------------------------------------------------------------
  // GET /unread-count — count unread notifications for current user
  // ---------------------------------------------------------------------------
  router.get('/unread-count', async (req, res) => {
    try {
      const count = await prisma.notification.count({
        where: { userId: req.user!.userId, read: false },
      })
      res.json({ count })
    } catch (error) {
      console.error('[notifications] GET /unread-count error:', error)
      res.status(500).json({ error: 'Erro ao contar notificações.' })
    }
  })

  // ---------------------------------------------------------------------------
  // GET /preferences — get or create default preferences
  // ---------------------------------------------------------------------------
  router.get('/preferences', async (req, res) => {
    try {
      const userId = req.user!.userId

      let prefs = await prisma.notificationPreference.findUnique({
        where: { userId },
      })

      if (!prefs) {
        prefs = await prisma.notificationPreference.create({
          data: { userId },
        })
      }

      res.json(prefs)
    } catch (error) {
      console.error('[notifications] GET /preferences error:', error)
      res.status(500).json({ error: 'Erro ao obter preferências.' })
    }
  })

  // ---------------------------------------------------------------------------
  // PATCH /preferences — update preferences
  // ---------------------------------------------------------------------------
  router.patch('/preferences', async (req, res) => {
    const parsed = notificationPreferenceSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    try {
      const userId = req.user!.userId

      const prefs = await prisma.notificationPreference.upsert({
        where: { userId },
        update: parsed.data,
        create: { userId, ...parsed.data },
      })

      res.json(prefs)
    } catch (error) {
      console.error('[notifications] PATCH /preferences error:', error)
      res.status(500).json({ error: 'Erro ao atualizar preferências.' })
    }
  })

  // ---------------------------------------------------------------------------
  // POST /read-all — mark all as read for current user
  // ---------------------------------------------------------------------------
  router.post('/read-all', async (req, res) => {
    try {
      const result = await prisma.notification.updateMany({
        where: { userId: req.user!.userId, read: false },
        data: { read: true },
      })

      res.json({ success: true, updated: result.count })
    } catch (error) {
      console.error('[notifications] POST /read-all error:', error)
      res.status(500).json({ error: 'Erro ao marcar notificações como lidas.' })
    }
  })

  // ---------------------------------------------------------------------------
  // GET / — paginated list for current user
  // ---------------------------------------------------------------------------
  router.get('/', async (req, res) => {
    try {
      const page = Math.max(Number(req.query.page ?? 1), 1)
      const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 20), 1), 100)
      const skip = (page - 1) * pageSize

      const where = { userId: req.user!.userId }

      const [items, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.notification.count({ where }),
      ])

      res.json({ items, total, page, pageSize })
    } catch (error) {
      console.error('[notifications] GET / error:', error)
      res.status(500).json({ error: 'Erro ao listar notificações.' })
    }
  })

  // ---------------------------------------------------------------------------
  // PATCH /:id/read — mark single notification as read
  // ---------------------------------------------------------------------------
  router.patch('/:id/read', async (req, res) => {
    try {
      const notificationId = Number(req.params.id)
      if (Number.isNaN(notificationId)) {
        return res.status(400).json({ error: 'ID de notificação inválido.' })
      }

      const notification = await prisma.notification.findFirst({
        where: { id: notificationId, userId: req.user!.userId },
      })
      if (!notification) {
        return res.status(404).json({ error: 'Notificação não encontrada.' })
      }

      const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true },
      })

      res.json(updated)
    } catch (error) {
      console.error('[notifications] PATCH /:id/read error:', error)
      res.status(500).json({ error: 'Erro ao marcar notificação como lida.' })
    }
  })

  return router
}
