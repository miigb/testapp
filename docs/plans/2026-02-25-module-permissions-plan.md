# Module-Level Permissions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins to assign per-user module access (recibos/ds/penhoras) and introduce a read-only CONSULTANT role.

**Architecture:** Add `CONSULTANT` to Prisma's `UserRole` enum and `allowedModules String[]` to `User`. Two new Express middleware functions (`requireModuleAccess`, `requireWriteAccess`) enforce backend permissions. Frontend `useAuth` hook exposes `canAccessModule`/`canWrite` helpers. Admin panel gains module checkboxes and a third role option.

**Tech Stack:** Prisma + PostgreSQL, Express middleware, React hooks, Zod schemas, JWT (jsonwebtoken + bcryptjs)

**Design doc:** `docs/plans/2026-02-25-module-permissions-design.md`

---

## Task 1: Prisma Schema — Add CONSULTANT role + allowedModules

**Files:**
- Modify: `prisma/schema.prisma:35-60`

**Step 1: Update the UserRole enum**

In `prisma/schema.prisma`, add `CONSULTANT` to the `UserRole` enum:

```prisma
enum UserRole {
  ADMIN
  USER
  CONSULTANT
}
```

**Step 2: Add allowedModules to User model**

In the `User` model (line 40-60), add the `allowedModules` field after the `role` field:

```prisma
model User {
  id              Int       @id @default(autoincrement())
  username        String    @unique
  displayName     String
  email           String?   @unique
  password        String
  role            UserRole  @default(USER)
  allowedModules  String[]  @default([])
  avatarColor     String?
  active          Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // ... existing relations unchanged ...
}
```

**Step 3: Generate and run the migration**

```bash
cd /Users/miguelbrito/Development/codex/testapp
npx prisma migrate dev --name add-consultant-role-and-allowed-modules
```

Expected: Migration creates successfully. Existing users get `allowedModules = []` (empty array).

**Step 4: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: No errors.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add CONSULTANT role and allowedModules to User schema"
```

---

## Task 2: Backend — JWT Payload + Auth Service

**Files:**
- Modify: `server/src/services/auth.ts:8-12`

**Step 1: Add allowedModules to JwtPayload**

In `server/src/services/auth.ts`, update the `JwtPayload` interface:

```typescript
export interface JwtPayload {
  userId: number
  username: string
  role: string
  allowedModules: string[]
}
```

No other changes needed — `signToken` and `verifyToken` are generic and will handle the new field.

**Step 2: Verify the server compiles**

```bash
cd /Users/miguelbrito/Development/codex/testapp
npx tsc --noEmit -p server/tsconfig.json
```

Expected: Compile errors in `routes/auth.ts` where `signToken` is called without `allowedModules`. That's expected and will be fixed in Task 4.

**Step 3: Commit**

```bash
git add server/src/services/auth.ts
git commit -m "feat: add allowedModules to JWT payload type"
```

---

## Task 3: Backend — Permission Middleware

**Files:**
- Modify: `server/src/middleware/auth.ts`

**Step 1: Add ModuleId type and requireModuleAccess middleware**

Add after the existing `requireAdmin` function in `server/src/middleware/auth.ts`:

```typescript
export type ModuleId = 'recibos' | 'ds' | 'penhoras'

export function requireModuleAccess(moduleId: ModuleId) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticacao necessaria.' })
    }
    // ADMIN always has access to all modules
    if (req.user.role === 'ADMIN') {
      return next()
    }
    // USER and CONSULTANT must have the module in their allowedModules
    if (!req.user.allowedModules || !req.user.allowedModules.includes(moduleId)) {
      return res.status(403).json({ error: 'Sem acesso a este modulo.' })
    }
    next()
  }
}
```

**Step 2: Add requireWriteAccess middleware**

Add after `requireModuleAccess`:

```typescript
export function requireWriteAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticacao necessaria.' })
  }
  if (req.user.role === 'CONSULTANT') {
    return res.status(403).json({ error: 'Acesso apenas de leitura.' })
  }
  next()
}
```

**Step 3: Verify the server compiles**

```bash
npx tsc --noEmit -p server/tsconfig.json
```

Expected: May still have errors from Task 2 (`signToken` calls). That's fine — we fix those in Task 4.

**Step 4: Commit**

```bash
git add server/src/middleware/auth.ts
git commit -m "feat: add requireModuleAccess and requireWriteAccess middleware"
```

---

## Task 4: Backend — Auth Routes + Schemas (allowedModules in responses + updates)

**Files:**
- Modify: `server/src/schemas/auth.ts`
- Modify: `server/src/routes/auth.ts`

**Step 1: Update Zod schemas**

In `server/src/schemas/auth.ts`, add `CONSULTANT` to the role enum and `allowedModules` to `updateUserSchema`:

```typescript
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

const validModules = ['recibos', 'ds', 'penhoras'] as const

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().nullable().optional(),
  role: z.enum(['ADMIN', 'USER', 'CONSULTANT']).optional(),
  active: z.boolean().optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  allowedModules: z.array(z.enum(validModules)).optional(),
})
```

**Step 2: Update auth routes — add allowedModules to all user selects and signToken calls**

In `server/src/routes/auth.ts`, apply these changes:

2a. In the **register** handler (POST `/register`), add `allowedModules` to the `select` object (line 47-56):

```typescript
select: {
  id: true,
  username: true,
  displayName: true,
  email: true,
  role: true,
  allowedModules: true,
  active: true,
  avatarColor: true,
  createdAt: true,
},
```

And update the `signToken` call (line 64):

```typescript
const token = signToken({
  userId: user.id,
  username: user.username,
  role: user.role,
  allowedModules: user.allowedModules,
})
```

2b. In the **login** handler (POST `/login`), update `signToken` (line 91) and the response (line 93-102):

```typescript
const token = signToken({
  userId: user.id,
  username: user.username,
  role: user.role,
  allowedModules: user.allowedModules,
})
res.cookie('token', token, COOKIE_OPTIONS)
return res.json({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  email: user.email,
  role: user.role,
  allowedModules: user.allowedModules,
  active: user.active,
  avatarColor: user.avatarColor,
  createdAt: user.createdAt,
})
```

2c. In the **GET /me** handler, add `allowedModules: true` to the `select` object (line 115-125).

2d. In the **GET /users** handler, add `allowedModules: true` to the `select` object (line 153-161).

2e. In the **PATCH /users/:id** handler, add `allowedModules: true` to the `select` object (line 204-213). Also update the "prevent removing last admin" check (line 190) to also handle `CONSULTANT`:

```typescript
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
```

**Step 3: Verify server compiles**

```bash
npx tsc --noEmit -p server/tsconfig.json
```

Expected: No errors.

**Step 4: Commit**

```bash
git add server/src/schemas/auth.ts server/src/routes/auth.ts
git commit -m "feat: add CONSULTANT role and allowedModules to auth routes/schemas"
```

---

## Task 5: Backend — Apply Module Middleware to Route Files

**Files:**
- Modify: `server/src/routes/records.ts`
- Modify: `server/src/routes/ds.ts`
- Modify: `server/src/routes/penhoras.ts`
- Modify: `server/src/index.ts`

**Step 1: Add module middleware to records routes**

In `server/src/routes/records.ts`, import the middleware at the top:

```typescript
import { requireModuleAccess, requireWriteAccess } from '../middleware/auth'
```

Then apply `requireModuleAccess('recibos')` to ALL routes and `requireWriteAccess` to all POST/PATCH/DELETE routes. Since all routes in this file are already behind `requireAuth` (applied in `index.ts`), add the middleware directly to each route handler:

For every GET route (e.g., `r.get('/records', ...)`, `r.get('/bootstrap', ...)`):
```typescript
r.get('/records', requireModuleAccess('recibos'), async (req, res) => { ... })
```

For every POST/PATCH/DELETE route:
```typescript
r.post('/records', requireModuleAccess('recibos'), requireWriteAccess, async (req, res) => { ... })
```

Apply the same pattern to ALL routes in the file.

**Step 2: Add module middleware to DS routes**

In `server/src/routes/ds.ts`, import and apply the same pattern:

```typescript
import { requireModuleAccess, requireWriteAccess } from '../middleware/auth'
```

Apply `requireModuleAccess('ds')` to all routes and `requireWriteAccess` to POST/PATCH/DELETE.

**Step 3: Add module middleware to Penhoras routes**

In `server/src/routes/penhoras.ts`, same pattern:

```typescript
import { requireModuleAccess, requireWriteAccess } from '../middleware/auth'
```

Apply `requireModuleAccess('penhoras')` to all routes and `requireWriteAccess` to POST/PATCH/DELETE.

**Step 4: Verify server compiles**

```bash
npx tsc --noEmit -p server/tsconfig.json
```

Expected: No errors.

**Step 5: Test server starts**

```bash
cd /Users/miguelbrito/Development/codex/testapp
npm run dev:server
```

Expected: Server starts without errors. Ctrl+C to stop.

**Step 6: Commit**

```bash
git add server/src/routes/records.ts server/src/routes/ds.ts server/src/routes/penhoras.ts
git commit -m "feat: apply module access and write permission middleware to all module routes"
```

---

## Task 6: Frontend — Types + useAuth Helpers

**Files:**
- Modify: `src/types.ts:331-342`
- Modify: `src/hooks/useAuth.ts`

**Step 1: Update frontend types**

In `src/types.ts`, update the `UserRole` type and `User` type:

```typescript
// Auth types
export type UserRole = 'ADMIN' | 'USER' | 'CONSULTANT'

export type User = {
  id: number
  username: string
  displayName: string
  email: string | null
  role: UserRole
  allowedModules: string[]
  avatarColor: string | null
  active: boolean
  createdAt: string
}
```

**Step 2: Add permission helpers to useAuth**

In `src/hooks/useAuth.ts`, add helper functions to the hook return:

```typescript
import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api'
import type { User, LoginCredentials, RegisterData, ModuleId } from '../types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  // On mount, try GET /api/auth/me to check existing session
  useEffect(() => {
    let cancelled = false
    api.getMe()
      .then((me) => { if (!cancelled) setUser(me) })
      .catch(() => { if (!cancelled) setUser(null) })
      .finally(() => { if (!cancelled) setAuthLoading(false) })
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setAuthError('')
    try {
      const loggedIn = await api.login(credentials)
      setUser(loggedIn)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha no login.'
      setAuthError(message)
      throw err
    }
  }, [])

  const register = useCallback(async (data: RegisterData) => {
    setAuthError('')
    try {
      const created = await api.register(data)
      setUser(created)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha no registo.'
      setAuthError(message)
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
  }, [])

  const canAccessModule = useCallback((moduleId: ModuleId): boolean => {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    return user.allowedModules.includes(moduleId)
  }, [user])

  const canWrite = useCallback((moduleId: ModuleId): boolean => {
    if (!user) return false
    if (user.role === 'CONSULTANT') return false
    return canAccessModule(moduleId)
  }, [user, canAccessModule])

  return { user, authLoading, authError, setAuthError, login, register, logout, canAccessModule, canWrite }
}
```

**Step 3: Update api.ts updateUser types**

In `src/api.ts`, update the `updateUser` method signature (line 519) to include `allowedModules`:

```typescript
updateUser(id: number, data: Partial<{ displayName: string; email: string | null; role: UserRole; active: boolean; avatarColor: string; allowedModules: string[] }>) {
```

**Step 4: Verify frontend compiles**

```bash
npx tsc --noEmit
```

Expected: Errors in `App.tsx` and `UserManagement.tsx` where the new `canAccessModule`/`canWrite` are not yet used and where `useAuth` destructuring may need updating. That's fine — fixed in next tasks.

**Step 5: Commit**

```bash
git add src/types.ts src/hooks/useAuth.ts src/api.ts
git commit -m "feat: add CONSULTANT type, allowedModules to User, permission helpers to useAuth"
```

---

## Task 7: Frontend — App.tsx Module Card Locking + Tab Restrictions

**Files:**
- Modify: `src/App.tsx`

**Step 1: Destructure new helpers from useAuth**

In `src/App.tsx`, find the existing `useAuth()` call and update destructuring to include the new helpers. Find this line (approx line 90):

```typescript
const { user, authLoading, authError, setAuthError, login, register, logout } = useAuth()
```

Change to:

```typescript
const { user, authLoading, authError, setAuthError, login, register, logout, canAccessModule, canWrite } = useAuth()
```

**Step 2: Default to first allowed module on login**

After the `useAuth` destructuring, find `const [activeModule, setActiveModule] = useState<ModuleId>('recibos')` (line 118). We need to initialize to first allowed module. After the `if (!user)` return block (line 1236-1238), add an effect:

```typescript
// Default active module to first allowed module
useEffect(() => {
  if (!user) return
  const modules: ModuleId[] = ['recibos', 'ds', 'penhoras']
  const firstAllowed = modules.find((m) => canAccessModule(m))
  if (firstAllowed && !canAccessModule(activeModule)) {
    setActiveModule(firstAllowed)
    setActiveTab(firstAllowed === 'recibos' ? 'entrada' : 'consulta')
  }
}, [user, canAccessModule])
```

**Step 3: Update switchModule to check access**

Update `switchModule` (line 1124-1130) to check module access:

```typescript
function switchModule(nextModule: ModuleId) {
  if (!canAccessModule(nextModule)) {
    setFeedback('Sem acesso a este modulo.')
    return
  }
  setActiveModule(nextModule)
  // Consultants can only see consulta tab
  if (user?.role === 'CONSULTANT') {
    setActiveTab('consulta')
  } else {
    setActiveTab(nextModule === 'recibos' ? 'entrada' : 'consulta')
  }
  if (nextModule !== 'recibos') setSelectedRecordId(null)
  if (nextModule !== 'ds') setSelectedDsRecordId(null)
  if (nextModule !== 'penhoras') setSelectedPenhorasRecordId(null)
}
```

**Step 4: Filter module cards — show lock overlay on inaccessible modules**

Find the module card rendering section (approx line 1255-1280). The current code renders two cards (back/front) in a flip pattern. Update the click handler for both cards to check access:

For the **back card** (line 1258):
```typescript
onClick={() => switchModule(nextModuleCard.id)}
```
No change needed — `switchModule` already checks access.

For the **front card** (line 1268):
Same — already calls `switchModule`.

To add visual lock overlay, update the front card's `className` to add a `locked` class when inaccessible:

```typescript
className={`module-brand-card front module-${activeModuleCard.id}${!canAccessModule(nextModuleCard.id) ? ' module-locked' : ''}`}
```

Also update the back card similarly.

**Step 5: Filter tabs for CONSULTANT — only show consulta**

Find `const tabButtons = TABS.map(...)` (line 1200). Replace with filtered version:

```typescript
const visibleTabs = user?.role === 'CONSULTANT'
  ? TABS.filter((tab) => tab.id === 'consulta')
  : TABS

const tabButtons = visibleTabs.map((tab) => (
  <button
    key={tab.id}
    className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
    onClick={() => setActiveTab(tab.id)}
    type="button"
  >
    {tab.label}
  </button>
))
```

**Step 6: Hide "new record" button for consultants**

Find the "+" button (line 1184-1196) that calls `setActiveTab('entrada')`. Wrap it in a write-access check:

```typescript
{canWrite(activeModule) && (
  <button
    className="primary-btn icon-btn"
    type="button"
    onClick={() => setActiveTab('entrada')}
    title={...}
    aria-label={...}
  >
    <Plus size={16} />
  </button>
)}
```

**Step 7: Verify frontend compiles**

```bash
npx tsc --noEmit
```

Expected: No errors (or minor ones to fix in this step).

**Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add module card locking, tab restrictions, and consultant view to App.tsx"
```

---

## Task 8: Frontend — Admin Panel (Module Checkboxes + Consultant Role)

**Files:**
- Modify: `src/components/admin/UserManagement.tsx`

**Step 1: Add allowedModules to state types**

Update the `EditingUser` type (line 11-16):

```typescript
type EditingUser = {
  id: number
  displayName: string
  email: string
  role: UserRole
  allowedModules: string[]
}
```

Update the `CreateForm` type (line 18-24):

```typescript
type CreateForm = {
  username: string
  displayName: string
  email: string
  password: string
  role: UserRole
  allowedModules: string[]
}
```

Update `emptyCreateForm` (line 26-32):

```typescript
const emptyCreateForm: CreateForm = {
  username: '',
  displayName: '',
  email: '',
  password: '',
  role: 'USER',
  allowedModules: [],
}
```

**Step 2: Add module checkbox constants**

At the top of the file, after imports, add:

```typescript
const MODULE_OPTIONS: { id: string; label: string }[] = [
  { id: 'recibos', label: 'Mesa de Recibos' },
  { id: 'ds', label: 'DS Gestora' },
  { id: 'penhoras', label: 'Penhoras' },
]
```

**Step 3: Update startEdit to include allowedModules**

Update `startEdit` (line 109-116):

```typescript
function startEdit(user: User) {
  setEditingUser({
    id: user.id,
    displayName: user.displayName,
    email: user.email || '',
    role: user.role,
    allowedModules: user.allowedModules ?? [],
  })
}
```

**Step 4: Update handleSaveEdit to include allowedModules**

Update `handleSaveEdit` (line 118-136):

```typescript
async function handleSaveEdit() {
  if (!editingUser) return
  setEditSaving(true)
  setError('')
  try {
    await api.updateUser(editingUser.id, {
      displayName: editingUser.displayName.trim(),
      email: editingUser.email.trim() || null,
      role: editingUser.role,
      allowedModules: editingUser.role === 'ADMIN' ? [] : editingUser.allowedModules,
    })
    setEditingUser(null)
    showFeedback('Utilizador atualizado com sucesso.')
    await loadUsers()
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : 'Erro ao atualizar utilizador')
  } finally {
    setEditSaving(false)
  }
}
```

**Step 5: Update handleCreate to include allowedModules**

In `handleCreate` (line 79-105), after registering the user, update to also set `allowedModules`:

```typescript
async function handleCreate(e: React.FormEvent) {
  e.preventDefault()
  setCreateSaving(true)
  setError('')
  try {
    const payload: RegisterData & { role?: UserRole } = {
      username: createForm.username.trim(),
      displayName: createForm.displayName.trim(),
      password: createForm.password,
    }
    if (createForm.email.trim()) {
      payload.email = createForm.email.trim()
    }
    // Register user first, then update role and allowedModules if needed
    const created = await api.register(payload)
    const updates: Record<string, unknown> = {}
    if (createForm.role !== 'USER') {
      updates.role = createForm.role
    }
    if (createForm.role !== 'ADMIN' && createForm.allowedModules.length > 0) {
      updates.allowedModules = createForm.allowedModules
    }
    if (Object.keys(updates).length > 0) {
      await api.updateUser(created.id, updates as Parameters<typeof api.updateUser>[1])
    }
    setCreateOpen(false)
    showFeedback(`Utilizador "${created.displayName}" criado com sucesso.`)
    await loadUsers()
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : 'Erro ao criar utilizador')
  } finally {
    setCreateSaving(false)
  }
}
```

**Step 6: Add CONSULTANT to role dropdown in the user table (edit mode)**

Find the role select in the table (line 260-267). Add the third option:

```typescript
<select
  className="admin-inline-select"
  value={editingUser.role}
  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
>
  <option value="USER">Utilizador</option>
  <option value="ADMIN">Administrador</option>
  <option value="CONSULTANT">Consultor</option>
</select>
```

**Step 7: Update role badge display to handle CONSULTANT**

Find the role badge (line 269-276). Update to show three states:

```typescript
<span className={`admin-role-badge ${u.role === 'ADMIN' ? 'admin' : u.role === 'CONSULTANT' ? 'consultant' : 'user'}`}>
  {u.role === 'ADMIN' ? (
    <><ShieldAlert size={12} /> Admin</>
  ) : u.role === 'CONSULTANT' ? (
    'Consultor'
  ) : (
    'Utilizador'
  )}
</span>
```

**Step 8: Add module checkboxes below the role select in the edit row**

After the role `<td>` column, we need to add a way to show/edit module checkboxes inline. The simplest approach: show a new "Modulos" column in the table. Add a new `<th>Módulos</th>` in the table header (after the "Papel" column) and corresponding `<td>`:

In `<thead>`:
```html
<th>Módulos</th>
```

In `<tbody>` for each row, after the role `<td>`:
```tsx
<td>
  {u.role === 'ADMIN' ? (
    <span className="admin-cell-muted">Todos</span>
  ) : isEditing ? (
    <div className="admin-module-checks">
      {MODULE_OPTIONS.map((mod) => (
        <label key={mod.id} className="admin-module-check">
          <input
            type="checkbox"
            checked={editingUser.allowedModules.includes(mod.id)}
            onChange={(e) => {
              const next = e.target.checked
                ? [...editingUser.allowedModules, mod.id]
                : editingUser.allowedModules.filter((m) => m !== mod.id)
              setEditingUser({ ...editingUser, allowedModules: next })
            }}
          />
          <span>{mod.label}</span>
        </label>
      ))}
    </div>
  ) : (
    <span className="admin-cell-modules">
      {(u.allowedModules ?? []).length > 0
        ? (u.allowedModules ?? []).map((m) => MODULE_OPTIONS.find((o) => o.id === m)?.label ?? m).join(', ')
        : '—'}
    </span>
  )}
</td>
```

**Step 9: Add module checkboxes to the Create User dialog**

In the create user form (line 339-416), after the role `<select>` label, add module checkboxes that show only when role is not ADMIN:

```tsx
{createForm.role !== 'ADMIN' && (
  <fieldset className="admin-field admin-field-modules">
    <legend>Módulos com acesso</legend>
    {MODULE_OPTIONS.map((mod) => (
      <label key={mod.id} className="admin-module-check">
        <input
          type="checkbox"
          checked={createForm.allowedModules.includes(mod.id)}
          onChange={(e) => {
            const next = e.target.checked
              ? [...createForm.allowedModules, mod.id]
              : createForm.allowedModules.filter((m) => m !== mod.id)
            setCreateForm({ ...createForm, allowedModules: next })
          }}
        />
        <span>{mod.label}</span>
      </label>
    ))}
  </fieldset>
)}
```

**Step 10: Verify frontend compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 11: Commit**

```bash
git add src/components/admin/UserManagement.tsx
git commit -m "feat: add CONSULTANT role option and module checkboxes to admin panel"
```

---

## Task 9: CSS — Module Lock Styling + Admin Module Checkboxes

**Files:**
- Modify: `src/App.css` (or the relevant CSS file for module cards)
- Modify: `src/components/admin/UserManagement.css` (or embedded styles)

**Step 1: Add locked module card styles**

Find the existing module card CSS (look for `.module-brand-card`). Add a `.module-locked` variant:

```css
.module-brand-card.module-locked {
  opacity: 0.4;
  filter: grayscale(0.6);
  cursor: not-allowed;
}
```

**Step 2: Add admin module checkbox styles**

Add styles for the module checkboxes in the admin panel:

```css
.admin-module-checks {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-module-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  cursor: pointer;
}

.admin-module-check input[type="checkbox"] {
  margin: 0;
}

.admin-cell-muted {
  color: var(--text-muted);
  font-style: italic;
  font-size: 0.8rem;
}

.admin-cell-modules {
  font-size: 0.8rem;
}

.admin-field-modules {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
}

.admin-field-modules legend {
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0 4px;
}

.admin-role-badge.consultant {
  background: var(--info-bg, #e0f0ff);
  color: var(--info-text, #1a5276);
}
```

**Step 3: Verify the app renders correctly**

```bash
npm run dev
```

Open the app in browser, check:
- Module cards render without errors
- Admin panel opens without errors
- Create user dialog shows module checkboxes when role is USER or CONSULTANT
- Module checkboxes hide when role is ADMIN

**Step 4: Commit**

```bash
git add src/App.css src/components/admin/
git commit -m "feat: add CSS for locked module cards and admin module checkboxes"
```

---

## Task 10: Integration Test — End-to-End Verification

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Manual test checklist**

Test as ADMIN:
- [ ] All 3 module cards accessible
- [ ] All tabs visible (entrada, consulta, tabela, dashboards, configuracao)
- [ ] Can create records in all modules
- [ ] Admin panel: can create user with CONSULTANT role + specific modules
- [ ] Admin panel: can edit user to change role and modules

Test as USER with limited modules (create a test user with only "recibos"):
- [ ] Only recibos module accessible
- [ ] DS and Penhoras cards show locked/greyed styling
- [ ] Clicking locked card shows "Sem acesso a este modulo" feedback
- [ ] All tabs visible within allowed module
- [ ] Can CRUD records in allowed module
- [ ] API returns 403 if trying to access DS/Penhoras endpoints

Test as CONSULTANT with "recibos" module:
- [ ] Only consulta tab visible
- [ ] No "+" (create) button
- [ ] Table works (search, filter, sort, pagination)
- [ ] Cannot create/edit/delete records (API returns 403)
- [ ] Export works normally

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete module-level permissions implementation (ROADMAP 1.5)"
```

---

## Summary

| Task | What | Files | Commit message |
|------|------|-------|----------------|
| 1 | Prisma migration | `prisma/schema.prisma` | `feat: add CONSULTANT role and allowedModules to User schema` |
| 2 | JWT payload | `server/src/services/auth.ts` | `feat: add allowedModules to JWT payload type` |
| 3 | Permission middleware | `server/src/middleware/auth.ts` | `feat: add requireModuleAccess and requireWriteAccess middleware` |
| 4 | Auth routes + schemas | `server/src/schemas/auth.ts`, `server/src/routes/auth.ts` | `feat: add CONSULTANT role and allowedModules to auth routes/schemas` |
| 5 | Route middleware | `server/src/routes/{records,ds,penhoras}.ts` | `feat: apply module access and write permission middleware to all module routes` |
| 6 | Frontend types + hook | `src/types.ts`, `src/hooks/useAuth.ts`, `src/api.ts` | `feat: add CONSULTANT type, allowedModules to User, permission helpers to useAuth` |
| 7 | App.tsx UI | `src/App.tsx` | `feat: add module card locking, tab restrictions, and consultant view to App.tsx` |
| 8 | Admin panel | `src/components/admin/UserManagement.tsx` | `feat: add CONSULTANT role option and module checkboxes to admin panel` |
| 9 | CSS | CSS files | `feat: add CSS for locked module cards and admin module checkboxes` |
| 10 | Integration test | — | `feat: complete module-level permissions implementation (ROADMAP 1.5)` |
