import type { ReactNode, Dispatch, SetStateAction } from 'react'
import { Eye, EyeOff, FilterX, Maximize2, Plus, Trash2 } from 'lucide-react'
import type { DsRecordFilters, StatusDefinition } from '../../types'
import type { DsDashboardWidget, DsDashboardWidgetType } from '../../lib/dashboardWidgets'
import { DS_DASHBOARD_WIDGET_LIBRARY, cloneDefaultDsDashboardWidgets } from '../../lib/dashboardWidgets'
import type { SavedView, SavedViewScope } from '../../types'
import { LabeledSelect } from '../shared/FormInputs'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export interface DsDashboardsProps {
    // Focus mode
    isDashboardFocusMode: boolean
    setDashboardFocusMode: (v: boolean) => void
    // Views
    dsDashboardViews: SavedView[]
    disabledSavedViewIds: string[]
    activeDsSavedViewId: string | null
    applyDsView: (view: SavedView) => void
    toggleDsSavedViewDisabled: (id: string) => void
    deleteDsSavedView: (id: string) => Promise<void>
    clearDsFilters: () => void
    saveCurrentView: (scope: SavedViewScope, state: Record<string, unknown>) => Promise<void>
    dsFilters: DsRecordFilters
    globalSearch: string
    // Config panel
    dsDashboardConfigOpen: boolean
    setDsDashboardConfigOpen: Dispatch<SetStateAction<boolean>>
    dsDashboardWidgetsOpen: boolean
    setDsDashboardWidgetsOpen: Dispatch<SetStateAction<boolean>>
    dsDashboardPickerOpen: boolean
    setDsDashboardPickerOpen: Dispatch<SetStateAction<boolean>>
    // Widgets
    dsDashboardWidgets: DsDashboardWidget[]
    setDsDashboardWidgets: (widgets: DsDashboardWidget[]) => void
    dsDashboardMainWidgets: DsDashboardWidget[]
    dsDashboardSideWidgets: DsDashboardWidget[]
    dsDashboardHasSideStack: boolean
    addDsDashboardWidget: (type: DsDashboardWidgetType) => void
    renderDsDashboardWidget: (widget: DsDashboardWidget) => ReactNode
    // Totals
    dsDashboardTotals: { registos: number; comissaoLoja: number; totalComissaoLojaCmIva: number }
    formatCurrency: (value?: number) => string
    // Filters
    dsOrderedStatuses: StatusDefinition[]
    dsYears: number[]
    dsGestoraFilterOptions: string[]
    dsEntidadeFilterOptions: string[]
    dsProdutoFilterOptions: string[]
    patchDsFilters: <K extends keyof DsRecordFilters>(key: K, value: DsRecordFilters[K]) => void
    dsRecordsLoading: boolean
    dsTotalRecords: number
}

export function DsDashboards({
    isDashboardFocusMode,
    setDashboardFocusMode,
    dsDashboardViews,
    disabledSavedViewIds,
    activeDsSavedViewId,
    applyDsView,
    toggleDsSavedViewDisabled,
    deleteDsSavedView,
    clearDsFilters,
    saveCurrentView,
    dsFilters,
    globalSearch,
    dsDashboardConfigOpen,
    setDsDashboardConfigOpen,
    dsDashboardWidgetsOpen,
    setDsDashboardWidgetsOpen,
    dsDashboardPickerOpen,
    setDsDashboardPickerOpen,
    dsDashboardWidgets,
    setDsDashboardWidgets,
    dsDashboardMainWidgets,
    dsDashboardSideWidgets,
    dsDashboardHasSideStack,
    addDsDashboardWidget,
    renderDsDashboardWidget,
    dsDashboardTotals,
    formatCurrency,
    dsOrderedStatuses,
    dsYears,
    dsGestoraFilterOptions,
    dsEntidadeFilterOptions,
    dsProdutoFilterOptions,
    patchDsFilters,
    dsRecordsLoading,
    dsTotalRecords,
}: DsDashboardsProps) {
    return (
        <section className="panel dashboard-experiment ds-panel ds-dashboard-panel">
            {!isDashboardFocusMode && (
                <>
                    <div className="row-between wrap">
                        <div>
                            <h2>Dashboards DS</h2>
                            <p className="small-note">Visão rápida de performance da operação DS com filtros e vistas guardadas.</p>
                        </div>
                        <div className="saved-view-bar ds-saved-view-bar">
                            {dsDashboardViews.map((view) => {
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
                            <button
                                className="subtle-btn"
                                type="button"
                                onClick={() => void saveCurrentView('ds-dashboard', { ...dsFilters, q: globalSearch, widgets: dsDashboardWidgets })}
                            >
                                Guardar vista
                            </button>
                        </div>
                    </div>

                    <div className="dashboard-top-actions">
                        <button
                            className="subtle-btn"
                            type="button"
                            onClick={() => {
                                setDashboardFocusMode(true)
                                setDsDashboardWidgetsOpen(true)
                            }}
                        >
                            <Maximize2 size={15} />
                            Expandir dashboard
                        </button>
                        <button className="subtle-btn" type="button" onClick={() => setDsDashboardConfigOpen((current) => !current)}>
                            {dsDashboardConfigOpen ? <EyeOff size={15} /> : <Eye size={15} />}
                            {dsDashboardConfigOpen ? 'Ocultar painel' : 'Mostrar painel'}
                        </button>
                        <button className="subtle-btn" type="button" onClick={() => setDsDashboardWidgetsOpen((current) => !current)}>
                            {dsDashboardWidgetsOpen ? 'Ocultar widgets' : 'Mostrar widgets'}
                        </button>
                        <button className="subtle-btn" type="button" onClick={() => setDsDashboardPickerOpen((current) => !current)}>
                            <Plus size={15} />
                            {dsDashboardPickerOpen ? 'Ocultar catálogo' : 'Adicionar widgets'}
                        </button>
                        <button className="subtle-btn" type="button" onClick={() => setDsDashboardWidgets(cloneDefaultDsDashboardWidgets())}>
                            Repor widgets
                        </button>
                    </div>

                    {dsDashboardConfigOpen ? (
                        <>
                            <div className="dashboard-hero-grid ds-dashboard-hero">
                                <article className="dashboard-hero-card ds-dashboard-hero-card">
                                    <span>Total registos</span>
                                    <strong>{new Intl.NumberFormat('pt-PT').format(dsDashboardTotals.registos)}</strong>
                                </article>
                                <article className="dashboard-hero-card ds-dashboard-hero-card">
                                    <span>Total comissão loja</span>
                                    <strong>{formatCurrency(dsDashboardTotals.comissaoLoja)}</strong>
                                </article>
                                <article className="dashboard-hero-card ds-dashboard-hero-card">
                                    <span>Total comissão loja c/ IVA</span>
                                    <strong>{formatCurrency(dsDashboardTotals.totalComissaoLojaCmIva)}</strong>
                                </article>
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

                            <div className="dashboard-picker-wrap">
                                <button className="subtle-btn" type="button" onClick={() => setDsDashboardPickerOpen((current) => !current)}>
                                    {dsDashboardPickerOpen ? 'Ocultar widgets' : 'Adicionar widgets'}
                                </button>
                                {dsDashboardPickerOpen && (
                                    <div className="dashboard-widget-library">
                                        {DS_DASHBOARD_WIDGET_LIBRARY.map((widget) => (
                                            <button
                                                key={widget.type}
                                                className="dashboard-widget-option"
                                                type="button"
                                                onClick={() => addDsDashboardWidget(widget.type)}
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
                        <div className="dashboard-collapsed-note muted">
                            Painel de configuração oculto. Use &ldquo;Mostrar painel&rdquo; para editar filtros.
                        </div>
                    )}
                </>
            )}

            {dsDashboardWidgetsOpen || isDashboardFocusMode ? (
                dsDashboardWidgets.length === 0 ? (
                    <div className="empty-text dashboard-empty">
                        Sem widgets ativos.
                        <button className="subtle-btn" type="button" onClick={() => setDsDashboardWidgets(cloneDefaultDsDashboardWidgets())}>
                            Repor widgets
                        </button>
                    </div>
                ) : (
                    <div className={`dashboard-grid ds-dashboard-grid ${dsDashboardHasSideStack ? 'with-side-stack' : ''}`}>
                        {dsDashboardHasSideStack ? (
                            <>
                                <div className="dashboard-main-widgets">{dsDashboardMainWidgets.map((widget) => renderDsDashboardWidget(widget))}</div>
                                <aside className="dashboard-side-widgets">{dsDashboardSideWidgets.map((widget) => renderDsDashboardWidget(widget))}</aside>
                            </>
                        ) : dsDashboardSideWidgets.length > 0 && dsDashboardMainWidgets.length === 0 ? (
                            <aside className="dashboard-side-widgets">{dsDashboardSideWidgets.map((widget) => renderDsDashboardWidget(widget))}</aside>
                        ) : (
                            dsDashboardWidgets.map((widget) => renderDsDashboardWidget(widget))
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
