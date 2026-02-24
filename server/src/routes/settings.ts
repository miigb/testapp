import { Router } from 'express'
import { Prisma, type PrismaClient } from '@prisma/client'

import { saveViewSchema, calculationSettingsSchema } from '../schemas/records'
import { savedViewDto, toApiTaxRule } from '../services/shared'
import { ensureDefaults } from '../services/records'

export function createSettingsRouter(prisma: PrismaClient): Router {
  const router = Router()

  router.get('/calculation-settings', async (_req, res) => {
    const defaults = await ensureDefaults(prisma)
    res.json({
      ...defaults.calculationSettings,
      taxRules: defaults.taxRules.map(toApiTaxRule),
    })
  })

  router.patch('/calculation-settings', async (req, res) => {
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

  router.get('/saved-views', async (req, res) => {
    const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined
    const views = await prisma.savedView.findMany({
      where: scope ? { scope } : undefined,
      orderBy: { updatedAt: 'desc' },
    })
    res.json(views.map(savedViewDto))
  })

  router.post('/saved-views', async (req, res) => {
    const parsed = saveViewSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const created = await prisma.savedView.create({ data: { ...parsed.data, filters: parsed.data.filters as Prisma.InputJsonValue } })
    res.status(201).json(savedViewDto(created))
  })

  router.patch('/saved-views/:id', async (req, res) => {
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

  router.delete('/saved-views/:id', async (req, res) => {
    await prisma.savedView.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  })

  return router
}
