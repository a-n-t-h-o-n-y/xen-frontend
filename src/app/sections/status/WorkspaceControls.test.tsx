import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceControls } from './WorkspaceControls'

describe('WorkspaceControls', () => {
  it('announces active state and routes workspace and modulator actions', async () => {
    const user = userEvent.setup()
    const setWorkspaceView = vi.fn()
    const setIsModulatorMode = vi.fn()
    const onOpenSettings = vi.fn()

    render(
      <WorkspaceControls
        currentInputMode="velocity"
        currentInputModeLetter="V"
        workspaceView="sequencer"
        setWorkspaceView={setWorkspaceView}
        isModulatorMode={false}
        setIsModulatorMode={setIsModulatorMode}
        workspaceDisabled={false}
        modulatorDisabled={false}
        onOpenSettings={onOpenSettings}
      />
    )

    expect(screen.getByLabelText('Input mode velocity')).toHaveTextContent('V')
    expect(screen.getByRole('button', { name: 'Seq' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Lib' }))
    expect(setWorkspaceView).toHaveBeenCalledWith('library')

    await user.click(screen.getByRole('button', { name: 'Mod' }))
    const update = setIsModulatorMode.mock.calls[0]?.[0]
    expect(typeof update).toBe('function')
    expect(update(false)).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })

  it('disables unavailable workspace actions', () => {
    render(
      <WorkspaceControls
        currentInputMode="pitch"
        currentInputModeLetter="P"
        workspaceView="sequencer"
        setWorkspaceView={vi.fn()}
        isModulatorMode={false}
        setIsModulatorMode={vi.fn()}
        workspaceDisabled
        modulatorDisabled
        onOpenSettings={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Comp' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mod' })).toBeDisabled()
  })
})
