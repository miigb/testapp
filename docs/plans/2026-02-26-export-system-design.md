# Export System Redesign — Design Document

**Date:** 2026-02-26
**Branch:** `codex/dashboard-redesign-experiment`
**Status:** Approved

## Goal

Replace the single-screen ExportComposer with a 3-step Export Wizard that produces professional, customizable reports in PDF, Excel, and CSV. Users can combine dashboard snapshots with table data in a single export, choose which columns to include, set max row limits, and save their configuration as reusable report templates shared across all users.

## Current State

- **ExportComposer** — shared modal with format picker (Excel/CSV/PDF) + optional AI summary (Gemini)
- **exportGenerators.ts** — CSV (proper escaping, BOM), Excel (ExcelJS with branded headers), PDF (jsPDF with theme color header, title, summary, dashboard screenshot via `html-to-image`)
- Used in all 3 modules: Recibos, DS, Penhoras — both dashboard and table views (6 instances total)
- Dashboard PDF captures DOM as screenshot + renders summary cards
- Table PDF has **no actual table rendering** — just a note saying "use CSV/Excel"
- Dashboard and table exports are **separate** — no way to combine them
- Libraries: `exceljs`, `jspdf`, `html-to-image`

## Architecture: 3-Step Export Wizard

### Step 1 — Content Selection

- Checkboxes: "Include Dashboard Snapshot", "Include Table Data" (at least one required)
- If table data checked: dropdown for max rows (50 / 100 / 250 / All) with hint: "Utilize filtros para uma vista mais concisa"
- If dashboard checked: shows active dashboard info (name, widget count)

### Step 2 — Customize

- Report title (text input, pre-filled: `{moduleName} — {date}`)
- Company name (text input, remembered via template)
- Module logo included automatically from `moduleCards.logoSrc`
- Column picker (multi-select checkboxes, only shown if table data included)
- Page orientation toggle: Portrait / Landscape (PDF only, hidden for CSV/Excel)
- Optional footer text

### Step 3 — Format & Export

- Format picker: PDF / Excel / CSV (3-button grid, same pattern as current)
- AI summary toggle (existing Gemini integration)
- "Save as Template" checkbox + template name field
- Load template dropdown (if templates exist for this module)
- Export button

Wizard uses `step` state (1/2/3) with Back/Next buttons and step indicators.

## Report Templates — Data Model

### New DB table: `report_templates`

| Column       | Type         | Description                                    |
|-------------|-------------|------------------------------------------------|
| `id`        | UUID         | Primary key                                    |
| `name`      | VARCHAR(100) | Template name (e.g., "Relatório Mensal")       |
| `module`    | VARCHAR(20)  | `recibos` / `ds` / `penhoras`                  |
| `created_by`| UUID         | FK to users table                              |
| `settings`  | JSONB        | All wizard options serialized                  |
| `created_at`| TIMESTAMP    |                                                |
| `updated_at`| TIMESTAMP    |                                                |

### Settings JSONB shape

```json
{
  "includeDashboard": true,
  "includeTable": true,
  "maxRows": 100,
  "format": "pdf",
  "title": "Relatório Mensal Recibos",
  "companyName": "Empresa XYZ",
  "orientation": "landscape",
  "footerText": "Confidencial",
  "selectedColumns": ["nRecibo", "valor", "estado", "data"],
  "useAiSummary": false
}
```

### API endpoints

| Method   | Route                             | Description                  |
|----------|-----------------------------------|------------------------------|
| `GET`    | `/api/report-templates?module=X`  | List templates for a module  |
| `POST`   | `/api/report-templates`           | Create template              |
| `PUT`    | `/api/report-templates/:id`       | Update template              |
| `DELETE`  | `/api/report-templates/:id`       | Delete template              |

All users can see all templates (shared). Only creator or admins can edit/delete.

## PDF Rendering Upgrade

### Page structure (combined export)

1. **Header bar** — theme color strip + module logo (`logoSrc`) + company name text right-aligned
2. **Report title** — large bold text + date subtitle
3. **AI Summary** — if enabled (existing feature)
4. **Dashboard snapshot** — `html-to-image` capture (existing), scaled to fit page width
5. **Table section** — `jspdf-autotable` plugin:
   - Branded header row (theme color bg, white text — matches Excel)
   - Alternating row backgrounds
   - Auto page breaks
   - Only selected columns rendered
   - Row count capped per user choice
6. **Footer** — custom text + "Página X de Y" + export date

### Excel improvements

- Column selection (only export chosen columns)
- Dashboard summary row at top when dashboard included
- Company name + report title in header section

### CSV improvements

- Column selection applied
- Dashboard summary prepended as header rows when included

### New dependency

`jspdf-autotable` — standard jsPDF plugin for table rendering with column widths, page breaks, cell wrapping.

## Integration: One Wizard Per Module

The Export Wizard needs access to **both** dashboard and table data simultaneously.

- **From Dashboard view:** wizard opens with "Include Dashboard" pre-checked. Table data comes from the module's existing filtered records in state.
- **From Table view:** wizard opens with "Include Table" pre-checked. Dashboard element ID is passed so snapshot can be captured (dashboard DOM is always mounted).

**One ExportWizard per module** — mounted at the module level in `App.tsx`, not inside Dashboard/Table components. Both Download buttons call the same `setExportOpen(true)` with a hint for which checkbox to pre-check.

### ExportWizard props

```typescript
interface ExportWizardProps {
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
  // Templates
  templates: ReportTemplate[]
  onSaveTemplate: (template: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
}
```

Column definitions extracted into `src/constants/exportColumns.ts` per module.

## File Map

### New files

- `src/components/shared/ExportWizard.tsx` — main wizard container
- `src/components/shared/ExportWizardSteps/ContentStep.tsx` — Step 1
- `src/components/shared/ExportWizardSteps/CustomizeStep.tsx` — Step 2
- `src/components/shared/ExportWizardSteps/FormatStep.tsx` — Step 3
- `src/components/shared/ExportWizardSteps/ColumnPicker.tsx` — multi-select column checkboxes
- `src/constants/exportColumns.ts` — per-module column definitions
- `server/routes/reportTemplates.ts` — CRUD API endpoints
- `server/migrations/XXX-create-report-templates.sql` — DB migration

### Modified files

- `src/lib/exportGenerators.ts` — add autotable rendering, column filtering, logo header, page footer
- `src/components/recibos/RecibosDashboards.tsx` — remove ExportComposer
- `src/components/ds/DsDashboards.tsx` — remove ExportComposer
- `src/components/penhoras/PenhorasDashboards.tsx` — remove ExportComposer
- `src/components/recibos/RecibosConsultaTabela.tsx` — remove ExportComposer
- `src/components/ds/DsConsultaTabela.tsx` — remove ExportComposer
- `src/components/penhoras/PenhorasConsultaTabela.tsx` — remove ExportComposer
- `src/App.tsx` — mount one ExportWizard per module, pass unified props
- `package.json` — add `jspdf-autotable`

### Deleted files

- `src/components/shared/ExportComposer.tsx` — replaced by ExportWizard

### Unchanged

- `src/hooks/useNotesExport.ts` — notes export is separate (different purpose)
