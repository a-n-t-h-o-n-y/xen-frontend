import { createRef } from 'react'
import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HeaderSection } from './HeaderSection'

const renderHeader = (
  onOpenQuickAccess: () => void,
  disabledReason: string | null = null,
  metadataAvailable = true,
  callbacks: {
    applyScaleSelection?: (id: string) => Promise<void>
    applyModeSelection?: (mode: number) => Promise<void>
    modulationControls?: ReactNode
    onExitModulation?: () => void
  } = {}
) =>
  render(
    <HeaderSection
      isTimeSignatureEditing={false}
      timeSignatureInputRef={createRef<HTMLInputElement>()}
      timeSignatureDraft="4/4"
      setTimeSignatureDraft={vi.fn()}
      commitTimeSignature={vi.fn().mockResolvedValue(undefined)}
      cancelTimeSignatureEdit={vi.fn()}
      beginTimeSignatureEdit={vi.fn()}
      disabledReason={disabledReason}
      metadataDisabledReason={disabledReason ?? (
        metadataAvailable ? null : 'Selected composition column has no metadata'
      )}
      metadataAvailable={metadataAvailable}
      timeSignature={metadataAvailable ? '4/4' : '--'}
      applyTimeSignatureScale={vi.fn()}
      isKeyEditing={false}
      keyInputRef={createRef<HTMLInputElement>()}
      keyDraft="0"
      setKeyDraft={vi.fn()}
      commitKey={vi.fn().mockResolvedValue(undefined)}
      cancelKeyEdit={vi.fn()}
      beginKeyEdit={vi.fn()}
      keyDisplay={metadataAvailable ? '0' : '--'}
      isBaseFrequencyEditing={false}
      baseFrequencyInputRef={createRef<HTMLInputElement>()}
      baseFrequencyDraft="440"
      setBaseFrequencyDraft={vi.fn()}
      commitBaseFrequency={vi.fn().mockResolvedValue(undefined)}
      cancelBaseFrequencyEdit={vi.fn()}
      beginBaseFrequencyEdit={vi.fn()}
      baseFrequency={metadataAvailable ? '440' : '--'}
      isScaleUpdating={false}
      scaleOptions={[
        { id: 'chromatic', name: 'chromatic', command: 'set scale chromatic' },
        { id: 'major', name: 'major', command: 'set scale major' },
      ]}
      scaleName={metadataAvailable ? 'chromatic' : '--'}
      scaleSourceId={metadataAvailable ? 'chromatic' : null}
      applyScaleSelection={callbacks.applyScaleSelection ?? vi.fn().mockResolvedValue(undefined)}
      scaleTranslateDirection={metadataAvailable ? 'up' : null}
      toggleTranslateDirection={vi.fn().mockResolvedValue(undefined)}
      modeOptions={metadataAvailable ? [1, 2, 3] : []}
      scaleMode={1}
      applyModeSelection={callbacks.applyModeSelection ?? vi.fn().mockResolvedValue(undefined)}
      tuningName={metadataAvailable ? '12EDO' : '--'}
      sequenceName="Lead"
      currentInputMode="velocity"
      currentInputKey="V"
      documentControls={null}
      onOpenQuickAccess={onOpenQuickAccess}
      onOpenSettings={vi.fn()}
      onEnterModulation={vi.fn()}
      onExitModulation={callbacks.onExitModulation ?? vi.fn()}
      modulationDisabled={false}
      modulationControls={callbacks.modulationControls}
    />
  )

describe('HeaderSection quick access trigger', () => {
  it('shows the sequence, global actions, and reorganized control groups', () => {
    renderHeader(vi.fn())

    expect(screen.getByText('Lead')).toBeInTheDocument()
    expect(screen.getByLabelText('Input mode velocity')).toHaveTextContent('VInputVelocity')
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modulate' })).toBeInTheDocument()
    const timing = within(screen.getByRole('region', { name: 'Timing' }))
    const pitch = within(screen.getByRole('region', { name: 'Pitch system' }))
    const tuning = within(screen.getByRole('region', { name: 'Tuning' }))
    expect(timing.getByText('Duration')).toBeInTheDocument()
    expect(timing.getByRole('button', { name: 'Duration 4/4. Click to edit' })).toHaveTextContent('4/4')
    expect(pitch.getByRole('button', { name: 'Key 0. Click to edit' })).toHaveTextContent('0')
    expect(pitch.getByRole('button', { name: 'Select active scale' })).toHaveTextContent('chromatic')
    expect(tuning.getByText('Reference')).toBeInTheDocument()
    expect(tuning.getByText('Hz')).toBeInTheDocument()
    expect(tuning.getByText('12EDO')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Scale mode' })).toHaveValue('1')
    expect(screen.getByRole('button', {
      name: 'Reference frequency for pitch 0 440 hertz. Click to edit',
    })).toBeInTheDocument()
  })

  it('keeps the primary row while modulation replaces the secondary row', async () => {
    const user = userEvent.setup()
    const onExitModulation = vi.fn()
    renderHeader(vi.fn(), null, true, {
      modulationControls: <div>Modulation controls</div>,
      onExitModulation,
    })

    expect(screen.getByText('Lead')).toBeInTheDocument()
    expect(screen.getByText('Modulation controls')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Timing' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modulate' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Modulate' }))
    expect(onExitModulation).toHaveBeenCalledOnce()
  })

  it('applies changes through the custom scale picker and wrapping mode stepper', async () => {
    const user = userEvent.setup()
    const applyScaleSelection = vi.fn().mockResolvedValue(undefined)
    const applyModeSelection = vi.fn().mockResolvedValue(undefined)
    renderHeader(vi.fn(), null, true, { applyScaleSelection, applyModeSelection })

    await user.click(screen.getByRole('button', { name: 'Select active scale' }))
    await user.click(screen.getByRole('option', { name: 'major' }))
    await user.click(screen.getByRole('button', { name: 'Previous scale mode' }))

    expect(applyScaleSelection).toHaveBeenCalledWith('major')
    expect(applyModeSelection).toHaveBeenCalledWith(3)
  })

  it('accepts a typed mode and wraps it into the available range', async () => {
    const user = userEvent.setup()
    const applyModeSelection = vi.fn().mockResolvedValue(undefined)
    renderHeader(vi.fn(), null, true, { applyModeSelection })

    const modeInput = screen.getByRole('spinbutton', { name: 'Scale mode' })
    await user.clear(modeInput)
    await user.type(modeInput, '5{Enter}')

    expect(applyModeSelection).toHaveBeenCalledWith(2)
  })

  it('opens Quick Access from the centered search control', async () => {
    const user = userEvent.setup()
    const onOpenQuickAccess = vi.fn()
    renderHeader(onOpenQuickAccess)

    await user.click(screen.getByRole('button', { name: 'Open quick access' }))
    expect(onOpenQuickAccess).toHaveBeenCalledOnce()
  })

  it('disables the trigger until project resources are ready', () => {
    renderHeader(vi.fn(), 'Project is loading')
    expect(screen.getByRole('button', { name: 'Open quick access' })).toBeDisabled()
  })

  it('shows disabled placeholders while keeping global search available for a virtual column', () => {
    renderHeader(vi.fn(), null, false)

    expect(screen.getByRole('button', {
      name: 'Duration --. Click to edit',
    })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Key --. Click to edit' })).toBeDisabled()
    expect(screen.getByRole('button', {
      name: 'Reference frequency for pitch 0 -- hertz. Click to edit',
    })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Select active scale' })).toBeDisabled()
    expect(screen.getByRole('button', {
      name: 'Translate direction unavailable',
    })).toBeDisabled()
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(6)
    expect(screen.getByRole('button', { name: 'Open quick access' })).toBeEnabled()
  })
})
