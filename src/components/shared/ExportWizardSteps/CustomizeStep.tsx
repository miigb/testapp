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
