import { useCallback, useEffect, useRef } from 'react'
import { addXenBridgeListener, getXenBridgeRequest, removeXenBridgeListener } from '../../bridge/juceBridge'
import {
  BRIDGE_PROTOCOL,
  parseBridgeEvent,
  parseCommandResponse,
  parseEnvelope,
  parseKeymapResource,
  parseLibrarySnapshot,
  parseProjectSnapshot,
  parseSessionHello,
} from '../domain/contracts'
import { buildCommandContext, createSerialExecutor } from '../domain/commands'
import { buildSessionReference } from '../domain/reference'
import {
  ingestLibrarySnapshot,
  ingestKeymapResource,
  ingestProjectSnapshot,
} from '../domain/resources'
import { projectRootCell, resolveSelection } from '../domain/selection'
import {
  FRONTEND_APP,
  FRONTEND_VERSION,
  createRequestId,
  getErrorMessage,
  getPayloadError,
  normalizePhase,
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
  SessionReference,
  TransportState,
} from '../shared'

type UseBridgeSessionArgs = {
  eventTokenRef: MutableRefObject<unknown>
  transportRef: MutableRefObject<TransportState>
  projectRef: MutableRefObject<ProjectSnapshot | null>
  editorStateRef: MutableRefObject<EditorState>
  libraryRevisionRef: MutableRefObject<number>
  keymapRef: MutableRefObject<KeymapResource | null>
  setProject: Dispatch<SetStateAction<ProjectSnapshot | null>>
  setEditorState: Dispatch<SetStateAction<EditorState>>
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
  setBridgeUnavailableMessage: Dispatch<SetStateAction<string | null>>
  setSessionReference: Dispatch<SetStateAction<SessionReference>>
  setKeymapResource: Dispatch<SetStateAction<KeymapResource | null>>
  setLibraryLoading: Dispatch<SetStateAction<boolean>>
  setLibrarySnapshot: Dispatch<SetStateAction<LibrarySnapshot>>
  setPlayheadPhase: Dispatch<SetStateAction<number | null>>
}

export function useBridgeSession({
  eventTokenRef,
  transportRef,
  projectRef,
  editorStateRef,
  libraryRevisionRef,
  keymapRef,
  setProject,
  setEditorState,
  setStatusMessage,
  setStatusLevel,
  setBridgeUnavailableMessage,
  setSessionReference,
  setKeymapResource,
  setLibraryLoading,
  setLibrarySnapshot,
  setPlayheadPhase,
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

  useEffect(() => {
    let isMounted = true

    const connect = async (): Promise<void> => {
      try {
        eventTokenRef.current = addXenBridgeListener((rawEvent) => {
          try {
            const event = parseBridgeEvent(rawEvent)
            if (event.name === 'state.changed') {
              ingestProject(event.payload)
              return
            }
            if (event.name === 'library.changed') {
              ingestLibrary(event.payload)
              return
            }
            if (event.name === 'keymap.changed') {
              ingestKeymap(event.payload)
              return
            }
            if (event.name === 'transport.phase.sync') {
              if (event.payload.bpm > 0) {
                transportRef.current.bpm = event.payload.bpm
              }
              const phase = normalizePhase(event.payload.phase)
              transportRef.current.phase = phase
              transportRef.current.active = true
              setPlayheadPhase(phase)
              return
            }
            transportRef.current.active = false
            setPlayheadPhase(null)
          } catch (error) {
            setStatusMessage(`Bridge event contract error: ${getErrorMessage(error)}`)
            setStatusLevel('error')
          }
        })

        const helloResponse = await sendBridgeRequest('session.hello', {
          protocol: BRIDGE_PROTOCOL,
          frontend_app: FRONTEND_APP,
          frontend_version: FRONTEND_VERSION,
        })
        const helloError = getPayloadError(helloResponse.payload)
        if (helloError) {
          throw new Error(helloError)
        }
        const hello = parseSessionHello(helloResponse.payload)
        if (!isMounted) {
          return
        }

        setBridgeUnavailableMessage(null)
        setSessionReference(buildSessionReference(hello.catalog))
        ingestKeymap(hello.keymap)
        setLibraryLoading(true)

        const [stateResponse, libraryResponse] = await Promise.all([
          sendBridgeRequest('state.get', {}),
          sendBridgeRequest('library.get', {}),
        ])
        const stateError = getPayloadError(stateResponse.payload)
        const libraryError = getPayloadError(libraryResponse.payload)
        if (stateError || libraryError) {
          throw new Error(stateError ?? libraryError ?? 'Initial resource request failed')
        }
        ingestProject(stateResponse.payload)
        ingestLibrary(libraryResponse.payload)
        setLibraryLoading(false)

        await executeBackendCommand('welcome')
      } catch (error) {
        if (isMounted) {
          setLibraryLoading(false)
          const message = getErrorMessage(error)
          if (message.startsWith('JUCE bridge unavailable:')) {
            setBridgeUnavailableMessage(message)
          } else {
            setStatusMessage(`Bridge error: ${message}`)
            setStatusLevel('error')
          }
        }
      }
    }

    void connect()
    return () => {
      isMounted = false
      if (eventTokenRef.current !== null) {
        removeXenBridgeListener(eventTokenRef.current)
        eventTokenRef.current = null
      }
    }
  }, [
    eventTokenRef,
    executeBackendCommand,
    ingestLibrary,
    ingestKeymap,
    ingestProject,
    sendBridgeRequest,
    setBridgeUnavailableMessage,
    setLibraryLoading,
    setPlayheadPhase,
    setSessionReference,
    setStatusLevel,
    setStatusMessage,
    transportRef,
  ])

  return {
    sendBridgeRequest,
    ingestLibrary,
    ingestKeymap,
    executeBackendCommand,
  }
}
