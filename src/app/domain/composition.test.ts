import { describe, expect, it } from 'vitest'
import {
  getActiveMeasureTarget,
  isColumnInLoopRegion,
  measureFromTarget,
  moveCompositionSelection,
  reconcileActiveMeasureTarget,
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

  it('derives active measure targets and measure views from composition cells', () => {
    const target = getActiveMeasureTarget(composition, { rowIndex: 1, columnIndex: 1 })
    expect(target).toEqual({ rowIndex: 1, columnIndex: 1, measureId: 1 })
    expect(measureFromTarget(project.measure, project.measureBank, composition, target).timeSignature)
      .toEqual({ numerator: 4, denominator: 4 })
    expect(getActiveMeasureTarget(composition, { rowIndex: 1, columnIndex: 2 })).toBeNull()
  })

  it('initializes an absent active target from the selected composition cell', () => {
    expect(reconcileActiveMeasureTarget(
      composition,
      null,
      { rowIndex: 1, columnIndex: 1 }
    )).toEqual({ rowIndex: 1, columnIndex: 1, measureId: 1 })
  })

  it('preserves an active target while it still resolves', () => {
    const target = { rowIndex: 0, columnIndex: 0, measureId: 1 }
    expect(reconcileActiveMeasureTarget(
      composition,
      target,
      { rowIndex: 1, columnIndex: 1 }
    )).toBe(target)
  })
})
