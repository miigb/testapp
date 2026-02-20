/**
 * localStorage persistence helpers — reads initial state for the app.
 * These are called as useState initialisers (lazy init), so they must be
 * pure functions that only read and never write.
 */

// ---- Types (kept local to avoid circular imports) ---------------------

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

export type SavedSmartNotesEntry = {
    signature: string
    expression: string
    result: number
    source: string
    savedAt: string
}

// ---- Storage keys -------------------------------------------------------

export const STORAGE_KEYS = {
    THEME: 'mesa-recibos-theme',
    DISABLED_SAVED_VIEWS: 'mesa-recibos-disabled-saved-views',
    QUICK_NOTES: 'mesa-recibos-quick-notes',
    SMART_NOTES: 'mesa-recibos-smart-notes',
    SMART_NOTES_PINNED: 'mesa-recibos-smart-notes-pinned',
    SMART_NOTES_SAVED: 'mesa-recibos-smart-notes-saved',
} as const

// ---- Resolvers ----------------------------------------------------------

const VALID_THEME_IDS = new Set<string>([
    'light', 'dark', 'tokyo-day', 'tokyo-night', 'synthwave-84',
    'one-dark-pro', 'night-owl', 'atom-one-light', 'github-light', 'github-dark', 'github-gray',
])

export function resolveInitialTheme(): ThemeId {
    const stored = localStorage.getItem(STORAGE_KEYS.THEME)
    if (stored && VALID_THEME_IDS.has(stored)) {
        return stored as ThemeId
    }
    return 'github-light'
}

export function resolveInitialDisabledSavedViewIds(): string[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.DISABLED_SAVED_VIEWS)
        if (!stored) return []
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed)) {
            return parsed.filter((value): value is string => typeof value === 'string')
        }
    } catch {
        // no-op
    }
    return []
}

export function resolveInitialQuickNotes(): string {
    const stored = localStorage.getItem(STORAGE_KEYS.QUICK_NOTES)
    return typeof stored === 'string' ? stored : ''
}

export function resolveInitialSmartNotes(): string {
    const stored = localStorage.getItem(STORAGE_KEYS.SMART_NOTES)
    return typeof stored === 'string' ? stored : ''
}

export function resolveInitialSmartNotesPinnedSignatures(): string[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SMART_NOTES_PINNED)
        if (!stored) return []
        const parsed = JSON.parse(stored) as unknown
        if (!Array.isArray(parsed)) return []
        return parsed.filter((value): value is string => typeof value === 'string').slice(0, 200)
    } catch {
        return []
    }
}

export function resolveInitialSmartNotesSavedEntries(): SavedSmartNotesEntry[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SMART_NOTES_SAVED)
        if (!stored) return []
        const parsed = JSON.parse(stored) as unknown
        if (!Array.isArray(parsed)) return []
        return parsed
            .filter((item): item is SavedSmartNotesEntry => {
                if (!item || typeof item !== 'object') return false
                const candidate = item as Partial<SavedSmartNotesEntry>
                return (
                    typeof candidate.signature === 'string' &&
                    typeof candidate.expression === 'string' &&
                    typeof candidate.result === 'number' &&
                    typeof candidate.source === 'string' &&
                    typeof candidate.savedAt === 'string'
                )
            })
            .slice(0, 200)
    } catch {
        return []
    }
}
