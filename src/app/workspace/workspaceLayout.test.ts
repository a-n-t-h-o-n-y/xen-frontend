import { describe, expect, it } from 'vitest'
import { projectFromDto } from '../domain/mappers'
import { arrangedProjectFixture } from '../domain/testFixtures'
import {
  DUAL_EDITOR_MIN_HEIGHT_PX,
  WORKSPACE_LAYOUT_STORAGE_KEY,
  canShowDualEditorLayout,
  readWorkspaceLayoutPreference,
  resolveSequenceEditorPresentation,
  writeWorkspaceLayoutPreference,
} from './workspaceLayout'

describe('workspace layout preferences', () => {
  it('defaults to single and validates stored preferences', () => {
    expect(readWorkspaceLayoutPreference({ getItem: () => null })).toBe('single')
    expect(readWorkspaceLayoutPreference({ getItem: () => 'dual' })).toBe('dual')
    expect(readWorkspaceLayoutPreference({ getItem: () => 'wide' })).toBe('single')
    expect(readWorkspaceLayoutPreference({
      getItem: () => { throw new Error('denied') },
    })).toBe('single')
  })

  it('persists preferences and tolerates unavailable storage', () => {
    const values = new Map<string, string>()
    writeWorkspaceLayoutPreference('dual', {
      setItem: (key, value) => values.set(key, value),
    })

    expect(values.get(WORKSPACE_LAYOUT_STORAGE_KEY)).toBe('dual')
    expect(() => writeWorkspaceLayoutPreference('single', {
      setItem: () => { throw new Error('denied') },
    })).not.toThrow()
  })

  it('requires the preference, composition data, and the full minimum height', () => {
    expect(canShowDualEditorLayout('single', true, DUAL_EDITOR_MIN_HEIGHT_PX)).toBe(false)
    expect(canShowDualEditorLayout('dual', false, DUAL_EDITOR_MIN_HEIGHT_PX)).toBe(false)
    expect(canShowDualEditorLayout('dual', true, DUAL_EDITOR_MIN_HEIGHT_PX - 1)).toBe(false)
    expect(canShowDualEditorLayout('dual', true, DUAL_EDITOR_MIN_HEIGHT_PX)).toBe(true)
  })

  it('previews the selected composition sequence at its root without changing active state', () => {
    const project = projectFromDto(arrangedProjectFixture())
    const activeTarget = { rowCoordinate: 3, columnCoordinate: 0, sequenceId: 1 }
    const editorSelection = { path: [{ kind: 'element' as const, index: 0 }] }

    const preview = resolveSequenceEditorPresentation(
      true,
      'composition',
      project.composition,
      { rowCoordinate: -2, columnCoordinate: 9 },
      activeTarget,
      editorSelection
    )

    expect(preview).toEqual({
      target: { rowCoordinate: -2, columnCoordinate: 9, sequenceId: 2 },
      selection: { path: [] },
      previewingComposition: true,
      emptyCompositionCell: false,
    })
    expect(activeTarget).toEqual({ rowCoordinate: 3, columnCoordinate: 0, sequenceId: 1 })
    expect(editorSelection).toEqual({ path: [{ kind: 'element', index: 0 }] })
  })

  it('shows an empty preview only for empty cells in active dual Composition view', () => {
    const project = projectFromDto(arrangedProjectFixture())
    const activeTarget = { rowCoordinate: 3, columnCoordinate: 0, sequenceId: 1 }
    const editorSelection = { path: [{ kind: 'element' as const, index: 0 }] }
    const emptyPreview = resolveSequenceEditorPresentation(
      true,
      'composition',
      project.composition,
      { rowCoordinate: 3, columnCoordinate: 1 },
      activeTarget,
      editorSelection
    )

    expect(emptyPreview.target).toBeNull()
    expect(emptyPreview.emptyCompositionCell).toBe(true)

    expect(resolveSequenceEditorPresentation(
      false,
      'composition',
      project.composition,
      { rowCoordinate: -2, columnCoordinate: 9 },
      activeTarget,
      editorSelection
    )).toEqual({
      target: activeTarget,
      selection: editorSelection,
      previewingComposition: false,
      emptyCompositionCell: false,
    })
  })
})
