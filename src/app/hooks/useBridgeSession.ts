import { useCallback, useRef } from 'react'
import { createProjectPreview } from '../bridge/ProjectPreview'
import { buildCommandContext, createSerialExecutor } from '../domain/commands'
import { commandContextToDto, commandResponseFromDto, libraryFromDto, projectFromDto } from '../domain/mappers'
import {
  ingestLibrarySnapshot,
  ingestProjectSnapshot,
} from '../domain/resources'
import { projectRootCell, resolveSelection } from '../domain/selection'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { BridgeMethodMap, RequestOptions } from '../bridge/BridgeClient'
import type { ProjectPreviewHandle } from '../bridge/ProjectPreview'
import type {
  LibrarySnapshotDto,
  ProjectSnapshotDto,
} from '../domain/contracts'
import type {
  ActiveSequenceTarget,
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
  activeSequenceTargetRef: MutableRefObject<ActiveSequenceTarget | null>
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
  activeSequenceTargetRef,
  libraryRevisionRef,
  setProject,
  setEditorState,
  setStatusMessage,
  setStatusLevel,
  setLibrarySnapshot,
}: UseBridgeSessionArgs) {
  const serialExecutorRef = useRef(createSerialExecutor())
  const activePreviewRef = useRef<ProjectPreviewHandle | null>(null)
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
      activeSequenceTargetRef.current
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
  }, [activeSequenceTargetRef, editorStateRef, installEditorState, projectRef, setProject])

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

  const runBackendCommand = useCallback(
    async (command: string, previewId?: string): Promise<void> => {
      const project = projectRef.current
      if (!project) {
        throw new Error('Project state is not loaded')
      }
      const context = buildCommandContext(
        project,
        editorStateRef.current.selection,
        activeSequenceTargetRef.current
      )
      const selection = context.selection
      if (selection !== editorStateRef.current.selection) {
        installEditorState({ ...editorStateRef.current, selection })
      }

      const commandResponse = commandResponseFromDto(await request('command.execute', {
        command,
        context: {
          ...commandContextToDto(context),
          ...(previewId ? { preview_id: previewId } : {}),
        },
      }))
      const installedProject = ingestProject(commandResponse.snapshot)
      if (
        commandResponse.suggestedSelection &&
        resolveSelection(
          projectRootCell(installedProject, activeSequenceTargetRef.current),
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

      if (commandResponse.status.level === 'error') {
        throw new Error(commandResponse.status.message)
      }
    },
    [
      editorStateRef,
      activeSequenceTargetRef,
      ingestProject,
      installEditorState,
      projectRef,
      request,
      setStatusLevel,
      setStatusMessage,
    ]
  )

  const executeBackendCommand = useCallback(
    (command: string): Promise<void> => {
      const run = async (): Promise<void> => {
        if (activePreviewRef.current || projectRef.current?.previewActive) {
          throw new Error('A project preview is active; finish it before editing.')
        }
        await runBackendCommand(command)
      }

      return serialExecutorRef.current(run)
    },
    [projectRef, runBackendCommand]
  )

  const beginBackendPreview = useCallback((): ProjectPreviewHandle => {
    if (activePreviewRef.current) {
      throw new Error('A project preview is already active in this frontend.')
    }

    const runPreviewControl = async (
      action: 'preview.commit' | 'preview.cancel',
      previewId: string
    ): Promise<void> => {
      const project = projectRef.current
      if (!project) throw new Error('Project state is not loaded')
      const response = await request(action, {
        preview_id: previewId,
        expected_project_revision: project.revision,
      })
      ingestProject(response.snapshot)
      setStatusMessage(response.status.message)
      setStatusLevel(response.status.level)
      if (response.status.level === 'error') throw new Error(response.status.message)
    }

    const handle = createProjectPreview({
      begin: () => serialExecutorRef.current(async () => {
        const project = projectRef.current
        if (!project) throw new Error('Project state is not loaded')
        if (project.previewActive) throw new Error('Another project preview is active.')
        const response = await request('preview.begin', {
          expected_project_revision: project.revision,
        })
        ingestProject(response.snapshot)
        setStatusMessage(response.status.message)
        setStatusLevel(response.status.level)
        if (response.status.level === 'error' || !response.preview_id) {
          throw new Error(response.status.message || 'Unable to begin project preview')
        }
        return response.preview_id
      }),
      update: (previewId, command) =>
        serialExecutorRef.current(() => runBackendCommand(command, previewId)),
      commit: (previewId) =>
        serialExecutorRef.current(() => runPreviewControl('preview.commit', previewId)),
      cancel: (previewId) =>
        serialExecutorRef.current(() => runPreviewControl('preview.cancel', previewId)),
      onFinish: () => {
        activePreviewRef.current = null
      },
    })
    activePreviewRef.current = handle
    return handle
  }, [ingestProject, projectRef, request, runBackendCommand, setStatusLevel, setStatusMessage])

  return {
    ingestProject,
    ingestLibrary,
    executeBackendCommand,
    beginBackendPreview,
  }
}
