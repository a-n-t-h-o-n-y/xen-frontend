import { useCallback, useEffect, useRef, useState } from 'react'
import { addXenBridgeListener, removeXenBridgeListener } from '../../bridge/juceBridge'
import {
  BRIDGE_PROTOCOL,
  parseBridgeEvent,
  parseKeymapResource,
  parseSessionHello,
} from '../domain/contracts'
import { buildSessionReference } from '../domain/reference'
import {
  FRONTEND_APP,
  FRONTEND_VERSION,
  getErrorMessage,
  getPayloadError,
  normalizePhase,
} from '../shared'
import { triggersEqual } from '../domain/keymap'
import { useBridgeSession } from './useBridgeSession'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  EnvelopePayload,
  KeymapResource,
  KeymapTarget,
  KeymapTrigger,
  LibrarySnapshot,
  ProjectSnapshot,
} from '../domain/contracts'
import type {
  EditorState,
  MessageLevel,
  SessionReference,
  TransportState,
} from '../shared'
import type { ProjectSessionState } from '../types/session'

type UseProjectSessionArgs = {
  transportRef: MutableRefObject<TransportState>
  editorStateRef: MutableRefObject<EditorState>
  setEditorState: Dispatch<SetStateAction<EditorState>>
  setSessionReference: Dispatch<SetStateAction<SessionReference>>
  setLibrarySnapshot: Dispatch<SetStateAction<LibrarySnapshot>>
  setLibraryLoading: Dispatch<SetStateAction<boolean>>
  setPlayheadPhase: Dispatch<SetStateAction<number | null>>
}

export function useProjectSession({
  transportRef,
  editorStateRef,
  setEditorState,
  setSessionReference,
  setLibrarySnapshot,
  setLibraryLoading,
  setPlayheadPhase,
}: UseProjectSessionArgs) {
  const eventTokenRef = useRef<unknown>(null)
  const projectRef = useRef<ProjectSnapshot | null>(null)
  const libraryRevisionRef = useRef(-1)
  const keymapRef = useRef<KeymapResource | null>(null)
  const [projectState, setProjectState] = useState<ProjectSessionState>({ status: 'idle' })
  const [statusMessage, setStatusMessage] = useState('')
  const [statusLevel, setStatusLevel] = useState<MessageLevel>('info')
  const [bridgeUnavailableMessage, setBridgeUnavailableMessage] = useState<string | null>(null)
  const [keymapResource, setKeymapResource] = useState<KeymapResource | null>(null)
  const [keymapBusy, setKeymapBusy] = useState(false)
  const [keymapError, setKeymapError] = useState<string | null>(null)

  const setProjectSnapshot = useCallback((nextSnapshot: SetStateAction<ProjectSnapshot | null>): void => {
    setProjectState((current) => {
      const currentSnapshot = current.status === 'ready' ? current.snapshot : null
      const snapshot = typeof nextSnapshot === 'function'
        ? nextSnapshot(currentSnapshot)
        : nextSnapshot
      return snapshot ? { status: 'ready', snapshot } : { status: 'loading' }
    })
  }, [])

  const {
    sendBridgeRequest,
    ingestProject,
    ingestLibrary,
    ingestKeymap,
    executeBackendCommand,
  } = useBridgeSession({
    projectRef,
    editorStateRef,
    libraryRevisionRef,
    keymapRef,
    setProject: setProjectSnapshot,
    setEditorState,
    setStatusMessage,
    setStatusLevel,
    setKeymapResource,
    setLibrarySnapshot,
  })

  const refreshKeymap = useCallback(async (): Promise<void> => {
    const response = await sendBridgeRequest('keymap.get', {})
    const payloadError = getPayloadError(response.payload)
    if (payloadError) throw new Error(payloadError)
    ingestKeymap(response.payload)
  }, [ingestKeymap, sendBridgeRequest])

  const mutateKeymap = useCallback(async (
    name: 'keymap.override.set' | 'keymap.override.remove' | 'keymap.reset',
    payload: EnvelopePayload
  ): Promise<void> => {
    const current = keymapRef.current
    if (!current) throw new Error('Keymap is not loaded')
    setKeymapBusy(true)
    setKeymapError(null)
    try {
      const response = await sendBridgeRequest(name, {
        expected_revision: current.revision,
        ...payload,
      })
      const payloadError = getPayloadError(response.payload)
      if (payloadError) {
        const rawError = response.payload.error
        const code = typeof rawError === 'object' && rawError !== null
          ? (rawError as Record<string, unknown>).code
          : null
        if (code === 'invalid_request') {
          await refreshKeymap()
          throw new Error('Shortcuts changed elsewhere. The latest version was loaded; retry your edit.')
        }
        throw new Error(payloadError)
      }
      ingestKeymap(parseKeymapResource(response.payload))
    } catch (error) {
      const message = getErrorMessage(error)
      setKeymapError(message)
      throw error
    } finally {
      setKeymapBusy(false)
    }
  }, [ingestKeymap, refreshKeymap, sendBridgeRequest])

  const setKeymapOverride = useCallback(async (
    context: string,
    trigger: KeymapTrigger,
    target: KeymapTarget,
    originalTrigger?: KeymapTrigger
  ): Promise<void> => {
    await mutateKeymap('keymap.override.set', { context, trigger, target })
    if (!originalTrigger || triggersEqual(originalTrigger, trigger)) return

    const originalWasOverride = keymapRef.current?.overrides.some((override) =>
      override.context === context && triggersEqual(override.trigger, originalTrigger)
    )
    if (originalWasOverride) {
      await mutateKeymap('keymap.override.remove', { context, trigger: originalTrigger })
    } else {
      await mutateKeymap('keymap.override.set', {
        context,
        trigger: originalTrigger,
        target: null,
      })
    }
  }, [mutateKeymap])

  useEffect(() => {
    let isMounted = true

    const connect = async (): Promise<void> => {
      setProjectState({ status: 'loading' })
      setStatusMessage('Connecting')
      setStatusLevel('info')

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
        if (helloError) throw new Error(helloError)
        const hello = parseSessionHello(helloResponse.payload)
        if (!isMounted) return

        setBridgeUnavailableMessage(null)
        setSessionReference(buildSessionReference(hello.catalog))
        ingestKeymap(hello.keymap)
        setStatusMessage('Connected')
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
        const snapshot = ingestProject(stateResponse.payload)
        ingestLibrary(libraryResponse.payload)
        setLibraryLoading(false)
        if (!isMounted) return
        setProjectState({ status: 'ready', snapshot })
        setStatusMessage('Project loaded')
        setStatusLevel('info')
      } catch (error) {
        if (!isMounted) return
        setLibraryLoading(false)
        const message = getErrorMessage(error)
        const bridgeUnavailable = message.startsWith('JUCE bridge unavailable:')
        if (bridgeUnavailable) {
          setBridgeUnavailableMessage(message)
        } else {
          setStatusMessage(`Bridge error: ${message}`)
          setStatusLevel('error')
        }
        setProjectState({ status: 'error', message, bridgeUnavailable })
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
    ingestKeymap,
    ingestLibrary,
    ingestProject,
    sendBridgeRequest,
    setLibraryLoading,
    setLibrarySnapshot,
    setPlayheadPhase,
    setSessionReference,
    transportRef,
  ])

  return {
    projectState,
    statusMessage,
    statusLevel,
    setStatusMessage,
    setStatusLevel,
    bridgeUnavailableMessage,
    projectRef,
    keymapRef,
    keymapResource,
    keymapBusy,
    keymapError,
    setKeymapError,
    refreshKeymap,
    mutateKeymap,
    setKeymapOverride,
    sendBridgeRequest,
    executeBackendCommand,
  }
}
