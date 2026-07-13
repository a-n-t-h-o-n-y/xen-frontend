export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = Exclude<ThemePreference, 'system'>

export const THEME_STORAGE_KEY = 'xen.themePreference'
export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)'

export const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark'

export const readThemePreference = (
  storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.localStorage
): ThemePreference => {
  if (!storage) return 'system'

  try {
    const value = storage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export const writeThemePreference = (
  preference: ThemePreference,
  storage: Pick<Storage, 'setItem'> | null = typeof window === 'undefined' ? null : window.localStorage
): void => {
  if (!storage) return

  try {
    storage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Embedded web views may expose storage while denying access to it.
  }
}

export const resolveTheme = (
  preference: ThemePreference,
  systemPrefersDark: boolean
): ResolvedTheme => preference === 'system'
  ? systemPrefersDark ? 'dark' : 'light'
  : preference

export const applyResolvedTheme = (
  theme: ResolvedTheme,
  root: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement
): void => {
  if (!root) return
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

export const systemPrefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(SYSTEM_THEME_QUERY).matches

export const initializeTheme = (): ThemePreference => {
  const preference = readThemePreference()
  applyResolvedTheme(resolveTheme(preference, systemPrefersDark()))
  return preference
}
