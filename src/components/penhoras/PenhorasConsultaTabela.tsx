import { useState } from 'react'
import { Eye, EyeOff, FilterX, Trash2, Download } from 'lucide-react'
import type { PenhorasRecord, PenhorasRecordFilters, StatusDefinition, SavedView, SavedViewScope, TabId } from '../../types'
import { api } from '../../api'
import { ConfirmDeleteModal } from '../shared/ConfirmDeleteModal'
import { colorWithAlpha } from '../../lib/formatters'
import { StatusPill } from '../shared/StatusComponents'
import { LabeledSelect } from '../shared/FormInputs'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function getStatus(statuses: StatusDefinition[], statusId?: string): StatusDefinition | undefined {
    if (!statusId) return undefined
    return statuses.find((status) => status.id === statusId)
}

export interface PenhorasConsultaTabelaProps {
    activeTab: TabId
    // Records
    penhorasRecords: PenhorasRecord[]
    penhorasRecordsLoading: boolean
    penhorasTotalRecords: number
    // Statuses
    penhorasStatuses: StatusDefinition[]
    penhorasActiveStatuses: StatusDefinition[]
    // Filters
    penhorasFilters: PenhorasRecordFilters
    patchPenhorasFilters: <K extends keyof PenhorasRecordFilters>(key: K, value: PenhorasRecordFilters[K]) => void
    penhorasYears: number[]
    penhorasGestorFilterOptions: string[]
    penhorasActoFilterOptions: string[]
    // Saved views
    penhorasTableViews: SavedView[]
    disabledSavedViewIds: string[]
    activePenhorasSavedViewId: string | null
    applyPenhorasView: (view: SavedView) => void
    togglePenhorasSavedViewDisabled: (id: string) => void
    deletePenhorasSavedView: (id: string) => Promise<void>
    clearPenhorasFilters: () => void
    saveCurrentView: (scope: SavedViewScope, state: Record<string, unknown>) => Promise<void>
    globalSearch: string
    // Totals
    penhorasDashboardTotals: { pendentes: number }
    // Selection / editing
    setSelectedPenhorasRecordId: (id: string) => void
    setIsPenhorasRecordEditing: (v: boolean) => void
    updatePenhorasRecordStatus: (id: string, statusId: string) => Promise<void>
    // Feedback & refresh
    setFeedback: (msg: string) => void
    onRefresh: () => void
    onOpenExport: () => void
}

export function PenhorasConsultaTabela({
    activeTab,
    penhorasRecords,
    penhorasRecordsLoading,
    penhorasTotalRecords,
    penhorasStatuses,
    penhorasActiveStatuses,
    penhorasFilters,
    patchPenhorasFilters,
    penhorasYears,
    penhorasGestorFilterOptions,
    penhorasActoFilterOptions,
    penhorasTableViews,
    disabledSavedViewIds,
    activePenhorasSavedViewId,
    applyPenhorasView,
    togglePenhorasSavedViewDisabled,
    deletePenhorasSavedView,
    clearPenhorasFilters,
    saveCurrentView,
    globalSearch,
    penhorasDashboardTotals,
    setSelectedPenhorasRecordId,
    setIsPenhorasRecordEditing,
    updatePenhorasRecordStatus,
    setFeedback,
    onRefresh,
    onOpenExport,
}: PenhorasConsultaTabelaProps) {
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

    return (
        <section className="panel ds-panel penhoras-panel penhoras-results-panel">
            <div className="row-between wrap">
                <div>
                    <h2>{activeTab === 'consulta' ? 'Consulta Penhoras' : 'Tabela Penhoras'}</h2>
                    <p className="small-note">Registos de penhoras isolados dos módulos de recibos e DS.</p>
                </div>
                <div className="saved-view-bar ds-saved-view-bar">
                    {penhorasTableViews.map((view) => {
                        const isDisabled = disabledSavedViewIds.includes(view.id)
                        const isActive = activePenhorasSavedViewId === view.id && !isDisabled
                        return (
                            <div key={view.id} className={`saved-view-chip ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`}>
                                <button
                                    className="subtle-btn saved-view-apply"
                                    type="button"
                                    onClick={() => applyPenhorasView(view)}
                                    disabled={isDisabled}
                                    title={isDisabled ? 'Vista Penhoras desativada' : `Aplicar vista: ${view.name}`}
                                >
                                    {view.name}
                                </button>
                                <button
                                    className="subtle-btn icon-btn micro"
                                    type="button"
                                    onClick={() => togglePenhorasSavedViewDisabled(view.id)}
                                    title={isDisabled ? 'Ativar vista Penhoras' : 'Desativar vista Penhoras'}
                                    aria-label={isDisabled ? 'Ativar vista Penhoras' : 'Desativar vista Penhoras'}
                                >
                                    {isDisabled ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                                <button
                                    className="subtle-btn icon-btn micro danger"
                                    type="button"
                                    onClick={() => void deletePenhorasSavedView(view.id)}
                                    title="Eliminar vista Penhoras"
                                    aria-label="Eliminar vista Penhoras"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )
                    })}
                    <button className="subtle-btn" type="button" onClick={() => clearPenhorasFilters()}>
                        <FilterX size={15} />
                        Limpar filtros
                    </button>
                    <button className="subtle-btn" type="button" onClick={() => void saveCurrentView('penhoras-tabela', { ...penhorasFilters, q: globalSearch })}>
                        Guardar vista
                    </button>
                    <button className="subtle-btn" type="button" onClick={onOpenExport}>
                        <Download size={15} />
                        Exportar
                    </button>
                </div>
            </div>

            <div className="filters-row seven ds-filters-row">
                <LabeledSelect
                    label="Estado"
                    value={String(penhorasFilters.estadoId ?? 'todos')}
                    onChange={(value) => patchPenhorasFilters('estadoId', value as PenhorasRecordFilters['estadoId'])}
                    options={[{ value: 'todos', label: 'Todos' }, ...penhorasActiveStatuses.map((status) => ({ value: status.id, label: status.label }))]}
                />
                <LabeledSelect
                    label="Ano"
                    value={String(penhorasFilters.ano ?? 'todos')}
                    onChange={(value) => patchPenhorasFilters('ano', value === 'todos' ? 'todos' : Number(value))}
                    options={[{ value: 'todos', label: 'Todos' }, ...penhorasYears.map((year) => ({ value: String(year), label: String(year) }))]}
                />
                <LabeledSelect
                    label="Mês"
                    value={String(penhorasFilters.mes ?? 'todos')}
                    onChange={(value) => patchPenhorasFilters('mes', value === 'todos' ? 'todos' : Number(value))}
                    options={[{ value: 'todos', label: 'Todos' }, ...MONTHS.map((label, index) => ({ value: String(index + 1), label }))]}
                />
                <LabeledSelect
                    label="Gestor"
                    value={String(penhorasFilters.gestor ?? '')}
                    onChange={(value) => patchPenhorasFilters('gestor', value)}
                    options={[{ value: '', label: 'Todos' }, ...penhorasGestorFilterOptions.map((value) => ({ value, label: value }))]}
                />
                <LabeledSelect
                    label="Acto"
                    value={String(penhorasFilters.acto ?? '')}
                    onChange={(value) => patchPenhorasFilters('acto', value)}
                    options={[{ value: '', label: 'Todos' }, ...penhorasActoFilterOptions.map((value) => ({ value, label: value }))]}
                />
                <div className="field">
                    <span>Total</span>
                    <div className="counter-box">{penhorasRecordsLoading ? 'A carregar...' : `${penhorasTotalRecords} registos`}</div>
                </div>
                <div className="field">
                    <span>Aguarda registo</span>
                    <div className="counter-box">{new Intl.NumberFormat('pt-PT').format(penhorasDashboardTotals.pendentes)}</div>
                </div>
            </div>

            {penhorasRecords.length === 0 ? (
                <div className="empty-text">Sem resultados Penhoras para os filtros selecionados.</div>
            ) : activeTab === 'consulta' ? (
                <div className="card-list ds-card-list">
                    {penhorasRecords.map((record) => {
                        const status = getStatus(penhorasStatuses, record.estadoId)
                        return (
                            <article key={record.id} className="result-card penhoras-result-card clickable-row" onClick={() => setSelectedPenhorasRecordId(record.id)}>
                                <div className="result-main ds-result-main">
                                    <div className="result-title ds-result-title">{record.identificacao || record.pe || 'Sem identificação'}</div>
                                    <div className="muted ds-result-secondary">
                                        <span>PE: {record.pe || '-'}</span>
                                        <span> · Pedido: {record.pedido || '-'}</span>
                                    </div>
                                </div>
                                <div className="result-entity muted ds-result-meta">{`Gestor: ${record.gestor || '-'} · ${record.acto || 'Acto por definir'}`}</div>
                                <div className="ds-result-metrics">
                                    <strong>{record.dataPedido || '-'}</strong>
                                    <span>Data pedido</span>
                                </div>
                                <div className="card-actions ds-card-actions">
                                    <button
                                        className="subtle-btn"
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            setSelectedPenhorasRecordId(record.id)
                                            setIsPenhorasRecordEditing(true)
                                        }}
                                    >
                                        Editar
                                    </button>
                                    <button
                                        className="subtle-btn compact danger"
                                        type="button"
                                        title="Mover para lixeira"
                                        aria-label="Mover para lixeira"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            setDeleteTarget(record.id)
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                <div className="result-status ds-result-status">
                                    {status ? <StatusPill status={status} /> : <span className="muted ds-status-pill-empty">Sem estado</span>}
                                </div>
                            </article>
                        )
                    })}
                </div>
            ) : (
                <div className="table-wrapper ds-table-wrapper">
                    <table className="records-table ds-records-table">
                        <thead>
                            <tr>
                                <th>PE</th>
                                <th>Acto</th>
                                <th>Data Pedido</th>
                                <th>Identificação</th>
                                <th>Pedido</th>
                                <th>Gestor</th>
                                <th>Estado</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {penhorasRecords.map((record) => {
                                const status = getStatus(penhorasStatuses, record.estadoId)
                                const hasStatusOption = penhorasActiveStatuses.some((statusOption) => statusOption.id === record.estadoId)
                                const statusValue = hasStatusOption ? record.estadoId : ''
                                return (
                                    <tr
                                        key={record.id}
                                        style={{ backgroundColor: status ? colorWithAlpha(status.color, '1F') : undefined }}
                                        onClick={(event) => {
                                            const target = event.target as HTMLElement
                                            if (target.closest('button, select, option, input, textarea, a')) return
                                            setSelectedPenhorasRecordId(record.id)
                                        }}
                                    >
                                        <td>{record.pe || '-'}</td>
                                        <td>{record.acto || '-'}</td>
                                        <td>{record.dataPedido || '-'}</td>
                                        <td>{record.identificacao || '-'}</td>
                                        <td>{record.pedido || '-'}</td>
                                        <td>{record.gestor || '-'}</td>
                                        <td>
                                            <select
                                                className="ds-status-select"
                                                value={statusValue}
                                                onMouseDown={(event) => event.stopPropagation()}
                                                onClick={(event) => event.stopPropagation()}
                                                onChange={(event) => void updatePenhorasRecordStatus(record.id, event.target.value)}
                                            >
                                                {!hasStatusOption && <option value="">Selecionar estado...</option>}
                                                {penhorasActiveStatuses.map((statusOption) => (
                                                    <option key={statusOption.id} value={statusOption.id}>{statusOption.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                <button
                                                    className="subtle-btn compact"
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        setSelectedPenhorasRecordId(record.id)
                                                        setIsPenhorasRecordEditing(true)
                                                    }}
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    className="subtle-btn compact danger"
                                                    type="button"
                                                    title="Mover para lixeira"
                                                    aria-label="Mover para lixeira"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        setDeleteTarget(record.id)
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <ConfirmDeleteModal
                open={deleteTarget !== null}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={async () => {
                    if (!deleteTarget) return
                    try {
                        await api.deletePenhorasRecord(deleteTarget)
                        setFeedback('Registo Penhoras movido para a lixeira.')
                    } catch (err) {
                        setFeedback(err instanceof Error ? err.message : 'Erro ao eliminar registo Penhoras.')
                    } finally {
                        setDeleteTarget(null)
                        onRefresh()
                    }
                }}
            />
        </section>
    )
}
