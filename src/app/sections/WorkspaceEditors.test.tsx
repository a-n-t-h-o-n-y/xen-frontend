import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkspaceEditors } from './WorkspaceEditors'

const renderEditors = (activeView: 'sequencer' | 'composition', dual: boolean) => render(
  <WorkspaceEditors
    activeView={activeView}
    dual={dual}
    sequencer={<div data-testid="sequencer">Sequence editor</div>}
    composition={<div data-testid="composition">Composition editor</div>}
  />
)

describe('WorkspaceEditors', () => {
  it('renders Sequence above Composition in dual view and marks the active pane', () => {
    const { container } = renderEditors('composition', true)
    const panes = container.querySelectorAll('.workspacePane')

    expect(panes).toHaveLength(2)
    expect(panes[0]).toContainElement(screen.getByTestId('sequencer'))
    expect(panes[1]).toContainElement(screen.getByTestId('composition'))
    expect(panes[0]).not.toHaveAttribute('hidden')
    expect(panes[1]).not.toHaveAttribute('hidden')
    expect(panes[1]).toHaveClass('workspacePane-active')
  })

  it('hides only the inactive editor in single view', () => {
    const { container, rerender } = renderEditors('sequencer', false)
    let panes = container.querySelectorAll('.workspacePane')

    expect(panes[0]).not.toHaveAttribute('hidden')
    expect(panes[1]).toHaveAttribute('hidden')
    expect(panes[1]).toHaveAttribute('aria-hidden', 'true')

    rerender(
      <WorkspaceEditors
        activeView="composition"
        dual={false}
        sequencer={<div>Sequence editor</div>}
        composition={<div>Composition editor</div>}
      />
    )
    panes = container.querySelectorAll('.workspacePane')
    expect(panes[0]).toHaveAttribute('hidden')
    expect(panes[1]).not.toHaveAttribute('hidden')
  })
})
