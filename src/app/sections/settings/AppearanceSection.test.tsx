import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '../../theme/ThemeProvider'
import { THEME_STORAGE_KEY } from '../../theme/theme'
import { AppearanceSection } from './AppearanceSection'

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

  it('switches and persists the explicit theme', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <AppearanceSection />
      </ThemeProvider>
    )

    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    await user.click(screen.getByRole('button', { name: 'Dark' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await waitFor(() => expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark'))
  })
})
