# Todo, Notifications, Trash & Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add authentication, soft-delete/trash, todo app, notification system, and a unified sidebar to the Mesa de Recibos platform.

**Architecture:** JWT-based auth with httpOnly cookies, Prisma models for all new entities, Express routers following existing patterns (factory functions taking PrismaClient), React hooks + components following the existing module pattern. SSE for real-time notifications. Service Worker for browser push.

**Tech Stack:** Express 5, Prisma 6, React 19, TypeScript, bcryptjs, jsonwebtoken, Zod validation, Lucide icons

---

## Task 1: Install New Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install auth + utility packages**

Run:
```bash
npm install bcryptjs jsonwebtoken cookie-parser
npm install -D @types/bcryptjs @types/jsonwebtoken @types/cookie-parser
```

**Step 2: Verify installation**

Run: `npm ls bcryptjs jsonwebtoken cookie-parser`
Expected: All three listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add auth dependencies (bcryptjs, jsonwebtoken, cookie-parser)"
```

---

## Task 2: Database Schema — Auth Models

**Files:**
- Modify: `prisma/schema.prisma` (add after line 33, before model Status)

**Step 1: Add User model and UserRole enum to schema.prisma**

Add after the `DsIvaKind` enum (line 33):

```prisma
enum UserRole {
  ADMIN
  USER
}

model User {
  id          Int       @id @default(autoincrement())
  username    String    @unique
  displayName String
  email       String?   @unique
  password    String
  role        UserRole  @default(USER)
  avatarColor String?
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  todosCreated      Todo[]         @relation("TodoCreator")
  todosAssigned     Todo[]         @relation("TodoAssignee")
  todoComments      TodoComment[]
  notifications     Notification[]
  notificationPrefs NotificationPreference?
}
```

**Step 2: Run migration**

Run: `npx prisma migrate dev --name add-user-model`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(db): add User model with UserRole enum"
```

---

## Task 3: Database Schema — Soft Delete Fields

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add deletedAt and deletedById to Record model**

Add before `@@index([ano, mes])` (around line 80):

```prisma
  deletedAt   DateTime?
  deletedById Int?
  deletedBy   User?    @relation("RecordDeleter", fields: [deletedById], references: [id])
```

Add the corresponding relation array to the User model:
```prisma
  deletedRecords         Record[]         @relation("RecordDeleter")
```

**Step 2: Add same fields to DsRecord model**

Add before `@@index([statusId])` (around line 187):

```prisma
  deletedAt   DateTime?
  deletedById Int?
  deletedBy   User?    @relation("DsRecordDeleter", fields: [deletedById], references: [id])
```

Add to User model:
```prisma
  deletedDsRecords       DsRecord[]       @relation("DsRecordDeleter")
```

**Step 3: Add same fields to PenhorasRecord model**

Add before `@@index([statusId])` (around line 228):

```prisma
  deletedAt   DateTime?
  deletedById Int?
  deletedBy   User?    @relation("PenhorasRecordDeleter", fields: [deletedById], references: [id])
```

Add to User model:
```prisma
  deletedPenhorasRecords PenhorasRecord[] @relation("PenhorasRecordDeleter")
```

**Step 4: Add index on deletedAt for each record table**

Add to Record: `@@index([deletedAt])`
Add to DsRecord: `@@index([deletedAt])`
Add to PenhorasRecord: `@@index([deletedAt])`

**Step 5: Run migration**

Run: `npx prisma migrate dev --name add-soft-delete-fields`
Expected: Migration applied successfully

**Step 6: Commit**

```bash
git add prisma/
git commit -m "feat(db): add soft-delete fields to Record, DsRecord, PenhorasRecord"
```

---

## Task 4: Database Schema — Todo Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add Todo enums and models**

Add after the User model:

```prisma
enum TodoPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TodoStatus {
  PENDING
  IN_PROGRESS
  DONE
}

model Todo {
  id             Int          @id @default(autoincrement())
  title          String
  description    String?
  priority       TodoPriority @default(MEDIUM)
  status         TodoStatus   @default(PENDING)
  dueDate        DateTime?

  createdById    Int
  createdBy      User         @relation("TodoCreator", fields: [createdById], references: [id])
  assigneeId     Int?
  assignee       User?        @relation("TodoAssignee", fields: [assigneeId], references: [id])

  linkedModule   String?
  linkedRecordId String?

  deletedAt      DateTime?
  deletedById    Int?

  subtasks       TodoSubtask[]
  comments       TodoComment[]

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([createdById])
  @@index([assigneeId])
  @@index([status])
  @@index([deletedAt])
}

model TodoSubtask {
  id        Int     @id @default(autoincrement())
  todoId    Int
  todo      Todo    @relation(fields: [todoId], references: [id], onDelete: Cascade)
  title     String
  completed Boolean @default(false)
  order     Int     @default(0)

  @@index([todoId])
}

model TodoComment {
  id        Int      @id @default(autoincrement())
  todoId    Int
  todo      Todo     @relation(fields: [todoId], references: [id], onDelete: Cascade)
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  content   String
  createdAt DateTime @default(now())

  @@index([todoId])
}
```

Note: `linkedRecordId` is `String?` because the existing Record/DsRecord/PenhorasRecord models use cuid() String IDs.

**Step 2: Run migration**

Run: `npx prisma migrate dev --name add-todo-models`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(db): add Todo, TodoSubtask, TodoComment models"
```

---

## Task 5: Database Schema — Notification Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add Notification models**

```prisma
enum NotificationType {
  TASK_ASSIGNED
  TASK_COMPLETED
  TASK_COMMENTED
  TASK_DUE_SOON
  RECORD_STATUS_CHANGE
  MENTION
}

model Notification {
  id             Int              @id @default(autoincrement())
  userId         Int
  user           User             @relation(fields: [userId], references: [id])
  type           NotificationType
  title          String
  message        String
  read           Boolean          @default(false)
  linkedModule   String?
  linkedRecordId String?
  linkedTodoId   Int?
  createdAt      DateTime         @default(now())

  @@index([userId, read])
  @@index([userId, createdAt])
}

model NotificationPreference {
  id                  Int     @id @default(autoincrement())
  userId              Int     @unique
  user                User    @relation(fields: [userId], references: [id])
  taskAssigned        Boolean @default(true)
  taskCompleted       Boolean @default(true)
  taskCommented       Boolean @default(true)
  taskDueSoon         Boolean @default(true)
  recordStatusChange  Boolean @default(true)
  mention             Boolean @default(true)
}
```

**Step 2: Run migration**

Run: `npx prisma migrate dev --name add-notification-models`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(db): add Notification, NotificationPreference models"
```

---

## Task 6: Auth Backend — Middleware & Helpers

**Files:**
- Create: `server/src/middleware/auth.ts`
- Create: `server/src/services/auth.ts`

**Step 1: Create auth service with JWT helpers**

Create `server/src/services/auth.ts`:

```typescript
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const JWT_EXPIRY = '7d'
const SALT_ROUNDS = 12

export interface JwtPayload {
  userId: number
  username: string
  role: string
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}
```

**Step 2: Create auth middleware**

Create `server/src/middleware/auth.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express'
import { verifyToken, type JwtPayload } from '../services/auth'

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token
  if (!token) {
    return res.status(401).json({ error: 'Autenticacao necessaria.' })
  }
  try {
    req.user = verifyToken(token)
    next()
  } catch {
    return res.status(401).json({ error: 'Token invalido ou expirado.' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Apenas administradores.' })
  }
  next()
}
```

**Step 3: Commit**

```bash
git add server/src/middleware/auth.ts server/src/services/auth.ts
git commit -m "feat(auth): add JWT service and auth middleware"
```

---

## Task 7: Auth Backend — Routes

**Files:**
- Create: `server/src/routes/auth.ts`
- Create: `server/src/schemas/auth.ts`

**Step 1: Create auth Zod schemas**

Create `server/src/schemas/auth.ts`:

```typescript
import { z } from 'zod'

export const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
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
  avatarColor: z.string().optional(),
})
```

**Step 2: Create auth router**

Create `server/src/routes/auth.ts`:

```typescript
import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { hashPassword, verifyPassword, signToken } from '../services/auth'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { registerSchema, loginSchema, updateUserSchema } from '../schemas/auth'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
}

export function createAuthRouter(prisma: PrismaClient) {
  const r = Router()

  // Register
  r.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const { username, displayName, email, password } = parsed.data

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, ...(email ? [{ email }] : [])] },
    })
    if (existing) return res.status(409).json({ error: 'Utilizador ja existe.' })

    // First user becomes admin
    const userCount = await prisma.user.count()
    const role = userCount === 0 ? 'ADMIN' : 'USER'

    const user = await prisma.user.create({
      data: {
        username,
        displayName,
        email: email || null,
        password: await hashPassword(password),
        role,
        avatarColor: `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`,
      },
    })

    const token = signToken({ userId: user.id, username: user.username, role: user.role })
    res.cookie('token', token, COOKIE_OPTIONS)
    res.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role, avatarColor: user.avatarColor })
  })

  // Login
  r.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const user = await prisma.user.findUnique({ where: { username: parsed.data.username } })
    if (!user || !user.active) return res.status(401).json({ error: 'Credenciais invalidas.' })

    const valid = await verifyPassword(parsed.data.password, user.password)
    if (!valid) return res.status(401).json({ error: 'Credenciais invalidas.' })

    const token = signToken({ userId: user.id, username: user.username, role: user.role })
    res.cookie('token', token, COOKIE_OPTIONS)
    res.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role, avatarColor: user.avatarColor, email: user.email })
  })

  // Logout
  r.post('/logout', (_req, res) => {
    res.clearCookie('token', { path: '/' })
    res.json({ ok: true })
  })

  // Me
  r.get('/me', requireAuth, async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, username: true, displayName: true, email: true, role: true, avatarColor: true, active: true },
    })
    if (!user || !user.active) return res.status(401).json({ error: 'Utilizador nao encontrado.' })
    res.json(user)
  })

  // List users (for assignment dropdowns)
  r.get('/users', requireAuth, async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, username: true, displayName: true, avatarColor: true, role: true },
      orderBy: { displayName: 'asc' },
    })
    res.json(users)
  })

  // Update user (admin only)
  r.patch('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: parsed.data,
      select: { id: true, username: true, displayName: true, email: true, role: true, avatarColor: true, active: true },
    })
    res.json(user)
  })

  // Deactivate user (admin only)
  r.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: { active: false },
    })
    res.json({ ok: true })
  })

  return r
}
```

**Step 3: Commit**

```bash
git add server/src/routes/auth.ts server/src/schemas/auth.ts
git commit -m "feat(auth): add auth routes (register, login, logout, me, user management)"
```

---

## Task 8: Wire Auth into Server

**Files:**
- Modify: `server/src/index.ts`

**Step 1: Add cookie-parser and auth router to server**

In `server/src/index.ts`:

1. Add import at top: `import cookieParser from 'cookie-parser'`
2. Add import: `import { createAuthRouter } from './routes/auth'`
3. Add import: `import { requireAuth } from './middleware/auth'`
4. Add after `app.use(express.json(...))`: `app.use(cookieParser())`
5. Mount auth router BEFORE other routes: `app.use('/api/auth', createAuthRouter(prisma))`
6. Add `requireAuth` to all existing routes:
   - Change `app.use('/api', createRecordsRouter(prisma))` to `app.use('/api', requireAuth, createRecordsRouter(prisma))`
   - Same for DS, Penhoras, Statuses, Settings, Data routers

**Step 2: Verify server starts**

Run: `npm run dev:server`
Expected: Server starts without errors on port 4000

**Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(auth): wire auth middleware into server, protect all routes"
```

---

## Task 9: Auth Frontend — Types & API Client

**Files:**
- Modify: `src/types.ts`
- Modify: `src/api.ts`

**Step 1: Add auth types to types.ts**

Add at the top of `src/types.ts`:

```typescript
export interface AuthUser {
  id: number
  username: string
  displayName: string
  email: string | null
  role: 'ADMIN' | 'USER'
  avatarColor: string | null
}

export interface UserSummary {
  id: number
  username: string
  displayName: string
  avatarColor: string | null
  role: 'ADMIN' | 'USER'
}
```

**Step 2: Add auth API functions to api.ts**

Add to the api object in `src/api.ts`:

```typescript
  // Auth
  async login(username: string, password: string): Promise<AuthUser> {
    return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
  },
  async register(data: { username: string; displayName: string; email?: string; password: string }): Promise<AuthUser> {
    return request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) })
  },
  async logout(): Promise<void> {
    return request('/api/auth/logout', { method: 'POST' })
  },
  async getMe(): Promise<AuthUser> {
    return request('/api/auth/me')
  },
  async getUsers(): Promise<UserSummary[]> {
    return request('/api/auth/users')
  },
  async updateUser(id: number, data: Record<string, unknown>): Promise<AuthUser> {
    return request(`/api/auth/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  },
  async deactivateUser(id: number): Promise<void> {
    return request(`/api/auth/users/${id}`, { method: 'DELETE' })
  },
```

**Step 3: Commit**

```bash
git add src/types.ts src/api.ts
git commit -m "feat(auth): add auth types and API client functions"
```

---

## Task 10: Auth Frontend — useAuth Hook

**Files:**
- Create: `src/hooks/useAuth.ts`

**Step 1: Create useAuth hook**

Create `src/hooks/useAuth.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { AuthUser, UserSummary } from '../types'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Check session on mount
  useEffect(() => {
    api.getMe()
      .then((u) => { setUser(u); setLoading(false) })
      .catch(() => { setUser(null); setLoading(false) })
  }, [])

  // Load users list when authenticated
  useEffect(() => {
    if (user) {
      api.getUsers().then(setUsers).catch(() => {})
    }
  }, [user])

  const login = useCallback(async (username: string, password: string) => {
    setError('')
    try {
      const u = await api.login(username, password)
      setUser(u)
      return u
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao iniciar sessao.'
      setError(msg)
      throw e
    }
  }, [])

  const register = useCallback(async (data: { username: string; displayName: string; email?: string; password: string }) => {
    setError('')
    try {
      const u = await api.register(data)
      setUser(u)
      return u
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao registar.'
      setError(msg)
      throw e
    }
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
    setUsers([])
  }, [])

  const refreshUsers = useCallback(async () => {
    const u = await api.getUsers()
    setUsers(u)
  }, [])

  return { user, users, loading, error, login, register, logout, refreshUsers, isAdmin: user?.role === 'ADMIN' }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useAuth.ts
git commit -m "feat(auth): add useAuth hook with login, register, logout"
```

---

## Task 11: Auth Frontend — Login Page

**Files:**
- Create: `src/components/auth/LoginPage.tsx`
- Create: `src/components/auth/LoginPage.css`

**Step 1: Create LoginPage component**

Create `src/components/auth/LoginPage.tsx` — a simple form with username/password fields, login button, and a link to register. Include a registration form toggle. Style it to match the existing app theme (use CSS variables from the theme system).

Key elements:
- Two modes: login and register
- Login: username + password
- Register: username + display name + email (optional) + password + confirm password
- Error display
- App logo/branding at top
- Calls `useAuth().login()` or `useAuth().register()`

**Step 2: Create matching CSS file**

Style using existing CSS variable patterns (check `src/App.css` for `--bg`, `--fg`, `--accent` variable names).

**Step 3: Commit**

```bash
git add src/components/auth/
git commit -m "feat(auth): add LoginPage component with login/register forms"
```

---

## Task 12: Wire Auth into App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add auth gate to App component**

At the top of the App component:
1. Import `useAuth` and `LoginPage`
2. Call `const auth = useAuth()`
3. If `auth.loading` — show a loading spinner
4. If `!auth.user` — render `<LoginPage>` instead of the main app
5. Pass `auth.user` and `auth.users` down to components that need them
6. Add user avatar + logout button in the top bar area

**Step 2: Add user avatar to top bar**

In the brand/header area, add after the existing module tabs:
- User avatar circle (colored with `user.avatarColor`, showing initials)
- Click to show dropdown with: username, role badge, "Gerir Utilizadores" (admin only), "Terminar Sessao"

**Step 3: Verify the app loads**

Run: `npm run dev`
Expected: App shows login page. After login, shows main app.

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(auth): gate main app behind login, add user avatar to top bar"
```

---

## Task 13: Soft Delete Backend — Records Router

**Files:**
- Modify: `server/src/routes/records.ts`

**Step 1: Add deletedAt filter to all record queries**

In every `prisma.record.findMany()` call in records.ts, add `deletedAt: null` to the where clause. This ensures soft-deleted records don't appear in normal queries.

**Step 2: Add trash query support**

In the `GET /records` handler, check for `req.query.trash === 'true'`. If true, use `deletedAt: { not: null }` instead of `deletedAt: null`. Include `deletedBy` relation in the select.

**Step 3: Add soft-delete endpoint**

Add `DELETE /records/:id` handler:

```typescript
r.delete('/records/:id', async (req, res) => {
  await prisma.record.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date(), deletedById: req.user!.userId },
  })
  res.json({ ok: true })
})
```

**Step 4: Add restore endpoint**

```typescript
r.post('/records/:id/restore', async (req, res) => {
  await prisma.record.update({
    where: { id: req.params.id },
    data: { deletedAt: null, deletedById: null },
  })
  res.json({ ok: true })
})
```

**Step 5: Add permanent delete endpoint (admin only)**

```typescript
r.delete('/records/:id/permanent', requireAdmin, async (req, res) => {
  await prisma.record.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})
```

**Step 6: Add trash count endpoint**

```typescript
r.get('/records/trash/count', async (_req, res) => {
  const count = await prisma.record.count({ where: { deletedAt: { not: null } } })
  res.json({ count })
})
```

**Step 7: Commit**

```bash
git add server/src/routes/records.ts
git commit -m "feat(trash): add soft-delete, restore, permanent delete to records router"
```

---

## Task 14: Soft Delete Backend — DS & Penhoras Routers

**Files:**
- Modify: `server/src/routes/ds.ts`
- Modify: `server/src/routes/penhoras.ts`

**Step 1: Apply same pattern to DS router**

Same changes as Task 13 but for `DsRecord`:
- Add `deletedAt: null` to all findMany queries
- Add `?trash=true` support to GET
- Add `DELETE /records/:id` (soft delete)
- Add `POST /records/:id/restore`
- Add `DELETE /records/:id/permanent` (admin only)
- Add `GET /records/trash/count`

**Step 2: Apply same pattern to Penhoras router**

Same changes for `PenhorasRecord`.

**Step 3: Commit**

```bash
git add server/src/routes/ds.ts server/src/routes/penhoras.ts
git commit -m "feat(trash): add soft-delete to DS and Penhoras routers"
```

---

## Task 15: Soft Delete Frontend — API Client & Types

**Files:**
- Modify: `src/api.ts`
- Modify: `src/types.ts`

**Step 1: Add trash-related API functions**

Add to the api object in `src/api.ts`:

```typescript
  // Trash - Recibos
  async deleteRecord(id: string): Promise<void> {
    return request(`/api/records/${id}`, { method: 'DELETE' })
  },
  async restoreRecord(id: string): Promise<void> {
    return request(`/api/records/${id}/restore`, { method: 'POST' })
  },
  async permanentDeleteRecord(id: string): Promise<void> {
    return request(`/api/records/${id}/permanent`, { method: 'DELETE' })
  },
  async getRecordsTrashCount(): Promise<{ count: number }> {
    return request('/api/records/trash/count')
  },
  async getTrashRecords(filters?: Record<string, string>): Promise<RecordsResponse> {
    const qs = filters ? '&' + new URLSearchParams(filters).toString() : ''
    return request(`/api/records?trash=true${qs}`)
  },

  // Same pattern for DS and Penhoras...
  async deleteDsRecord(id: string): Promise<void> { ... },
  async restoreDsRecord(id: string): Promise<void> { ... },
  async permanentDeleteDsRecord(id: string): Promise<void> { ... },
  async getDsTrashCount(): Promise<{ count: number }> { ... },

  async deletePenhorasRecord(id: string): Promise<void> { ... },
  async restorePenhorasRecord(id: string): Promise<void> { ... },
  async permanentDeletePenhorasRecord(id: string): Promise<void> { ... },
  async getPenhorasTrashCount(): Promise<{ count: number }> { ... },
```

**Step 2: Add deleted fields to record types in types.ts**

Add `deletedAt?: string | null` and `deletedById?: number | null` and `deletedBy?: { displayName: string } | null` to `ReceiptRecord`, `DsRecord`, and `PenhorasRecord` interfaces.

**Step 3: Commit**

```bash
git add src/api.ts src/types.ts
git commit -m "feat(trash): add trash API client functions and type updates"
```

---

## Task 16: Soft Delete Frontend — Delete Confirmation Modal

**Files:**
- Create: `src/components/shared/ConfirmDeleteModal.tsx`

**Step 1: Create reusable confirmation modal**

A simple modal component with:
- Props: `open`, `onConfirm`, `onCancel`, `title`, `message`
- Red "Mover para Lixeira" button
- Gray "Cancelar" button
- Warning icon from Lucide
- Message about 30-day retention

**Step 2: Commit**

```bash
git add src/components/shared/ConfirmDeleteModal.tsx
git commit -m "feat(trash): add ConfirmDeleteModal component"
```

---

## Task 17: Soft Delete Frontend — Add Delete to Table Views

**Files:**
- Modify: `src/components/recibos/RecibosConsultaTabela.tsx`
- Modify: `src/components/ds/DsConsultaTabela.tsx`
- Modify: `src/components/penhoras/PenhorasConsultaTabela.tsx`

**Step 1: Add delete button to each table row**

For each module's table component:
1. Import `Trash2` icon from Lucide
2. Import `ConfirmDeleteModal`
3. Add delete state: `const [deleteTarget, setDeleteTarget] = useState<string | null>(null)`
4. Add trash icon button to each row's actions column
5. On click: `setDeleteTarget(record.id)`
6. Render `ConfirmDeleteModal` when `deleteTarget` is set
7. On confirm: call `api.deleteRecord(deleteTarget)`, refresh list, show feedback
8. Add a small trash indicator showing count from `api.getRecordsTrashCount()`

**Step 2: Commit**

```bash
git add src/components/recibos/RecibosConsultaTabela.tsx src/components/ds/DsConsultaTabela.tsx src/components/penhoras/PenhorasConsultaTabela.tsx
git commit -m "feat(trash): add delete buttons to all module table views"
```

---

## Task 18: Todo Backend — Routes & Schemas

**Files:**
- Create: `server/src/routes/todos.ts`
- Create: `server/src/schemas/todos.ts`

**Step 1: Create todo Zod schemas**

Create `server/src/schemas/todos.ts`:

```typescript
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
```

**Step 2: Create todos router**

Create `server/src/routes/todos.ts` with full CRUD following the existing router factory pattern:

- `GET /todos` — list with filters (assigneeId, status, priority, linkedModule, createdById). Include subtasks and comments count. Filter `deletedAt: null`.
- `POST /todos` — create todo. Set `createdById` from `req.user`. Trigger TASK_ASSIGNED notification if assigneeId is set and differs from creator.
- `PATCH /todos/:id` — update. If status changes to DONE, trigger TASK_COMPLETED notification to creator. If assigneeId changes, trigger TASK_ASSIGNED.
- `DELETE /todos/:id` — soft delete.
- `POST /todos/:id/restore` — restore from trash.
- `POST /todos/:id/subtasks` — create subtask.
- `PATCH /todos/:id/subtasks/:sid` — update subtask.
- `DELETE /todos/:id/subtasks/:sid` — hard delete subtask.
- `GET /todos/:id/comments` — list comments with author info.
- `POST /todos/:id/comments` — add comment. Trigger TASK_COMMENTED notification to participants. Parse @mentions and trigger MENTION notifications.

**Step 3: Wire into server**

In `server/src/index.ts`, add:
```typescript
import { createTodosRouter } from './routes/todos'
app.use('/api/todos', requireAuth, createTodosRouter(prisma))
```

**Step 4: Commit**

```bash
git add server/src/routes/todos.ts server/src/schemas/todos.ts server/src/index.ts
git commit -m "feat(todos): add todo CRUD routes with subtasks and comments"
```

---

## Task 19: Notification Backend — Service & Routes

**Files:**
- Create: `server/src/services/notifications.ts`
- Create: `server/src/routes/notifications.ts`
- Create: `server/src/schemas/notifications.ts`

**Step 1: Create notification service**

Create `server/src/services/notifications.ts`:

Core function: `createNotification(prisma, { userId, type, title, message, linkedModule?, linkedRecordId?, linkedTodoId? })`.
1. Check user's NotificationPreference for this type
2. If preference is off, skip
3. Create notification record
4. Push to SSE stream (see Task 20)

Also: `parseMentions(text: string): string[]` — extract `@username` patterns from text.

**Step 2: Create notification Zod schema**

Create `server/src/schemas/notifications.ts`:

```typescript
import { z } from 'zod'

export const notificationPreferenceSchema = z.object({
  taskAssigned: z.boolean().optional(),
  taskCompleted: z.boolean().optional(),
  taskCommented: z.boolean().optional(),
  taskDueSoon: z.boolean().optional(),
  recordStatusChange: z.boolean().optional(),
  mention: z.boolean().optional(),
})
```

**Step 3: Create notifications router**

Create `server/src/routes/notifications.ts`:

- `GET /notifications` — paginated list for current user, ordered by createdAt desc
- `PATCH /notifications/:id/read` — mark as read
- `POST /notifications/read-all` — mark all as read for current user
- `GET /notifications/unread-count` — count of unread notifications
- `GET /notifications/preferences` — get or create default preferences
- `PATCH /notifications/preferences` — update preferences

**Step 4: Wire into server**

```typescript
import { createNotificationsRouter } from './routes/notifications'
app.use('/api/notifications', requireAuth, createNotificationsRouter(prisma))
```

**Step 5: Commit**

```bash
git add server/src/services/notifications.ts server/src/routes/notifications.ts server/src/schemas/notifications.ts server/src/index.ts
git commit -m "feat(notifications): add notification service and routes"
```

---

## Task 20: SSE Real-Time Notifications

**Files:**
- Create: `server/src/services/sse.ts`
- Modify: `server/src/routes/notifications.ts`

**Step 1: Create SSE manager**

Create `server/src/services/sse.ts`:

```typescript
import type { Response } from 'express'

const clients = new Map<number, Set<Response>>()

export function addSseClient(userId: number, res: Response) {
  if (!clients.has(userId)) clients.set(userId, new Set())
  clients.get(userId)!.add(res)
  res.on('close', () => {
    clients.get(userId)?.delete(res)
    if (clients.get(userId)?.size === 0) clients.delete(userId)
  })
}

export function pushToUser(userId: number, event: string, data: unknown) {
  const userClients = clients.get(userId)
  if (!userClients) return
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of userClients) {
    res.write(payload)
  }
}
```

**Step 2: Add SSE endpoint to notifications router**

```typescript
r.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  addSseClient(req.user!.userId, res)
  // Send heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => res.write(':heartbeat\n\n'), 30000)
  res.on('close', () => clearInterval(heartbeat))
})
```

**Step 3: Update notification service to push via SSE**

After creating a notification in the database, call `pushToUser(userId, 'notification', notificationData)`.

**Step 4: Commit**

```bash
git add server/src/services/sse.ts server/src/routes/notifications.ts server/src/services/notifications.ts
git commit -m "feat(notifications): add SSE real-time notification delivery"
```

---

## Task 21: Notification & Todo Frontend — Types & API

**Files:**
- Modify: `src/types.ts`
- Modify: `src/api.ts`

**Step 1: Add todo and notification types**

Add to `src/types.ts`:

```typescript
export interface TodoItem {
  id: number
  title: string
  description: string | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE'
  dueDate: string | null
  createdById: number
  createdBy: UserSummary
  assigneeId: number | null
  assignee: UserSummary | null
  linkedModule: string | null
  linkedRecordId: string | null
  subtasks: TodoSubtask[]
  _count?: { comments: number }
  createdAt: string
  updatedAt: string
}

export interface TodoSubtask {
  id: number
  title: string
  completed: boolean
  order: number
}

export interface TodoComment {
  id: number
  content: string
  author: UserSummary
  createdAt: string
}

export interface NotificationItem {
  id: number
  type: string
  title: string
  message: string
  read: boolean
  linkedModule: string | null
  linkedRecordId: string | null
  linkedTodoId: number | null
  createdAt: string
}

export interface NotificationPreferences {
  taskAssigned: boolean
  taskCompleted: boolean
  taskCommented: boolean
  taskDueSoon: boolean
  recordStatusChange: boolean
  mention: boolean
}
```

**Step 2: Add todo and notification API functions**

Add to `src/api.ts` — all CRUD operations for todos, subtasks, comments, notifications, and preferences. Follow the same `request()` pattern used throughout.

**Step 3: Commit**

```bash
git add src/types.ts src/api.ts
git commit -m "feat: add todo and notification types and API client functions"
```

---

## Task 22: Frontend Hooks — useTodos & useNotifications

**Files:**
- Create: `src/hooks/useTodos.ts`
- Create: `src/hooks/useNotifications.ts`

**Step 1: Create useTodos hook**

Manages todo list state, filters, CRUD operations. Exposes:
- `todos`, `loading`, `filters`, `setFilters`
- `createTodo()`, `updateTodo()`, `deleteTodo()`
- `addSubtask()`, `toggleSubtask()`, `deleteSubtask()`
- `addComment()`, `getComments()`
- `myTodosCount`, `allTodosCount`

**Step 2: Create useNotifications hook**

Manages notification state with SSE connection. Exposes:
- `notifications`, `unreadCount`, `loading`
- `markRead()`, `markAllRead()`
- `preferences`, `updatePreferences()`
- SSE auto-reconnection on disconnect

The hook opens an EventSource to `/api/notifications/stream` and updates state when new notifications arrive.

**Step 3: Commit**

```bash
git add src/hooks/useTodos.ts src/hooks/useNotifications.ts
git commit -m "feat: add useTodos and useNotifications hooks"
```

---

## Task 23: Sidebar Shell Component

**Files:**
- Create: `src/components/sidebar/Sidebar.tsx`
- Create: `src/components/sidebar/Sidebar.css`
- Modify: `src/App.tsx`

**Step 1: Create Sidebar component**

A collapsible right panel with:
- Three tab buttons at top: Tarefas (CheckSquare icon), Notificacoes (Bell icon), Lixeira (Trash2 icon)
- Each tab shows a badge count
- Active tab renders the corresponding panel content (placeholder for now)
- Collapse/expand toggle button
- Width: 360px
- CSS transition for smooth open/close
- Keyboard shortcut: Alt+T to toggle

**Step 2: Wire into App.tsx**

Add sidebar state and render `<Sidebar>` component alongside the main content area. Adjust the main content area CSS to shrink when sidebar is open.

**Step 3: Commit**

```bash
git add src/components/sidebar/ src/App.tsx
git commit -m "feat(sidebar): add collapsible right sidebar shell with tab navigation"
```

---

## Task 24: Sidebar — Todos Tab

**Files:**
- Create: `src/components/sidebar/TodosPanel.tsx`
- Create: `src/components/sidebar/TodoCard.tsx`
- Create: `src/components/sidebar/TodoExpandedView.tsx`

**Step 1: Create TodosPanel**

The main panel for the Todos sidebar tab:
- Quick-add input at top (title + Enter to create)
- Filter pills: "As Minhas" / "Todas" toggle, status filter, priority filter
- Scrollable list of TodoCard components
- Empty state when no todos

**Step 2: Create TodoCard**

Compact card for a single todo:
- Title (truncated), priority color badge (LOW=gray, MEDIUM=blue, HIGH=orange, URGENT=red)
- Assignee avatar circle, due date (red if overdue)
- Linked record chip if linkedModule is set
- Subtask progress bar (e.g., "3/5")
- Click to expand

**Step 3: Create TodoExpandedView**

Expanded inline view when a TodoCard is clicked:
- Editable title, description textarea
- Assignee picker dropdown (from users list)
- Priority selector, due date picker
- Subtask checklist (add/toggle/delete subtasks)
- Comments thread with add comment input
- Save/cancel buttons
- Delete button (soft delete)

**Step 4: Commit**

```bash
git add src/components/sidebar/TodosPanel.tsx src/components/sidebar/TodoCard.tsx src/components/sidebar/TodoExpandedView.tsx
git commit -m "feat(todos): add Todos sidebar panel with cards and expanded view"
```

---

## Task 25: Sidebar — Notifications Tab

**Files:**
- Create: `src/components/sidebar/NotificationsPanel.tsx`
- Create: `src/components/sidebar/NotificationItem.tsx`

**Step 1: Create NotificationsPanel**

- "Marcar todas como lidas" button at top
- Scrollable list of NotificationItem components
- Grouped by time: "Hoje", "Ontem", "Anteriores"
- Empty state when no notifications
- Gear icon linking to notification preferences

**Step 2: Create NotificationItem**

- Icon based on notification type (CheckSquare for task, Bell for mention, etc.)
- Title + message text
- Unread indicator (bold + blue dot)
- Click to navigate to linked todo/record
- Relative time ("ha 5 min", "ha 2 horas")

**Step 3: Commit**

```bash
git add src/components/sidebar/NotificationsPanel.tsx src/components/sidebar/NotificationItem.tsx
git commit -m "feat(notifications): add Notifications sidebar panel"
```

---

## Task 26: Sidebar — Trash Tab

**Files:**
- Create: `src/components/sidebar/TrashPanel.tsx`
- Create: `src/components/sidebar/TrashItem.tsx`
- Create: `src/hooks/useTrash.ts`

**Step 1: Create useTrash hook**

Manages trash state across all modules:
- Fetches trash records from all 3 modules + todos
- `trashItems` combined and sorted by deletedAt
- `restore(module, id)`, `permanentDelete(module, id)`
- `emptyTrash(module?)` — admin only
- `totalCount` for badge

**Step 2: Create TrashPanel**

- Module filter tabs: "Todos" / "Recibos" / "DS" / "Penhoras" / "Tarefas"
- Scrollable list of TrashItem components
- "Esvaziar Lixeira" button (admin only) with confirmation
- Shows "Eliminacao permanente em X dias" for each item

**Step 3: Create TrashItem**

- Module badge (color-coded)
- Record identifier (processo, referencia, PE, or todo title)
- "Eliminado por [user] ha X dias"
- "Eliminacao em X dias"
- Restore button (undo icon)
- Permanent delete button (admin only, X icon)

**Step 4: Commit**

```bash
git add src/components/sidebar/TrashPanel.tsx src/components/sidebar/TrashItem.tsx src/hooks/useTrash.ts
git commit -m "feat(trash): add unified Trash sidebar panel"
```

---

## Task 27: Bell Icon & Notification Badge in Top Bar

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add bell icon next to user avatar**

In the top bar area of App.tsx:
- Add Bell icon from Lucide with unread count badge (red circle with number)
- Click bell toggles sidebar open to Notifications tab
- Badge disappears when count is 0

**Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(notifications): add bell icon with unread badge to top bar"
```

---

## Task 28: Record Detail Drawers — Create Todo Action

**Files:**
- Modify: `src/components/recibos/RecibosRecordDrawer.tsx`
- Modify: `src/components/ds/DsRecordDrawer.tsx`
- Modify: `src/components/penhoras/PenhorasRecordDrawer.tsx`

**Step 1: Add "Criar Tarefa" button to each drawer**

In each record detail drawer, add a button that:
1. Opens the sidebar to Todos tab
2. Pre-fills a new todo with `linkedModule` and `linkedRecordId` set
3. Focuses the quick-add input in the sidebar

**Step 2: Commit**

```bash
git add src/components/recibos/RecibosRecordDrawer.tsx src/components/ds/DsRecordDrawer.tsx src/components/penhoras/PenhorasRecordDrawer.tsx
git commit -m "feat(todos): add 'Create Task' action to record detail drawers"
```

---

## Task 29: Admin Panel — User Management

**Files:**
- Create: `src/components/admin/UserManagement.tsx`
- Modify: `src/App.tsx`

**Step 1: Create UserManagement component**

Table of all users with:
- Columns: avatar, display name, username, email, role, status (active/inactive)
- "Criar Utilizador" button → registration form dialog
- Edit button per row → inline edit or modal for displayName, email, role
- Deactivate button per row → confirmation dialog
- Only accessible to ADMIN role users

**Step 2: Wire into App.tsx**

Add as a new section accessible from the user avatar dropdown ("Gerir Utilizadores"). Could be rendered as a modal/overlay or a new tab.

**Step 3: Commit**

```bash
git add src/components/admin/UserManagement.tsx src/App.tsx
git commit -m "feat(admin): add user management panel for admins"
```

---

## Task 30: Notification Preferences UI

**Files:**
- Create: `src/components/shared/NotificationPreferences.tsx`

**Step 1: Create preferences component**

Simple toggle list accessible from the notifications panel gear icon:
- Toggle for each notification type with Portuguese labels:
  - "Tarefa atribuida" (taskAssigned)
  - "Tarefa concluida" (taskCompleted)
  - "Comentario em tarefa" (taskCommented)
  - "Tarefa com prazo proximo" (taskDueSoon)
  - "Alteracao de estado de registo" (recordStatusChange)
  - "Mencoes" (mention)
- Save button calls `api.updateNotificationPreferences()`

**Step 2: Commit**

```bash
git add src/components/shared/NotificationPreferences.tsx
git commit -m "feat(notifications): add notification preferences UI"
```

---

## Task 31: Browser Push Notifications (Service Worker)

**Files:**
- Create: `public/sw.js`
- Modify: `src/hooks/useNotifications.ts`

**Step 1: Create Service Worker**

Create `public/sw.js` that listens for push events and shows native notifications. When notification is clicked, focus the app tab.

**Step 2: Register Service Worker in useNotifications**

On first mount (when user is authenticated):
1. Check if `'serviceWorker' in navigator`
2. Register the service worker
3. Request notification permission
4. When SSE receives a notification AND document is not visible, trigger `registration.showNotification()`

**Step 3: Commit**

```bash
git add public/sw.js src/hooks/useNotifications.ts
git commit -m "feat(notifications): add browser push notifications via Service Worker"
```

---

## Task 32: Auto-Purge Scheduled Task

**Files:**
- Create: `server/src/services/purge.ts`
- Modify: `server/src/index.ts`

**Step 1: Create purge service**

Create `server/src/services/purge.ts`:

```typescript
import type { PrismaClient } from '@prisma/client'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function startPurgeScheduler(prisma: PrismaClient) {
  const purge = async () => {
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS)
    const [records, ds, penhoras, todos] = await Promise.all([
      prisma.record.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
      prisma.dsRecord.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
      prisma.penhorasRecord.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
      prisma.todo.deleteMany({ where: { deletedAt: { lt: cutoff } } }),
    ])
    const total = records.count + ds.count + penhoras.count + todos.count
    if (total > 0) console.log(`[purge] Removed ${total} records older than 30 days from trash`)
  }

  // Run daily at 3am
  const scheduleNext = () => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(3, 0, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    const delay = next.getTime() - now.getTime()
    setTimeout(() => { purge().then(scheduleNext) }, delay)
  }
  scheduleNext()

  // Also run once on startup
  purge()
}
```

**Step 2: Wire into server**

Add to `server/src/index.ts` after routes are mounted:
```typescript
import { startPurgeScheduler } from './services/purge'
startPurgeScheduler(prisma)
```

**Step 3: Commit**

```bash
git add server/src/services/purge.ts server/src/index.ts
git commit -m "feat(trash): add 30-day auto-purge scheduler"
```

---

## Task 33: Integration Testing & Polish

**Files:**
- Various test files and component adjustments

**Step 1: Run existing tests to verify nothing is broken**

Run: `npm run test`
Expected: All existing tests pass

**Step 2: Test the full auth flow manually**

1. Start the app: `npm run dev`
2. Navigate to login page
3. Register first user (should become ADMIN)
4. Login with created credentials
5. Verify main app loads with user avatar
6. Verify all 3 modules still work

**Step 3: Test soft-delete flow**

1. Go to Recibos table view
2. Delete a record (verify confirmation dialog)
3. Open sidebar → Trash tab (verify record appears)
4. Restore the record (verify it's back in table)
5. Repeat for DS and Penhoras

**Step 4: Test todo flow**

1. Open sidebar → Todos tab
2. Quick-add a todo
3. Expand todo, add subtasks and a comment
4. Assign to another user (create second user first)
5. Check notifications tab for assignment notification

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration testing fixes and polish"
```

---

## Task 34: Final Review & Cleanup

**Step 1: Run linter**

Run: `npm run lint`
Fix any issues.

**Step 2: Run all tests**

Run: `npm run test`
Expected: All pass.

**Step 3: Build for production**

Run: `npm run build`
Expected: Build succeeds without errors.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup after todo/notifications/trash/auth implementation"
```
