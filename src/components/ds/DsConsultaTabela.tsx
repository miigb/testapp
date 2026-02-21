import { useState } from 'react'
import { Eye, EyeOff, FilterX, Trash2, AlertTriangle, Download } from 'lucide-react'
import type { DsRecord, DsRecordFilters, StatusDefinition, SavedView, SavedViewScope, TabId } from '../../types'
import { ExportComposer } from '../shared/ExportComposer'
import type { ExportColumn } from '../../lib/exportGenerators'
import { colorWithAlpha } from '../../lib/formatters'
import { StatusPill } from '../shared/StatusComponents'
import { LabeledSelect } from '../shared/FormInputs'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function getStatus(statuses: StatusDefinition[], statusId?: string): StatusDefinition | undefined {
    if (!statusId) return undefined
    return statuses.find((status) => status.id === statusId)
}

export interface DsConsultaTabelaProps {
    activeTab: TabId
    // Records
    dsRecords: DsRecord[]
    dsRecordsLoading: boolean
    dsTotalRecords: number
    // Statuses
    dsStatuses: StatusDefinition[]
    dsOrderedStatuses: StatusDefinition[]
    // Filters
    dsFilters: DsRecordFilters
    patchDsFilters: <K extends keyof DsRecordFilters>(key: K, value: DsRecordFilters[K]) => void
    dsYears: number[]
    dsGestoraFilterOptions: string[]
    dsEntidadeFilterOptions: string[]
    dsProdutoFilterOptions: string[]
    // Saved views
    dsTableViews: SavedView[]
    disabledSavedViewIds: string[]
    activeDsSavedViewId: string | null
    applyDsView: (view: SavedView) => void
    toggleDsSavedViewDisabled: (id: string) => void
    deleteDsSavedView: (id: string) => Promise<void>
    clearDsFilters: () => void
    saveCurrentView: (scope: SavedViewScope, state: Record<string, unknown>) => Promise<void>
    globalSearch: string
    // Selection / editing
    setSelectedDsRecordId: (id: string) => void
    setIsDsRecordEditing: (v: boolean) => void
    updateDsRecordStatus: (id: string, statusId: string) => Promise<void>
    // Formatting
    formatCurrency: (value?: number) => string
}

export function DsConsultaTabela({
    activeTab,
    dsRecords,
    dsRecordsLoading,
    dsTotalRecords,
    dsStatuses,
    dsOrderedStatuses,
    dsFilters,
    patchDsFilters,
    dsYears,
    dsGestoraFilterOptions,
    dsEntidadeFilterOptions,
    dsProdutoFilterOptions,
    dsTableViews,
    disabledSavedViewIds,
    activeDsSavedViewId,
    applyDsView,
    toggleDsSavedViewDisabled,
    deleteDsSavedView,
    clearDsFilters,
    saveCurrentView,
    globalSearch,
    setSelectedDsRecordId,
    setIsDsRecordEditing,
    updateDsRecordStatus,
    formatCurrency,
}: DsConsultaTabelaProps) {
    const [isExportOpen, setIsExportOpen] = useState(false)

    const exportColumns: ExportColumn[] = [
        { header: 'Proponentes', key: 'proponentes', width: 30 },
        { header: 'Ref.', key: 'referencia', width: 15 },
        { header: 'Gestor(a)', key: 'gestora', width: 25 },
        { header: 'Produto', key: 'produto', width: 20 },
        { header: 'Entidade Bancária', key: 'entidadeBancaria', width: 20 },
        { header: 'Data Escritura', key: 'dataEscritura', width: 15 },
        { header: 'Valor', key: 'valor', width: 15 },
        { header: 'Comissão Loja', key: 'comissaoLoja', width: 15 },
        { header: 'Comissão Gestor', key: 'comissaoGestor', width: 15 },
        { header: 'Falta Recibo', key: 'faltaReciboGestora', width: 25 },
        { header: 'Estado', key: 'estadoId', width: 25 },
    ]

    const exportData = dsRecords.map(r => ({
        ...r,
        estadoId: getStatus(dsStatuses, r.estadoId)?.label || r.estadoId || 'Sem estado',
    }))

    return (
        <section className="panel ds-panel ds-results-panel">
            <div className="row-between wrap">
                <div>
                    <h2>{activeTab === 'consulta' ? 'Consulta DS' : 'Tabela DS'}</h2>
                    <p className="small-note">Registos de escrituras DS isolados do módulo de recibos.</p>
                </div>
                <div className="saved-view-bar ds-saved-view-bar">
                    {dsTableViews.map((view) => {
                        const isDisabled = disabledSavedViewIds.includes(view.id)
                        const isActive = activeDsSavedViewId === view.id && !isDisabled
                        return (
                            <div key={view.id} className={`saved-view-chip ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`}>
                                <button
                                    className="subtle-btn saved-view-apply"
                                    type="button"
                                    onClick={() => applyDsView(view)}
                                    disabled={isDisabled}
                                    title={isDisabled ? 'Vista DS desativada' : `Aplicar vista: ${view.name}`}
                                >
                                    {view.name}
                                </button>
                                <button
                                    className="subtle-btn icon-btn micro"
                                    type="button"
                                    onClick={() => toggleDsSavedViewDisabled(view.id)}
                                    title={isDisabled ? 'Ativar vista DS' : 'Desativar vista DS'}
                                    aria-label={isDisabled ? 'Ativar vista DS' : 'Desativar vista DS'}
                                >
                                    {isDisabled ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                                <button
                                    className="subtle-btn icon-btn micro danger"
                                    type="button"
                                    onClick={() => void deleteDsSavedView(view.id)}
                                    title="Eliminar vista DS"
                                    aria-label="Eliminar vista DS"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )
                    })}
                    <button className="subtle-btn" type="button" onClick={() => clearDsFilters()}>
                        <FilterX size={15} />
                        Limpar filtros
                    </button>
                    <button className="subtle-btn" type="button" onClick={() => void saveCurrentView('ds-tabela', { ...dsFilters, q: globalSearch })}>
                        Guardar vista
                    </button>
                    <button className="subtle-btn" type="button" onClick={() => setIsExportOpen(true)}>
                        <Download size={15} />
                        Exportar
                    </button>
                </div>
            </div>

            <div className="filters-row eight ds-filters-row">
                <LabeledSelect
                    label="Estado"
                    value={String(dsFilters.estadoId ?? 'todos')}
                    onChange={(value) => patchDsFilters('estadoId', value as DsRecordFilters['estadoId'])}
                    options={[{ value: 'todos', label: 'Todos' }, ...dsOrderedStatuses.map((status) => ({ value: status.id, label: status.label }))]}
                />
                <LabeledSelect
                    label="Ano"
                    value={String(dsFilters.ano ?? 'todos')}
                    onChange={(value) => patchDsFilters('ano', value === 'todos' ? 'todos' : Number(value))}
                    options={[{ value: 'todos', label: 'Todos' }, ...dsYears.map((year) => ({ value: String(year), label: String(year) }))]}
                />
                <LabeledSelect
                    label="Mês"
                    value={String(dsFilters.mes ?? 'todos')}
                    onChange={(value) => patchDsFilters('mes', value === 'todos' ? 'todos' : Number(value))}
                    options={[{ value: 'todos', label: 'Todos' }, ...MONTHS.map((label, index) => ({ value: String(index + 1), label }))]}
                />
                <LabeledSelect
                    label="Gestora"
                    value={String(dsFilters.gestora ?? '')}
                    onChange={(value) => patchDsFilters('gestora', value)}
                    options={[{ value: '', label: 'Todas' }, ...dsGestoraFilterOptions.map((value) => ({ value, label: value }))]}
                />
                <LabeledSelect
                    label="Entidade"
                    value={String(dsFilters.entidadeBancaria ?? '')}
                    onChange={(value) => patchDsFilters('entidadeBancaria', value)}
                    options={[{ value: '', label: 'Todas' }, ...dsEntidadeFilterOptions.map((value) => ({ value, label: value }))]}
                />
                <LabeledSelect
                    label="Produto"
                    value={String(dsFilters.produto ?? '')}
                    onChange={(value) => patchDsFilters('produto', value)}
                    options={[{ value: '', label: 'Todos' }, ...dsProdutoFilterOptions.map((value) => ({ value, label: value }))]}
                />
                <LabeledSelect
                    label="Recibo"
                    value={String(dsFilters.reciboEstado ?? 'todos')}
                    onChange={(value) => patchDsFilters('reciboEstado', value as DsRecordFilters['reciboEstado'])}
                    options={[
                        { value: 'todos', label: 'Todos' },
                        { value: 'com-recibo', label: 'Com recibo' },
                        { value: 'sem-recibo', label: 'Sem recibo' },
                    ]}
                />
                <div className="field">
                    <span>Total</span>
                    <div className="counter-box">{dsRecordsLoading ? 'A carregar...' : `${dsTotalRecords} registos`}</div>
                </div>
            </div>

            {dsRecords.length === 0 ? (
                <div className="empty-text">Sem resultados DS para os filtros selecionados.</div>
            ) : activeTab === 'consulta' ? (
                <div className="card-list ds-card-list">
                    {dsRecords.map((record) => {
                        const status = getStatus(dsStatuses, record.estadoId)
                        return (
                            <article key={record.id} className="result-card ds-result-card clickable-row" onClick={() => setSelectedDsRecordId(record.id)}>
                                <div className="result-main ds-result-main">
                                    <div className="result-title ds-result-title">{record.proponentes || 'Sem proponentes'}</div>
                                    <div className="muted ds-result-secondary">
                                        <span>Gestor/a: {record.gestora || '-'}</span>
                                        <span>Referência: {record.referencia || '-'}</span>
                                    </div>
                                </div>
                                <div className="result-entity muted ds-result-meta">
                                    {`Escritura: ${record.dataEscritura || '-'} · ${record.produto || 'Produto por definir'}`}
                                </div>
                                <div className="ds-result-metrics">
                                    <strong>{formatCurrency(record.valor)}</strong>
                                    <span>Comissão loja: {formatCurrency(record.comissaoLoja)}</span>
                                </div>
                                <div className="card-actions ds-card-actions">
                                    <button
                                        className="subtle-btn"
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            setSelectedDsRecordId(record.id)
                                            setIsDsRecordEditing(true)
                                        }}
                                    >
                                        Editar
                                    </button>
                                </div>
                                <div className="result-status ds-result-status">
                                    {record.faltaReciboGestora?.trim() && (
                                        <span className="ds-warning-pill" title={record.faltaReciboGestora}>
                                            <AlertTriangle size={13} />
                                            <span>{record.faltaReciboGestora}</span>
                                        </span>
                                    )}
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
                                <th>Gestor/a</th>
                                <th>Proponentes</th>
                                <th>Valor</th>
                                <th>Data Escritura</th>
                                <th>Comissão Loja</th>
                                <th>Estado</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dsRecords.map((record) => {
                                const status = getStatus(dsStatuses, record.estadoId)
                                return (
                                    <tr
                                        key={record.id}
                                        style={{ backgroundColor: status ? colorWithAlpha(status.color, '1F') : undefined }}
                                        onClick={() => setSelectedDsRecordId(record.id)}
                                    >
                                        <td>{record.gestora || '-'}</td>
                                        <td>{record.proponentes || '-'}</td>
                                        <td>{formatCurrency(record.valor)}</td>
                                        <td>{record.dataEscritura || '-'}</td>
                                        <td>{formatCurrency(record.comissaoLoja)}</td>
                                        <td>
                                            <select
                                                className="ds-status-select"
                                                value={record.estadoId}
                                                onClick={(event) => event.stopPropagation()}
                                                onChange={(event) => void updateDsRecordStatus(record.id, event.target.value)}
                                            >
                                                {dsOrderedStatuses.map((statusOption) => (
                                                    <option key={statusOption.id} value={statusOption.id}>{statusOption.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <button
                                                className="subtle-btn compact"
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    setSelectedDsRecordId(record.id)
                                                    setIsDsRecordEditing(true)
                                                }}
                                            >
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <ExportComposer
                isOpen={isExportOpen}
                onClose={() => setIsExportOpen(false)}
                moduleName="DS (Escrituras)"
                columns={exportColumns}
                data={exportData}
            />
        </section>
    )
}
