# Mesa de Recibos — Roadmap

Last updated: 2026-02-25 (mobile responsive shipped)

---

## Where we are

| Area | Status | Detail |
|------|--------|--------|
| App.tsx | **1,733 lines** (was 8,129) | 20 hooks, 13 lib files, 27 components extracted |
| Server | **89 lines** (was 3,249) | Fully refactored into routes/services/middleware/schemas |
| Deployment | **✅ Live** | Railway production deployed — `testapp-production-0c7f.up.railway.app` |
| Auth | **Complete** | JWT auth with httpOnly cookies, ADMIN/USER/CONSULTANT roles, module-level permissions |
| Tests | **258 unit tests passing** | 8 test files covering all `src/lib/` pure functions |
| Features | **Complete** | Todos, notifications (SSE + push), trash, sidebar, admin panel |
| Mobile | **✅ Responsive** | CSS-only mobile layer (≤768px), bottom module bar, scrollable tabs, 44px touch targets |

---

## Remaining work — ordered by priority

### Track 1: Ship it (deployment)

| Step | Task | Effort | Depends on |
|------|------|--------|------------|
| 1.1 | ~~Validate local production boot~~ | — | ✅ Done |
| 1.2 | ~~Create Railway project + Postgres, deploy~~ | — | ✅ Done (2026-02-25) |
| 1.3 | ~~Run smoke tests on production~~ | — | ✅ Done (2026-02-25) |
| 1.4 | ~~Add auth system~~ | — | ✅ Done (JWT + bcrypt, not Supabase) |
| 1.5 | ~~Add module-level permissions (allowed_modules + read-only role)~~ | — | ✅ Done (2026-02-25) |
| 1.6 | CI/CD pipeline (lint + build + test on PR, auto-deploy on main) | 2h | 1.2 |
| 1.7 | ~~Production launch~~ | — | ✅ Done (2026-02-25) |

### Track 2: Code quality

| Step | Task | Effort | Depends on |
|------|------|--------|------------|
| 2.1 | ~~Server refactor~~ | — | ✅ Done (89-line index.ts) |
| 2.2 | ~~Vitest unit tests for `src/lib/`~~ | — | ✅ Done (258 tests passing) |
| 2.3 | Add component tests (React Testing Library) for key flows | 1 day | — |
| 2.4 | Context/state slicing (replace prop drilling if painful) | 1 day | Optional |
| 2.5 | CSS split — per-component stylesheets | 0.5 day | — |

### Track 3: Mobile & UX

| Step | Task | Effort | Depends on |
|------|------|--------|------------|
| 3.1 | ~~Mobile responsive CSS layer (≤768px breakpoint)~~ | — | ✅ Done (2026-02-25) |
| 3.2 | ~~Bottom module bar for mobile navigation~~ | — | ✅ Done (2026-02-25) |
| 3.3 | ~~Scrollable tab strip with scroll-snap~~ | — | ✅ Done (2026-02-25) |
| 3.4 | ~~Touch targets (44px) + iOS zoom prevention~~ | — | ✅ Done (2026-02-25) |
| 3.5 | Sidebar backdrop overlay on mobile | 0.5h | 3.1 |
| 3.6 | Sticky first table column on mobile | 1h | 3.1 |

### Track 4: Features (after production is stable)

| Step | Task | Effort | Depends on |
|------|------|--------|------------|
| 4.1 | Advanced Export System (ExportComposer, CSV/XLS/PDF generators) | 2-3 days | 1.7 |
| 4.2 | AI summary integration (`@google/genai`) | 1 day | 4.1 |

---

## Permission model (implemented)

| Role | Modules | Actions |
|------|---------|---------|
| **Admin** | All (Recibos, DS, Penhoras) | Full CRUD + settings + user management |
| **Module user** | Assigned subset | CRUD within their modules |
| **Consultant** | Assigned subset | Read-only + export |

Implementation: Express middleware for permission checks, `allowed_modules` column on User table, CONSULTANT role with read-only enforcement.

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
