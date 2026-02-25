# Mesa de Recibos — Roadmap

Last updated: 2026-02-24

---

## Where we are

| Area | Status | Detail |
|------|--------|--------|
| App.tsx | **1,733 lines** (was 8,129) | 20 hooks, 13 lib files, 27 components extracted |
| Server | **89 lines** (was 3,249) | Fully refactored into routes/services/middleware/schemas |
| Deployment | **Partially ready** | Production scripts + health check done, Railway not yet provisioned |
| Auth | **Complete** | JWT auth with httpOnly cookies, ADMIN/USER roles, login page |
| Tests | **258 unit tests passing** | 8 test files covering all `src/lib/` pure functions |
| Features | **Complete** | Todos, notifications (SSE + push), trash, sidebar, admin panel |

---

## Remaining work — ordered by priority

### Track 1: Ship it (deployment)

| Step | Task | Effort | Depends on |
|------|------|--------|------------|
| 1.1 | ~~Validate local production boot~~ | — | ✅ Done |
| 1.2 | Create Railway project + Postgres, deploy staging | 2h | 1.1 |
| 1.3 | Run smoke tests on staging (see DEPLOYMENT_PLAN Phase D checklist) | 2h | 1.2 |
| 1.4 | ~~Add auth system~~ | — | ✅ Done (JWT + bcrypt, not Supabase) |
| 1.5 | Add module-level permissions (allowed_modules + read-only role) | 0.5 day | 1.4 |
| 1.6 | CI/CD pipeline (lint + build + test on PR, auto-deploy staging on main) | 2h | 1.2 |
| 1.7 | Production launch | 1h | 1.3, 1.5, 1.6 |

### Track 2: Code quality

| Step | Task | Effort | Depends on |
|------|------|--------|------------|
| 2.1 | ~~Server refactor~~ | — | ✅ Done (89-line index.ts) |
| 2.2 | ~~Vitest unit tests for `src/lib/`~~ | — | ✅ Done (258 tests passing) |
| 2.3 | Add component tests (React Testing Library) for key flows | 1 day | — |
| 2.4 | Context/state slicing (replace prop drilling if painful) | 1 day | Optional |
| 2.5 | CSS split — per-component stylesheets | 0.5 day | — |

### Track 3: Features (after production is stable)

| Step | Task | Effort | Depends on |
|------|------|--------|------------|
| 3.1 | Advanced Export System (ExportComposer, CSV/XLS/PDF generators) | 2-3 days | 1.7 |
| 3.2 | AI summary integration (`@google/genai`) | 1 day | 3.1 |

---

## Permission model (for step 1.5)

Current (implemented):

| Role | Actions |
|------|---------|
| **Admin** | Full CRUD + settings + user management |
| **User** | Full CRUD (all modules) |

Target (step 1.5):

| Role | Modules | Actions |
|------|---------|---------|
| **Admin** | All (Recibos, DS, Penhoras) | Full CRUD + settings + user management |
| **Module user** | Assigned subset | CRUD within their modules |
| **Consultant** | Assigned subset | Read-only + export |

Implementation: Express middleware for permission checks, `allowed_modules` column on User table.

---

## Architecture (current)

```
[React SPA on Railway]
     |
     | same-origin /api/*
     v
[Express API on Railway] --validates JWT--> [bcrypt + httpOnly cookies]
     |
     v
[Railway Postgres + Prisma]
```

---

## Quick reference

- **DEPLOYMENT_PLAN.md** — detailed deployment phases and checklists
- **IMPROVEMENT_PLAN.md** — codebase refactor phases and component inventory
- **docs/plans/** — detailed design and implementation plans for features and code quality
