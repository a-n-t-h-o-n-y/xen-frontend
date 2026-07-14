import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DUAL_EDITOR_MIN_HEIGHT_PX,
  WORKSPACE_LAYOUT_STORAGE_KEY,
} from '../workspace/workspaceLayout'
import { useWorkspaceLayout } from './useWorkspaceLayout'

function LayoutHarness() {
  const { workspaceRef, showDualEditors } = useWorkspaceLayout(true, 'dual')

  return (
    <section ref={workspaceRef}>
      <output>{showDualEditors ? 'dual' : 'single'}</output>
    </section>
  )
}

describe('useWorkspaceLayout', () => {
  let resizeCallback: ResizeObserverCallback
  let availableHeight = 0

  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, 'dual')
    availableHeight = DUAL_EDITOR_MIN_HEIGHT_PX - 1

    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe() {}
      disconnect() {}
      unobserve() {}
    }

    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: 0,
      top: 0,
      right: 100,
      bottom: availableHeight,
      left: 0,
      width: 100,
      height: availableHeight,
      toJSON: () => ({}),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('responds to usable workspace height changes', () => {
    render(<LayoutHarness />)
    expect(screen.getByText('single')).toBeInTheDocument()

    availableHeight = DUAL_EDITOR_MIN_HEIGHT_PX
    act(() => resizeCallback([], {} as ResizeObserver))
    expect(screen.getByText('dual')).toBeInTheDocument()

    availableHeight = DUAL_EDITOR_MIN_HEIGHT_PX - 1
    act(() => resizeCallback([], {} as ResizeObserver))
    expect(screen.getByText('single')).toBeInTheDocument()
  })
})
