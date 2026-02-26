# Codex TestApp

## Tech Stack

- **Frontend:** React 19, TypeScript 5.9, Vite 7, Vanilla CSS
- **Backend:** Express 5, TypeScript (tsx)
- **Database:** Prisma ORM (PostgreSQL)
- **Testing:** Vitest 4
- **Validation:** Zod 4
- **Auth:** JWT + bcryptjs
- **Icons:** Lucide React
- **Export:** jsPDF, ExcelJS, html-to-image

## Skill Routing Table (SOP)

Before taking action, consult the relevant skill from `~/.agent/skills/skills/relevant/`.
Read the SKILL.md inside the matched directory. Only load what the task requires.

### When building React components or pages

| Trigger | Skill | Path |
|---------|-------|------|
| New component, hook, or composition question | `react-patterns` | relevant/react-patterns/SKILL.md |
| Loading/error/empty states, skeleton vs spinner | `react-ui-patterns` | relevant/react-ui-patterns/SKILL.md |
| Performance (re-renders, bundle, waterfalls) | `react-best-practices` | relevant/react-best-practices/SKILL.md |
| State architecture decision (local vs global) | `react-state-management` | relevant/react-state-management/SKILL.md |
| React 19 features (Actions, useOptimistic) | `frontend-developer` | relevant/frontend-developer/SKILL.md |
| UI design, aesthetics, layout decisions | `frontend-design` | relevant/frontend-design/SKILL.md |
| Color palettes, font pairing, accessibility | `ui-ux-pro-max` | relevant/ui-ux-pro-max/SKILL.md |
| Migrating older React patterns to modern | `react-modernization` | relevant/react-modernization/SKILL.md |

### When working with TypeScript

| Trigger | Skill | Path |
|---------|-------|------|
| Project-wide TS analysis, tsconfig, tooling | `typescript-expert` | relevant/typescript-expert/SKILL.md |
| Advanced generics, conditional types, Zod-to-TS | `typescript-advanced-types` | relevant/typescript-advanced-types/SKILL.md |
| Strict config, utility types, Vitest types | `typescript-pro` | relevant/typescript-pro/SKILL.md |

### When working with the backend (Express + Prisma)

| Trigger | Skill | Path |
|---------|-------|------|
| Express middleware, routing, error handling | `nodejs-backend-patterns` | relevant/nodejs-backend-patterns/SKILL.md |
| Node.js security, async patterns | `nodejs-best-practices` | relevant/nodejs-best-practices/SKILL.md |
| REST endpoint design, response format | `api-patterns` | relevant/api-patterns/SKILL.md |
| API design principles, versioning, pagination | `api-design-principles` | relevant/api-design-principles/SKILL.md |
| JWT auth, token lifecycle, RBAC | `auth-implementation-patterns` | relevant/auth-implementation-patterns/SKILL.md |
| Prisma schema, migrations, queries | `prisma-expert` | relevant/prisma-expert/SKILL.md |
| Database schema design, indexing | `database-design` | relevant/database-design/SKILL.md |
| PostgreSQL-specific types, RLS, partitioning | `postgresql` | relevant/postgresql/SKILL.md |

### When testing

| Trigger | Skill | Path |
|---------|-------|------|
| Writing tests first (TDD) | `test-driven-development` | relevant/test-driven-development/SKILL.md |
| Vitest/Testing Library patterns, mocks | `javascript-testing-patterns` | relevant/javascript-testing-patterns/SKILL.md |
| E2E testing (Playwright/Cypress) | `e2e-testing-patterns` | relevant/e2e-testing-patterns/SKILL.md |

### When debugging or reviewing

| Trigger | Skill | Path |
|---------|-------|------|
| Bug, test failure, unexpected behavior | `systematic-debugging` | relevant/systematic-debugging/SKILL.md |
| Security-focused bug hunting | `find-bugs` | relevant/find-bugs/SKILL.md |
| Code review (giving) | `code-review-excellence` | relevant/code-review-excellence/SKILL.md |
| Code review (receiving feedback) | `receiving-code-review` | relevant/receiving-code-review/SKILL.md |
| Request automated code review | `requesting-code-review` | relevant/requesting-code-review/SKILL.md |

### Before completing work

| Trigger | Skill | Path |
|---------|-------|------|
| About to claim "done" or "fixed" | `verification-before-completion` | relevant/verification-before-completion/SKILL.md |
| Need to run linting/type checks | `lint-and-validate` | relevant/lint-and-validate/SKILL.md |
| Finishing a branch, ready to merge | `finishing-a-development-branch` | relevant/finishing-a-development-branch/SKILL.md |
| Creating a PR | `create-pr` | relevant/create-pr/SKILL.md |

### When planning or designing

| Trigger | Skill | Path |
|---------|-------|------|
| New feature, creative work, before coding | `brainstorming` | relevant/brainstorming/SKILL.md |
| Multi-step task, need implementation plan | `writing-plans` | relevant/writing-plans/SKILL.md |
| Executing an existing plan | `executing-plans` | relevant/executing-plans/SKILL.md |

### Security and quality

| Trigger | Skill | Path |
|---------|-------|------|
| API security review | `api-security-best-practices` | relevant/api-security-best-practices/SKILL.md |
| Dependency vulnerabilities | `security-scanning-security-dependencies` | relevant/security-scanning-security-dependencies/SKILL.md |
| Accessibility audit | `accessibility-compliance-accessibility-audit` | relevant/accessibility-compliance-accessibility-audit/SKILL.md |
| Web performance (Lighthouse, CWV) | `web-performance-optimization` | relevant/web-performance-optimization/SKILL.md |
| Naming, function design, readability | `clean-code` | relevant/clean-code/SKILL.md |
| Error handling architecture | `error-handling-patterns` | relevant/error-handling-patterns/SKILL.md |
| Git rebase, cherry-pick, bisect | `git-advanced-workflows` | relevant/git-advanced-workflows/SKILL.md |

## Commands

- `npm run dev` — Start both client (Vite) and server (Express) in dev mode
- `npm run build` — Build client and server
- `npm run lint` — Run ESLint
- `npx tsc --noEmit` — Type check without emitting
- `npx vitest run` — Run tests
- `npx prisma migrate dev` — Run database migrations
- `npx prisma validate` — Validate Prisma schema
