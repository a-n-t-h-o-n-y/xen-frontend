import { describe, expect, it } from 'vitest'
import {
  createInitialModulationEditorState,
  createModulationPlotPaths,
  editorStateToDefinition,
  frequencyFromWavelengthPointer,
  normalizeWaveformsForOperation,
  phaseFromWavelengthDrag,
  operationAcceptsEnabledCount,
  sampleModulationShape,
  validateModulationDefinition,
  validateOutputRange,
} from './modulation'
import { modulationCatalogFixture } from './testFixtures'

describe('modulation domain', () => {
  it('creates the recommended catalog-driven initial definition and ranges', () => {
    const state = createInitialModulationEditorState(modulationCatalogFixture(), 19)
    expect(editorStateToDefinition(state)).toEqual({
      operation: 'average',
      waveforms: [{
        enabled: true,
        shape: 'sine',
        frequency: 1,
        phase: 0,
        amplitude: 1,
        amplitude_offset: 0,
      }],
    })
    expect(state.outputRanges.pitch).toEqual({ minimum: -38, maximum: 38 })
    expect(state.outputRanges.weight).toEqual({ minimum: 0.1, maximum: 2 })
    expect(state.outputRanges.midi_cc).toEqual({ minimum: 0, maximum: 1 })
  })

  it('enforces reducer, binary, and destination range rules', () => {
    const catalog = modulationCatalogFixture()
    const state = createInitialModulationEditorState(catalog, 12)
    expect(operationAcceptsEnabledCount(catalog, 'average', 1)).toBe(true)
    expect(operationAcceptsEnabledCount(catalog, 'ring', 1)).toBe(false)
    expect(operationAcceptsEnabledCount(catalog, 'ring', 2)).toBe(true)
    expect(validateModulationDefinition(catalog, editorStateToDefinition(state))).toBeNull()
    expect(validateOutputRange({ id: 'pitch' }, { minimum: 0.5, maximum: 2 }))
      .toContain('integers')
    expect(validateOutputRange({ id: 'velocity' }, { minimum: -1, maximum: 1 }))
      .toContain('between 0 and 1')
    expect(validateOutputRange({ id: 'weight' }, { minimum: 0, maximum: 1 }))
      .toContain('positive')
    expect(validateOutputRange(
      { id: 'midi_cc', controller: 74 },
      { minimum: 0, maximum: 1 }
    )).toBeNull()
  })

  it('samples table-backed shapes and emits selected and combined plot paths', () => {
    expect(sampleModulationShape('sine', 0)).toBeCloseTo(0)
    expect(sampleModulationShape('square', 0.25)).toBe(1)
    expect(sampleModulationShape('square', 0.75)).toBe(-1)
    const state = createInitialModulationEditorState(modulationCatalogFixture(), 12)
    const paths = createModulationPlotPaths(state, 16)
    expect(paths.waveforms).toHaveLength(1)
    expect(paths.waveforms[0]?.points.split(' ')).toHaveLength(17)
    expect(paths.combined.split(' ')).toHaveLength(17)
  })

  it('maps sequence-relative wavelength and allows raw intermediate paths beyond the plot', () => {
    const range = { minimum: 0, maximum: 64 }
    expect(frequencyFromWavelengthPointer(100, 100, range)).toBe(1)
    expect(frequencyFromWavelengthPointer(50, 100, range)).toBe(2)
    expect(frequencyFromWavelengthPointer(200, 100, range)).toBe(0.5)
    expect(frequencyFromWavelengthPointer(0, 100, range)).toBe(64)
    expect(phaseFromWavelengthDrag(0, 25, 100, 4, { minimum: 0, maximum: 1 }))
      .toBeCloseTo(0)
    expect(phaseFromWavelengthDrag(0, 12.5, 100, 4, { minimum: 0, maximum: 1 }))
      .toBeCloseTo(0.5)
    expect(phaseFromWavelengthDrag(0.25, 12.5, 100, 4, { minimum: 0, maximum: 1 }))
      .toBeCloseTo(0.75)

    const state = createInitialModulationEditorState(modulationCatalogFixture(), 12)
    state.waveforms[0]!.amplitude = 2
    const paths = createModulationPlotPaths(state, 8)
    const intermediateY = paths.waveforms[0]!.points.split(' ').map((point) =>
      Number(point.split(',')[1]))
    const combinedY = paths.combined.split(' ').map((point) => Number(point.split(',')[1]))
    expect(intermediateY.some((value) => value < 0 || value > 100)).toBe(true)
    expect(combinedY.every((value) => value >= 0 && value <= 100)).toBe(true)
  })

  it('adds and locks the first two waves for binary operations', () => {
    const catalog = modulationCatalogFixture()
    const state = createInitialModulationEditorState(catalog, 12)
    const waveforms = normalizeWaveformsForOperation(catalog, 'ring', state.waveforms)
    expect(waveforms).toHaveLength(2)
    expect(waveforms.map((waveform) => waveform.enabled)).toEqual([true, true])
  })
})
