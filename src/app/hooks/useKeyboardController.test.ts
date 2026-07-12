import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { defaultKeymapDocument } from '../domain/defaultKeymap'
import { useKeyboardController } from './useKeyboardController'
import type { EditorState, KeymapResource } from '../domain/models'

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
  executeBackendCommand = vi.fn().mockResolvedValue(undefined)
) => {
  const editorState: EditorState = { selection: { path: [] }, inputMode: 'pitch' }
  const args: Parameters<typeof useKeyboardController>[0] = {
    bridgeUnavailableMessage: null,
    isProjectReady: true,
    settingsOpen: false,
    isQuickAccessOpen: false,
    openCommandPalette,
    executeBackendCommand,
    projectRef: { current: null },
    editorStateRef: { current: editorState },
    activeMeasureTargetRef: { current: null },
    keymapRef: { current: keymap },
    installEditorState: vi.fn(),
    workspaceView: 'sequencer',
    workspaceViewRef: { current: 'sequencer' },
    compositionSelectionRef: { current: { rowIndex: 0, columnIndex: 0 } },
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
})
