import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import {
  addXenBridgeListener,
  getXenBridgeRequest,
  removeXenBridgeListener,
} from './bridge/juceBridge'

const BRIDGE_PROTOCOL = 'xen.bridge.v1'
const FRONTEND_APP = 'xen-frontend-debug'
const FRONTEND_VERSION = '0.1.0'
const MAX_LOG_ENTRIES = 200

type EnvelopeType = 'request' | 'response' | 'event'

type Envelope = {
  protocol: typeof BRIDGE_PROTOCOL
  type: EnvelopeType
  name: string
  request_id?: string
  payload: Record<string, unknown>
}

type ConnectionStatus = 'missing' | 'connecting' | 'connected' | 'error'
type LogDirection = 'outbound' | 'inbound' | 'event' | 'system'

type LogEntry = {
  id: string
  timestamp: string
  direction: LogDirection
  name: string
  body?: unknown
  error?: string
}

const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown bridge error'
}

const formatJson = (value: unknown): string => {
  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const parseEnvelope = (rawValue: unknown): Envelope => {
  if (typeof rawValue !== 'object' || rawValue === null || Array.isArray(rawValue)) {
    throw new Error('Envelope is not an object')
  }

  const candidate = rawValue as Record<string, unknown>

  if (candidate.protocol !== BRIDGE_PROTOCOL) {
    throw new Error('Unexpected bridge protocol')
  }

  if (
    candidate.type !== 'request' &&
    candidate.type !== 'response' &&
    candidate.type !== 'event'
  ) {
    throw new Error('Unexpected envelope type')
  }

  if (typeof candidate.name !== 'string') {
    throw new Error('Envelope name must be a string')
  }

  if (
    typeof candidate.payload !== 'object' ||
    candidate.payload === null ||
    Array.isArray(candidate.payload)
  ) {
    throw new Error('Envelope payload must be an object')
  }

  if (
    candidate.request_id !== undefined &&
    typeof candidate.request_id !== 'string'
  ) {
    throw new Error('Envelope request_id must be a string when present')
  }

  return {
    protocol: BRIDGE_PROTOCOL,
    type: candidate.type,
    name: candidate.name,
    request_id: candidate.request_id,
    payload: candidate.payload as Record<string, unknown>,
  }
}

const parseWireEnvelope = (rawValue: unknown): Envelope => {
  const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue
  return parseEnvelope(parsed)
}

function App() {
  const [status, setStatus] = useState<ConnectionStatus>('missing')
  const [lastError, setLastError] = useState<string | null>(null)
  const [pluginVersion, setPluginVersion] = useState<string>('unknown')
  const [latestSnapshot, setLatestSnapshot] = useState<unknown>(null)
  const [catalog, setCatalog] = useState<unknown>(null)
  const [keymap, setKeymap] = useState<unknown>(null)
  const [commandText, setCommandText] = useState<string>('')
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const eventTokenRef = useRef<unknown>(null)

  const appendLog = useCallback(
    (entry: Omit<LogEntry, 'id' | 'timestamp'>): void => {
      const logEntry: LogEntry = {
        id: createId(),
        timestamp: new Date().toISOString(),
        ...entry,
      }

      setLogEntries((previous) => [logEntry, ...previous].slice(0, MAX_LOG_ENTRIES))
    },
    []
  )

  const sendBridgeRequest = useCallback(
    async (name: string, payload: Record<string, unknown>): Promise<Envelope> => {
      const requestEnvelope: Envelope = {
        protocol: BRIDGE_PROTOCOL,
        type: 'request',
        name,
        request_id: createId(),
        payload,
      }

      appendLog({
        direction: 'outbound',
        name: requestEnvelope.name,
        body: requestEnvelope,
      })

      const requestFn = getXenBridgeRequest()
      const rawResponse = await requestFn(JSON.stringify(requestEnvelope))
      let responseEnvelope: Envelope

      try {
        responseEnvelope = parseWireEnvelope(rawResponse)
      } catch (error) {
        const message = getErrorMessage(error)
        appendLog({
          direction: 'inbound',
          name: 'response.parse_error',
          body: rawResponse,
          error: message,
        })
        throw new Error(message)
      }

      appendLog({
        direction: 'inbound',
        name: responseEnvelope.name,
        body: responseEnvelope,
      })

      return responseEnvelope
    },
    [appendLog]
  )

  const bootstrapBridge = useCallback(async (): Promise<void> => {
    setStatus('connecting')
    setLastError(null)

    if (eventTokenRef.current !== null) {
      removeXenBridgeListener(eventTokenRef.current)
      eventTokenRef.current = null
    }

    try {
      eventTokenRef.current = addXenBridgeListener((rawEvent) => {
        try {
          const eventEnvelope = parseWireEnvelope(rawEvent)
          appendLog({
            direction: 'event',
            name: eventEnvelope.name,
            body: eventEnvelope,
          })

          if (eventEnvelope.name === 'state.changed') {
            setLatestSnapshot(eventEnvelope.payload)
          }
        } catch (error) {
          appendLog({
            direction: 'event',
            name: 'event.parse_error',
            body: rawEvent,
            error: getErrorMessage(error),
          })
        }
      })

      const helloResponse = await sendBridgeRequest('session.hello', {
        protocol: BRIDGE_PROTOCOL,
        snapshot_schema_version: 1,
        frontend_app: FRONTEND_APP,
        frontend_version: FRONTEND_VERSION,
      })

      if (typeof helloResponse.payload.plugin_version === 'string') {
        setPluginVersion(helloResponse.payload.plugin_version)
      }

      const stateResponse = await sendBridgeRequest('state.get', {})
      setLatestSnapshot(stateResponse.payload)

      const catalogResponse = await sendBridgeRequest('catalog.get', {})
      setCatalog(catalogResponse.payload)

      const keymapResponse = await sendBridgeRequest('keymap.get', {})
      setKeymap(keymapResponse.payload)

      setStatus('connected')
    } catch (error) {
      const message = getErrorMessage(error)
      setStatus('missing')
      setLastError(message)
      appendLog({
        direction: 'system',
        name: 'bridge.unavailable',
        error: message,
      })
    }
  }, [appendLog, sendBridgeRequest])

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      void bootstrapBridge()
    }, 0)

    return () => {
      window.clearTimeout(bootstrapTimer)

      if (eventTokenRef.current !== null) {
        removeXenBridgeListener(eventTokenRef.current)
        eventTokenRef.current = null
      }
    }
  }, [bootstrapBridge])

  const requestStateSnapshot = useCallback(async (): Promise<void> => {
    try {
      const response = await sendBridgeRequest('state.get', {})
      setLatestSnapshot(response.payload)
      setLastError(null)
    } catch (error) {
      const message = getErrorMessage(error)
      setLastError(message)
      appendLog({
        direction: 'system',
        name: 'state.get.failed',
        error: message,
      })
    }
  }, [appendLog, sendBridgeRequest])

  const handleCommandSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault()

      const command = commandText.trim()
      if (!command) {
        return
      }

      try {
        const response = await sendBridgeRequest('command.execute', { command })
        setCommandText('')
        setLastError(null)

        const snapshot = response.payload.snapshot
        if (typeof snapshot === 'object' && snapshot !== null) {
          setLatestSnapshot(snapshot)
        }

        const statusPayload = response.payload.status
        if (typeof statusPayload === 'object' && statusPayload !== null) {
          appendLog({
            direction: 'system',
            name: 'command.status',
            body: statusPayload,
          })
        }
      } catch (error) {
        const message = getErrorMessage(error)
        setLastError(message)
        appendLog({
          direction: 'system',
          name: 'command.execute.failed',
          error: message,
        })
      }
    },
    [appendLog, commandText, sendBridgeRequest]
  )

  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'connecting'
        ? 'Connecting'
        : status === 'error'
          ? 'Error'
          : 'Backend Missing'

  return (
    <div className="appShell">
      <header className="topBar">
        <div>
          <h1>Xen JUCE Bridge Debugger</h1>
          <p>
            Inspect bridge traffic, state snapshots, and send raw text commands through
            <code> command.execute</code>.
          </p>
        </div>
        <div className="topBarActions">
          <span className={`statusPill status-${status}`}>{statusLabel}</span>
          <button type="button" className="buttonSecondary" onClick={() => void bootstrapBridge()}>
            Reconnect
          </button>
          <button
            type="button"
            className="buttonSecondary"
            onClick={() => setLogEntries([])}
          >
            Clear Logs
          </button>
        </div>
      </header>

      <section className="panelGrid">
        <div className="panel">
          <h2>Session</h2>
          <p>
            Plugin version: <strong>{pluginVersion}</strong>
          </p>
          {lastError && <p className="errorText">{lastError}</p>}
        </div>

        <div className="panel">
          <h2>Command Console</h2>
          <form className="commandForm" onSubmit={(event) => void handleCommandSubmit(event)}>
            <input
              value={commandText}
              onChange={(event) => setCommandText(event.target.value)}
              placeholder='Example: transpose up 12'
              className="commandInput"
            />
            <button type="submit" className="buttonPrimary">
              Send
            </button>
          </form>
          <div className="panelActions">
            <button type="button" className="buttonSecondary" onClick={() => void requestStateSnapshot()}>
              Request state.get
            </button>
          </div>
        </div>

        <div className="panel panelWide">
          <h2>Latest Snapshot</h2>
          <pre>{formatJson(latestSnapshot)}</pre>
        </div>

        <div className="panel">
          <h2>Cached Catalog</h2>
          <pre>{formatJson(catalog)}</pre>
        </div>

        <div className="panel">
          <h2>Cached Keymap</h2>
          <pre>{formatJson(keymap)}</pre>
        </div>

        <div className="panel panelWide">
          <h2>Bridge Traffic</h2>
          <ul className="logList">
            {logEntries.map((entry) => (
              <li key={entry.id} className="logEntry">
                <div className="logHeader">
                  <span>{entry.timestamp}</span>
                  <span className={`directionBadge direction-${entry.direction}`}>
                    {entry.direction}
                  </span>
                  <code>{entry.name}</code>
                </div>
                {entry.error && <p className="errorText">{entry.error}</p>}
                {entry.body !== undefined && <pre>{formatJson(entry.body)}</pre>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

export default App
