import { useCallback, useEffect, useRef, useState } from 'react'
import { addXenBridgeListener, removeXenBridgeListener } from '../bridge/juceBridge'
import {
  BRIDGE_PROTOCOL,
  parseBridgeEvent,
} from '../domain/contracts'
import { keymapFromDto, libraryFromDto, projectFromDto, sessionReferenceFromCatalogDto } from '../domain/mappers'
import {
  normalizePhase,
} from '../domain/music'
import { FRONTEND_APP, FRONTEND_VERSION } from '../constants'
import { getErrorMessage } from '../utils/errors'
import { bridgeClient } from '../bridge/BridgeClient'
import { useBridgeSession } from './useBridgeSession'
import { useKeymapController } from './useKeymapController'
import { usePreferences } from '../preferences/usePreferences'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  BridgeMethodMap,
  RequestOptions,
} from '../bridge/BridgeClient'
import type {
  ActiveSequenceTarget,
  CompositionSelection,
  EditorState,
  LibrarySnapshot,
  MessageLevel,
  ProjectSnapshot,
  SessionReference,
  TransportState,
} from '../domain/models'
import type { ProjectSessionState } from '../types/session'

type UseProjectSessionArgs = {
  transportRef: MutableRefObject<TransportState>
  editorStateRef: MutableRefObject<EditorState>
  activeSequenceTargetRef: MutableRefObject<ActiveSequenceTarget | null>
  compositionSelectionRef: MutableRefObject<CompositionSelection>
  workspaceViewRef: MutableRefObject<'composition' | 'sequencer'>
  setEditorState: Dispatch<SetStateAction<EditorState>>
  setSessionReference: Dispatch<SetStateAction<SessionReference>>
  setLibrarySnapshot: Dispatch<SetStateAction<LibrarySnapshot>>
  setIsTransportActive: Dispatch<SetStateAction<boolean>>
  setPlayheadPhase: Dispatch<SetStateAction<number | null>>
}

export function useProjectSession({
  transportRef,
  editorStateRef,
  activeSequenceTargetRef,
  compositionSelectionRef,
  workspaceViewRef,
  setEditorState,
  setSessionReference,
  setLibrarySnapshot,
  setIsTransportActive,
  setPlayheadPhase,
}: UseProjectSessionArgs) {
  const eventTokenRef = useRef<unknown>(null)
  const projectRef = useRef<ProjectSnapshot | null>(null)
  const libraryRevisionRef = useRef(-1)
  const [projectState, setProjectState] = useState<ProjectSessionState>({ status: 'idle' })
  const [statusMessage, setStatusMessage] = useState('')
  const [statusLevel, setStatusLevelState] = useState<MessageLevel>('info')
  const [statusRevision, setStatusRevision] = useState(0)
  const [bridgeUnavailableMessage, setBridgeUnavailableMessage] = useState<string | null>(null)

  const request = useCallback(<K extends keyof BridgeMethodMap>(
    name: K,
    payload: BridgeMethodMap[K]['request'],
    options?: RequestOptions
  ): Promise<BridgeMethodMap[K]['response']> =>
    bridgeClient.request(name, payload, options),
  [])

  const setStatusLevel: Dispatch<SetStateAction<MessageLevel>> = useCallback((nextLevel) => {
    setStatusLevelState(nextLevel)
    setStatusRevision((current) => current + 1)
  }, [])

  const keymapController = useKeymapController({ request })
  const { ingestKeymap } = keymapController
  const { ingestPreferences } = usePreferences()

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
    ingestProject,
    ingestLibrary,
    executeBackendCommand,
    beginBackendPreview,
  } = useBridgeSession({
    request,
    projectRef,
    editorStateRef,
    activeSequenceTargetRef,
    compositionSelectionRef,
    workspaceViewRef,
    libraryRevisionRef,
    setProject: setProjectSnapshot,
    setEditorState,
    setStatusMessage,
    setStatusLevel,
    setLibrarySnapshot,
  })

  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    const connect = async (): Promise<void> => {
      setProjectState({ status: 'loading' })

      try {
        eventTokenRef.current = addXenBridgeListener((rawEvent) => {
          try {
            const event = parseBridgeEvent(rawEvent)
            if (event.name === 'state.changed') {
              ingestProject(projectFromDto(event.payload))
              return
            }
            if (event.name === 'library.changed') {
              ingestLibrary(libraryFromDto(event.payload))
              return
            }
            if (event.name === 'keymap.changed') {
              ingestKeymap(keymapFromDto(event.payload))
              return
            }
            if (event.name === 'preferences.changed') {
              ingestPreferences(event.payload)
              return
            }
            if (event.name === 'transport.phase.sync') {
              if (event.payload.bpm > 0) {
                transportRef.current.bpm = event.payload.bpm
              }
              const phase = normalizePhase(event.payload.phase)
              transportRef.current.phase = phase
              transportRef.current.active = true
              setIsTransportActive(true)
              setPlayheadPhase(phase)
              return
            }
            transportRef.current.active = false
            setIsTransportActive(false)
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
        setSessionReference(sessionReferenceFromCatalogDto(hello.catalog))
        ingestKeymap(keymapFromDto(hello.keymap))
        ingestPreferences(hello.preferences)

        const [snapshot, librarySnapshot] = await Promise.all([
          request('state.get', {}, { signal: abortController.signal }),
          request('library.get', {}, { signal: abortController.signal }),
        ])
        const installedSnapshot = ingestProject(snapshot)
        ingestLibrary(librarySnapshot)
        if (!isMounted) return
        setProjectState({ status: 'ready', snapshot: installedSnapshot })
      } catch (error) {
        if (!isMounted) return
        const message = getErrorMessage(error)
        const bridgeUnavailable = message.startsWith('JUCE bridge unavailable:')
        if (bridgeUnavailable) {
          setBridgeUnavailableMessage(message)
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
    ingestPreferences,
    ingestLibrary,
    ingestProject,
    request,
    setLibrarySnapshot,
    setIsTransportActive,
    setPlayheadPhase,
    setSessionReference,
    setStatusLevel,
    transportRef,
  ])

  return {
    projectState,
    statusMessage,
    statusLevel,
    statusRevision,
    setStatusMessage,
    setStatusLevel,
    bridgeUnavailableMessage,
    projectRef,
    keymapRef: keymapController.keymapRef,
    keymapController,
    request,
    executeBackendCommand,
    beginBackendPreview,
  }
}
