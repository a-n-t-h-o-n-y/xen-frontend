import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceControls } from './WorkspaceControls'

describe('WorkspaceControls', () => {
  it('announces input mode and routes settings and modulator actions', async () => {
    const user = userEvent.setup()
    const setIsModulatorMode = vi.fn()
    const onOpenSettings = vi.fn()

    render(
      <WorkspaceControls
        currentInputMode="velocity"
        currentInputModeLetter="V"
        isModulatorMode={false}
        setIsModulatorMode={setIsModulatorMode}
        modulatorDisabled={false}
        onOpenSettings={onOpenSettings}
      />
    )

    expect(screen.getByLabelText('Input mode velocity')).toHaveTextContent('V')
    expect(screen.queryByRole('button', { name: 'Comp' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Seq' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mod' }))
    const update = setIsModulatorMode.mock.calls[0]?.[0]
    expect(typeof update).toBe('function')
    expect(update(false)).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })

  it('disables unavailable modulator actions', () => {
    render(
      <WorkspaceControls
        currentInputMode="pitch"
        currentInputModeLetter="P"
        isModulatorMode={false}
        setIsModulatorMode={vi.fn()}
        modulatorDisabled
        onOpenSettings={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Mod' })).toBeDisabled()
  })
})
