import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettingsOverlay } from './SettingsOverlay'
import type { KeymapResource } from '../domain/models'

const trigger = {
  key: 'h',
  modifiers: { shift: true, command: false, alt: false },
} as const

const resource: KeymapResource = {
  revision: 1,
  keySemantics: 'KeyboardEvent.key',
  bindings: {
    sequence: [{
      trigger,
      target: {
        type: 'ui_action',
        action: 'selection.move',
        arguments: { direction: 'left', amount: 2 },
      },
    }],
  },
  overrides: [],
}

const renderOverlay = (overrides: Partial<Parameters<typeof SettingsOverlay>[0]> = {}) => {
  const props: Parameters<typeof SettingsOverlay>[0] = {
    open: true,
    resource,
    commands: [],
    busy: false,
    error: null,
    onClose: vi.fn(),
    onSetOverride: vi.fn().mockResolvedValue(undefined),
    onDisable: vi.fn().mockResolvedValue(undefined),
    onRestore: vi.fn().mockResolvedValue(undefined),
    onReset: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<SettingsOverlay {...props} />)
  return props
}

describe('SettingsOverlay', () => {
  it('closes the top-level dialog with Escape', async () => {
    const user = userEvent.setup()
    const props = renderOverlay()

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('edits and saves an existing shortcut through the nested dialog', async () => {
    const user = userEvent.setup()
    const props = renderOverlay()

    await user.click(screen.getByRole('button', { name: /Shift.*h.*Move left by 2/i }))
    expect(screen.getByRole('dialog', { name: 'Configure shortcut' })).toBeInTheDocument()

    const amount = screen.getByRole('spinbutton', { name: 'Amount' })
    await user.clear(amount)
    await user.type(amount, '3')
    await user.click(screen.getByRole('button', { name: 'Save shortcut' }))

    expect(props.onSetOverride).toHaveBeenCalledWith(
      'sequence',
      trigger,
      {
        type: 'ui_action',
        action: 'selection.move',
        arguments: { direction: 'left', amount: 3 },
      },
      trigger
    )
  })

  it('switches to and renders the command catalog surface', async () => {
    const user = userEvent.setup()
    renderOverlay({
      commands: [{
        id: 'transport stop',
        signature: 'transport stop',
        keywords: [],
        description: 'Stop playback.',
        targetRequirement: 'none',
        acceptsPatternPrefix: false,
        arguments: [],
      }],
    })

    await user.click(screen.getByRole('button', { name: /Commands/ }))
    expect(screen.getByRole('searchbox', { name: 'Search commands' })).toBeInTheDocument()
    expect(screen.getByText('Stop playback.')).toBeInTheDocument()
  })
})
