import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'
import {
  addXenBridgeListener,
  getXenBridgeRequest,
  removeXenBridgeListener,
} from './bridge/juceBridge'

const BRIDGE_PROTOCOL = 'xen.bridge.v1'
const FRONTEND_APP = 'xen-frontend-skeleton'
const FRONTEND_VERSION = '0.2.0'
const MAX_COMMAND_HISTORY = 100
const DEFAULT_TUNING_LENGTH = 12

type MessageLevel = 'debug' | 'info' | 'warning' | 'error'
type TranslateDirection = 'up' | 'down'
type InputMode = 'pitch' | 'velocity' | 'delay' | 'gate' | 'scale'

type EnvelopePayload = Record<string, unknown>
type SequenceViewKeymap = Record<string, string>

type Envelope = {
  protocol: string
  type: 'request' | 'response' | 'event'
  name: string
  request_id?: string
  payload: EnvelopePayload
}

type NoteCell = {
  type: 'Note'
  weight: number
  pitch: number
  velocity: number
  delay: number
  gate: number
}

type RestCell = {
  type: 'Rest'
  weight: number
}

type SequenceCell = {
  type: 'Sequence'
  weight: number
  cells: Cell[]
}

type Cell = NoteCell | RestCell | SequenceCell

type Measure = {
  cell: Cell
  time_signature: {
    numerator: number
    denominator: number
  }
}

type Scale = {
  name: string
  tuning_length: number
  intervals: number[]
  mode: number
}

type UiStateSnapshot = {
  snapshot_version: number
  engine: {
    sequence_bank: Measure[]
    sequence_names: string[]
    tuning: {
      intervals: number[]
      octave: number
    }
    tuning_name: string
    scale: Scale | null
    key: number
    scale_translate_direction: TranslateDirection
    base_frequency: number
  }
  editor: {
    selected: {
      measure: number
      cell: number[]
    }
    input_mode: InputMode
  }
}

const REFERENCE_RATIOS = [
  Math.log2(1 / 1),
  Math.log2(3 / 2),
  Math.log2(4 / 3),
  Math.log2(5 / 4),
  Math.log2(6 / 5),
  Math.log2(5 / 3),
  Math.log2(8 / 5),
  Math.log2(9 / 8),
  Math.log2(16 / 9),
  Math.log2(15 / 8),
  Math.log2(16 / 15),
  Math.log2(45 / 32),
].sort((a, b) => a - b)

const createRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `req-${Date.now()}`
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

const parseWireEnvelope = (rawValue: unknown): Envelope => {
  if (typeof rawValue === 'string') {
    throw new Error('Bridge contract mismatch: expected object envelope, received string')
  }

  if (typeof rawValue !== 'object' || rawValue === null || Array.isArray(rawValue)) {
    throw new Error('Envelope is not an object')
  }

  const candidate = rawValue as Record<string, unknown>
  if (candidate.protocol !== BRIDGE_PROTOCOL) {
    throw new Error('Unexpected bridge protocol')
  }

  if (candidate.type !== 'request' && candidate.type !== 'response' && candidate.type !== 'event') {
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

  return {
    protocol: BRIDGE_PROTOCOL,
    type: candidate.type,
    name: candidate.name,
    request_id: typeof candidate.request_id === 'string' ? candidate.request_id : undefined,
    payload: candidate.payload as EnvelopePayload,
  }
}

const getPayloadError = (payload: EnvelopePayload): string | null => {
  const rawError = payload.error
  if (typeof rawError !== 'object' || rawError === null || Array.isArray(rawError)) {
    return null
  }

  const message = (rawError as Record<string, unknown>).message
  return typeof message === 'string' ? message : null
}

const getCommandSnapshot = (payload: EnvelopePayload): unknown =>
  'snapshot' in payload ? payload.snapshot : null

const isMessageLevel = (value: unknown): value is MessageLevel =>
  value === 'debug' || value === 'info' || value === 'warning' || value === 'error'

const getCommandStatus = (
  payload: EnvelopePayload
): { level: MessageLevel; message: string } | null => {
  const rawStatus = payload.status
  if (typeof rawStatus !== 'object' || rawStatus === null || Array.isArray(rawStatus)) {
    return null
  }

  const statusLevel = (rawStatus as Record<string, unknown>).level
  const statusMessage = (rawStatus as Record<string, unknown>).message
  if (!isMessageLevel(statusLevel) || typeof statusMessage !== 'string') {
    return null
  }

  return {
    level: statusLevel,
    message: statusMessage,
  }
}

const getCommandSuffix = (payload: EnvelopePayload): string | null => {
  const suffix = payload.suffix
  return typeof suffix === 'string' ? suffix : null
}

const getSequenceViewKeymap = (payload: EnvelopePayload): SequenceViewKeymap => {
  const keymapRoot = asRecord(payload.keymap)
  if (!keymapRoot) {
    return {}
  }

  const sequenceView = asRecord(keymapRoot.SequenceView)
  if (!sequenceView) {
    return {}
  }

  const entries = Object.entries(sequenceView).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  )
  return Object.fromEntries(entries)
}

type ParsedKeyBinding = {
  requiredMode: InputMode | null
  requiresShift: boolean
  requiresCmd: boolean
  requiresAlt: boolean
  key: string
}

const parseModeToken = (token: string): InputMode | null => {
  const normalizedToken = token.trim().toLowerCase()
  if (normalizedToken === '[p]') return 'pitch'
  if (normalizedToken === '[v]') return 'velocity'
  if (normalizedToken === '[d]') return 'delay'
  if (normalizedToken === '[g]') return 'gate'
  if (normalizedToken === '[c]') return 'scale'
  return null
}

const normalizeKeyToken = (token: string): string => {
  const trimmed = token.trim()
  if (trimmed.toLowerCase() === 'plus') {
    return '+'
  }
  return trimmed.toLowerCase()
}

const parseKeyBinding = (binding: string): ParsedKeyBinding | null => {
  const tokens = binding
    .split('+')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)

  if (tokens.length === 0) {
    return null
  }

  let requiredMode: InputMode | null = null
  let requiresShift = false
  let requiresCmd = false
  let requiresAlt = false
  let key = ''

  for (const token of tokens) {
    const lowerToken = token.toLowerCase()
    const mode = parseModeToken(token)
    if (mode) {
      requiredMode = mode
      continue
    }

    if (lowerToken === 'shift') {
      requiresShift = true
      continue
    }

    if (lowerToken === 'cmd') {
      requiresCmd = true
      continue
    }

    if (lowerToken === 'alt') {
      requiresAlt = true
      continue
    }

    key = normalizeKeyToken(token)
  }

  if (!key) {
    return null
  }

  return {
    requiredMode,
    requiresShift,
    requiresCmd,
    requiresAlt,
    key,
  }
}

const getEventKeyAliases = (event: KeyboardEvent): Set<string> => {
  const aliases = new Set<string>()
  const key = event.key
  const lower = key.toLowerCase()
  aliases.add(lower)

  if (key === '+') {
    aliases.add('+')
  }
  if (key === '=' && event.shiftKey) {
    aliases.add('+')
  }

  if (lower === 'escape') aliases.add('escape')
  if (lower === 'arrowleft') aliases.add('arrowleft')
  if (lower === 'arrowright') aliases.add('arrowright')
  if (lower === 'arrowup') aliases.add('arrowup')
  if (lower === 'arrowdown') aliases.add('arrowdown')
  if (lower === 'delete') aliases.add('delete')
  if (lower === 'pagedown') aliases.add('pagedown')
  if (lower === 'pageup') aliases.add('pageup')
  if (lower === 'tab') aliases.add('tab')

  return aliases
}

const matchesBinding = (
  parsedBinding: ParsedKeyBinding,
  event: KeyboardEvent,
  inputMode: InputMode
): boolean => {
  if (parsedBinding.requiredMode && parsedBinding.requiredMode !== inputMode) {
    return false
  }

  const commandModifier = event.metaKey || event.ctrlKey
  if (parsedBinding.requiresCmd !== commandModifier) {
    return false
  }

  if (parsedBinding.requiresShift !== event.shiftKey) {
    return false
  }

  if (parsedBinding.requiresAlt !== event.altKey) {
    return false
  }

  const aliases = getEventKeyAliases(event)
  return aliases.has(parsedBinding.key)
}

const applyNumberParameter = (command: string, pendingDigits: string): string => {
  const hasPendingNumber = pendingDigits.length > 0
  return command.replace(/:N=(\d+):/g, (_, defaultValue: string) =>
    hasPendingNumber ? pendingDigits : defaultValue
  )
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName
  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  )
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

const toNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is number => typeof item === 'number')
}

const normalizePitch = (pitch: number, tuningLength: number): number => {
  const modulo = pitch % tuningLength
  return modulo >= 0 ? modulo : modulo + tuningLength
}

const parseCell = (value: unknown): Cell | null => {
  const cell = asRecord(value)
  if (!cell || typeof cell.type !== 'string' || typeof cell.weight !== 'number') {
    return null
  }

  if (
    cell.type === 'Note' &&
    typeof cell.pitch === 'number' &&
    typeof cell.velocity === 'number' &&
    typeof cell.delay === 'number' &&
    typeof cell.gate === 'number'
  ) {
    return {
      type: 'Note',
      weight: cell.weight,
      pitch: cell.pitch,
      velocity: cell.velocity,
      delay: cell.delay,
      gate: cell.gate,
    }
  }

  if (cell.type === 'Rest') {
    return {
      type: 'Rest',
      weight: cell.weight,
    }
  }

  if (cell.type === 'Sequence' && Array.isArray(cell.cells)) {
    return {
      type: 'Sequence',
      weight: cell.weight,
      cells: cell.cells.map(parseCell).filter((item): item is Cell => item !== null),
    }
  }

  return null
}

const parseMeasure = (value: unknown): Measure | null => {
  const measure = asRecord(value)
  if (!measure) {
    return null
  }

  const cell = parseCell(measure.cell)
  const timeSignature = asRecord(measure.time_signature)
  if (
    !cell ||
    !timeSignature ||
    typeof timeSignature.numerator !== 'number' ||
    typeof timeSignature.denominator !== 'number'
  ) {
    return null
  }

  return {
    cell,
    time_signature: {
      numerator: timeSignature.numerator,
      denominator: timeSignature.denominator,
    },
  }
}

const parseScale = (value: unknown): Scale | null => {
  if (value === null) {
    return null
  }

  const scale = asRecord(value)
  if (
    !scale ||
    typeof scale.name !== 'string' ||
    typeof scale.tuning_length !== 'number' ||
    typeof scale.mode !== 'number'
  ) {
    return null
  }

  return {
    name: scale.name,
    tuning_length: scale.tuning_length,
    intervals: toNumberArray(scale.intervals),
    mode: scale.mode,
  }
}

const parseUiStateSnapshot = (value: unknown): UiStateSnapshot | null => {
  const snapshot = asRecord(value)
  if (!snapshot || typeof snapshot.snapshot_version !== 'number') {
    return null
  }

  const engine = asRecord(snapshot.engine)
  const editor = asRecord(snapshot.editor)
  if (!engine || !editor) {
    return null
  }

  const tuning = asRecord(engine.tuning)
  const selected = asRecord(editor.selected)
  if (
    !tuning ||
    !selected ||
    typeof tuning.octave !== 'number' ||
    typeof engine.tuning_name !== 'string' ||
    typeof engine.key !== 'number' ||
    typeof engine.base_frequency !== 'number' ||
    (engine.scale_translate_direction !== 'up' && engine.scale_translate_direction !== 'down') ||
    typeof editor.input_mode !== 'string' ||
    typeof selected.measure !== 'number'
  ) {
    return null
  }

  const inputMode = editor.input_mode
  if (
    inputMode !== 'pitch' &&
    inputMode !== 'velocity' &&
    inputMode !== 'delay' &&
    inputMode !== 'gate' &&
    inputMode !== 'scale'
  ) {
    return null
  }

  const sequenceBank = Array.isArray(engine.sequence_bank)
    ? engine.sequence_bank.map(parseMeasure).filter((item): item is Measure => item !== null)
    : []

  const sequenceNames = Array.isArray(engine.sequence_names)
    ? engine.sequence_names.filter((item): item is string => typeof item === 'string')
    : []

  const scale = parseScale(engine.scale)
  const selectedCellPath = Array.isArray(selected.cell)
    ? selected.cell.filter((item): item is number => typeof item === 'number')
    : []

  return {
    snapshot_version: snapshot.snapshot_version,
    engine: {
      sequence_bank: sequenceBank,
      sequence_names: sequenceNames,
      tuning: {
        intervals: toNumberArray(tuning.intervals),
        octave: tuning.octave,
      },
      tuning_name: engine.tuning_name,
      scale,
      key: engine.key,
      scale_translate_direction: engine.scale_translate_direction,
      base_frequency: engine.base_frequency,
    },
    editor: {
      selected: {
        measure: selected.measure,
        cell: selectedCellPath,
      },
      input_mode: inputMode,
    },
  }
}

const getTuningRatios = (intervals: number[]): number[] =>
  Array.from(new Set(intervals.map((cents) => cents / 1200))).sort((a, b) => a - b)

const getLargestElement = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }

  return values[values.length - 1]
}

const euclidMod = (value: number, modulo: number): number => {
  if (modulo === 0) {
    return 0
  }
  return ((value % modulo) + modulo) % modulo
}

const generateValidPitches = (scale: Scale, tuningLength: number): number[] => {
  if (scale.intervals.length === 0) {
    return [0]
  }

  const modeOffset = euclidMod(Math.trunc(scale.mode) - 1, scale.intervals.length)
  const rotatedIntervals = scale.intervals.map((_, index) => {
    const intervalIndex = euclidMod(index + modeOffset, scale.intervals.length)
    return Math.trunc(scale.intervals[intervalIndex] ?? 0)
  })

  const validPitches = [0]
  for (const interval of rotatedIntervals) {
    const nextPitch = validPitches[validPitches.length - 1] + interval
    if (nextPitch < tuningLength) {
      validPitches.push(nextPitch)
    }
  }

  return Array.from(new Set(validPitches)).sort((a, b) => a - b)
}

const mapPitchToScale = (
  pitch: number,
  validPitches: number[],
  tuningLength: number,
  direction: TranslateDirection
): number => {
  if (validPitches.length === 0 || tuningLength <= 0) {
    return pitch
  }

  let octaveShift = Math.floor(pitch / tuningLength)
  const normalizedPitch = euclidMod(pitch, tuningLength)
  let index = validPitches.findIndex((validPitch) => validPitch >= normalizedPitch)

  if (index === -1 || validPitches[index] !== normalizedPitch) {
    if (direction === 'down') {
      if (index <= 0) {
        index = validPitches.length - 1
        octaveShift -= 1
      } else {
        index -= 1
      }
    } else if (index === -1) {
      index = 0
      octaveShift += 1
    }
  }

  return (validPitches[index] ?? normalizedPitch) + octaveShift * tuningLength
}

const collectNotePitches = (cell: Cell): number[] => {
  if (cell.type === 'Note') {
    return [cell.pitch]
  }

  if (cell.type === 'Sequence') {
    return cell.cells.flatMap(collectNotePitches)
  }

  return []
}

const getCellWeight = (weight: number): number => (weight > 0 ? weight : 1)

type LeafCell = {
  weight: number
  note:
    | {
        pitch: number
        velocity: number
        delay: number
        gate: number
      }
    | null
}

const flattenLeafCells = (cells: Cell[], tuningLength: number): LeafCell[] => {
  const result: LeafCell[] = []

  const walk = (cell: Cell, parentWeight: number): void => {
    const accumulatedWeight = parentWeight * getCellWeight(cell.weight)

    if (cell.type === 'Sequence') {
      if (cell.cells.length === 0) {
        result.push({ weight: accumulatedWeight, note: null })
        return
      }

      for (const nestedCell of cell.cells) {
        walk(nestedCell, accumulatedWeight)
      }
      return
    }

    if (cell.type === 'Note') {
      const normalizedVelocity = Math.min(Math.max(cell.velocity, 0), 1)
      const normalizedDelay = Math.min(Math.max(cell.delay, 0), 1)
      const normalizedGate = Math.min(Math.max(cell.gate, 0), 1)

      result.push({
        weight: accumulatedWeight,
        note: {
          pitch: normalizePitch(cell.pitch, tuningLength),
          velocity: normalizedVelocity,
          delay: normalizedDelay,
          gate: normalizedGate,
        },
      })
      return
    }

    result.push({ weight: accumulatedWeight, note: null })
  }

  for (const cell of cells) {
    walk(cell, 1)
  }

  return result
}

const getSelectedMeasure = (snapshot: UiStateSnapshot): Measure | null => {
  const sequenceBank = snapshot.engine.sequence_bank
  if (sequenceBank.length === 0) {
    return null
  }

  const selectedIndex = Math.max(
    0,
    Math.min(snapshot.editor.selected.measure, sequenceBank.length - 1)
  )
  return sequenceBank[selectedIndex] ?? null
}

function App() {
  const [currentInputMode, setCurrentInputMode] = useState<InputMode>('pitch')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusLevel, setStatusLevel] = useState<MessageLevel>('info')
  const [bridgeUnavailableMessage, setBridgeUnavailableMessage] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<UiStateSnapshot | null>(null)
  const [isCommandMode, setIsCommandMode] = useState(false)
  const [commandText, setCommandText] = useState('')
  const [commandSuffix, setCommandSuffix] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [sequenceViewKeymap, setSequenceViewKeymap] = useState<SequenceViewKeymap>({})
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const eventTokenRef = useRef<unknown>(null)
  const commandInputRef = useRef<HTMLInputElement>(null)
  const liveCommandBufferRef = useRef('')
  const lastSnapshotVersionRef = useRef<number>(-1)
  const completionRequestVersionRef = useRef(0)
  const pendingNumberRef = useRef('')

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

  const applySnapshot = useCallback((rawSnapshot: unknown): number | null => {
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
  }, [])

  const executeBackendCommand = useCallback(
    async (command: string): Promise<void> => {
      const response = await sendBridgeRequest('command.execute', { command })
      const payloadError = getPayloadError(response.payload)
      if (payloadError) {
        throw new Error(payloadError)
      }

      const commandSnapshot = getCommandSnapshot(response.payload)
      const commandSnapshotVersion = applySnapshot(commandSnapshot)
      const commandStatus = getCommandStatus(response.payload)

      if (commandStatus) {
        setStatusMessage(commandStatus.message)
        setStatusLevel(commandStatus.level)
      } else if (commandSnapshotVersion !== null) {
        setStatusMessage(`Command applied (snapshot ${commandSnapshotVersion})`)
        setStatusLevel('info')
      } else {
        setStatusMessage(`Command applied: ${command}`)
        setStatusLevel('info')
      }
    },
    [applySnapshot, sendBridgeRequest]
  )

  const openCommandMode = useCallback((): void => {
    liveCommandBufferRef.current = commandText
    setHistoryIndex(-1)
    setIsCommandMode(true)
  }, [commandText])

  const closeCommandMode = useCallback(
    (options?: { preserveText?: boolean }): void => {
      setIsCommandMode(false)
      setHistoryIndex(-1)
      if (!options?.preserveText) {
        setCommandText('')
        liveCommandBufferRef.current = ''
      }
    },
    []
  )

  useEffect(() => {
    let isMounted = true

    const connect = async (): Promise<void> => {
      try {
        eventTokenRef.current = addXenBridgeListener((rawEvent) => {
          try {
            const eventEnvelope = parseWireEnvelope(rawEvent)
            if (eventEnvelope.name !== 'state.changed') {
              return
            }

            applySnapshot(eventEnvelope.payload)
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

        const welcomeResponse = await sendBridgeRequest('command.execute', { command: 'welcome' })
        const welcomeError = getPayloadError(welcomeResponse.payload)
        if (welcomeError) {
          throw new Error(welcomeError)
        }

        const welcomeSnapshot = getCommandSnapshot(welcomeResponse.payload)
        const welcomeSnapshotVersion = applySnapshot(welcomeSnapshot)
        const welcomeStatus = getCommandStatus(welcomeResponse.payload)

        if (isMounted) {
          if (welcomeStatus) {
            setStatusMessage(welcomeStatus.message)
            setStatusLevel(welcomeStatus.level)
          } else if (welcomeSnapshotVersion !== null) {
            setStatusMessage(`Command applied (snapshot ${welcomeSnapshotVersion})`)
            setStatusLevel('info')
          } else {
            setStatusMessage('Command applied: welcome')
            setStatusLevel('info')
          }
        }
      } catch (error) {
        if (isMounted) {
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
  }, [applySnapshot, sendBridgeRequest])

  useEffect(() => {
    if (!isCommandMode) {
      setCommandSuffix('')
      return
    }

    const input = commandInputRef.current
    if (!input) {
      return
    }

    input.focus()
    const textLength = input.value.length
    input.setSelectionRange(textLength, textLength)
  }, [isCommandMode])

  useEffect(() => {
    if (!isCommandMode || bridgeUnavailableMessage !== null) {
      setCommandSuffix('')
      return
    }

    const currentVersion = completionRequestVersionRef.current + 1
    completionRequestVersionRef.current = currentVersion

    const loadSuffix = async (): Promise<void> => {
      try {
        const completionResponse = await sendBridgeRequest('command.completeText', {
          partial: commandText,
        })
        const payloadError = getPayloadError(completionResponse.payload)
        if (payloadError) {
          throw new Error(payloadError)
        }

        const suffix = getCommandSuffix(completionResponse.payload) ?? ''
        if (completionRequestVersionRef.current === currentVersion) {
          setCommandSuffix(suffix)
        }
      } catch {
        if (completionRequestVersionRef.current === currentVersion) {
          setCommandSuffix('')
        }
      }
    }

    void loadSuffix()
  }, [bridgeUnavailableMessage, commandText, isCommandMode, sendBridgeRequest])

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent): void => {
      if (bridgeUnavailableMessage !== null) {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      const isDigitKey =
        event.key.length === 1 &&
        event.key >= '0' &&
        event.key <= '9' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey

      if (!isCommandMode && isDigitKey) {
        pendingNumberRef.current = `${pendingNumberRef.current}${event.key}`
        event.preventDefault()
        return
      }

      const matchedBinding = Object.entries(sequenceViewKeymap).find(([binding]) => {
        const parsedBinding = parseKeyBinding(binding)
        if (!parsedBinding) {
          return false
        }

        return matchesBinding(parsedBinding, event, currentInputMode)
      })

      if (matchedBinding) {
        event.preventDefault()
        const command = applyNumberParameter(matchedBinding[1], pendingNumberRef.current)
        pendingNumberRef.current = ''
        void executeBackendCommand(command).catch((error: unknown) => {
          setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
          setStatusLevel('error')
        })
        return
      }

      if (!isDigitKey) {
        pendingNumberRef.current = ''
      }

      if (isCommandMode) {
        return
      }

      if (event.key === ':' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        openCommandMode()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    bridgeUnavailableMessage,
    currentInputMode,
    executeBackendCommand,
    isCommandMode,
    openCommandMode,
    sequenceViewKeymap,
  ])

  const submitCommand = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault()

      const command = commandText.trim()
      if (!command) {
        closeCommandMode({ preserveText: true })
        return
      }

      setCommandHistory((previous) => [command, ...previous].slice(0, MAX_COMMAND_HISTORY))
      setHistoryIndex(-1)
      liveCommandBufferRef.current = ''

      let shouldClearCommandText = false

      try {
        await executeBackendCommand(command)

        shouldClearCommandText = true
      } catch (error) {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      } finally {
        closeCommandMode({ preserveText: !shouldClearCommandText })
      }
    },
    [closeCommandMode, commandText, executeBackendCommand]
  )

  const {
    tuningLength,
    selectedMeasureIndex,
    selectedMeasureName,
    timeSignature,
    scaleName,
    scaleMode,
    tuningName,
    keyDisplay,
    baseFrequency,
    staffLineBandByPitch,
    leafCells,
    rulerRatios,
    highlightedPitches,
  } = useMemo(() => {
    if (!snapshot) {
      const defaultStaffLineBand = Array.from(
        { length: DEFAULT_TUNING_LENGTH },
        (_, pitch) => (pitch % 2 === 0 ? 0 : 1)
      )
      return {
        tuningLength: DEFAULT_TUNING_LENGTH,
        selectedMeasureIndex: 0,
        selectedMeasureName: 'Init Test',
        timeSignature: '4/4',
        scaleName: 'major diatonic',
        scaleMode: 3,
        tuningName: '12EDO',
        keyDisplay: 2,
        baseFrequency: 440,
        staffLineBandByPitch: defaultStaffLineBand,
        leafCells: [] as LeafCell[],
        rulerRatios: getTuningRatios(Array.from({ length: DEFAULT_TUNING_LENGTH }, (_, i) => i * 100)),
        highlightedPitches: new Set<number>(),
      }
    }

    const rawTuningLength = snapshot.engine.tuning.intervals.length
    const derivedTuningLength = rawTuningLength > 0 ? rawTuningLength : DEFAULT_TUNING_LENGTH
    const selectedMeasure = getSelectedMeasure(snapshot)
    const selectedIndex = Math.max(
      0,
      Math.min(snapshot.editor.selected.measure, snapshot.engine.sequence_bank.length - 1)
    )
    const sequenceName = snapshot.engine.sequence_names[selectedIndex] ?? `Sequence ${selectedIndex}`
    const scaleValidPitches = snapshot.engine.scale
      ? generateValidPitches(snapshot.engine.scale, derivedTuningLength)
      : []
    const translateDirection = snapshot.engine.scale_translate_direction

    const mapPitch = (pitch: number): number =>
      mapPitchToScale(pitch, scaleValidPitches, derivedTuningLength, translateDirection)

    const selectedCell = selectedMeasure?.cell ?? null
    const directCells =
      selectedCell?.type === 'Sequence' ? selectedCell.cells : selectedCell ? [selectedCell] : []

    const allMeasurePitches = selectedCell ? collectNotePitches(selectedCell) : []
    const mappedHighlights = new Set(
      allMeasurePitches.map((pitch) =>
        normalizePitch(mapPitch(normalizePitch(pitch, derivedTuningLength)), derivedTuningLength)
      )
    )

    const tuningRatios = getTuningRatios(snapshot.engine.tuning.intervals)
    const rowMap = Array.from({ length: derivedTuningLength }, (_, pitch) => mapPitch(pitch))
    const hasScale = snapshot.engine.scale !== null
    const staffLineBands: number[] = []

    if (hasScale) {
      let currentBand = 0
      let previousMappedPitch = 0

      for (let pitch = 0; pitch < derivedTuningLength; pitch += 1) {
        const mappedPitch = rowMap[pitch] ?? pitch
        if (mappedPitch !== previousMappedPitch) {
          currentBand = currentBand === 0 ? 1 : 0
        }
        staffLineBands.push(currentBand)
        previousMappedPitch = mappedPitch
      }
    } else {
      for (let pitch = 0; pitch < derivedTuningLength; pitch += 1) {
        staffLineBands.push(pitch % 2 === 0 ? 0 : 1)
      }
    }

    const signature = selectedMeasure?.time_signature
      ? `${selectedMeasure.time_signature.numerator}/${selectedMeasure.time_signature.denominator}`
      : '4/4'

    return {
      tuningLength: derivedTuningLength,
      selectedMeasureIndex: selectedIndex,
      selectedMeasureName: sequenceName,
      timeSignature: signature,
      scaleName: snapshot.engine.scale?.name ?? 'none',
      scaleMode: snapshot.engine.scale?.mode ?? 0,
      tuningName: snapshot.engine.tuning_name,
      keyDisplay: snapshot.engine.key,
      baseFrequency: snapshot.engine.base_frequency,
      staffLineBandByPitch: staffLineBands,
      leafCells: flattenLeafCells(directCells, derivedTuningLength),
      rulerRatios: tuningRatios,
      highlightedPitches: mappedHighlights,
    }
  }, [snapshot])

  const pitchRows = useMemo(
    () => Array.from({ length: tuningLength }, (_, index) => tuningLength - 1 - index),
    [tuningLength]
  )

  const referenceMax = getLargestElement(REFERENCE_RATIOS)
  const rulerOffset = (1 - referenceMax) / 2

  const ratioToBottom = useCallback(
    (ratio: number): number => {
      let bottom = ratio + rulerOffset
      while (bottom > 1) {
        bottom -= 1
      }
      while (bottom < 0) {
        bottom += 1
      }
      return bottom * 100
    },
    [rulerOffset]
  )

  const currentInputModeLetter = currentInputMode.charAt(0).toUpperCase()
  return (
    <div className="app">
      <header className="header">
        <div className="headerGroup">
          <div className="headerGrid">
            <div className="headerField">
              <span className="fieldLabel">Time Signature</span>
              <span className="fieldValue mono">{timeSignature}</span>
            </div>
            <div className="headerField">
              <span className="fieldLabel">Key</span>
              <span className="fieldValue mono">{keyDisplay}</span>
            </div>
            <div className="headerField">
              <span className="fieldLabel">Zero Freq. (Hz)</span>
              <span className="fieldValue mono">{baseFrequency}</span>
            </div>
          </div>
        </div>
        <div className="headerGroup">
          <div className="headerGrid">
            <div className="headerField">
              <span className="fieldLabel">Scale</span>
              <span className="fieldValue">{scaleName}</span>
            </div>
            <div className="headerField">
              <span className="fieldLabel">Mode</span>
              <span className="fieldValue mono">{scaleMode}</span>
            </div>
            <div className="headerField">
              <span className="fieldLabel">Tuning</span>
              <span className="fieldValue mono">{tuningName}</span>
            </div>
          </div>
        </div>
        <div className="headerGroup">
          <div className="headerGrid">
            <div className="headerField">
              <span className="fieldLabel">Sequence Index</span>
              <span className="fieldValue mono">{selectedMeasureIndex}</span>
            </div>
            <div className="headerField">
              <span className="fieldLabel">Sequence Name</span>
              <span className="fieldValue">{selectedMeasureName}</span>
            </div>
          </div>
        </div>
      </header>
      <main className="sequencer">
        {bridgeUnavailableMessage ? (
          <section className="bridgeNotice" aria-live="polite">
            <h1 className="bridgeNoticeTitle">JUCE native bridge not detected</h1>
            <p className="bridgeNoticeBody">{bridgeUnavailableMessage}</p>
            <p className="bridgeNoticeHint">
              Run this frontend inside the JUCE WebView host to enable backend requests and events.
            </p>
          </section>
        ) : (
          <section className="sequencerShell" aria-label="Single octave sequencer view">
            <aside className="pitchIndexBar" aria-label="Pitch index">
              {pitchRows.map((pitch) => (
                <div key={`left-pitch-${pitch}`} className="pitchIndexRow mono">
                  {pitch}
                </div>
              ))}
            </aside>

            <div className="pianoRoll" role="img" aria-label="Single octave piano roll">
              <div className="rollIslands" aria-hidden="true">
                {(leafCells.length > 0 ? leafCells : [{ weight: 1, note: null }]).map(
                  (leafCell, index) => (
                  <div
                    key={`roll-island-${index}`}
                    className="rollIsland"
                    style={
                      {
                        flexGrow: leafCell.weight,
                        flexBasis: 0,
                      } as CSSProperties
                    }
                  >
                    <div className="rollIslandGrid">
                      {pitchRows.map((pitch) => (
                        <div
                          key={`roll-island-${index}-row-${pitch}`}
                          className={`rollRow ${(staffLineBandByPitch[pitch] ?? 0) === 0 ? 'rollRow-bandEven' : 'rollRow-bandOdd'}`}
                        >
                          <div className="rollRowLine" aria-hidden="true" />
                          {leafCell.note?.pitch === pitch ? (
                            <div
                              className={`rollNote${leafCell.note.delay > 0 ? ' rollNote-hasDelay' : ''}${leafCell.note.gate < 1 ? ' rollNote-shortGate' : ''}`}
                              style={
                                {
                                  left: `${leafCell.note.delay * 100}%`,
                                  width: `max(${(1 - leafCell.note.delay) * leafCell.note.gate * 100}%, 4px)`,
                                  background: `rgb(220 136 122 / ${0.04 + leafCell.note.velocity * 0.9})`,
                                } as CSSProperties
                              }
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )
                )}
              </div>
            </div>

            <aside className="tuningRuler" aria-label="Tuning ruler">
              <div className="tuningRulerLine" />
              {REFERENCE_RATIOS.map((ratio, index) => (
                <span
                  key={`reference-mark-${index}`}
                  className="rulerMark rulerMark-reference"
                  style={{ bottom: `${ratioToBottom(ratio)}%` }}
                />
              ))}
              {rulerRatios.map((ratio, index) => (
                <span
                  key={`tuning-mark-${index}`}
                  className={`rulerMark rulerMark-tuning${highlightedPitches.has(index) ? ' rulerMark-active' : ''}`}
                  style={{ bottom: `${ratioToBottom(ratio)}%` }}
                />
              ))}
            </aside>
          </section>
        )}
      </main>
      <footer className="statusBar">
        <div className="statusLeft">
          <span className="modeBadge mono" aria-label={`Input mode ${currentInputMode}`}>
            {currentInputModeLetter}
          </span>
        </div>
        {isCommandMode ? (
          <form className="statusCommandForm" onSubmit={submitCommand}>
            <span className="statusPrompt mono">:</span>
            <div className="statusCommandField">
              <input
                ref={commandInputRef}
                className="statusCommandInput mono"
                type="text"
                value={commandText}
                size={Math.max(1, commandText.length)}
                onChange={(event) => {
                  const nextValue = event.target.value
                  if (historyIndex !== -1) {
                    setHistoryIndex(-1)
                  }
                  setCommandText(nextValue)
                  liveCommandBufferRef.current = nextValue
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Tab') {
                    event.preventDefault()

                    if (!commandSuffix) {
                      return
                    }

                    const completedCore = `${commandText}${commandSuffix}`
                    const completedText = completedCore.endsWith(' ')
                      ? completedCore
                      : `${completedCore} `
                    if (historyIndex !== -1) {
                      setHistoryIndex(-1)
                    }
                    setCommandText(completedText)
                    liveCommandBufferRef.current = completedText
                    return
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeCommandMode({ preserveText: true })
                    return
                  }

                  if (event.key === 'ArrowUp') {
                    if (commandHistory.length === 0) {
                      return
                    }

                    event.preventDefault()

                    if (historyIndex === -1) {
                      liveCommandBufferRef.current = commandText
                      setHistoryIndex(0)
                      setCommandText(commandHistory[0])
                      return
                    }

                    const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
                    setHistoryIndex(nextIndex)
                    setCommandText(commandHistory[nextIndex])
                    return
                  }

                  if (event.key === 'ArrowDown') {
                    if (commandHistory.length === 0 || historyIndex === -1) {
                      return
                    }

                    event.preventDefault()

                    if (historyIndex === 0) {
                      setHistoryIndex(-1)
                      setCommandText(liveCommandBufferRef.current)
                      return
                    }

                    const nextIndex = historyIndex - 1
                    setHistoryIndex(nextIndex)
                    setCommandText(commandHistory[nextIndex])
                  }
                }}
                onBlur={() => closeCommandMode({ preserveText: true })}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                aria-label="Command input"
              />
              {commandSuffix ? <span className="statusCommandGhost mono">{commandSuffix}</span> : null}
            </div>
          </form>
        ) : (
          <span className={`statusText status-${statusLevel}`}>{statusMessage}</span>
        )}
      </footer>
    </div>
  )
}

export default App
