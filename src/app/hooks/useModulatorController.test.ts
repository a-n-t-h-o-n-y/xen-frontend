import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialModulatorPanelState } from '../domain/modulation'
import { useModulatorController } from './useModulatorController'

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('modulator preview lifecycle', () => {
  it('keeps a failed gesture attached until backend cancellation finishes', async () => {
    const cancellation = deferred()
    const preview = {
      update: vi.fn().mockRejectedValue(new Error('invalid target value')),
      commit: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn(() => cancellation.promise),
    }
    const executeBackendCommand = vi.fn().mockResolvedValue(undefined)
    const activeModulator = createInitialModulatorPanelState()
    const rendered = renderHook(() => useModulatorController({
      bridgeUnavailableMessage: null,
      tuningLength: 12,
      modulatorPreviewWidth: 100,
      executeBackendCommand,
      beginBackendPreview: () => preview,
      setStatusMessage: vi.fn(),
      setStatusLevel: vi.fn(),
      activeModulator,
      updateActiveModulator: vi.fn(),
      updateActiveTargetControl: vi.fn(),
      setOpenWaveMenu: vi.fn(),
      lastWaveHandleUsedRef: { current: 'a' },
    }))
    const host = document.createElement('div')
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      right: 100,
      top: 0,
      bottom: 40,
      width: 100,
      height: 40,
      toJSON: () => ({}),
    })

    act(() => {
      expect(rendered.result.current.beginContinuousEdit()).toBe(true)
      rendered.result.current.applyPadMotion('weights', host, 0, 20, 'center')
    })
    await waitFor(() => expect(preview.cancel).toHaveBeenCalledOnce())

    act(() => {
      rendered.result.current.applyPadMotion('weights', host, 5, 20, 'center')
    })
    expect(preview.update).toHaveBeenCalledOnce()
    expect(executeBackendCommand).not.toHaveBeenCalled()

    cancellation.resolve()
    await act(async () => cancellation.promise)
  })
})
