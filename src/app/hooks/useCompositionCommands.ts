import { useCallback, useState } from 'react'
import { getErrorMessage } from '../utils/errors'
import { clampCompositionSelection, getActiveMeasureTarget } from '../domain/composition'
import {
  compositionCellAssign,
  compositionCellClear,
  compositionColumnDelete,
  compositionColumnInsert,
  compositionColumnLength,
  compositionLoopBoundary,
  compositionRowChannel,
  compositionRowDelete,
  compositionRowInsert,
  compositionRowRename,
} from '../domain/commands'
import { formatTimeSignature, parseTimeSignatureInput } from '../presentation/viewModels'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  ActiveMeasureTarget,
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
  installActiveMeasureTarget: (target: ActiveMeasureTarget | null) => void
  installEditorState: (state: EditorState) => void
  installWorkspaceView: (
    view: 'composition' | 'sequencer'
  ) => void
}

export function useCompositionCommands({
  projectRef,
  compositionSelectionRef,
  editorStateRef,
  compositionSelection,
  projectComposition,
  bridgeUnavailableMessage,
  executeBackendCommand,
  setStatusMessage,
  setStatusLevel,
  installActiveMeasureTarget,
  installEditorState,
  installWorkspaceView,
}: UseCompositionCommandsArgs) {
  const [compositionEditTarget, setCompositionEditTarget] = useState<CompositionEditTarget | null>(null)

  const displayedCompositionSelection = projectComposition
    ? clampCompositionSelection(projectComposition, compositionSelection)
    : compositionSelection

  const editSelectedCompositionCell = useCallback((): void => {
    const composition = projectRef.current?.composition
    if (!composition) {
      return
    }

    const target = getActiveMeasureTarget(composition, compositionSelectionRef.current)
    if (!target) {
      setStatusMessage('Empty composition cell. Assign a measure before opening it.')
      setStatusLevel('warning')
      return
    }

    installActiveMeasureTarget(target)
    installEditorState({ ...editorStateRef.current, selection: { path: [] } })
    installWorkspaceView('sequencer')
  }, [
    compositionSelectionRef,
    editorStateRef,
    installActiveMeasureTarget,
    installEditorState,
    installWorkspaceView,
    projectRef,
    setStatusLevel,
    setStatusMessage,
  ])

  const setLoopBoundary = useCallback((boundary: 'start' | 'end'): void => {
    const composition = projectRef.current?.composition
    if (!composition || bridgeUnavailableMessage !== null) {
      return
    }

    const selection = clampCompositionSelection(composition, compositionSelectionRef.current)
    const command = compositionLoopBoundary(boundary, selection.columnIndex)
    void executeBackendCommand(command).catch((error: unknown) => {
      setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
      setStatusLevel('error')
    })
  }, [
    bridgeUnavailableMessage,
    compositionSelectionRef,
    executeBackendCommand,
    projectRef,
    setStatusLevel,
    setStatusMessage,
  ])

  const runCompositionCommand = useCallback((command: string): void => {
    if (bridgeUnavailableMessage !== null) {
      return
    }

    void executeBackendCommand(command).catch((error: unknown) => {
      setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
      setStatusLevel('error')
    })
  }, [bridgeUnavailableMessage, executeBackendCommand, setStatusLevel, setStatusMessage])

  const withCompositionSelection = useCallback((
    handler: (composition: Composition, selection: CompositionSelection) => void
  ): void => {
    const composition = projectRef.current?.composition
    if (!composition) {
      return
    }
    handler(composition, clampCompositionSelection(composition, compositionSelectionRef.current))
  }, [compositionSelectionRef, projectRef])

  const beginCompositionEdit = useCallback((target: CompositionEditTarget): void => {
    setCompositionEditTarget(target)
  }, [])

  const commitCompositionCellName = useCallback((
    rowIndex: number,
    columnIndex: number,
    name: string
  ): void => {
    const trimmed = name.trim()
    setCompositionEditTarget(null)
    if (!trimmed) {
      runCompositionCommand(compositionCellClear(rowIndex, columnIndex))
      return
    }
    runCompositionCommand(compositionCellAssign(rowIndex, columnIndex, trimmed))
  }, [runCompositionCommand])

  const commitCompositionRowName = useCallback((rowIndex: number, name: string): void => {
    const trimmed = name.trim()
    setCompositionEditTarget(null)
    if (!trimmed) {
      setStatusMessage('Row name cannot be empty.')
      setStatusLevel('warning')
      return
    }
    runCompositionCommand(compositionRowRename(rowIndex, trimmed))
  }, [runCompositionCommand, setStatusLevel, setStatusMessage])

  const commitCompositionRowChannel = useCallback((rowIndex: number, channelId: string): void => {
    const trimmed = channelId.trim()
    setCompositionEditTarget(null)
    if (!trimmed) {
      setStatusMessage('Row channel cannot be empty.')
      setStatusLevel('warning')
      return
    }
    runCompositionCommand(compositionRowChannel(rowIndex, trimmed))
  }, [runCompositionCommand, setStatusLevel, setStatusMessage])

  const commitCompositionColumnLength = useCallback((columnIndex: number, length: string): void => {
    const parsed = parseTimeSignatureInput(length)
    setCompositionEditTarget(null)
    if (!parsed) {
      setStatusMessage('Invalid column length. Use N/D, e.g. 4/4')
      setStatusLevel('warning')
      return
    }
    runCompositionCommand(compositionColumnLength(columnIndex, formatTimeSignature(parsed)))
  }, [runCompositionCommand, setStatusLevel, setStatusMessage])

  const insertCompositionRow = useCallback((placement: 'before' | 'after', rowIndex: number): void => {
    runCompositionCommand(compositionRowInsert(placement, rowIndex))
  }, [runCompositionCommand])

  const deleteCompositionRow = useCallback((rowIndex: number): void => {
    const composition = projectRef.current?.composition
    if (!composition || composition.rows.length <= 1) {
      return
    }
    runCompositionCommand(compositionRowDelete(rowIndex))
  }, [projectRef, runCompositionCommand])

  const insertCompositionColumn = useCallback((
    placement: 'before' | 'after',
    columnIndex: number
  ): void => {
    runCompositionCommand(compositionColumnInsert(placement, columnIndex))
  }, [runCompositionCommand])

  const deleteCompositionColumn = useCallback((columnIndex: number): void => {
    const composition = projectRef.current?.composition
    if (!composition || composition.columns.length <= 1) {
      return
    }
    runCompositionCommand(compositionColumnDelete(columnIndex))
  }, [projectRef, runCompositionCommand])

  const clearCompositionCell = useCallback((rowIndex: number, columnIndex: number): void => {
    runCompositionCommand(compositionCellClear(rowIndex, columnIndex))
  }, [runCompositionCommand])

  const runSelectedCompositionAction = useCallback((action: string): boolean => {
    let handled = true
    withCompositionSelection((composition, selection) => {
      if (action === 'composition.cell.rename_or_create_measure') {
        setCompositionEditTarget({ kind: 'cell', ...selection })
      } else if (action === 'composition.cell.clear') {
        clearCompositionCell(selection.rowIndex, selection.columnIndex)
      } else if (action === 'composition.row.insert_before') {
        insertCompositionRow('before', selection.rowIndex)
      } else if (action === 'composition.row.insert_after') {
        insertCompositionRow('after', selection.rowIndex)
      } else if (action === 'composition.row.delete') {
        if (composition.rows.length > 1) deleteCompositionRow(selection.rowIndex)
      } else if (action === 'composition.row.rename') {
        setCompositionEditTarget({ kind: 'rowName', rowIndex: selection.rowIndex })
      } else if (action === 'composition.row.channel') {
        setCompositionEditTarget({ kind: 'rowChannel', rowIndex: selection.rowIndex })
      } else if (action === 'composition.column.insert_before') {
        insertCompositionColumn('before', selection.columnIndex)
      } else if (action === 'composition.column.insert_after') {
        insertCompositionColumn('after', selection.columnIndex)
      } else if (action === 'composition.column.delete') {
        if (composition.columns.length > 1) deleteCompositionColumn(selection.columnIndex)
      } else if (action === 'composition.column.length') {
        setCompositionEditTarget({ kind: 'columnLength', columnIndex: selection.columnIndex })
      } else {
        handled = false
      }
    })
    return handled
  }, [
    clearCompositionCell,
    deleteCompositionColumn,
    deleteCompositionRow,
    insertCompositionColumn,
    insertCompositionRow,
    withCompositionSelection,
  ])

  return {
    compositionEditTarget,
    setCompositionEditTarget,
    displayedCompositionSelection,
    editSelectedCompositionCell,
    setLoopBoundary,
    runSelectedCompositionAction,
    beginCompositionEdit,
    commitCompositionCellName,
    commitCompositionRowName,
    commitCompositionRowChannel,
    commitCompositionColumnLength,
    insertCompositionRow,
    deleteCompositionRow,
    insertCompositionColumn,
    deleteCompositionColumn,
    clearCompositionCell,
  }
}
