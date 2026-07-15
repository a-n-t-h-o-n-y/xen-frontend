import { describe, expect, it } from 'vitest'
import {
  createInitialModulationEditorState,
  createModulationPlotPaths,
  editorStateToDefinition,
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
    expect(state.outputRanges.pitch).toEqual({ minimum: 0, maximum: 18 })
    expect(state.outputRanges.weight).toEqual({ minimum: 0.1, maximum: 2 })
  })

  it('enforces reducer, binary, and destination range rules', () => {
    const catalog = modulationCatalogFixture()
    const state = createInitialModulationEditorState(catalog, 12)
    expect(operationAcceptsEnabledCount(catalog, 'average', 1)).toBe(true)
    expect(operationAcceptsEnabledCount(catalog, 'ring', 1)).toBe(false)
    expect(operationAcceptsEnabledCount(catalog, 'ring', 2)).toBe(true)
    expect(validateModulationDefinition(catalog, editorStateToDefinition(state))).toBeNull()
    expect(validateOutputRange('pitch', { minimum: 0.5, maximum: 2 })).toContain('integers')
    expect(validateOutputRange('velocity', { minimum: -1, maximum: 1 })).toContain('between 0 and 1')
    expect(validateOutputRange('weight', { minimum: 0, maximum: 1 })).toContain('positive')
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
})
