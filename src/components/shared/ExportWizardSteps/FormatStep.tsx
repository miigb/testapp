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
