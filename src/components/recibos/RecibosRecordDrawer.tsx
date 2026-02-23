import { Pencil, Save, X } from 'lucide-react'
import type { EntryForm, ReceiptRecord, RecordSuggestions, RecordType, StatusDefinition } from '../../types'
import { MONTHS } from '../../constants'
import { formatCurrency } from '../../lib/formatters'
import { LabeledInput, LabeledSelect, Info } from '../shared/FormInputs'

export interface RecibosRecordDrawerProps {
    record: ReceiptRecord
    recordEdit: EntryForm | null
    isEditing: boolean
    orderedStatuses: StatusDefinition[]
    recordSuggestions: RecordSuggestions
    gestorSuggestions: string[]
    exequenteSuggestions: string[]
    recordIndicacoes: { gpeSe: string; text: string }
    onClose: () => void
    onToggleEdit: () => void
    onEditInput: <K extends keyof EntryForm>(key: K, value: EntryForm[K]) => void
    onRecalculate: () => void
    onSave: () => void
    onStatusChange: (recordId: string, statusId: string) => void
}

export function RecibosRecordDrawer({
    record,
    recordEdit,
    isEditing,
    orderedStatuses,
    recordSuggestions,
    gestorSuggestions,
    exequenteSuggestions,
    recordIndicacoes,
    onClose,
    onToggleEdit,
    onEditInput,
    onRecalculate,
    onSave,
    onStatusChange,
}: RecibosRecordDrawerProps) {
    return (
        <div className="record-modal-overlay" onClick={onClose}>
            <aside className="panel record-modal" onClick={(event) => event.stopPropagation()}>
                <div className="drawer-header">
                    <div className="modal-title-block">
                        <h3>{record.processo || record.pe || record.reciboNumero || 'Detalhe do registo'}</h3>
                        <div className="small-note modal-meta">
                            {record.pe || '-'} · {MONTHS[record.mes - 1]} {record.ano}
                        </div>
                    </div>
                    <div className="actions-row modal-header-actions">
                        <button className="subtle-btn" type="button" onClick={onToggleEdit}>
                            {isEditing ? <X size={15} /> : <Pencil size={15} />}
                            {isEditing ? 'Cancelar edição' : 'Editar'}
                        </button>
                        <button className="subtle-btn" type="button" onClick={onClose}>Fechar</button>
                    </div>
                </div>

                {isEditing && recordEdit ? (
                    <div className="record-edit-content">
                        <div className="field-grid three">
                            <LabeledSelect
                                label="Tipo"
                                value={recordEdit.tipo}
                                onChange={(value) => onEditInput('tipo', value as RecordType)}
                                options={[
                                    { value: 'exequente', label: 'Exequente' },
                                    { value: 'executado', label: 'Executado' },
                                ]}
                            />
                            <LabeledSelect
                                label="Mês"
                                value={String(recordEdit.mes)}
                                onChange={(value) => onEditInput('mes', Number(value))}
                                options={MONTHS.map((label, index) => ({ value: String(index + 1), label }))}
                            />
                            <LabeledInput
                                label="Ano"
                                value={String(recordEdit.ano)}
                                onChange={(value) => onEditInput('ano', Number(value) || recordEdit.ano)}
                            />
                        </div>

                        <div className="field-grid three">
                            <LabeledInput label="Processo" value={recordEdit.processo} onChange={(value) => onEditInput('processo', value)} suggestions={recordSuggestions.processo} />
                            <LabeledInput label="PE" value={recordEdit.pe} onChange={(value) => onEditInput('pe', value)} suggestions={recordSuggestions.pe} />
                            <LabeledInput label="Recibo" value={recordEdit.reciboNumero} onChange={(value) => onEditInput('reciboNumero', value)} suggestions={recordSuggestions.reciboNumero} />
                        </div>

                        <div className="field-grid five">
                            <LabeledInput label="Valor indicado" value={recordEdit.valorIndicado} onChange={(value) => onEditInput('valorIndicado', value)} />
                            <LabeledInput label="Valor sem IVA" value={recordEdit.valorSemIva} onChange={(value) => onEditInput('valorSemIva', value)} />
                            <LabeledInput label="IVA" value={recordEdit.iva} onChange={(value) => onEditInput('iva', value)} />
                            <LabeledInput label="Retenção" value={recordEdit.retencao} onChange={(value) => onEditInput('retencao', value)} />
                            <LabeledInput label="Meu 5%" value={recordEdit.meu5} onChange={(value) => onEditInput('meu5', value)} />
                        </div>

                        <div className="field-grid five">
                            <LabeledInput label="GPESE" value={recordEdit.gpeSe} onChange={(value) => onEditInput('gpeSe', value)} />
                            <LabeledInput
                                label="Gestor"
                                value={recordEdit.gestor}
                                onChange={(value) => onEditInput('gestor', value)}
                                suggestions={gestorSuggestions}
                            />
                            <LabeledInput
                                label="Exequente"
                                value={recordEdit.exequente}
                                onChange={(value) => onEditInput('exequente', value)}
                                suggestions={exequenteSuggestions}
                            />
                            <LabeledInput label="Descrição valor" value={recordEdit.descricaoValor} onChange={(value) => onEditInput('descricaoValor', value)} />
                            <LabeledSelect
                                label="Estado"
                                value={recordEdit.estadoId}
                                onChange={(value) => onEditInput('estadoId', value)}
                                options={orderedStatuses.map((status) => ({ value: status.id, label: status.label }))}
                            />
                        </div>

                        <div className="field-grid one">
                            <LabeledInput label="Indicações" value={recordEdit.indicacoes} onChange={(value) => onEditInput('indicacoes', value)} />
                        </div>

                        <div className="actions-row modal-edit-actions">
                            <button className="subtle-btn" type="button" onClick={onRecalculate}>
                                Recalcular
                            </button>
                            <button className="primary-btn" type="button" onClick={onSave}>
                                <Save size={15} />
                                Guardar alterações
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="detail-grid modal-detail-grid">
                        <Info label="Tipo" value={record.tipo === 'exequente' ? 'Exequente' : 'Executado'} />
                        <Info label="PE" value={record.pe || '-'} />
                        <Info label="Processo" value={record.processo || '-'} />
                        <Info label="Recibo" value={record.reciboNumero || '-'} />
                        <Info label="Gestor" value={record.gestor || '-'} />
                        <Info label="Exequente" value={record.exequente || '-'} />
                        <Info label="Valor sem IVA" value={formatCurrency(record.valorSemIva)} />
                        <Info label="IVA" value={formatCurrency(record.iva)} />
                        <Info label="Retenção" value={formatCurrency(record.retencao)} />
                        <Info label="Meu 5%" value={formatCurrency(record.meu5)} />
                        <Info label="GPESE" value={recordIndicacoes.gpeSe || '-'} />
                        <Info label="Indicações" value={recordIndicacoes.text || '-'} />
                        <div className="field modal-status-field">
                            <span>Estado</span>
                            <select value={record.estadoId} onChange={(event) => onStatusChange(record.id, event.target.value)}>
                                {orderedStatuses.map((statusOption) => (
                                    <option key={statusOption.id} value={statusOption.id}>{statusOption.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                <h4 className="modal-section-title">Histórico</h4>
                <div className="history-list modal-history-list">
                    {record.history.length === 0 ? (
                        <div className="empty-text">Sem histórico.</div>
                    ) : (
                        record.history.map((item) => (
                            <div key={item.id} className="history-item">
                                <div>{item.message}</div>
                                <div className="muted">{new Date(item.at).toLocaleString('pt-PT')}</div>
                            </div>
                        ))
                    )}
                </div>
            </aside>
        </div>
    )
}
