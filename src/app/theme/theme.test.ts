import { describe, expect, it } from 'vitest'
import {
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from './theme'

describe('theme preferences', () => {
  it('resolves system and explicit preferences', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('validates stored values and tolerates unavailable storage', () => {
    expect(readThemePreference({ getItem: () => 'dark' })).toBe('dark')
    expect(readThemePreference({ getItem: () => 'sepia' })).toBe('system')
    expect(readThemePreference({ getItem: () => { throw new Error('denied') } })).toBe('system')
    expect(() => writeThemePreference('light', {
      setItem: () => { throw new Error('denied') },
    })).not.toThrow()
  })

  it('writes the DOM theme contract', () => {
    const root = document.createElement('html')
    applyResolvedTheme('light', root)
    expect(root).toHaveAttribute('data-theme', 'light')
    expect(root.style.colorScheme).toBe('light')
  })

  it('uses the stable storage key', () => {
    const values = new Map<string, string>()
    writeThemePreference('dark', { setItem: (key, value) => values.set(key, value) })
    expect(values.get(THEME_STORAGE_KEY)).toBe('dark')
  })
})
