# Track 2: Code Quality — Design

Date: 2026-02-24

## Goal

Add unit tests for `src/lib/` pure functions and refactor the 3,249-line server monolith into domain-organized modules. No logic changes — pure extraction and test coverage.

---

## Part A: Unit Tests (`src/lib/`)

**Runner:** Vitest

**Test location:** `src/lib/__tests__/<filename>.test.ts`

### Priority order

| # | File | Functions to test | Value |
|---|------|-------------------|-------|
| 1 | calculations.ts | `applyFormAutoCalculations`, `parseFormNumber` | Core financial logic |
| 2 | smartNotes.ts | `evaluateSmartNotesLine`, `parseSmartNumber`, `formatSmartNotesValue` | Expression engine |
| 3 | recordHelpers.ts | `extractGpeSeFromIndicacoes`, `formToPayload`, `recordToForm`, `getUniqueRecordReferences` | Data transforms |
| 4 | formatters.ts | `formatCurrency`, `formatNumber`, `toFormNumber`, `toColor` | Formatting |
| 5 | sanitizers.ts | `sanitizeDsFilters`, `sanitizePenhorasFilters`, `sanitizeDashboardFilters` | Input validation |
| 6 | dashboardWidgets.ts | Clamp/sanitize/parse functions | Widget layout |
| 7 | dsHelpers.ts | `dsFormToPayload`, `dsRecordToForm` | DS mapping |
| 8 | penhorasHelpers.ts | `penhorasFormToPayload`, `penhorasRecordToForm` | Penhoras mapping |

### Skip (require browser/DOM)

- `localStorage.ts` — reads from `localStorage`
- `exportGenerators.ts` — DOM manipulation + file I/O
- `utils.ts` — covered via other files
- `formatters.ts > colorWithAlpha` — reads from DOM

---

## Part B: Server Refactor

**Strategy:** Extract by domain. Each route group becomes an `express.Router()`. Business logic moves to services. No logic changes.

### Target structure

```
server/src/
├── index.ts              (~80 lines — setup, middleware, mount routers, listen)
├── middleware/
│   ├── cors.ts
│   └── errorHandler.ts
├── schemas/
│   ├── records.ts
│   ├── ds.ts
│   └── penhoras.ts
├── services/
│   ├── records.ts        — mergeRecordWithPatch, asRecordInput, buildRecordWhere, ensureDefaults
│   ├── ds.ts             — asDsRecordInput, toPrismaDsRecordData, prismaDsRecordToDto, ensureDsDefaults
│   ├── penhoras.ts       — asPenhorasRecordInput, toPrismaPenhorasRecordData, ensurePenhorasDefaults, runDataMaintenance
│   └── shared.ts         — statusDto, queryValue, toNumberFromDecimal, duplicateVariant, date/number parsing
├── routes/
│   ├── records.ts        — /api/records/*, /api/bootstrap, /api/analytics/*, /api/import/*
│   ├── ds.ts             — /api/ds/*
│   ├── penhoras.ts       — /api/penhoras/*
│   ├── statuses.ts       — All three status CRUD groups (identical patterns)
│   ├── settings.ts       — /api/calculation-settings, /api/saved-views/*
│   └── data.ts           — /api/seed, /api/migrate/local-storage
└── utils/                — Existing, unchanged
```

### Key decisions

- **statuses.ts** combines all three status CRUD routes — avoids duplication of identical patterns
- **schemas/** separate from routes so services can also import them
- **shared.ts** for cross-domain helpers (DTO mappers, number/date parsers)
- Existing `utils/` folder stays untouched

### Migration strategy

Extract one route group at a time, verify the app works after each. Order:
1. middleware/ (cors, errorHandler)
2. schemas/ (all three)
3. services/shared.ts (cross-domain helpers)
4. services/records.ts + routes/records.ts
5. services/ds.ts + routes/ds.ts
6. services/penhoras.ts + routes/penhoras.ts
7. routes/statuses.ts
8. routes/settings.ts + routes/data.ts
9. Slim down index.ts to ~80 lines
