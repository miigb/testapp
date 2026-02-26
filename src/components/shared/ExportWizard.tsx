import { useState } from 'react'
import { X, Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from '../../lib/exportGenerators'
import type { ExportData } from '../../lib/exportGenerators'
import type { ReportTemplate, ReportTemplateSettings } from '../../types'
import { ContentStep } from './ExportWizardSteps/ContentStep'
import { CustomizeStep } from './ExportWizardSteps/CustomizeStep'
import { FormatStep } from './ExportWizardSteps/FormatStep'

export interface ExportWizardProps {
  isOpen: boolean
  onClose: () => void
  defaultContent: 'dashboard' | 'table'
  moduleId: string
  moduleName: string
  moduleLogoSrc: string
  themeColor: string
  tableColumns: ExportColumn[]
  tableData: Record<string, unknown>[]
  dashboardElementId: string
  dashboardSummaryColumns: ExportColumn[]
  dashboardSummaryData: Record<string, unknown>[]
  dashboardName?: string
  dashboardWidgetCount: number
  templates: ReportTemplate[]
  onSaveTemplate: (t: Pick<ReportTemplate, 'name' | 'module' | 'settings'>) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
}

const STEP_LABELS = ['Conte\u00fado', 'Personalizar', 'Formato']

export function ExportWizard({
  isOpen,
  onClose,
  defaultContent,
  moduleId,
  moduleName,
  moduleLogoSrc,
  themeColor,
  tableColumns,
  tableData,
  dashboardElementId,
  dashboardSummaryColumns,
  dashboardSummaryData,
  dashboardName,
  dashboardWidgetCount,
  templates,
  onSaveTemplate,
  onDeleteTemplate: _onDeleteTemplate,
}: ExportWizardProps) {
  // Step state
  const [step, setStep] = useState(1)

  // Step 1: Content
  const [includeDashboard, setIncludeDashboard] = useState(defaultContent === 'dashboard')
  const [includeTable, setIncludeTable] = useState(defaultContent === 'table')
  const [maxRows, setMaxRows] = useState<50 | 100 | 250 | 'all'>(100)

  // Step 2: Customize
  const [title, setTitle] = useState(`${moduleName} \u2014 ${new Date().toLocaleDateString('pt-PT')}`)
  const [companyName, setCompanyName] = useState('')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [selectedColumns, setSelectedColumns] = useState<string[]>(tableColumns.map((c) => c.key))
  const [footerText, setFooterText] = useState('')

  // Step 3: Format
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>('excel')
  const [useAiSummary, setUseAiSummary] = useState(false)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const neitherSelected = !includeDashboard && !includeTable
  const canAdvanceStep1 = !neitherSelected
  const canExport = canAdvanceStep1 && !isExporting

  function handleLoadTemplate(template: ReportTemplate) {
    const s = template.settings
    setIncludeDashboard(s.includeDashboard)
    setIncludeTable(s.includeTable)
    setMaxRows(s.maxRows)
    setFormat(s.format)
    setTitle(s.title)
    setCompanyName(s.companyName || '')
    setOrientation(s.orientation || 'portrait')
    setFooterText(s.footerText || '')
    setSelectedColumns(s.selectedColumns.length > 0 ? s.selectedColumns : tableColumns.map((c) => c.key))
    setUseAiSummary(s.useAiSummary)
  }

  async function handleExport() {
    setIsExporting(true)
    setError(null)
    try {
      let summaryText: string | undefined

      // AI summary (same pattern as old ExportComposer)
      if (useAiSummary) {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/ai/summary`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moduleName,
            contextData: {
              totalRecords: tableData.length,
              sample: tableData.slice(0, 50),
            },
          }),
        })
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || 'Falha ao comunicar com o servidor de IA.')
        }
        const resData = await response.json()
        summaryText = resData.summary
      }

      const filename = `${moduleName.toLowerCase().replace(/\s+/g, '_')}_export_${new Date().toISOString().slice(0, 10)}`

      // If dashboard is included, export it as PDF with dashboard snapshot
      if (includeDashboard && format === 'pdf') {
        const dashExportData: ExportData = {
          title,
          columns: includeTable ? tableColumns : dashboardSummaryColumns,
          rows: includeTable ? tableData : dashboardSummaryData,
          summaryText,
          themeColor,
          companyName: companyName || undefined,
          footerText: footerText || undefined,
          moduleLogoSrc,
          orientation,
          maxRows: includeTable ? maxRows : undefined,
          selectedColumns: includeTable ? selectedColumns : undefined,
        }
        await exportToPdf(dashExportData, filename, dashboardElementId)
      } else if (includeDashboard && !includeTable) {
        // Dashboard-only in non-PDF format: export summary data
        const dashExportData: ExportData = {
          title,
          columns: dashboardSummaryColumns,
          rows: dashboardSummaryData,
          summaryText,
          themeColor,
          companyName: companyName || undefined,
          footerText: footerText || undefined,
        }
        if (format === 'excel') await exportToExcel(dashExportData, filename)
        else await exportToCsv(dashExportData, filename)
      } else {
        // Table data (possibly with dashboard for PDF handled above)
        const tableExportData: ExportData = {
          title,
          columns: tableColumns,
          rows: tableData,
          summaryText,
          themeColor,
          companyName: companyName || undefined,
          footerText: footerText || undefined,
          moduleLogoSrc,
          orientation,
          maxRows,
          selectedColumns,
        }
        if (format === 'csv') await exportToCsv(tableExportData, filename)
        else if (format === 'excel') await exportToExcel(tableExportData, filename)
        else await exportToPdf(tableExportData, filename)
      }

      // Save template if requested
      if (saveAsTemplate && templateName.trim()) {
        const settings: ReportTemplateSettings = {
          includeDashboard,
          includeTable,
          maxRows,
          format,
          title,
          companyName: companyName || undefined,
          orientation,
          footerText: footerText || undefined,
          selectedColumns,
          useAiSummary,
        }
        await onSaveTemplate({ name: templateName.trim(), module: moduleId, settings })
      }

      onClose()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Erro inesperado durante a exporta\u00e7\u00e3o.')
    } finally {
      setIsExporting(false)
    }
  }

  const moduleTemplates = templates.filter((t) => t.module === moduleId)

  return (
    <div className="record-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="record-modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <header className="drawer-header">
          <div className="modal-title-block">
            <h3>Exportar {moduleName}</h3>
            <p className="modal-meta" style={{ color: 'var(--ink-muted)' }}>
              Passo {step} de 3 &mdash; {STEP_LABELS[step - 1]}
            </p>
          </div>
          <button className="subtle-btn icon-btn" onClick={onClose} disabled={isExporting}>
            <X size={18} />
          </button>
        </header>

        {/* Step Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', padding: '16px 24px 8px' }}>
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1
            const isActive = stepNum === step
            const isCompleted = stepNum < step
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8rem', fontWeight: 600,
                    background: isActive ? themeColor : isCompleted ? themeColor : 'var(--surface)',
                    color: isActive || isCompleted ? '#fff' : 'var(--ink-muted)',
                    border: isActive ? 'none' : isCompleted ? 'none' : '2px solid var(--line)',
                    opacity: isCompleted ? 0.7 : 1,
                  }}
                >
                  {stepNum}
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div style={{ width: 40, height: 2, background: isCompleted ? themeColor : 'var(--line)', opacity: isCompleted ? 0.5 : 1 }} />
                )}
              </div>
            )
          })}
        </div>

        <div className="record-edit-content">
          {error && (
            <div style={{
              padding: '10px', marginBottom: '12px',
              background: 'color-mix(in oklab, var(--danger) 15%, transparent)',
              color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem',
              border: '1px solid color-mix(in oklab, var(--danger) 30%, transparent)',
            }}>
              {error}
            </div>
          )}

          {step === 1 && (
            <ContentStep
              includeDashboard={includeDashboard}
              setIncludeDashboard={setIncludeDashboard}
              includeTable={includeTable}
              setIncludeTable={setIncludeTable}
              maxRows={maxRows}
              setMaxRows={setMaxRows}
              dashboardName={dashboardName}
              dashboardWidgetCount={dashboardWidgetCount}
              tableRowCount={tableData.length}
            />
          )}

          {step === 2 && (
            <CustomizeStep
              title={title}
              setTitle={setTitle}
              companyName={companyName}
              setCompanyName={setCompanyName}
              selectedColumns={selectedColumns}
              setSelectedColumns={setSelectedColumns}
              allTableColumns={tableColumns}
              includeTable={includeTable}
              orientation={orientation}
              setOrientation={setOrientation}
              format={format}
              footerText={footerText}
              setFooterText={setFooterText}
            />
          )}

          {step === 3 && (
            <FormatStep
              format={format}
              setFormat={setFormat}
              useAiSummary={useAiSummary}
              setUseAiSummary={setUseAiSummary}
              templates={moduleTemplates}
              onLoadTemplate={handleLoadTemplate}
              saveAsTemplate={saveAsTemplate}
              setSaveAsTemplate={setSaveAsTemplate}
              templateName={templateName}
              setTemplateName={setTemplateName}
              isExporting={isExporting}
            />
          )}
        </div>

        {/* Footer actions */}
        <div className="modal-edit-actions" style={{ padding: '16px 24px', justifyContent: 'space-between', display: 'flex', gap: '10px', borderTop: '1px solid var(--line)' }}>
          <div>
            {step > 1 && (
              <button type="button" className="subtle-btn" onClick={() => setStep(step - 1)} disabled={isExporting}>
                <ChevronLeft size={16} /> Voltar
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="subtle-btn" onClick={onClose} disabled={isExporting}>
              Cancelar
            </button>
            {step < 3 ? (
              <button type="button" className="primary-btn" onClick={() => setStep(step + 1)} disabled={step === 1 && !canAdvanceStep1}>
                Seguinte <ChevronRight size={16} />
              </button>
            ) : (
              <button type="button" className="primary-btn" onClick={handleExport} disabled={!canExport}>
                {isExporting ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    {useAiSummary ? 'A processar IA & Exportar...' : 'A exportar...'}
                  </>
                ) : (
                  <>
                    <Download size={16} /> Exportar
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
