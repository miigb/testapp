# Module-Level Permissions — Design

Date: 2026-02-25
ROADMAP step: 1.5

---

## Goal

Allow admins to control which modules each user can access, and introduce a read-only Consultant role.

## Roles

| Role | Module access | Write access |
|------|--------------|--------------|
| ADMIN | All 3 modules (always) | Full CRUD + settings + user management |
| USER | Only assigned modules | Full CRUD within assigned modules |
| CONSULTANT | Only assigned modules | Read-only + export only |

All roles can see audit info (who created/edited/deleted records).

## Data model

Add to Prisma schema:

```prisma
enum UserRole {
  ADMIN
  USER
  CONSULTANT   // new
}

model User {
  ...existing fields...
  allowedModules String[] @default([])  // ["recibos", "ds", "penhoras"]
}
```

- ADMIN ignores `allowedModules` — always has all modules.
- USER/CONSULTANT access only listed modules.
- Empty array = no module access (sees locked cards only).

JWT payload adds `allowedModules`:
```
{ userId, username, role, allowedModules: ["recibos", "ds"] }
```

## Backend middleware

Two new middleware functions in `server/src/middleware/auth.ts`:

**`requireModuleAccess(moduleId: ModuleId)`** — checks user has access to the module:
- ADMIN bypasses (always allowed)
- USER/CONSULTANT must have `moduleId` in `allowedModules`
- Returns 403 "Sem acesso a este modulo." if denied

**`requireWriteAccess`** — blocks write operations for consultants:
- CONSULTANT gets 403 "Acesso apenas de leitura."
- ADMIN and USER pass through

Route application:
- All GET endpoints on module routes: `requireModuleAccess(moduleId)`
- All POST/PATCH/DELETE endpoints on module routes: `requireModuleAccess(moduleId)` + `requireWriteAccess`
- Module mapping: `/api/*` (records) = `recibos`, `/api/ds/*` = `ds`, `/api/penhoras/*` = `penhoras`

## Frontend

### Module cards (topbar)
- All 3 module cards always visible.
- If user has no access: card shows lock icon overlay, greyed out styling.
- Clicking a locked card shows toast: "Sem acesso a este modulo."
- Active module defaults to first allowed module.

### Consultant view (read-only access)
- Only `consulta` tab visible (no `entrada`, `importar`, `configuracao`).
- Table fully functional: search, filter, sort, pagination.
- No Create/Edit/Delete buttons rendered.
- Export button works normally.

### Permission helpers (useAuth hook)
- `canAccessModule(moduleId: ModuleId): boolean` — true if ADMIN or module in allowedModules
- `canWrite(moduleId: ModuleId): boolean` — true if canAccessModule AND role !== CONSULTANT
- `/api/auth/me` response includes `allowedModules` field

## Admin panel UI

In UserManagement component:

**Role dropdown** gets third option: `Admin | Utilizador | Consultor`

**Module checkboxes** (shown for USER and CONSULTANT only, hidden for ADMIN):
- ☐ Mesa de Recibos
- ☐ DS Gestora
- ☐ Penhoras

Inline editing: same pattern as existing role/displayName editing. Visible in both create and edit flows.

## Files to modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add CONSULTANT to UserRole, add allowedModules to User |
| `server/src/middleware/auth.ts` | Add requireModuleAccess, requireWriteAccess |
| `server/src/services/auth.ts` | Add allowedModules to JWT payload/type |
| `server/src/schemas/auth.ts` | Add CONSULTANT to role enum, add allowedModules to updateUserSchema |
| `server/src/routes/auth.ts` | Return allowedModules in user responses, accept in update |
| `server/src/routes/records.ts` | Apply requireModuleAccess('recibos') + requireWriteAccess |
| `server/src/routes/ds.ts` | Apply requireModuleAccess('ds') + requireWriteAccess |
| `server/src/routes/penhoras.ts` | Apply requireModuleAccess('penhoras') + requireWriteAccess |
| `server/src/index.ts` | Pass module middleware to route factories |
| `src/types.ts` | Add CONSULTANT to UserRole, add allowedModules to User type, add ModuleAccess helpers |
| `src/hooks/useAuth.ts` | Add canAccessModule, canWrite helpers |
| `src/App.tsx` | Filter module cards, restrict tabs for consultants, check write access |
| `src/components/admin/UserManagement.tsx` | Add module checkboxes + consultant role to create/edit |
| `src/api.ts` | Update register/update types for allowedModules |
