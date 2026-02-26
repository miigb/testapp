# Export System Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace ExportComposer with a 3-step Export Wizard that produces professional, customizable reports with combined dashboard+table exports and saved report templates.

**Architecture:** A new `ExportWizard` component replaces all 6 `ExportComposer` instances. It mounts once per module at the App.tsx level with unified access to both dashboard and table data. A new `ReportTemplate` Prisma model + CRUD API enables shared template persistence. PDF rendering is upgraded with `jspdf-autotable` for proper table output.

**Tech Stack:** React, TypeScript, jsPDF + jspdf-autotable, ExcelJS, html-to-image, Prisma, Express, Zod

---

### Task 1: Add jspdf-autotable dependency

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run: `npm install jspdf-autotable`
Expected: Package added to dependencies

**Step 2: Verify TypeScript types resolve**

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: No new errors (jspdf-autotable ships its own types)

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jspdf-autotable dependency for PDF table rendering"
```

---

### Task 2: Create ReportTemplate Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create migration via `npx prisma migrate dev`

**Step 1: Add the model to prisma/schema.prisma**

Add after the `SavedView` model (around line 270):

```prisma
model ReportTemplate {
  id        String   @id @default(cuid())
  name      String
  module    String
  settings  Json
  createdById Int
  createdBy   User   @relation(fields: [createdById], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([module])
}
```

Also add to the `User` model (around line 41-61), after the existing relations:

```prisma
  reportTemplates        ReportTemplate[]
```

**Step 2: Run migration**

Run: `npx prisma migrate dev --name add-report-templates`
Expected: Migration created and applied successfully

**Step 3: Verify Prisma client generates**

Run: `npx prisma generate`
Expected: Prisma Client generated

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add ReportTemplate model to Prisma schema"
```

---

### Task 3: Create report templates API routes

**Files:**
- Create: `server/src/routes/reportTemplates.ts`
- Modify: `server/src/index.ts`

**Step 1: Create the route file**

Create `server/src/routes/reportTemplates.ts`:

```typescript
import { Router } from 'express'
import type { PrismaClient, Prisma } from '@prisma/client'
import { z } from 'zod'

import { requireAuth } from '../middleware/auth'

const templateSettingsSchema = z.object({
  includeDashboard: z.boolean(),
  includeTable: z.boolean(),
  maxRows: z.union([z.literal(50), z.literal(100), z.literal(250), z.literal('all')]),
  format: z.enum(['pdf', 'excel', 'csv']),
  title: z.string().max(200),
  companyName: z.string().max(200).optional(),
  orientation: z.enum(['portrait', 'landscape']).optional(),
  footerText: z.string().max(500).optional(),
  selectedColumns: z.array(z.string()),
  useAiSummary: z.boolean(),
})

const createSchema = z.object({
  name: z.string().min(1).max(100),
  module: z.enum(['recibos', 'ds', 'penhoras']),
  settings: templateSettingsSchema,
})

function templateDto(t: {
  id: string
  name: string
  module: string
  settings: unknown
  createdById: number
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: t.id,
    name: t.name,
    module: t.module,
    settings: t.settings,
    createdById: t.createdById,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

export function createReportTemplatesRouter(prisma: PrismaClient): Router {
  const router = Router()

  // List templates for a module
  router.get('/', async (req, res) => {
    const module = typeof req.query.module === 'string' ? req.query.module : undefined
    const templates = await prisma.reportTemplate.findMany({
      where: module ? { module } : undefined,
      orderBy: { updatedAt: 'desc' },
    })
    res.json(templates.map(templateDto))
  })

  // Create a template
  router.post('/', async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: 'Não autenticado.' })

    const created = await prisma.reportTemplate.create({
      data: {
        ...parsed.data,
        settings: parsed.data.settings as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    })
    res.status(201).json(templateDto(created))
  })

  // Update a template
  router.put('/:id', async (req, res) => {
    const parsed = createSchema.partial().safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Payload inválido.', details: parsed.error.flatten() })
    }

    const existing = await prisma.reportTemplate.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Template não encontrado.' })

    const userId = (req as any).user?.id
    const userRole = (req as any).user?.role
    if (existing.createdById !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas o criador ou um administrador pode editar este template.' })
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) data.name = parsed.data.name
    if (parsed.data.module !== undefined) data.module = parsed.data.module
    if (parsed.data.settings !== undefined) data.settings = parsed.data.settings as unknown as Prisma.InputJsonValue

    const updated = await prisma.reportTemplate.update({ where: { id: req.params.id }, data })
    res.json(templateDto(updated))
  })

  // Delete a template
  router.delete('/:id', async (req, res) => {
    const existing = await prisma.reportTemplate.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Template não encontrado.' })

    const userId = (req as any).user?.id
    const userRole = (req as any).user?.role
    if (existing.createdById !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas o criador ou um administrador pode eliminar este template.' })
    }

    await prisma.reportTemplate.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  })

  return router
}
```

**Step 2: Register the router in server/src/index.ts**

Add import at top (after the notifications import, ~line 20):

```typescript
import { createReportTemplatesRouter } from './routes/reportTemplates'
```

Add route registration (after the notifications line, ~line 64):

```typescript
app.use('/api/report-templates', requireAuth, createReportTemplatesRouter(prisma))
```

**Step 3: Verify server compiles**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add server/src/routes/reportTemplates.ts server/src/index.ts
git commit -m "feat: add report templates CRUD API endpoints"
```

---

### Task 4: Add report template API client methods

**Files:**
- Modify: `src/api.ts`
- Modify: `src/types.ts`

**Step 1: Add the ReportTemplate type to src/types.ts**

Add after the `SavedView` type (around line 109):

```typescript
export type ReportTemplateSettings = {
  includeDashboard: boolean
  includeTable: boolean
  maxRows: 50 | 100 | 250 | 'all'
  format: 'pdf' | 'excel' | 'csv'
  title: string
  companyName?: string
  orientation?: 'portrait' | 'landscape'
  footerText?: string
  selectedColumns: string[]
  useAiSummary: boolean
}

export type ReportTemplate = {
  id: string
  name: string
  module: string
  settings: ReportTemplateSettings
  createdById: number
  createdAt: string
  updatedAt: string
}
```

**Step 2: Add API methods to src/api.ts**

Add after the `deleteSavedView` method (around line 301):

```typescript
  // Report Templates
  getReportTemplates(module?: string) {
    const query = module ? `?module=${encodeURIComponent(module)}` : ''
    return request<ReportTemplate[]>(`/api/report-templates${query}`)
  },

  createReportTemplate(payload: Pick<ReportTemplate, 'name' | 'module' | 'settings'>) {
    return request<ReportTemplate>('/api/report-templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateReportTemplate(id: string, payload: Partial<Pick<ReportTemplate, 'name' | 'module' | 'settings'>>) {
    return request<ReportTemplate>(`/api/report-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteReportTemplate(id: string) {
    return request<{ ok: true }>(`/api/report-templates/${id}`, {
      method: 'DELETE',
    })
  },
```

Also add `ReportTemplate` and `ReportTemplateSettings` to the import from `./types` at the top of `api.ts`.

**Step 3: Verify frontend compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/types.ts src/api.ts
git commit -m "feat: add ReportTemplate type and API client methods"
```

---

### Task 5: Extract per-module export column definitions

**Files:**
- Create: `src/constants/exportColumns.ts`
- Modify: `src/components/recibos/RecibosConsultaTabela.tsx`
- Modify: `src/components/ds/DsConsultaTabela.tsx`
- Modify: `src/components/penhoras/PenhorasConsultaTabela.tsx`

**Step 1: Create the shared constants file**

Create `src/constants/exportColumns.ts`:

```typescript
import type { ExportColumn } from '../lib/exportGenerators'

export const RECIBOS_TABLE_COLUMNS: ExportColumn[] = [
  { header: 'Tipo', key: 'tipo', width: 15 },
  { header: 'Nº Recibo', key: 'reciboNumero', width: 15 },
  { header: 'Processo', key: 'processo', width: 20 },
  { header: 'PE', key: 'pe', width: 15 },
  { header: 'Mês', key: 'mes', width: 12 },
  { header: 'Ano', key: 'ano', width: 12 },
  { header: 'Honorários', key: 'honorarios', width: 15 },
  { header: 'Custas', key: 'custas', width: 15 },
  { header: 'Iva', key: 'iva', width: 12 },
  { header: 'Exequente', key: 'exequente', width: 25 },
  { header: 'Executado', key: 'executado', width: 25 },
  { header: 'Gestor(a)', key: 'gestor', width: 20 },
  { header: 'Estado', key: 'estadoId', width: 20 },
]

export const RECIBOS_DASHBOARD_COLUMNS: ExportColumn[] = [
  { header: 'Registos Totais', key: 'registos', width: 15 },
  { header: 'Valor Emissão', key: 'valorEmissao', width: 20 },
  { header: 'Levantado c/ IVA', key: 'levantado', width: 20 },
]

export const DS_TABLE_COLUMNS: ExportColumn[] = [
  { header: 'Proponentes', key: 'proponentes', width: 30 },
  { header: 'Ref.', key: 'referencia', width: 15 },
  { header: 'Gestor(a)', key: 'gestora', width: 25 },
  { header: 'Produto', key: 'produto', width: 20 },
  { header: 'Entidade Bancária', key: 'entidadeBancaria', width: 20 },
  { header: 'Data Escritura', key: 'dataEscritura', width: 15 },
  { header: 'Valor', key: 'valor', width: 15 },
  { header: 'Comissão Loja', key: 'comissaoLoja', width: 15 },
  { header: 'Comissão Gestor', key: 'comissaoGestor', width: 15 },
  { header: 'Falta Recibo', key: 'faltaReciboGestora', width: 25 },
  { header: 'Estado', key: 'estadoId', width: 25 },
]

export const DS_DASHBOARD_COLUMNS: ExportColumn[] = [
  { header: 'Registos', key: 'registos', width: 15 },
  { header: 'Passaporte', key: 'passaporte', width: 20 },
  { header: 'Total C/Iva', key: 'totalComIva', width: 20 },
]

export const PENHORAS_TABLE_COLUMNS: ExportColumn[] = [
  { header: 'PE', key: 'pe', width: 15 },
  { header: 'Identificação', key: 'identificacao', width: 30 },
  { header: 'Pedido', key: 'pedido', width: 30 },
  { header: 'Gestor(a)', key: 'gestor', width: 20 },
  { header: 'Acto', key: 'acto', width: 20 },
  { header: 'Data do Pedido', key: 'dataPedido', width: 15 },
  { header: 'Estado', key: 'estadoId', width: 25 },
]

export const PENHORAS_DASHBOARD_COLUMNS: ExportColumn[] = [
  { header: 'Registos', key: 'registos', width: 15 },
  { header: 'Com Data Pedido', key: 'comDataPedido', width: 20 },
  { header: 'Recusados', key: 'recusados', width: 15 },
  { header: 'Pendentes', key: 'pendentes', width: 15 },
]
```

**Step 2: Update RecibosConsultaTabela.tsx to import from constants**

Replace the inline `exportColumns` definition (lines 145-159) with:

```typescript
import { RECIBOS_TABLE_COLUMNS } from '../../constants/exportColumns'
```

And change the usage from `exportColumns` to `RECIBOS_TABLE_COLUMNS` (or assign locally: `const exportColumns = RECIBOS_TABLE_COLUMNS`).

**Step 3: Same for DsConsultaTabela.tsx**

Replace inline `exportColumns` (lines 88-100) with import of `DS_TABLE_COLUMNS`.

**Step 4: Same for PenhorasConsultaTabela.tsx**

Replace inline `exportColumns` (lines 86-94) with import of `PENHORAS_TABLE_COLUMNS`.

**Step 5: Verify frontend compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/constants/exportColumns.ts src/components/recibos/RecibosConsultaTabela.tsx src/components/ds/DsConsultaTabela.tsx src/components/penhoras/PenhorasConsultaTabela.tsx
git commit -m "refactor: extract export column definitions into shared constants"
```

---

### Task 6: Upgrade exportGenerators.ts — PDF table rendering + header/footer

**Files:**
- Modify: `src/lib/exportGenerators.ts`

**Step 1: Add autotable import and upgrade exportToPdf**

At top of file, add:

```typescript
import autoTable from 'jspdf-autotable'
```

Update the `ExportData` type to include new fields:

```typescript
export type ExportData = {
  columns: ExportColumn[]
  rows: Record<string, unknown>[]
  summaryText?: string
  title?: string
  themeColor?: string
  companyName?: string
  footerText?: string
  moduleLogoSrc?: string
  orientation?: 'portrait' | 'landscape'
  maxRows?: number | 'all'
  selectedColumns?: string[]  // if provided, filter columns to these keys
}
```

Replace the entire `exportToPdf` function with an upgraded version that:

1. Uses the `orientation` field (or auto-detects from `dashboardElementId`)
2. Renders a branded header: theme color strip + company name right-aligned
3. Renders the title + date subtitle
4. Renders AI summary (if provided) — existing logic
5. Renders dashboard snapshot (if `dashboardElementId` provided) — existing logic
6. Renders a proper data table using `autoTable()` with:
   - Theme color header row (white text)
   - Alternating row colors (`#f9fafb` / `#ffffff`)
   - Column filtering via `selectedColumns`
   - Row capping via `maxRows`
   - Auto page breaks
7. Renders footer on every page: custom footer text (left) + "Página X de Y" (center) + date (right)

The full implementation should keep the existing dashboard snapshot logic intact (the `html-to-image` + `pdf.addImage` block) and add the autotable block after it.

For the footer, use `jsPDF`'s `didDrawPage` hook inside autoTable or add it manually after rendering:

```typescript
const totalPages = pdf.getNumberOfPages()
for (let i = 1; i <= totalPages; i++) {
  pdf.setPage(i)
  pdf.setFontSize(8)
  pdf.setTextColor('#9ca3af')
  if (data.footerText) {
    pdf.text(data.footerText, 40, pageHeight - 20)
  }
  pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 20, { align: 'center' })
  pdf.text(new Date().toLocaleDateString('pt-PT'), pageWidth - 40, pageHeight - 20, { align: 'right' })
}
```

**Step 2: Update exportToExcel to support column filtering and dashboard summary**

Add column filtering logic: if `data.selectedColumns` is provided, filter `data.columns` to only include those whose `key` is in the array.

Add optional dashboard summary section before the table (company name + title in merged header cells).

**Step 3: Update exportToCsv to support column filtering**

Same column filtering logic as Excel. If `selectedColumns` is set, only export those columns.

**Step 4: Verify frontend compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/exportGenerators.ts
git commit -m "feat: upgrade PDF with autotable rendering, headers, footers; add column filtering to all formats"
```

---

### Task 7: Build ExportWizard component — Step 1 (Content Selection)

**Files:**
- Create: `src/components/shared/ExportWizardSteps/ContentStep.tsx`

**Step 1: Create the ContentStep component**

```typescript
import { LayoutDashboard, Table2, Info } from 'lucide-react'

interface ContentStepProps {
  includeDashboard: boolean
  setIncludeDashboard: (v: boolean) => void
  includeTable: boolean
  setIncludeTable: (v: boolean) => void
  maxRows: 50 | 100 | 250 | 'all'
  setMaxRows: (v: 50 | 100 | 250 | 'all') => void
  dashboardName?: string
  dashboardWidgetCount: number
  tableRowCount: number
}

export function ContentStep({
  includeDashboard,
  setIncludeDashboard,
  includeTable,
  setIncludeTable,
  maxRows,
  setMaxRows,
  dashboardName,
  dashboardWidgetCount,
  tableRowCount,
}: ContentStepProps) {
  const neitherSelected = !includeDashboard && !includeTable

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <label
        className="checkbox-label"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
          padding: '14px', border: '1px solid', borderRadius: 'var(--radius-md)',
          background: includeDashboard ? 'color-mix(in oklab, var(--brand) 6%, transparent)' : 'var(--surface)',
          borderColor: includeDashboard ? 'var(--brand)' : 'var(--line)',
        }}
      >
        <input type="checkbox" checked={includeDashboard} onChange={(e) => setIncludeDashboard(e.target.checked)} />
        <LayoutDashboard size={16} />
        <div>
          <span style={{ fontWeight: 500 }}>Incluir Dashboard</span>
          {dashboardName && (
            <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', margin: '4px 0 0' }}>
              {dashboardName} — {dashboardWidgetCount} widget{dashboardWidgetCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </label>

      <label
        className="checkbox-label"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
          padding: '14px', border: '1px solid', borderRadius: 'var(--radius-md)',
          background: includeTable ? 'color-mix(in oklab, var(--brand) 6%, transparent)' : 'var(--surface)',
          borderColor: includeTable ? 'var(--brand)' : 'var(--line)',
        }}
      >
        <input type="checkbox" checked={includeTable} onChange={(e) => setIncludeTable(e.target.checked)} />
        <Table2 size={16} />
        <div>
          <span style={{ fontWeight: 500 }}>Incluir Dados da Tabela</span>
          <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', margin: '4px 0 0' }}>
            {tableRowCount} registo{tableRowCount !== 1 ? 's' : ''} filtrados
          </p>
        </div>
      </label>

      {includeTable && (
        <div className="filter-group" style={{ paddingLeft: '8px' }}>
          <label className="filter-label">Máximo de linhas no relatório</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
            {([50, 100, 250, 'all'] as const).map((opt) => (
              <button
                key={String(opt)}
                type="button"
                className={maxRows === opt ? 'primary-btn' : 'secondary-btn'}
                onClick={() => setMaxRows(opt)}
                style={{ justifyContent: 'center', fontSize: '0.85rem' }}
              >
                {opt === 'all' ? 'Todos' : opt}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Info size={12} /> Utilize filtros para uma vista mais concisa antes de exportar.
          </p>
        </div>
      )}

      {neitherSelected && (
        <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>
          Selecione pelo menos uma opção para exportar.
        </p>
      )}
    </div>
  )
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/shared/ExportWizardSteps/ContentStep.tsx
git commit -m "feat: add ContentStep component for export wizard step 1"
```

---

### Task 8: Build ExportWizard — Step 2 (Customize) + ColumnPicker

**Files:**
- Create: `src/components/shared/ExportWizardSteps/ColumnPicker.tsx`
- Create: `src/components/shared/ExportWizardSteps/CustomizeStep.tsx`

**Step 1: Create ColumnPicker**

A simple multi-select checkbox list for export columns. Receives the full column list, the currently selected keys, and an `onChange` handler.

```typescript
import type { ExportColumn } from '../../../lib/exportGenerators'

interface ColumnPickerProps {
  columns: ExportColumn[]
  selectedKeys: string[]
  onChange: (keys: string[]) => void
}

export function ColumnPicker({ columns, selectedKeys, onChange }: ColumnPickerProps) {
  const allSelected = selectedKeys.length === columns.length

  return (
    <div>
      <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => onChange(allSelected ? [] : columns.map((c) => c.key))}
        />
        <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>Selecionar todas</span>
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
        {columns.map((col) => (
          <label key={col.key} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', padding: '4px 0' }}>
            <input
              type="checkbox"
              checked={selectedKeys.includes(col.key)}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange([...selectedKeys, col.key])
                } else {
                  onChange(selectedKeys.filter((k) => k !== col.key))
                }
              }}
            />
            {col.header}
          </label>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Create CustomizeStep**

Contains: title input, company name input, column picker (if table included), orientation toggle (if PDF), footer text input.

```typescript
import type { ExportColumn } from '../../../lib/exportGenerators'
import { ColumnPicker } from './ColumnPicker'

interface CustomizeStepProps {
  title: string
  setTitle: (v: string) => void
  companyName: string
  setCompanyName: (v: string) => void
  selectedColumns: string[]
  setSelectedColumns: (keys: string[]) => void
  allTableColumns: ExportColumn[]
  includeTable: boolean
  orientation: 'portrait' | 'landscape'
  setOrientation: (v: 'portrait' | 'landscape') => void
  format: 'pdf' | 'excel' | 'csv'
  footerText: string
  setFooterText: (v: string) => void
}

export function CustomizeStep({
  title, setTitle,
  companyName, setCompanyName,
  selectedColumns, setSelectedColumns,
  allTableColumns, includeTable,
  orientation, setOrientation,
  format, footerText, setFooterText,
}: CustomizeStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="filter-group">
        <label className="filter-label">Título do Relatório</label>
        <input type="text" className="styled-input" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%' }} />
      </div>

      <div className="filter-group">
        <label className="filter-label">Nome da Empresa</label>
        <input type="text" className="styled-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex: Empresa XYZ, Lda." style={{ width: '100%' }} />
      </div>

      {format === 'pdf' && (
        <div className="filter-group">
          <label className="filter-label">Orientação da Página</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button type="button" className={orientation === 'portrait' ? 'primary-btn' : 'secondary-btn'} onClick={() => setOrientation('portrait')} style={{ justifyContent: 'center' }}>
              Retrato
            </button>
            <button type="button" className={orientation === 'landscape' ? 'primary-btn' : 'secondary-btn'} onClick={() => setOrientation('landscape')} style={{ justifyContent: 'center' }}>
              Paisagem
            </button>
          </div>
        </div>
      )}

      {includeTable && (
        <div className="filter-group">
          <label className="filter-label">Colunas a Incluir</label>
          <ColumnPicker columns={allTableColumns} selectedKeys={selectedColumns} onChange={setSelectedColumns} />
        </div>
      )}

      <div className="filter-group">
        <label className="filter-label">Texto de Rodapé (opcional)</label>
        <input type="text" className="styled-input" value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="Ex: Confidencial — Uso interno" style={{ width: '100%' }} />
      </div>
    </div>
  )
}
```

**Step 3: Verify frontend compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/shared/ExportWizardSteps/ColumnPicker.tsx src/components/shared/ExportWizardSteps/CustomizeStep.tsx
git commit -m "feat: add CustomizeStep and ColumnPicker components for export wizard step 2"
```

---

### Task 9: Build ExportWizard — Step 3 (Format & Export) + Template Save/Load

**Files:**
- Create: `src/components/shared/ExportWizardSteps/FormatStep.tsx`

**Step 1: Create FormatStep**

Contains: format picker (PDF/Excel/CSV), AI summary toggle, load template dropdown, save-as-template checkbox + name input.

```typescript
import { FileText, FileSpreadsheet, FileImage, Sparkles, Save } from 'lucide-react'
import type { ReportTemplate } from '../../../types'

interface FormatStepProps {
  format: 'pdf' | 'excel' | 'csv'
  setFormat: (v: 'pdf' | 'excel' | 'csv') => void
  useAiSummary: boolean
  setUseAiSummary: (v: boolean) => void
  templates: ReportTemplate[]
  onLoadTemplate: (template: ReportTemplate) => void
  saveAsTemplate: boolean
  setSaveAsTemplate: (v: boolean) => void
  templateName: string
  setTemplateName: (v: string) => void
  isExporting: boolean
}

export function FormatStep({
  format, setFormat,
  useAiSummary, setUseAiSummary,
  templates, onLoadTemplate,
  saveAsTemplate, setSaveAsTemplate,
  templateName, setTemplateName,
  isExporting,
}: FormatStepProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {templates.length > 0 && (
        <div className="filter-group">
          <label className="filter-label">Carregar Template</label>
          <select
            className="styled-input"
            defaultValue=""
            onChange={(e) => {
              const t = templates.find((t) => t.id === e.target.value)
              if (t) onLoadTemplate(t)
            }}
            disabled={isExporting}
            style={{ width: '100%' }}
          >
            <option value="" disabled>Selecionar template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="filter-group">
        <label className="filter-label">Formato de Exportação</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <button type="button" className={format === 'excel' ? 'primary-btn' : 'secondary-btn'} onClick={() => setFormat('excel')} style={{ justifyContent: 'center' }} disabled={isExporting}>
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button type="button" className={format === 'csv' ? 'primary-btn' : 'secondary-btn'} onClick={() => setFormat('csv')} style={{ justifyContent: 'center' }} disabled={isExporting}>
            <FileText size={16} /> CSV
          </button>
          <button type="button" className={format === 'pdf' ? 'primary-btn' : 'secondary-btn'} onClick={() => setFormat('pdf')} style={{ justifyContent: 'center' }} disabled={isExporting}>
            <FileImage size={16} /> PDF
          </button>
        </div>
      </div>

      <label
        className="checkbox-label"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', cursor: isExporting ? 'not-allowed' : 'pointer',
          padding: '14px', border: '1px solid', borderRadius: 'var(--radius-md)',
          background: useAiSummary ? 'color-mix(in oklab, var(--brand) 6%, transparent)' : 'var(--surface)',
          borderColor: useAiSummary ? 'var(--brand)' : 'var(--line)',
          opacity: isExporting ? 0.7 : 1,
        }}
      >
        <input type="checkbox" checked={useAiSummary} onChange={(e) => setUseAiSummary(e.target.checked)} disabled={isExporting} />
        <Sparkles size={16} strokeWidth={2.5} color={useAiSummary ? 'var(--brand)' : 'var(--ink-muted)'} />
        <div>
          <span style={{ fontWeight: 500, color: useAiSummary ? 'var(--brand)' : 'var(--ink)' }}>Gerar Resumo Inteligente</span>
          <p style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', margin: '4px 0 0' }}>
            Resumo executivo gerado por IA no topo do ficheiro.
          </p>
        </div>
      </label>

      <label
        className="checkbox-label"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', cursor: isExporting ? 'not-allowed' : 'pointer',
          padding: '14px', border: '1px solid', borderRadius: 'var(--radius-md)',
          background: saveAsTemplate ? 'color-mix(in oklab, var(--brand) 6%, transparent)' : 'var(--surface)',
          borderColor: saveAsTemplate ? 'var(--brand)' : 'var(--line)',
          opacity: isExporting ? 0.7 : 1,
        }}
      >
        <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} disabled={isExporting} />
        <Save size={16} />
        <span style={{ fontWeight: 500 }}>Guardar como Template</span>
      </label>

      {saveAsTemplate && (
        <div className="filter-group" style={{ paddingLeft: '8px' }}>
          <label className="filter-label">Nome do Template</label>
          <input type="text" className="styled-input" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ex: Relatório Mensal" disabled={isExporting} style={{ width: '100%' }} />
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify frontend compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/shared/ExportWizardSteps/FormatStep.tsx
git commit -m "feat: add FormatStep component for export wizard step 3"
```

---

### Task 10: Build the ExportWizard container component

**Files:**
- Create: `src/components/shared/ExportWizard.tsx`

**Step 1: Create the main wizard component**

This is the orchestrator that:
- Manages all wizard state (step, content selections, customization values, format, template state)
- Renders step indicators (1/2/3 dots or labels)
- Renders Back / Next / Export buttons
- Calls `exportToCsv`, `exportToExcel`, or `exportToPdf` with the composed `ExportData`
- Calls the AI summary API if enabled (same logic as current ExportComposer)
- Calls `onSaveTemplate` if "Save as Template" is checked
- Accepts a `defaultContent` prop to pre-check dashboard or table

The interface:

```typescript
import type { ExportColumn } from '../../lib/exportGenerators'
import type { ReportTemplate } from '../../types'

export interface ExportWizardProps {
  isOpen: boolean
  onClose: () => void
  defaultContent: 'dashboard' | 'table'
  // Module identity
  moduleId: string
  moduleName: string
  moduleLogoSrc: string
  themeColor: string
  // Table data
  tableColumns: ExportColumn[]
  tableData: Record<string, unknown>[]
  // Dashboard data
  dashboardElementId: string
  dashboardSummaryColumns: ExportColumn[]
  dashboardSummaryData: Record<string, unknown>[]
  dashboardName?: string
  dashboardWidgetCount: number
  // Templates
  templates: ReportTemplate[]
  onSaveTemplate: (t: Pick<ReportTemplate, 'name' | 'module' | 'settings'>) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
}
```

The component renders inside the same `record-modal-overlay` / `record-modal` shell that ExportComposer used, with:

- A step indicator bar at the top (3 numbered circles with connecting lines, active step highlighted with theme color)
- The active step component (ContentStep / CustomizeStep / FormatStep)
- A footer with Back (hidden on step 1) / Next / Export (on step 3) buttons
- Error display area
- Loading spinner during export

State initialization:
- `step`: starts at 1
- `includeDashboard`: `defaultContent === 'dashboard'`
- `includeTable`: `defaultContent === 'table'`
- `maxRows`: `100`
- `format`: `'excel'`
- `title`: `${moduleName} — ${new Date().toLocaleDateString('pt-PT')}`
- `companyName`: `''` (or from last used template)
- `orientation`: `'portrait'`
- `selectedColumns`: all column keys
- `footerText`: `''`
- `useAiSummary`: `false`
- `saveAsTemplate`: `false`
- `templateName`: `''`

On "Load Template": populate all state fields from `template.settings`.

On "Export": compose the `ExportData` object from state and call the appropriate `exportTo*` function. If `saveAsTemplate` is checked and `templateName` is non-empty, call `onSaveTemplate` after successful export.

**Step 2: Verify frontend compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/shared/ExportWizard.tsx
git commit -m "feat: add ExportWizard container component with 3-step flow"
```

---

### Task 11: Wire ExportWizard into App.tsx + remove old ExportComposer instances

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/recibos/RecibosDashboards.tsx`
- Modify: `src/components/recibos/RecibosConsultaTabela.tsx`
- Modify: `src/components/ds/DsDashboards.tsx`
- Modify: `src/components/ds/DsConsultaTabela.tsx`
- Modify: `src/components/penhoras/PenhorasDashboards.tsx`
- Modify: `src/components/penhoras/PenhorasConsultaTabela.tsx`
- Delete: `src/components/shared/ExportComposer.tsx`

**Step 1: Add template state + fetching to App.tsx**

In App.tsx, add state for report templates per module:

```typescript
const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([])
```

Fetch templates on mount (alongside existing bootstrap data):

```typescript
api.getReportTemplates().then(setReportTemplates).catch(console.error)
```

Add handlers for saving/deleting templates:

```typescript
async function handleSaveTemplate(payload: Pick<ReportTemplate, 'name' | 'module' | 'settings'>) {
  const created = await api.createReportTemplate(payload)
  setReportTemplates((prev) => [created, ...prev])
}

async function handleDeleteTemplate(id: string) {
  await api.deleteReportTemplate(id)
  setReportTemplates((prev) => prev.filter((t) => t.id !== id))
}
```

**Step 2: Add ExportWizard state + rendering per module**

For each module, add an export wizard state:

```typescript
const [recibosExportOpen, setRecibosExportOpen] = useState(false)
const [recibosExportDefault, setRecibosExportDefault] = useState<'dashboard' | 'table'>('dashboard')
```

Same for DS and Penhoras.

Render one `ExportWizard` per module in the JSX, passing the unified props (table data, dashboard data, columns from constants, templates filtered by module, etc.).

**Step 3: Update Dashboard components**

In each dashboard component (RecibosDashboards, DsDashboards, PenhorasDashboards):
- Remove the `ExportComposer` import and JSX
- Remove the local `isExportOpen` state
- Change the Download button's onClick to call a new prop: `onOpenExport: () => void`

The prop is wired in App.tsx to set the module's export open state with `defaultContent: 'dashboard'`.

**Step 4: Update Table components**

In each table component (RecibosConsultaTabela, DsConsultaTabela, PenhorasConsultaTabela):
- Remove the `ExportComposer` import and JSX
- Remove the local `isExportOpen` state
- Change the Download button's onClick to call a new prop: `onOpenExport: () => void`

The prop is wired in App.tsx to set the module's export open state with `defaultContent: 'table'`.

**Step 5: Delete ExportComposer.tsx**

Run: `rm src/components/shared/ExportComposer.tsx`

**Step 6: Verify everything compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire ExportWizard into all modules, remove ExportComposer"
```

---

### Task 12: Manual verification + final polish

**Step 1: Start the dev servers**

Run web dev server and API server.

**Step 2: Test each module's export wizard**

For each module (Recibos, DS, Penhoras):
1. Click Download from Dashboard — verify wizard opens with "Include Dashboard" pre-checked
2. Click Download from Table — verify wizard opens with "Include Table" pre-checked
3. Step through all 3 wizard steps
4. Export as PDF with dashboard + table — verify the PDF has header, dashboard snapshot, data table, footer
5. Export as Excel with column selection — verify only selected columns appear
6. Export as CSV — verify column filtering works
7. Save as template — verify template appears in the Load Template dropdown
8. Load a template — verify all fields populate correctly

**Step 3: Test edge cases**
- Export with AI summary enabled
- Export with 0 table rows (dashboard only)
- Export with "All" rows selected
- Template created by one user visible to another (if multi-user testing possible)

**Step 4: Fix any issues found during testing**

**Step 5: Final commit if any polish changes were needed**

```bash
git add -A
git commit -m "fix: export wizard polish from manual testing"
```
