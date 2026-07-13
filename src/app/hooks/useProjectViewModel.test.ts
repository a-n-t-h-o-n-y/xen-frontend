import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { projectFromDto } from '../domain/mappers'
import { arrangedProjectFixture } from '../domain/testFixtures'
import { useProjectViewModel } from './useProjectViewModel'

describe('useProjectViewModel active-column metadata', () => {
  it('uses selected materialized metadata and blanks virtual columns without changing the target', () => {
    const fixture = arrangedProjectFixture()
    const materializedColumn = fixture.project.composition.columns.find(
      (column) => column.coordinate === -4
    )
    if (!materializedColumn) throw new Error('Expected materialized column fixture')
    materializedColumn.pitch.base_frequency = 432
    const project = projectFromDto(fixture)
    const activeTarget = { rowCoordinate: 3, columnCoordinate: -4, sequenceId: 2 }
    const activeSequence = project.sequenceBank?.sequences.find((entry) => entry.id === 2)
    if (!activeSequence) throw new Error('Expected active sequence fixture')

    const { result, rerender } = renderHook(
      ({ headerColumnCoordinate }: { headerColumnCoordinate: number }) =>
        useProjectViewModel(project, { path: [] }, activeTarget, headerColumnCoordinate),
      { initialProps: { headerColumnCoordinate: 0 } }
    )

    expect(result.current?.hasHeaderColumnMetadata).toBe(true)
    expect(result.current?.timeSignature).toBe('4/4')
    expect(result.current?.baseFrequency).toBe(440)
    expect(result.current?.rootCell).toBe(activeSequence.sequence.cell)
    expect(result.current?.sequenceNumerator).toBe(7)
    expect(result.current?.sequenceDenominator).toBe(8)

    rerender({ headerColumnCoordinate: -4 })

    expect(result.current?.timeSignature).toBe('7/8')
    expect(result.current?.baseFrequency).toBe(432)

    rerender({ headerColumnCoordinate: 5 })

    expect(result.current?.hasHeaderColumnMetadata).toBe(false)
    expect(result.current?.timeSignature).toBe('--')
    expect(result.current?.keyDisplay).toBe('--')
    expect(result.current?.baseFrequency).toBe('--')
    expect(result.current?.scaleName).toBe('--')
    expect(result.current?.scaleTranslateDirection).toBeNull()
    expect(result.current?.tuningName).toBe('--')
    expect(result.current?.rootCell).toBe(activeSequence.sequence.cell)
  })
})
