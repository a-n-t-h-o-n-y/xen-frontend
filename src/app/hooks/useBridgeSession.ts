import { useCallback, useRef } from 'react'
import { buildCommandContext, createSerialExecutor } from '../domain/commands'
import {
  ingestLibrarySnapshot,
  ingestProjectSnapshot,
} from '../domain/resources'
import { projectRootCell, resolveSelection } from '../domain/selection'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { BridgeMethodMap, RequestOptions } from '../bridge/BridgeClient'
import type {
  LibrarySnapshot,
  ProjectSnapshot,
} from '../domain/contracts'
import type {
  EditorState,
  MessageLevel,
} from '../shared'

type UseBridgeSessionArgs = {
  request: <K extends keyof BridgeMethodMap>(
    name: K,
    payload: BridgeMethodMap[K]['request'],
    options?: RequestOptions
  ) => Promise<BridgeMethodMap[K]['response']>
  projectRef: MutableRefObject<ProjectSnapshot | null>
  editorStateRef: MutableRefObject<EditorState>
  libraryRevisionRef: MutableRefObject<number>
  setProject: Dispatch<SetStateAction<ProjectSnapshot | null>>
  setEditorState: Dispatch<SetStateAction<EditorState>>
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
  setLibrarySnapshot: Dispatch<SetStateAction<LibrarySnapshot>>
}

export function useBridgeSession({
  request,
  projectRef,
  editorStateRef,
  libraryRevisionRef,
  setProject,
  setEditorState,
  setStatusMessage,
  setStatusLevel,
  setLibrarySnapshot,
}: UseBridgeSessionArgs) {
  const serialExecutorRef = useRef(createSerialExecutor())
  const libraryRef = useRef<LibrarySnapshot | null>(null)

  const installEditorState = useCallback((nextState: EditorState): void => {
    editorStateRef.current = nextState
    setEditorState(nextState)
  }, [editorStateRef, setEditorState])

  const ingestProject = useCallback((snapshot: ProjectSnapshot): ProjectSnapshot => {
    const result = ingestProjectSnapshot(
      projectRef.current,
      snapshot,
      editorStateRef.current.selection
    )
    if (!result.installed) {
      return result.snapshot
    }

    projectRef.current = result.snapshot
    setProject(result.snapshot)
    if (result.selection !== editorStateRef.current.selection) {
      installEditorState({ ...editorStateRef.current, selection: result.selection })
    }
    return result.snapshot
  }, [editorStateRef, installEditorState, projectRef, setProject])

  const ingestLibrary = useCallback((snapshot: LibrarySnapshot): LibrarySnapshot | null => {
    const result = ingestLibrarySnapshot(libraryRef.current, snapshot)
    if (!result.installed) {
      return null
    }
    libraryRef.current = result.snapshot
    libraryRevisionRef.current = result.snapshot.library_revision
    setLibrarySnapshot(result.snapshot)
    return result.snapshot
  }, [libraryRevisionRef, setLibrarySnapshot])

  const executeBackendCommand = useCallback(
    (command: string): Promise<void> => {
      const run = async (): Promise<void> => {
        const project = projectRef.current
        if (!project) {
          throw new Error('Project state is not loaded')
        }
        const context = buildCommandContext(project, editorStateRef.current.selection)
        const selection = context.selection
        if (selection !== editorStateRef.current.selection) {
          installEditorState({ ...editorStateRef.current, selection })
        }

        const commandResponse = await request('command.execute', {
          command,
          context,
        })
        const installedProject = ingestProject(commandResponse.snapshot)
        if (
          commandResponse.suggested_selection &&
          resolveSelection(
            projectRootCell(installedProject),
            commandResponse.suggested_selection
          )
        ) {
          installEditorState({
            ...editorStateRef.current,
            selection: commandResponse.suggested_selection,
          })
        }

        if (commandResponse.status.level !== 'debug') {
          setStatusMessage(commandResponse.status.message)
          setStatusLevel(commandResponse.status.level)
        }
      }

      return serialExecutorRef.current(run)
    },
    [
      editorStateRef,
      ingestProject,
      installEditorState,
      projectRef,
      request,
      setStatusLevel,
      setStatusMessage,
    ]
  )

  return {
    ingestProject,
    ingestLibrary,
    executeBackendCommand,
  }
}
