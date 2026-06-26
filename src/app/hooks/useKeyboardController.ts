import { useCallback, useEffect, useRef } from 'react'
import {
  expandNumericPlaceholders,
  findKeymapBinding,
} from '../domain/keymap'
import { isCommandUiActionId } from '../domain/uiActions'
import { getMeasureById, moveCompositionSelection } from '../domain/composition'
import { moveSelection, projectRootCell } from '../domain/selection'
import { isEditableTarget } from '../presentation/viewModels'
import { getErrorMessage } from '../utils/errors'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  ActiveMeasureTarget,
  CompositionSelection,
  EditorState,
  KeymapResource,
  MessageLevel,
  ProjectSnapshot,
} from '../domain/models'
import type { ModTarget } from '../domain/modulation'

type WorkspaceView = 'composition' | 'sequencer' | 'library'

const quoteCommandArgument = (value: string): string => JSON.stringify(value)

type UseKeyboardControllerArgs = {
  bridgeUnavailableMessage: string | null
  isProjectReady: boolean
  settingsOpen: boolean
  isCommandMode: boolean
  openCommandMode: () => void
  executeBackendCommand: (command: string) => Promise<void>
  projectRef: MutableRefObject<ProjectSnapshot | null>
  editorStateRef: MutableRefObject<EditorState>
  activeMeasureTargetRef: MutableRefObject<ActiveMeasureTarget | null>
  keymapRef: MutableRefObject<KeymapResource | null>
  installEditorState: (nextState: EditorState) => void
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
  isCommandMode,
  openCommandMode,
  executeBackendCommand,
  projectRef,
  editorStateRef,
  activeMeasureTargetRef,
  keymapRef,
  installEditorState,
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
  const lastShortcutCommandRef = useRef<{ command: 'copy' | 'cut' | 'paste'; at: number } | null>(
    null
  )

  const getCompositionCellKey = (selection: CompositionSelection): string =>
    `${selection.rowIndex}:${selection.columnIndex}`

  const getSelectedCompositionMeasureName = useCallback((): string | null => {
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

    const measureId = composition.rows[selection.rowIndex]?.cells[selection.columnIndex]
    if (measureId === null || measureId === undefined) {
      return null
    }

    return getMeasureById(project.measureBank, measureId)?.name ?? null
  }, [compositionSelectionRef, projectRef])

  const assignCompositionMeasureName = useCallback((
    selection: CompositionSelection,
    measureName: string
  ): void => {
    optimisticCompositionCellNamesRef.current.set(getCompositionCellKey(selection), measureName)
    void executeBackendCommand(
      `composition cell assign ${selection.rowIndex} ${selection.columnIndex} ${
        quoteCommandArgument(measureName)
      }`
    ).catch((error: unknown) => {
      optimisticCompositionCellNamesRef.current.delete(getCompositionCellKey(selection))
      setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
      setStatusLevel('error')
    })
  }, [executeBackendCommand, setStatusLevel, setStatusMessage])

  const clearCompositionSelection = useCallback((selection: CompositionSelection): void => {
    optimisticCompositionCellNamesRef.current.delete(getCompositionCellKey(selection))
    void executeBackendCommand(
      `composition cell clear ${selection.rowIndex} ${selection.columnIndex}`
    ).catch((error: unknown) => {
      setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
      setStatusLevel('error')
    })
  }, [executeBackendCommand, setStatusLevel, setStatusMessage])

  const handleCompositionCellCopy = useCallback((clipboardData?: DataTransfer | null): boolean => {
    const measureName = getSelectedCompositionMeasureName()
    if (!measureName) {
      setStatusMessage('Empty composition cell. Nothing to copy.')
      setStatusLevel('warning')
      return false
    }

    compositionClipboardRef.current = measureName
    clipboardData?.setData('text/plain', measureName)
    setStatusMessage(`Copied composition measure ${measureName}.`)
    setStatusLevel('info')
    return true
  }, [getSelectedCompositionMeasureName, setStatusLevel, setStatusMessage])

  const handleCompositionCellPaste = useCallback((clipboardText?: string): boolean => {
    const measureName = (clipboardText ?? compositionClipboardRef.current ?? '').trim()
    if (!measureName) {
      setStatusMessage('No composition measure name to paste.')
      setStatusLevel('warning')
      return false
    }

    assignCompositionMeasureName(compositionSelectionRef.current, measureName)
    return true
  }, [assignCompositionMeasureName, compositionSelectionRef, setStatusLevel, setStatusMessage])

  const handleCompositionCellCut = useCallback((clipboardData?: DataTransfer | null): boolean => {
    if (!handleCompositionCellCopy(clipboardData)) {
      return false
    }

    clearCompositionSelection(compositionSelectionRef.current)
    return true
  }, [clearCompositionSelection, compositionSelectionRef, handleCompositionCellCopy])

  const handleCompositionCellDuplicateRight = useCallback((): boolean => {
    const project = projectRef.current
    const composition = project?.composition
    const measureName = getSelectedCompositionMeasureName()
    if (!composition || !measureName) {
      setStatusMessage('Empty composition cell. Nothing to duplicate.')
      setStatusLevel('warning')
      return false
    }

    const selection = compositionSelectionRef.current
    if (selection.columnIndex >= composition.columns.length - 1) {
      setStatusMessage('Cannot duplicate right from the last composition column.')
      setStatusLevel('warning')
      return false
    }

    const targetSelection = { rowIndex: selection.rowIndex, columnIndex: selection.columnIndex + 1 }
    assignCompositionMeasureName(
      targetSelection,
      measureName
    )
    installCompositionSelection(targetSelection)
    return true
  }, [
    assignCompositionMeasureName,
    compositionSelectionRef,
    getSelectedCompositionMeasureName,
    installCompositionSelection,
    projectRef,
    setStatusLevel,
    setStatusMessage,
  ])

  const handleCompositionCellAction = useCallback((
    action: string,
    clipboardText?: string,
    clipboardData?: DataTransfer | null
  ): boolean => {
    if (action === 'composition.cell.copy') {
      return handleCompositionCellCopy(clipboardData)
    }
    if (action === 'composition.cell.cut') {
      return handleCompositionCellCut(clipboardData)
    }
    if (action === 'composition.cell.paste') {
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
        : 'sequence'

      const matchedBinding = findKeymapBinding(
        keymapRef.current,
        activeContext,
        event,
        editorStateRef.current.inputMode
      )

      if (matchedBinding) {
        event.preventDefault()
        void (async () => {
          try {
            if (matchedBinding.target.type === 'command') {
              const command = expandNumericPlaceholders(
                matchedBinding.target.command,
                pendingNumberRef.current
              )
              const normalizedCommand = command.trim().toLowerCase()
              if (
                normalizedCommand === 'copy' ||
                normalizedCommand === 'cut' ||
                normalizedCommand === 'paste'
              ) {
                lastShortcutCommandRef.current = {
                  command: normalizedCommand,
                  at: Date.now(),
                }
              }
              await executeBackendCommand(command)
              return
            }

            if (matchedBinding.target.action === 'selection.move') {
              if (workspaceViewRef.current !== 'sequencer') return
              const project = projectRef.current
              if (!project) return
              const selection = moveSelection(
                projectRootCell(project, activeMeasureTargetRef.current),
                editorStateRef.current.selection,
                matchedBinding.target.arguments.direction,
                matchedBinding.target.arguments.amount
              )
              installEditorState({ ...editorStateRef.current, selection })
              return
            }

            if (matchedBinding.target.action === 'composition.selection.move') {
              const composition = projectRef.current?.composition
              if (!composition) return
              const selection = moveCompositionSelection(
                composition,
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

            if (matchedBinding.target.action === 'composition.cell.edit_measure') {
              editSelectedCompositionCell()
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
              openCommandMode()
            }
          } catch (error) {
            setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
            setStatusLevel('error')
          }
        })()
        pendingNumberRef.current = ''
        return
      }

      if (!isCommandMode && isDigitKey) {
        pendingNumberRef.current = `${pendingNumberRef.current}${event.key}`
        event.preventDefault()
        return
      }

      pendingNumberRef.current = ''

      if (isCommandMode) {
        return
      }

      if (event.key === ':' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        openCommandMode()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    bridgeUnavailableMessage,
    editorStateRef,
    activeMeasureTargetRef,
    executeBackendCommand,
    editSelectedCompositionCell,
    handleCompositionCellAction,
    compositionSelectionRef,
    installCompositionSelection,
    installEditorState,
    isCommandMode,
    isProjectReady,
    keymapRef,
    openCommandMode,
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
      const recentShortcut = lastShortcutCommandRef.current
      if (
        recentShortcut &&
        recentShortcut.command === command &&
        Date.now() - recentShortcut.at < 250
      ) {
        return
      }

      const editableTarget = isEditableTarget(event.target)

      if (bridgeUnavailableMessage !== null || !isProjectReady || editableTarget || isCommandMode) {
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
    isCommandMode,
    isProjectReady,
    setStatusLevel,
    setStatusMessage,
    workspaceViewRef,
  ])
}
