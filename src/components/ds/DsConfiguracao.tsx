import type { StatusDefinition, TabId } from '../../types'
import { STATUS_ICON_OPTIONS, toColor } from '../../constants/configuracao'
import { StatusIcon } from '../shared/StatusComponents'

export interface DsConfiguracaoProps {
    dsOrderedStatuses: StatusDefinition[]
    updateDsStatusLocal: (id: string, patch: Partial<StatusDefinition>) => void
    removeDsStatus: (id: string) => Promise<void>
    addDsStatus: () => Promise<void>
    saveDsStatuses: () => Promise<void>
    setActiveTab: (tab: TabId) => void
}

export function DsConfiguracao({
    dsOrderedStatuses,
    updateDsStatusLocal,
    removeDsStatus,
    addDsStatus,
    saveDsStatuses,
    setActiveTab,
}: DsConfiguracaoProps) {
    return (
        <section className="panel ds-panel ds-settings-panel">
            <h2>Configuração DS</h2>
            <p className="small-note">Estados independentes do módulo de recibos.</p>
            <div className="actions-row start">
                <button className="subtle-btn" type="button" onClick={() => setActiveTab('importar')}>
                    Importar DS
                </button>
            </div>
            <div className="status-list">
                {dsOrderedStatuses.map((status) => (
                    <div key={status.id} className="status-item">
                        <span className="status-icon-preview">
                            <StatusIcon name={status.icon} size={16} />
                        </span>
                        <select className="status-icon" value={status.icon} onChange={(event) => updateDsStatusLocal(status.id, { icon: event.target.value })}>
                            {STATUS_ICON_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <input value={status.label} onChange={(event) => updateDsStatusLocal(status.id, { label: event.target.value })} />
                        <input type="color" value={toColor(status.color)} onChange={(event) => updateDsStatusLocal(status.id, { color: event.target.value })} />
                        <input type="number" className="small-number" value={status.order} onChange={(event) => updateDsStatusLocal(status.id, { order: Number(event.target.value) || 0 })} />
                        <label className="inline-check">
                            <input type="checkbox" checked={status.active} onChange={(event) => updateDsStatusLocal(status.id, { active: event.target.checked })} />
                            Ativo
                        </label>
                        <button className="danger-link" type="button" onClick={() => void removeDsStatus(status.id)}>Remover</button>
                    </div>
                ))}
            </div>
            <div className="actions-row start">
                <button className="subtle-btn" type="button" onClick={() => void addDsStatus()}>Novo estado DS</button>
                <button className="subtle-btn" type="button" onClick={() => void saveDsStatuses()}>Guardar estados DS</button>
            </div>
        </section>
    )
}
