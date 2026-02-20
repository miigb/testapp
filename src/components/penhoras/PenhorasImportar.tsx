import type { ChangeEvent } from 'react'
import type { PenhorasParsedImport, ImportPreviewResponse } from '../../types'
import { LabeledSelect } from '../shared/FormInputs'

export interface PenhorasImportarProps {
    handlePenhorasImportFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
    refreshPenhorasImportPreview: () => Promise<void>
    runPenhorasImportCommit: () => Promise<void>
    penhorasImportLoading: boolean
    penhorasImportStrategy: 'skip' | 'update' | 'duplicate'
    setPenhorasImportStrategy: (value: 'skip' | 'update' | 'duplicate') => void
    penhorasImportPreview: PenhorasParsedImport | null
    penhorasImportServerPreview: ImportPreviewResponse | null
}

export function PenhorasImportar({
    handlePenhorasImportFile,
    refreshPenhorasImportPreview,
    runPenhorasImportCommit,
    penhorasImportLoading,
    penhorasImportStrategy,
    setPenhorasImportStrategy,
    penhorasImportPreview,
    penhorasImportServerPreview,
}: PenhorasImportarProps) {
    return (
        <section className="panel ds-panel penhoras-panel ds-import-panel">
            <h2>Importar Penhoras</h2>
            <p className="small-note">Importação dedicada de penhoras com pré-visualização e resolução de conflitos.</p>
            <div className="import-box">
                <input type="file" accept=".xlsx" onChange={(event) => void handlePenhorasImportFile(event)} />
                <div className="actions-row start">
                    <button className="subtle-btn" type="button" onClick={() => void refreshPenhorasImportPreview()}>
                        Rever conflitos Penhoras
                    </button>
                    <LabeledSelect
                        label="Estratégia"
                        value={penhorasImportStrategy}
                        onChange={(value) => setPenhorasImportStrategy(value as 'skip' | 'update' | 'duplicate')}
                        options={[
                            { value: 'update', label: 'Atualizar existentes' },
                            { value: 'skip', label: 'Ignorar duplicados' },
                            { value: 'duplicate', label: 'Criar duplicado' },
                        ]}
                    />
                    <button
                        className="primary-btn"
                        type="button"
                        onClick={() => void runPenhorasImportCommit()}
                        disabled={!penhorasImportPreview || penhorasImportLoading}
                    >
                        Confirmar importação Penhoras
                    </button>
                </div>
                {penhorasImportLoading && <div className="small-note">A processar ficheiro Penhoras...</div>}
            </div>
            {penhorasImportPreview && (
                <div className="import-summary">
                    <span>Ficheiro: {penhorasImportPreview.fileName}</span>
                    <span>Linhas: {penhorasImportPreview.rows.length}</span>
                </div>
            )}
            {penhorasImportServerPreview && (
                <div className="import-summary">
                    <span>Total: {penhorasImportServerPreview.summary.total}</span>
                    <span>Válidas: {penhorasImportServerPreview.summary.valid}</span>
                    <span>Conflitos: {penhorasImportServerPreview.summary.conflicts}</span>
                    <span>Novas: {penhorasImportServerPreview.summary.creates}</span>
                    <span>Inválidas: {penhorasImportServerPreview.summary.invalid}</span>
                </div>
            )}
        </section>
    )
}
