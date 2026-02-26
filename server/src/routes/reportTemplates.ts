import { Router } from 'express'
import type { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'

const templateSettingsSchema = z.object({
  includeDashboard: z.boolean(),
  includeTable: z.boolean(),
  maxRows: z.union([z.literal(50), z.literal(100), z.literal(250), z.literal('all')]),
  format: z.enum(['pdf', 'excel', 'csv']),
  title: z.string().max(200),
  companyName: z.string().max(200).optional(),
  orientation: z.enum(['portrait', 'landscape']).optional(),
  footerText: z.string().max(500).optional(),
  selectedColumns: z.array(z.string()),
  useAiSummary: z.boolean(),
})

const createSchema = z.object({
  name: z.string().min(1).max(100),
  module: z.enum(['recibos', 'ds', 'penhoras']),
  settings: templateSettingsSchema,
})

function templateDto(t: {
  id: string
  name: string
  module: string
  settings: unknown
  createdById: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: t.id,
    name: t.name,
    module: t.module,
    settings: t.settings,
    createdById: t.createdById,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

export function createReportTemplatesRouter(prisma: PrismaClient): Router {
  const router = Router()

  // List templates for a module
  router.get('/', async (req, res) => {
    const module = typeof req.query.module === 'string' ? req.query.module : undefined
    const templates = await prisma.reportTemplate.findMany({
      where: module ? { module } : undefined,
      orderBy: { updatedAt: 'desc' },
    })
    res.json(templates.map(templateDto))
  })

  // Create a template
  router.post('/', async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: 'Não autenticado.' })

    const created = await prisma.reportTemplate.create({
      data: {
        ...parsed.data,
        settings: parsed.data.settings as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    })
    res.status(201).json(templateDto(created))
  })

  // Update a template
  router.put('/:id', async (req, res) => {
    const parsed = createSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const existing = await prisma.reportTemplate.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Template não encontrado.' })

    const userId = (req as any).user?.id
    const userRole = (req as any).user?.role
    if (existing.createdById !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas o criador ou um administrador pode editar este template.' })
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) data.name = parsed.data.name
    if (parsed.data.module !== undefined) data.module = parsed.data.module
    if (parsed.data.settings !== undefined) data.settings = parsed.data.settings as unknown as Prisma.InputJsonValue

    const updated = await prisma.reportTemplate.update({ where: { id: req.params.id }, data })
    res.json(templateDto(updated))
  })

  // Delete a template
  router.delete('/:id', async (req, res) => {
    const existing = await prisma.reportTemplate.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Template não encontrado.' })

    const userId = (req as any).user?.id
    const userRole = (req as any).user?.role
    if (existing.createdById !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas o criador ou um administrador pode eliminar este template.' })
    }

    await prisma.reportTemplate.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  })

  return router
}
