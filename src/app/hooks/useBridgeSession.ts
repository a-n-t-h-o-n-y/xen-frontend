import { useCallback, useEffect } from 'react'
import { addXenBridgeListener, getXenBridgeRequest, removeXenBridgeListener } from '../../bridge/juceBridge'
import {
  BRIDGE_PROTOCOL,
  FRONTEND_APP,
  FRONTEND_VERSION,
  asRecord,
  createRequestId,
  getCommandSnapshot,
  getCommandStatus,
  getErrorMessage,
  getLibrarySnapshot,
  getPayloadError,
  getSequenceViewKeymap,
  getSessionReference,
  normalizePhase,
  parseUiStateSnapshot,
  parseWireEnvelope,
} from '../shared'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  Envelope,
  EnvelopePayload,
  InputMode,
  LibrarySnapshot,
  MessageLevel,
  SequenceViewKeymap,
  SessionReference,
  TransportState,
  UiStateSnapshot,
} from '../shared'

type UseBridgeSessionArgs = {
  eventTokenRef: MutableRefObject<unknown>
  transportRef: MutableRefObject<TransportState>
  lastSnapshotVersionRef: MutableRefObject<number>
  setSnapshot: Dispatch<SetStateAction<UiStateSnapshot | null>>
  setRawSnapshotText: Dispatch<SetStateAction<string>>
  setLastSnapshotSource: Dispatch<SetStateAction<string>>
  setSnapshotParseError: Dispatch<SetStateAction<string | null>>
  setCurrentInputMode: Dispatch<SetStateAction<InputMode>>
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
  setBridgeUnavailableMessage: Dispatch<SetStateAction<string | null>>
  setSessionReference: Dispatch<SetStateAction<SessionReference>>
  setSequenceViewKeymap: Dispatch<SetStateAction<SequenceViewKeymap>>
  setLibraryLoading: Dispatch<SetStateAction<boolean>>
  setLibrarySnapshot: Dispatch<SetStateAction<LibrarySnapshot>>
  setPlayheadPhase: Dispatch<SetStateAction<number | null>>
}

export function useBridgeSession({
  eventTokenRef,
  transportRef,
  lastSnapshotVersionRef,
  setSnapshot,
  setRawSnapshotText,
  setLastSnapshotSource,
  setSnapshotParseError,
  setCurrentInputMode,
  setStatusMessage,
  setStatusLevel,
  setBridgeUnavailableMessage,
  setSessionReference,
  setSequenceViewKeymap,
  setLibraryLoading,
  setLibrarySnapshot,
  setPlayheadPhase,
}: UseBridgeSessionArgs) {
  const sendBridgeRequest = useCallback(
    async (name: string, payload: EnvelopePayload): Promise<Envelope> => {
      const request = {
        protocol: BRIDGE_PROTOCOL,
        type: 'request' as const,
        name,
        request_id: createRequestId(),
        payload,
      }

      const requestFn = await getXenBridgeRequest()
      const rawResponse = await requestFn(JSON.stringify(request))
      const envelope = parseWireEnvelope(rawResponse)

      if (envelope.type !== 'response') {
        throw new Error(`Unexpected '${envelope.type}' envelope for '${name}'`)
      }

      return envelope
    },
    []
  )

  const applySnapshot = useCallback(
    (rawSnapshot: unknown, source: string): number | null => {
      try {
        setRawSnapshotText(JSON.stringify(rawSnapshot, null, 2))
      } catch {
        setRawSnapshotText(String(rawSnapshot))
      }
      setLastSnapshotSource(source)

      const parsedSnapshot = parseUiStateSnapshot(rawSnapshot)
      if (!parsedSnapshot) {
        setSnapshotParseError('Snapshot parse failed: payload does not match the frontend v4 contract.')
        return null
      }

      setSnapshotParseError(null)

      if (parsedSnapshot.snapshot_version <= lastSnapshotVersionRef.current) {
        return parsedSnapshot.snapshot_version
      }

      lastSnapshotVersionRef.current = parsedSnapshot.snapshot_version
      setSnapshot(parsedSnapshot)
      setCurrentInputMode(parsedSnapshot.editor.input_mode)
      return parsedSnapshot.snapshot_version
    },
    [
      lastSnapshotVersionRef,
      setCurrentInputMode,
      setLastSnapshotSource,
      setRawSnapshotText,
      setSnapshot,
      setSnapshotParseError,
    ]
  )

  const executeBackendCommand = useCallback(
    async (command: string): Promise<void> => {
      const response = await sendBridgeRequest('command.execute', { command })
      const payloadError = getPayloadError(response.payload)
      if (payloadError) {
        throw new Error(payloadError)
      }

      const commandSnapshot = getCommandSnapshot(response.payload)
      applySnapshot(commandSnapshot, `command.execute:${command}`)
      const commandStatus = getCommandStatus(response.payload)

      if (commandStatus && commandStatus.level !== 'debug') {
        setStatusMessage(commandStatus.message)
        setStatusLevel(commandStatus.level)
      }
    },
    [applySnapshot, sendBridgeRequest, setStatusLevel, setStatusMessage]
  )

  useEffect(() => {
    let isMounted = true

    const connect = async (): Promise<void> => {
      try {
        eventTokenRef.current = addXenBridgeListener((rawEvent) => {
          try {
            const eventEnvelope = parseWireEnvelope(rawEvent)
            if (eventEnvelope.type !== 'event') {
              return
            }

            if (eventEnvelope.name === 'state.changed') {
              applySnapshot(eventEnvelope.payload, 'event:state.changed')
              return
            }

            if (eventEnvelope.name === 'transport.phase.sync') {
              const payload = asRecord(eventEnvelope.payload)
              if (!payload) {
                return
              }

              if (typeof payload.bpm === 'number' && Number.isFinite(payload.bpm) && payload.bpm > 0) {
                transportRef.current.bpm = payload.bpm
              }

              if (typeof payload.phase === 'number' && Number.isFinite(payload.phase)) {
                const normalizedPhase = normalizePhase(payload.phase)
                transportRef.current.phase = normalizedPhase
                transportRef.current.active = true
                setPlayheadPhase(normalizedPhase)
              } else {
                transportRef.current.active = false
                setPlayheadPhase(null)
              }

              return
            }

            if (eventEnvelope.name === 'transport.stopped') {
              transportRef.current.active = false
              setPlayheadPhase(null)
            }
          } catch {
            // Keep footer status reserved for command responses only.
          }
        })

        const helloResponse = await sendBridgeRequest('session.hello', {
          protocol: BRIDGE_PROTOCOL,
          snapshot_schema_version: 4,
          frontend_app: FRONTEND_APP,
          frontend_version: FRONTEND_VERSION,
        })

        const helloError = getPayloadError(helloResponse.payload)
        if (helloError) {
          throw new Error(helloError)
        }

        if (isMounted) {
          setBridgeUnavailableMessage(null)
          setSessionReference(getSessionReference(helloResponse.payload))
        }

        const stateResponse = await sendBridgeRequest('state.get', {})
        const stateError = getPayloadError(stateResponse.payload)
        if (stateError) {
          throw new Error(stateError)
        }

        applySnapshot(stateResponse.payload, 'response:state.get')

        const keymapResponse = await sendBridgeRequest('keymap.get', {})
        const keymapError = getPayloadError(keymapResponse.payload)
        if (keymapError) {
          throw new Error(keymapError)
        }
        if (isMounted) {
          setSequenceViewKeymap(getSequenceViewKeymap(keymapResponse.payload))
        }

        if (isMounted) {
          setLibraryLoading(true)
        }
        const libraryResponse = await sendBridgeRequest('library.get', {})
        const libraryError = getPayloadError(libraryResponse.payload)
        if (libraryError) {
          throw new Error(libraryError)
        }
        if (isMounted) {
          const parsedLibrary = getLibrarySnapshot(libraryResponse.payload)
          setLibrarySnapshot(parsedLibrary)
          setLibraryLoading(false)
        }

        const welcomeResponse = await sendBridgeRequest('command.execute', { command: 'welcome' })
        const welcomeError = getPayloadError(welcomeResponse.payload)
        if (welcomeError) {
          throw new Error(welcomeError)
        }

        const welcomeSnapshot = getCommandSnapshot(welcomeResponse.payload)
        applySnapshot(welcomeSnapshot, 'command.execute:welcome')
        const welcomeStatus = getCommandStatus(welcomeResponse.payload)

        if (isMounted && welcomeStatus && welcomeStatus.level !== 'debug') {
          setStatusMessage(welcomeStatus.message)
          setStatusLevel(welcomeStatus.level)
        }
      } catch (error) {
        if (isMounted) {
          setLibraryLoading(false)
          const message = getErrorMessage(error)
          if (message.startsWith('JUCE bridge unavailable:')) {
            setBridgeUnavailableMessage(message)
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
    applySnapshot,
    eventTokenRef,
    sendBridgeRequest,
    setBridgeUnavailableMessage,
    setLibraryLoading,
    setLibrarySnapshot,
    setPlayheadPhase,
    setSequenceViewKeymap,
    setSessionReference,
    setStatusLevel,
    setStatusMessage,
    transportRef,
  ])

  return {
    sendBridgeRequest,
    applySnapshot,
    executeBackendCommand,
  }
}
