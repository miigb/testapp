import React, { useState } from 'react'
import { FileText, FileSpreadsheet, FileImage, Sparkles, X, Loader2 } from 'lucide-react'
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from '../../lib/exportGenerators'

interface ExportComposerProps {
    isOpen: boolean
    onClose: () => void
    moduleName: string
    columns: ExportColumn[]
    data: Record<string, unknown>[]
    dashboardElementId?: string
}

export function ExportComposer({
    isOpen,
    onClose,
    moduleName,
    columns,
    data,
    dashboardElementId,
}: ExportComposerProps) {
    const [format, setFormat] = useState<'excel' | 'csv' | 'pdf'>('excel')
    const [useAi, setUseAi] = useState(false)
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

            const exportData = {
                title: `Exportação de ${moduleName}`,
                columns,
                rows: data,
                summaryText,
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

                    <div className="filter-group" style={{ marginTop: '16px' }}>
                        <label
                            className="checkbox-label"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: isExporting ? 'not-allowed' : 'pointer',
                                padding: '12px',
                                border: '1px solid var(--line)',
                                borderRadius: 'var(--radius-md)',
                                background: useAi ? 'color-mix(in oklab, var(--brand) 6%, transparent)' : 'transparent',
                                borderColor: useAi ? 'var(--brand)' : 'var(--line)',
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
                        <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '6px', lineHeight: 1.4 }}>
                            Adiciona um resumo executivo gerado por IA (Gemini) no topo do ficheiro baseado numa amostra dos dados selecionados.
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
