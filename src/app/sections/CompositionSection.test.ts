import { describe, expect, it } from 'vitest'
import { getCompositionSelectionScrollDelta } from './compositionScroll'

const rect = (
  top: number,
  right: number,
  bottom: number,
  left: number
): Pick<DOMRectReadOnly, 'top' | 'right' | 'bottom' | 'left'> => ({
  top,
  right,
  bottom,
  left,
})

describe('composition selection scrolling', () => {
  const scrollerRect = rect(0, 500, 300, 0)
  const stickySize = { width: 100, height: 50 }

  it('scrolls upward when the selected cell is covered by the sticky header', () => {
    expect(getCompositionSelectionScrollDelta(
      scrollerRect,
      rect(30, 220, 90, 120),
      stickySize
    )).toEqual({ topDelta: -20, leftDelta: 0 })
  })

  it('scrolls downward when the selected cell is below the visible matrix area', () => {
    expect(getCompositionSelectionScrollDelta(
      scrollerRect,
      rect(260, 220, 340, 120),
      stickySize
    )).toEqual({ topDelta: 40, leftDelta: 0 })
  })

  it('scrolls left when the selected cell is covered by the sticky row headers', () => {
    expect(getCompositionSelectionScrollDelta(
      scrollerRect,
      rect(80, 140, 120, 70),
      stickySize
    )).toEqual({ topDelta: 0, leftDelta: -30 })
  })

  it('scrolls right when the selected cell is beyond the visible matrix area', () => {
    expect(getCompositionSelectionScrollDelta(
      scrollerRect,
      rect(80, 540, 120, 460),
      stickySize
    )).toEqual({ topDelta: 0, leftDelta: 40 })
  })

  it('does not scroll when the selected cell is fully visible', () => {
    expect(getCompositionSelectionScrollDelta(
      scrollerRect,
      rect(80, 220, 120, 120),
      stickySize
    )).toEqual({ topDelta: 0, leftDelta: 0 })
  })
})
