# Mesa de Recibos Deployment Plan

Last updated: 2026-02-19 (revised)

## 1. Goals and priorities
- Priority 1: Easy setup and low operational complexity.
- Priority 2: Cost efficiency.
- Priority 3: Maintainability and future API-first evolution.

## 2. Platform decision
- Recommended platform: Railway.
- Why:
  - Fastest path for this stack (Node API + Postgres + frontend).
  - Simple service/database wiring and environment variable management.
  - Good balance for solo/small-team operation.
- Re-evaluate later if needed:
  - Move to Render/Fly/Vercel+API host only if governance/compliance/team workflows outgrow Railway.

## 3. Target production architecture (Phase 1)
- Railway Postgres service (managed).
- Railway app service running the Node API.
- Frontend served in production by the same app service (same origin for `/api`), to avoid cross-origin complexity in first release.

## 4. Key current gaps to close before deploy
- Frontend API calls currently assume Vite dev proxy (`/api` -> `localhost:4000`).
- No explicit production runtime contract documented for:
  - build/start commands,
  - migration execution,
  - startup health checks.
- No staged release checklist/runbook yet.

### Gaps closed (2026-02-19)
- `/api/health` endpoint now includes a live DB ping (`SELECT 1`) and returns `{ ok, db, now }`.
- Server now binds to `process.env.PORT` first (Railway injects this), falling back to `API_PORT`.
- `NODE_ENV=production` triggers startup validation: server exits early with a clear message if `DATABASE_URL` is missing.
- CORS: production builds restrict allowed origins via `ALLOWED_ORIGINS` env var (comma-separated list).
- Same-origin production model implemented: `npm run build:prod` builds the frontend into `dist/`, and the Express server serves it statically with SPA fallback. No CORS cross-origin complexity.
- New scripts added to `package.json`:
  - `build:prod` — deterministic production build (TypeScript + Vite)
  - `start:prod` — starts the compiled server
  - `prisma:deploy` — runs `prisma migrate deploy` (safe, idempotent, for release phase)
- `.env.example` updated with `PORT`, `NODE_ENV`, `ALLOWED_ORIGINS`, and `connection_limit` guidance for Railway Postgres.

## 5. Execution plan

### Phase A - Deployment readiness baseline
- [x] Define environment contract:
  - `NODE_ENV=production`
  - `PORT` (Railway injects; falls back to `API_PORT`)
  - `DATABASE_URL` (with `connection_limit=5&pool_timeout=10` for Railway)
  - `ALLOWED_ORIGINS` (comma-separated list for CORS restriction)
  - `VITE_LOGO_DEV_TOKEN` (optional public token)
- [x] Add startup env validation (fail fast with clear message when required vars are missing).
- [x] Implement production routing model: API serves built frontend from `dist/` under same origin.
- [x] Define production scripts:
  - `npm run build:prod` — TypeScript compile + Vite build
  - `npm run start:prod` — start compiled server
  - `npm run prisma:deploy` — `prisma migrate deploy` (safe, idempotent)
- [ ] Validate: boot app locally with `NODE_ENV=production` against a real Postgres instance.

Deliverable:
- App can boot in a production-like local run with no manual patching.

### Phase B - Railway infrastructure
- Create Railway project.
- Provision Postgres service.
- Configure DB credentials and `DATABASE_URL` (include `connection_limit=5&pool_timeout=10`).
- Create app service from this repository.
- Configure build/start commands:
  - Build: `npm run prisma:generate && npm run build:prod`
  - Start: `npm run start:prod`
  - Release (before start): `npm run prisma:deploy`
- Set required env vars: `NODE_ENV`, `DATABASE_URL`, `PORT` (auto-injected by Railway), `ALLOWED_ORIGINS`.
- [x] Health endpoint `/api/health` pings DB and returns `{ ok, db, now }` — ready to use as Railway readiness check.

Deliverable:
- App service deploys successfully and connects to Railway Postgres.

### Phase C - Database and migrations safety
- Baseline Prisma flow for releases:
  - `prisma generate` — regenerate client (part of build step)
  - `prisma migrate deploy` — apply pending migrations safely (idempotent, part of release phase)
  - Never use `prisma db push` in production (destructive, skips migration history)
- Define rollback strategy:
  - App rollback: redeploy previous Railway release (instant).
  - DB rollback: only possible if migration was backward-compatible; otherwise requires a forward-fix migration.
  - Before any breaking migration: create a new forward-compatible migration and deploy app first.
- Define backup policy:
  - Enable Railway automated backups (daily minimum).
  - Test restore at least monthly in staging.

Deliverable:
- Documented and tested DB migration + rollback procedure.

### Phase D - Staging and smoke tests
- Create staging environment on Railway.
- Seed representative data (non-sensitive).
- Run smoke checklist:
  - bootstrap/load
  - create/edit record
  - filters + saved views
  - import preview/commit
  - bulk actions + undo
  - dashboard widgets and resizing
- Define pass/fail criteria and sign-off.

Deliverable:
- Staging sign-off checklist fully green.

### Phase E - Production launch
- Promote staging-tested release to production.
- Run post-deploy verification checklist.
- Enable basic monitoring and alerting:
  - error logs
  - uptime check
  - DB availability
- Document incident and rollback runbook.

Deliverable:
- Stable production deployment with basic observability.

## 6. CI/CD plan
- Trigger on pull requests:
  - `npm run lint`
  - `npm run build:prod`
  - Note: no automated tests yet — add a `test` step here once tests exist.
- Trigger on main branch:
  - deploy to staging (Railway: automatic)
  - run smoke checklist (manual or scripted)
  - optional manual approval gate before production deploy
  - deploy to production
- Release phase (before app start): `npm run prisma:deploy`
- Migration step is part of Railway's release phase, not the build phase.

## 7. Security and secrets checklist
- Keep `.env` out of git (already enforced in `.gitignore`).
- Store all secrets in Railway variables, not in repository.
- Rotate any previously exposed credentials immediately.
- Use least-privilege DB credentials.
- Set `ALLOWED_ORIGINS` to the production domain before going live — do not defer this.
- CORS is restricted in production via `ALLOWED_ORIGINS` env var (server enforces it on startup).
- No authentication layer yet — consider access restriction at the Railway network/domain level until auth is implemented.

## 8. Cost controls
- Start with smallest app + DB plan that supports expected traffic.
- Set budget alerts and monthly review.
- Use autosuspend/scale-to-zero only if cold-start impact is acceptable.

## 9. Definition of done
- One-click/one-command reproducible deploy path to staging and production.
- Health checks and migrations are part of release flow.
- Smoke tests pass after each deploy.
- Rollback runbook is tested and documented.

## 10. Proposed implementation order (next actions)
1. Implement production routing model (same-origin API + frontend).
2. Add production scripts and env validation.
3. Create Railway project + Postgres and deploy staging.
4. Run smoke tests and fix gaps.
5. Enable CI/CD pipeline.
6. Launch production.
