import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { compositionPlacementKey } from '../domain/composition'
import { projectFromDto } from '../domain/mappers'
import { arrangedProjectFixture } from '../domain/testFixtures'
import { useCompositionCommands } from './useCompositionCommands'
import type { EditorState, ProjectSnapshot } from '../domain/models'

const renderCompositionCommands = (
  projectRef: { current: ProjectSnapshot | null },
  selection = { rowCoordinate: 3, columnCoordinate: 0 },
  executeBackendCommand = vi.fn().mockResolvedValue(undefined)
) => {
  const editorStateRef = {
    current: {
      selection: { path: [{ kind: 'element' as const, index: 0 }] },
      inputMode: 'pitch' as const,
      midiCcController: 0,
    } satisfies EditorState,
  }
  const installActiveSequenceTarget = vi.fn()
  const installEditorState = vi.fn()
  const installWorkspaceView = vi.fn()
  const setStatusMessage = vi.fn()
  const setStatusLevel = vi.fn()
  const rendered = renderHook(() => useCompositionCommands({
    projectRef,
    compositionSelectionRef: { current: selection },
    editorStateRef,
    bridgeUnavailableMessage: null,
    executeBackendCommand,
    setStatusMessage,
    setStatusLevel,
    installActiveSequenceTarget,
    installEditorState,
    installWorkspaceView,
  }))

  return {
    ...rendered,
    installActiveSequenceTarget,
    installEditorState,
    installWorkspaceView,
    setStatusMessage,
    setStatusLevel,
  }
}

describe('useCompositionCommands sequence entry', () => {
  it('enters an existing placement at the sequence root without a backend command', async () => {
    const projectRef = { current: projectFromDto(arrangedProjectFixture()) as ProjectSnapshot | null }
    const execute = vi.fn().mockResolvedValue(undefined)
    const rendered = renderCompositionCommands(projectRef, undefined, execute)

    await act(() => rendered.result.current.enterSelectedCompositionSequence())

    expect(execute).not.toHaveBeenCalled()
    expect(rendered.installActiveSequenceTarget).toHaveBeenCalledWith({
      rowCoordinate: 3,
      columnCoordinate: 0,
      sequenceId: 1,
    })
    expect(rendered.installEditorState).toHaveBeenCalledWith({
      selection: { path: [] },
      inputMode: 'pitch',
      midiCcController: 0,
    })
    expect(rendered.installWorkspaceView).toHaveBeenCalledWith('sequencer')
  })

  it('creates an empty placement before entering it', async () => {
    const projectRef = { current: projectFromDto(arrangedProjectFixture()) as ProjectSnapshot | null }
    const execute = vi.fn().mockImplementation(async () => {
      projectRef.current?.composition?.placements.set(
        compositionPlacementKey(3, 1),
        { rowCoordinate: 3, columnCoordinate: 1, sequenceId: 3 }
      )
    })
    const rendered = renderCompositionCommands(
      projectRef,
      { rowCoordinate: 3, columnCoordinate: 1 },
      execute
    )

    await act(() => rendered.result.current.enterSelectedCompositionSequence())

    expect(execute).toHaveBeenCalledWith('composition cell assign 3 1 "S3"')
    expect(rendered.installActiveSequenceTarget).toHaveBeenCalledWith({
      rowCoordinate: 3,
      columnCoordinate: 1,
      sequenceId: 3,
    })
    expect(rendered.installWorkspaceView).toHaveBeenCalledWith('sequencer')
  })

  it('stays in Composition and reports failed creation', async () => {
    const projectRef = { current: projectFromDto(arrangedProjectFixture()) as ProjectSnapshot | null }
    const execute = vi.fn().mockRejectedValue(new Error('No route'))
    const rendered = renderCompositionCommands(
      projectRef,
      { rowCoordinate: 3, columnCoordinate: 1 },
      execute
    )

    await act(() => rendered.result.current.enterSelectedCompositionSequence())

    expect(rendered.installWorkspaceView).not.toHaveBeenCalled()
    expect(rendered.setStatusMessage).toHaveBeenCalledWith('Command failed: No route')
    expect(rendered.setStatusLevel).toHaveBeenCalledWith('error')
  })

  it('does not enqueue duplicate creation while entry is pending', async () => {
    const projectRef = { current: projectFromDto(arrangedProjectFixture()) as ProjectSnapshot | null }
    let resolveCommand!: () => void
    const command = new Promise<void>((resolve) => {
      resolveCommand = resolve
    })
    const execute = vi.fn(() => command)
    const rendered = renderCompositionCommands(
      projectRef,
      { rowCoordinate: 3, columnCoordinate: 1 },
      execute
    )

    let firstEntry!: Promise<boolean>
    await act(async () => {
      firstEntry = rendered.result.current.enterSelectedCompositionSequence()
      await rendered.result.current.enterSelectedCompositionSequence()
    })
    expect(execute).toHaveBeenCalledOnce()

    projectRef.current?.composition?.placements.set(
      compositionPlacementKey(3, 1),
      { rowCoordinate: 3, columnCoordinate: 1, sequenceId: 3 }
    )
    resolveCommand()
    await act(() => firstEntry)
    expect(rendered.installWorkspaceView).toHaveBeenCalledOnce()
  })
})
