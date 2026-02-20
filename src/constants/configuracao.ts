/**
 * Shared icon + theme constants used across Configuração components.
 * Extracted from App.tsx to avoid duplication.
 */

export const STATUS_ICON_OPTIONS = [
    { value: 'hammer', label: 'Martelo' },
    { value: 'clock3', label: 'Relógio' },
    { value: 'search-check', label: 'Validação' },
    { value: 'receipt-text', label: 'Recibo' },
    { value: 'octagon-alert', label: 'Bloqueado' },
    { value: 'check-circle2', label: 'Concluído' },
    { value: 'shield-alert', label: 'Alerta' },
    { value: 'file-search', label: 'Pesquisa' },
    { value: 'file-clock', label: 'Pendente' },
    { value: 'ban', label: 'Cancelado' },
    { value: 'alert-triangle', label: 'Aviso' },
    { value: 'circle', label: 'Sem estado' },
]

export function toColor(color: string): string {
    if (!color) return '#000000'
    if (color.startsWith('#') && (color.length === 7 || color.length === 4)) return color
    return '#000000'
}

export type ThemeId =
    | 'light'
    | 'dark'
    | 'tokyo-day'
    | 'tokyo-night'
    | 'synthwave-84'
    | 'one-dark-pro'
    | 'night-owl'
    | 'atom-one-light'
    | 'github-light'
    | 'github-dark'
    | 'github-gray'

export const THEME_OPTIONS: Array<{ id: ThemeId; label: string }> = [
    { id: 'light', label: 'Claro (Legacy)' },
    { id: 'dark', label: 'Escuro (Legacy)' },
    { id: 'tokyo-day', label: 'Tokio Day (Legacy)' },
    { id: 'tokyo-night', label: 'Tokio Night (Legacy)' },
    { id: 'synthwave-84', label: "SynthWave '84 (Legacy)" },
    { id: 'one-dark-pro', label: 'One Dark Pro' },
    { id: 'night-owl', label: 'Night Owl' },
    { id: 'atom-one-light', label: 'Atom One Light' },
    { id: 'github-light', label: 'GitHub Light' },
    { id: 'github-dark', label: 'GitHub Dark' },
    { id: 'github-gray', label: 'GitHub Gray' },
]
