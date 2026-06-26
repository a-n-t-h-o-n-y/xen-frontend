import { useCallback, useRef } from 'react'
import { buildCommandContext, createSerialExecutor } from '../domain/commands'
import { commandContextToDto, commandResponseFromDto, libraryFromDto, projectFromDto } from '../domain/mappers'
import {
  ingestLibrarySnapshot,
  ingestProjectSnapshot,
} from '../domain/resources'
import { projectRootCell, resolveSelection } from '../domain/selection'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { BridgeMethodMap, RequestOptions } from '../bridge/BridgeClient'
import type {
  LibrarySnapshotDto,
  ProjectSnapshotDto,
} from '../domain/contracts'
import type {
  ActiveMeasureTarget,
  EditorState,
  LibrarySnapshot,
  MessageLevel,
  ProjectSnapshot,
} from '../domain/models'

type UseBridgeSessionArgs = {
  request: <K extends keyof BridgeMethodMap>(
    name: K,
    payload: BridgeMethodMap[K]['request'],
    options?: RequestOptions
  ) => Promise<BridgeMethodMap[K]['response']>
  projectRef: MutableRefObject<ProjectSnapshot | null>
  editorStateRef: MutableRefObject<EditorState>
  activeMeasureTargetRef: MutableRefObject<ActiveMeasureTarget | null>
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
  activeMeasureTargetRef,
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

  const ingestProject = useCallback((snapshot: ProjectSnapshot | ProjectSnapshotDto): ProjectSnapshot => {
    const domainSnapshot = 'revision' in snapshot ? snapshot : projectFromDto(snapshot)
    const result = ingestProjectSnapshot(
      projectRef.current,
      domainSnapshot,
      editorStateRef.current.selection,
      activeMeasureTargetRef.current
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
  }, [activeMeasureTargetRef, editorStateRef, installEditorState, projectRef, setProject])

  const ingestLibrary = useCallback((snapshot: LibrarySnapshot | LibrarySnapshotDto): LibrarySnapshot | null => {
    const domainSnapshot = 'revision' in snapshot ? snapshot : libraryFromDto(snapshot)
    const result = ingestLibrarySnapshot(libraryRef.current, domainSnapshot)
    if (!result.installed) {
      return null
    }
    libraryRef.current = result.snapshot
    libraryRevisionRef.current = result.snapshot.revision
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
        const context = buildCommandContext(
          project,
          editorStateRef.current.selection,
          activeMeasureTargetRef.current
        )
        const selection = context.selection
        if (selection !== editorStateRef.current.selection) {
          installEditorState({ ...editorStateRef.current, selection })
        }

        const commandResponse = commandResponseFromDto(await request('command.execute', {
          command,
          context: commandContextToDto(context),
        }))
        const installedProject = ingestProject(commandResponse.snapshot)
        if (
          commandResponse.suggestedSelection &&
          resolveSelection(
            projectRootCell(installedProject, activeMeasureTargetRef.current),
            commandResponse.suggestedSelection
          )
        ) {
          installEditorState({
            ...editorStateRef.current,
            selection: commandResponse.suggestedSelection,
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
      activeMeasureTargetRef,
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
