# Admin Column Management — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded table columns with a database-driven config system that lets admins hide, rename, reorder, and add columns per module per view.

**Architecture:** New `ColumnConfig` Prisma model stores column metadata. A shared `useColumnConfig` hook feeds config to all table and detail components. Admin UI provides a management drawer + right-click context menu. Custom import columns store data in a `customFields` JSON field on each record model.

**Tech Stack:** Prisma (PostgreSQL), Express 5, React 19, TypeScript, Zod 4, Vanilla CSS

**Design doc:** `docs/plans/2026-02-27-admin-column-management-design.md`

---

## Phase 1: Data Model & Backend

### Task 1: Prisma Schema — ColumnConfig model

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add the ColumnConfig model and customFields**

Add to `prisma/schema.prisma`:

```prisma
model ColumnConfig {
  id              String   @id @default(cuid())
  module          String   // "recibos" | "ds" | "penhoras"
  view            String   // "table" | "detail"
  key             String   // field key e.g. "tipo", "custom_xyz"
  label           String   // display name
  type            String   // "string" | "number" | "date" | "currency" | "select"
  visible         Boolean  @default(true)
  position        Int
  isCustom        Boolean  @default(false)
  isReference     Boolean  @default(false)
  referenceConfig Json?
  createdById     Int
  createdBy       User     @relation("ColumnConfigCreator", fields: [createdById], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([module, view, key])
  @@index([module, view])
}
```

Add `customFields` to the 3 record models:

```prisma
// In model Record:
customFields  Json?  @default("{}")

// In model DsRecord:
customFields  Json?  @default("{}")

// In model PenhorasRecord:
customFields  Json?  @default("{}")
```

Add the relation to User model:

```prisma
// In model User, add:
columnConfigs  ColumnConfig[] @relation("ColumnConfigCreator")
```

**Step 2: Validate schema**

Run: `npx prisma validate`
Expected: "The schema is valid."

**Step 3: Create migration**

Run: `npx prisma migrate dev --name add-column-config`
Expected: Migration created and applied successfully.

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add ColumnConfig model and customFields to record models"
```

---

### Task 2: Column Definitions Constants

**Files:**
- Create: `src/constants/columnDefinitions.ts`

**Step 1: Create the shared column type and default definitions**

This file defines the default columns for all 3 modules × 2 views. These are used by the seed script and as fallback when DB has no config.

```typescript
export type ColumnType = 'string' | 'number' | 'date' | 'currency' | 'select'

export interface DefaultColumnDef {
  key: string
  label: string
  type: ColumnType
  position: number
}

// ── Recibos ──────────────────────────────────────────────────────

export const RECIBOS_TABLE_DEFAULTS: DefaultColumnDef[] = [
  { key: 'tipo', label: 'Tipo', type: 'string', position: 0 },
  { key: 'ano_mes', label: 'Ano/Mês', type: 'date', position: 1 },
  { key: 'pe', label: 'PE', type: 'string', position: 2 },
  { key: 'processo', label: 'Processo', type: 'string', position: 3 },
  { key: 'reciboNumero', label: 'Recibo', type: 'string', position: 4 },
  { key: 'gestor_exequente', label: 'Gestor/Exequente', type: 'string', position: 5 },
  { key: 'valorSemIva', label: 'Sem IVA', type: 'currency', position: 6 },
  { key: 'iva', label: 'IVA', type: 'currency', position: 7 },
  { key: 'retencao', label: 'Retenção', type: 'currency', position: 8 },
  { key: 'meu5', label: 'Meu 5%', type: 'currency', position: 9 },
  { key: 'estadoId', label: 'Estado', type: 'select', position: 10 },
]

export const RECIBOS_DETAIL_DEFAULTS: DefaultColumnDef[] = [
  { key: 'tipo', label: 'Tipo', type: 'string', position: 0 },
  { key: 'pe', label: 'PE', type: 'string', position: 1 },
  { key: 'processo', label: 'Processo', type: 'string', position: 2 },
  { key: 'reciboNumero', label: 'Recibo', type: 'string', position: 3 },
  { key: 'gestor', label: 'Gestor', type: 'string', position: 4 },
  { key: 'exequente', label: 'Exequente', type: 'string', position: 5 },
  { key: 'valorSemIva', label: 'Valor sem IVA', type: 'currency', position: 6 },
  { key: 'iva', label: 'IVA', type: 'currency', position: 7 },
  { key: 'retencao', label: 'Retenção', type: 'currency', position: 8 },
  { key: 'meu5', label: 'Meu 5%', type: 'currency', position: 9 },
  { key: 'gpeSe', label: 'GPESE', type: 'string', position: 10 },
  { key: 'indicacoes', label: 'Indicações', type: 'string', position: 11 },
  { key: 'estadoId', label: 'Estado', type: 'select', position: 12 },
]

// ── DS ───────────────────────────────────────────────────────────

export const DS_TABLE_DEFAULTS: DefaultColumnDef[] = [
  { key: 'gestora', label: 'Gestor/a', type: 'string', position: 0 },
  { key: 'proponentes', label: 'Proponentes', type: 'string', position: 1 },
  { key: 'valor', label: 'Valor', type: 'currency', position: 2 },
  { key: 'dataEscritura', label: 'Data Escritura', type: 'date', position: 3 },
  { key: 'comissaoLoja', label: 'Comissão Loja', type: 'currency', position: 4 },
  { key: 'estadoId', label: 'Estado', type: 'select', position: 5 },
]

export const DS_DETAIL_DEFAULTS: DefaultColumnDef[] = [
  { key: 'gestora', label: 'Gestora', type: 'string', position: 0 },
  { key: 'proponentes', label: 'Proponentes', type: 'string', position: 1 },
  { key: 'referencia', label: 'Referência', type: 'string', position: 2 },
  { key: 'produto', label: 'Produto', type: 'string', position: 3 },
  { key: 'entidadeBancaria', label: 'Entidade Bancária', type: 'string', position: 4 },
  { key: 'liderCalculo', label: 'Líder Cálculo', type: 'string', position: 5 },
  { key: 'recibo', label: 'Recibo', type: 'string', position: 6 },
  { key: 'faltaReciboGestora', label: 'Falta Recibo Gestora', type: 'string', position: 7 },
  { key: 'valor', label: 'Valor', type: 'currency', position: 8 },
  { key: 'comissaoLoja', label: 'Comissão Loja', type: 'currency', position: 9 },
  { key: 'totalComissaoLojaCmIva', label: 'Total Comissão c/ IVA', type: 'currency', position: 10 },
  { key: 'ivaCgdRaw', label: 'IVA CGD', type: 'string', position: 11 },
  { key: 'comissaoGestor', label: 'Comissão Gestor', type: 'currency', position: 12 },
  { key: 'percentagem', label: 'Percentagem', type: 'number', position: 13 },
  { key: 'dataEscritura', label: 'Data Escritura', type: 'date', position: 14 },
  { key: 'dataFechoCrm', label: 'Data Fecho CRM', type: 'date', position: 15 },
  { key: 'pagComissaoGestor', label: 'Pag. Comissão Gestor', type: 'string', position: 16 },
  { key: 'estadoId', label: 'Estado', type: 'select', position: 17 },
]

// ── Penhoras ─────────────────────────────────────────────────────

export const PENHORAS_TABLE_DEFAULTS: DefaultColumnDef[] = [
  { key: 'pe', label: 'PE', type: 'string', position: 0 },
  { key: 'acto', label: 'Acto', type: 'string', position: 1 },
  { key: 'dataPedido', label: 'Data Pedido', type: 'date', position: 2 },
  { key: 'identificacao', label: 'Identificação', type: 'string', position: 3 },
  { key: 'pedido', label: 'Pedido', type: 'string', position: 4 },
  { key: 'gestor', label: 'Gestor', type: 'string', position: 5 },
  { key: 'estadoId', label: 'Estado', type: 'select', position: 6 },
]

export const PENHORAS_DETAIL_DEFAULTS: DefaultColumnDef[] = [
  { key: 'pe', label: 'PE', type: 'string', position: 0 },
  { key: 'acto', label: 'Acto', type: 'string', position: 1 },
  { key: 'dataPedido', label: 'Data Pedido', type: 'date', position: 2 },
  { key: 'identificacao', label: 'Identificação', type: 'string', position: 3 },
  { key: 'pedido', label: 'Pedido', type: 'string', position: 4 },
  { key: 'gestor', label: 'Gestor', type: 'string', position: 5 },
  { key: 'estadoId', label: 'Estado', type: 'select', position: 6 },
]

// ── Lookup helper ────────────────────────────────────────────────

export const ALL_DEFAULT_COLUMNS: Record<string, Record<string, DefaultColumnDef[]>> = {
  recibos: { table: RECIBOS_TABLE_DEFAULTS, detail: RECIBOS_DETAIL_DEFAULTS },
  ds: { table: DS_TABLE_DEFAULTS, detail: DS_DETAIL_DEFAULTS },
  penhoras: { table: PENHORAS_TABLE_DEFAULTS, detail: PENHORAS_DETAIL_DEFAULTS },
}
```

**Step 2: Commit**

```bash
git add src/constants/columnDefinitions.ts
git commit -m "feat: add default column definitions for all modules"
```

---

### Task 3: Seed Script

**Files:**
- Create: `prisma/seedColumns.ts`
- Modify: `prisma/seed.ts` (if exists) or `package.json` seed script

**Step 1: Create the seed script**

`prisma/seedColumns.ts` — Upserts default ColumnConfig rows for all modules. Safe to run multiple times (idempotent via the `@@unique([module, view, key])` constraint).

```typescript
import { PrismaClient } from '@prisma/client'
import { ALL_DEFAULT_COLUMNS } from '../src/constants/columnDefinitions'

const prisma = new PrismaClient()

async function seedColumns() {
  // Get first admin user as creator (or first user as fallback)
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  }) ?? await prisma.user.findFirst()

  if (!admin) {
    console.error('No users found. Create at least one user before seeding columns.')
    process.exit(1)
  }

  let created = 0
  let skipped = 0

  for (const [module, views] of Object.entries(ALL_DEFAULT_COLUMNS)) {
    for (const [view, columns] of Object.entries(views)) {
      for (const col of columns) {
        const existing = await prisma.columnConfig.findUnique({
          where: { module_view_key: { module, view, key: col.key } },
        })
        if (existing) {
          skipped++
          continue
        }
        await prisma.columnConfig.create({
          data: {
            module,
            view,
            key: col.key,
            label: col.label,
            type: col.type,
            visible: true,
            position: col.position,
            isCustom: false,
            isReference: false,
            createdById: admin.id,
          },
        })
        created++
      }
    }
  }

  console.log(`Column seed complete: ${created} created, ${skipped} skipped (already exist)`)
}

seedColumns()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

**Step 2: Run seed**

Run: `/bin/zsh -l -c "npx tsx prisma/seedColumns.ts"`
Expected: "Column seed complete: N created, 0 skipped"

**Step 3: Verify in database**

Run: `/bin/zsh -l -c "npx prisma studio"` or query via API.

**Step 4: Commit**

```bash
git add prisma/seedColumns.ts
git commit -m "feat: add column config seed script"
```

---

### Task 4: Zod Schemas for Column Config

**Files:**
- Create: `server/src/schemas/columnConfig.ts`

**Step 1: Define Zod validation schemas**

```typescript
import { z } from 'zod'

const moduleEnum = z.enum(['recibos', 'ds', 'penhoras'])
const viewEnum = z.enum(['table', 'detail'])
const columnTypeEnum = z.enum(['string', 'number', 'date', 'currency', 'select'])

export const columnConfigParams = z.object({
  module: moduleEnum,
  view: viewEnum,
})

export const updateColumnBody = z.object({
  label: z.string().min(1).max(100).optional(),
  visible: z.boolean().optional(),
  position: z.int().min(0).optional(),
})

export const reorderColumnsBody = z.object({
  columns: z.array(z.object({
    id: z.string().cuid(),
    position: z.int().min(0),
  })).min(1),
})

export const createCustomColumnBody = z.object({
  key: z.string().min(1).max(50).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  label: z.string().min(1).max(100),
  type: columnTypeEnum,
  isReference: z.boolean().optional().default(false),
  referenceConfig: z.object({
    matchField: z.string(),
  }).optional(),
})

export const discoverColumnsBody = z.object({
  module: moduleEnum,
})
```

**Step 2: Commit**

```bash
git add server/src/schemas/columnConfig.ts
git commit -m "feat: add Zod schemas for column config validation"
```

---

### Task 5: Backend Routes — Column Config CRUD

**Files:**
- Create: `server/src/routes/columns.ts`
- Modify: `server/src/index.ts` (register routes)

**Step 1: Create the routes file**

`server/src/routes/columns.ts` — Admin routes + public read route.

Key endpoints:
- `GET /api/columns/:module/:view` — Public (authenticated). Returns visible columns ordered by position.
- `GET /api/admin/columns/:module/:view` — Admin. Returns ALL columns (including hidden).
- `PATCH /api/admin/columns/:id` — Admin. Update label, visible, position.
- `PATCH /api/admin/columns/reorder` — Admin. Bulk reorder.
- `POST /api/admin/columns/:module/:view` — Admin. Create custom column.

Use `requireAuth` for public route, `requireAdmin` for admin routes. Validate with Zod schemas from Task 4.

**Step 2: Register routes in server/src/index.ts**

```typescript
import { columnRoutes } from './routes/columns'
// ... after other route registrations:
app.use(columnRoutes)
```

**Step 3: Test manually**

Run API server, then:
- `curl -H "Authorization: Bearer <token>" http://localhost:4000/api/columns/recibos/table`
- Expected: JSON array of visible column configs ordered by position

**Step 4: Commit**

```bash
git add server/src/routes/columns.ts server/src/index.ts
git commit -m "feat: add column config CRUD routes"
```

---

### Task 6: Frontend Hook — useColumnConfig

**Files:**
- Create: `src/hooks/useColumnConfig.ts`
- Create: `src/types/columnConfig.ts`

**Step 1: Create the column config type**

`src/types/columnConfig.ts`:

```typescript
export interface ColumnConfig {
  id: string
  module: string
  view: string
  key: string
  label: string
  type: 'string' | 'number' | 'date' | 'currency' | 'select'
  visible: boolean
  position: number
  isCustom: boolean
  isReference: boolean
  referenceConfig?: { matchField: string } | null
}
```

**Step 2: Create the hook**

`src/hooks/useColumnConfig.ts`:

Fetches `GET /api/columns/:module/:view`, caches result, provides `columns` array and `isLoading` state. Also exports a `mutate` function to invalidate cache (called after admin operations).

For admin operations, export `useAdminColumnConfig(module, view)` that also fetches ALL columns (including hidden) from the admin endpoint, plus mutation functions:
- `updateColumn(id, patch)` — PATCH
- `reorderColumns(items)` — PATCH bulk
- `toggleVisibility(id)` — shortcut
- `renameColumn(id, label)` — shortcut
- `createCustomColumn(data)` — POST

**Step 3: Commit**

```bash
git add src/hooks/useColumnConfig.ts src/types/columnConfig.ts
git commit -m "feat: add useColumnConfig and useAdminColumnConfig hooks"
```

---

## Phase 2: Config-Driven Tables

### Task 7: Cell Renderer Registry

**Files:**
- Create: `src/components/shared/cellRenderers.ts`

**Step 1: Create the registry**

Define a `CellRenderer` type and module-specific renderer maps. Each renderer takes `(value, record)` and returns a `ReactNode`.

Default renderers by column type:
- `string` → plain text with "-" fallback
- `number` → formatted number
- `currency` → `formatCurrency()`
- `date` → formatted date string
- `select` → plain text (status handled specially)

Module-specific overrides:
- Recibos: `tipo` → badge, `ano_mes` → "YYYY/MM" format, `gestor_exequente` → EntityIdentity component, `estadoId` → StatusPill
- DS: `estadoId` → StatusPill
- Penhoras: `estadoId` → StatusPill

**Step 2: Commit**

```bash
git add src/components/shared/cellRenderers.ts
git commit -m "feat: add cell renderer registry for config-driven tables"
```

---

### Task 8: Refactor RecibosConsultaTabela to Config-Driven

**Files:**
- Modify: `src/components/recibos/RecibosConsultaTabela.tsx`

**Step 1: Import useColumnConfig and renderers**

Replace hardcoded `<thead>` and `<tbody>` column rendering with:

```tsx
const { columns, isLoading } = useColumnConfig('recibos', 'table')

// thead:
{columns.map(col => <th key={col.key}>{col.label}</th>)}

// tbody:
{columns.map(col => {
  const renderer = recibosRenderers[col.key] ?? defaultRendererForType(col.type)
  const value = col.isCustom
    ? (record.customFields as Record<string, unknown>)?.[col.key]
    : record[col.key as keyof ReceiptRecord]
  return <td key={col.key}>{renderer(value, record)}</td>
})}
```

Keep the checkbox column and action columns outside the config loop (they're UI controls, not data columns).

**Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean

**Step 3: Visual verify**

Start dev server, log in as admin, check recibos table renders correctly with same columns as before.

**Step 4: Commit**

```bash
git add src/components/recibos/RecibosConsultaTabela.tsx
git commit -m "refactor: make Recibos table config-driven"
```

---

### Task 9: Refactor DsConsultaTabela to Config-Driven

**Files:**
- Modify: `src/components/ds/DsConsultaTabela.tsx`

Same pattern as Task 8 but with DS columns and renderers.

**Commit:** `git commit -m "refactor: make DS table config-driven"`

---

### Task 10: Refactor PenhorasConsultaTabela to Config-Driven

**Files:**
- Modify: `src/components/penhoras/PenhorasConsultaTabela.tsx`

Same pattern as Task 8 but with Penhoras columns and renderers.

**Commit:** `git commit -m "refactor: make Penhoras table config-driven"`

---

### Task 11: Refactor Detail Views to Config-Driven

**Files:**
- Modify: `src/components/recibos/RecibosRecordDrawer.tsx`
- Modify: `src/components/ds/DsRecordDrawer.tsx`
- Modify: `src/components/penhoras/PenhorasRecordDrawer.tsx`

For each drawer's **display mode** (not edit mode), replace hardcoded field rendering with a config-driven loop using `useColumnConfig(module, 'detail')`.

Edit mode stays as-is (form fields are a separate concern from display config).

**Commit:** `git commit -m "refactor: make detail views config-driven"`

---

### Task 12: Wire Export System to Column Config

**Files:**
- Modify: `src/constants/exportColumns.ts`
- Modify: `src/components/shared/ExportWizardSteps/ColumnPicker.tsx`

The export column picker should read from column config so that:
- Hidden columns don't appear in the picker by default
- Custom columns appear in the picker
- Renamed labels are reflected

Can be done by having the ColumnPicker accept columns from the config hook instead of static arrays.

**Commit:** `git commit -m "feat: wire export column picker to column config"`

---

## Phase 3: Admin UI

### Task 13: Column Management Drawer Component

**Files:**
- Create: `src/components/admin/ColumnManager.tsx`
- Create: `src/components/admin/ColumnManager.css`

**Step 1: Build the drawer component**

Slide-over panel containing:
- View switcher tabs ("Tabela" | "Detalhe")
- Sortable column list (drag handle, eye toggle, editable label, Custom/Ref badges)
- Hidden columns section (collapsed)
- "Adicionar via Import" button (Phase 4 — render disabled placeholder for now)

Props:
```typescript
interface ColumnManagerProps {
  module: 'recibos' | 'ds' | 'penhoras'
  open: boolean
  onClose: () => void
}
```

Uses `useAdminColumnConfig(module, view)` internally.

**Step 2: Style the drawer**

Match existing sidebar/drawer styling patterns. Use CSS variables from the design system.

**Step 3: Commit**

```bash
git add src/components/admin/ColumnManager.tsx src/components/admin/ColumnManager.css
git commit -m "feat: add ColumnManager drawer component"
```

---

### Task 14: Gear Icon in Table Toolbar

**Files:**
- Modify: `src/components/recibos/RecibosConsultaTabela.tsx`
- Modify: `src/components/ds/DsConsultaTabela.tsx`
- Modify: `src/components/penhoras/PenhorasConsultaTabela.tsx`

Add a gear icon button (Settings lucide icon) to each table's toolbar area. Only renders when `user.role === 'ADMIN'`. Opens the ColumnManager drawer.

```tsx
{user.role === 'ADMIN' && (
  <button className="subtle-btn icon-btn" onClick={() => setColumnManagerOpen(true)} title="Gerir colunas">
    <Settings size={15} />
  </button>
)}
<ColumnManager module="recibos" open={columnManagerOpen} onClose={() => setColumnManagerOpen(false)} />
```

**Commit:** `git commit -m "feat: add column manager gear icon to table toolbars"`

---

### Task 15: Right-Click Context Menu on Column Headers

**Files:**
- Create: `src/components/shared/ColumnHeaderContextMenu.tsx`
- Create: `src/components/shared/ColumnHeaderContextMenu.css`
- Modify: all 3 `*ConsultaTabela.tsx` files

**Step 1: Create the context menu component**

Small floating menu that appears on right-click of a `<th>`. Shows:
- "Ocultar coluna" — calls `toggleVisibility`
- "Renomear" — opens inline edit popover
- "Mover para início" / "Mover para fim" — calls `reorderColumns`

Only renders for admin users.

**Step 2: Wire into table headers**

Each `<th>` in the config loop gets `onContextMenu` handler (admin only):

```tsx
<th
  key={col.key}
  onContextMenu={user.role === 'ADMIN' ? (e) => openContextMenu(e, col) : undefined}
>
  {col.label}
</th>
```

**Step 3: Commit**

```bash
git add src/components/shared/ColumnHeaderContextMenu.tsx src/components/shared/ColumnHeaderContextMenu.css
git add src/components/recibos/RecibosConsultaTabela.tsx
git add src/components/ds/DsConsultaTabela.tsx
git add src/components/penhoras/PenhorasConsultaTabela.tsx
git commit -m "feat: add right-click context menu for column headers"
```

---

## Phase 4: Import Integration

### Task 16: Column Discovery from Import Files

**Files:**
- Create: `server/src/lib/discoverImportColumns.ts`
- Modify: `server/src/routes/columns.ts` (add `/from-import` endpoint)

**Step 1: Build discovery logic**

Parse uploaded Excel/CSV, extract header row, diff against existing ColumnConfig keys for the module. Return list of unmapped column names.

**Step 2: Add endpoint**

`POST /api/admin/columns/from-import` — accepts multipart file upload + module param. Returns `{ discoveredColumns: string[] }`.

**Step 3: Commit**

```bash
git add server/src/lib/discoverImportColumns.ts server/src/routes/columns.ts
git commit -m "feat: add import column discovery endpoint"
```

---

### Task 17: Import Column Mapping UI

**Files:**
- Modify: `src/components/admin/ColumnManager.tsx`

**Step 1: Build the "Adicionar via Import" sub-flow**

Replace the disabled placeholder from Task 13 with:
1. File upload input
2. Call discovery endpoint
3. Show list of unmapped columns with checkboxes
4. For each selected: label input + reference toggle
5. Confirm button → creates ColumnConfig rows

**Step 2: Commit**

```bash
git add src/components/admin/ColumnManager.tsx
git commit -m "feat: add import column mapping UI to ColumnManager"
```

---

### Task 18: Populate customFields on Import Commit

**Files:**
- Modify: `server/src/routes/records.ts` (commit-import endpoint)
- Modify: `server/src/routes/ds.ts` (commit-import endpoint)
- Modify: `server/src/routes/penhoras.ts` (commit-import endpoint)

**Step 1: Extend import commit logic**

After parsing import rows, check for custom ColumnConfig columns for the module. For any custom column keys found in the import data, populate the `customFields` JSON field on the record.

```typescript
const customColumns = await prisma.columnConfig.findMany({
  where: { module, isCustom: true },
})
const customFields: Record<string, unknown> = {}
for (const col of customColumns) {
  if (row[col.key] !== undefined) {
    customFields[col.key] = row[col.key]
  }
}
// Include customFields in prisma.record.create({ data: { ...recordData, customFields } })
```

**Step 2: Commit**

```bash
git add server/src/routes/records.ts server/src/routes/ds.ts server/src/routes/penhoras.ts
git commit -m "feat: populate customFields on import commit"
```

---

## Verification Checklist

After all phases, verify:

- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run lint` — no new errors
- [ ] `npx vitest run` — all tests pass
- [ ] Seed script runs idempotently
- [ ] Non-admin users see tables as before (no column management UI)
- [ ] Admin sees gear icon, can open ColumnManager drawer
- [ ] Admin can hide/show columns — reflected for all users
- [ ] Admin can rename columns — label updates everywhere
- [ ] Admin can reorder columns — position updates in table and export
- [ ] Right-click context menu works on column headers (admin only)
- [ ] Export column picker reflects visibility/rename changes
- [ ] Import column discovery finds unmapped columns
- [ ] Custom columns from import appear in table and detail views
