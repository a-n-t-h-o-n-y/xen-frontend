import { describe, expect, it } from 'vitest'
import { getNoteFillColor, isNoteOffVelocity } from './sequencerNoteColor'

describe('sequencer note velocity color', () => {
  it('uses a discontinuous empty fill for zero velocity', () => {
    expect(getNoteFillColor(0)).toBe('transparent')
    expect(getNoteFillColor(-1)).toBe(getNoteFillColor(0))
    expect(isNoteOffVelocity(0)).toBe(true)
    expect(isNoteOffVelocity(0.01)).toBe(false)
  })

  it('maps nonzero velocities across a high-contrast color ramp', () => {
    expect(getNoteFillColor(0.01)).not.toBe(getNoteFillColor(0))
    expect(getNoteFillColor(0.25)).toBe('rgb(48 123 153 / 1)')
    expect(getNoteFillColor(0.75)).toBe('rgb(134 188 149 / 1)')
    expect(getNoteFillColor(1)).toBe('rgb(245 196 90 / 1)')
    expect(getNoteFillColor(2)).toBe(getNoteFillColor(1))
  })
})
