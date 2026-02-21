import type { ReactNode } from 'react'
import { Eye, EyeOff, FilterX, Maximize2, Plus, Save, Trash2 } from 'lucide-react'
import type { RecordFilters, StatusDefinition, SavedView } from '../../types'
import type { DashboardWidget, DashboardWidgetType } from '../../lib/dashboardWidgets'
import { DASHBOARD_WIDGET_LIBRARY } from '../../lib/dashboardWidgets'
import { DEFAULT_DASHBOARD_FILTERS } from '../../constants'
import { LabeledSelect } from '../shared/FormInputs'
import { LabeledInput } from '../shared/FormInputs'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export interface RecibosDashboardsProps {
    // Focus mode
    isDashboardFocusMode: boolean
    setDashboardFocusMode: (v: boolean) => void
    // Config panel
    dashboardConfigOpen: boolean
    setDashboardConfigOpen: (updater: (prev: boolean) => boolean) => void
    // Dashboard CRUD
    resetDashboardDraft: () => void
    saveDashboard: (opts?: { asNew?: boolean }) => Promise<void>
    deleteDashboard: () => Promise<void>
    activeDashboardId: string | null
    dashboardViews: SavedView[]
    loadDashboardView: (view: SavedView) => void
    dashboardName: string
    setDashboardName: (name: string) => void
    // Widget picker
    dashboardPickerOpen: boolean
    setDashboardPickerOpen: (updater: boolean | ((prev: boolean) => boolean)) => void
    addDashboardWidget: (type: DashboardWidgetType) => void
    // Filters
    dashboardFiltersOpen: boolean
    setDashboardFiltersOpen: (updater: (prev: boolean) => boolean) => void
    dashboardFilters: RecordFilters
    setDashboardFilters: (filters: RecordFilters) => void
    patchDashboardFilters: <K extends keyof RecordFilters>(key: K, value: RecordFilters[K]) => void
    dashboardActiveFilterCount: number
    // Loading / summary
    dashboardLoading: boolean
    dashboardSummary: { totals: { registos: number; valorEmissao: number; levantadoComIva: number } } | null
    formatCurrency: (value?: number) => string
    // Filter options
    orderedStatuses: StatusDefinition[]
    years: number[]
    exequenteFilterOptions: string[]
    gestorFilterOptions: string[]
    // Widgets
    dashboardWidgets: DashboardWidget[]
    dashboardMainWidgets: DashboardWidget[]
    dashboardSideWidgets: DashboardWidget[]
    dashboardHasSideStack: boolean
    renderDashboardWidget: (widget: DashboardWidget) => ReactNode
}

export function RecibosDashboards({
    isDashboardFocusMode,
    setDashboardFocusMode,
    dashboardConfigOpen,
    setDashboardConfigOpen,
    resetDashboardDraft,
    saveDashboard,
    deleteDashboard,
    activeDashboardId,
    dashboardViews,
    loadDashboardView,
    dashboardName,
    setDashboardName,
    dashboardPickerOpen,
    setDashboardPickerOpen,
    addDashboardWidget,
    dashboardFiltersOpen,
    setDashboardFiltersOpen,
    dashboardFilters,
    setDashboardFilters,
    patchDashboardFilters,
    dashboardActiveFilterCount,
    dashboardLoading,
    dashboardSummary,
    formatCurrency,
    orderedStatuses,
    years,
    exequenteFilterOptions,
    gestorFilterOptions,
    dashboardWidgets,
    dashboardMainWidgets,
    dashboardSideWidgets,
    dashboardHasSideStack,
    renderDashboardWidget,
}: RecibosDashboardsProps) {
    return (
        <section className="panel dashboard-experiment">
            {!isDashboardFocusMode && (
                <>
                    <div className="row-between wrap">
                        <div>
                            <h2>Dashboards</h2>
                            <p className="small-note">Começa vazio e adiciona widgets pré-configurados para foco imediato.</p>
                        </div>
                        <div className="dashboard-top-actions">
                            <button className="subtle-btn" type="button" onClick={() => setDashboardFocusMode(true)}>
                                <Maximize2 size={15} />
                                Expandir dashboard
                            </button>
                            <button className="subtle-btn" type="button" onClick={() => setDashboardConfigOpen((current) => !current)}>
                                {dashboardConfigOpen ? <EyeOff size={15} /> : <Eye size={15} />}
                                {dashboardConfigOpen ? 'Ocultar painel' : 'Mostrar painel'}
                            </button>
                            <button
                                className="subtle-btn"
                                type="button"
                                onClick={() => {
                                    resetDashboardDraft()
                                    setDashboardPickerOpen(true)
                                }}
                            >
                                <Plus size={15} />
                                Novo dashboard
                            </button>
                            <button className="subtle-btn" type="button" onClick={() => void saveDashboard()}>
                                <Save size={15} />
                                Guardar
                            </button>
                            <button className="subtle-btn" type="button" onClick={() => void saveDashboard({ asNew: true })}>
                                Guardar como
                            </button>
                            <button className="subtle-btn" type="button" disabled={!activeDashboardId} onClick={() => void deleteDashboard()}>
                                <Trash2 size={15} />
                                Eliminar
                            </button>
                        </div>
                    </div>

                    {dashboardConfigOpen ? (
                        <>
                            <div className="dashboard-hero-grid">
                                <div className="dashboard-hero-card">
                                    <span>Total registos</span>
                                    <strong>{dashboardLoading ? '...' : new Intl.NumberFormat('pt-PT').format(dashboardSummary?.totals.registos ?? 0)}</strong>
                                </div>
                                <div className="dashboard-hero-card">
                                    <span>Total emissão</span>
                                    <strong>{dashboardLoading ? '...' : formatCurrency(dashboardSummary?.totals.valorEmissao)}</strong>
                                </div>
                                <div className="dashboard-hero-card">
                                    <span>Levantado c/ IVA</span>
                                    <strong>{dashboardLoading ? '...' : formatCurrency(dashboardSummary?.totals.levantadoComIva)}</strong>
                                </div>
                            </div>

                            <div className="dashboard-controls-grid simple">
                                <label className="field">
                                    <span>Dashboard ativo</span>
                                    <select
                                        value={activeDashboardId ?? ''}
                                        onChange={(event) => {
                                            const nextId = event.target.value
                                            if (!nextId) {
                                                resetDashboardDraft()
                                                return
                                            }
                                            const found = dashboardViews.find((view) => view.id === nextId)
                                            if (found) {
                                                loadDashboardView(found)
                                            }
                                        }}
                                    >
                                        <option value="">Rascunho não guardado</option>
                                        {dashboardViews.map((view) => (
                                            <option key={view.id} value={view.id}>
                                                {view.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <LabeledInput label="Nome" value={dashboardName} onChange={(value) => setDashboardName(value)} />
                            </div>

                            <div className="dashboard-filter-toolbar">
                                <button className="subtle-btn" type="button" onClick={() => setDashboardFiltersOpen((current) => !current)}>
                                    {dashboardFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
                                </button>
                                <span className="muted">
                                    {dashboardActiveFilterCount} filtros ativos · {dashboardLoading ? 'A calcular...' : `${dashboardSummary?.totals.registos ?? 0} registos`}
                                </span>
                                <button
                                    className="subtle-btn"
                                    type="button"
                                    onClick={() => setDashboardFilters(DEFAULT_DASHBOARD_FILTERS)}
                                    disabled={dashboardActiveFilterCount === 0}
                                >
                                    <FilterX size={15} />
                                    Limpar
                                </button>
                            </div>

                            {dashboardFiltersOpen && (
                                <div className="dashboard-filters-grid">
                                    <LabeledSelect
                                        label="Tipo"
                                        value={String(dashboardFilters.tipo ?? 'todos')}
                                        onChange={(value) => patchDashboardFilters('tipo', value as RecordFilters['tipo'])}
                                        options={[
                                            { value: 'todos', label: 'Todos' },
                                            { value: 'exequente', label: 'Exequentes' },
                                            { value: 'executado', label: 'Executados' },
                                        ]}
                                    />
                                    <LabeledSelect
                                        label="Estado"
                                        value={String(dashboardFilters.estadoId ?? 'todos')}
                                        onChange={(value) => patchDashboardFilters('estadoId', value as RecordFilters['estadoId'])}
                                        options={[{ value: 'todos', label: 'Todos' }, ...orderedStatuses.map((status) => ({ value: status.id, label: status.label }))]}
                                    />
                                    <LabeledSelect
                                        label="Mês"
                                        value={String(dashboardFilters.mes ?? 'todos')}
                                        onChange={(value) => patchDashboardFilters('mes', value === 'todos' ? 'todos' : Number(value))}
                                        options={[{ value: 'todos', label: 'Todos' }, ...MONTHS.map((label, index) => ({ value: String(index + 1), label }))]}
                                    />
                                    <LabeledSelect
                                        label="Ano"
                                        value={String(dashboardFilters.ano ?? 'todos')}
                                        onChange={(value) => patchDashboardFilters('ano', value === 'todos' ? 'todos' : Number(value))}
                                        options={[{ value: 'todos', label: 'Todos' }, ...years.map((year) => ({ value: String(year), label: String(year) }))]}
                                    />
                                    <LabeledSelect
                                        label="Exequente"
                                        value={String(dashboardFilters.exequente ?? '')}
                                        onChange={(value) => patchDashboardFilters('exequente', value)}
                                        options={[{ value: '', label: 'Todos' }, ...exequenteFilterOptions.map((value) => ({ value, label: value }))]}
                                    />
                                    <LabeledSelect
                                        label="Gestor"
                                        value={String(dashboardFilters.gestor ?? '')}
                                        onChange={(value) => patchDashboardFilters('gestor', value)}
                                        options={[{ value: '', label: 'Todos' }, ...gestorFilterOptions.map((value) => ({ value, label: value }))]}
                                    />
                                </div>
                            )}

                            <div className="dashboard-picker-wrap">
                                <button className="subtle-btn" type="button" onClick={() => setDashboardPickerOpen((current) => !current)}>
                                    {dashboardPickerOpen ? 'Ocultar widgets' : 'Adicionar widgets'}
                                </button>
                                {dashboardPickerOpen && (
                                    <div className="dashboard-widget-library">
                                        {DASHBOARD_WIDGET_LIBRARY.map((widget) => (
                                            <button
                                                key={widget.type}
                                                className="dashboard-widget-option"
                                                type="button"
                                                onClick={() => addDashboardWidget(widget.type)}
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
                            Painel de configuração oculto. Use &ldquo;Mostrar painel&rdquo; para editar filtros e widgets.
                        </div>
                    )}
                </>
            )}

            {dashboardWidgets.length === 0 ? (
                <div className="empty-text dashboard-empty">
                    Dashboard vazio. Clique em <strong>Adicionar widgets</strong> para começar.
                </div>
            ) : (
                <div className={`dashboard-grid ${dashboardHasSideStack ? 'with-side-stack' : ''}`}>
                    {dashboardHasSideStack ? (
                        <>
                            <div className="dashboard-main-widgets">{dashboardMainWidgets.map((widget) => renderDashboardWidget(widget))}</div>
                            <aside className="dashboard-side-widgets">{dashboardSideWidgets.map((widget) => renderDashboardWidget(widget))}</aside>
                        </>
                    ) : dashboardSideWidgets.length > 0 && dashboardMainWidgets.length === 0 ? (
                        <aside className="dashboard-side-widgets">{dashboardSideWidgets.map((widget) => renderDashboardWidget(widget))}</aside>
                    ) : (
                        dashboardWidgets.map((widget) => renderDashboardWidget(widget))
                    )}
                </div>
            )}
        </section>
    )
}
