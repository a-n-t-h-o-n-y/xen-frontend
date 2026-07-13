import { describe, expect, it } from 'vitest'
import {
  moveSelection,
  moveSelectionWithTopBoundary,
  reconcileSelection,
  resolveSelection,
} from './selection'
import { nestedCell } from './testFixtures'
import type { Selection } from './music'

describe('strict selection and local navigation', () => {
  it('strictly resolves typed paths and falls back to root', () => {
    const nested: Selection = {
      path: [
        { kind: 'element', index: 1 },
        { kind: 'cell', index: 1 },
        { kind: 'element', index: 0 },
      ],
    }
    expect(resolveSelection(nestedCell, nested)?.selectedElement).toMatchObject({
      type: 'Note',
      pitch: 2,
    })
    expect(resolveSelection(nestedCell, {
      path: [{ kind: 'element', index: 0 }, { kind: 'cell', index: 0 }],
    })).toBeNull()
    expect(reconcileSelection(nestedCell, {
      path: [{ kind: 'element', index: 99 }],
    })).toEqual({ path: [] })
  })

  it('matches backend left, right, up, and down behavior', () => {
    const child: Selection = {
      path: [{ kind: 'element', index: 1 }, { kind: 'cell', index: 1 }],
    }
    expect(moveSelection(nestedCell, child, 'left')).toEqual({
      path: [{ kind: 'element', index: 1 }, { kind: 'cell', index: 0 }],
    })
    expect(moveSelection(nestedCell, child, 'right')).toEqual({
      path: [{ kind: 'element', index: 1 }, { kind: 'cell', index: 0 }],
    })
    expect(moveSelection(nestedCell, child, 'down')).toEqual({
      path: [
        { kind: 'element', index: 1 },
        { kind: 'cell', index: 1 },
        { kind: 'element', index: 0 },
      ],
    })
    expect(moveSelection(nestedCell, child, 'up')).toEqual({
      path: [{ kind: 'element', index: 1 }],
    })
  })

  it('crosses above the root only after the root has been selected', () => {
    const element: Selection = { path: [{ kind: 'element', index: 0 }] }

    expect(moveSelectionWithTopBoundary(nestedCell, element, 'up')).toEqual({
      selection: { path: [] },
      crossedAboveRoot: false,
    })
    expect(moveSelectionWithTopBoundary(nestedCell, { path: [] }, 'up')).toEqual({
      selection: { path: [] },
      crossedAboveRoot: true,
    })
    expect(moveSelectionWithTopBoundary(nestedCell, element, 'up', 2)).toEqual({
      selection: { path: [] },
      crossedAboveRoot: true,
    })
  })

  it('never reports a top-boundary crossing for other directions', () => {
    expect(moveSelectionWithTopBoundary(nestedCell, { path: [] }, 'down')).toEqual({
      selection: {
        path: [{ kind: 'element', index: 0 }],
      },
      crossedAboveRoot: false,
    })
  })
})
