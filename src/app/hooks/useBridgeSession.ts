import { useCallback, useRef } from 'react'
import { bridgeClient } from '../bridge/BridgeClient'
import { buildCommandContext, createSerialExecutor } from '../domain/commands'
import {
  ingestLibrarySnapshot,
  ingestKeymapResource,
  ingestProjectSnapshot,
} from '../domain/resources'
import { projectRootCell, resolveSelection } from '../domain/selection'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { RequestOptions } from '../bridge/BridgeClient'
import type {
  KeymapResource,
  LibrarySnapshot,
  ProjectSnapshot,
} from '../domain/contracts'
import type {
  EditorState,
  MessageLevel,
} from '../shared'

type UseBridgeSessionArgs = {
  projectRef: MutableRefObject<ProjectSnapshot | null>
  editorStateRef: MutableRefObject<EditorState>
  libraryRevisionRef: MutableRefObject<number>
  keymapRef: MutableRefObject<KeymapResource | null>
  setProject: Dispatch<SetStateAction<ProjectSnapshot | null>>
  setEditorState: Dispatch<SetStateAction<EditorState>>
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
  setKeymapResource: Dispatch<SetStateAction<KeymapResource | null>>
  setLibrarySnapshot: Dispatch<SetStateAction<LibrarySnapshot>>
}

export function useBridgeSession({
  projectRef,
  editorStateRef,
  libraryRevisionRef,
  keymapRef,
  setProject,
  setEditorState,
  setStatusMessage,
  setStatusLevel,
  setKeymapResource,
  setLibrarySnapshot,
}: UseBridgeSessionArgs) {
  const serialExecutorRef = useRef(createSerialExecutor())
  const libraryRef = useRef<LibrarySnapshot | null>(null)

  const installEditorState = useCallback((nextState: EditorState): void => {
    editorStateRef.current = nextState
    setEditorState(nextState)
  }, [editorStateRef, setEditorState])

  const request: typeof bridgeClient.request = useCallback(
    (name, payload, options?: RequestOptions) => bridgeClient.request(name, payload, options),
    []
  )

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

  const ingestKeymap = useCallback((resource: KeymapResource): KeymapResource => {
    const result = ingestKeymapResource(keymapRef.current, resource)
    if (result.installed) {
      keymapRef.current = result.resource
      setKeymapResource(result.resource)
    }
    return result.resource
  }, [keymapRef, setKeymapResource])

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
    request,
    ingestProject,
    ingestLibrary,
    ingestKeymap,
    executeBackendCommand,
  }
}
