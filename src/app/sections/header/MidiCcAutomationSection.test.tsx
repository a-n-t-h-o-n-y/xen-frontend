import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MidiCcAutomationSection } from './MidiCcAutomationSection'

const renderSection = () => {
  const callbacks = {
    onSelectController: vi.fn(),
    onSetLabel: vi.fn().mockResolvedValue(undefined),
    onRemoveLabel: vi.fn().mockResolvedValue(undefined),
    onShift: vi.fn().mockResolvedValue(undefined),
    onRemoveValue: vi.fn().mockResolvedValue(undefined),
  }
  render(
    <MidiCcAutomationSection
      controller={0}
      labels={new Map([[74, 'Brightness']])}
      usedControllers={new Set([74])}
      valueSummary="Unset"
      disabled={false}
      {...callbacks}
    />
  )
  return callbacks
}

describe('MIDI CC automation header section', () => {
  it('searches labels and selects their controller number', async () => {
    const user = userEvent.setup()
    const callbacks = renderSection()

    await user.click(screen.getByRole('button', { name: /Select MIDI controller.*CC 0/ }))
    await user.type(screen.getByRole('searchbox', { name: 'Search MIDI controllers' }), 'bright')
    await user.click(screen.getByRole('option', { name: /CC 74 — Brightness/ }))

    expect(callbacks.onSelectController).toHaveBeenCalledWith(74)
  })

  it('commits labels and exposes value edit actions', async () => {
    const user = userEvent.setup()
    const callbacks = renderSection()

    await user.click(screen.getByRole('button', {
      name: 'Label for MIDI CC 0: unlabeled. Click to edit',
    }))
    await user.type(screen.getByRole('textbox', { name: 'Edit label for MIDI CC 0' }), 'Expression')
    await user.keyboard('{Enter}')
    expect(callbacks.onSetLabel).toHaveBeenCalledWith(0, 'Expression')

    await user.click(screen.getByRole('button', { name: 'Increase by 8 MIDI steps' }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(callbacks.onShift).toHaveBeenCalledWith(8 / 127)
    expect(callbacks.onRemoveValue).toHaveBeenCalledOnce()
  })
})
