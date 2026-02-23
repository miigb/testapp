import { Pencil, Save, X } from 'lucide-react'
import type { DsEntryForm, DsRecord, StatusDefinition } from '../../types'
import { formatCurrency, toFormNumber } from '../../lib/formatters'
import { LabeledInput, LabeledSelect, Info } from '../shared/FormInputs'

export interface DsRecordDrawerProps {
    record: DsRecord
    recordEdit: DsEntryForm | null
    isEditing: boolean
    orderedStatuses: StatusDefinition[]
    gestoraOptions: string[]
    proponentesSuggestions: string[]
    referenciaSuggestions: string[]
    produtoOptions: string[]
    entidadeOptions: string[]
    reciboSuggestions: string[]
    onClose: () => void
    onToggleEdit: () => void
    onEditInput: <K extends keyof DsEntryForm>(key: K, value: DsEntryForm[K]) => void
    onSave: () => void
    onStatusChange: (recordId: string, statusId: string) => void
}

export function DsRecordDrawer({
    record,
    recordEdit,
    isEditing,
    orderedStatuses,
    gestoraOptions,
    proponentesSuggestions,
    referenciaSuggestions,
    produtoOptions,
    entidadeOptions,
    reciboSuggestions,
    onClose,
    onToggleEdit,
    onEditInput,
    onSave,
    onStatusChange,
}: DsRecordDrawerProps) {
    return (
        <div className="record-modal-overlay" onClick={onClose}>
            <aside className="panel record-modal" onClick={(event) => event.stopPropagation()}>
                <div className="drawer-header">
                    <div className="modal-title-block">
                        <h3>{record.referencia || record.proponentes || 'Detalhe do registo DS'}</h3>
                        <div className="small-note modal-meta">
                            {[record.gestora, record.entidadeBancaria, record.dataEscritura].filter(Boolean).join(' · ') || '-'}
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
                            <LabeledInput
                                label="Gestora"
                                value={recordEdit.gestora}
                                onChange={(value) => onEditInput('gestora', value)}
                                suggestions={gestoraOptions}
                            />
                            <LabeledInput
                                label="Proponentes"
                                value={recordEdit.proponentes}
                                onChange={(value) => onEditInput('proponentes', value)}
                                suggestions={proponentesSuggestions}
                            />
                            <LabeledInput
                                label="Referência"
                                value={recordEdit.referencia}
                                onChange={(value) => onEditInput('referencia', value)}
                                suggestions={referenciaSuggestions}
                            />
                        </div>
                        <div className="field-grid three">
                            <LabeledInput
                                label="Produto"
                                value={recordEdit.produto}
                                onChange={(value) => onEditInput('produto', value)}
                                suggestions={produtoOptions}
                            />
                            <LabeledInput
                                label="Entidade bancária"
                                value={recordEdit.entidadeBancaria}
                                onChange={(value) => onEditInput('entidadeBancaria', value)}
                                suggestions={entidadeOptions}
                            />
                            <LabeledInput
                                label="Líder cálculo"
                                value={recordEdit.liderCalculo}
                                onChange={(value) => onEditInput('liderCalculo', value)}
                            />
                        </div>
                        <div className="field-grid three">
                            <LabeledInput
                                label="Recibo"
                                value={recordEdit.recibo}
                                onChange={(value) => onEditInput('recibo', value)}
                                suggestions={reciboSuggestions}
                            />
                            <LabeledInput
                                label="Falta recibo gestora"
                                value={recordEdit.faltaReciboGestora}
                                onChange={(value) => onEditInput('faltaReciboGestora', value)}
                            />
                            <LabeledSelect
                                label="Estado"
                                value={recordEdit.estadoId}
                                onChange={(value) => onEditInput('estadoId', value)}
                                options={orderedStatuses.map((status) => ({ value: status.id, label: status.label }))}
                            />
                        </div>
                        <div className="field-grid five">
                            <LabeledInput label="Valor" value={recordEdit.valor} onChange={(value) => onEditInput('valor', value)} />
                            <LabeledInput
                                label="Comissão loja"
                                value={recordEdit.comissaoLoja}
                                onChange={(value) => onEditInput('comissaoLoja', value)}
                            />
                            <LabeledInput
                                label="IVA CGD (raw)"
                                value={recordEdit.ivaCgdRaw}
                                onChange={(value) => onEditInput('ivaCgdRaw', value)}
                            />
                            <LabeledInput
                                label="Total comissão c/ IVA"
                                value={recordEdit.totalComissaoLojaCmIva}
                                onChange={(value) => onEditInput('totalComissaoLojaCmIva', value)}
                            />
                            <LabeledInput
                                label="Comissão gestor"
                                value={recordEdit.comissaoGestor}
                                onChange={(value) => onEditInput('comissaoGestor', value)}
                            />
                        </div>
                        <div className="field-grid four">
                            <LabeledInput
                                label="Percentagem"
                                value={recordEdit.percentagem}
                                onChange={(value) => onEditInput('percentagem', value)}
                            />
                            <LabeledInput
                                type="date"
                                label="Data escritura"
                                value={recordEdit.dataEscritura}
                                onChange={(value) => onEditInput('dataEscritura', value)}
                            />
                            <LabeledInput
                                type="date"
                                label="Data fecho CRM"
                                value={recordEdit.dataFechoCrm}
                                onChange={(value) => onEditInput('dataFechoCrm', value)}
                            />
                            <LabeledInput
                                label="Pagamento comissão gestor"
                                value={recordEdit.pagComissaoGestor}
                                onChange={(value) => onEditInput('pagComissaoGestor', value)}
                            />
                        </div>
                        <div className="actions-row modal-edit-actions">
                            <button className="primary-btn" type="button" onClick={onSave}>
                                <Save size={15} />
                                Guardar alterações
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="detail-grid modal-detail-grid">
                        <Info label="Gestora" value={record.gestora || '-'} />
                        <Info label="Proponentes" value={record.proponentes || '-'} />
                        <Info label="Referência" value={record.referencia || '-'} />
                        <Info label="Produto" value={record.produto || '-'} />
                        <Info label="Entidade bancária" value={record.entidadeBancaria || '-'} />
                        <Info label="Líder cálculo" value={record.liderCalculo || '-'} />
                        <Info label="Recibo" value={record.recibo || '-'} />
                        <Info label="Falta recibo gestora" value={record.faltaReciboGestora || '-'} />
                        <Info label="Valor" value={formatCurrency(record.valor)} />
                        <Info label="Comissão loja" value={formatCurrency(record.comissaoLoja)} />
                        <Info label="Total comissão c/ IVA" value={formatCurrency(record.totalComissaoLojaCmIva)} />
                        <Info label="Comissão gestor" value={formatCurrency(record.comissaoGestor)} />
                        <Info label="IVA CGD" value={record.ivaCgdRaw || formatCurrency(record.ivaCgdValor)} />
                        <Info label="Percentagem" value={record.percentagemRaw || toFormNumber(record.percentagem) || '-'} />
                        <Info label="Data escritura" value={record.dataEscritura || '-'} />
                        <Info label="Data fecho CRM" value={record.dataFechoCrm || '-'} />
                        <Info label="Pag. comissão gestor" value={record.pagComissaoGestor || '-'} />
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

                <h4 className="modal-section-title">Metadados</h4>
                <div className="history-list modal-history-list">
                    <div className="history-item">
                        <div>Criado</div>
                        <div className="muted">{new Date(record.createdAt).toLocaleString('pt-PT')}</div>
                    </div>
                    <div className="history-item">
                        <div>Última atualização</div>
                        <div className="muted">{new Date(record.updatedAt).toLocaleString('pt-PT')}</div>
                    </div>
                </div>
            </aside>
        </div>
    )
}
