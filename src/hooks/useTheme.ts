import { useEffect, useState } from 'react'
import { resolveInitialTheme, STORAGE_KEYS } from '../lib/localStorage'
import type { ThemeId } from '../lib/localStorage'

export function isDarkLikeTheme(theme: ThemeId): boolean {
    return (
        theme === 'dark' ||
        theme === 'tokyo-night' ||
        theme === 'synthwave-84' ||
        theme === 'one-dark-pro' ||
        theme === 'night-owl' ||
        theme === 'github-dark'
    )
}

export function useTheme() {
    const [theme, setTheme] = useState<ThemeId>(resolveInitialTheme)

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem(STORAGE_KEYS.THEME, theme)
    }, [theme])

    const isDarkLike = isDarkLikeTheme(theme)

    return {
        theme,
        setTheme,
        isDarkLike,
    }
}
