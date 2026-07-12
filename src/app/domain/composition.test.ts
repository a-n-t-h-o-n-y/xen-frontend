import { describe, expect, it } from 'vitest'
import {
  MAX_COMPOSITION_COORDINATE,
  MIN_COMPOSITION_COORDINATE,
  getActiveSequenceTarget,
  getCompositionPlacement,
  isColumnInLoopRegion,
  moveCompositionSelection,
  reconcileActiveSequenceTarget,
  sequenceFromTarget,
} from './composition'
import { projectFromDto } from './mappers'
import { arrangedProjectFixture } from './testFixtures'

describe('sparse composition helpers', () => {
  const project = projectFromDto(arrangedProjectFixture())
  const composition = project.composition!

  it('moves through signed coordinates without wrapping or clamping to materialized axes', () => {
    expect(moveCompositionSelection(
      { rowCoordinate: 0, columnCoordinate: 0 },
      'left'
    )).toEqual({ rowCoordinate: 0, columnCoordinate: -1 })
    expect(moveCompositionSelection(
      { rowCoordinate: -40, columnCoordinate: 900_000 },
      'down',
      3
    )).toEqual({ rowCoordinate: -37, columnCoordinate: 900_000 })
  })

  it('guards signed-int32 coordinate overflow', () => {
    expect(moveCompositionSelection(
      { rowCoordinate: MIN_COMPOSITION_COORDINATE, columnCoordinate: 0 },
      'up'
    ).rowCoordinate).toBe(MIN_COMPOSITION_COORDINATE)
    expect(moveCompositionSelection(
      { rowCoordinate: 0, columnCoordinate: MAX_COMPOSITION_COORDINATE },
      'right'
    ).columnCoordinate).toBe(MAX_COMPOSITION_COORDINATE)
  })

  it('looks up negative and far-apart placements without intermediate objects', () => {
    expect(composition.rows.size).toBe(2)
    expect(composition.columns.size).toBe(3)
    expect(composition.placements.size).toBe(4)
    expect(getCompositionPlacement(composition, -2, 9)?.sequenceId).toBe(2)
    expect(getCompositionPlacement(composition, -2, 8)).toBeNull()
  })

  it('highlights inclusive loop coordinates, including implicit columns', () => {
    expect([-3, -2, 0, 6, 7].map((coordinate) =>
      isColumnInLoopRegion(coordinate, composition.loopRegion)
    )).toEqual([false, true, true, true, false])
  })

  it('derives and reconciles active targets by exact coordinate', () => {
    const target = getActiveSequenceTarget(
      composition,
      { rowCoordinate: 3, columnCoordinate: 0 }
    )
    expect(target).toEqual({ rowCoordinate: 3, columnCoordinate: 0, sequenceId: 1 })
    expect(sequenceFromTarget(
      project.sequence,
      project.sequenceBank,
      composition,
      target
    ).timeSignature).toEqual({ numerator: 4, denominator: 4 })
    expect(getActiveSequenceTarget(
      composition,
      { rowCoordinate: 3, columnCoordinate: 1 }
    )).toBeNull()
    expect(reconcileActiveSequenceTarget(
      composition,
      { rowCoordinate: 3, columnCoordinate: 0, sequenceId: 2 },
      { rowCoordinate: -2, columnCoordinate: 9 }
    )).toEqual({ rowCoordinate: -2, columnCoordinate: 9, sequenceId: 2 })
  })
})
