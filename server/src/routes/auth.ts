import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { hashPassword, verifyPassword, signToken } from '../services/auth'
import { registerSchema, loginSchema, updateUserSchema } from '../schemas/auth'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
}

export function createAuthRouter(prisma: PrismaClient) {
  const r = Router()

  // POST /register
  r.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados invalidos.', details: parsed.error.flatten() })
    }

    const { username, displayName, email, password } = parsed.data

    const hashedPassword = await hashPassword(password)
    const avatarColor = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`

    try {
      const user = await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({ where: { username } })
        if (existing) return null

        const userCount = await tx.user.count()
        const role = userCount === 0 ? 'ADMIN' : 'USER'

        return tx.user.create({
          data: {
            username,
            displayName,
            email: email ?? null,
            password: hashedPassword,
            role,
            avatarColor,
          },
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            role: true,
            active: true,
            avatarColor: true,
            allowedModules: true,
            createdAt: true,
          },
        })
      })

      if (!user) {
        return res.status(409).json({ error: 'Nome de utilizador ja existe.' })
      }

      const token = signToken({ userId: user.id, username: user.username, role: user.role, allowedModules: user.allowedModules })
      res.cookie('token', token, COOKIE_OPTIONS)
      return res.status(201).json(user)
    } catch {
      return res.status(500).json({ error: 'Erro ao registar utilizador.' })
    }
  })

  // POST /login
  r.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados invalidos.' })
    }

    const { username, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Credenciais invalidas.' })
    }

    const valid = await verifyPassword(password, user.password)
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais invalidas.' })
    }

    const token = signToken({ userId: user.id, username: user.username, role: user.role, allowedModules: user.allowedModules })
    res.cookie('token', token, COOKIE_OPTIONS)
    return res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      active: user.active,
      avatarColor: user.avatarColor,
      allowedModules: user.allowedModules,
      createdAt: user.createdAt,
    })
  })

  // POST /logout
  r.post('/logout', (_req, res) => {
    res.clearCookie('token', { path: '/' })
    return res.json({ ok: true })
  })

  // GET /me
  r.get('/me', requireAuth, async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        active: true,
        avatarColor: true,
        allowedModules: true,
        createdAt: true,
      },
    })

    if (!user || !user.active) {
      res.clearCookie('token', { path: '/' })
      return res.status(401).json({ error: 'Utilizador nao encontrado ou inativo.' })
    }

    return res.json(user)
  })

  // GET /users/summary (lightweight — used for assignment dropdowns)
  r.get('/users/summary', requireAuth, async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarColor: true,
      },
      orderBy: { displayName: 'asc' },
    })
    return res.json(users)
  })

  // GET /users (admin only — includes roles/modules)
  r.get('/users', requireAuth, requireAdmin, async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        avatarColor: true,
        allowedModules: true,
        createdAt: true,
      },
      orderBy: { displayName: 'asc' },
    })
    return res.json(users)
  })

  // PATCH /users/:id
  r.patch('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados invalidos.', details: parsed.error.flatten() })
    }

    const id = Number(req.params.id)
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID invalido.' })
    }

    // Prevent demoting yourself or deactivating yourself
    if (id === req.user!.userId) {
      if (parsed.data.role && parsed.data.role !== req.user!.role) {
        return res.status(400).json({ error: 'Nao pode alterar o proprio role.' })
      }
      if (parsed.data.active === false) {
        return res.status(400).json({ error: 'Nao pode desativar a propria conta.' })
      }
    }

    // Prevent removing the last admin
    if (parsed.data.role && parsed.data.role !== 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN', active: true } })
      if (adminCount <= 1) {
        const target = await prisma.user.findUnique({ where: { id }, select: { role: true } })
        if (target?.role === 'ADMIN') {
          return res.status(400).json({ error: 'Tem de existir pelo menos um administrador.' })
        }
      }
    }

    try {
      const user = await prisma.user.update({
        where: { id },
        data: parsed.data,
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          role: true,
          active: true,
          avatarColor: true,
          allowedModules: true,
          createdAt: true,
        },
      })
      return res.json(user)
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2025') {
        return res.status(404).json({ error: 'Utilizador nao encontrado.' })
      }
      throw err
    }
  })

  // POST /users (admin-only create user — does NOT set cookie)
  r.post('/users', requireAuth, requireAdmin, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados invalidos.', details: parsed.error.flatten() })
    }

    const { username, displayName, email, password } = parsed.data
    const role = (req.body.role === 'ADMIN' || req.body.role === 'CONSULTANT') ? req.body.role : 'USER'
    const allowedModules = Array.isArray(req.body.allowedModules) ? req.body.allowedModules : []

    const hashedPassword = await hashPassword(password)
    const avatarColor = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`

    try {
      const user = await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({ where: { username } })
        if (existing) return null

        return tx.user.create({
          data: {
            username,
            displayName,
            email: email ?? null,
            password: hashedPassword,
            role,
            allowedModules: role === 'ADMIN' ? [] : allowedModules,
            avatarColor,
          },
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            role: true,
            active: true,
            avatarColor: true,
            allowedModules: true,
            createdAt: true,
          },
        })
      })

      if (!user) {
        return res.status(409).json({ error: 'Nome de utilizador ja existe.' })
      }

      return res.status(201).json(user)
    } catch {
      return res.status(500).json({ error: 'Erro ao criar utilizador.' })
    }
  })

  // DELETE /users/:id (deactivate)
  r.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const id = Number(req.params.id)
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID invalido.' })
    }

    // Prevent self-deactivation
    if (id === req.user!.userId) {
      return res.status(400).json({ error: 'Nao pode desativar a propria conta.' })
    }

    // Prevent removing the last admin
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true, active: true } })
    if (!target || !target.active) {
      return res.status(404).json({ error: 'Utilizador nao encontrado.' })
    }
    if (target.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN', active: true } })
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Tem de existir pelo menos um administrador.' })
      }
    }

    try {
      await prisma.user.update({
        where: { id },
        data: { active: false },
      })
      return res.json({ ok: true })
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2025') {
        return res.status(404).json({ error: 'Utilizador nao encontrado.' })
      }
      throw err
    }
  })

  return r
}
