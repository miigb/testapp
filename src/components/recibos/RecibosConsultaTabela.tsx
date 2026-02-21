import { useState } from 'react'
import { Eye, EyeOff, FilterX, Trash2, Download } from 'lucide-react'
import type { ReceiptRecord, RecordFilters, StatusDefinition, SavedView, SavedViewScope, TabId } from '../../types'
import type { TotalMetricKey } from '../../constants'
import { TOTAL_METRIC_OPTIONS } from '../../constants'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
import { colorWithAlpha } from '../../lib/formatters'
import { getPrimaryRecordReference, getSecondaryRecordReference } from '../../lib/recordHelpers'
import { StatusPill, EntityIdentity } from '../shared/StatusComponents'
import { LabeledSelect, AutocompleteInput } from '../shared/FormInputs'
import { ExportComposer } from '../shared/ExportComposer'
import type { ExportColumn } from '../../lib/exportGenerators'

function getStatus(statuses: StatusDefinition[], statusId?: string): StatusDefinition | undefined {
    if (!statusId) return undefined
    return statuses.find((status) => status.id === statusId)
}

export interface RecibosConsultaTabelaProps {
    activeTab: TabId
    // Records
    records: ReceiptRecord[]
    recordsLoading: boolean
    totalRecords: number
    // Statuses
    statuses: StatusDefinition[]
    orderedStatuses: StatusDefinition[]
    // Filters
    filters: RecordFilters
    patchFilters: <K extends keyof RecordFilters>(key: K, value: RecordFilters[K]) => void
    years: number[]
    exequenteFilterOptions: string[]
    gestorFilterOptions: string[]
    clearTableFilters: () => void
    // Saved views
    tableViews: SavedView[]
    disabledSavedViewIds: string[]
    activeSavedViewId: string | null
    applyView: (view: SavedView) => void
    toggleSavedViewDisabled: (id: string) => void
    deleteSavedView: (id: string) => Promise<void>
    saveCurrentView: (scope: SavedViewScope, state: Record<string, unknown>) => Promise<void>
    globalSearch: string
    // Totals hover
    totalsHoverOpen: boolean
    setTotalsHoverOpen: (v: boolean | ((prev: boolean) => boolean)) => void
    selectedTotalMetrics: TotalMetricKey[]
    toggleTotalMetric: (key: TotalMetricKey) => void
    totalsSnapshot: Record<TotalMetricKey, number | string>
    // Bulk actions
    bulkSectionOpen: boolean
    setBulkSectionOpen: (updater: (prev: boolean) => boolean) => void
    bulkPanelOpen: boolean
    setBulkPanelOpen: (v: boolean | ((prev: boolean) => boolean)) => void
    selectedIds: string[]
    allSelectedInTable: boolean
    toggleSelectAllRecords: () => void
    toggleSelectRecord: (id: string) => void
    bulkStatusId: string
    setBulkStatusId: (v: string) => void
    runBulkStatusUpdate: () => Promise<void>
    bulkGestor: string
    setBulkGestor: (v: string) => void
    gestorSuggestions: string[]
    bulkExequente: string
    setBulkExequente: (v: string) => void
    exequenteSuggestions: string[]
    bulkIndicacoes: string
    setBulkIndicacoes: (v: string) => void
    bulkForceRecalculate: boolean
    setBulkForceRecalculate: (v: boolean) => void
    runBulkFieldUpdate: () => Promise<void>
    // Selection / editing
    setSelectedRecordId: (id: string) => void
    setIsRecordEditing: (v: boolean) => void
    updateRecordStatus: (id: string, statusId: string) => Promise<void>
    // Formatting
    formatCurrency: (value?: number) => string
}

export function RecibosConsultaTabela({
    activeTab,
    records,
    recordsLoading,
    totalRecords,
    statuses,
    orderedStatuses,
    filters,
    patchFilters,
    years,
    exequenteFilterOptions,
    gestorFilterOptions,
    clearTableFilters,
    tableViews,
    disabledSavedViewIds,
    activeSavedViewId,
    applyView,
    toggleSavedViewDisabled,
    deleteSavedView,
    saveCurrentView,
    globalSearch,
    totalsHoverOpen,
    setTotalsHoverOpen,
    selectedTotalMetrics,
    toggleTotalMetric,
    totalsSnapshot,
    bulkSectionOpen,
    setBulkSectionOpen,
    bulkPanelOpen,
    setBulkPanelOpen,
    selectedIds,
    allSelectedInTable,
    toggleSelectAllRecords,
    toggleSelectRecord,
    bulkStatusId,
    setBulkStatusId,
    runBulkStatusUpdate,
    bulkGestor,
    setBulkGestor,
    gestorSuggestions,
    bulkExequente,
    setBulkExequente,
    exequenteSuggestions,
    bulkIndicacoes,
    setBulkIndicacoes,
    bulkForceRecalculate,
    setBulkForceRecalculate,
    runBulkFieldUpdate,
    setSelectedRecordId,
    setIsRecordEditing,
    updateRecordStatus,
    formatCurrency,
}: RecibosConsultaTabelaProps) {
    const [isExportOpen, setIsExportOpen] = useState(false)

    const exportColumns: ExportColumn[] = [
        { header: 'Tipo', key: 'tipo', width: 15 },
        { header: 'Nº Recibo', key: 'reciboNumero', width: 15 },
        { header: 'Processo', key: 'processo', width: 20 },
        { header: 'PE', key: 'pe', width: 15 },
        { header: 'Mês', key: 'mes', width: 12 },
        { header: 'Ano', key: 'ano', width: 12 },
        { header: 'Honorários', key: 'honorarios', width: 15 },
        { header: 'Custas', key: 'custas', width: 15 },
        { header: 'Iva', key: 'iva', width: 12 },
        { header: 'Exequente', key: 'exequente', width: 25 },
        { header: 'Executado', key: 'executado', width: 25 },
        { header: 'Gestor(a)', key: 'gestor', width: 20 },
        { header: 'Estado', key: 'estadoId', width: 20 },
    ]

    const recordsToExport = selectedIds.length > 0 ? records.filter(r => selectedIds.includes(r.id)) : records

    const exportData = recordsToExport.map(r => ({
        ...r,
        estadoId: getStatus(statuses, r.estadoId)?.label || r.estadoId || 'Sem estado',
    }))

    return (
        <section className="panel">
            <div className="row-between wrap">
                <div>
                    <h2>{activeTab === 'consulta' ? 'Consulta' : 'Tabela'}</h2>
                    <p className="small-note">Filtros avançados por ano, mês, tipo e estado.</p>
                </div>

                <div className="saved-view-bar">
                    {tableViews.map((view) => {
                        const isDisabled = disabledSavedViewIds.includes(view.id)
                        const isActive = activeSavedViewId === view.id && !isDisabled
                        return (
                            <div key={view.id} className={`saved-view-chip ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`}>
                                <button
                                    className="subtle-btn saved-view-apply"
                                    type="button"
                                    onClick={() => applyView(view)}
                                    disabled={isDisabled}
                                    title={isDisabled ? 'Vista desativada' : `Aplicar vista: ${view.name}`}
                                >
                                    {view.name}
                                </button>
                                <button
                                    className="subtle-btn icon-btn micro"
                                    type="button"
                                    onClick={() => toggleSavedViewDisabled(view.id)}
                                    title={isDisabled ? 'Ativar vista' : 'Desativar vista'}
                                    aria-label={isDisabled ? 'Ativar vista' : 'Desativar vista'}
                                >
                                    {isDisabled ? <Eye size={14} /> : <EyeOff size={14} />}
                                </button>
                                <button
                                    className="subtle-btn icon-btn micro danger"
                                    type="button"
                                    onClick={() => void deleteSavedView(view.id)}
                                    title="Eliminar vista"
                                    aria-label="Eliminar vista"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )
                    })}
                    <div
                        className="totals-hover-wrap"
                        onMouseEnter={() => setTotalsHoverOpen(true)}
                        onMouseLeave={() => setTotalsHoverOpen(false)}
                    >
                        <button
                            className="subtle-btn totals-trigger"
                            type="button"
                            onClick={() => setTotalsHoverOpen((current) => !current)}
                            aria-expanded={totalsHoverOpen}
                            aria-haspopup="dialog"
                        >
                            Totais
                        </button>
                        {totalsHoverOpen && (
                            <div className="totals-hover-panel" role="dialog" aria-label="Selecionar totais">
                                <div className="totals-options">
                                    {TOTAL_METRIC_OPTIONS.map((option) => (
                                        <label key={option.key} className="totals-option">
                                            <input
                                                type="checkbox"
                                                checked={selectedTotalMetrics.includes(option.key)}
                                                onChange={() => toggleTotalMetric(option.key)}
                                            />
                                            <span>{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="totals-values">
                                    {selectedTotalMetrics.map((metricKey) => {
                                        const option = TOTAL_METRIC_OPTIONS.find((item) => item.key === metricKey)
                                        if (!option) return null
                                        const value = totalsSnapshot[metricKey]
                                        return (
                                            <div key={metricKey} className="totals-value-item">
                                                <span>{option.label}</span>
                                                <strong>{option.currency ? formatCurrency(typeof value === 'number' ? value : undefined) : String(value)}</strong>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    <button className="subtle-btn" type="button" onClick={() => clearTableFilters()}>
                        <FilterX size={15} />
                        Limpar filtros
                    </button>
                    <button
                        className="subtle-btn"
                        type="button"
                        onClick={() => void saveCurrentView('tabela', { ...filters, q: globalSearch })}
                    >
                        Guardar vista
                    </button>
                    <button
                        className="subtle-btn"
                        type="button"
                        onClick={() => setIsExportOpen(true)}
                    >
                        <Download size={15} />
                        Exportar
                    </button>
                </div>
            </div>

            <div className="filters-row seven">
                <LabeledSelect
                    label="Tipo"
                    value={String(filters.tipo ?? 'todos')}
                    onChange={(value) => patchFilters('tipo', value as RecordFilters['tipo'])}
                    options={[
                        { value: 'todos', label: 'Todos' },
                        { value: 'exequente', label: 'Exequentes' },
                        { value: 'executado', label: 'Executados' },
                    ]}
                />
                <LabeledSelect
                    label="Estado"
                    value={String(filters.estadoId ?? 'todos')}
                    onChange={(value) => patchFilters('estadoId', value as RecordFilters['estadoId'])}
                    options={[{ value: 'todos', label: 'Todos' }, ...orderedStatuses.map((status) => ({ value: status.id, label: status.label }))]}
                />
                <LabeledSelect
                    label="Mês"
                    value={String(filters.mes ?? 'todos')}
                    onChange={(value) => patchFilters('mes', value === 'todos' ? 'todos' : Number(value))}
                    options={[{ value: 'todos', label: 'Todos' }, ...MONTHS.map((label, index) => ({ value: String(index + 1), label }))]}
                />
                <LabeledSelect
                    label="Ano"
                    value={String(filters.ano ?? 'todos')}
                    onChange={(value) => patchFilters('ano', value === 'todos' ? 'todos' : Number(value))}
                    options={[{ value: 'todos', label: 'Todos' }, ...years.map((year) => ({ value: String(year), label: String(year) }))]}
                />
                <LabeledSelect
                    label="Exequente"
                    value={String(filters.exequente ?? '')}
                    onChange={(value) => patchFilters('exequente', value)}
                    options={[{ value: '', label: 'Todos' }, ...exequenteFilterOptions.map((value) => ({ value, label: value }))]}
                />
                <LabeledSelect
                    label="Gestor"
                    value={String(filters.gestor ?? '')}
                    onChange={(value) => patchFilters('gestor', value)}
                    options={[{ value: '', label: 'Todos' }, ...gestorFilterOptions.map((value) => ({ value, label: value }))]}
                />
                <div className="field">
                    <span>Total</span>
                    <div className="counter-box">{recordsLoading ? 'A carregar...' : `${totalRecords} registos`}</div>
                </div>
            </div>

            {activeTab === 'tabela' && (
                <div className="bulk-panel">
                    <div className="bulk-panel-header">
                        <button
                            className="subtle-btn"
                            type="button"
                            onClick={() => {
                                setBulkSectionOpen((current) => {
                                    const next = !current
                                    if (!next) setBulkPanelOpen(false)
                                    return next
                                })
                            }}
                            aria-expanded={bulkSectionOpen}
                        >
                            {bulkSectionOpen ? 'Ocultar ações em lote' : 'Mostrar ações em lote'}
                        </button>
                        <span className="bulk-selected-badge">{selectedIds.length} selecionados</span>
                    </div>

                    {bulkSectionOpen && (
                        <>
                            <div className="bulk-row bulk-row-top">
                                <label className="inline-check">
                                    <input type="checkbox" checked={allSelectedInTable} onChange={toggleSelectAllRecords} />
                                    Selecionar todos
                                </label>
                                <button className="subtle-btn" type="button" onClick={() => setIsExportOpen(true)}>
                                    <Download size={15} />
                                    Exportar {selectedIds.length > 0 ? "Selecionados" : "Vista Atual"}
                                </button>
                            </div>

                            <div className="bulk-row bulk-row-main">
                                <label className="field bulk-inline-field">
                                    <span>Novo estado</span>
                                    <select value={bulkStatusId} onChange={(event) => setBulkStatusId(event.target.value)}>
                                        {orderedStatuses.map((status) => (
                                            <option key={status.id} value={status.id}>{status.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <button className="primary-btn" type="button" onClick={() => void runBulkStatusUpdate()} disabled={selectedIds.length === 0}>
                                    Aplicar estado
                                </button>
                                <button className="subtle-btn" type="button" onClick={() => setBulkPanelOpen((current) => !current)}>
                                    {bulkPanelOpen ? 'Ocultar edição avançada' : 'Editar campos em lote'}
                                </button>
                            </div>

                            {bulkPanelOpen && (
                                <div className="bulk-advanced">
                                    <div className="bulk-advanced-grid">
                                        <label className="field">
                                            <span>Gestor (lote)</span>
                                            <AutocompleteInput
                                                value={bulkGestor}
                                                onChange={(value) => setBulkGestor(value)}
                                                suggestions={gestorSuggestions}
                                                placeholder="Gestor"
                                            />
                                        </label>
                                        <label className="field">
                                            <span>Exequente (lote)</span>
                                            <AutocompleteInput
                                                value={bulkExequente}
                                                onChange={(value) => setBulkExequente(value)}
                                                suggestions={exequenteSuggestions}
                                                placeholder="Exequente"
                                            />
                                        </label>
                                        <label className="field">
                                            <span>Indicações (lote)</span>
                                            <input
                                                value={bulkIndicacoes}
                                                onChange={(event) => setBulkIndicacoes(event.target.value)}
                                                placeholder="Indicações"
                                                aria-label="Indicações em lote"
                                            />
                                        </label>
                                    </div>
                                    <div className="bulk-row bulk-row-advanced-actions">
                                        <label className="inline-check">
                                            <input
                                                type="checkbox"
                                                checked={bulkForceRecalculate}
                                                onChange={(event) => setBulkForceRecalculate(event.target.checked)}
                                            />
                                            Recalcular impostos automaticamente
                                        </label>
                                        <button className="subtle-btn" type="button" onClick={() => void runBulkFieldUpdate()} disabled={selectedIds.length === 0}>
                                            Aplicar edição avançada
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {records.length === 0 ? (
                <div className="empty-text">Sem resultados para os filtros selecionados.</div>
            ) : activeTab === 'consulta' ? (
                <div className="card-list">
                    {records.map((record) => {
                        const status = getStatus(statuses, record.estadoId)
                        const primaryReference = getPrimaryRecordReference(record)
                        const secondaryReference = getSecondaryRecordReference(record)
                        const monthYear = `${MONTHS[record.mes - 1] ?? `Mês ${record.mes}`} ${record.ano}`
                        return (
                            <article key={record.id} className="result-card clickable-row" onClick={() => setSelectedRecordId(record.id)}>
                                <div className="result-main">
                                    <div className="result-title">{primaryReference}</div>
                                    <div className="muted">{secondaryReference ? `${secondaryReference} · ${monthYear}` : monthYear}</div>
                                </div>
                                <div className="result-entity muted">
                                    <EntityIdentity gestor={record.gestor} exequente={record.exequente} />
                                </div>
                                <div className="result-value">{formatCurrency(record.valorEmissao ?? record.valorSemIva ?? record.valorIndicado)}</div>
                                <div className="card-actions">
                                    <button
                                        className="subtle-btn"
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            setSelectedRecordId(record.id)
                                            setIsRecordEditing(true)
                                        }}
                                    >
                                        Editar
                                    </button>
                                </div>
                                <div className="result-status">
                                    {status ? <StatusPill status={status} /> : <span className="muted">Sem estado</span>}
                                </div>
                            </article>
                        )
                    })}
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="records-table">
                        <thead>
                            <tr>
                                <th></th>
                                <th>Tipo</th>
                                <th>Ano/Mês</th>
                                <th>PE</th>
                                <th>Processo</th>
                                <th>Recibo</th>
                                <th>Gestor/Exequente</th>
                                <th>Sem IVA</th>
                                <th>IVA</th>
                                <th>Retenção</th>
                                <th>Meu 5%</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((record) => {
                                const status = getStatus(statuses, record.estadoId)
                                return (
                                    <tr
                                        key={record.id}
                                        style={{ backgroundColor: status ? colorWithAlpha(status.color, '1F') : undefined }}
                                        onClick={() => setSelectedRecordId(record.id)}
                                    >
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(record.id)}
                                                onClick={(event) => event.stopPropagation()}
                                                onChange={() => toggleSelectRecord(record.id)}
                                            />
                                        </td>
                                        <td>{record.tipo === 'exequente' ? 'Exequente' : 'Executado'}</td>
                                        <td>{record.ano}/{String(record.mes).padStart(2, '0')}</td>
                                        <td>{record.pe || '-'}</td>
                                        <td>{record.processo || '-'}</td>
                                        <td>{record.reciboNumero || '-'}</td>
                                        <td>
                                            <EntityIdentity gestor={record.gestor} exequente={record.exequente} />
                                        </td>
                                        <td>{formatCurrency(record.valorSemIva)}</td>
                                        <td>{formatCurrency(record.iva)}</td>
                                        <td>{formatCurrency(record.retencao)}</td>
                                        <td>{formatCurrency(record.meu5)}</td>
                                        <td>
                                            <div className="status-cell-actions">
                                                <select
                                                    value={record.estadoId}
                                                    onClick={(event) => event.stopPropagation()}
                                                    onChange={(event) => void updateRecordStatus(record.id, event.target.value)}
                                                >
                                                    {orderedStatuses.map((statusOption) => (
                                                        <option key={statusOption.id} value={statusOption.id}>{statusOption.label}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    className="subtle-btn compact"
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        setSelectedRecordId(record.id)
                                                        setIsRecordEditing(true)
                                                    }}
                                                >
                                                    Editar
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

            <ExportComposer
                isOpen={isExportOpen}
                onClose={() => setIsExportOpen(false)}
                moduleName="Recibos"
                columns={exportColumns}
                data={exportData}
            />
        </section>
    )
}
