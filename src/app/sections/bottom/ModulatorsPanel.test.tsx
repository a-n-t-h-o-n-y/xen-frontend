import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialModulationEditorState } from '../../domain/modulation'
import { modulationCatalogFixture } from '../../domain/testFixtures'
import { ModulatorsPanel } from './ModulatorsPanel'

describe('ModulatorsPanel', () => {
  it('uses one destination and an anchored catalog-driven waveform manager', async () => {
    const user = userEvent.setup()
    const catalog = modulationCatalogFixture()
    const state = createInitialModulationEditorState(catalog, 12)
    const setDestination = vi.fn()
    const setWaveformManagerOpen = vi.fn()
    const applyAtomicState = vi.fn()
    const { rerender } = render(
      <ModulatorsPanel
        catalog={catalog}
        destination="pitch"
        state={state}
        busy={false}
        waveformManagerOpen={false}
        setWaveformManagerOpen={setWaveformManagerOpen}
        setDestination={setDestination}
        updateLocalState={vi.fn()}
        applyAtomicState={applyAtomicState}
        beginContinuousEdit={vi.fn(() => true)}
        updateContinuousState={vi.fn()}
        commitContinuousEdit={vi.fn()}
        cancelContinuousEdit={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Modulation destination' }))
    await user.click(screen.getByRole('option', { name: 'Weight' }))
    expect(setDestination).toHaveBeenCalledWith('weight')

    await user.click(screen.getByRole('button', { name: 'Waveforms' }))
    expect(setWaveformManagerOpen).toHaveBeenCalledWith(true)

    rerender(
      <ModulatorsPanel
        catalog={catalog}
        destination="pitch"
        state={state}
        busy={false}
        waveformManagerOpen
        setWaveformManagerOpen={setWaveformManagerOpen}
        setDestination={setDestination}
        updateLocalState={vi.fn()}
        applyAtomicState={applyAtomicState}
        beginContinuousEdit={vi.fn(() => true)}
        updateContinuousState={vi.fn()}
        commitContinuousEdit={vi.fn()}
        cancelContinuousEdit={vi.fn()}
      />
    )
    expect(screen.getByRole('dialog', { name: 'Waveform manager' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ Add waveform' }))
    expect(applyAtomicState).toHaveBeenCalledOnce()
  })
})
