import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'

import {
  createTodoSchema,
  updateTodoSchema,
  createSubtaskSchema,
  updateSubtaskSchema,
  createCommentSchema,
} from '../schemas/todos'
import { createNotification, parseMentions } from '../services/notifications'

export function createTodosRouter(prisma: PrismaClient): Router {
  const router = Router()

  // ---------------------------------------------------------------------------
  // GET / — list todos with filters, pagination, subtasks & comment count
  // ---------------------------------------------------------------------------
  router.get('/', async (req, res) => {
    try {
      const page = Math.max(Number(req.query.page ?? 1), 1)
      const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 20), 1), 100)
      const skip = (page - 1) * pageSize

      const where: Prisma.TodoWhereInput = { deletedAt: null }

      if (req.query.status && typeof req.query.status === 'string') {
        where.status = req.query.status as Prisma.TodoWhereInput['status']
      }
      if (req.query.priority && typeof req.query.priority === 'string') {
        where.priority = req.query.priority as Prisma.TodoWhereInput['priority']
      }
      if (req.query.assigneeId) {
        where.assigneeId = Number(req.query.assigneeId)
      }
      if (req.query.createdById) {
        where.createdById = Number(req.query.createdById)
      }
      if (req.query.linkedModule && typeof req.query.linkedModule === 'string') {
        where.linkedModule = req.query.linkedModule
      }

      const [items, total] = await Promise.all([
        prisma.todo.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: [{ createdAt: 'desc' }],
          include: {
            subtasks: { orderBy: { order: 'asc' } },
            createdBy: { select: { id: true, username: true, displayName: true } },
            assignee: { select: { id: true, username: true, displayName: true } },
            _count: { select: { comments: true } },
          },
        }),
        prisma.todo.count({ where }),
      ])

      res.json({ items, total, page, pageSize })
    } catch (error) {
      console.error('[todos] GET / error:', error)
      res.status(500).json({ error: 'Erro ao listar tarefas.' })
    }
  })

  // ---------------------------------------------------------------------------
  // POST / — create todo
  // ---------------------------------------------------------------------------
  router.post('/', async (req, res) => {
    const parsed = createTodoSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    try {
      const userId = req.user!.userId
      const { dueDate, ...rest } = parsed.data

      const todo = await prisma.todo.create({
        data: {
          ...rest,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          createdById: userId,
        },
        include: {
          subtasks: true,
          createdBy: { select: { id: true, username: true, displayName: true } },
          assignee: { select: { id: true, username: true, displayName: true } },
          _count: { select: { comments: true } },
        },
      })

      // Notify assignee (if different from creator)
      if (todo.assigneeId && todo.assigneeId !== userId) {
        createNotification(prisma, {
          userId: todo.assigneeId,
          type: 'TASK_ASSIGNED',
          title: 'Tarefa atribuída',
          message: `Foi-lhe atribuída a tarefa "${todo.title}".`,
          linkedTodoId: todo.id,
          linkedModule: todo.linkedModule ?? undefined,
          linkedRecordId: todo.linkedRecordId ?? undefined,
        }).catch((err) => console.error('[todos] notification error:', err))
      }

      res.status(201).json(todo)
    } catch (error) {
      console.error('[todos] POST / error:', error)
      res.status(500).json({ error: 'Erro ao criar tarefa.' })
    }
  })

  // ---------------------------------------------------------------------------
  // PATCH /:id — update todo
  // ---------------------------------------------------------------------------
  router.patch('/:id', async (req, res) => {
    const parsed = updateTodoSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    try {
      const todoId = Number(req.params.id)
      if (Number.isNaN(todoId)) {
        return res.status(400).json({ error: 'ID de tarefa inválido.' })
      }

      const existing = await prisma.todo.findFirst({ where: { id: todoId, deletedAt: null } })
      if (!existing) {
        return res.status(404).json({ error: 'Tarefa não encontrada.' })
      }

      const userId = req.user!.userId
      const { dueDate, ...rest } = parsed.data

      const data: Prisma.TodoUpdateInput = { ...rest }
      if (dueDate !== undefined) {
        data.dueDate = dueDate ? new Date(dueDate) : null
      }

      const updated = await prisma.todo.update({
        where: { id: todoId },
        data,
        include: {
          subtasks: { orderBy: { order: 'asc' } },
          createdBy: { select: { id: true, username: true, displayName: true } },
          assignee: { select: { id: true, username: true, displayName: true } },
          _count: { select: { comments: true } },
        },
      })

      // Notify: status changed to DONE -> tell creator (if different from updater)
      if (
        parsed.data.status === 'DONE' &&
        existing.status !== 'DONE' &&
        existing.createdById !== userId
      ) {
        createNotification(prisma, {
          userId: existing.createdById,
          type: 'TASK_COMPLETED',
          title: 'Tarefa concluída',
          message: `A tarefa "${updated.title}" foi marcada como concluída.`,
          linkedTodoId: updated.id,
          linkedModule: updated.linkedModule ?? undefined,
          linkedRecordId: updated.linkedRecordId ?? undefined,
        }).catch((err) => console.error('[todos] notification error:', err))
      }

      // Notify: assignee changed -> tell new assignee (if different from updater)
      if (
        parsed.data.assigneeId !== undefined &&
        parsed.data.assigneeId !== null &&
        parsed.data.assigneeId !== existing.assigneeId &&
        parsed.data.assigneeId !== userId
      ) {
        createNotification(prisma, {
          userId: parsed.data.assigneeId,
          type: 'TASK_ASSIGNED',
          title: 'Tarefa atribuída',
          message: `Foi-lhe atribuída a tarefa "${updated.title}".`,
          linkedTodoId: updated.id,
          linkedModule: updated.linkedModule ?? undefined,
          linkedRecordId: updated.linkedRecordId ?? undefined,
        }).catch((err) => console.error('[todos] notification error:', err))
      }

      res.json(updated)
    } catch (error) {
      console.error('[todos] PATCH /:id error:', error)
      res.status(500).json({ error: 'Erro ao atualizar tarefa.' })
    }
  })

  // ---------------------------------------------------------------------------
  // DELETE /:id — soft delete
  // ---------------------------------------------------------------------------
  router.delete('/:id', async (req, res) => {
    try {
      const todoId = Number(req.params.id)
      if (Number.isNaN(todoId)) {
        return res.status(400).json({ error: 'ID de tarefa inválido.' })
      }

      const existing = await prisma.todo.findFirst({ where: { id: todoId, deletedAt: null } })
      if (!existing) {
        return res.status(404).json({ error: 'Tarefa não encontrada.' })
      }

      await prisma.todo.update({
        where: { id: todoId },
        data: {
          deletedAt: new Date(),
          deletedById: req.user!.userId,
        },
      })

      res.json({ success: true })
    } catch (error) {
      console.error('[todos] DELETE /:id error:', error)
      res.status(500).json({ error: 'Erro ao eliminar tarefa.' })
    }
  })

  // ---------------------------------------------------------------------------
  // POST /:id/restore — restore from trash
  // ---------------------------------------------------------------------------
  router.post('/:id/restore', async (req, res) => {
    try {
      const todoId = Number(req.params.id)
      if (Number.isNaN(todoId)) {
        return res.status(400).json({ error: 'ID de tarefa inválido.' })
      }

      const existing = await prisma.todo.findFirst({
        where: { id: todoId, deletedAt: { not: null } },
      })
      if (!existing) {
        return res.status(404).json({ error: 'Tarefa não encontrada ou não está eliminada.' })
      }

      const restored = await prisma.todo.update({
        where: { id: todoId },
        data: { deletedAt: null, deletedById: null },
        include: {
          subtasks: { orderBy: { order: 'asc' } },
          createdBy: { select: { id: true, username: true, displayName: true } },
          assignee: { select: { id: true, username: true, displayName: true } },
          _count: { select: { comments: true } },
        },
      })

      res.json(restored)
    } catch (error) {
      console.error('[todos] POST /:id/restore error:', error)
      res.status(500).json({ error: 'Erro ao restaurar tarefa.' })
    }
  })

  // ---------------------------------------------------------------------------
  // POST /:id/subtasks — create subtask
  // ---------------------------------------------------------------------------
  router.post('/:id/subtasks', async (req, res) => {
    const parsed = createSubtaskSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    try {
      const todoId = Number(req.params.id)
      if (Number.isNaN(todoId)) {
        return res.status(400).json({ error: 'ID de tarefa inválido.' })
      }

      const todo = await prisma.todo.findFirst({ where: { id: todoId, deletedAt: null } })
      if (!todo) {
        return res.status(404).json({ error: 'Tarefa não encontrada.' })
      }

      // Set order to be after last existing subtask
      const lastSubtask = await prisma.todoSubtask.findFirst({
        where: { todoId },
        orderBy: { order: 'desc' },
      })

      const subtask = await prisma.todoSubtask.create({
        data: {
          todoId,
          title: parsed.data.title,
          order: (lastSubtask?.order ?? -1) + 1,
        },
      })

      res.status(201).json(subtask)
    } catch (error) {
      console.error('[todos] POST /:id/subtasks error:', error)
      res.status(500).json({ error: 'Erro ao criar subtarefa.' })
    }
  })

  // ---------------------------------------------------------------------------
  // PATCH /:id/subtasks/:sid — update subtask
  // ---------------------------------------------------------------------------
  router.patch('/:id/subtasks/:sid', async (req, res) => {
    const parsed = updateSubtaskSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    try {
      const todoId = Number(req.params.id)
      const subtaskId = Number(req.params.sid)
      if (Number.isNaN(todoId) || Number.isNaN(subtaskId)) {
        return res.status(400).json({ error: 'ID inválido.' })
      }

      const subtask = await prisma.todoSubtask.findFirst({
        where: { id: subtaskId, todoId },
      })
      if (!subtask) {
        return res.status(404).json({ error: 'Subtarefa não encontrada.' })
      }

      const updated = await prisma.todoSubtask.update({
        where: { id: subtaskId },
        data: parsed.data,
      })

      res.json(updated)
    } catch (error) {
      console.error('[todos] PATCH /:id/subtasks/:sid error:', error)
      res.status(500).json({ error: 'Erro ao atualizar subtarefa.' })
    }
  })

  // ---------------------------------------------------------------------------
  // DELETE /:id/subtasks/:sid — hard delete subtask
  // ---------------------------------------------------------------------------
  router.delete('/:id/subtasks/:sid', async (req, res) => {
    try {
      const todoId = Number(req.params.id)
      const subtaskId = Number(req.params.sid)
      if (Number.isNaN(todoId) || Number.isNaN(subtaskId)) {
        return res.status(400).json({ error: 'ID inválido.' })
      }

      const subtask = await prisma.todoSubtask.findFirst({
        where: { id: subtaskId, todoId },
      })
      if (!subtask) {
        return res.status(404).json({ error: 'Subtarefa não encontrada.' })
      }

      await prisma.todoSubtask.delete({ where: { id: subtaskId } })

      res.json({ success: true })
    } catch (error) {
      console.error('[todos] DELETE /:id/subtasks/:sid error:', error)
      res.status(500).json({ error: 'Erro ao eliminar subtarefa.' })
    }
  })

  // ---------------------------------------------------------------------------
  // GET /:id/comments — list comments
  // ---------------------------------------------------------------------------
  router.get('/:id/comments', async (req, res) => {
    try {
      const todoId = Number(req.params.id)
      if (Number.isNaN(todoId)) {
        return res.status(400).json({ error: 'ID de tarefa inválido.' })
      }

      const todo = await prisma.todo.findFirst({ where: { id: todoId, deletedAt: null } })
      if (!todo) {
        return res.status(404).json({ error: 'Tarefa não encontrada.' })
      }

      const comments = await prisma.todoComment.findMany({
        where: { todoId },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, username: true, displayName: true } },
        },
      })

      res.json(comments)
    } catch (error) {
      console.error('[todos] GET /:id/comments error:', error)
      res.status(500).json({ error: 'Erro ao listar comentários.' })
    }
  })

  // ---------------------------------------------------------------------------
  // POST /:id/comments — add comment
  // ---------------------------------------------------------------------------
  router.post('/:id/comments', async (req, res) => {
    const parsed = createCommentSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    try {
      const todoId = Number(req.params.id)
      if (Number.isNaN(todoId)) {
        return res.status(400).json({ error: 'ID de tarefa inválido.' })
      }

      const todo = await prisma.todo.findFirst({ where: { id: todoId, deletedAt: null } })
      if (!todo) {
        return res.status(404).json({ error: 'Tarefa não encontrada.' })
      }

      const userId = req.user!.userId

      const comment = await prisma.todoComment.create({
        data: {
          todoId,
          authorId: userId,
          content: parsed.data.content,
        },
        include: {
          author: { select: { id: true, username: true, displayName: true } },
        },
      })

      // Notify creator (if different from commenter)
      if (todo.createdById !== userId) {
        createNotification(prisma, {
          userId: todo.createdById,
          type: 'TASK_COMMENTED',
          title: 'Novo comentário',
          message: `Novo comentário na tarefa "${todo.title}".`,
          linkedTodoId: todo.id,
          linkedModule: todo.linkedModule ?? undefined,
          linkedRecordId: todo.linkedRecordId ?? undefined,
        }).catch((err) => console.error('[todos] notification error:', err))
      }

      // Notify assignee (if different from commenter and creator)
      if (todo.assigneeId && todo.assigneeId !== userId && todo.assigneeId !== todo.createdById) {
        createNotification(prisma, {
          userId: todo.assigneeId,
          type: 'TASK_COMMENTED',
          title: 'Novo comentário',
          message: `Novo comentário na tarefa "${todo.title}".`,
          linkedTodoId: todo.id,
          linkedModule: todo.linkedModule ?? undefined,
          linkedRecordId: todo.linkedRecordId ?? undefined,
        }).catch((err) => console.error('[todos] notification error:', err))
      }

      // Parse @mentions and send MENTION notifications
      const mentionedUsernames = parseMentions(parsed.data.content)
      if (mentionedUsernames.length > 0) {
        const mentionedUsers = await prisma.user.findMany({
          where: {
            username: { in: mentionedUsernames },
            active: true,
          },
          select: { id: true },
        })

        for (const mentioned of mentionedUsers) {
          // Skip if mentioned user is the commenter, creator, or assignee (already notified)
          if (
            mentioned.id === userId ||
            mentioned.id === todo.createdById ||
            mentioned.id === todo.assigneeId
          ) {
            continue
          }

          createNotification(prisma, {
            userId: mentioned.id,
            type: 'MENTION',
            title: 'Menção num comentário',
            message: `Foi mencionado num comentário na tarefa "${todo.title}".`,
            linkedTodoId: todo.id,
            linkedModule: todo.linkedModule ?? undefined,
            linkedRecordId: todo.linkedRecordId ?? undefined,
          }).catch((err) => console.error('[todos] mention notification error:', err))
        }
      }

      res.status(201).json(comment)
    } catch (error) {
      console.error('[todos] POST /:id/comments error:', error)
      res.status(500).json({ error: 'Erro ao adicionar comentário.' })
    }
  })

  return router
}
