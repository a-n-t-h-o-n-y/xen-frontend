import { useCallback, useEffect, useRef } from 'react'
import {
  expandNumericPlaceholders,
  findKeymapBinding,
} from '../domain/keymap'
import { isCommandUiActionId } from '../domain/uiActions'
import { moveSelection, projectRootCell } from '../domain/selection'
import { isEditableTarget } from '../presentation/viewModels'
import { getErrorMessage } from '../utils/errors'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { EditorState, KeymapResource, MessageLevel, ProjectSnapshot } from '../domain/models'
import type { ModTarget } from '../domain/modulation'

type WorkspaceView = 'sequencer' | 'library'

type UseKeyboardControllerArgs = {
  bridgeUnavailableMessage: string | null
  isProjectReady: boolean
  settingsOpen: boolean
  isCommandMode: boolean
  openCommandMode: () => void
  executeBackendCommand: (command: string) => Promise<void>
  projectRef: MutableRefObject<ProjectSnapshot | null>
  editorStateRef: MutableRefObject<EditorState>
  keymapRef: MutableRefObject<KeymapResource | null>
  installEditorState: (nextState: EditorState) => void
  setWorkspaceView: Dispatch<SetStateAction<WorkspaceView>>
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
  keymapRef,
  installEditorState,
  setWorkspaceView,
  setIsModulatorMode,
  selectActiveModulatorTab,
  setOpenWaveMenu,
  toggleActiveModulatorTarget,
  setStatusMessage,
  setStatusLevel,
}: UseKeyboardControllerArgs) {
  const pendingNumberRef = useRef('')
  const lastShortcutCommandRef = useRef<{ command: 'copy' | 'cut' | 'paste'; at: number } | null>(
    null
  )

  const toggleWorkspaceView = useCallback((): void => {
    setWorkspaceView((current) => current === 'sequencer' ? 'library' : 'sequencer')
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

      const matchedBinding = findKeymapBinding(
        keymapRef.current,
        'sequence',
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
              const project = projectRef.current
              if (!project) return
              const selection = moveSelection(
                projectRootCell(project),
                editorStateRef.current.selection,
                matchedBinding.target.arguments.direction,
                matchedBinding.target.arguments.amount
              )
              installEditorState({ ...editorStateRef.current, selection })
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

            if (matchedBinding.target.action === 'modulator.mode.toggle') {
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
    executeBackendCommand,
    installEditorState,
    isCommandMode,
    isProjectReady,
    keymapRef,
    openCommandMode,
    projectRef,
    selectActiveModulatorTab,
    setIsModulatorMode,
    setOpenWaveMenu,
    setStatusLevel,
    setStatusMessage,
    settingsOpen,
    toggleActiveModulatorTarget,
    toggleWorkspaceView,
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
    executeBackendCommand,
    isCommandMode,
    isProjectReady,
    setStatusLevel,
    setStatusMessage,
  ])
}
