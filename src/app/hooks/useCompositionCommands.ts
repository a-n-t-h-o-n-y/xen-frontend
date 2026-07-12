import { useCallback, useState } from 'react'
import { getErrorMessage } from '../utils/errors'
import { getActiveSequenceTarget } from '../domain/composition'
import {
  compositionCellAssign,
  compositionCellClear,
  compositionCellMove,
  compositionLoopBoundary,
  compositionRowChannel,
  compositionRowRename,
} from '../domain/commands'
import { formatTimeSignature, parseTimeSignatureInput } from '../presentation/viewModels'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  ActiveSequenceTarget,
  Composition,
  CompositionSelection,
  EditorState,
  MessageLevel,
  ProjectSnapshot,
} from '../domain/models'
import type { CompositionEditTarget } from '../sections/CompositionSection'

type UseCompositionCommandsArgs = {
  projectRef: MutableRefObject<ProjectSnapshot | null>
  compositionSelectionRef: MutableRefObject<CompositionSelection>
  editorStateRef: MutableRefObject<EditorState>
  compositionSelection: CompositionSelection
  projectComposition: Composition | null
  bridgeUnavailableMessage: string | null
  executeBackendCommand: (command: string) => Promise<void>
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
  installActiveSequenceTarget: (target: ActiveSequenceTarget | null) => void
  installEditorState: (state: EditorState) => void
  installWorkspaceView: (view: 'composition' | 'sequencer') => void
}

export function useCompositionCommands({
  projectRef,
  compositionSelectionRef,
  editorStateRef,
  compositionSelection,
  bridgeUnavailableMessage,
  executeBackendCommand,
  setStatusMessage,
  setStatusLevel,
  installActiveSequenceTarget,
  installEditorState,
  installWorkspaceView,
}: UseCompositionCommandsArgs) {
  const [compositionEditTarget, setCompositionEditTarget] = useState<CompositionEditTarget | null>(null)

  const editSelectedCompositionCell = useCallback((): void => {
    const composition = projectRef.current?.composition
    if (!composition) return

    const target = getActiveSequenceTarget(composition, compositionSelectionRef.current)
    if (!target) {
      setStatusMessage('Empty composition cell. Assign a sequence before opening it.')
      setStatusLevel('warning')
      return
    }

    installActiveSequenceTarget(target)
    installEditorState({ ...editorStateRef.current, selection: { path: [] } })
    installWorkspaceView('sequencer')
  }, [
    compositionSelectionRef,
    editorStateRef,
    installActiveSequenceTarget,
    installEditorState,
    installWorkspaceView,
    projectRef,
    setStatusLevel,
    setStatusMessage,
  ])

  const runCompositionCommand = useCallback((command: string): void => {
    if (bridgeUnavailableMessage !== null) return
    void executeBackendCommand(command).catch((error: unknown) => {
      setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
      setStatusLevel('error')
    })
  }, [bridgeUnavailableMessage, executeBackendCommand, setStatusLevel, setStatusMessage])

  const setLoopBoundary = useCallback((boundary: 'start' | 'end'): void => {
    runCompositionCommand(compositionLoopBoundary(
      boundary,
      compositionSelectionRef.current.columnCoordinate
    ))
  }, [compositionSelectionRef, runCompositionCommand])

  const beginCompositionEdit = useCallback((target: CompositionEditTarget): void => {
    setCompositionEditTarget(target)
  }, [])

  const commitCompositionCellName = useCallback((
    rowCoordinate: number,
    columnCoordinate: number,
    name: string
  ): void => {
    const trimmed = name.trim()
    setCompositionEditTarget(null)
    runCompositionCommand(trimmed
      ? compositionCellAssign(rowCoordinate, columnCoordinate, trimmed)
      : compositionCellClear(rowCoordinate, columnCoordinate))
  }, [runCompositionCommand])

  const commitCompositionRowName = useCallback((rowCoordinate: number, name: string): void => {
    const trimmed = name.trim()
    setCompositionEditTarget(null)
    if (!trimmed) {
      setStatusMessage('Row name cannot be empty.')
      setStatusLevel('warning')
      return
    }
    runCompositionCommand(compositionRowRename(rowCoordinate, trimmed))
  }, [runCompositionCommand, setStatusLevel, setStatusMessage])

  const commitCompositionRowChannel = useCallback((
    rowCoordinate: number,
    channelId: string
  ): void => {
    const trimmed = channelId.trim()
    setCompositionEditTarget(null)
    if (!trimmed) {
      setStatusMessage('Row channel cannot be empty.')
      setStatusLevel('warning')
      return
    }
    runCompositionCommand(compositionRowChannel(rowCoordinate, trimmed))
  }, [runCompositionCommand, setStatusLevel, setStatusMessage])

  const commitCompositionColumnLength = useCallback((
    _columnCoordinate: number,
    length: string
  ): void => {
    const parsed = parseTimeSignatureInput(length)
    setCompositionEditTarget(null)
    if (!parsed) {
      setStatusMessage('Invalid column length. Use N/D, e.g. 4/4')
      setStatusLevel('warning')
      return
    }
    runCompositionCommand(`set duration ${formatTimeSignature(parsed)}`)
  }, [runCompositionCommand, setStatusLevel, setStatusMessage])

  const clearCompositionCell = useCallback((
    rowCoordinate: number,
    columnCoordinate: number
  ): void => {
    runCompositionCommand(compositionCellClear(rowCoordinate, columnCoordinate))
  }, [runCompositionCommand])

  const moveCompositionCell = useCallback((
    fromRowCoordinate: number,
    fromColumnCoordinate: number,
    toRowCoordinate: number,
    toColumnCoordinate: number
  ): void => {
    runCompositionCommand(compositionCellMove(
      fromRowCoordinate,
      fromColumnCoordinate,
      toRowCoordinate,
      toColumnCoordinate
    ))
  }, [runCompositionCommand])

  const runSelectedCompositionAction = useCallback((action: string): boolean => {
    const selection = compositionSelectionRef.current
    const composition = projectRef.current?.composition
    if (!composition) return false

    if (action === 'composition.cell.rename_or_create_sequence') {
      setCompositionEditTarget({ kind: 'cell', ...selection })
      return true
    }
    if (action === 'composition.cell.unassign') {
      clearCompositionCell(selection.rowCoordinate, selection.columnCoordinate)
      return true
    }
    if (action === 'composition.row.rename' && composition.rows.has(selection.rowCoordinate)) {
      setCompositionEditTarget({ kind: 'rowName', rowCoordinate: selection.rowCoordinate })
      return true
    }
    if (action === 'composition.row.channel' && composition.rows.has(selection.rowCoordinate)) {
      setCompositionEditTarget({ kind: 'rowChannel', rowCoordinate: selection.rowCoordinate })
      return true
    }
    if (
      action === 'composition.column.length' &&
      composition.columns.has(selection.columnCoordinate)
    ) {
      setCompositionEditTarget({
        kind: 'columnLength',
        columnCoordinate: selection.columnCoordinate,
      })
      return true
    }
    return false
  }, [clearCompositionCell, compositionSelectionRef, projectRef])

  return {
    compositionEditTarget,
    setCompositionEditTarget,
    displayedCompositionSelection: compositionSelection,
    editSelectedCompositionCell,
    setLoopBoundary,
    runSelectedCompositionAction,
    beginCompositionEdit,
    commitCompositionCellName,
    commitCompositionRowName,
    commitCompositionRowChannel,
    commitCompositionColumnLength,
    clearCompositionCell,
    moveCompositionCell,
  }
}
