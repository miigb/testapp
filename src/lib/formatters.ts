/**
 * Shared formatting utilities — pure functions, no side effects.
 */

const PT_CURRENCY_FORMAT = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const PT_NUMBER_FORMAT = new Intl.NumberFormat('pt-PT')

export function formatCurrency(value?: number): string {
    if (typeof value !== 'number') return '-'
    return PT_CURRENCY_FORMAT.format(value)
}

export function formatNumber(value: number): string {
    return PT_NUMBER_FORMAT.format(value)
}

export function toFormNumber(value?: number): string {
    if (typeof value !== 'number') return ''
    return value.toFixed(2).replace('.', ',')
}

export function normalizeText(value: unknown): string {
    if (value === null || value === undefined) return ''
    return String(value)
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
}

export function toColor(color: string): string {
    const value = color.trim().toUpperCase()
    if (/^#[0-9A-F]{6}$/.test(value)) return value
    return '#BFC4CC'
}

/**
 * Returns a hex color with an alpha suffix, adjusting for dark themes.
 * Reads the current theme from `data-theme` on `<html>` — only call in browser context.
 */
export function colorWithAlpha(color: string, alphaHex: string): string {
    if (typeof document !== 'undefined') {
        const theme = document.documentElement.getAttribute('data-theme')
        const darkTheme =
            theme === 'dark' ||
            theme === 'tokyo-night' ||
            theme === 'synthwave-84' ||
            theme === 'one-dark-pro' ||
            theme === 'night-owl' ||
            theme === 'github-dark'
        if (darkTheme && alphaHex === '1F') {
            return `${toColor(color)}14`
        }
    }
    return `${toColor(color)}${alphaHex}`
}
