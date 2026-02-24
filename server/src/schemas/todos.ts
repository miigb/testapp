import { z } from 'zod'

export const createTodoSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.number().int().positive().optional(),
  linkedModule: z.enum(['recibos', 'ds', 'penhoras']).optional(),
  linkedRecordId: z.string().optional(),
})

export const updateTodoSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  linkedModule: z.enum(['recibos', 'ds', 'penhoras']).nullable().optional(),
  linkedRecordId: z.string().nullable().optional(),
})

export const createSubtaskSchema = z.object({
  title: z.string().min(1).max(500),
})

export const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
})

export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
})
