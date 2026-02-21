import type { FormEvent } from 'react'
import type { DsRecord, DsEntryForm as IDsEntryForm, StatusDefinition, TabId } from '../../types'
import { getInitialDsEntryForm } from '../../lib/dsHelpers'
import { getStatus } from '../../lib/statusHelpers'
import { StatusPill } from '../shared/StatusComponents'
import { LabeledInput, LabeledSelect } from '../shared/FormInputs'
import { Circle } from 'lucide-react'

export interface DsEntradaProps {
    dsRecentRecords: DsRecord[]
    dsStatuses: StatusDefinition[]
    dsOrderedStatuses: StatusDefinition[]
    dsDefaultStatus?: StatusDefinition
    dsEntryForm: IDsEntryForm
    setDsEntryForm: (form: IDsEntryForm) => void
    submitDsEntry: (event: FormEvent<HTMLFormElement>, saveMode: 'save' | 'saveNew') => Promise<void>
    saveNewDsEntry: () => Promise<void>
    handleDsEntryInput: <K extends keyof IDsEntryForm>(
        field: K,
        value: IDsEntryForm[K]
    ) => void
    dsGestoraFilterOptions: string[]
    dsProponentesSuggestions: string[]
    dsReferenciaSuggestions: string[]
    dsProdutoFilterOptions: string[]
    dsEntidadeFilterOptions: string[]
    dsReciboSuggestions: string[]
    setActiveTab: (tab: TabId) => void
    setSelectedDsRecordId: (id: string | null) => void
}

export function DsEntrada({
    dsRecentRecords,
    dsStatuses,
    dsOrderedStatuses,
    dsDefaultStatus,
    dsEntryForm,
    setDsEntryForm,
    submitDsEntry,
    saveNewDsEntry,
    handleDsEntryInput,
    dsGestoraFilterOptions,
    dsProponentesSuggestions,
    dsReferenciaSuggestions,
    dsProdutoFilterOptions,
    dsEntidadeFilterOptions,
    dsReciboSuggestions,
    setActiveTab,
    setSelectedDsRecordId,
}: DsEntradaProps) {
    return (
        <section className="panel entrada-layout">
            <aside className="panel side-list">
                <div className="row-between">
                    <h2>Registos recentes DS</h2>
                    <span className="recent-mode-badge">Lista</span>
                </div>
                <div className="small-note">Últimas alterações</div>
                <div className="recent-list compact ds-recent-list">
                    {dsRecentRecords.length === 0 ? (
                        <div className="empty-text">Ainda não existem registos DS.</div>
                    ) : (
                        dsRecentRecords.map((record) => {
                            const status = getStatus(dsStatuses, record.estadoId)
                            const reference = record.referencia || record.proponentes || 'Sem referência'
                            const details = [record.gestora, record.produto].filter((value): value is string => Boolean(value?.trim())).join(' · ')
                            return (
                                <button
                                    key={record.id}
                                    className="recent-card ds-recent-card"
                                    type="button"
                                    onClick={() => {
                                        setSelectedDsRecordId(record.id)
                                        setActiveTab('consulta')
                                    }}
                                >
                                    <span className="ds-recent-ref">{reference}</span>
                                    <span className="muted ds-recent-meta">{details || '-'}</span>
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

            <div className="panel ds-panel ds-entry-panel">
                <div className="row-between">
                    <div>
                        <h2>Entrada DS</h2>
                        <p className="small-note">Registo manual de escrituras concretizadas no módulo DS.</p>
                    </div>
                </div>

                <form className="entry-form ds-entry-form" onSubmit={(event) => void submitDsEntry(event, 'save')}>
                    <section className="ds-form-section">
                        <h3 className="ds-form-section-title">Identificação</h3>
                        <div className="field-grid three">
                            <LabeledInput
                                label="Gestora"
                                value={dsEntryForm.gestora}
                                onChange={(value) => handleDsEntryInput('gestora', value)}
                                suggestions={dsGestoraFilterOptions}
                            />
                            <LabeledInput
                                label="Proponentes"
                                value={dsEntryForm.proponentes}
                                onChange={(value) => handleDsEntryInput('proponentes', value)}
                                suggestions={dsProponentesSuggestions}
                            />
                            <LabeledInput
                                label="Referência"
                                value={dsEntryForm.referencia}
                                onChange={(value) => handleDsEntryInput('referencia', value)}
                                suggestions={dsReferenciaSuggestions}
                            />
                        </div>
                    </section>

                    <section className="ds-form-section">
                        <h3 className="ds-form-section-title">Contexto operacional</h3>
                        <div className="field-grid three">
                            <LabeledInput
                                label="Produto"
                                value={dsEntryForm.produto}
                                onChange={(value) => handleDsEntryInput('produto', value)}
                                suggestions={dsProdutoFilterOptions}
                            />
                            <LabeledInput
                                label="Entidade bancária"
                                value={dsEntryForm.entidadeBancaria}
                                onChange={(value) => handleDsEntryInput('entidadeBancaria', value)}
                                suggestions={dsEntidadeFilterOptions}
                            />
                            <LabeledInput
                                label="Líder cálculo"
                                value={dsEntryForm.liderCalculo}
                                onChange={(value) => handleDsEntryInput('liderCalculo', value)}
                            />
                        </div>

                        <div className="field-grid three">
                            <LabeledInput
                                label="Recibo"
                                value={dsEntryForm.recibo}
                                onChange={(value) => handleDsEntryInput('recibo', value)}
                                suggestions={dsReciboSuggestions}
                            />
                            <LabeledInput
                                label="Falta recibo gestora"
                                value={dsEntryForm.faltaReciboGestora}
                                onChange={(value) => handleDsEntryInput('faltaReciboGestora', value)}
                            />
                            <LabeledSelect
                                label="Estado"
                                value={dsEntryForm.estadoId}
                                onChange={(value) => handleDsEntryInput('estadoId', value)}
                                options={
                                    dsOrderedStatuses.length > 0
                                        ? dsOrderedStatuses.map((status) => ({ value: status.id, label: status.label }))
                                        : [{ value: dsEntryForm.estadoId || '', label: 'Sem estado' }]
                                }
                            />
                        </div>
                    </section>

                    <section className="ds-form-section">
                        <h3 className="ds-form-section-title">Financeiro</h3>
                        <div className="field-grid three">
                            <LabeledInput label="Valor" value={dsEntryForm.valor} onChange={(value) => handleDsEntryInput('valor', value)} />
                            <LabeledInput label="Comissão loja" value={dsEntryForm.comissaoLoja} onChange={(value) => handleDsEntryInput('comissaoLoja', value)} />
                            <LabeledInput
                                label="Total comissão loja c/ IVA"
                                value={dsEntryForm.totalComissaoLojaCmIva}
                                onChange={(value) => handleDsEntryInput('totalComissaoLojaCmIva', value)}
                            />
                        </div>

                        <div className="field-grid three">
                            <LabeledInput label="IVA CGD (raw)" value={dsEntryForm.ivaCgdRaw} onChange={(value) => handleDsEntryInput('ivaCgdRaw', value)} />
                            <LabeledInput label="Comissão gestor" value={dsEntryForm.comissaoGestor} onChange={(value) => handleDsEntryInput('comissaoGestor', value)} />
                            <LabeledInput label="Percentagem" value={dsEntryForm.percentagem} onChange={(value) => handleDsEntryInput('percentagem', value)} />
                        </div>
                    </section>

                    <section className="ds-form-section">
                        <h3 className="ds-form-section-title">Datas e pagamento</h3>
                        <div className="field-grid three">
                            <LabeledInput
                                label="Data escritura"
                                type="date"
                                value={dsEntryForm.dataEscritura}
                                onChange={(value) => handleDsEntryInput('dataEscritura', value)}
                            />
                            <LabeledInput
                                label="Data fecho CRM"
                                type="date"
                                value={dsEntryForm.dataFechoCrm}
                                onChange={(value) => handleDsEntryInput('dataFechoCrm', value)}
                            />
                            <LabeledInput
                                label="Pagamento comissão gestor"
                                value={dsEntryForm.pagComissaoGestor}
                                onChange={(value) => handleDsEntryInput('pagComissaoGestor', value)}
                            />
                        </div>
                    </section>

                    <div className="actions-row ds-entry-actions">
                        <button
                            className="subtle-btn"
                            type="button"
                            onClick={() => setDsEntryForm(getInitialDsEntryForm(dsDefaultStatus?.id ?? dsEntryForm.estadoId))}
                        >
                            Limpar
                        </button>
                        <button className="subtle-btn" type="button" onClick={() => void saveNewDsEntry()}>
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
