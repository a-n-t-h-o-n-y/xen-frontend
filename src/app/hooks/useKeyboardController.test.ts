import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { defaultKeymapDocument } from '../domain/defaultKeymap'
import { projectFromDto } from '../domain/mappers'
import { arrangedProjectFixture, projectFixture } from '../domain/testFixtures'
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
    compositionSelectionRef?: {
      current: { rowCoordinate: number; columnCoordinate: number }
    }
    beginCompositionColumnLengthEdit?: () => void
    editorStateRef?: { current: EditorState }
    installEditorState?: (nextState: EditorState) => void
    setWorkspaceView?: Parameters<typeof useKeyboardController>[0]['setWorkspaceView']
    enterSelectedCompositionSequence?: () => Promise<boolean>
    isModulatorMode?: boolean
    exitModulatorMode?: () => void
    setIsModulatorMode?: Parameters<typeof useKeyboardController>[0]['setIsModulatorMode']
  } = {}
) => {
  const editorState: EditorState = { selection: { path: [] }, inputMode: 'pitch' }
  const editorStateRef = options.editorStateRef ?? { current: editorState }
  const workspaceView = options.workspaceView ?? 'sequencer'
  const args: Parameters<typeof useKeyboardController>[0] = {
    bridgeUnavailableMessage: null,
    isProjectReady: true,
    settingsOpen: false,
    isQuickAccessOpen: false,
    openCommandPalette,
    executeBackendCommand,
    projectRef: options.projectRef ?? { current: null },
    editorStateRef,
    activeSequenceTargetRef: { current: null },
    keymapRef: { current: keymap },
    installEditorState: options.installEditorState ?? vi.fn(),
    workspaceView,
    workspaceViewRef: { current: workspaceView },
    compositionSelectionRef: options.compositionSelectionRef ?? {
      current: { rowCoordinate: 0, columnCoordinate: 0 },
    },
    installCompositionSelection: vi.fn(),
    setWorkspaceView: options.setWorkspaceView ?? vi.fn(),
    enterSelectedCompositionSequence: options.enterSelectedCompositionSequence ??
      vi.fn().mockResolvedValue(true),
    runSelectedCompositionAction: vi.fn().mockReturnValue(false),
    beginCompositionColumnLengthEdit: options.beginCompositionColumnLengthEdit ?? vi.fn(),
    setLoopStart: vi.fn(),
    setLoopEnd: vi.fn(),
    isModulatorMode: options.isModulatorMode ?? false,
    exitModulatorMode: options.exitModulatorMode ?? vi.fn(),
    setIsModulatorMode: options.setIsModulatorMode ?? vi.fn(),
    setStatusMessage: vi.fn(),
    setStatusLevel: vi.fn(),
  }
  return renderHook(() => useKeyboardController(args))
}

describe('useKeyboardController', () => {
  it('makes modulation an exclusive mode with Escape and Quick Access exits', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const exitModulatorMode = vi.fn()
    const openCommandPalette = vi.fn()
    const rendered = renderController(createResource(), openCommandPalette, execute, {
      isModulatorMode: true,
      exitModulatorMode,
    })

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })))
    expect(execute).not.toHaveBeenCalled()

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(exitModulatorMode).toHaveBeenCalledOnce()

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ':',
      code: 'Semicolon',
      shiftKey: true,
    })))
    expect(exitModulatorMode).toHaveBeenCalledTimes(2)
    expect(openCommandPalette).toHaveBeenCalledOnce()
    rendered.unmount()
  })

  it('continues to dispatch configured modulator actions during modulation mode', () => {
    const keymap = createResource()
    const template = keymap.bindings.sequencer?.find((binding) =>
      binding.target.type === 'ui_action' && binding.target.action === 'command.open'
    )
    if (!template) throw new Error('Expected command binding')
    const binding = structuredClone(template)
    binding.trigger.match.value = 'm'
    binding.trigger.modifiers = {
      shift: false,
      alt: false,
      primary: false,
      control: false,
      meta: false,
    }
    binding.target = { type: 'ui_action', action: 'modulator.mode.toggle', arguments: {} }
    keymap.bindings.sequencer?.push(binding)
    const setIsModulatorMode = vi.fn()
    const rendered = renderController(keymap, vi.fn(), vi.fn(), {
      isModulatorMode: true,
      setIsModulatorMode,
    })

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' })))

    expect(setIsModulatorMode).toHaveBeenCalledOnce()
    rendered.unmount()
  })

  it('does not enter modulation mode while Scale input is active', () => {
    const keymap = createResource()
    const template = keymap.bindings.sequencer?.find((binding) =>
      binding.target.type === 'ui_action' && binding.target.action === 'command.open'
    )
    if (!template) throw new Error('Expected command binding')
    const binding = structuredClone(template)
    binding.trigger.match.value = 'm'
    binding.trigger.modifiers = {
      shift: false,
      alt: false,
      primary: false,
      control: false,
      meta: false,
    }
    binding.target = { type: 'ui_action', action: 'modulator.mode.toggle', arguments: {} }
    keymap.bindings.sequencer?.push(binding)
    const setIsModulatorMode = vi.fn()
    const rendered = renderController(keymap, vi.fn(), vi.fn(), {
      editorStateRef: { current: { selection: { path: [] }, inputMode: 'scale' } },
      setIsModulatorMode,
    })

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' })))

    expect(setIsModulatorMode).not.toHaveBeenCalled()
    rendered.unmount()
  })

  it('uses hierarchical movement to cross between Composition and the Sequencer', async () => {
    const enterSelectedCompositionSequence = vi.fn().mockResolvedValue(true)
    const compositionController = renderController(createResource(), vi.fn(), vi.fn(), {
      workspaceView: 'composition',
      enterSelectedCompositionSequence,
    })

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        shiftKey: true,
      }))
    })
    expect(enterSelectedCompositionSequence).toHaveBeenCalledOnce()
    compositionController.unmount()

    const editorStateRef: { current: EditorState } = {
      current: {
        selection: { path: [{ kind: 'element' as const, index: 0 }] },
        inputMode: 'pitch' as const,
      },
    }
    const installEditorState = vi.fn((nextState: EditorState) => {
      editorStateRef.current = nextState
    })
    const setWorkspaceView = vi.fn()
    const sequencerController = renderController(createResource(), vi.fn(), vi.fn(), {
      projectRef: { current: projectFromDto(projectFixture()) },
      editorStateRef,
      installEditorState,
      setWorkspaceView,
    })

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      shiftKey: true,
    })))
    expect(installEditorState).toHaveBeenLastCalledWith({
      selection: { path: [] },
      inputMode: 'pitch',
    })
    expect(setWorkspaceView).not.toHaveBeenCalled()

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      shiftKey: true,
    })))
    expect(setWorkspaceView).toHaveBeenCalledWith('composition')
    sequencerController.unmount()
  })

  it('keeps unshifted composition movement separate from sequence entry', () => {
    const selectionRef = { current: { rowCoordinate: 1, columnCoordinate: 2 } }
    const enterSelectedCompositionSequence = vi.fn().mockResolvedValue(true)
    const rendered = renderController(createResource(), vi.fn(), vi.fn(), {
      workspaceView: 'composition',
      compositionSelectionRef: selectionRef,
      enterSelectedCompositionSequence,
    })

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' })))

    expect(enterSelectedCompositionSequence).not.toHaveBeenCalled()
    rendered.unmount()
  })

  it('does not include default Tab or composition Enter crossings', () => {
    for (const context of ['sequencer', 'composition']) {
      expect(defaultKeymapDocument.bindings[context]?.some((binding) =>
        binding.trigger.match.value === 'Tab'
      )).toBe(false)
    }
    expect(defaultKeymapDocument.bindings.composition?.some((binding) =>
      binding.trigger.match.value === 'Enter' &&
      binding.target.type === 'ui_action' &&
      binding.target.action === 'composition.cell.edit_sequence'
    )).toBe(false)
  })

  it('continues to dispatch a legacy custom composition entry action', async () => {
    const keymap = createResource()
    const template = keymap.bindings.composition?.find((binding) =>
      binding.target.type === 'ui_action' &&
      binding.target.action === 'composition.cell.rename_or_create_sequence'
    )
    if (!template) throw new Error('Expected a composition action binding')
    const binding = structuredClone(template)
    binding.trigger.match.value = 'Enter'
    binding.target = {
      type: 'ui_action',
      action: 'composition.cell.edit_sequence',
      arguments: {},
    }
    keymap.bindings.composition?.push(binding)
    const enterSelectedCompositionSequence = vi.fn().mockResolvedValue(true)
    const rendered = renderController(keymap, vi.fn(), vi.fn(), {
      workspaceView: 'composition',
      enterSelectedCompositionSequence,
    })

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    })

    expect(enterSelectedCompositionSequence).toHaveBeenCalledOnce()
    rendered.unmount()
  })

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

  it('routes composition column-length bindings to the global header editor', () => {
    const keymap = createResource()
    const template = keymap.bindings.composition?.find((binding) =>
      binding.target.type === 'ui_action' && binding.target.action === 'composition.row.rename'
    )
    if (!template) throw new Error('Expected composition row rename binding')
    const binding = structuredClone(template)
    binding.trigger.match.value = 't'
    binding.target = {
      type: 'ui_action',
      action: 'composition.column.length',
      arguments: {},
    }
    keymap.bindings.composition?.push(binding)
    const beginCompositionColumnLengthEdit = vi.fn()
    const rendered = renderController(keymap, vi.fn(), vi.fn(), {
      workspaceView: 'composition',
      beginCompositionColumnLengthEdit,
    })

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', code: 'KeyT' })))

    expect(beginCompositionColumnLengthEdit).toHaveBeenCalledOnce()
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
    const projectRef = { current: projectFromDto(fixture) as ProjectSnapshot | null }
    const selectionRef = { current: { rowCoordinate: 3, columnCoordinate: 0 } }
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
