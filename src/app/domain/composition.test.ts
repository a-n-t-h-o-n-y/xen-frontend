import { describe, expect, it } from 'vitest'
import {
  getActiveSequenceTarget,
  isColumnInLoopRegion,
  sequenceFromTarget,
  moveCompositionSelection,
  reconcileActiveSequenceTarget,
} from './composition'
import { projectFromDto } from './mappers'
import { arrangedProjectFixture } from './testFixtures'

describe('composition helpers', () => {
  const project = projectFromDto(arrangedProjectFixture())
  const composition = project.composition!

  it('moves composition selection with wrapping', () => {
    expect(moveCompositionSelection(composition, { rowIndex: 0, columnIndex: 0 }, 'left'))
      .toEqual({ rowIndex: 0, columnIndex: 2 })
    expect(moveCompositionSelection(composition, { rowIndex: 0, columnIndex: 2 }, 'right'))
      .toEqual({ rowIndex: 0, columnIndex: 0 })
    expect(moveCompositionSelection(composition, { rowIndex: 0, columnIndex: 1 }, 'up'))
      .toEqual({ rowIndex: 1, columnIndex: 1 })
  })

  it('detects normal, wrapped, and single-column loop regions', () => {
    expect([0, 1, 2].map((index) =>
      isColumnInLoopRegion(index, { startColumn: 0, endColumn: 2 })
    )).toEqual([true, true, true])
    expect([0, 1, 2].map((index) =>
      isColumnInLoopRegion(index, { startColumn: 2, endColumn: 0 })
    )).toEqual([true, false, true])
    expect([0, 1, 2].map((index) =>
      isColumnInLoopRegion(index, { startColumn: 1, endColumn: 1 })
    )).toEqual([false, true, false])
  })

  it('derives active sequence targets and sequence views from composition cells', () => {
    const target = getActiveSequenceTarget(composition, { rowIndex: 1, columnIndex: 1 })
    expect(target).toEqual({ rowIndex: 1, columnIndex: 1, sequenceId: 1 })
    expect(sequenceFromTarget(project.sequence, project.sequenceBank, composition, target).timeSignature)
      .toEqual({ numerator: 4, denominator: 4 })
    expect(getActiveSequenceTarget(composition, { rowIndex: 1, columnIndex: 2 })).toBeNull()
  })

  it('initializes an absent active target from the selected composition cell', () => {
    expect(reconcileActiveSequenceTarget(
      composition,
      null,
      { rowIndex: 1, columnIndex: 1 }
    )).toEqual({ rowIndex: 1, columnIndex: 1, sequenceId: 1 })
  })

  it('preserves an active target while it still resolves', () => {
    const target = { rowIndex: 0, columnIndex: 0, sequenceId: 1 }
    expect(reconcileActiveSequenceTarget(
      composition,
      target,
      { rowIndex: 1, columnIndex: 1 }
    )).toBe(target)
  })
})
