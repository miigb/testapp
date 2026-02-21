import type { FormEvent } from 'react'
import type { ReceiptRecord, StatusDefinition, TabId, RecordType, CalculationSettings, EntryForm as EntryForm } from '../../types'
import { getInitialEntryForm, getPrimaryRecordReference } from '../../lib/recordHelpers'
import { applyFormAutoCalculations } from '../../lib/calculations'
import { getStatus } from '../../lib/statusHelpers'
import { StatusPill } from '../shared/StatusComponents'
import { EntityIdentity } from '../shared/StatusComponents'
import { LabeledInput, LabeledSelect } from '../shared/FormInputs'
import { MONTHS } from '../../constants'
export interface RecibosEntradaProps {
    recentRecords: ReceiptRecord[]
    statuses: StatusDefinition[]
    activeStatuses: StatusDefinition[]
    defaultStatus?: StatusDefinition
    entryForm: EntryForm
    setEntryForm: (form: EntryForm) => void
    calculationSettings: CalculationSettings
    submitEntry: (event: FormEvent<HTMLFormElement>, saveMode: 'save' | 'saveNew') => Promise<void>
    saveNewEntry: () => Promise<void>
    handleEntryInput: <K extends keyof EntryForm>(
        field: K,
        value: EntryForm[K]
    ) => void
    recordSuggestions: {
        processo: string[]
        pe: string[]
        reciboNumero: string[]
    }
    gestorSuggestions: string[]
    exequenteSuggestions: string[]
    setActiveTab: (tab: TabId) => void
    setSelectedRecordId: (id: string | null) => void
}

export function RecibosEntrada({
    recentRecords,
    statuses,
    activeStatuses,
    defaultStatus,
    entryForm,
    setEntryForm,
    calculationSettings,
    submitEntry,
    saveNewEntry,
    handleEntryInput,
    recordSuggestions,
    gestorSuggestions,
    exequenteSuggestions,
    setActiveTab,
    setSelectedRecordId,
}: RecibosEntradaProps) {
    return (
        <section className="panel entrada-layout">
            <aside className="panel side-list">
                <div className="row-between">
                    <h2>Registos recentes</h2>
                    <span className="recent-mode-badge">Lista</span>
                </div>
                <div className="small-note">Últimas alterações</div>
                <div className="recent-list compact">
                    {recentRecords.length === 0 ? (
                        <div className="empty-text">Ainda não existem registos.</div>
                    ) : (
                        recentRecords.map((record) => {
                            const status = getStatus(statuses, record.estadoId)
                            const reference = getPrimaryRecordReference(record)
                            return (
                                <button
                                    key={record.id}
                                    className="recent-card"
                                    type="button"
                                    onClick={() => {
                                        setSelectedRecordId(record.id)
                                        setActiveTab('consulta')
                                    }}
                                >
                                    <span>{reference}</span>
                                    <EntityIdentity gestor={record.gestor} exequente={record.exequente} />
                                    {status && <StatusPill status={status} compact />}
                                </button>
                            )
                        })
                    )}
                </div>
            </aside>

            <div className="panel">
                <div className="row-between">
                    <div>
                        <h2>Novo registo</h2>
                        <p className="small-note">Campos fiscais calculados automaticamente com base na configuração.</p>
                    </div>
                    <button className="subtle-btn" type="button" onClick={() => setEntryForm(applyFormAutoCalculations(entryForm, calculationSettings, true))}>
                        Recalcular
                    </button>
                </div>

                <form className="entry-form" onSubmit={(event) => void submitEntry(event, 'save')}>
                    <div className="field-grid three">
                        <LabeledSelect
                            label="Tipo"
                            value={entryForm.tipo}
                            onChange={(value) => handleEntryInput('tipo', value as RecordType)}
                            options={[
                                { value: 'exequente', label: 'Exequente' },
                                { value: 'executado', label: 'Executado' },
                            ]}
                        />
                        <LabeledSelect
                            label="Mês"
                            value={String(entryForm.mes)}
                            onChange={(value) => handleEntryInput('mes', Number(value))}
                            options={MONTHS.map((label: string, index: number) => ({ value: String(index + 1), label }))}
                        />
                        <LabeledInput
                            label="Ano"
                            value={String(entryForm.ano)}
                            onChange={(value) => handleEntryInput('ano', Number(value) || new Date().getFullYear())}
                        />
                    </div>

                    <div className="field-grid three">
                        <LabeledInput label="Processo" value={entryForm.processo} onChange={(value) => handleEntryInput('processo', value)} suggestions={recordSuggestions.processo} />
                        <LabeledInput label="PE" value={entryForm.pe} onChange={(value) => handleEntryInput('pe', value)} suggestions={recordSuggestions.pe} />
                        <LabeledInput label="N.º de recibo" value={entryForm.reciboNumero} onChange={(value) => handleEntryInput('reciboNumero', value)} suggestions={recordSuggestions.reciboNumero} />
                    </div>

                    <div className="field-grid four">
                        <LabeledInput type="date" label="Data de levantamento" value={entryForm.dataLevantamento} onChange={(value) => handleEntryInput('dataLevantamento', value)} />
                        <LabeledInput type="date" label="Data de recibo" value={entryForm.dataRecibo} onChange={(value) => handleEntryInput('dataRecibo', value)} />
                        <LabeledInput
                            label="Gestor"
                            value={entryForm.gestor}
                            onChange={(value) => handleEntryInput('gestor', value)}
                            suggestions={gestorSuggestions}
                        />
                        <LabeledInput
                            label="Exequente"
                            value={entryForm.exequente}
                            onChange={(value) => handleEntryInput('exequente', value)}
                            suggestions={exequenteSuggestions}
                        />
                    </div>

                    <div className="field-grid five">
                        <LabeledInput label="Valor indicado" value={entryForm.valorIndicado} onChange={(value) => handleEntryInput('valorIndicado', value)} />
                        <LabeledInput label="Valor sem IVA" value={entryForm.valorSemIva} onChange={(value) => handleEntryInput('valorSemIva', value)} />
                        <LabeledInput label="IVA" value={entryForm.iva} onChange={(value) => handleEntryInput('iva', value)} />
                        <LabeledInput label="Retenção" value={entryForm.retencao} onChange={(value) => handleEntryInput('retencao', value)} />
                        <LabeledInput label="Meu 5%" value={entryForm.meu5} onChange={(value) => handleEntryInput('meu5', value)} />
                    </div>

                    <div className="field-grid five">
                        <LabeledInput label="GPESE" value={entryForm.gpeSe} onChange={(value) => handleEntryInput('gpeSe', value)} />
                        <LabeledInput label="Outras taxas" value={entryForm.outrasTaxas} onChange={(value) => handleEntryInput('outrasTaxas', value)} />
                        <LabeledInput label="Valor emissão" value={entryForm.valorEmissao} onChange={(value) => handleEntryInput('valorEmissao', value)} />
                        <LabeledInput label="Descrição valor" value={entryForm.descricaoValor} onChange={(value) => handleEntryInput('descricaoValor', value)} />
                        <LabeledSelect
                            label="Estado"
                            value={entryForm.estadoId}
                            onChange={(value) => handleEntryInput('estadoId', value)}
                            options={activeStatuses.map((status) => ({ value: status.id, label: status.label }))}
                        />
                    </div>

                    <div className="field-grid one">
                        <LabeledInput label="Indicações de levantamento" value={entryForm.indicacoes} onChange={(value) => handleEntryInput('indicacoes', value)} />
                    </div>

                    <div className="actions-row">
                        <button type="button" className="subtle-btn" onClick={() => defaultStatus && setEntryForm(getInitialEntryForm(defaultStatus.id))}>
                            Limpar
                        </button>
                        <button type="button" className="subtle-btn" onClick={() => void saveNewEntry()}>
                            Guardar e novo
                        </button>
                        <button type="submit" className="primary-btn">Guardar</button>
                    </div>
                </form>
            </div>
        </section>
    )
}
