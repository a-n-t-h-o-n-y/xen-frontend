import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialModulatorPanelState } from '../../domain/modulation'
import { ModulatorsPanel } from './ModulatorsPanel'

const renderPanel = () => {
  const beginContinuousEdit = vi.fn(() => true)
  const commitContinuousEdit = vi.fn()
  const cancelContinuousEdit = vi.fn()
  const onWaveLerpChange = vi.fn()
  const selectWaveType = vi.fn()
  render(
    <ModulatorsPanel
      activeModulatorTab={0}
      activeModulator={createInitialModulatorPanelState()}
      selectActiveModulatorTab={vi.fn()}
      selectWaveType={selectWaveType}
      onWaveLerpChange={onWaveLerpChange}
      onWaveAPulseWidthChange={vi.fn()}
      onWaveBPulseWidthChange={vi.fn()}
      clampNumber={(value, min, max) => Math.max(min, Math.min(value, max))}
      setTargetEnabled={vi.fn()}
      resetTargetControl={vi.fn()}
      padDragRef={createRef()}
      applyPadMotion={vi.fn()}
      tuningLength={12}
      beginContinuousEdit={beginContinuousEdit}
      commitContinuousEdit={commitContinuousEdit}
      cancelContinuousEdit={cancelContinuousEdit}
    />
  )
  return {
    slider: screen.getByRole('slider', { name: 'Wave lerp' }),
    beginContinuousEdit,
    commitContinuousEdit,
    cancelContinuousEdit,
    onWaveLerpChange,
    selectWaveType,
  }
}

describe('modulator continuous controls', () => {
  it('uses compact waveform dropdowns', async () => {
    const user = userEvent.setup()
    const controls = renderPanel()

    await user.click(screen.getByRole('button', { name: 'Wave A waveform' }))
    await user.click(screen.getByRole('option', { name: 'Square' }))

    expect(controls.selectWaveType).toHaveBeenCalledExactlyOnceWith('a', 'square')
    expect(screen.getByRole('button', { name: 'Wave B waveform' })).toHaveTextContent('Triangle')
  })

  it('begins on pointer down, previews changes, and commits on pointer up', () => {
    const controls = renderPanel()

    fireEvent.pointerDown(controls.slider)
    fireEvent.change(controls.slider, { target: { value: '0.75' } })
    fireEvent.pointerUp(controls.slider)

    expect(controls.beginContinuousEdit).toHaveBeenCalledOnce()
    expect(controls.onWaveLerpChange).toHaveBeenCalledExactlyOnceWith(0.75)
    expect(controls.commitContinuousEdit).toHaveBeenCalledOnce()
  })

  it('groups repeated slider key changes until keyup', () => {
    const controls = renderPanel()

    fireEvent.keyDown(controls.slider, { key: 'ArrowRight', repeat: false })
    fireEvent.keyDown(controls.slider, { key: 'ArrowRight', repeat: true })
    fireEvent.change(controls.slider, { target: { value: '0.52' } })
    fireEvent.keyUp(controls.slider, { key: 'ArrowRight' })

    expect(controls.beginContinuousEdit).toHaveBeenCalledOnce()
    expect(controls.commitContinuousEdit).toHaveBeenCalledOnce()
  })

  it('cancels an active slider gesture on focus loss', () => {
    const controls = renderPanel()

    fireEvent.keyDown(controls.slider, { key: 'PageUp', repeat: false })
    fireEvent.blur(controls.slider)

    expect(controls.beginContinuousEdit).toHaveBeenCalledOnce()
    expect(controls.cancelContinuousEdit).toHaveBeenCalledOnce()
  })

  it('does not let delayed pointer focus loss cancel another gesture', () => {
    const controls = renderPanel()

    fireEvent.pointerDown(controls.slider)
    fireEvent.pointerUp(controls.slider)
    fireEvent.blur(controls.slider)

    expect(controls.beginContinuousEdit).toHaveBeenCalledOnce()
    expect(controls.commitContinuousEdit).toHaveBeenCalledOnce()
    expect(controls.cancelContinuousEdit).not.toHaveBeenCalled()
  })
})
