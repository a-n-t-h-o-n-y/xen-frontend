import { useCallback, useRef, useState } from 'react'
import { createProjectPreview } from '../bridge/ProjectPreview'
import { createModulationPreview } from '../bridge/ModulationPreview'
import { BridgePayloadError } from '../bridge/BridgeClient'
import { buildCommandContext, createSerialExecutor } from '../domain/commands'
import { getActiveSequenceTarget } from '../domain/composition'
import { commandContextToDto, commandResponseFromDto, libraryFromDto, projectFromDto } from '../domain/mappers'
import {
  ingestLibrarySnapshot,
  ingestProjectSnapshot,
} from '../domain/resources'
import { projectRootCell, resolveSelection } from '../domain/selection'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { BridgeMethodMap, RequestOptions } from '../bridge/BridgeClient'
import type { ProjectPreviewHandle } from '../bridge/ProjectPreview'
import type { ModulationPreviewHandle } from '../bridge/ModulationPreview'
import type {
  DocumentFileDto,
  LibrarySnapshotDto,
  ProjectSnapshotDto,
  ModulationTargetDto,
} from '../domain/contracts'
import type {
  ActiveSequenceTarget,
  CompositionSelection,
  ContentFile,
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
  compositionSelectionRef: MutableRefObject<CompositionSelection>
  workspaceViewRef: MutableRefObject<'composition' | 'sequencer'>
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
  compositionSelectionRef,
  workspaceViewRef,
  setProject,
  setEditorState,
  setStatusMessage,
  setStatusLevel,
  setLibrarySnapshot,
}: UseBridgeSessionArgs) {
  const serialExecutorRef = useRef(createSerialExecutor())
  const activePreviewRef = useRef<{ cancel: () => Promise<void> } | null>(null)
  const libraryRef = useRef<LibrarySnapshot | null>(null)
  const [documentBusy, setDocumentBusy] = useState(false)

  const installEditorState = useCallback((nextState: EditorState): void => {
    editorStateRef.current = nextState
    setEditorState(nextState)
  }, [editorStateRef, setEditorState])

  const ingestProject = useCallback((snapshot: ProjectSnapshot | ProjectSnapshotDto): ProjectSnapshot => {
    const domainSnapshot = 'stateRevision' in snapshot ? snapshot : projectFromDto(snapshot)
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
    setLibrarySnapshot(result.snapshot)
    return result.snapshot
  }, [setLibrarySnapshot])

  const runBackendCommand = useCallback(
    async (command: string, previewId?: string): Promise<void> => {
      const project = projectRef.current
      if (!project) {
        throw new Error('Project state is not loaded')
      }
      const context = buildCommandContext(
        project,
        editorStateRef.current.selection,
        activeSequenceTargetRef.current,
        workspaceViewRef.current === 'composition' ? compositionSelectionRef.current : null
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

      if (commandResponse.status.level === 'warning') {
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
      compositionSelectionRef,
      ingestProject,
      installEditorState,
      projectRef,
      request,
      setStatusLevel,
      setStatusMessage,
      workspaceViewRef,
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
        expected_project_revision: project.projectRevision,
      })
      ingestProject(response.snapshot)
      if (response.status.level === 'warning') {
        setStatusMessage(response.status.message)
        setStatusLevel(response.status.level)
      }
      if (response.status.level === 'error') throw new Error(response.status.message)
    }

    const handle = createProjectPreview({
      begin: () => serialExecutorRef.current(async () => {
        const project = projectRef.current
        if (!project) throw new Error('Project state is not loaded')
        if (project.previewActive) throw new Error('Another project preview is active.')
        const response = await request('preview.begin', {
          expected_project_revision: project.projectRevision,
        })
        ingestProject(response.snapshot)
        if (response.status.level === 'warning') {
          setStatusMessage(response.status.message)
          setStatusLevel(response.status.level)
        }
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

  const beginModulationPreview = useCallback((
    target: ModulationTargetDto
  ): ModulationPreviewHandle => {
    if (activePreviewRef.current) {
      throw new Error('A project preview is already active in this frontend.')
    }

    const handle = createModulationPreview({
      begin: () => serialExecutorRef.current(async () => {
        const project = projectRef.current
        if (!project) throw new Error('Project state is not loaded')
        if (project.previewActive) throw new Error('Another project preview is active.')
        const response = await request('modulation.preview.begin', {
          expected_project_revision: project.projectRevision,
          target,
        })
        const snapshot = ingestProject(response.snapshot)
        if (response.status.level === 'warning') {
          setStatusMessage(response.status.message)
          setStatusLevel(response.status.level)
        }
        if (response.status.level === 'error' || !response.preview_id) {
          throw new Error(response.status.message || 'Unable to begin modulation preview')
        }
        return {
          previewId: response.preview_id,
          projectRevision: snapshot.projectRevision,
        }
      }),
      update: (previewId, sequence, expectedProjectRevision, definition) =>
        serialExecutorRef.current(async () => {
          const response = await request('modulation.preview.update', {
            preview_id: previewId,
            update_sequence: sequence,
            expected_project_revision: expectedProjectRevision,
            destination: definition.destination,
            output_range: definition.outputRange,
            modulation: definition.modulation,
          })
          if (response.status.level === 'warning' || response.status.level === 'error') {
            setStatusMessage(response.status.message)
            setStatusLevel(response.status.level)
          }
          return response
        }),
      recover: async (error) => {
        const snapshot = ingestProject(await request('state.get', {}))
        const code = error instanceof BridgePayloadError ? error.code : ''
        const stillOwnsPreview = !(
          code.includes('owner') || code.includes('ownership') || code === 'not_found'
        )
        return {
          projectRevision: snapshot.projectRevision,
          stillOwnsPreview,
        }
      },
      end: (action, previewId, expectedProjectRevision) =>
        serialExecutorRef.current(async () => {
          const response = await request(action, {
            preview_id: previewId,
            expected_project_revision: expectedProjectRevision,
          })
          ingestProject(response.snapshot)
          if (response.status.level === 'warning') {
            setStatusMessage(response.status.message)
            setStatusLevel(response.status.level)
          }
          if (response.status.level === 'error') throw new Error(response.status.message)
        }),
      onFinish: () => {
        activePreviewRef.current = null
      },
    })
    activePreviewRef.current = handle
    return handle
  }, [ingestProject, projectRef, request, setStatusLevel, setStatusMessage])

  const installSuggestedSelection = useCallback((
    snapshot: ProjectSnapshot,
    suggestedSelection: import('../domain/models').Selection | null,
    target: ActiveSequenceTarget | null = activeSequenceTargetRef.current
  ): void => {
    if (
      suggestedSelection &&
      resolveSelection(
        projectRootCell(snapshot, target),
        suggestedSelection
      )
    ) {
      installEditorState({ ...editorStateRef.current, selection: suggestedSelection })
    }
  }, [activeSequenceTargetRef, editorStateRef, installEditorState])

  const runDocumentOperation = useCallback(<T,>(operation: () => Promise<T>): Promise<T> =>
    serialExecutorRef.current(async () => {
      setDocumentBusy(true)
      try {
        return await operation()
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : String(error))
        setStatusLevel('error')
        throw error
      } finally {
        setDocumentBusy(false)
      }
    }), [setStatusLevel, setStatusMessage])

  const requireProject = useCallback((): ProjectSnapshot => {
    const project = projectRef.current
    if (!project) throw new Error('Project state is not loaded')
    if (project.previewActive) {
      throw new Error('Finish the active preview before using project or cell files.')
    }
    return project
  }, [projectRef])

  const confirmUnsavedChanges = useCallback((action: string): boolean =>
    window.confirm(`Discard unsaved project changes and ${action}?`), [])

  const confirmOverwrite = useCallback((relativePath: string): boolean =>
    window.confirm(`“${relativePath}” already exists. Overwrite that exact version?`), [])

  const currentFileRevisionFromError = useCallback((
    error: BridgePayloadError
  ): string | null => {
    const revision = error.details?.current_file_revision
    if (revision === null) return null
    if (typeof revision !== 'string' || revision.length === 0) {
      throw new Error(`${error.message} The backend did not provide a safe file revision for retry.`)
    }
    return revision
  }, [])

  const requireExistingFileRevision = useCallback((error: BridgePayloadError): string => {
    const revision = currentFileRevisionFromError(error)
    if (revision === null) {
      throw new Error(`${error.message} The backend reported no existing file to overwrite.`)
    }
    return revision
  }, [currentFileRevisionFromError])

  const requireDocumentFile = useCallback((
    file: DocumentFileDto | null,
    operation: string
  ): DocumentFileDto => {
    if (!file) throw new Error(`The backend did not identify the file ${operation}.`)
    return file
  }, [])

  const promptForPath = useCallback((
    label: string,
    extension: '.xenproj' | '.xencell',
    suggestedPath: string
  ): string | null => {
    const value = window.prompt(`${label}\nEnter a content-relative path ending in ${extension}.`, suggestedPath)
    if (value === null) return null
    const relativePath = value.trim()
    return relativePath || null
  }, [])

  const newProject = useCallback((): Promise<void> => runDocumentOperation(async () => {
    const project = requireProject()
    const expectedProjectRevision = project.projectRevision
    let response
    try {
      response = await request('project.new', {
        expected_project_revision: expectedProjectRevision,
        discard_unsaved: false,
      })
    } catch (error) {
      if (!(error instanceof BridgePayloadError) || error.code !== 'unsaved_changes') throw error
      if (!confirmUnsavedChanges('create a new project')) return
      response = await request('project.new', {
        expected_project_revision: expectedProjectRevision,
        discard_unsaved: true,
      })
    }
    ingestProject(response.snapshot)
    setStatusMessage('Created a new project.')
    setStatusLevel('info')
  }), [confirmUnsavedChanges, ingestProject, request, requireProject, runDocumentOperation, setStatusLevel, setStatusMessage])

  const openProject = useCallback((file: Pick<ContentFile, 'relativePath'>): Promise<void> =>
    runDocumentOperation(async () => {
      const project = requireProject()
      const expectedProjectRevision = project.projectRevision
      let response
      try {
        response = await request('project.open', {
          relative_path: file.relativePath,
          expected_project_revision: expectedProjectRevision,
          discard_unsaved: false,
        })
      } catch (error) {
        if (!(error instanceof BridgePayloadError) || error.code !== 'unsaved_changes') throw error
        if (!confirmUnsavedChanges(`open “${file.relativePath}”`)) return
        response = await request('project.open', {
          relative_path: file.relativePath,
          expected_project_revision: expectedProjectRevision,
          discard_unsaved: true,
        })
      }
      ingestProject(response.snapshot)
      const openedFile = requireDocumentFile(response.file, 'opened')
      setStatusMessage(`Opened ${openedFile.relative_path}.`)
      setStatusLevel('info')
    }), [confirmUnsavedChanges, ingestProject, request, requireDocumentFile, requireProject, runDocumentOperation, setStatusLevel, setStatusMessage])

  const saveProjectAsPath = useCallback(async (
    relativePath: string,
    expectedProjectRevision: string
  ): Promise<void> => {
    let response
    try {
      response = await request('project.save_as', {
        relative_path: relativePath,
        expected_project_revision: expectedProjectRevision,
        expected_file_revision: null,
      })
    } catch (error) {
      if (!(error instanceof BridgePayloadError) || error.code !== 'file_exists') throw error
      const fileRevision = requireExistingFileRevision(error)
      if (!confirmOverwrite(relativePath)) return
      response = await request('project.save_as', {
        relative_path: relativePath,
        expected_project_revision: expectedProjectRevision,
        expected_file_revision: fileRevision,
      })
    }
    ingestProject(response.snapshot)
    const savedFile = requireDocumentFile(response.file, 'saved')
    setStatusMessage(`Saved ${savedFile.relative_path}.`)
    setStatusLevel('info')
  }, [confirmOverwrite, ingestProject, request, requireDocumentFile, requireExistingFileRevision, setStatusLevel, setStatusMessage])

  const saveProjectAs = useCallback((): Promise<void> => runDocumentOperation(async () => {
    const project = requireProject()
    const suggestedPath = project.document.relativePath ?? 'Untitled.xenproj'
    const relativePath = promptForPath('Save project as', '.xenproj', suggestedPath)
    if (!relativePath) return
    await saveProjectAsPath(relativePath, project.projectRevision)
  }), [promptForPath, requireProject, runDocumentOperation, saveProjectAsPath])

  const saveProject = useCallback((): Promise<void> => runDocumentOperation(async () => {
    const project = requireProject()
    const expectedProjectRevision = project.projectRevision
    try {
      const response = await request('project.save', {
        expected_project_revision: expectedProjectRevision,
      })
      ingestProject(response.snapshot)
      const savedFile = requireDocumentFile(response.file, 'saved')
      setStatusMessage(`Saved ${savedFile.relative_path}.`)
      setStatusLevel('info')
    } catch (error) {
      if (!(error instanceof BridgePayloadError)) throw error
      if (error.code === 'project_path_required') {
        const relativePath = promptForPath('Save project as', '.xenproj', 'Untitled.xenproj')
        if (!relativePath) return
        await saveProjectAsPath(relativePath, expectedProjectRevision)
        return
      }
      if (error.code !== 'file_conflict') throw error
      const relativePath = project.document.relativePath
      if (!relativePath) throw error
      const currentFileRevision = currentFileRevisionFromError(error)
      const changeDescription = currentFileRevision === null
        ? 'was deleted outside Xen. Recreate it with the current project?'
        : 'changed outside Xen. Overwrite that exact version with the current project?'
      if (!window.confirm(`“${relativePath}” ${changeDescription}`)) return
      const response = await request('project.save_as', {
        relative_path: relativePath,
        expected_project_revision: expectedProjectRevision,
        expected_file_revision: currentFileRevision,
      })
      ingestProject(response.snapshot)
      const savedFile = requireDocumentFile(response.file, 'saved')
      setStatusMessage(`Saved ${savedFile.relative_path}.`)
      setStatusLevel('info')
    }
  }), [currentFileRevisionFromError, ingestProject, promptForPath, request, requireDocumentFile, requireProject, runDocumentOperation, saveProjectAsPath, setStatusLevel, setStatusMessage])

  const importCell = useCallback((file: Pick<ContentFile, 'relativePath'>): Promise<void> =>
    runDocumentOperation(async () => {
      const project = requireProject()
      const context = buildCommandContext(
        project,
        editorStateRef.current.selection,
        activeSequenceTargetRef.current,
        workspaceViewRef.current === 'composition' ? compositionSelectionRef.current : null
      )
      const response = await request('cell.import', {
        relative_path: file.relativePath,
        expected_project_revision: context.expectedProjectRevision,
        cursor: commandContextToDto(context).cursor,
      })
      const installed = ingestProject(response.snapshot)
      const importedTarget = getActiveSequenceTarget(installed.composition, {
        rowCoordinate: context.cursor.rowCoordinate,
        columnCoordinate: context.cursor.columnCoordinate,
      })
      installSuggestedSelection(installed, response.suggested_selection, importedTarget)
      const importedFile = requireDocumentFile(response.file, 'imported')
      setStatusMessage(`Imported ${importedFile.relative_path}.`)
      setStatusLevel('info')
    }), [activeSequenceTargetRef, compositionSelectionRef, editorStateRef, ingestProject, installSuggestedSelection, request, requireDocumentFile, requireProject, runDocumentOperation, setStatusLevel, setStatusMessage, workspaceViewRef])

  const saveCell = useCallback((): Promise<void> => runDocumentOperation(async () => {
    const project = requireProject()
    const context = buildCommandContext(
      project,
      editorStateRef.current.selection,
      activeSequenceTargetRef.current,
      workspaceViewRef.current === 'composition' ? compositionSelectionRef.current : null
    )
    const relativePath = promptForPath('Save selected cell as', '.xencell', 'cell.xencell')
    if (!relativePath) return
    const requestPayload = {
      relative_path: relativePath,
      expected_project_revision: context.expectedProjectRevision,
      cursor: commandContextToDto(context).cursor,
      selection: commandContextToDto(context).selection,
    }
    let response
    try {
      response = await request('cell.save', {
        ...requestPayload,
        expected_file_revision: null,
      })
    } catch (error) {
      if (!(error instanceof BridgePayloadError) || error.code !== 'file_exists') throw error
      const fileRevision = requireExistingFileRevision(error)
      if (!confirmOverwrite(relativePath)) return
      response = await request('cell.save', {
        ...requestPayload,
        expected_file_revision: fileRevision,
      })
    }
    const installed = ingestProject(response.snapshot)
    installSuggestedSelection(installed, response.suggested_selection)
    const savedFile = requireDocumentFile(response.file, 'saved')
    setStatusMessage(`Saved cell ${savedFile.relative_path}.`)
    setStatusLevel('info')
  }), [activeSequenceTargetRef, compositionSelectionRef, confirmOverwrite, editorStateRef, ingestProject, installSuggestedSelection, promptForPath, request, requireDocumentFile, requireExistingFileRevision, requireProject, runDocumentOperation, setStatusLevel, setStatusMessage, workspaceViewRef])

  const restoreRecovery = useCallback((): Promise<void> => runDocumentOperation(async () => {
    const project = requireProject()
    const recovery = project.recovery
    if (!recovery) return
    const expectedProjectRevision = project.projectRevision
    let response
    try {
      response = await request('project.recovery.restore', {
        recovery_revision: recovery.revision,
        expected_project_revision: expectedProjectRevision,
        discard_unsaved: false,
      })
    } catch (error) {
      if (!(error instanceof BridgePayloadError) || error.code !== 'unsaved_changes') throw error
      if (!confirmUnsavedChanges('restore the recovery copy')) return
      response = await request('project.recovery.restore', {
        recovery_revision: recovery.revision,
        expected_project_revision: expectedProjectRevision,
        discard_unsaved: true,
      })
    }
    ingestProject(response.snapshot)
    setStatusMessage('Restored the recovery copy.')
    setStatusLevel('info')
  }), [confirmUnsavedChanges, ingestProject, request, requireProject, runDocumentOperation, setStatusLevel, setStatusMessage])

  const discardRecovery = useCallback((): Promise<void> => runDocumentOperation(async () => {
    const project = requireProject()
    const recovery = project.recovery
    if (!recovery) return
    if (!window.confirm('Permanently discard the available recovery copy?')) return
    const response = await request('project.recovery.discard', {
      recovery_revision: recovery.revision,
    })
    ingestProject(response.snapshot)
    setStatusMessage('Discarded the recovery copy.')
    setStatusLevel('info')
  }), [ingestProject, request, requireProject, runDocumentOperation, setStatusLevel, setStatusMessage])

  return {
    ingestProject,
    ingestLibrary,
    executeBackendCommand,
    beginBackendPreview,
    beginModulationPreview,
    documentBusy,
    newProject,
    openProject,
    saveProject,
    saveProjectAs,
    importCell,
    saveCell,
    restoreRecovery,
    discardRecovery,
  }
}
