import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { PreferencesContext } from '../../preferences/PreferencesContext'
import { AppearanceSection } from './AppearanceSection'
import type { ThemePreference } from '../../theme/theme'
import type { WorkspaceLayoutPreference } from '../../workspace/workspaceLayout'

const installMatchMedia = (matches: boolean): void => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

describe('AppearanceSection', () => {
  beforeEach(() => {
    window.localStorage.clear()
    installMatchMedia(false)
  })

  const renderAppearance = (onLayoutChange = vi.fn()) => {
    function Harness() {
      const [theme, setTheme] = useState<ThemePreference>('system')
      const [workspaceLayout, setWorkspaceLayoutState] =
        useState<WorkspaceLayoutPreference>('single')
      const setWorkspaceLayout = (preference: WorkspaceLayoutPreference): void => {
        setWorkspaceLayoutState(preference)
        onLayoutChange(preference)
      }
      return (
        <PreferencesContext.Provider value={{
          theme,
          workspaceLayout,
          busy: false,
          error: null,
          ingestPreferences: vi.fn(),
          setTheme,
          setWorkspaceLayout,
          reset: vi.fn().mockResolvedValue(undefined),
        }}>
          <ThemeProvider>
            <AppearanceSection />
          </ThemeProvider>
        </PreferencesContext.Provider>
      )
    }
    render(<Harness />)
  }

  it('switches the explicit theme', async () => {
    const user = userEvent.setup()
    renderAppearance()

    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    await user.click(screen.getByRole('button', { name: 'Dark' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })

  it('toggles the dual editor preference', async () => {
    const user = userEvent.setup()
    const onWorkspaceLayoutPreferenceChange = vi.fn()
    renderAppearance(onWorkspaceLayoutPreferenceChange)

    const layoutSwitch = screen.getByRole('switch', { name: 'Dual editor view' })
    expect(layoutSwitch).toHaveAttribute('aria-checked', 'false')

    await user.click(layoutSwitch)

    expect(onWorkspaceLayoutPreferenceChange).toHaveBeenCalledWith('dual')
  })
})
