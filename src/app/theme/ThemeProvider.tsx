import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext } from './ThemeContext'
import { usePreferences } from '../preferences/usePreferences'
import {
  SYSTEM_THEME_QUERY,
  applyResolvedTheme,
  resolveTheme,
} from './theme'

type ThemeProviderProps = {
  children: ReactNode
}

const getSystemPreference = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(SYSTEM_THEME_QUERY).matches

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { theme: preference, setTheme: setPreference } = usePreferences()
  const [systemDark, setSystemDark] = useState(getSystemPreference)
  const resolvedTheme = resolveTheme(preference, systemDark)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY)
    const handleChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useLayoutEffect(() => {
    applyResolvedTheme(resolvedTheme)
  }, [resolvedTheme])

  const value = useMemo(() => ({ preference, resolvedTheme, setPreference }), [
    preference,
    resolvedTheme,
    setPreference,
  ])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
