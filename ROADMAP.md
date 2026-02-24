# Mesa de Recibos — Roadmap

Last updated: 2026-02-24

---

## Where we are

| Area | Status | Detail |
|------|--------|--------|
| App.tsx | **1,733 lines** (was 8,129) | 20 hooks, 13 lib files, 27 components extracted |
| Server | **3,249 lines** (monolith) | Not yet refactored |
| Deployment | **Partially ready** | Production scripts + health check done, Railway not yet provisioned |
| Auth | **None** | No users, no permissions |
| Tests | **None** | No automated tests |

---

## Remaining work — ordered by priority

### Track 1: Ship it (deployment)

| Step | Task | Effort | Depends on |
|------|------|--------|------------|
| 1.1 | ~~Validate local production boot (`NODE_ENV=production` + real Postgres)~~ | ~~1h~~ | ✅ Done |
| 1.2 | Create Railway project + Postgres, deploy staging | 2h | 1.1 |
| 1.3 | Run smoke tests on staging (see DEPLOYMENT_PLAN Phase D checklist) | 2h | 1.2 |
| 1.4 | Add Supabase Auth (login UI + Express JWT middleware + users table) | 1 day | 1.2 |
| 1.5 | Add role-based permissions (module-level access + read-only role) | 0.5 day | 1.4 |
| 1.6 | CI/CD pipeline (lint + build on PR, auto-deploy staging on main) | 2h | 1.2 |
| 1.7 | Production launch | 1h | 1.3, 1.5, 1.6 |

### Track 2: Code quality (can run in parallel after 1.2)

| Step | Task | Effort | Depends on |
|------|------|--------|------------|
| 2.1 | Server refactor — split `index.ts` into routes/services/middleware | 1-2 days | — |
| 2.2 | Add Vitest unit tests for `src/lib/` pure functions | 0.5 day | — |
| 2.3 | Add component tests (React Testing Library) for key flows | 1 day | — |
| 2.4 | Context/state slicing (replace prop drilling if painful) | 1 day | — |
| 2.5 | CSS split — per-component stylesheets | 0.5 day | — |

### Track 3: Features (after production is stable)

| Step | Task | Effort | Depends on |
|------|------|--------|------------|
| 3.1 | Advanced Export System (ExportComposer, CSV/XLS/PDF generators) | 2-3 days | 1.7 |
| 3.2 | AI summary integration (`@google/genai`) | 1 day | 3.1 |

---

## Permission model (for step 1.4-1.5)

| Role | Modules | Actions |
|------|---------|---------|
| **Admin** | All (Recibos, DS, Penhoras) | Full CRUD + settings + user management |
| **Module user** | Assigned subset | CRUD within their modules |
| **Consultant** | Assigned subset | Read-only + export |

Implementation: Supabase Auth for login/JWT, Express middleware for permission checks, `users` table in Railway Postgres with `role` + `allowed_modules` columns.

---

## Architecture (target)

```
[React SPA on Railway]
     |
     | same-origin /api/*
     v
[Express API on Railway] --validates JWT--> [Supabase Auth]
     |
     v
[Railway Postgres + Prisma]
```

---

## Quick reference

- **DEPLOYMENT_PLAN.md** — detailed deployment phases and checklists
- **IMPROVEMENT_PLAN.md** — codebase refactor phases and component inventory
- **implementation_plan.md.resolved** — Entrada component extraction details (completed)
