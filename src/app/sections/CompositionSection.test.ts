import { describe, expect, it } from 'vitest'
import { buildVirtualCoordinateRange } from './compositionViewport'

describe('composition virtual viewport', () => {
  it('keeps the selected signed coordinate at the center without materializing gaps', () => {
    expect(buildVirtualCoordinateRange(-200_000, 2)).toEqual([
      -200_002,
      -200_001,
      -200_000,
      -199_999,
      -199_998,
    ])
  })

  it('leaves overflow slots empty at signed-int32 boundaries', () => {
    expect(buildVirtualCoordinateRange(-2_147_483_648, 1)).toEqual([
      null,
      -2_147_483_648,
      -2_147_483_647,
    ])
  })
})
