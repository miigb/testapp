import { Router } from 'express'
import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

import {
  recordInputSchema,
  recordPatchSchema,
  importCommitSchema,
  importPreviewSchema,
  bulkUpdateSchema,
} from '../schemas/records'
import {
  applyCalculations,
  buildUniqueRecordKey,
  prismaRecordToDto,
  toIsoDateOrUndefined,
  toPrismaRecordData,
} from '../utils'
import {
  databaseSetupHint,
  statusDto,
  savedViewDto,
  toApiTaxRule,
  duplicateVariant,
  normalizeSuggestionValues,
  toNumberFromDecimal,
} from '../services/shared'
import {
  ensureDefaults,
  buildRecordWhere,
  mergeRecordWithPatch,
  asRecordInput,
  detectStatusIdFromColor,
} from '../services/records'

export function createRecordsRouter(prisma: PrismaClient): Router {
  const router = Router()

  router.get('/bootstrap', async (_req, res) => {
    try {
      const defaults = await ensureDefaults(prisma)
      const savedViews = await prisma.savedView.findMany({ orderBy: { updatedAt: 'desc' } })
      const recordCount = await prisma.record.count({ where: { deletedAt: null } })

      res.json({
        statuses: defaults.statuses.map(statusDto),
        calculationSettings: {
          ...defaults.calculationSettings,
          taxRules: defaults.taxRules.map(toApiTaxRule),
        },
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

    const where: Prisma.RecordWhereInput = {
      ...buildRecordWhere(req.query as Record<string, unknown>),
      deletedAt: null,
    }

    const [items, total] = await Promise.all([
      prisma.record.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ updatedAt: 'desc' }],
        include: {
          status: true,
        },
      }),
      prisma.record.count({ where }),
    ])

    res.json({
      items: items.map(prismaRecordToDto),
      total,
      page,
      pageSize,
    })
  })

  router.get('/analytics/summary', async (req, res) => {
    const where: Prisma.RecordWhereInput = {
      ...buildRecordWhere(req.query as Record<string, unknown>),
      deletedAt: null,
    }

    const [statuses, totalsAggregate, byStatusRows, byTypeRows, byMonthRows, byGestorRows, byExequenteRows] = await Promise.all([
      prisma.status.findMany(),
      prisma.record.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          valorIndicado: true,
          valorSemIva: true,
          iva: true,
          retencao: true,
          meu5: true,
          valorEmissao: true,
          outrasTaxas: true,
        },
      }),
      prisma.record.groupBy({
        by: ['statusId'],
        where,
        _count: { _all: true },
        _sum: { valorSemIva: true, iva: true, valorEmissao: true },
      }),
      prisma.record.groupBy({
        by: ['tipo'],
        where,
        _count: { _all: true },
        _sum: { valorSemIva: true, iva: true, valorEmissao: true },
      }),
      prisma.record.groupBy({
        by: ['ano', 'mes'],
        where,
        _count: { _all: true },
        _sum: { valorSemIva: true, iva: true, valorEmissao: true },
        orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
      }),
      prisma.record.groupBy({
        by: ['gestor'],
        where: {
          AND: [where, { gestor: { not: null } }],
        },
        _count: { _all: true },
        _sum: { valorSemIva: true, valorEmissao: true },
        orderBy: { _count: { gestor: 'desc' } },
        take: 12,
      }),
      prisma.record.groupBy({
        by: ['exequente'],
        where: {
          AND: [where, { exequente: { not: null } }],
        },
        _count: { _all: true },
        _sum: { valorSemIva: true, valorEmissao: true },
        orderBy: { _count: { exequente: 'desc' } },
        take: 12,
      }),
    ])

    const statusMap = new Map(statuses.map((status) => [status.id, status]))

    const totals = {
      registos: totalsAggregate._count._all,
      valorIndicado: toNumberFromDecimal(totalsAggregate._sum.valorIndicado),
      valorSemIva: toNumberFromDecimal(totalsAggregate._sum.valorSemIva),
      iva: toNumberFromDecimal(totalsAggregate._sum.iva),
      retencao: toNumberFromDecimal(totalsAggregate._sum.retencao),
      meu5: toNumberFromDecimal(totalsAggregate._sum.meu5),
      valorEmissao: toNumberFromDecimal(totalsAggregate._sum.valorEmissao),
      outrasTaxas: toNumberFromDecimal(totalsAggregate._sum.outrasTaxas),
      levantadoComIva: toNumberFromDecimal(totalsAggregate._sum.valorSemIva) + toNumberFromDecimal(totalsAggregate._sum.iva),
    }

    const byStatus = byStatusRows
      .map((row) => {
        const status = statusMap.get(row.statusId)
        return {
          statusId: row.statusId,
          statusKey: status?.key ?? row.statusId,
          statusLabel: status?.label ?? row.statusId,
          statusColor: status?.color ?? '#BFC4CC',
          statusIcon: status?.icon ?? 'circle',
          count: row._count._all,
          valorSemIva: toNumberFromDecimal(row._sum.valorSemIva),
          iva: toNumberFromDecimal(row._sum.iva),
          valorEmissao: toNumberFromDecimal(row._sum.valorEmissao),
        }
      })
      .sort((a, b) => b.count - a.count)

    const byType = byTypeRows
      .map((row) => ({
        tipo: row.tipo,
        count: row._count._all,
        valorSemIva: toNumberFromDecimal(row._sum.valorSemIva),
        iva: toNumberFromDecimal(row._sum.iva),
        valorEmissao: toNumberFromDecimal(row._sum.valorEmissao),
      }))
      .sort((a, b) => b.count - a.count)

    const byMonth = byMonthRows.map((row) => ({
      ano: row.ano,
      mes: row.mes,
      count: row._count._all,
      valorSemIva: toNumberFromDecimal(row._sum.valorSemIva),
      iva: toNumberFromDecimal(row._sum.iva),
      valorEmissao: toNumberFromDecimal(row._sum.valorEmissao),
    }))

    const topGestores = byGestorRows
      .map((row) => {
        const name = row.gestor?.trim()
        if (!name) return null
        return {
          name,
          count: row._count._all,
          valorSemIva: toNumberFromDecimal(row._sum.valorSemIva),
          valorEmissao: toNumberFromDecimal(row._sum.valorEmissao),
        }
      })
      .filter((row): row is { name: string; count: number; valorSemIva: number; valorEmissao: number } => Boolean(row))
      .slice(0, 8)

    const topExequentes = byExequenteRows
      .map((row) => {
        const name = row.exequente?.trim()
        if (!name) return null
        return {
          name,
          count: row._count._all,
          valorSemIva: toNumberFromDecimal(row._sum.valorSemIva),
          valorEmissao: toNumberFromDecimal(row._sum.valorEmissao),
        }
      })
      .filter((row): row is { name: string; count: number; valorSemIva: number; valorEmissao: number } => Boolean(row))
      .slice(0, 8)

    res.json({
      totals,
      byStatus,
      byType,
      byMonth,
      topGestores,
      topExequentes,
    })
  })

  router.get('/records/suggestions', async (req, res) => {
    const rawLimit = Number(req.query.limit ?? 120)
    const limit = Math.max(20, Math.min(400, Number.isFinite(rawLimit) ? rawLimit : 120))

    const [processoRows, peRows, reciboRows, gestorRows, exequenteRows] = await Promise.all([
      prisma.record.findMany({
        where: { processo: { not: null }, deletedAt: null },
        select: { processo: true },
        distinct: ['processo'],
        take: limit,
        orderBy: { processo: 'asc' },
      }),
      prisma.record.findMany({
        where: { pe: { not: null }, deletedAt: null },
        select: { pe: true },
        distinct: ['pe'],
        take: limit,
        orderBy: { pe: 'asc' },
      }),
      prisma.record.findMany({
        where: { reciboNumero: { not: null }, deletedAt: null },
        select: { reciboNumero: true },
        distinct: ['reciboNumero'],
        take: limit,
        orderBy: { reciboNumero: 'asc' },
      }),
      prisma.record.findMany({
        where: { gestor: { not: null }, deletedAt: null },
        select: { gestor: true },
        distinct: ['gestor'],
        take: limit,
        orderBy: { gestor: 'asc' },
      }),
      prisma.record.findMany({
        where: { exequente: { not: null }, deletedAt: null },
        select: { exequente: true },
        distinct: ['exequente'],
        take: limit,
        orderBy: { exequente: 'asc' },
      }),
    ])

    res.json({
      processo: normalizeSuggestionValues(processoRows.map((row) => row.processo)),
      pe: normalizeSuggestionValues(peRows.map((row) => row.pe)),
      reciboNumero: normalizeSuggestionValues(reciboRows.map((row) => row.reciboNumero)),
      gestor: normalizeSuggestionValues(gestorRows.map((row) => row.gestor)),
      exequente: normalizeSuggestionValues(exequenteRows.map((row) => row.exequente)),
    })
  })

  router.get('/records/export', async (_req, res) => {
    const [records, statuses, calculationSettings, taxRules, savedViews] = await Promise.all([
      prisma.record.findMany({
        where: { deletedAt: null },
        orderBy: [{ ano: 'desc' }, { mes: 'desc' }, { updatedAt: 'desc' }],
        include: {
          status: true,
          history: { orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.status.findMany({ orderBy: [{ order: 'asc' }, { label: 'asc' }] }),
      prisma.calculationSettings.findUniqueOrThrow({ where: { id: 'default' } }),
      prisma.taxRule.findMany({ orderBy: [{ order: 'asc' }, { label: 'asc' }] }),
      prisma.savedView.findMany({ orderBy: { updatedAt: 'desc' } }),
    ])

    res.json({
      exportedAt: new Date().toISOString(),
      totals: { records: records.length, statuses: statuses.length, savedViews: savedViews.length },
      statuses: statuses.map(statusDto),
      calculationSettings: {
        ...calculationSettings,
        taxRules: taxRules.map(toApiTaxRule),
      },
      savedViews: savedViews.map(savedViewDto),
      records: records.map(prismaRecordToDto),
    })
  })

  router.get('/records/trash', async (req, res) => {
    const page = Number(req.query.page ?? 1)
    const pageSize = Math.min(Number(req.query.pageSize ?? 100), 300)
    const skip = Math.max(page - 1, 0) * pageSize
    const where: Prisma.RecordWhereInput = { deletedAt: { not: null } }

    const [items, total] = await Promise.all([
      prisma.record.findMany({
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
      prisma.record.count({ where }),
    ])

    return res.json({
      items: items.map((record) => ({
        ...prismaRecordToDto(record),
        deletedAt: record.deletedAt?.toISOString() ?? null,
        deletedBy: record.deletedBy ?? null,
      })),
      total,
      page,
      pageSize,
    })
  })

  router.get('/records/:id', async (req, res) => {
    const record = await prisma.record.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        status: true,
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!record) {
      return res.status(404).json({ error: 'Registo não encontrado.' })
    }

    return res.json(prismaRecordToDto(record))
  })

  router.post('/records', async (req, res) => {
    const parsed = recordInputSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const defaults = await ensureDefaults(prisma)
    const forceRecalculate = req.body.forceRecalculate === true
    const statusId = parsed.data.statusId || parsed.data.estadoId || defaults.statusByKey.get('status-prep') || defaults.statuses[0]?.id

    if (!statusId) {
      return res.status(500).json({ error: 'Não foi possível resolver estado padrão.' })
    }

    const calculated = applyCalculations(
      {
        ...parsed.data,
        dataLevantamento: toIsoDateOrUndefined(parsed.data.dataLevantamento),
        dataRecibo: toIsoDateOrUndefined(parsed.data.dataRecibo),
        statusId,
      },
      defaults.calculationSettings,
      defaults.taxRules,
      forceRecalculate,
    )

    try {
      const created = await prisma.record.create({
        data: {
          ...toPrismaRecordData(calculated),
          statusId,
          history: {
            create: {
              message: 'Registo criado via API.',
            },
          },
        },
        include: { status: true },
      })

      return res.status(201).json(prismaRecordToDto(created))
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(409).json({ error: 'Registo duplicado para o mesmo período.' })
      }
      throw error
    }
  })

  router.patch('/records/:id', async (req, res) => {
    const parsed = recordPatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const current = await prisma.record.findFirst({ where: { id: req.params.id, deletedAt: null } })
    if (!current) {
      return res.status(404).json({ error: 'Registo não encontrado.' })
    }

    const defaults = await ensureDefaults(prisma)
    const merged = mergeRecordWithPatch(current, parsed.data)

    const forceRecalculate = req.body.forceRecalculate === true
    const calculated = applyCalculations(merged, defaults.calculationSettings, defaults.taxRules, forceRecalculate)

    const updated = await prisma.record.update({
      where: { id: req.params.id },
      data: {
        ...toPrismaRecordData(calculated),
        statusId: calculated.statusId,
        history: {
          create: {
            message: 'Registo atualizado via API.',
          },
        },
      },
      include: { status: true },
    })

    return res.json(prismaRecordToDto(updated))
  })

  router.patch('/records/:id/status', async (req, res) => {
    const body = z.object({ statusId: z.string().min(1) }).safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Status inválido.' })
    }

    const old = await prisma.record.findFirst({ where: { id: req.params.id, deletedAt: null }, include: { status: true } })
    if (!old) {
      return res.status(404).json({ error: 'Registo não encontrado.' })
    }

    const updated = await prisma.record.update({
      where: { id: req.params.id },
      data: {
        statusId: body.data.statusId,
        history: {
          create: {
            message: `Estado alterado para ${body.data.statusId}.`,
          },
        },
      },
      include: { status: true },
    })

    return res.json(prismaRecordToDto(updated))
  })

  router.post('/records/bulk/status', async (req, res) => {
    const body = z
      .object({
        recordIds: z.array(z.string()).min(1),
        statusId: z.string().min(1),
      })
      .safeParse(req.body)

    if (!body.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: body.error.flatten() })
    }

    const now = new Date()

    await prisma.$transaction([
      prisma.record.updateMany({
        where: { id: { in: body.data.recordIds } },
        data: {
          statusId: body.data.statusId,
          updatedAt: now,
        },
      }),
      prisma.recordHistory.createMany({
        data: body.data.recordIds.map((recordId) => ({
          recordId,
          message: `Estado alterado em lote para ${body.data.statusId}.`,
        })),
      }),
    ])

    return res.json({ ok: true, updated: body.data.recordIds.length })
  })

  router.post('/records/bulk/update', async (req, res) => {
    const parsed = bulkUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    if (Object.keys(parsed.data.patch).length === 0) {
      return res.status(400).json({ error: 'Indique pelo menos um campo para atualizar em lote.' })
    }

    const defaults = await ensureDefaults(prisma)
    const records = await prisma.record.findMany({
      where: { id: { in: parsed.data.recordIds } },
    })

    if (records.length === 0) {
      return res.json({ ok: true, updated: 0 })
    }

    const updates = records.map((current) => {
      const merged = mergeRecordWithPatch(current, parsed.data.patch)
      const calculated = applyCalculations(
        merged,
        defaults.calculationSettings,
        defaults.taxRules,
        parsed.data.forceRecalculate === true,
      )
      return { id: current.id, calculated }
    })

    await prisma.$transaction([
      ...updates.map((item) =>
        prisma.record.update({
          where: { id: item.id },
          data: {
            ...toPrismaRecordData(item.calculated),
            statusId: item.calculated.statusId,
          },
        }),
      ),
      prisma.recordHistory.createMany({
        data: updates.map((item) => ({
          recordId: item.id,
          message: 'Registo atualizado em lote.',
        })),
      }),
    ])

    return res.json({ ok: true, updated: updates.length })
  })

  router.post('/import/preview', async (req, res) => {
    const parsed = importPreviewSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const defaults = await ensureDefaults(prisma)
    const fallbackStatusId = defaults.statusByKey.get('status-sem') || defaults.statuses[0]?.id
    if (!fallbackStatusId) {
      return res.status(500).json({ error: 'Estado padrão indisponível.' })
    }

    const existingRecords = await prisma.record.findMany({
      where: { deletedAt: null },
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

    const items = parsed.data.rows.map((raw, index) => {
      const row = asRecordInput(raw)
      if (!row) {
        return {
          index,
          valid: false,
          action: 'error',
          reason: 'Linha sem campos mínimos (tipo, mês, ano).',
        }
      }

      const statusId = row.statusId || detectStatusIdFromColor(row.sourceColor, parsed.data.colorMapping, defaults.statuses, fallbackStatusId)
      const key = buildUniqueRecordKey(row)
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

    res.json({ summary, items })
  })

  router.post('/import/commit', async (req, res) => {
    const parsed = importCommitSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const defaults = await ensureDefaults(prisma)
    const fallbackStatusId = defaults.statusByKey.get('status-sem') || defaults.statuses[0]?.id
    if (!fallbackStatusId) {
      return res.status(500).json({ error: 'Estado padrão indisponível.' })
    }

    const existingRecords = await prisma.record.findMany({
      where: { deletedAt: null },
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

    let created = 0
    let updated = 0
    let skipped = 0
    let invalid = 0
    let duplicatesCreated = 0

    let duplicateCounter = 1

    for (const raw of parsed.data.rows) {
      const row = asRecordInput(raw)
      if (!row) {
        invalid += 1
        continue
      }

      const statusId = row.statusId || detectStatusIdFromColor(row.sourceColor, parsed.data.colorMapping, defaults.statuses, fallbackStatusId)
      const prepared = applyCalculations(
        {
          ...row,
          statusId,
        },
        defaults.calculationSettings,
        defaults.taxRules,
        parsed.data.forceRecalculate === true,
      )

      let key = buildUniqueRecordKey(prepared)
      const existingId = existingByKey.get(key)

      if (existingId) {
        if (parsed.data.strategy === 'skip') {
          skipped += 1
          continue
        }

        if (parsed.data.strategy === 'update') {
          await prisma.record.update({
            where: { id: existingId },
            data: {
              ...toPrismaRecordData(prepared),
              statusId,
              history: {
                create: {
                  message: 'Atualizado por importação.',
                },
              },
            },
          })
          updated += 1
          continue
        }

        if (parsed.data.strategy === 'duplicate') {
          let candidate = duplicateVariant(prepared, duplicateCounter)
          let candidateKey = buildUniqueRecordKey(candidate)

          while (existingByKey.has(candidateKey)) {
            duplicateCounter += 1
            candidate = duplicateVariant(prepared, duplicateCounter)
            candidateKey = buildUniqueRecordKey(candidate)
          }

          const createdRecord = await prisma.record.create({
            data: {
              ...toPrismaRecordData(candidate),
              statusId,
              history: {
                create: {
                  message: 'Criado por importação (duplicado resolvido).',
                },
              },
            },
            select: { id: true },
          })

          existingByKey.set(candidateKey, createdRecord.id)
          created += 1
          duplicatesCreated += 1
          duplicateCounter += 1
          continue
        }
      }

      try {
        const createdRecord = await prisma.record.create({
          data: {
            ...toPrismaRecordData(prepared),
            statusId,
            history: {
              create: {
                message: 'Criado por importação.',
              },
            },
          },
          select: { id: true },
        })

        key = buildUniqueRecordKey(prepared)
        existingByKey.set(key, createdRecord.id)
        created += 1
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          skipped += 1
          continue
        }
        throw error
      }
    }

    res.json({
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
    const record = await prisma.record.findFirst({
      where: { id: req.params.id, deletedAt: null },
    })

    if (!record) {
      return res.status(404).json({ error: 'Registo não encontrado.' })
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Autenticação necessária.' })
    }

    await prisma.record.update({
      where: { id: req.params.id },
      data: {
        deletedAt: new Date(),
        deletedById: req.user.userId,
      },
    })

    return res.json({ success: true })
  })

  router.post('/records/:id/restore', async (req, res) => {
    const record = await prisma.record.findFirst({
      where: { id: req.params.id, deletedAt: { not: null } },
    })

    if (!record) {
      return res.status(404).json({ error: 'Registo não encontrado ou não está eliminado.' })
    }

    const restored = await prisma.record.update({
      where: { id: req.params.id },
      data: {
        deletedAt: null,
        deletedById: null,
      },
      include: { status: true },
    })

    return res.json(prismaRecordToDto(restored))
  })

  router.delete('/records/:id/permanent', async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem eliminar permanentemente.' })
    }

    const record = await prisma.record.findFirst({
      where: { id: req.params.id, deletedAt: { not: null } },
    })

    if (!record) {
      return res.status(404).json({ error: 'Registo não encontrado ou não está eliminado.' })
    }

    await prisma.record.delete({
      where: { id: req.params.id },
    })

    return res.json({ success: true })
  })

  return router
}
