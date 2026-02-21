import type { StatusDefinition, TabId } from '../../types'
import { STATUS_ICON_OPTIONS, toColor } from '../../constants/configuracao'
import { StatusIcon } from '../shared/StatusComponents'

export interface PenhorasConfiguracaoProps {
    penhorasOrderedStatuses: StatusDefinition[]
    updatePenhorasStatusLocal: (id: string, patch: Partial<StatusDefinition>) => void
    removePenhorasStatus: (id: string) => Promise<void>
    addPenhorasStatus: () => Promise<void>
    savePenhorasStatuses: () => Promise<void>
    setActiveTab: (tab: TabId) => void
}

export function PenhorasConfiguracao({
    penhorasOrderedStatuses,
    updatePenhorasStatusLocal,
    removePenhorasStatus,
    addPenhorasStatus,
    savePenhorasStatuses,
    setActiveTab,
}: PenhorasConfiguracaoProps) {
    return (
        <section className="panel ds-panel penhoras-panel ds-settings-panel">
            <h2>Configuração Penhoras</h2>
            <p className="small-note">Estados e importação dedicados ao módulo Penhoras.</p>
            <div className="actions-row start">
                <button className="subtle-btn" type="button" onClick={() => setActiveTab('importar')}>
                    Importar Penhoras
                </button>
            </div>
            <div className="status-list">
                {penhorasOrderedStatuses.map((status) => (
                    <div key={status.id} className="status-item">
                        <span className="status-icon-preview">
                            <StatusIcon name={status.icon} size={16} />
                        </span>
                        <select className="status-icon" value={status.icon} onChange={(event) => updatePenhorasStatusLocal(status.id, { icon: event.target.value })}>
                            {STATUS_ICON_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <input value={status.label} onChange={(event) => updatePenhorasStatusLocal(status.id, { label: event.target.value })} />
                        <input type="color" value={toColor(status.color)} onChange={(event) => updatePenhorasStatusLocal(status.id, { color: event.target.value })} />
                        <input
                            type="number"
                            className="small-number"
                            value={status.order}
                            onChange={(event) => updatePenhorasStatusLocal(status.id, { order: Number(event.target.value) || 0 })}
                        />
                        <label className="inline-check">
                            <input type="checkbox" checked={status.active} onChange={(event) => updatePenhorasStatusLocal(status.id, { active: event.target.checked })} />
                            Ativo
                        </label>
                        <button className="danger-link" type="button" onClick={() => void removePenhorasStatus(status.id)}>Remover</button>
                    </div>
                ))}
            </div>
            <div className="actions-row start">
                <button className="subtle-btn" type="button" onClick={() => void addPenhorasStatus()}>Novo estado Penhoras</button>
                <button className="subtle-btn" type="button" onClick={() => void savePenhorasStatuses()}>Guardar estados Penhoras</button>
            </div>
        </section>
    )
}
