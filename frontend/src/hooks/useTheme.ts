import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'fridgehub-theme'

const readInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useTheme = () => {
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.classList.toggle('dark', theme === 'dark')
    window.localStorage.setItem(STORAGE_KEY, theme)

    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (themeColor) {
      themeColor.content = theme === 'dark' ? '#0f172a' : '#2563eb'
    }
  }, [theme])

  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  }
}
