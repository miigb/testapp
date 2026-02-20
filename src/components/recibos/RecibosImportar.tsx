import type { ChangeEvent } from 'react'
import { Download } from 'lucide-react'
import type { ParsedImport, ImportPreviewResponse, StatusDefinition } from '../../types'
import { LabeledSelect } from '../shared/FormInputs'

export interface RecibosImportarProps {
    handleImportFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
    exportCurrentSnapshot: () => Promise<void>
    loadSeed: (replace: boolean) => Promise<void>
    refreshImportConflictPreview: () => Promise<void>
    runImportCommit: () => Promise<void>
    importLoading: boolean
    importForceRecalculate: boolean
    setImportForceRecalculate: (value: boolean) => void
    importStrategy: 'skip' | 'update' | 'duplicate'
    setImportStrategy: (value: 'skip' | 'update' | 'duplicate') => void
    importPreview: ParsedImport | null
    importServerPreview: ImportPreviewResponse | null
    importColorMapping: Record<string, string>
    setImportColorMapping: (updater: (prev: Record<string, string>) => Record<string, string>) => void
    orderedStatuses: StatusDefinition[]
    defaultStatus: StatusDefinition | undefined
}

export function RecibosImportar({
    handleImportFile,
    exportCurrentSnapshot,
    loadSeed,
    refreshImportConflictPreview,
    runImportCommit,
    importLoading,
    importForceRecalculate,
    setImportForceRecalculate,
    importStrategy,
    setImportStrategy,
    importPreview,
    importServerPreview,
    importColorMapping,
    setImportColorMapping,
    orderedStatuses,
    defaultStatus,
}: RecibosImportarProps) {
    return (
        <section className="panel">
            <h2>Importar ficheiro</h2>
            <p className="small-note">Preview com conflitos e estratégia: ignorar, atualizar ou duplicar.</p>

            <div className="import-box">
                <input type="file" accept=".xlsx" onChange={(event) => void handleImportFile(event)} />
                <div className="actions-row start">
                    <button className="subtle-btn" type="button" onClick={() => void exportCurrentSnapshot()}>
                        <Download size={15} />
                        Exportar snapshot atual
                    </button>
                    <button className="subtle-btn" type="button" onClick={() => void loadSeed(false)}>Carregar seed sem substituir</button>
                    <button className="subtle-btn" type="button" onClick={() => void loadSeed(true)}>Substituir por seed</button>
                </div>
                {importLoading && <div className="small-note">A processar ficheiro...</div>}
            </div>

            {importPreview && (
                <>
                    <div className="import-meta">
                        <div><strong>Ficheiro:</strong> {importPreview.fileName}</div>
                        <div><strong>Linhas:</strong> {importPreview.rows.length}</div>
                        <div><strong>Cores:</strong> {Object.keys(importPreview.colorCount).length}</div>
                    </div>

                    <div className="import-map-list">
                        {Object.entries(importPreview.colorCount).map(([colorKey, count]) => (
                            <div key={colorKey} className="import-map-item">
                                <div className="color-cell">
                                    <span className="color-dot" style={{ backgroundColor: colorKey.startsWith('#') ? colorKey : '#BFC4CC' }} />
                                    <span>{colorKey}</span>
                                    <span className="muted">{count} linhas</span>
                                </div>
                                <select
                                    value={importColorMapping[colorKey] ?? defaultStatus?.id ?? ''}
                                    onChange={(event) => setImportColorMapping((current) => ({ ...current, [colorKey]: event.target.value }))}
                                >
                                    {orderedStatuses.map((status) => (
                                        <option key={status.id} value={status.id}>{status.label}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    <div className="actions-row start wrap">
                        <button className="subtle-btn" type="button" onClick={() => void refreshImportConflictPreview()}>
                            Rever conflitos
                        </button>
                        <label className="inline-check">
                            <input type="checkbox" checked={importForceRecalculate} onChange={(event) => setImportForceRecalculate(event.target.checked)} />
                            Forçar recálculo fiscal
                        </label>
                        <LabeledSelect
                            label="Estratégia de conflito"
                            value={importStrategy}
                            onChange={(value) => setImportStrategy(value as 'skip' | 'update' | 'duplicate')}
                            options={[
                                { value: 'update', label: 'Atualizar existentes' },
                                { value: 'skip', label: 'Ignorar duplicados' },
                                { value: 'duplicate', label: 'Criar duplicado' },
                            ]}
                        />
                        <button className="primary-btn" type="button" onClick={() => void runImportCommit()}>
                            Confirmar importação
                        </button>
                    </div>

                    {importServerPreview && (
                        <div className="import-summary">
                            <span>Total: {importServerPreview.summary.total}</span>
                            <span>Válidas: {importServerPreview.summary.valid}</span>
                            <span>Conflitos: {importServerPreview.summary.conflicts}</span>
                            <span>Novas: {importServerPreview.summary.creates}</span>
                            <span>Inválidas: {importServerPreview.summary.invalid}</span>
                        </div>
                    )}
                </>
            )}
        </section>
    )
}
