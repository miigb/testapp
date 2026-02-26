import { type ReactNode, type Dispatch, type SetStateAction } from 'react'
import { Eye, EyeOff, FilterX, Maximize2, Plus, Trash2, Download } from 'lucide-react'
import type { PenhorasRecordFilters, StatusDefinition } from '../../types'
import type { PenhorasDashboardWidget, PenhorasDashboardWidgetType } from '../../lib/dashboardWidgets'
import { PENHORAS_DASHBOARD_WIDGET_LIBRARY, cloneDefaultPenhorasDashboardWidgets } from '../../lib/dashboardWidgets'
import type { SavedView, SavedViewScope } from '../../types'
import { LabeledSelect } from '../shared/FormInputs'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export interface PenhorasDashboardsProps {
    isDashboardFocusMode: boolean
    setDashboardFocusMode: (v: boolean) => void
    penhorasDashboardViews: SavedView[]
    disabledSavedViewIds: string[]
    activePenhorasSavedViewId: string | null
    applyPenhorasView: (view: SavedView) => void
    togglePenhorasSavedViewDisabled: (id: string) => void
    deletePenhorasSavedView: (id: string) => Promise<void>
    clearPenhorasFilters: () => void
    saveCurrentView: (scope: SavedViewScope, state: Record<string, unknown>) => Promise<void>
    penhorasFilters: PenhorasRecordFilters
    globalSearch: string
    penhorasDashboardConfigOpen: boolean
    setPenhorasDashboardConfigOpen: Dispatch<SetStateAction<boolean>>
    penhorasDashboardWidgetsOpen: boolean
    setPenhorasDashboardWidgetsOpen: Dispatch<SetStateAction<boolean>>
    penhorasDashboardPickerOpen: boolean
    setPenhorasDashboardPickerOpen: Dispatch<SetStateAction<boolean>>
    penhorasDashboardWidgets: PenhorasDashboardWidget[]
    setPenhorasDashboardWidgets: (widgets: PenhorasDashboardWidget[]) => void
    penhorasDashboardMainWidgets: PenhorasDashboardWidget[]
    penhorasDashboardSideWidgets: PenhorasDashboardWidget[]
    penhorasDashboardHasSideStack: boolean
    addPenhorasDashboardWidget: (type: PenhorasDashboardWidgetType) => void
    renderPenhorasDashboardWidget: (widget: PenhorasDashboardWidget) => ReactNode
    penhorasDashboardTotals: { registos: number; comDataPedido: number; recusados: number; pendentes: number }
    penhorasActiveStatuses: StatusDefinition[]
    penhorasYears: number[]
    penhorasGestorFilterOptions: string[]
    penhorasActoFilterOptions: string[]
    patchPenhorasFilters: <K extends keyof PenhorasRecordFilters>(key: K, value: PenhorasRecordFilters[K]) => void
    penhorasRecordsLoading: boolean
    penhorasTotalRecords: number
    onOpenExport: () => void
}

export function PenhorasDashboards({
    isDashboardFocusMode,
    setDashboardFocusMode,
    penhorasDashboardViews,
    disabledSavedViewIds,
    activePenhorasSavedViewId,
    applyPenhorasView,
    togglePenhorasSavedViewDisabled,
    deletePenhorasSavedView,
    clearPenhorasFilters,
    saveCurrentView,
    penhorasFilters,
    globalSearch,
    penhorasDashboardConfigOpen,
    setPenhorasDashboardConfigOpen,
    penhorasDashboardWidgetsOpen,
    setPenhorasDashboardWidgetsOpen,
    penhorasDashboardPickerOpen,
    setPenhorasDashboardPickerOpen,
    penhorasDashboardWidgets,
    setPenhorasDashboardWidgets,
    penhorasDashboardMainWidgets,
    penhorasDashboardSideWidgets,
    penhorasDashboardHasSideStack,
    addPenhorasDashboardWidget,
    renderPenhorasDashboardWidget,
    penhorasDashboardTotals,
    penhorasActiveStatuses,
    penhorasYears,
    penhorasGestorFilterOptions,
    penhorasActoFilterOptions,
    patchPenhorasFilters,
    penhorasRecordsLoading,
    penhorasTotalRecords,
    onOpenExport,
}: PenhorasDashboardsProps) {

    return (
        <section className="panel dashboard-experiment ds-panel penhoras-panel penhoras-dashboard-panel" id="penhoras-dashboard-view">
            {!isDashboardFocusMode && (
                <>
                    <div className="row-between wrap">
                        <div>
                            <h2>Dashboards Penhoras</h2>
                            <p className="small-note">Acompanhamento de volume, estado e distribuição temporal dos registos de penhoras.</p>
                        </div>
                        <div className="saved-view-bar ds-saved-view-bar">
                            {penhorasDashboardViews.map((view) => {
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
                            <button
                                className="subtle-btn"
                                type="button"
                                onClick={() => void saveCurrentView('penhoras-dashboard', { ...penhorasFilters, q: globalSearch, widgets: penhorasDashboardWidgets })}
                            >
                                Guardar vista
                            </button>
                        </div>
                    </div>

                    <div className="dashboard-top-actions no-export">
                        <button
                            className="subtle-btn"
                            type="button"
                            onClick={() => {
                                setDashboardFocusMode(true)
                                setPenhorasDashboardWidgetsOpen(true)
                            }}
                        >
                            <Maximize2 size={15} />
                            Expandir dashboard
                        </button>
                        <button className="subtle-btn" type="button" onClick={onOpenExport}>
                            <Download size={15} />
                            Exportar
                        </button>
                        <button className="subtle-btn" type="button" onClick={() => setPenhorasDashboardConfigOpen((current) => !current)}>
                            {penhorasDashboardConfigOpen ? <EyeOff size={15} /> : <Eye size={15} />}
                            {penhorasDashboardConfigOpen ? 'Ocultar painel' : 'Mostrar painel'}
                        </button>
                        <button className="subtle-btn" type="button" onClick={() => setPenhorasDashboardWidgetsOpen((current) => !current)}>
                            {penhorasDashboardWidgetsOpen ? 'Ocultar widgets' : 'Mostrar widgets'}
                        </button>
                        <button className="subtle-btn" type="button" onClick={() => setPenhorasDashboardPickerOpen((current) => !current)}>
                            <Plus size={15} />
                            {penhorasDashboardPickerOpen ? 'Ocultar catálogo' : 'Adicionar widgets'}
                        </button>
                        <button className="subtle-btn" type="button" onClick={() => setPenhorasDashboardWidgets(cloneDefaultPenhorasDashboardWidgets())}>
                            Repor widgets
                        </button>
                    </div>

                    {penhorasDashboardConfigOpen ? (
                        <>
                            <div className="dashboard-hero-grid ds-dashboard-hero">
                                <article className="dashboard-hero-card ds-dashboard-hero-card">
                                    <span>Total registos</span>
                                    <strong>{new Intl.NumberFormat('pt-PT').format(penhorasDashboardTotals.registos)}</strong>
                                </article>
                                <article className="dashboard-hero-card ds-dashboard-hero-card">
                                    <span>Com data pedido</span>
                                    <strong>{new Intl.NumberFormat('pt-PT').format(penhorasDashboardTotals.comDataPedido)}</strong>
                                </article>
                                <article className="dashboard-hero-card ds-dashboard-hero-card">
                                    <span>Recusados/Desistência</span>
                                    <strong>{new Intl.NumberFormat('pt-PT').format(penhorasDashboardTotals.recusados)}</strong>
                                </article>
                            </div>

                            <div className="filters-row seven ds-filters-row no-export">
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

                            <div className="dashboard-picker-wrap no-export">
                                <button className="subtle-btn" type="button" onClick={() => setPenhorasDashboardPickerOpen((current) => !current)}>
                                    {penhorasDashboardPickerOpen ? 'Ocultar widgets' : 'Adicionar widgets'}
                                </button>
                                {penhorasDashboardPickerOpen && (
                                    <div className="dashboard-widget-library">
                                        {PENHORAS_DASHBOARD_WIDGET_LIBRARY.map((widget) => (
                                            <button
                                                key={widget.type}
                                                className="dashboard-widget-option"
                                                type="button"
                                                onClick={() => addPenhorasDashboardWidget(widget.type)}
                                            >
                                                <strong>{widget.label}</strong>
                                                <span>{widget.hint}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="dashboard-collapsed-note muted no-export">
                            Painel de configuração oculto. Use &ldquo;Mostrar painel&rdquo; para editar filtros.
                        </div>
                    )}
                </>
            )}

            {penhorasDashboardWidgetsOpen || isDashboardFocusMode ? (
                penhorasDashboardWidgets.length === 0 ? (
                    <div className="empty-text dashboard-empty">
                        Sem widgets ativos.
                        <button className="subtle-btn" type="button" onClick={() => setPenhorasDashboardWidgets(cloneDefaultPenhorasDashboardWidgets())}>
                            Repor widgets
                        </button>
                    </div>
                ) : (
                    <div className={`dashboard-grid ds-dashboard-grid ${penhorasDashboardHasSideStack ? 'with-side-stack' : ''}`}>
                        {penhorasDashboardHasSideStack ? (
                            <>
                                <div className="dashboard-main-widgets">
                                    {penhorasDashboardMainWidgets.map((widget) => renderPenhorasDashboardWidget(widget))}
                                </div>
                                <aside className="dashboard-side-widgets">
                                    {penhorasDashboardSideWidgets.map((widget) => renderPenhorasDashboardWidget(widget))}
                                </aside>
                            </>
                        ) : penhorasDashboardSideWidgets.length > 0 && penhorasDashboardMainWidgets.length === 0 ? (
                            <aside className="dashboard-side-widgets">
                                {penhorasDashboardSideWidgets.map((widget) => renderPenhorasDashboardWidget(widget))}
                            </aside>
                        ) : (
                            penhorasDashboardWidgets.map((widget) => renderPenhorasDashboardWidget(widget))
                        )}
                    </div>
                )
            ) : (
                <div className="dashboard-collapsed-note muted">
                    Widgets ocultos. Use &ldquo;Mostrar widgets&rdquo; para voltar a apresentar o dashboard.
                </div>
            )}

        </section>
    )
}
