# Admin Column Management — Design Document

> Created: 2026-02-27
> Status: Approved — Ready for implementation

---

## Overview

Admin-only table column management system across all 3 modules (Recibos, DS, Penhoras). Admins control which columns are visible, their display names, ordering, and can add custom columns via import. Configuration is independent per view (table grid vs record detail).

---

## Understanding Summary

- **What:** Config-driven column system replacing hardcoded table columns
- **Why:** Give admins control over displayed data per view, support custom columns from imports, clean up cluttered tables
- **Who:** Admin users only (ADMIN role), affects what all users see
- **Key Capabilities:**
  - Hide/show columns (soft delete — data preserved)
  - Rename columns (display label override, data key unchanged)
  - Reorder columns (drag or positional)
  - Add columns via import mapping (Excel/CSV extra columns)
  - Reference columns — imported columns that link to existing record fields
  - Per-view configuration (table grid vs record detail)
  - Permanent column deletion (future phase)
- **Non-goals (for now):** Per-user column preferences, computed/formula columns, manual column creation without import, column width customization

---

## Data Model

### New: `ColumnConfig`

```prisma
model ColumnConfig {
  id              String   @id @default(cuid())
  module          String   // "recibos" | "ds" | "penhoras"
  view            String   // "table" | "detail"
  key             String   // field key — e.g. "tipo", "reciboNumero", "custom_xyz"
  label           String   // display name (rename support)
  type            String   // "string" | "number" | "date" | "currency" | "select"
  visible         Boolean  @default(true)
  position        Int      // ordering
  isCustom        Boolean  @default(false) // true for import-created columns
  isReference     Boolean  @default(false) // true if relational key
  referenceConfig Json?    // e.g. { "matchField": "processo" }
  createdById     Int
  createdBy       User     @relation(fields: [createdById], references: [id])
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([module, view, key])
  @@index([module, view])
}
```

### Extend Existing Record Models

```prisma
// Add to Record, DsRecord, PenhorasRecord:
customFields  Json?  @default("{}")
```

Custom column data keyed by ColumnConfig `key`: `{ "custom_xyz": "some value" }`

### Seeding

A seed script creates default ColumnConfig rows for all existing hardcoded columns across 3 modules × 2 views. This is the migration from hardcoded → config-driven.

---

## Backend API

### Admin Routes (requireAdmin middleware)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/columns/:module/:view` | All ColumnConfigs for module+view (including hidden) |
| `PATCH` | `/api/admin/columns/:id` | Update single column (label, visible, position) |
| `PATCH` | `/api/admin/columns/reorder` | Bulk update positions `[{ id, position }]` |
| `POST` | `/api/admin/columns/:module/:view` | Create custom column (from import mapping) |
| `POST` | `/api/admin/columns/from-import` | Discover unmapped columns from uploaded file |
| `DELETE` | `/api/admin/columns/:id` | Future: permanent delete (returns 501 for now) |

### Public Route (all authenticated users)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/columns/:module/:view` | Visible columns only, ordered by position |

### Import Extension

Existing import routes gain an extra step:
1. Admin uploads file → server returns discovered columns not in current config
2. Admin selects columns to add, sets labels, marks reference columns
3. Server creates ColumnConfig entries
4. On import commit, extra column data populates `customFields`

---

## Frontend Architecture

### Shared Hook: `useColumnConfig(module, view)`

- Fetches `GET /api/columns/:module/:view` on mount
- Returns `{ columns, isLoading }`
- Cached per module+view, invalidated on admin changes
- All table and detail components consume this hook

### Config-Driven Table Rendering

```tsx
// Header
columns.map(col => <th key={col.key}>{col.label}</th>)

// Body
columns.map(col => (
  <td>{col.isCustom ? record.customFields?.[col.key] : record[col.key]}</td>
))
```

### Cell Renderer Registry

Each module defines a map of specialized renderers:

```tsx
const recibosRenderers: Record<string, (value: any, record: Record) => ReactNode> = {
  tipo: (v) => <TipoBadge tipo={v} />,
  estado: (v) => <StatusBadge status={v} />,
  semIva: (v) => formatCurrency(v),
  // ... other specialized columns
}
```

Columns not in the registry use a default text renderer.

### Detail View

Same pattern — reads `useColumnConfig(module, 'detail')` and renders fields in configured order.

### Export Integration

Export column picker and generators read from column config, respecting admin visibility settings.

---

## Admin UI

### Quick Actions (Right-Click Column Header)

Context menu (admin-only):
- **Ocultar coluna** — PATCH visible: false
- **Renomear** — inline edit popover
- **Mover para...** — submenu: Início, Fim, or position

### Full Management Panel (Gear Icon in Table Toolbar)

Slide-over drawer (admin-only, renders alongside table):

- **View switcher tabs:** "Tabela" | "Detalhe"
- **Column list:** All columns (including hidden), each row has:
  - Drag handle for reorder
  - Eye icon toggle (visible/hidden)
  - Editable label
  - "Custom" / "Ref" badges for import columns
- **"Adicionar via Import" button** — sub-flow:
  1. Upload Excel/CSV
  2. Server returns discovered extra columns
  3. Admin selects, labels, marks references
  4. Confirm → ColumnConfig rows created
- **Hidden columns section** — collapsed group at bottom with restore buttons

---

## Decisions

| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| 1 | Soft hide only (no permanent delete now) | True deletion, archive | Data model needs to be proven first |
| 2 | Import-driven column creation | Manual creation, both | Aligns with existing import workflow |
| 3 | Per-view config (table + detail) | Global, per-user | Two views have different display needs |
| 4 | Quick actions + full panel | Header-only, admin panel only | Fast for common actions, panel for complex ops |
| 5 | Config-driven system (Approach A) | Overlay (B), TanStack Table (C) | Best balance of effort vs extensibility |
| 6 | Global per-module config | Per-user preferences | Simpler model, per-user can layer later |
| 7 | customFields JSON on records | New Prisma columns, separate table | Flexible for dynamic columns without migrations |
| 8 | Cell renderer registry per module | Generic auto-renderer | Modules need specialized formatting |

---

## Assumptions

- Column configs are global per module — admin changes affect all users
- Renaming changes display label only, not data keys
- Export column picker respects visibility settings
- Keyboard shortcuts unaffected
- Seeding creates default configs matching current hardcoded columns
- customFields defaults to empty object `{}`

---

## Implementation Phases

### Phase 1: Foundation
- Prisma schema (ColumnConfig model + customFields on records)
- Seed script for default columns
- Backend CRUD routes
- `useColumnConfig` hook
- Refactor one table (Recibos) to config-driven

### Phase 2: All Modules
- Refactor DS and Penhoras tables to config-driven
- Refactor detail views for all 3 modules
- Wire export system to column config

### Phase 3: Admin UI
- Column management drawer panel
- Right-click context menu on column headers
- View switcher (table/detail)
- Drag-to-reorder

### Phase 4: Import Integration
- Column discovery from uploaded files
- Reference column mapping UI
- customFields population on import commit

### Phase 5 (Future): Permanent Deletion
- Enable DELETE endpoint
- Confirmation flow with data loss warnings
- Data cleanup for customFields
