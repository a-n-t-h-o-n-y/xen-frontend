import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { defaultKeymapDocument } from '../domain/defaultKeymap'
import { projectFromDto } from '../domain/mappers'
import { arrangedProjectFixture } from '../domain/testFixtures'
import { usesMetaForCommand } from '../platform'
import { useKeyboardController } from './useKeyboardController'
import type { EditorState, KeymapResource, ProjectSnapshot } from '../domain/models'

const deferred = () => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const createResource = (): KeymapResource => {
  const bindings = structuredClone(defaultKeymapDocument.bindings)
  return {
    revision: '0',
    keySemantics: 'KeyboardEvent.key-or-code',
    bindings,
    document: { schemaVersion: 2, bindings },
    source: 'default',
    loadError: null,
  }
}

const renderController = (
  keymap: KeymapResource,
  openCommandPalette = vi.fn(),
  executeBackendCommand = vi.fn().mockResolvedValue(undefined),
  options: {
    workspaceView?: 'sequencer' | 'composition'
    projectRef?: { current: ProjectSnapshot | null }
    compositionSelectionRef?: { current: { rowIndex: number; columnIndex: number } }
  } = {}
) => {
  const editorState: EditorState = { selection: { path: [] }, inputMode: 'pitch' }
  const workspaceView = options.workspaceView ?? 'sequencer'
  const args: Parameters<typeof useKeyboardController>[0] = {
    bridgeUnavailableMessage: null,
    isProjectReady: true,
    settingsOpen: false,
    isQuickAccessOpen: false,
    openCommandPalette,
    executeBackendCommand,
    projectRef: options.projectRef ?? { current: null },
    editorStateRef: { current: editorState },
    activeSequenceTargetRef: { current: null },
    keymapRef: { current: keymap },
    installEditorState: vi.fn(),
    workspaceView,
    workspaceViewRef: { current: workspaceView },
    compositionSelectionRef: options.compositionSelectionRef ?? {
      current: { rowIndex: 0, columnIndex: 0 },
    },
    installCompositionSelection: vi.fn(),
    setWorkspaceView: vi.fn(),
    editSelectedCompositionCell: vi.fn(),
    runSelectedCompositionAction: vi.fn().mockReturnValue(false),
    setLoopStart: vi.fn(),
    setLoopEnd: vi.fn(),
    setIsModulatorMode: vi.fn(),
    selectActiveModulatorTab: vi.fn(),
    setOpenWaveMenu: vi.fn(),
    toggleActiveModulatorTarget: vi.fn(),
    setStatusMessage: vi.fn(),
    setStatusLevel: vi.fn(),
  }
  return renderHook(() => useKeyboardController(args))
}

describe('useKeyboardController', () => {
  it('routes conventional undo and redo accelerators in both workspace views', async () => {
    const primaryModifier = usesMetaForCommand ? { metaKey: true } : { ctrlKey: true }

    for (const workspaceView of ['sequencer', 'composition'] as const) {
      const execute = vi.fn().mockResolvedValue(undefined)
      const rendered = renderController(createResource(), vi.fn(), execute, { workspaceView })

      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ...primaryModifier }))
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'z',
          shiftKey: true,
          ...primaryModifier,
        }))
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ...primaryModifier }))
      })

      expect(execute.mock.calls.map((call) => call[0])).toEqual(['undo', 'redo', 'redo'])
      rendered.unmount()
    }
  })

  it('leaves native text undo to editable controls', () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const rendered = renderController(createResource(), vi.fn(), execute)
    const input = document.createElement('input')
    document.body.append(input)

    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z',
      bubbles: true,
      ...(usesMetaForCommand ? { metaKey: true } : { ctrlKey: true }),
    }))

    expect(execute).not.toHaveBeenCalled()
    input.remove()
    rendered.unmount()
  })

  it('opens Quick Access through the configured shifted-colon binding', () => {
    const openCommandPalette = vi.fn()
    const rendered = renderController(createResource(), openCommandPalette)

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ':',
      code: 'Semicolon',
      shiftKey: true,
    })))

    expect(openCommandPalette).toHaveBeenCalledOnce()
    rendered.unmount()
  })

  it('does not retain a hidden colon fallback after deleting the binding', () => {
    const keymap = createResource()
    keymap.bindings.sequencer = keymap.bindings.sequencer?.filter((binding) =>
      binding.trigger.match.value !== ':'
    ) ?? []
    const openCommandPalette = vi.fn()
    const rendered = renderController(keymap, openCommandPalette)

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ':',
      code: 'Semicolon',
      shiftKey: true,
    })))

    expect(openCommandPalette).not.toHaveBeenCalled()
    rendered.unmount()
  })

  it('routes native clipboard events only when their binding is active', () => {
    const activeKeymap = createResource()
    const executeActive = vi.fn().mockResolvedValue(undefined)
    const active = renderController(activeKeymap, vi.fn(), executeActive)

    act(() => window.dispatchEvent(new Event('copy')))
    expect(executeActive).toHaveBeenCalledWith('copy')
    active.unmount()

    const disabledKeymap = createResource()
    disabledKeymap.bindings.sequencer = disabledKeymap.bindings.sequencer?.filter((binding) =>
      binding.target.type !== 'ui_action' || binding.target.action !== 'edit.copy'
    ) ?? []
    const executeDisabled = vi.fn().mockResolvedValue(undefined)
    const disabled = renderController(disabledKeymap, vi.fn(), executeDisabled)

    act(() => window.dispatchEvent(new Event('copy')))
    expect(executeDisabled).not.toHaveBeenCalled()
    disabled.unmount()
  })

  it('expands numeric command placeholders through the workspace prefix state', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const rendered = renderController(createResource(), vi.fn(), execute)

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', code: 'Digit3' })))
    await act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS' }))
      return Promise.resolve()
    })

    expect(execute).toHaveBeenCalledWith('split 3')
    rendered.unmount()
  })

  it('keeps only the latest pending composition name and clears it after ingestion', async () => {
    const fixture = arrangedProjectFixture()
    const firstSequence = fixture.project.sequence_bank.sequences[0]
    if (firstSequence) firstSequence.name = 'Restored'
    fixture.project.composition.rows[0]!.cells[1] = 1
    const projectRef = { current: projectFromDto(fixture) as ProjectSnapshot | null }
    const selectionRef = { current: { rowIndex: 0, columnIndex: 1 } }
    const first = deferred()
    const second = deferred()
    const execute = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const rendered = renderController(createResource(), vi.fn(), execute, {
      workspaceView: 'composition',
      projectRef,
      compositionSelectionRef: selectionRef,
    })

    const dispatchClipboardEvent = (
      type: 'copy' | 'paste',
      text: string,
      setData = vi.fn()
    ): ReturnType<typeof vi.fn> => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperty(event, 'clipboardData', {
        value: { getData: () => text, setData },
      })
      window.dispatchEvent(event)
      return setData
    }

    act(() => {
      dispatchClipboardEvent('paste', 'First')
      dispatchClipboardEvent('paste', 'Second')
    })
    first.reject(new Error('First assignment failed'))
    await act(() => first.promise.catch(() => undefined))

    const pendingCopy = vi.fn()
    act(() => dispatchClipboardEvent('copy', '', pendingCopy))
    expect(pendingCopy).toHaveBeenCalledWith('text/plain', 'Second')

    second.resolve()
    await act(() => second.promise)

    const restoredCopy = vi.fn()
    act(() => dispatchClipboardEvent('copy', '', restoredCopy))
    expect(restoredCopy).toHaveBeenCalledWith('text/plain', 'Restored')
    rendered.unmount()
  })
})
