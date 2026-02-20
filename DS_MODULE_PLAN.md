# DS Module Plan (Formal)

Last updated: 2026-02-19
Owner: Product + Engineering
Status: Planning (no implementation yet)

## 1. Objective
Add a new top-level `DS` module inside Mesa de Recibos that is fully isolated from the existing receipts module, with its own:
- data model,
- statuses,
- import pipeline,
- views/dashboards,
- branding (logo/colors/theme accents to be provided later).

This phase is planning only.

## 2. Confirmed Product Decisions
1. `DS` will have its **own statuses** (independent from current module statuses).
2. `RECIBOS PEDIDOS - LIDER CALCULO` workflow/tab is **out of scope** and removed from DS plan.
3. `DS` must be a **top-level module** with easy access and independent visual identity.

## 3. Scope

### In scope (MVP)
- Top-level module switch: `Recibos` / `DS`.
- DS module pages:
  - `Entrada DS` (new/edit record),
  - `Consulta DS`,
  - `Tabela DS`,
  - `Importar DS`,
  - `Dashboards DS`,
  - `Configuração DS`.
- Import from `/Users/miguelbrito/Downloads/DS.xlsx`, sheet:
  - `ESCRITURAS CONCRETIZADAS`.
- DS statuses lifecycle and config UI.
- DS saved views, DS filters, DS totals, DS dashboard widgets.
- Hard data isolation from current module.

### Out of scope (for now)
- Any data sharing with current receipts module.
- `RECIBOS PEDIDOS - LIDER CALCULO` tab and workflow.
- Cross-module reporting.
- External integrations/webhooks/auth redesign.

## 4. Data Isolation Rules (Hard Requirements)
1. DS uses its own DB tables (prefix: `ds_`).
2. DS API routes use `/api/ds/*`.
3. DS saved views are DS-only (scope isolation enforced in backend).
4. DS search, filters, exports, dashboard queries are DS-only.
5. No joins, no writes, no reads between DS and existing receipts domain.
6. Import processors are separate (no reuse of receipt-specific import logic except generic UI components).

## 5. Source Data Contract (DS.xlsx)

## 5.1 Active source sheet
- `ESCRITURAS CONCRETIZADAS`

## 5.2 Planned field mapping (raw + normalized)
Input columns identified:
- `GESTORA`
- `PROPONENTES`
- `REFERÊNCIA`
- `PRODUTO`
- `VALOR`
- `DATA ESCRITURA`
- `ENTIDADE BANCÁRIA`
- `DATA FECHO CRM`
- `LIDER CALCULO`
- `COMISSÃO LOJA`
- `IVA CGD`
- `TOTAL COMISSÃO LOJA CM IVA`
- `COMISSÃO GESTOR`
- `PERCENTAGEM`
- `PAG. COMISSÃO GESTOR`
- `RECIBO`
- `FALTA RECIBO GESTORA`

Storage strategy:
- Keep `raw_*` text fields for traceability.
- Keep normalized typed fields for filtering/metrics (decimal/date/enums where possible).

Examples of normalization needs:
- `VALOR`: values like `65200€ + 30000€` must normalize to numeric total.
- `COMISSÃO GESTOR`: values like `TOTAL: 617,18€` must normalize to numeric.
- `IVA CGD`: mixed semantic values (`SEM IVA`, `TOTAL LEVANTADO`, numeric).

## 6. DS Domain Model (Proposed)

## 6.1 Primary entity: `ds_records`
Core columns (proposed):
- `id` (uuid)
- `gestora`
- `proponentes`
- `referencia` (index)
- `produto`
- `entidade_bancaria`
- `lider_calculo`
- `recibo`
- `falta_recibo_gestora`

Dates:
- `data_escritura` (date)
- `data_fecho_crm` (date)
- `pag_comissao_gestor` (date, nullable)

Numeric fields:
- `valor` (decimal)
- `comissao_loja` (decimal)
- `total_comissao_loja_cm_iva` (decimal)
- `comissao_gestor` (decimal)
- `percentagem` (decimal)

Tax semantic fields:
- `iva_cgd_raw` (text)
- `iva_cgd_valor` (decimal, nullable)
- `iva_cgd_tipo` (enum: `sem_iva`, `total_levantado`, `valor`, `outro`)

Status:
- `status_id` (FK to `ds_statuses`)

Import metadata:
- `source_file`
- `source_sheet`
- `source_row_number`
- `import_batch_id`
- `created_at`
- `updated_at`

Raw snapshot:
- `raw_payload` (jsonb/text) for auditability.

## 6.2 Configuration/support entities
- `ds_statuses`
- `ds_saved_views`
- `ds_import_batches`
- `ds_import_conflicts`
- (optional later) `ds_calculation_settings` if DS gets configurable fiscal rules.

## 7. DS Statuses (Independent Lifecycle)
Initial baseline statuses (to refine with business):
1. `Novo`
2. `Em validação`
3. `Aguarda pagamento banco`
4. `Recibo emitido`
5. `Concluído`
6. `Bloqueado`

Rules:
- Managed only in DS Config.
- DS status IDs never reused by receipts module.
- Import can set initial status by rule/mapping (default: `Novo`).

## 8. Import Pipeline (DS-only)

## 8.1 MVP flow
1. Upload `.xlsx`.
2. Parse only `ESCRITURAS CONCRETIZADAS`.
3. Show preview:
  - total rows,
  - valid rows,
  - invalid rows,
  - conflicts.
4. Conflict strategy:
  - `skip`,
  - `update`,
  - `duplicate`.
5. Commit with import summary.

## 8.2 Conflict identity (proposed key)
Primary unique key candidate:
- `referencia + data_escritura + gestora`

Fallback (when reference quality is poor):
- hash of core business fields (`gestora`, `proponentes`, `produto`, `valor`, `data_escritura`).

## 8.3 Validation rules
- Reject rows with missing mandatory business identifiers (`referencia` and/or `proponentes` based on final policy).
- Parse and normalize numeric fields with pt-PT tolerant parser.
- Keep original raw strings even when normalized parsing fails.

## 9. DS UI/UX Plan

## 9.1 Top-level module navigation
- Add module switch in top navigation:
  - `Recibos` (existing),
  - `DS` (new).
- DS uses its own:
  - logo slot,
  - palette tokens,
  - accent styles (to be plugged later).

## 9.2 DS pages
- `Entrada DS`: create/edit DS record with suggestions and status.
- `Consulta DS`: card/list view optimized for quick review.
- `Tabela DS`: dense table with filters and inline status/edit actions.
- `Importar DS`: upload/preview/conflict management.
- `Dashboards DS`: DS-specific KPIs/charts with draggable/resizable widgets.
- `Configuração DS`: statuses, import defaults, display preferences.

## 9.3 DS filters (MVP)
- Gestora
- Entidade bancária
- Produto
- Status
- Ano/mês (from `data_escritura`)
- Recibo missing/present
- Text search (`referencia`, `proponentes`, `recibo`)

## 10. DS Dashboard Metrics (MVP)
- Total registos
- Total valor
- Total comissão loja
- Total comissão gestor
- % com recibo
- % sem recibo
- Top gestoras
- Top entidades bancárias
- Distribuição por status
- Tendência mensal (data escritura)

All widgets operate strictly on DS filtered dataset.

## 11. API Surface (Proposed)
Namespace: `/api/ds`
- `GET /bootstrap`
- `GET /records`
- `POST /records`
- `GET /records/:id`
- `PATCH /records/:id`
- `PATCH /records/:id/status`
- `POST /records/bulk/update`
- `POST /import/preview`
- `POST /import/commit`
- `GET /analytics/summary`
- `GET /saved-views`
- `POST /saved-views`
- `PATCH /saved-views/:id`
- `DELETE /saved-views/:id`
- `GET /statuses`
- `POST /statuses`
- `PATCH /statuses/:id`
- `DELETE /statuses/:id`

## 12. Non-Functional Requirements
- Performance:
  - list/filter response under 500ms for expected dataset size.
- Reliability:
  - import operations tracked with batch IDs and recoverable summaries.
- Auditability:
  - keep raw import payload and row-level provenance.
- Security:
  - same auth boundary as existing app (until auth model evolves).

## 13. Rollout Plan

### Phase 0: Design + contracts
- Finalize DS schema and import mapping.
- Finalize DS statuses baseline.
- Finalize API request/response contracts.

### Phase 1: Data + import foundation
- Create DB tables and Prisma models for DS.
- Implement DS import preview/commit.
- Store DS records with raw + normalized fields.

### Phase 2: Core DS UI
- Add top-level module switch and DS shell.
- Implement DS Consulta/Tabela/Entrada.
- Implement DS statuses configuration.

### Phase 3: DS dashboards + saved views
- DS analytics endpoint + dashboard widgets.
- DS saved views and filter persistence.
- Bulk update/status actions.

### Phase 4: QA + hardening
- End-to-end QA with DS.xlsx variants.
- Validate strict data isolation.
- Performance pass and UX polish.

## 14. Acceptance Criteria (MVP)
1. DS module is visible and reachable at top-level navigation.
2. Importing DS.xlsx populates only DS tables.
3. Existing receipts module data and views remain unchanged.
4. DS statuses are editable and independent.
5. DS filters and saved views work only on DS dataset.
6. DS dashboard widgets reflect DS filters correctly.
7. No cross-module data leakage in API responses.

## 15. Risks and Mitigations
- Risk: inconsistent Excel formatting over time.
  - Mitigation: robust parser + raw field retention + import warnings.
- Risk: duplicate detection false positives/negatives.
  - Mitigation: configurable conflict keys + preview before commit.
- Risk: module complexity growth in single frontend.
  - Mitigation: explicit domain folders/components and route boundaries.

## 16. Open Items (for next planning pass)
1. Final DS status labels/order/colors/icons.
2. Exact mandatory fields policy for DS record validity.
3. Final DS branding assets (logo/colors/typography accents).
4. Whether DS needs its own “totals selector” UX identical to receipts module.
