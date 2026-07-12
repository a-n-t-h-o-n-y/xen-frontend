import { useCallback, useEffect, useRef } from 'react'
import {
  expandNumericPlaceholders,
  findKeymapBinding,
} from '../domain/keymap'
import { isCommandUiActionId } from '../domain/uiActions'
import {
  getCompositionPlacement,
  getSequenceById,
  moveCompositionSelection,
} from '../domain/composition'
import { compositionCellAssign, compositionCellUnassign } from '../domain/commands'
import { moveSelection, projectRootCell } from '../domain/selection'
import { isEditableTarget } from '../presentation/viewModels'
import { getErrorMessage } from '../utils/errors'
import { usesMetaForCommand } from '../platform'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  ActiveSequenceTarget,
  CompositionSelection,
  EditorState,
  KeymapResource,
  MessageLevel,
  ProjectSnapshot,
} from '../domain/models'
import type { ModTarget } from '../domain/modulation'

type WorkspaceView = 'composition' | 'sequencer'

type UseKeyboardControllerArgs = {
  bridgeUnavailableMessage: string | null
  isProjectReady: boolean
  settingsOpen: boolean
  isQuickAccessOpen: boolean
  openCommandPalette: () => void
  executeBackendCommand: (command: string) => Promise<void>
  projectRef: MutableRefObject<ProjectSnapshot | null>
  editorStateRef: MutableRefObject<EditorState>
  activeSequenceTargetRef: MutableRefObject<ActiveSequenceTarget | null>
  keymapRef: MutableRefObject<KeymapResource | null>
  installEditorState: (nextState: EditorState) => void
  workspaceView: WorkspaceView
  workspaceViewRef: MutableRefObject<WorkspaceView>
  compositionSelectionRef: MutableRefObject<CompositionSelection>
  installCompositionSelection: (nextSelection: CompositionSelection) => void
  setWorkspaceView: Dispatch<SetStateAction<WorkspaceView>>
  editSelectedCompositionCell: () => void
  runSelectedCompositionAction: (action: string) => boolean
  setLoopStart: () => void
  setLoopEnd: () => void
  setIsModulatorMode: Dispatch<SetStateAction<boolean>>
  selectActiveModulatorTab: (index: number) => void
  setOpenWaveMenu: Dispatch<SetStateAction<'a' | 'b' | null>>
  toggleActiveModulatorTarget: (target: ModTarget) => void
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
}

export function useKeyboardController({
  bridgeUnavailableMessage,
  isProjectReady,
  settingsOpen,
  isQuickAccessOpen,
  openCommandPalette,
  executeBackendCommand,
  projectRef,
  editorStateRef,
  activeSequenceTargetRef,
  keymapRef,
  installEditorState,
  workspaceView,
  workspaceViewRef,
  compositionSelectionRef,
  installCompositionSelection,
  setWorkspaceView,
  editSelectedCompositionCell,
  runSelectedCompositionAction,
  setLoopStart,
  setLoopEnd,
  setIsModulatorMode,
  selectActiveModulatorTab,
  setOpenWaveMenu,
  toggleActiveModulatorTarget,
  setStatusMessage,
  setStatusLevel,
}: UseKeyboardControllerArgs) {
  const pendingNumberRef = useRef('')
  const compositionClipboardRef = useRef<string | null>(null)
  const optimisticCompositionCellNamesRef = useRef<Map<string, string>>(new Map())
  const pendingNumberTimerRef = useRef<number | null>(null)

  const getCompositionCellKey = (selection: CompositionSelection): string =>
    `${selection.rowCoordinate}:${selection.columnCoordinate}`

  const clearOptimisticCompositionName = useCallback((key: string, name: string): void => {
    if (optimisticCompositionCellNamesRef.current.get(key) === name) {
      optimisticCompositionCellNamesRef.current.delete(key)
    }
  }, [])

  const getSelectedCompositionSequenceName = useCallback((): string | null => {
    const project = projectRef.current
    const composition = project?.composition
    if (!project || !composition) {
      return null
    }

    const selection = compositionSelectionRef.current
    const optimisticName = optimisticCompositionCellNamesRef.current.get(
      getCompositionCellKey(selection)
    )
    if (optimisticName) {
      return optimisticName
    }

    const sequenceId = getCompositionPlacement(
      composition,
      selection.rowCoordinate,
      selection.columnCoordinate
    )?.sequenceId
    if (sequenceId === undefined) return null

    return getSequenceById(project.sequenceBank, sequenceId)?.name ?? null
  }, [compositionSelectionRef, projectRef])

  const assignCompositionSequenceName = useCallback((
    selection: CompositionSelection,
    sequenceName: string
  ): void => {
    const key = getCompositionCellKey(selection)
    optimisticCompositionCellNamesRef.current.set(key, sequenceName)
    void executeBackendCommand(
      compositionCellAssign(
        selection.rowCoordinate,
        selection.columnCoordinate,
        sequenceName
      )
    ).then(() => {
      clearOptimisticCompositionName(key, sequenceName)
    }).catch((error: unknown) => {
      clearOptimisticCompositionName(key, sequenceName)
      setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
      setStatusLevel('error')
    })
  }, [clearOptimisticCompositionName, executeBackendCommand, setStatusLevel, setStatusMessage])

  const unassignCompositionSelection = useCallback((selection: CompositionSelection): void => {
    optimisticCompositionCellNamesRef.current.delete(getCompositionCellKey(selection))
    void executeBackendCommand(
      compositionCellUnassign(selection.rowCoordinate, selection.columnCoordinate)
    ).catch((error: unknown) => {
      setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
      setStatusLevel('error')
    })
  }, [executeBackendCommand, setStatusLevel, setStatusMessage])

  const handleCompositionCellCopy = useCallback((clipboardData?: DataTransfer | null): boolean => {
    const sequenceName = getSelectedCompositionSequenceName()
    if (!sequenceName) {
      setStatusMessage('Empty composition cell. Nothing to copy.')
      setStatusLevel('warning')
      return false
    }

    compositionClipboardRef.current = sequenceName
    if (clipboardData) {
      clipboardData.setData('text/plain', sequenceName)
    } else if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(sequenceName).catch(() => undefined)
    }
    setStatusMessage(`Copied composition sequence ${sequenceName}.`)
    setStatusLevel('info')
    return true
  }, [getSelectedCompositionSequenceName, setStatusLevel, setStatusMessage])

  const handleCompositionCellPaste = useCallback((clipboardText?: string): boolean => {
    const sequenceName = (clipboardText ?? compositionClipboardRef.current ?? '').trim()
    if (!sequenceName) {
      setStatusMessage('No composition sequence name to paste.')
      setStatusLevel('warning')
      return false
    }

    assignCompositionSequenceName(compositionSelectionRef.current, sequenceName)
    return true
  }, [assignCompositionSequenceName, compositionSelectionRef, setStatusLevel, setStatusMessage])

  const handleCompositionCellCut = useCallback((clipboardData?: DataTransfer | null): boolean => {
    if (!handleCompositionCellCopy(clipboardData)) {
      return false
    }

    unassignCompositionSelection(compositionSelectionRef.current)
    return true
  }, [unassignCompositionSelection, compositionSelectionRef, handleCompositionCellCopy])

  const handleCompositionCellDuplicateRight = useCallback((): boolean => {
    const sequenceName = getSelectedCompositionSequenceName()
    if (!sequenceName) {
      setStatusMessage('Empty composition cell. Nothing to duplicate.')
      setStatusLevel('warning')
      return false
    }

    const selection = compositionSelectionRef.current
    const targetSelection = moveCompositionSelection(selection, 'right')
    if (targetSelection.columnCoordinate === selection.columnCoordinate) {
      setStatusMessage('Cannot duplicate beyond the coordinate limit.')
      setStatusLevel('warning')
      return false
    }
    assignCompositionSequenceName(
      targetSelection,
      sequenceName
    )
    installCompositionSelection(targetSelection)
    return true
  }, [
    assignCompositionSequenceName,
    compositionSelectionRef,
    getSelectedCompositionSequenceName,
    installCompositionSelection,
    setStatusLevel,
    setStatusMessage,
  ])

  const handleCompositionCellAction = useCallback((
    action: string,
    clipboardText?: string,
    clipboardData?: DataTransfer | null
  ): boolean => {
    if (action === 'edit.copy') {
      return handleCompositionCellCopy(clipboardData)
    }
    if (action === 'edit.cut') {
      return handleCompositionCellCut(clipboardData)
    }
    if (action === 'edit.paste') {
      return handleCompositionCellPaste(clipboardText)
    }
    if (action === 'composition.cell.duplicate_right') {
      return handleCompositionCellDuplicateRight()
    }
    return false
  }, [
    handleCompositionCellCopy,
    handleCompositionCellCut,
    handleCompositionCellDuplicateRight,
    handleCompositionCellPaste,
  ])

  const toggleWorkspaceView = useCallback((): void => {
    setWorkspaceView((current) => current === 'sequencer' ? 'composition' : 'sequencer')
  }, [setWorkspaceView])

  useEffect(() => {
    pendingNumberRef.current = ''
    if (pendingNumberTimerRef.current !== null) {
      window.clearTimeout(pendingNumberTimerRef.current)
      pendingNumberTimerRef.current = null
    }
  }, [isQuickAccessOpen, settingsOpen, workspaceView])

  useEffect(() => {
    const clearOnEditableFocus = (event: FocusEvent): void => {
      if (!isEditableTarget(event.target)) return
      pendingNumberRef.current = ''
      if (pendingNumberTimerRef.current !== null) {
        window.clearTimeout(pendingNumberTimerRef.current)
        pendingNumberTimerRef.current = null
      }
    }
    document.addEventListener('focusin', clearOnEditableFocus)
    return () => document.removeEventListener('focusin', clearOnEditableFocus)
  }, [])

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent): void => {
      const editableTarget = isEditableTarget(event.target)

      if (bridgeUnavailableMessage !== null || !isProjectReady) {
        return
      }

      if (settingsOpen) {
        return
      }

      if (editableTarget) {
        return
      }

      const isDigitKey =
        event.key.length === 1 &&
        event.key >= '0' &&
        event.key <= '9' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey

      const activeContext = workspaceViewRef.current === 'composition'
        ? 'composition'
        : 'sequencer'

      const matchedBinding = findKeymapBinding(
        keymapRef.current,
        activeContext,
        event,
        editorStateRef.current.inputMode
      )

      if (matchedBinding) {
        if (event.repeat && matchedBinding.repeat !== 'allow') {
          return
        }
        const editAction = matchedBinding.target.type === 'ui_action' &&
          matchedBinding.target.action.startsWith('edit.')
          ? matchedBinding.target.action.slice('edit.'.length)
          : null
        const nativeClipboardKey = editAction === 'copy' ? 'c' : editAction === 'cut' ? 'x' : 'v'
        const isNativeClipboardKey = editAction !== null &&
          ((usesMetaForCommand && event.metaKey && !event.ctrlKey) ||
            (!usesMetaForCommand && event.ctrlKey && !event.metaKey)) &&
          event.key.toLowerCase() === nativeClipboardKey
        if (isNativeClipboardKey) {
          pendingNumberRef.current = ''
          return
        }
        event.preventDefault()
        void (async () => {
          try {
            if (matchedBinding.target.type === 'command') {
              const command = expandNumericPlaceholders(
                matchedBinding.target.command,
                pendingNumberRef.current
              )
              await executeBackendCommand(command)
              return
            }

            if (matchedBinding.target.action === 'selection.move') {
              if (workspaceViewRef.current !== 'sequencer') return
              const project = projectRef.current
              if (!project) return
              const selection = moveSelection(
                projectRootCell(project, activeSequenceTargetRef.current),
                editorStateRef.current.selection,
                matchedBinding.target.arguments.direction,
                matchedBinding.target.arguments.amount
              )
              installEditorState({ ...editorStateRef.current, selection })
              return
            }

            if (matchedBinding.target.action === 'composition.selection.move') {
              const selection = moveCompositionSelection(
                compositionSelectionRef.current,
                matchedBinding.target.arguments.direction,
                matchedBinding.target.arguments.amount
              )
              installCompositionSelection(selection)
              return
            }

            if (matchedBinding.target.action === 'input_mode.set') {
              installEditorState({
                ...editorStateRef.current,
                inputMode: matchedBinding.target.arguments.mode,
              })
              return
            }

            if (matchedBinding.target.action === 'workspace.view.toggle') {
              toggleWorkspaceView()
              return
            }

            if (matchedBinding.target.action === 'workspace.view.composition') {
              setWorkspaceView('composition')
              return
            }

            if (matchedBinding.target.action === 'workspace.view.sequencer') {
              setWorkspaceView('sequencer')
              return
            }

            if (matchedBinding.target.action === 'composition.cell.edit_sequence') {
              editSelectedCompositionCell()
              return
            }

            if (
              matchedBinding.target.action === 'edit.copy' ||
              matchedBinding.target.action === 'edit.cut' ||
              matchedBinding.target.action === 'edit.paste'
            ) {
              const command = matchedBinding.target.action.slice('edit.'.length)
              if (workspaceViewRef.current === 'composition') {
                if (command === 'paste' && navigator.clipboard?.readText) {
                  const text = await navigator.clipboard.readText().catch(() => '')
                  handleCompositionCellPaste(text)
                } else {
                  handleCompositionCellAction(matchedBinding.target.action)
                }
              } else {
                await executeBackendCommand(command)
              }
              return
            }

            if (handleCompositionCellAction(matchedBinding.target.action)) {
              return
            }

            if (runSelectedCompositionAction(matchedBinding.target.action)) {
              return
            }

            if (matchedBinding.target.action === 'composition.loop.set_start') {
              setLoopStart()
              return
            }

            if (matchedBinding.target.action === 'composition.loop.set_end') {
              setLoopEnd()
              return
            }

            if (matchedBinding.target.action === 'modulator.mode.toggle') {
              if (workspaceViewRef.current !== 'sequencer') return
              setIsModulatorMode((previous) => {
                const next = !previous
                if (!next) {
                  setOpenWaveMenu(null)
                }
                return next
              })
              return
            }

            if (matchedBinding.target.action === 'modulator.slot.select') {
              selectActiveModulatorTab(matchedBinding.target.arguments.slot - 1)
              return
            }

            if (matchedBinding.target.action === 'modulator.target.toggle') {
              const target = matchedBinding.target.arguments.target as ModTarget
              toggleActiveModulatorTarget(target)
              return
            }

            if (
              isCommandUiActionId(matchedBinding.target.action) &&
              matchedBinding.target.action === 'command.open'
            ) {
              openCommandPalette()
            }
          } catch (error) {
            setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
            setStatusLevel('error')
          }
        })()
        pendingNumberRef.current = ''
        return
      }

      if (!isQuickAccessOpen && isDigitKey) {
        pendingNumberRef.current = `${pendingNumberRef.current}${event.key}`
        if (pendingNumberTimerRef.current !== null) {
          window.clearTimeout(pendingNumberTimerRef.current)
        }
        pendingNumberTimerRef.current = window.setTimeout(() => {
          pendingNumberRef.current = ''
          pendingNumberTimerRef.current = null
        }, 1_500)
        event.preventDefault()
        return
      }

      pendingNumberRef.current = ''

      if (isQuickAccessOpen) {
        return
      }

    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
      pendingNumberRef.current = ''
      if (pendingNumberTimerRef.current !== null) {
        window.clearTimeout(pendingNumberTimerRef.current)
        pendingNumberTimerRef.current = null
      }
    }
  }, [
    bridgeUnavailableMessage,
    editorStateRef,
    activeSequenceTargetRef,
    executeBackendCommand,
    editSelectedCompositionCell,
    handleCompositionCellAction,
    handleCompositionCellPaste,
    compositionSelectionRef,
    installCompositionSelection,
    installEditorState,
    isQuickAccessOpen,
    isProjectReady,
    keymapRef,
    openCommandPalette,
    projectRef,
    runSelectedCompositionAction,
    selectActiveModulatorTab,
    setIsModulatorMode,
    setLoopEnd,
    setLoopStart,
    setOpenWaveMenu,
    setStatusLevel,
    setStatusMessage,
    setWorkspaceView,
    settingsOpen,
    toggleActiveModulatorTarget,
    toggleWorkspaceView,
    workspaceViewRef,
  ])

  useEffect(() => {
    const handleClipboardCommand = (command: string, event: ClipboardEvent): void => {
      const editableTarget = isEditableTarget(event.target)

      if (
        bridgeUnavailableMessage !== null || !isProjectReady || editableTarget ||
        isQuickAccessOpen || settingsOpen
      ) {
        return
      }

      const key = command === 'copy' ? 'c' : command === 'cut' ? 'x' : 'v'
      const keyboardEvent = new KeyboardEvent('keydown', {
        key,
        code: `Key${key.toUpperCase()}`,
        ctrlKey: !usesMetaForCommand,
        metaKey: usesMetaForCommand,
      })
      const context = workspaceViewRef.current === 'composition' ? 'composition' : 'sequencer'
      const binding = findKeymapBinding(
        keymapRef.current,
        context,
        keyboardEvent,
        editorStateRef.current.inputMode
      )
      if (
        binding?.target.type !== 'ui_action' ||
        binding.target.action !== `edit.${command}`
      ) {
        return
      }

      if (workspaceViewRef.current === 'composition') {
        event.preventDefault()
        if (command === 'copy') {
          handleCompositionCellCopy(event.clipboardData)
        } else if (command === 'cut') {
          handleCompositionCellCut(event.clipboardData)
        } else {
          handleCompositionCellPaste(event.clipboardData?.getData('text/plain'))
        }
        return
      }

      event.preventDefault()

      void executeBackendCommand(command).catch((error: unknown) => {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      })
    }

    const handleCopy = (event: ClipboardEvent): void => {
      handleClipboardCommand('copy', event)
    }
    const handleCut = (event: ClipboardEvent): void => {
      handleClipboardCommand('cut', event)
    }
    const handlePaste = (event: ClipboardEvent): void => {
      handleClipboardCommand('paste', event)
    }

    window.addEventListener('copy', handleCopy)
    window.addEventListener('cut', handleCut)
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('copy', handleCopy)
      window.removeEventListener('cut', handleCut)
      window.removeEventListener('paste', handlePaste)
    }
  }, [
    bridgeUnavailableMessage,
    compositionSelectionRef,
    executeBackendCommand,
    handleCompositionCellCopy,
    handleCompositionCellCut,
    handleCompositionCellPaste,
    editorStateRef,
    isQuickAccessOpen,
    isProjectReady,
    keymapRef,
    setStatusLevel,
    setStatusMessage,
    settingsOpen,
    workspaceViewRef,
  ])
}
