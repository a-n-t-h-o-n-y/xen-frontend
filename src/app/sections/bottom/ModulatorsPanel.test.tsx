import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialModulationEditorState } from '../../domain/modulation'
import { modulationCatalogFixture } from '../../domain/testFixtures'
import { ModulatorsPanel } from './ModulatorsPanel'

describe('ModulatorsPanel', () => {
  it('uses input mode implicitly and presents compact waveform tiles', async () => {
    const user = userEvent.setup()
    const catalog = modulationCatalogFixture()
    const state = createInitialModulationEditorState(catalog, 12)
    const setWaveformManagerOpen = vi.fn()
    const applyAtomicState = vi.fn()
    const props = {
      catalog,
      state,
      busy: false,
      waveformManagerOpen: false,
      setWaveformManagerOpen,
      updateLocalState: vi.fn(),
      applyAtomicState,
      beginContinuousEdit: vi.fn(() => true),
      updateContinuousState: vi.fn(),
      commitContinuousEdit: vi.fn(),
      cancelContinuousEdit: vi.fn(),
    }
    const { rerender } = render(<ModulatorsPanel {...props} />)

    expect(screen.queryByRole('button', { name: 'Modulation destination' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select waveform 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add waveform' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Configure waveform 1' }))
    expect(setWaveformManagerOpen).toHaveBeenCalledWith(true)

    rerender(<ModulatorsPanel {...props} waveformManagerOpen />)
    expect(screen.getByRole('dialog', { name: 'Waveform 1 settings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sine' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('offers every operation and prepares exactly two active binary waves', async () => {
    const user = userEvent.setup()
    const catalog = modulationCatalogFixture()
    const state = createInitialModulationEditorState(catalog, 12)
    const applyAtomicState = vi.fn()
    render(
      <ModulatorsPanel
        catalog={catalog}
        state={state}
        busy={false}
        waveformManagerOpen={false}
        setWaveformManagerOpen={vi.fn()}
        updateLocalState={vi.fn()}
        applyAtomicState={applyAtomicState}
        beginContinuousEdit={vi.fn(() => true)}
        updateContinuousState={vi.fn()}
        commitContinuousEdit={vi.fn()}
        cancelContinuousEdit={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Combine waveforms' }))
    await user.click(screen.getByRole('option', { name: 'Ring' }))
    const update = applyAtomicState.mock.calls[0]?.[0]
    const next = update(state)
    expect(next.operation).toBe('ring')
    expect(next.waveforms).toHaveLength(2)
    expect(next.waveforms.map((waveform: { enabled: boolean }) => waveform.enabled)).toEqual([true, true])
  })
})
