import { useCallback, useRef } from 'react'
import { getXenBridgeRequest } from '../../bridge/juceBridge'
import {
  BRIDGE_PROTOCOL,
  parseCommandResponse,
  parseEnvelope,
  parseKeymapResource,
  parseLibrarySnapshot,
  parseProjectSnapshot,
} from '../domain/contracts'
import { buildCommandContext, createSerialExecutor } from '../domain/commands'
import {
  ingestLibrarySnapshot,
  ingestKeymapResource,
  ingestProjectSnapshot,
} from '../domain/resources'
import { projectRootCell, resolveSelection } from '../domain/selection'
import {
  createRequestId,
  getPayloadError,
} from '../shared'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  Envelope,
  EnvelopePayload,
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

  const sendBridgeRequest = useCallback(
    async (name: string, payload: EnvelopePayload): Promise<Envelope> => {
      const requestId = createRequestId()
      const request = {
        protocol: BRIDGE_PROTOCOL,
        type: 'request' as const,
        name,
        request_id: requestId,
        payload,
      }

      const requestFn = await getXenBridgeRequest()
      const envelope = parseEnvelope(await requestFn(JSON.stringify(request)))
      if (envelope.type !== 'response' || envelope.name !== name) {
        throw new Error(`Unexpected response envelope for '${name}'`)
      }
      if (envelope.request_id !== requestId) {
        throw new Error(`Mismatched response request_id for '${name}'`)
      }
      return envelope
    },
    []
  )

  const installEditorState = useCallback((nextState: EditorState): void => {
    editorStateRef.current = nextState
    setEditorState(nextState)
  }, [editorStateRef, setEditorState])

  const ingestProject = useCallback((rawSnapshot: unknown): ProjectSnapshot => {
    const snapshot = parseProjectSnapshot(rawSnapshot)
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

  const ingestLibrary = useCallback((rawSnapshot: unknown): LibrarySnapshot | null => {
    const snapshot = parseLibrarySnapshot(rawSnapshot)
    const result = ingestLibrarySnapshot(libraryRef.current, snapshot)
    if (!result.installed) {
      return null
    }
    libraryRef.current = result.snapshot
    libraryRevisionRef.current = result.snapshot.library_revision
    setLibrarySnapshot(result.snapshot)
    return result.snapshot
  }, [libraryRevisionRef, setLibrarySnapshot])

  const ingestKeymap = useCallback((rawResource: unknown): KeymapResource => {
    const resource = parseKeymapResource(rawResource)
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

        const response = await sendBridgeRequest('command.execute', {
          command,
          context,
        })
        const payloadError = getPayloadError(response.payload)
        if (payloadError) {
          throw new Error(payloadError)
        }

        const commandResponse = parseCommandResponse(response.payload)
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
      sendBridgeRequest,
      setStatusLevel,
      setStatusMessage,
    ]
  )

  return {
    sendBridgeRequest,
    ingestProject,
    ingestLibrary,
    ingestKeymap,
    executeBackendCommand,
  }
}
