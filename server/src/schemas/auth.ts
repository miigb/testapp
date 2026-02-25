import { z } from 'zod'

export const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._]+$/),
  displayName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  password: z.string().min(6).max(128),
})

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().nullable().optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  active: z.boolean().optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})
