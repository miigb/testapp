import type { FormEvent } from 'react'
import type { PenhorasRecord, StatusDefinition, TabId, PenhorasEntryForm } from '../../types'
import { getInitialPenhorasEntryForm } from '../../lib/penhorasHelpers'
import { getStatus } from '../../lib/statusHelpers'
import { StatusPill } from '../shared/StatusComponents'
import { LabeledInput, LabeledSelect } from '../shared/FormInputs'
import { Circle } from 'lucide-react'

export interface PenhorasEntradaProps {
    penhorasRecentRecords: PenhorasRecord[]
    penhorasStatuses: StatusDefinition[]
    penhorasActiveStatuses: StatusDefinition[]
    penhorasDefaultStatus?: StatusDefinition
    penhorasEntryForm: PenhorasEntryForm
    setPenhorasEntryForm: (form: PenhorasEntryForm) => void
    submitPenhorasEntry: (event: FormEvent<HTMLFormElement>, saveMode: 'save' | 'saveNew') => Promise<void>
    saveNewPenhorasEntry: () => Promise<void>
    handlePenhorasEntryInput: <K extends keyof PenhorasEntryForm>(
        field: K,
        value: PenhorasEntryForm[K]
    ) => void
    penhorasPeSuggestions: string[]
    penhorasActoFilterOptions: string[]
    penhorasGestorFilterOptions: string[]
    setActiveTab: (tab: TabId) => void
    setSelectedPenhorasRecordId: (id: string | null) => void
}

export function PenhorasEntrada({
    penhorasRecentRecords,
    penhorasStatuses,
    penhorasActiveStatuses,
    penhorasDefaultStatus,
    penhorasEntryForm,
    setPenhorasEntryForm,
    submitPenhorasEntry,
    saveNewPenhorasEntry,
    handlePenhorasEntryInput,
    penhorasPeSuggestions,
    penhorasActoFilterOptions,
    penhorasGestorFilterOptions,
    setActiveTab,
    setSelectedPenhorasRecordId,
}: PenhorasEntradaProps) {
    return (
        <section className="panel entrada-layout">
            <aside className="panel side-list">
                <div className="row-between">
                    <h2>Registos recentes Penhoras</h2>
                    <span className="recent-mode-badge">Lista</span>
                </div>
                <div className="small-note">Últimas alterações</div>
                <div className="recent-list compact penhoras-recent-list">
                    {penhorasRecentRecords.length === 0 ? (
                        <div className="empty-text">Ainda não existem registos de penhoras.</div>
                    ) : (
                        penhorasRecentRecords.map((record) => {
                            const status = getStatus(penhorasStatuses, record.estadoId)
                            const reference = record.pe || record.pedido || record.identificacao || 'Sem referência'
                            const details = [record.gestor, record.acto].filter((value): value is string => Boolean(value?.trim())).join(' · ')
                            return (
                                <button
                                    key={record.id}
                                    className="recent-card penhoras-recent-card"
                                    type="button"
                                    onClick={() => {
                                        setSelectedPenhorasRecordId(record.id)
                                        setActiveTab('consulta')
                                    }}
                                >
                                    <span className="penhoras-recent-ref">{reference}</span>
                                    <span className="muted penhoras-recent-meta">{details || '-'}</span>
                                    {status ? (
                                        <StatusPill status={status} compact />
                                    ) : (
                                        <span className="status-pill compact ds-status-fallback">
                                            <Circle size={14} />
                                        </span>
                                    )}
                                </button>
                            )
                        })
                    )}
                </div>
            </aside>

            <div className="panel ds-panel penhoras-panel penhoras-entry-panel">
                <div className="row-between">
                    <div>
                        <h2>Entrada Penhoras</h2>
                        <p className="small-note">Registo manual de penhoras com dados isolados dos módulos de recibos e DS.</p>
                    </div>
                </div>

                <form className="entry-form ds-entry-form" onSubmit={(event) => void submitPenhorasEntry(event, 'save')}>
                    <section className="ds-form-section">
                        <h3 className="ds-form-section-title">Identificação</h3>
                        <div className="field-grid three">
                            <LabeledInput
                                label="PE"
                                value={penhorasEntryForm.pe || ''}
                                onChange={(value) => handlePenhorasEntryInput('pe', value)}
                                suggestions={penhorasPeSuggestions}
                            />
                            <LabeledInput
                                label="Acto"
                                value={penhorasEntryForm.acto || ''}
                                onChange={(value) => handlePenhorasEntryInput('acto', value)}
                                suggestions={penhorasActoFilterOptions}
                            />
                            <LabeledInput
                                label="Data pedido"
                                type="date"
                                value={penhorasEntryForm.dataPedido || ''}
                                onChange={(value) => handlePenhorasEntryInput('dataPedido', value)}
                            />
                        </div>
                    </section>

                    <section className="ds-form-section">
                        <h3 className="ds-form-section-title">Contexto operacional</h3>
                        <div className="field-grid three">
                            <LabeledInput
                                label="Identificação"
                                value={penhorasEntryForm.identificacao || ''}
                                onChange={(value) => handlePenhorasEntryInput('identificacao', value)}
                            />
                            <LabeledInput
                                label="Pedido"
                                value={penhorasEntryForm.pedido || ''}
                                onChange={(value) => handlePenhorasEntryInput('pedido', value)}
                            />
                            <LabeledInput
                                label="Gestor"
                                value={penhorasEntryForm.gestor || ''}
                                onChange={(value) => handlePenhorasEntryInput('gestor', value)}
                                suggestions={penhorasGestorFilterOptions}
                            />
                        </div>
                        <div className="field-grid three">
                            <LabeledSelect
                                label="Estado"
                                value={penhorasEntryForm.estadoId || ''}
                                onChange={(value) => handlePenhorasEntryInput('estadoId', value)}
                                options={
                                    penhorasActiveStatuses.length > 0
                                        ? penhorasActiveStatuses.map((status) => ({ value: status.id, label: status.label }))
                                        : [{ value: penhorasEntryForm.estadoId || '', label: 'Sem estado' }]
                                }
                            />
                        </div>
                    </section>

                    <div className="actions-row ds-entry-actions">
                        <button
                            className="subtle-btn"
                            type="button"
                            onClick={() => setPenhorasEntryForm(getInitialPenhorasEntryForm(penhorasDefaultStatus?.id ?? penhorasEntryForm.estadoId))}
                        >
                            Limpar
                        </button>
                        <button className="subtle-btn" type="button" onClick={() => void saveNewPenhorasEntry()}>
                            Guardar e novo
                        </button>
                        <button className="primary-btn" type="submit">
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </section>
    )
}
