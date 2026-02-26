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
