import { useCallback, useEffect, useRef, useState } from 'react'
import { addXenBridgeListener, removeXenBridgeListener } from '../../bridge/juceBridge'
import {
  BRIDGE_PROTOCOL,
  parseBridgeEvent,
} from '../domain/contracts'
import { BridgePayloadError } from '../bridge/BridgeClient'
import { buildSessionReference } from '../domain/reference'
import {
  FRONTEND_APP,
  FRONTEND_VERSION,
  getErrorMessage,
  normalizePhase,
} from '../shared'
import { triggersEqual } from '../domain/keymap'
import { useBridgeSession } from './useBridgeSession'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  BridgeMethodMap,
  KeymapOverrideRemoveRequest,
  KeymapOverrideSetRequest,
  KeymapResetRequest,
} from '../bridge/BridgeClient'
import type {
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
    request,
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
    ingestKeymap(await request('keymap.get', {}))
  }, [ingestKeymap, request])

  type KeymapMutationMethod =
    | 'keymap.override.set'
    | 'keymap.override.remove'
    | 'keymap.reset'

  type KeymapMutationPayload = {
    'keymap.override.set': Omit<KeymapOverrideSetRequest, 'expected_revision'>
    'keymap.override.remove': Omit<KeymapOverrideRemoveRequest, 'expected_revision'>
    'keymap.reset': Omit<KeymapResetRequest, 'expected_revision'>
  }

  const mutateKeymap = useCallback(async <K extends KeymapMutationMethod>(
    name: K,
    payload: KeymapMutationPayload[K]
  ): Promise<void> => {
    const current = keymapRef.current
    if (!current) throw new Error('Keymap is not loaded')
    setKeymapBusy(true)
    setKeymapError(null)
    try {
      const response = await request(name, {
        expected_revision: current.revision,
        ...payload,
      } as BridgeMethodMap[K]['request'])
      ingestKeymap(response)
    } catch (error) {
      if (error instanceof BridgePayloadError && error.code === 'invalid_request') {
        await refreshKeymap()
        const retryError = new Error(
          'Shortcuts changed elsewhere. The latest version was loaded; retry your edit.'
        )
        setKeymapError(retryError.message)
        throw retryError
      }
      const message = getErrorMessage(error)
      setKeymapError(message)
      throw error
    } finally {
      setKeymapBusy(false)
    }
  }, [ingestKeymap, refreshKeymap, request])

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
    const abortController = new AbortController()

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

        const hello = await request('session.hello', {
          protocol: BRIDGE_PROTOCOL,
          frontend_app: FRONTEND_APP,
          frontend_version: FRONTEND_VERSION,
        }, { signal: abortController.signal })
        if (!isMounted) return

        setBridgeUnavailableMessage(null)
        setSessionReference(buildSessionReference(hello.catalog))
        ingestKeymap(hello.keymap)
        setStatusMessage('Connected')
        setLibraryLoading(true)

        const [snapshot, librarySnapshot] = await Promise.all([
          request('state.get', {}, { signal: abortController.signal }),
          request('library.get', {}, { signal: abortController.signal }),
        ])
        const installedSnapshot = ingestProject(snapshot)
        ingestLibrary(librarySnapshot)
        setLibraryLoading(false)
        if (!isMounted) return
        setProjectState({ status: 'ready', snapshot: installedSnapshot })
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
      abortController.abort()
      if (eventTokenRef.current !== null) {
        removeXenBridgeListener(eventTokenRef.current)
        eventTokenRef.current = null
      }
    }
  }, [
    ingestKeymap,
    ingestLibrary,
    ingestProject,
    request,
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
    request,
    executeBackendCommand,
  }
}
