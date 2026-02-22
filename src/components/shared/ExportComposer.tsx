import { useState } from 'react'
import { FileText, FileSpreadsheet, FileImage, Sparkles, X, Loader2 } from 'lucide-react'
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from '../../lib/exportGenerators'

interface ExportComposerProps {
    isOpen: boolean
    onClose: () => void
    moduleName: string
    columns: ExportColumn[]
    data: Record<string, unknown>[]
    dashboardElementId?: string
    themeColor?: string
    dashboardName?: string
}

export function ExportComposer({
    isOpen,
    onClose,
    moduleName,
    columns,
    data,
    dashboardElementId,
    themeColor,
    dashboardName,
}: ExportComposerProps) {
    const [format, setFormat] = useState<'excel' | 'csv' | 'pdf'>('excel')
    const [useAi, setUseAi] = useState(false)
    const [exportName, setExportName] = useState(dashboardName || '')
    const [isExporting, setIsExporting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!isOpen) return null

    const handleExport = async () => {
        setIsExporting(true)
        setError(null)
        try {
            let summaryText: string | undefined

            if (useAi) {
                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/ai/summary`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        moduleName,
                        contextData: {
                            totalRecords: data.length,
                            sample: data.slice(0, 50), // Sends top 50 rows to reduce payload size and context limits
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

            let finalTitle = `Exportação de ${moduleName}`
            if (dashboardElementId && format === 'pdf') {
                finalTitle = exportName ? `Exportação de Dashboard ${exportName}` : `Exportação de Dashboard`
            }

            const exportData = {
                title: finalTitle,
                columns,
                rows: data,
                summaryText,
                themeColor,
            }

            const filename = `${moduleName.toLowerCase()}_export_${new Date().toISOString().slice(0, 10)}`

            if (format === 'csv') {
                await exportToCsv(exportData, filename)
            } else if (format === 'excel') {
                await exportToExcel(exportData, filename)
            } else if (format === 'pdf') {
                await exportToPdf(exportData, filename, dashboardElementId)
            }

            onClose()
        } catch (err) {
            console.error(err)
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError('Erro inesperado durante a exportação.')
            }
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <div className="record-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="record-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
                <header className="drawer-header">
                    <div className="modal-title-block">
                        <h3>Exportar {moduleName}</h3>
                        <p className="modal-meta" style={{ color: 'var(--ink-muted)' }}>
                            A exportar {data.length} registos filtrados
                        </p>
                    </div>
                    <button className="subtle-btn icon-btn" onClick={onClose} disabled={isExporting}>
                        <X size={18} />
                    </button>
                </header>

                <div className="record-edit-content">
                    {error && (
                        <div
                            style={{
                                padding: '10px',
                                background: 'color-mix(in oklab, var(--danger) 15%, transparent)',
                                color: 'var(--danger)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.9rem',
                                border: '1px solid color-mix(in oklab, var(--danger) 30%, transparent)'
                            }}
                        >
                            {error}
                        </div>
                    )}

                    <div className="filter-group">
                        <label className="filter-label">Formato de Exportação</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                            <button
                                type="button"
                                className={format === 'excel' ? 'primary-btn' : 'secondary-btn'}
                                onClick={() => setFormat('excel')}
                                style={{ justifyContent: 'center' }}
                                disabled={isExporting}
                            >
                                <FileSpreadsheet size={16} /> Excel
                            </button>
                            <button
                                type="button"
                                className={format === 'csv' ? 'primary-btn' : 'secondary-btn'}
                                onClick={() => setFormat('csv')}
                                style={{ justifyContent: 'center' }}
                                disabled={isExporting}
                            >
                                <FileText size={16} /> CSV
                            </button>
                            <button
                                type="button"
                                className={format === 'pdf' ? 'primary-btn' : 'secondary-btn'}
                                onClick={() => setFormat('pdf')}
                                style={{ justifyContent: 'center' }}
                                disabled={isExporting}
                            >
                                <FileImage size={16} /> PDF
                            </button>
                        </div>
                    </div>

                    {dashboardElementId && format === 'pdf' && (
                        <div className="filter-group" style={{ marginTop: '16px' }}>
                            <label className="filter-label">Nome da Exportação</label>
                            <input
                                type="text"
                                className="styled-input"
                                value={exportName}
                                onChange={(e) => setExportName(e.target.value)}
                                placeholder="Insira o nome (ex: Dashboard Q1)"
                                disabled={isExporting}
                                style={{ width: '100%' }}
                            />
                        </div>
                    )}

                    <div className="filter-group" style={{ marginTop: '16px' }}>
                        <label
                            className="checkbox-label"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: isExporting ? 'not-allowed' : 'pointer',
                                padding: '14px',
                                border: '1px solid',
                                borderRadius: 'var(--radius-md)',
                                background: useAi ? 'color-mix(in oklab, var(--brand) 6%, transparent)' : 'var(--surface)',
                                borderColor: useAi ? 'var(--brand)' : 'var(--line)',
                                boxShadow: useAi ? '0 0 0 1px var(--brand) inset' : '0 1px 2px rgba(0,0,0,0.02)',
                                transition: 'all 0.2s ease',
                                opacity: isExporting ? 0.7 : 1,
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={useAi}
                                onChange={(e) => setUseAi(e.target.checked)}
                                disabled={isExporting}
                            />
                            <Sparkles size={16} strokeWidth={2.5} color={useAi ? 'var(--brand)' : 'var(--ink-muted)'} />
                            <span style={{ fontWeight: 500, color: useAi ? 'var(--brand)' : 'var(--ink)' }}>
                                Gerar Resumo Inteligente (Opcional)
                            </span>
                        </label>
                        <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginTop: '8px', lineHeight: 1.5, paddingLeft: '2px' }}>
                            Adiciona um resumo executivo gerado por IA (Gemini) no topo do ficheiro baseado numa amostra dos dados selecionados. Esta análise pode atrasar a exportação uns segundos.
                        </p>
                    </div>

                    <div
                        className="modal-edit-actions"
                        style={{ marginTop: '24px', justifyContent: 'flex-end', display: 'flex', gap: '10px' }}
                    >
                        <button type="button" className="subtle-btn" onClick={onClose} disabled={isExporting}>
                            Cancelar
                        </button>
                        <button type="button" className="primary-btn" onClick={handleExport} disabled={isExporting}>
                            {isExporting ? (
                                <>
                                    <Loader2 size={16} className="spin" />
                                    {useAi ? 'A processar IA & Exportar...' : 'A exportar...'}
                                </>
                            ) : (
                                'Confirmar Exportação'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
