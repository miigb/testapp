import type { CalculationSettings, StatusDefinition, TaxRule } from '../../types'
import { STATUS_ICON_OPTIONS, THEME_OPTIONS, ThemeId, toColor } from '../../constants/configuracao'
import { StatusIcon } from '../shared/StatusComponents'

export interface RecibosConfiguracaoProps {
    // Theme
    theme: string
    setTheme: (theme: ThemeId) => void
    // Statuses
    orderedStatuses: StatusDefinition[]
    updateStatusLocal: (id: string, patch: Partial<StatusDefinition>) => void
    removeStatus: (id: string) => Promise<void>
    addStatus: () => Promise<void>
    saveStatuses: () => Promise<void>
    // Calculation settings
    settingsDraft: CalculationSettings & { taxRules: TaxRule[] }
    updateSettingsDraft: (patch: Partial<CalculationSettings>) => void
    updateTaxRule: (ruleId: string, patch: Partial<TaxRule>) => void
    saveCalculationSettings: () => Promise<void>
    // Navigation
    setActiveTab: (tab: string) => void
}

export function RecibosConfiguracao({
    theme,
    setTheme,
    orderedStatuses,
    updateStatusLocal,
    removeStatus,
    addStatus,
    saveStatuses,
    settingsDraft,
    updateSettingsDraft,
    updateTaxRule,
    saveCalculationSettings,
    setActiveTab,
}: RecibosConfiguracaoProps) {
    return (
        <section className="panel">
            <h2>Configuração</h2>
            <p className="small-note">Estados, regras de cálculo fiscal e comissões configuráveis.</p>
            <div className="actions-row start">
                <button className="subtle-btn" type="button" onClick={() => setActiveTab('importar')}>
                    Importar ficheiro
                </button>
            </div>

            <h3>Tema</h3>
            <div className="theme-select-wrap">
                <label className="field">
                    <span>Selecionar tema</span>
                    <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeId)}>
                        {THEME_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <h3>Estados</h3>
            <div className="status-list">
                {orderedStatuses.map((status) => (
                    <div key={status.id} className="status-item">
                        <span className="status-icon-preview">
                            <StatusIcon name={status.icon} size={16} />
                        </span>
                        <select className="status-icon" value={status.icon} onChange={(event) => updateStatusLocal(status.id, { icon: event.target.value })}>
                            {STATUS_ICON_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <input value={status.label} onChange={(event) => updateStatusLocal(status.id, { label: event.target.value })} />
                        <input type="color" value={toColor(status.color)} onChange={(event) => updateStatusLocal(status.id, { color: event.target.value })} />
                        <input type="number" className="small-number" value={status.order} onChange={(event) => updateStatusLocal(status.id, { order: Number(event.target.value) || 0 })} />
                        <label className="inline-check">
                            <input type="checkbox" checked={status.active} onChange={(event) => updateStatusLocal(status.id, { active: event.target.checked })} />
                            Ativo
                        </label>
                        <button className="danger-link" type="button" onClick={() => void removeStatus(status.id)}>Remover</button>
                    </div>
                ))}
            </div>

            <div className="actions-row start">
                <button className="subtle-btn" type="button" onClick={() => void addStatus()}>Novo estado</button>
                <button className="subtle-btn" type="button" onClick={() => void saveStatuses()}>Guardar estados</button>
            </div>

            <h3>Auto-cálculo</h3>
            <div className="field-grid four">
                <label className="inline-check">
                    <input type="checkbox" checked={settingsDraft.autoApplyRules} onChange={(event) => updateSettingsDraft({ autoApplyRules: event.target.checked })} />
                    Aplicar regras automaticamente
                </label>
                <label className="inline-check">
                    <input type="checkbox" checked={settingsDraft.autoComputeValorSemIva} onChange={(event) => updateSettingsDraft({ autoComputeValorSemIva: event.target.checked })} />
                    Calcular valor sem IVA
                </label>
                <label className="inline-check">
                    <input type="checkbox" checked={settingsDraft.autoComputeValorEmissao} onChange={(event) => updateSettingsDraft({ autoComputeValorEmissao: event.target.checked })} />
                    Calcular valor emissão
                </label>
                <label className="field">
                    <span>Casas decimais</span>
                    <input type="number" value={settingsDraft.roundTo} onChange={(event) => updateSettingsDraft({ roundTo: Number(event.target.value) || 2 })} />
                </label>
            </div>

            <div className="rules-table">
                <table className="rules-grid-table">
                    <thead>
                        <tr>
                            <th>Regra</th>
                            <th>Taxa</th>
                            <th>Campo base</th>
                            <th>Campo destino</th>
                            <th>Ativa</th>
                        </tr>
                    </thead>
                    <tbody>
                        {settingsDraft.taxRules.map((rule) => (
                            <tr key={rule.id}>
                                <td>
                                    <input value={rule.label} onChange={(event) => updateTaxRule(rule.id, { label: event.target.value })} />
                                </td>
                                <td>
                                    <input type="number" step="0.0001" value={rule.rate} onChange={(event) => updateTaxRule(rule.id, { rate: Number(event.target.value) || 0 })} />
                                </td>
                                <td>
                                    <select value={rule.baseField} onChange={(event) => updateTaxRule(rule.id, { baseField: event.target.value as TaxRule['baseField'] })}>
                                        <option value="valorSemIva">Valor sem IVA</option>
                                        <option value="valorIndicado">Valor indicado</option>
                                        <option value="valorEmissao">Valor emissão</option>
                                    </select>
                                </td>
                                <td>
                                    <select value={rule.targetField} onChange={(event) => updateTaxRule(rule.id, { targetField: event.target.value as TaxRule['targetField'] })}>
                                        <option value="iva">IVA</option>
                                        <option value="retencao">Retenção</option>
                                        <option value="meu5">Meu 5%</option>
                                        <option value="outrasTaxas">Outras taxas</option>
                                    </select>
                                </td>
                                <td>
                                    <input type="checkbox" checked={rule.enabled} onChange={(event) => updateTaxRule(rule.id, { enabled: event.target.checked })} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="actions-row start">
                <button className="primary-btn" type="button" onClick={() => void saveCalculationSettings()}>Guardar cálculos</button>
            </div>
        </section>
    )
}
