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
  toSequenceIndex,
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
  SyncedTransportPhases,
  TransportState,
  UiStateSnapshot,
} from '../shared'

type UseBridgeSessionArgs = {
  eventTokenRef: MutableRefObject<unknown>
  transportRef: MutableRefObject<TransportState>
  selectedMeasureIndexRef: MutableRefObject<number>
  lastSnapshotVersionRef: MutableRefObject<number>
  setSnapshot: Dispatch<SetStateAction<UiStateSnapshot | null>>
  setCurrentInputMode: Dispatch<SetStateAction<InputMode>>
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
  setBridgeUnavailableMessage: Dispatch<SetStateAction<string | null>>
  setSessionReference: Dispatch<SetStateAction<SessionReference>>
  setSequenceViewKeymap: Dispatch<SetStateAction<SequenceViewKeymap>>
  setLibraryLoading: Dispatch<SetStateAction<boolean>>
  setLibrarySnapshot: Dispatch<SetStateAction<LibrarySnapshot>>
  setActiveSequenceFlags: Dispatch<SetStateAction<boolean[]>>
  setPlayheadPhase: Dispatch<SetStateAction<number | null>>
  setSyncedTransportPhases: Dispatch<SetStateAction<SyncedTransportPhases>>
}

export function useBridgeSession({
  eventTokenRef,
  transportRef,
  selectedMeasureIndexRef,
  lastSnapshotVersionRef,
  setSnapshot,
  setCurrentInputMode,
  setStatusMessage,
  setStatusLevel,
  setBridgeUnavailableMessage,
  setSessionReference,
  setSequenceViewKeymap,
  setLibraryLoading,
  setLibrarySnapshot,
  setActiveSequenceFlags,
  setPlayheadPhase,
  setSyncedTransportPhases,
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
    (rawSnapshot: unknown): number | null => {
      const parsedSnapshot = parseUiStateSnapshot(rawSnapshot)
      if (!parsedSnapshot) {
        return null
      }

      if (parsedSnapshot.snapshot_version <= lastSnapshotVersionRef.current) {
        return parsedSnapshot.snapshot_version
      }

      lastSnapshotVersionRef.current = parsedSnapshot.snapshot_version
      setSnapshot(parsedSnapshot)
      setCurrentInputMode(parsedSnapshot.editor.input_mode)
      return parsedSnapshot.snapshot_version
    },
    [lastSnapshotVersionRef, setCurrentInputMode, setSnapshot]
  )

  const executeBackendCommand = useCallback(
    async (command: string): Promise<void> => {
      const response = await sendBridgeRequest('command.execute', { command })
      const payloadError = getPayloadError(response.payload)
      if (payloadError) {
        throw new Error(payloadError)
      }

      const commandSnapshot = getCommandSnapshot(response.payload)
      applySnapshot(commandSnapshot)
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
              applySnapshot(eventEnvelope.payload)
              return
            }

            const payload = asRecord(eventEnvelope.payload)
            if (!payload) {
              return
            }

            if (eventEnvelope.name === 'transport.trigger.noteOn') {
              const sequenceIndex = toSequenceIndex(payload.sequence_index)
              if (sequenceIndex === null) {
                return
              }

              transportRef.current.active[sequenceIndex] = true
              setActiveSequenceFlags((previous) => {
                if (previous[sequenceIndex]) {
                  return previous
                }
                const next = [...previous]
                next[sequenceIndex] = true
                return next
              })
              if (sequenceIndex === selectedMeasureIndexRef.current) {
                setPlayheadPhase(transportRef.current.phase[sequenceIndex] ?? 0)
              }
              return
            }

            if (eventEnvelope.name === 'transport.trigger.noteOff') {
              const sequenceIndex = toSequenceIndex(payload.sequence_index)
              if (sequenceIndex === null) {
                return
              }

              transportRef.current.active[sequenceIndex] = false
              setActiveSequenceFlags((previous) => {
                if (!previous[sequenceIndex]) {
                  return previous
                }
                const next = [...previous]
                next[sequenceIndex] = false
                return next
              })
              transportRef.current.phase[sequenceIndex] = 0
              setSyncedTransportPhases((previous) => {
                if (
                  (previous.wrapped[sequenceIndex] ?? 0) === 0 &&
                  (previous.unwrapped[sequenceIndex] ?? 0) === 0
                ) {
                  return previous
                }
                const nextWrapped = [...previous.wrapped]
                const nextUnwrapped = [...previous.unwrapped]
                nextWrapped[sequenceIndex] = 0
                nextUnwrapped[sequenceIndex] = 0
                return {
                  wrapped: nextWrapped,
                  unwrapped: nextUnwrapped,
                }
              })
              if (sequenceIndex === selectedMeasureIndexRef.current) {
                setPlayheadPhase(null)
              }
              return
            }

            if (eventEnvelope.name === 'transport.phase.sync') {
              if (typeof payload.bpm === 'number' && Number.isFinite(payload.bpm) && payload.bpm > 0) {
                transportRef.current.bpm = payload.bpm
              }

              const phases = Array.isArray(payload.phases) ? payload.phases : []
              setSyncedTransportPhases((previous) => {
                const nextWrapped = [...previous.wrapped]
                const nextUnwrapped = [...previous.unwrapped]
                let changed = false
                for (const rawPhaseEntry of phases) {
                  const phaseEntry = asRecord(rawPhaseEntry)
                  if (!phaseEntry) {
                    continue
                  }

                  const sequenceIndex = toSequenceIndex(phaseEntry.sequence_index)
                  if (sequenceIndex === null) {
                    continue
                  }

                  const phase = phaseEntry.phase
                  if (typeof phase !== 'number' || !Number.isFinite(phase)) {
                    continue
                  }

                  const normalizedPhase = normalizePhase(phase)
                  const previousWrapped = previous.wrapped[sequenceIndex] ?? 0
                  const previousUnwrapped = previous.unwrapped[sequenceIndex] ?? 0
                  let delta = normalizedPhase - previousWrapped
                  if (delta > 0.5) {
                    delta -= 1
                  } else if (delta < -0.5) {
                    delta += 1
                  }
                  const nextUnwrappedPhase = previousUnwrapped + delta

                  if (
                    nextWrapped[sequenceIndex] === normalizedPhase &&
                    nextUnwrapped[sequenceIndex] === nextUnwrappedPhase
                  ) {
                    continue
                  }
                  nextWrapped[sequenceIndex] = normalizedPhase
                  nextUnwrapped[sequenceIndex] = nextUnwrappedPhase
                  changed = true
                }

                return changed
                  ? {
                      wrapped: nextWrapped,
                      unwrapped: nextUnwrapped,
                    }
                  : previous
              })
              for (const rawPhaseEntry of phases) {
                const phaseEntry = asRecord(rawPhaseEntry)
                if (!phaseEntry) {
                  continue
                }

                const sequenceIndex = toSequenceIndex(phaseEntry.sequence_index)
                if (sequenceIndex === null) {
                  continue
                }

                const phase = phaseEntry.phase
                if (typeof phase !== 'number' || !Number.isFinite(phase)) {
                  continue
                }

                const normalizedPhase = normalizePhase(phase)
                transportRef.current.phase[sequenceIndex] = normalizedPhase
              }

              const selectedIndex = selectedMeasureIndexRef.current
              if (transportRef.current.active[selectedIndex]) {
                setPlayheadPhase(transportRef.current.phase[selectedIndex] ?? 0)
              } else {
                setPlayheadPhase(null)
              }
            }
          } catch {
            // Keep footer status reserved for command responses only.
          }
        })

        const helloResponse = await sendBridgeRequest('session.hello', {
          protocol: BRIDGE_PROTOCOL,
          snapshot_schema_version: 1,
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

        applySnapshot(stateResponse.payload)

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
        applySnapshot(welcomeSnapshot)
        const welcomeStatus = getCommandStatus(welcomeResponse.payload)

        if (isMounted) {
          if (welcomeStatus && welcomeStatus.level !== 'debug') {
            setStatusMessage(welcomeStatus.message)
            setStatusLevel(welcomeStatus.level)
          }
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
    selectedMeasureIndexRef,
    sendBridgeRequest,
    setActiveSequenceFlags,
    setBridgeUnavailableMessage,
    setLibraryLoading,
    setLibrarySnapshot,
    setPlayheadPhase,
    setSequenceViewKeymap,
    setSessionReference,
    setStatusLevel,
    setStatusMessage,
    setSyncedTransportPhases,
    transportRef,
  ])

  return {
    sendBridgeRequest,
    applySnapshot,
    executeBackendCommand,
  }
}
