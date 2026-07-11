import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HeaderSection } from './HeaderSection'

const renderHeader = (onOpenQuickAccess: () => void, disabledReason: string | null = null) =>
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
      timeSignature="4/4"
      applyTimeSignatureScale={vi.fn()}
      isKeyEditing={false}
      keyInputRef={createRef<HTMLInputElement>()}
      keyDraft="0"
      setKeyDraft={vi.fn()}
      commitKey={vi.fn().mockResolvedValue(undefined)}
      cancelKeyEdit={vi.fn()}
      beginKeyEdit={vi.fn()}
      keyDisplay="0"
      isBaseFrequencyEditing={false}
      baseFrequencyInputRef={createRef<HTMLInputElement>()}
      baseFrequencyDraft="440"
      setBaseFrequencyDraft={vi.fn()}
      commitBaseFrequency={vi.fn().mockResolvedValue(undefined)}
      cancelBaseFrequencyEdit={vi.fn()}
      beginBaseFrequencyEdit={vi.fn()}
      baseFrequency="440"
      scaleMenuRef={createRef<HTMLDivElement>()}
      openScaleMenu={false}
      setOpenScaleMenu={vi.fn()}
      isScaleUpdating={false}
      scaleOptions={[{ id: 'chromatic', name: 'chromatic', command: 'set scale chromatic' }]}
      scaleName="chromatic"
      applyScaleSelection={vi.fn().mockResolvedValue(undefined)}
      scaleTranslateDirection="up"
      toggleTranslateDirection={vi.fn().mockResolvedValue(undefined)}
      modeOptions={[]}
      scaleMode={0}
      applyModeSelection={vi.fn().mockResolvedValue(undefined)}
      tuningName="12EDO"
      onOpenQuickAccess={onOpenQuickAccess}
    />
  )

describe('HeaderSection quick access trigger', () => {
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
})
