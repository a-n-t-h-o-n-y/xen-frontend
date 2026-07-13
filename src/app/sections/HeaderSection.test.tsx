import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HeaderSection } from './HeaderSection'

const renderHeader = (
  onOpenQuickAccess: () => void,
  disabledReason: string | null = null,
  metadataAvailable = true
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
      scaleMenuRef={createRef<HTMLDivElement>()}
      openScaleMenu={false}
      setOpenScaleMenu={vi.fn()}
      isScaleUpdating={false}
      scaleOptions={[{ id: 'chromatic', name: 'chromatic', command: 'set scale chromatic' }]}
      scaleName={metadataAvailable ? 'chromatic' : '--'}
      applyScaleSelection={vi.fn().mockResolvedValue(undefined)}
      scaleTranslateDirection={metadataAvailable ? 'up' : null}
      toggleTranslateDirection={vi.fn().mockResolvedValue(undefined)}
      modeOptions={[]}
      scaleMode={0}
      applyModeSelection={vi.fn().mockResolvedValue(undefined)}
      tuningName={metadataAvailable ? '12EDO' : '--'}
      sequenceName="Lead"
      currentInputMode="velocity"
      selectionInspector={{
        kind: 'note',
        summary: 'Note · P7',
        items: [{ label: 'Pitch', value: '7' }],
      }}
      showSelectionInspector
      onOpenQuickAccess={onOpenQuickAccess}
      onOpenSettings={vi.fn()}
      onEnterModulation={vi.fn()}
      modulationDisabled={false}
    />
  )

describe('HeaderSection quick access trigger', () => {
  it('shows sequence identity, input mode, and selection metadata', async () => {
    const user = userEvent.setup()
    renderHeader(vi.fn())

    expect(screen.getByText('Lead')).toBeInTheDocument()
    expect(screen.getByLabelText('Input mode velocity')).toHaveTextContent('V')
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modulate' })).toBeInTheDocument()
    const inspectorTrigger = screen.getByRole('button', { name: 'Note · P7' })
    await user.click(inspectorTrigger)
    expect(screen.getByRole('dialog', { name: 'Selection inspector' })).toHaveTextContent('Pitch7')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Selection inspector' })).not.toBeInTheDocument()
    expect(inspectorTrigger).toHaveFocus()
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
      name: 'Time signature --. Click to edit',
    })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Key --. Click to edit' })).toBeDisabled()
    expect(screen.getByRole('button', {
      name: 'Zero frequency -- hertz. Click to edit',
    })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Select active scale' })).toBeDisabled()
    expect(screen.getByRole('button', {
      name: 'Translate direction unavailable',
    })).toBeDisabled()
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(6)
    expect(screen.getByRole('button', { name: 'Open quick access' })).toBeEnabled()
  })
})
