import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTransportState } from '../constants'
import { useTransportPlayhead } from './useTransportPlayhead'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useTransportPlayhead', () => {
  it('only requests animation frames while transport is active', () => {
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(17)
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    const transportRef = { current: createTransportState() }
    const selectedTimeSignatureRef = { current: { numerator: 4, denominator: 4 } }
    const setPlayheadPhase = vi.fn()

    const { rerender } = renderHook(
      ({ isTransportActive }) => useTransportPlayhead({
        sequenceNumerator: 4,
        sequenceDenominator: 4,
        transportRef,
        selectedTimeSignatureRef,
        isTransportActive,
        setPlayheadPhase,
      }),
      { initialProps: { isTransportActive: false } }
    )

    expect(requestFrame).not.toHaveBeenCalled()

    transportRef.current.active = true
    act(() => rerender({ isTransportActive: true }))
    expect(requestFrame).toHaveBeenCalledTimes(1)

    transportRef.current.active = false
    act(() => rerender({ isTransportActive: false }))
    expect(cancelFrame).toHaveBeenCalledWith(17)
    expect(requestFrame).toHaveBeenCalledTimes(1)
  })
})
