# Mesa de Recibos — Codebase Improvement Plan

Last updated: 2026-02-20
Status: Planning

---

## Executive Summary

The frontend codebase is a functional product with solid API integration and multi-module support (Recibos, DS, Penhoras). However, **the entire frontend lives in a single `App.tsx` file of 8,129 lines and 345KB**, making it nearly impossible to navigate, maintain, test, or onboard new contributors. The server `index.ts` is similarly monolithic at 105KB.

This plan proposes a **safe, incremental refactor** that preserves all existing behaviour while progressively restructuring the code into a maintainable file/component architecture.

---

## Core Problems Identified

| Problem | Impact | Severity |
|---------|--------|----------|
| `App.tsx` is 8,129 lines (345KB) | Can't navigate, review, or reason about | 🔴 Critical |
| `server/src/index.ts` is 105KB | Same problem on the backend | 🔴 Critical |
| `App()` component holds ALL state for ALL 3 modules simultaneously | Every keystroke can re-render 6,000+ lines | 🟠 High |
| No custom hooks — all data-fetching logic inline | Can't reuse, test, or isolate state logic | 🟠 High |
| No component files — all UI inline inside `App()` | Can't lazy-load, test, or reuse components | 🟠 High |
| `index.css` is 60KB of global styles | Hard to know what styles relate to what features | 🟡 Medium |
| Duplicated patterns (3 nearly-identical modules) | 3x bugs, 3x fixes needed | 🟡 Medium |
| No automated tests exist (noted in CI plan) | No safety net for refactoring | 🟡 Medium |

---

## Guiding Principles

1. **Never break what works.** Each phase must be independently shippable. Behaviour must be identical after each phase.
2. **Incremental over big-bang.** One file or one concept at a time. Commit and verify after each chunk.
3. **Extract, don't rewrite.** Move code as-is first; improve second. Don't change logic during structural refactors.
4. **Proven React patterns.** Custom hooks for data, isolated component files, clear prop interfaces.

---

## Target File Structure

```
src/
  main.tsx            (entry point — unchanged)
  App.tsx             (~200 lines, orchestrates module routing only)
  api.ts              (unchanged, already well structured)
  types.ts            (unchanged, already well structured)
  
  constants/
    themes.ts         (THEME_OPTIONS, ThemeId)
    modules.ts        (TABS, module definitions)
    calculator.ts     (CALCULATOR_KEYS)
    domains.ts        (EXEQUENTE_DOMAIN_MAP, keyword map)
    dashboards.ts     (widget library constants for all 3 modules)
    statusIcons.ts    (STATUS_ICON_OPTIONS)

  lib/
    calculations.ts   (unchanged)
    importParser.ts   (unchanged)
    utils.ts          (unchanged)
    formatters.ts     (formatCurrency, toFormNumber, normalizeText, etc.)
    smartNotes.ts     (evaluateSmartNotesLine, parseSmartNumber, etc.)
    recordHelpers.ts  (formToPayload, recordToForm, getPrimaryRecordReference, etc.)
    dsHelpers.ts      (dsFormToPayload, dsRecordToForm, etc.)
    penhorasHelpers.ts(penhorasFormToPayload, penhorasRecordToForm, etc.)
    dashboardHelpers.ts(parseDashboardWidgets, clampDashboardWidget*, etc.)
    sanitizers.ts     (sanitizeFilters, sanitizeDashboardFilters, etc.)
    localStorage.ts   (resolveInitialTheme, resolveInitialQuickNotes, etc.)
  
  hooks/
    useBootstrap.ts           (bootstrap API call, statuses, calcSettings)
    useRecords.ts             (records CRUD, filters, pagination)
    useDsRecords.ts           (DS module records CRUD)
    usePenhorasRecords.ts     (Penhoras module records CRUD)
    useDashboard.ts           (analytics, widget layout state)
    useImport.ts              (import flow for recibos)
    useDsImport.ts            (import flow for DS)
    usePenhorasImport.ts      (import flow for Penhoras)
    useSavedViews.ts          (saved views CRUD)
    useQuickTools.ts          (notes, calculator, smart-notes panel state)
    useUndoStack.ts           (undo/redo stack)
    useTheme.ts               (theme management with localStorage sync)
    useSmartNotes.ts          (smart notes evaluation, pinning, saving)

  components/
    shared/
      StatusPill.tsx
      StatusIcon.tsx
      ExequenteLogo.tsx
      GestorAvatar.tsx
      EntityIdentity.tsx
      LabeledInput.tsx
      LabeledSelect.tsx
      AutocompleteInput.tsx
      Info.tsx
      FeedbackToast.tsx
      UndoBar.tsx
      ErrorBoundary.tsx

    layout/
      AppShell.tsx            (top nav, module switcher, theme toggle)
      TabBar.tsx              (tab navigation within a module)
      QuickToolsPanel.tsx     (notes/calculator/smart-notes floating panels)

    recibos/
      RecibosEntrada.tsx      (entry form)
      RecibosConsulta.tsx     (card/details view)
      RecibosTabela.tsx       (table view + bulk actions)
      RecibosDashboards.tsx   (dashboard widgets)
      RecibosImportar.tsx     (import flow)
      RecibosConfiguracao.tsx (statuses + calculation settings)

    ds/
      DsEntrada.tsx
      DsConsulta.tsx
      DsTabela.tsx
      DsDashboards.tsx
      DsImportar.tsx
      DsConfiguracao.tsx

    penhoras/
      PenhorasEntrada.tsx
      PenhorasConsulta.tsx
      PenhorasTabela.tsx
      PenhorasDashboards.tsx
      PenhorasImportar.tsx
      PenhorasConfiguracao.tsx

    dashboard/
      DashboardWidget.tsx
      DashboardBar.tsx
      DashboardKpi.tsx
      DashboardLayout.tsx

server/src/
  index.ts          (~50 lines — server bootstrap only)
  middleware/
    cors.ts
    errorHandler.ts
    requestLogger.ts
  routes/
    recibos.ts      (all /api/records/* + /api/statuses + /api/calc-settings routes)
    ds.ts           (all /api/ds/* routes)
    penhoras.ts     (all /api/penhoras/* routes)
    bootstrap.ts    (/api/bootstrap, /api/health, /api/seed, /api/migrate/*)
    savedViews.ts   (/api/saved-views/*)
    importRoutes.ts (/api/import/*)
  services/
    recordsService.ts
    dsService.ts
    penhorasService.ts
    analyticsService.ts
    importService.ts
  utils/
    db.ts           (prisma client singleton)
    validators.ts   (zod schemas, validation helpers)
    numberParser.ts (pt-PT number parsing)
```

---

## Execution Phases

### Phase 0 — Preparation (no code changes)
**Goal:** Understand structure, document decisions, set up verification.
- [x] Read and map `App.tsx` structure (done above)
- [ ] Confirm dev server boots and app works before starting
- [ ] Capture current behaviour notes (key feature checklist)
- [ ] Add lint check to CI to catch any accidental regressions

Deliverable: Green dev server, feature checklist documented.

---

### Phase 1 — Extract Pure Utilities (zero risk)
**Goal:** Move pure, side-effect-free functions out of `App.tsx` into `src/lib/`.

Files created (✅ = done):
- ✅ `src/lib/formatters.ts` — `formatCurrency`, `toFormNumber`, `normalizeText`, `toColor`, `colorWithAlpha`
- ✅ `src/lib/localStorage.ts` — all `resolveInitial*` functions + `STORAGE_KEYS` + `ThemeId` type
- ✅ `src/lib/smartNotes.ts` — `evaluateSmartNotesLine`, `parseSmartNumber`, `buildSmartNotesSignature`, `formatSmartNotesValue` + row types
- ✅ `src/lib/recordHelpers.ts` — `formToPayload`, `recordToForm`, `recordToPatchPayload`, `getInitialEntryForm`, `getPrimaryRecordReference`, `getUniqueRecordReferences`, `getSecondaryRecordReference`, `composeIndicacoes`, `extractGpeSeFromIndicacoes`
- ✅ `src/lib/dsHelpers.ts` — `dsFormToPayload`, `dsRecordToForm`, `getInitialDsEntryForm`
- ✅ `src/lib/penhorasHelpers.ts` — `penhorasFormToPayload`, `penhorasRecordToForm`, `getInitialPenhorasEntryForm`
- ✅ `src/lib/dashboardWidgets.ts` — all widget types, constants, library arrays, `parse*DashboardWidgets`, `clamp*`, layout helpers + sanitizers
- ✅ `src/lib/sanitizers.ts` — `sanitizeDsFilters`, `sanitizePenhorasFilters`, `sanitizeDashboardFilters`

**Note:** All new files compile cleanly (`npx tsc --noEmit` = 0 errors). App.tsx has NOT yet been updated to import from these — that's the next step (wiring phase).

**Strategy:**
1. ✅ Create new files with functions verbatim.
2. ✅ Update `App.tsx` to import from new files.
3. ✅ Verified: `tsc --noEmit` clean, dev server runs.
4. ✅ Committed.

Risk: **Very low.** Pure functions — logic unchanged, only location changes.

---

### Phase 2 — Extract Shared UI Components (low risk)
**Goal:** Move small, leaf-level, prop-driven components out of `App.tsx`.

These components are defined **outside** the `App()` function (lines 7876–8129):
- ✅ `LabeledInput`, `AutocompleteInput`, `LabeledSelect` → `src/components/shared/FormInputs.tsx`
- ✅ `StatusPill`, `StatusIcon`, `ExequenteLogo`, `GestorAvatar`, `EntityIdentity` → `src/components/shared/StatusComponents.tsx`
- ✅ `Info` → `src/components/shared/FormInputs.tsx`
- ✅ `FeedbackToast` (visual feedback bar)
- ✅ `UndoBar` (undo notification)

**Strategy:**
1. ✅ Create `src/components/shared/` directory and component files.
2. ✅ Import back into `App.tsx`.
3. ✅ Verified.
4. ✅ Committed.

Risk: **Low.** These components have no internal state or hooks.

---

### Phase 3 — Extract Custom Hooks (Completed)
**Goal:** Pull data-fetching and state logic out of `App()` into named hooks.

All 20 hooks extracted:
- ✅ `useTheme()` — theme management with localStorage sync
- ✅ `useUndoStack()` — undo/redo stack
- ✅ `useQuickTools()` — notes, calculator, smart-notes panel state
- ✅ `useBootstrap()` — bootstrap API call, statuses, calcSettings
- ✅ `useRecords(filters)` — records CRUD, filters, pagination
- ✅ `useDsRecords(filters)` — DS module records CRUD
- ✅ `usePenhorasRecords(filters)` — Penhoras module records CRUD
- ✅ `useDashboard(filters)` — widget layout state
- ✅ `useSavedViews(scope)` — saved views CRUD
- ✅ `useSmartNotes()` — smart notes evaluation, pinning, saving
- ✅ `useSettings()` — status/calcSettings management
- ✅ `useEntryForm()` — entry form state + submission for all 3 modules
- ✅ `useImport()` — import flow for all 3 modules
- ✅ `useRecordActions()` — CRUD actions, bulk ops, undo
- ✅ `useDashboardHandlers()` — dashboard widget CRUD + resize
- ✅ `useDashboardAnalytics()` — 9 dashboard aggregation computations
- ✅ `useFilterOptions()` — 16 filter/suggestion derivations
- ✅ `useSelectedRecord()` — selected record loading for all 3 modules
- ✅ `useCalculator()` — calculator state + evaluation
- ✅ `useNotesExport()` — notes export functionality

**Outcome:** App.tsx reduced from 8,129 → 1,733 lines. All state and data-fetching logic decentralized into `src/hooks/`.

Risk: **Medium.** Need to be careful with callback dependencies (useCallback, useEffect deps). Do one hook at a time.

---

### Phase 4 — Extract Module-Level Components (medium-high risk)
**Goal:** Move each module's tab content into its own component file, eliminating the 6,000-line `App()` render function.

**Approach — prop drilling first (no context yet):**
1. Identify all state/callbacks that a given component (e.g. `RecibosTabela`) needs.
2. Define a typed props interface.
3. Create the component file, paste the JSX.
4. Pass all needed state as props from `App()`.
5. Verify.
6. Commit.

Order of extraction (least to most connected):
1. `RecibosConfiguracao` — settings UI, few state deps
2. `DsConfiguracao` — similar
3. `PenhorasConfiguracao` — similar
4. `RecibosImportar` — self-contained import flow
5. `DsImportar`
6. `PenhorasImportar`
7. ✅ `RecibosDashboards` — reads `dashboardSummary`, own widget layout
8. ✅ `DsDashboards`
9. ✅ `PenhorasDashboards`
10. ✅ `RecibosConsultaTabela` — combined consulta + tabela views (was RecibosConsulta + RecibosTabela)
11. ✅ `DsConsultaTabela` — combined consulta + tabela views (was DsConsulta + DsTabela)
12. ✅ `PenhorasConsultaTabela` — combined consulta + tabela views (was PenhorasConsulta + PenhorasTabela)
13. ~~`RecibosTabela`~~ (merged into RecibosConsultaTabela)
14. ~~`DsTabela`~~ (merged into DsConsultaTabela)
15. ~~`PenhorasTabela`~~ (merged into PenhorasConsultaTabela)
16. ✅ `RecibosEntrada` — entry form
17. ✅ `DsEntrada`
18. ✅ `PenhorasEntrada`

Risk: **Medium-High.** Props interfaces will be wide initially. That's OK — reduce after Phase 5.

---

### Phase 5 — Context / State Slicing (optional, post-cleanup)
**Goal:** Replace wide prop drilling with React Context or Zustand slices per module.

Once components are extracted, group related state into module contexts:
- `RecibosContext` — statuses, records, filters, selectedRecord, savedViews, etc.
- `DsContext` — dsStatuses, dsRecords, dsFilters, etc.
- `PenhorasContext` — penhorasStatuses, etc.
- `AppContext` — theme, activeModule, activeTab, feedback, undo

This is a polish step — do only if prop drilling becomes genuinely painful.

Risk: **Low once Phase 4 is done.** Context wraps are additive.

---

### Phase 6 — Server Refactor (independent of frontend phases)
**Goal:** Break up `server/src/index.ts` (105KB) into routes, services, utils.

Steps:
1. Extract Prisma client to `server/src/utils/db.ts`.
2. Extract number parsing to `server/src/utils/numberParser.ts`.
3. Extract request validators (Zod schemas) to `server/src/utils/validators.ts`.
4. Move CORS + error handler middleware to `server/src/middleware/`.
5. Extract route handlers into `server/src/routes/` files (one per domain).
6. Extract service logic (DB queries) into `server/src/services/`.
7. Slim `index.ts` to ~50-line bootstrap.

Risk: **Medium.** Routes are isolated by path prefix — use those as natural extraction boundaries.

---

### Phase 7 — Polish & Tests (ongoing)
- Add Vitest for unit tests on pure utility functions (all now in `src/lib/`).
- Add component-level tests using React Testing Library.
- Address TypeScript strict mode gaps.
- Archive legacy theme IDs marked as `(Legacy)` in `THEME_OPTIONS`.
- CSS: split `index.css` into per-component stylesheets (if Vite module CSS approach is adopted).
- Consider code-splitting: lazy-load each module tab via `React.lazy`.

---

## Quick Wins (can do immediately, < 1 hour each)

1. **Extract `src/lib/formatters.ts`** — 5 pure functions, zero risk.
2. **Extract shared UI components** (`StatusPill`, `LabeledInput`, etc.) — already defined outside `App()`.
3. **Split server CORS config** from `index.ts` — 10-line change.
4. **Move constants to `src/constants/`** — zero behavioural change.
5. **Add `src/lib/smartNotes.ts`** — 100% pure, well-isolated already.

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| 0 - Preparation | ✅ Done | Dev server verified, structure mapped |
| 1 - Extract utils | ✅ Done | 13 files in `src/lib/`, all wired into App.tsx |
| 2 - Extract UI components | ✅ Done | 6 files in `src/components/shared/` |
| 3 - Extract hooks | ✅ Done | 20 hooks in `src/hooks/` — App.tsx: 8129 → 1733 lines |
| 4 - Extract module components | ✅ Done | 21 components across recibos/, ds/, penhoras/ |
| 5 - Context/state slicing | 🔲 Not started | Optional — defer until prop drilling is painful |
| 6 - Server refactor | 🔲 Not started | `server/src/index.ts` still 3249 lines |
| 7 - Tests & polish | 🔲 Not started | Ongoing |

---

## Non-Goals (explicitly out of scope for this plan)

- Changing any business logic or behaviour.
- Adding new features.
- Redesigning the UI.
- Switching to a different state management library (Zustand, Jotai) unless Phase 5 finds it necessary.
- Changing the database layer or Prisma schema.

---

## Phase 6: Advanced Export System (New)

**Goal:** Create an advanced export composer for all three modules (Recibos, DS, Penhoras) supporting XLS, CSV, and PDF formats, with layout configuration and AI summaries.

**Tasks:**
1.  **Export Composer UI (`ExportComposer.tsx`)**:
    - Build a dialog/modal component accessible from Dashboards and Tables.
    - Add data selection options (Consulta, Tabela records, Dashboard metrics).
    - Add output format selector (Excel, CSV, PDF).
    - Add aesthetic configurations for PDF/Excel.

2.  **AI Summary Integration**:
    - Add an API endpoint `POST /api/ai/summary` utilizing `@google/genai` to generate insights based on given structured data payload.
    - Integrate the AI summary toggle into the Export Composer UI.

3.  **Data Generators**:
    - Implement CSV generator (client-side or server-side).
    - Implement XLS generator using `exceljs` with formatting (colors, bold headers, dashboard metrics).
    - Implement PDF generator using `jspdf` and html2canvas or raw drawing for a premium look.

4.  **Module Integration**:
    - Add export buttons to `Recibos`, `DS`, and `Penhoras` views.
    - Wire current table configurations (filters, visible columns) and dashboard data into the Export Context.

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Breaking circular imports during extraction | Use ESLint `import/no-cycle` plugin or manually verify imports |
| Missing a prop dependency when extracting a component | TypeScript will catch it at build time |
| `useCallback`/`useEffect` deps breaking after hook extraction | Run dev server and exercise all features after each hook |
| Server routes having hidden cross-route state | Log and test each route independently after extraction |
| Merge conflicts if features are being added simultaneously | Pause feature work during Phase 3-4, or refactor feature branches against the new structure |
