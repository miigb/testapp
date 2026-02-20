import type { ChangeEvent } from 'react'
import type { DsParsedImport, ImportPreviewResponse } from '../../types'
import { LabeledSelect } from '../shared/FormInputs'

export interface DsImportarProps {
    handleDsImportFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
    refreshDsImportPreview: () => Promise<void>
    runDsImportCommit: () => Promise<void>
    dsImportLoading: boolean
    dsImportStrategy: 'skip' | 'update' | 'duplicate'
    setDsImportStrategy: (value: 'skip' | 'update' | 'duplicate') => void
    dsImportPreview: DsParsedImport | null
    dsImportServerPreview: ImportPreviewResponse | null
}

export function DsImportar({
    handleDsImportFile,
    refreshDsImportPreview,
    runDsImportCommit,
    dsImportLoading,
    dsImportStrategy,
    setDsImportStrategy,
    dsImportPreview,
    dsImportServerPreview,
}: DsImportarProps) {
    return (
        <section className="panel ds-panel ds-import-panel">
            <h2>Importar DS</h2>
            <p className="small-note">Importação da folha de escrituras concretizadas com preview e conflitos.</p>
            <div className="import-box">
                <input type="file" accept=".xlsx" onChange={(event) => void handleDsImportFile(event)} />
                <div className="actions-row start">
                    <button className="subtle-btn" type="button" onClick={() => void refreshDsImportPreview()}>
                        Rever conflitos DS
                    </button>
                    <LabeledSelect
                        label="Estratégia"
                        value={dsImportStrategy}
                        onChange={(value) => setDsImportStrategy(value as 'skip' | 'update' | 'duplicate')}
                        options={[
                            { value: 'update', label: 'Atualizar existentes' },
                            { value: 'skip', label: 'Ignorar duplicados' },
                            { value: 'duplicate', label: 'Criar duplicado' },
                        ]}
                    />
                    <button className="primary-btn" type="button" onClick={() => void runDsImportCommit()} disabled={!dsImportPreview || dsImportLoading}>
                        Confirmar importação DS
                    </button>
                </div>
                {dsImportLoading && <div className="small-note">A processar ficheiro DS...</div>}
            </div>
            {dsImportServerPreview && (
                <div className="import-summary">
                    <span>Total: {dsImportServerPreview.summary.total}</span>
                    <span>Válidas: {dsImportServerPreview.summary.valid}</span>
                    <span>Conflitos: {dsImportServerPreview.summary.conflicts}</span>
                    <span>Novas: {dsImportServerPreview.summary.creates}</span>
                    <span>Inválidas: {dsImportServerPreview.summary.invalid}</span>
                </div>
            )}
        </section>
    )
}
