import { CheckSquare, Pencil, Save, X } from 'lucide-react'
import type { PenhorasEntryForm, PenhorasRecord, StatusDefinition } from '../../types'
import { LabeledInput, LabeledSelect, Info } from '../shared/FormInputs'

export interface PenhorasRecordDrawerProps {
    record: PenhorasRecord
    recordEdit: PenhorasEntryForm | null
    isEditing: boolean
    activeStatuses: StatusDefinition[]
    peSuggestions: string[]
    actoOptions: string[]
    gestorOptions: string[]
    onClose: () => void
    onToggleEdit: () => void
    onEditInput: <K extends keyof PenhorasEntryForm>(key: K, value: PenhorasEntryForm[K]) => void
    onSave: () => void
    onStatusChange: (recordId: string, statusId: string) => void
    onCreateTodo?: (module: string, recordId: string) => void
}

export function PenhorasRecordDrawer({
    record,
    recordEdit,
    isEditing,
    activeStatuses,
    peSuggestions,
    actoOptions,
    gestorOptions,
    onClose,
    onToggleEdit,
    onEditInput,
    onSave,
    onStatusChange,
    onCreateTodo,
}: PenhorasRecordDrawerProps) {
    return (
        <div className="record-modal-overlay" onClick={onClose}>
            <aside className="panel record-modal" onClick={(event) => event.stopPropagation()}>
                <div className="drawer-header">
                    <div className="modal-title-block">
                        <h3>{record.pe || record.identificacao || 'Detalhe do registo Penhoras'}</h3>
                        <div className="small-note modal-meta">
                            {[record.gestor, record.acto, record.dataPedido].filter(Boolean).join(' · ') || '-'}
                        </div>
                    </div>
                    <div className="actions-row modal-header-actions">
                        {onCreateTodo && (
                            <button
                                className="drawer-create-todo-btn"
                                type="button"
                                onClick={() => onCreateTodo('penhoras', record.id)}
                                title="Criar tarefa ligada a este registo"
                            >
                                <CheckSquare size={13} />
                                Criar Tarefa
                            </button>
                        )}
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
                                label="PE"
                                value={recordEdit.pe}
                                onChange={(value) => onEditInput('pe', value)}
                                suggestions={peSuggestions}
                            />
                            <LabeledInput
                                label="Acto"
                                value={recordEdit.acto}
                                onChange={(value) => onEditInput('acto', value)}
                                suggestions={actoOptions}
                            />
                            <LabeledInput
                                type="date"
                                label="Data pedido"
                                value={recordEdit.dataPedido}
                                onChange={(value) => onEditInput('dataPedido', value)}
                            />
                        </div>
                        <div className="field-grid three">
                            <LabeledInput
                                label="Identificação"
                                value={recordEdit.identificacao}
                                onChange={(value) => onEditInput('identificacao', value)}
                            />
                            <LabeledInput
                                label="Pedido"
                                value={recordEdit.pedido}
                                onChange={(value) => onEditInput('pedido', value)}
                            />
                            <LabeledInput
                                label="Gestor"
                                value={recordEdit.gestor}
                                onChange={(value) => onEditInput('gestor', value)}
                                suggestions={gestorOptions}
                            />
                        </div>
                        <div className="field-grid three">
                            <LabeledSelect
                                label="Estado"
                                value={recordEdit.estadoId}
                                onChange={(value) => onEditInput('estadoId', value)}
                                options={activeStatuses.map((status) => ({ value: status.id, label: status.label }))}
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
                        <Info label="PE" value={record.pe || '-'} />
                        <Info label="Acto" value={record.acto || '-'} />
                        <Info label="Data pedido" value={record.dataPedido || '-'} />
                        <Info label="Identificação" value={record.identificacao || '-'} />
                        <Info label="Pedido" value={record.pedido || '-'} />
                        <Info label="Gestor" value={record.gestor || '-'} />
                        <div className="field modal-status-field">
                            <span>Estado</span>
                            <select value={record.estadoId} onChange={(event) => onStatusChange(record.id, event.target.value)}>
                                {!activeStatuses.some((statusOption) => statusOption.id === record.estadoId) && (
                                    <option value="">Selecionar estado...</option>
                                )}
                                {activeStatuses.map((statusOption) => (
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
