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
const TRANSPORT_SEQUENCE_COUNT = 16
const DEFAULT_TRANSPORT_BPM = 120

type MessageLevel = 'debug' | 'info' | 'warning' | 'error'
type TranslateDirection = 'up' | 'down'
type InputMode = 'pitch' | 'velocity' | 'delay' | 'gate' | 'scale'

type EnvelopePayload = Record<string, unknown>
type SequenceViewKeymap = Record<string, string>
type PatternPrefix = {
  offset: number
  intervals: number[]
}

type CommandReferenceEntry = {
  id: string
  signature: string
  description: string
}

type KeybindingReferenceEntry = {
  key: string
  command: string
}

type KeybindingReferenceGroup = {
  component: string
  bindings: KeybindingReferenceEntry[]
}

type SessionReference = {
  commands: CommandReferenceEntry[]
  keybindings: KeybindingReferenceGroup[]
}

type LibraryCommandEntry = {
  name: string
  stem: string
  path: string
  command: string
}

type LibraryScaleEntry = {
  name: string
  command: string
}

type LibraryHierarchyRow = {
  kind: 'directory' | 'file'
  key: string
  label: string
  depth: number
  entry?: LibraryCommandEntry
}

type LibrarySnapshot = {
  paths: {
    library: string
    sequences: string
    tunings: string
  }
  sequenceBanks: LibraryCommandEntry[]
  tunings: LibraryCommandEntry[]
  scales: LibraryScaleEntry[]
  commands: {
    reloadScales: string
    reloadChords: string
    libraryDirectory: string
  }
  active: {
    tuningName: string
    scaleName: string | null
  }
}

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

type TransportState = {
  active: boolean[]
  phase: number[]
  bpm: number
}

type ModTarget = 'pitch' | 'velocity' | 'delay' | 'gate' | 'weights'
type WaveType = 'sine' | 'triangle' | 'sawtooth_up' | 'sawtooth_down' | 'square'

type ConstantModulator = {
  type: 'constant'
  value: number
}

type OscillatorModulator = {
  type: 'sine' | 'triangle' | 'sawtooth_up' | 'sawtooth_down'
  frequency: number
  amplitude: number
  phase: number
}

type SquareModulator = {
  type: 'square'
  frequency: number
  amplitude: number
  phase: number
  pulse_width: number
}

type ScaleModulator = {
  type: 'scale'
  factor: number
}

type BiasModulator = {
  type: 'bias'
  amount: number
}

type ClampModulator = {
  type: 'clamp'
  min: number
  max: number
}

type ChainModulator = {
  type: 'chain'
  children: Modulator[]
}

type BlendModulator = {
  type: 'blend'
  children: Modulator[]
}

type Modulator =
  | ConstantModulator
  | OscillatorModulator
  | SquareModulator
  | ScaleModulator
  | BiasModulator
  | ClampModulator
  | ChainModulator
  | BlendModulator

type ModTargetSpec = {
  label: string
  min: number
  max: number
  defaultCenter: number
  defaultScalar: number
  step: number
  integer: boolean
}

type TargetControl = {
  enabled: boolean
  useScalar: boolean
  center: number
  amount: number
  scalar: number
}

type ModulatorPanelState = {
  waveAType: WaveType
  waveBType: WaveType
  waveAPulseWidth: number
  waveBPulseWidth: number
  waveLerp: number
  lfoAFrequency: number
  lfoAPhaseOffset: number
  lfoBFrequency: number
  lfoBPhaseOffset: number
  targetControls: Record<ModTarget, TargetControl>
}

const MOD_TARGET_SPECS: Record<ModTarget, ModTargetSpec> = {
  pitch: {
    label: 'Pitch',
    min: -24,
    max: 24,
    defaultCenter: 0,
    defaultScalar: 0,
    step: 1,
    integer: true,
  },
  velocity: {
    label: 'Velocity',
    min: 0,
    max: 1,
    defaultCenter: 0.5,
    defaultScalar: 0.787402,
    step: 0.01,
    integer: false,
  },
  delay: {
    label: 'Delay',
    min: 0,
    max: 1,
    defaultCenter: 0.5,
    defaultScalar: 0,
    step: 0.01,
    integer: false,
  },
  gate: {
    label: 'Gate',
    min: 0,
    max: 1,
    defaultCenter: 0.5,
    defaultScalar: 1,
    step: 0.01,
    integer: false,
  },
  weights: {
    label: 'Weights',
    min: 0,
    max: 1,
    defaultCenter: 0.5,
    defaultScalar: 0.5,
    step: 0.01,
    integer: false,
  },
}

const MOD_TARGET_ORDER: ModTarget[] = ['pitch', 'velocity', 'delay', 'gate', 'weights']
const WAVE_OPTIONS: WaveType[] = ['sine', 'triangle', 'sawtooth_up', 'sawtooth_down', 'square']
const WAVE_OPTION_LABELS: Record<WaveType, string> = {
  sine: 'Sine',
  triangle: 'Triangle',
  sawtooth_up: 'Saw Up',
  sawtooth_down: 'Saw Down',
  square: 'Square',
}
const LFO_FREQUENCY_RANGE_RATIO = 1000
const LFO_FREQUENCY_MIN = 1 / Math.sqrt(LFO_FREQUENCY_RANGE_RATIO)
const LFO_FREQUENCY_MAX = Math.sqrt(LFO_FREQUENCY_RANGE_RATIO)
const LFO_PHASE_OFFSET_MIN = -0.5
const LFO_PHASE_OFFSET_MAX = 0.5

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const roundByStep = (value: number, step: number): number =>
  step <= 0 ? value : Math.round(value / step) * step

const toNormalizedPhase = (phaseOffset: number): number =>
  ((phaseOffset % 1) + 1) % 1

const frequencyToRatio = (frequency: number): number => {
  const clamped = clampNumber(frequency, LFO_FREQUENCY_MIN, LFO_FREQUENCY_MAX)
  const span = Math.log(LFO_FREQUENCY_MAX / LFO_FREQUENCY_MIN)
  if (span <= 0) {
    return 0
  }
  return clampNumber(Math.log(clamped / LFO_FREQUENCY_MIN) / span, 0, 1)
}

const ratioToFrequency = (ratio: number): number => {
  const clampedRatio = clampNumber(ratio, 0, 1)
  const base = LFO_FREQUENCY_MAX / LFO_FREQUENCY_MIN
  if (base <= 0) {
    return LFO_FREQUENCY_MIN
  }
  return LFO_FREQUENCY_MIN * Math.pow(base, clampedRatio)
}

const createInitialTargetControls = (): Record<ModTarget, TargetControl> => ({
  pitch: {
    enabled: false,
    useScalar: false,
    center: MOD_TARGET_SPECS.pitch.defaultCenter,
    amount: 0,
    scalar: MOD_TARGET_SPECS.pitch.defaultScalar,
  },
  velocity: {
    enabled: false,
    useScalar: false,
    center: MOD_TARGET_SPECS.velocity.defaultCenter,
    amount: 0,
    scalar: MOD_TARGET_SPECS.velocity.defaultScalar,
  },
  delay: {
    enabled: false,
    useScalar: false,
    center: MOD_TARGET_SPECS.delay.defaultCenter,
    amount: 0,
    scalar: MOD_TARGET_SPECS.delay.defaultScalar,
  },
  gate: {
    enabled: false,
    useScalar: false,
    center: MOD_TARGET_SPECS.gate.defaultCenter,
    amount: 0,
    scalar: MOD_TARGET_SPECS.gate.defaultScalar,
  },
  weights: {
    enabled: false,
    useScalar: false,
    center: MOD_TARGET_SPECS.weights.defaultCenter,
    amount: 0,
    scalar: MOD_TARGET_SPECS.weights.defaultScalar,
  },
})

const createInitialModulatorPanelState = (): ModulatorPanelState => ({
  waveAType: 'sine',
  waveBType: 'triangle',
  waveAPulseWidth: 0.5,
  waveBPulseWidth: 0.5,
  waveLerp: 0,
  lfoAFrequency: 1,
  lfoAPhaseOffset: 0,
  lfoBFrequency: 1,
  lfoBPhaseOffset: 0,
  targetControls: createInitialTargetControls(),
})

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

const createTransportState = (): TransportState => ({
  active: Array(TRANSPORT_SEQUENCE_COUNT).fill(false),
  phase: Array(TRANSPORT_SEQUENCE_COUNT).fill(0),
  bpm: DEFAULT_TRANSPORT_BPM,
})

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

const getSessionReference = (payload: EnvelopePayload): SessionReference => {
  const root = asRecord(payload.reference)
  if (!root) {
    return { commands: [], keybindings: [] }
  }

  const rawCommands = Array.isArray(root.commands) ? root.commands : []
  const commands = rawCommands
    .map((value) => {
      const record = asRecord(value)
      if (!record) {
        return null
      }
      if (
        typeof record.id !== 'string' ||
        typeof record.signature !== 'string' ||
        typeof record.description !== 'string'
      ) {
        return null
      }
      return {
        id: record.id,
        signature: record.signature,
        description: record.description,
      } satisfies CommandReferenceEntry
    })
    .filter((entry): entry is CommandReferenceEntry => entry !== null)

  const rawKeybindingGroups = Array.isArray(root.keybindings) ? root.keybindings : []
  const keybindings = rawKeybindingGroups
    .map((groupValue) => {
      const group = asRecord(groupValue)
      if (!group || typeof group.component !== 'string') {
        return null
      }

      const rawBindings = Array.isArray(group.bindings) ? group.bindings : []
      const bindings = rawBindings
        .map((bindingValue) => {
          const binding = asRecord(bindingValue)
          if (!binding || typeof binding.key !== 'string' || typeof binding.command !== 'string') {
            return null
          }
          return {
            key: binding.key,
            command: binding.command,
          } satisfies KeybindingReferenceEntry
        })
        .filter((binding): binding is KeybindingReferenceEntry => binding !== null)

      return {
        component: group.component,
        bindings,
      } satisfies KeybindingReferenceGroup
    })
    .filter((group): group is KeybindingReferenceGroup => group !== null)

  return { commands, keybindings }
}

const parseLibraryCommandEntries = (value: unknown): LibraryCommandEntry[] => {
  const rows = Array.isArray(value) ? value : []
  return rows
    .map((row) => {
      if (typeof row === 'string') {
        const name = row
        const stem = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name
        return {
          name,
          stem,
          path: '',
          command: '',
        } satisfies LibraryCommandEntry
      }

      const record = asRecord(row)
      if (!record) {
        return null
      }
      const name =
        typeof record.name === 'string'
          ? record.name
          : typeof record.filename === 'string'
            ? record.filename
            : typeof record.file === 'string'
              ? record.file
              : null
      if (!name) {
        return null
      }
      const stem =
        typeof record.stem === 'string'
          ? record.stem
          : name.includes('.')
            ? name.slice(0, name.lastIndexOf('.'))
            : name
      const path =
        typeof record.path === 'string'
          ? record.path
          : typeof record.full_path === 'string'
            ? record.full_path
            : ''
      const command = typeof record.command === 'string' ? record.command : ''
      return {
        name,
        stem,
        path,
        command,
      } satisfies LibraryCommandEntry
    })
    .filter((entry): entry is LibraryCommandEntry => entry !== null)
}

const parseLibraryScaleEntries = (value: unknown): LibraryScaleEntry[] => {
  const rows = Array.isArray(value) ? value : []
  return rows
    .map((row) => {
      const record = asRecord(row)
      if (!record || typeof record.name !== 'string' || typeof record.command !== 'string') {
        return null
      }
      return {
        name: record.name,
        command: record.command,
      } satisfies LibraryScaleEntry
    })
    .filter((entry): entry is LibraryScaleEntry => entry !== null)
}

const getLibrarySnapshot = (payload: EnvelopePayload): LibrarySnapshot => {
  const paths = asRecord(payload.paths)
  const commands = asRecord(payload.commands)
  const active = asRecord(payload.active)

  return {
    paths: {
      library: typeof paths?.library === 'string' ? paths.library : '',
      sequences: typeof paths?.sequences === 'string' ? paths.sequences : '',
      tunings: typeof paths?.tunings === 'string' ? paths.tunings : '',
    },
    sequenceBanks: parseLibraryCommandEntries(payload.sequence_banks ?? payload.sequenceBanks),
    tunings: parseLibraryCommandEntries(payload.tunings),
    scales: parseLibraryScaleEntries(payload.scales),
    commands: {
      reloadScales: typeof commands?.reload_scales === 'string' ? commands.reload_scales : '',
      reloadChords: typeof commands?.reload_chords === 'string' ? commands.reload_chords : '',
      libraryDirectory:
        typeof commands?.library_directory === 'string' ? commands.library_directory : '',
    },
    active: {
      tuningName: typeof active?.tuning_name === 'string' ? active.tuning_name : '',
      scaleName: typeof active?.scale_name === 'string' ? active.scale_name : null,
    },
  }
}

const quoteCommandArg = (value: string): string => `"${value.replace(/"/g, '\\"')}"`

const getHierarchyRows = (entries: LibraryCommandEntry[]): LibraryHierarchyRow[] => {
  const directoryRows = new Set<string>()
  const rows: LibraryHierarchyRow[] = []

  const sortedEntries = [...entries].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )

  for (const entry of sortedEntries) {
    const normalized = entry.name.replace(/\\/g, '/')
    const parts = normalized.split('/').filter((part) => part.length > 0)
    const fallbackLabel = entry.name || entry.stem
    const leafLabel = parts[parts.length - 1] ?? fallbackLabel
    const directories = parts.slice(0, -1)

    let currentPath = ''
    directories.forEach((directory, index) => {
      currentPath = currentPath ? `${currentPath}/${directory}` : directory
      if (directoryRows.has(currentPath)) {
        return
      }
      directoryRows.add(currentPath)
      rows.push({
        kind: 'directory',
        key: `dir:${currentPath}`,
        label: directory,
        depth: index,
      })
    })

    rows.push({
      kind: 'file',
      key: `file:${normalized}:${entry.path || entry.name}`,
      label: leafLabel,
      depth: directories.length,
      entry,
    })
  }

  return rows
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

const parsePatternPrefix = (value: string): PatternPrefix | null => {
  const tokens = value
    .trimStart()
    .split(/\s+/)
    .filter((token) => token.length > 0)

  if (tokens.length === 0) {
    return null
  }

  let cursor = 0
  let offset = 0
  if (/^\+\d+$/.test(tokens[0])) {
    offset = Math.max(0, Math.trunc(Number(tokens[0].slice(1))))
    cursor += 1
  }

  const intervals: number[] = []
  while (cursor < tokens.length) {
    const token = tokens[cursor]
    if (!/^\d+$/.test(token)) {
      break
    }

    const interval = Math.trunc(Number(token))
    if (interval > 0) {
      intervals.push(interval)
    }
    cursor += 1
  }

  if (intervals.length === 0) {
    return null
  }

  return { offset, intervals }
}

const getPatternIndices = (sequenceLength: number, pattern: PatternPrefix): Set<number> => {
  const matches = new Set<number>()
  if (sequenceLength <= 0) {
    return matches
  }

  let position = pattern.offset
  let intervalIndex = 0
  while (position < sequenceLength) {
    if (position >= 0) {
      matches.add(position)
    }

    position += pattern.intervals[intervalIndex] ?? 1
    intervalIndex = (intervalIndex + 1) % pattern.intervals.length
  }

  return matches
}

const sampleWaveShape = (type: WaveType, phase: number, pulseWidth: number): number => {
  const wrappedPhase = ((phase % 1) + 1) % 1
  const clampedPulseWidth = clampNumber(pulseWidth, 0.01, 0.99)

  if (type === 'sine') {
    return Math.sin(wrappedPhase * Math.PI * 2)
  }

  if (type === 'triangle') {
    return 1 - 4 * Math.abs(wrappedPhase - 0.5)
  }

  if (type === 'sawtooth_up') {
    return wrappedPhase * 2 - 1
  }

  if (type === 'sawtooth_down') {
    return 1 - wrappedPhase * 2
  }

  return wrappedPhase < clampedPulseWidth ? 1 : -1
}

const createWaveModulator = (
  waveType: WaveType,
  frequency: number,
  phase: number,
  pulseWidth: number
): Modulator => {
  if (waveType === 'square') {
    return {
      type: 'square',
      frequency,
      amplitude: 1,
      phase,
      pulse_width: clampNumber(pulseWidth, 0.01, 0.99),
    }
  }

  return {
    type: waveType,
    frequency,
    amplitude: 1,
    phase,
  }
}

const createMorphModulator = (
  waveAType: WaveType,
  waveBType: WaveType,
  waveAPulseWidth: number,
  waveBPulseWidth: number,
  waveAFrequency: number,
  waveAPhase: number,
  waveBFrequency: number,
  waveBPhase: number,
  lerp: number
): Modulator => {
  const clampedLerp = clampNumber(lerp, 0, 1)
  const waveA = createWaveModulator(waveAType, waveAFrequency, waveAPhase, waveAPulseWidth)
  const waveB = createWaveModulator(waveBType, waveBFrequency, waveBPhase, waveBPulseWidth)

  if (clampedLerp <= 0) {
    return waveA
  }
  if (clampedLerp >= 1) {
    return waveB
  }

  return {
    type: 'blend',
    children: [
      {
        type: 'chain',
        children: [waveA, { type: 'scale', factor: 1 - clampedLerp }],
      },
      {
        type: 'chain',
        children: [waveB, { type: 'scale', factor: clampedLerp }],
      },
    ],
  }
}

const createTargetModulator = (
  base: Modulator,
  spec: ModTargetSpec,
  center: number,
  amount: number
): Modulator => {
  const clampedCenter = clampNumber(center, spec.min, spec.max)
  const boundedAmount = clampNumber(amount, -1, 1)
  const maxPositiveSpan = spec.max - clampedCenter
  const maxNegativeSpan = clampedCenter - spec.min
  const spanMagnitude = Math.min(maxPositiveSpan, maxNegativeSpan)
  const signedSpan = spanMagnitude * boundedAmount

  return {
    type: 'chain',
    children: [
      base,
      { type: 'scale', factor: signedSpan },
      { type: 'bias', amount: clampedCenter },
      { type: 'clamp', min: spec.min, max: spec.max },
    ],
  }
}

const buildCommandForTarget = (
  target: ModTarget,
  control: TargetControl,
  baseModulator: Modulator
): string => {
  const spec = MOD_TARGET_SPECS[target]
  const modulator = createTargetModulator(baseModulator, spec, control.center, control.amount)
  return `set ${target} ${JSON.stringify(modulator)}`
}

const buildCommandLines = (
  controls: Record<ModTarget, TargetControl>,
  baseModulator: Modulator,
  onlyTargets?: ModTarget[]
): string[] => {
  const filterSet = onlyTargets ? new Set(onlyTargets) : null
  return MOD_TARGET_ORDER.filter((target) => controls[target].enabled)
    .filter((target) => (filterSet ? filterSet.has(target) : true))
    .map((target) => buildCommandForTarget(target, controls[target], baseModulator))
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

const toSequenceIndex = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null
  }
  if (value < 0 || value >= TRANSPORT_SEQUENCE_COUNT) {
    return null
  }
  return value
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
  path: number[]
}

const collectLeafCells = (cells: Cell[]): LeafCell[] => {
  const result: LeafCell[] = []

  const walk = (groupCells: Cell[], parentPath: number[]): void => {
    if (groupCells.length === 0) {
      return
    }

    groupCells.forEach((cell, index) => {
      const path = [...parentPath, index]

      if (cell.type === 'Sequence') {
        if (cell.cells.length === 0) {
          result.push({ path })
          return
        }

        walk(cell.cells, path)
        return
      }

      result.push({ path })
    })
  }

  walk(cells, [])

  return result
}

const isPathPrefix = (prefix: number[], path: number[]): boolean => {
  if (prefix.length > path.length) {
    return false
  }

  for (let index = 0; index < prefix.length; index += 1) {
    if (prefix[index] !== path[index]) {
      return false
    }
  }

  return true
}

const pathToKey = (path: number[]): string => path.join('.')

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
  const transportRef = useRef<TransportState>(createTransportState())
  const selectedMeasureIndexRef = useRef(0)
  const selectedTimeSignatureRef = useRef({ numerator: 4, denominator: 4 })
  const animationFrameRef = useRef<number | null>(null)
  const lastAnimationFrameMsRef = useRef<number | null>(null)
  const [playheadPhase, setPlayheadPhase] = useState<number | null>(null)
  const [activeSequenceFlags, setActiveSequenceFlags] = useState<boolean[]>(
    Array(TRANSPORT_SEQUENCE_COUNT).fill(false)
  )
  const [modulatorInstances, setModulatorInstances] = useState<ModulatorPanelState[]>(() =>
    Array.from({ length: 4 }, () => createInitialModulatorPanelState())
  )
  const [activeModulatorTab, setActiveModulatorTab] = useState(0)
  const [activeReferenceTab, setActiveReferenceTab] = useState<'commands' | 'keybindings'>('commands')
  const [activeLibraryTab, setActiveLibraryTab] = useState<'scales' | 'tunings' | 'sequences'>(
    'scales'
  )
  const [sessionReference, setSessionReference] = useState<SessionReference>({
    commands: [],
    keybindings: [],
  })
  const [librarySnapshot, setLibrarySnapshot] = useState<LibrarySnapshot>({
    paths: {
      library: '',
      sequences: '',
      tunings: '',
    },
    sequenceBanks: [],
    tunings: [],
    scales: [],
    commands: {
      reloadScales: '',
      reloadChords: '',
      libraryDirectory: '',
    },
    active: {
      tuningName: '',
      scaleName: null,
    },
  })
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [waveAType, setWaveAType] = useState<WaveType>('sine')
  const [waveBType, setWaveBType] = useState<WaveType>('triangle')
  const [waveAPulseWidth, setWaveAPulseWidth] = useState(0.5)
  const [waveBPulseWidth, setWaveBPulseWidth] = useState(0.5)
  const [waveLerp, setWaveLerp] = useState(0)
  const [lfoAFrequency, setLfoAFrequency] = useState(1)
  const [lfoAPhaseOffset, setLfoAPhaseOffset] = useState(0)
  const [lfoBFrequency, setLfoBFrequency] = useState(1)
  const [lfoBPhaseOffset, setLfoBPhaseOffset] = useState(0)
  const [openWaveMenu, setOpenWaveMenu] = useState<'a' | 'b' | null>(null)
  const [targetControls, setTargetControls] = useState<Record<ModTarget, TargetControl>>(
    createInitialTargetControls()
  )
  const padDragRef = useRef<{
    pointerId: number
    target: ModTarget
    mode: 'amount' | 'center'
    host: HTMLDivElement
    startClientX: number
    startClientY: number
    startAmount: number
    startCenter: number
  } | null>(null)
  const wavePadDragRef = useRef<{
    pointerId: number
    wave: 'a' | 'b'
    host: HTMLDivElement
    startClientX: number
    startClientY: number
    moved: boolean
  } | null>(null)
  const lastWaveHandleUsedRef = useRef<'a' | 'b'>('a')
  const liveEmitFrameRef = useRef<number | null>(null)
  const liveEmitCommandsRef = useRef<string[] | null>(null)
  const waveMenuRef = useRef<HTMLDivElement | null>(null)
  const isSwitchingModTabRef = useRef(false)
  const modulatorInstancesRef = useRef(modulatorInstances)

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

                const normalizedPhase = ((phase % 1) + 1) % 1
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
    const tick = (frameTimeMs: number): void => {
      if (lastAnimationFrameMsRef.current === null) {
        lastAnimationFrameMsRef.current = frameTimeMs
      }

      const dtSec = Math.max(0, (frameTimeMs - (lastAnimationFrameMsRef.current ?? frameTimeMs)) / 1000)
      lastAnimationFrameMsRef.current = frameTimeMs

      const selectedIndex = selectedMeasureIndexRef.current
      const { numerator, denominator } = selectedTimeSignatureRef.current
      const transport = transportRef.current

      if (
        !transport.active[selectedIndex] ||
        transport.bpm <= 0 ||
        numerator <= 0 ||
        denominator <= 0
      ) {
        setPlayheadPhase((previous) => (previous === null ? previous : null))
        animationFrameRef.current = requestAnimationFrame(tick)
        return
      }

      const quartersPerLoop = numerator * (4 / denominator)
      const loopSec = (quartersPerLoop * 60) / transport.bpm
      if (loopSec <= 0) {
        setPlayheadPhase((previous) => (previous === null ? previous : null))
        animationFrameRef.current = requestAnimationFrame(tick)
        return
      }

      const nextPhase = (transport.phase[selectedIndex] + dtSec / loopSec) % 1
      transport.phase[selectedIndex] = nextPhase
      setPlayheadPhase(nextPhase)
      animationFrameRef.current = requestAnimationFrame(tick)
    }

    animationFrameRef.current = requestAnimationFrame(tick)
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      lastAnimationFrameMsRef.current = null
    }
  }, [])

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
    sequenceCount,
    topLevelCellCount,
    leafTopLevelIndices,
    rootCells,
    selectedMeasureIndex,
    selectedMeasureNumerator,
    selectedMeasureDenominator,
    selectedMeasureName,
    timeSignature,
    scaleName,
    scaleMode,
    tuningName,
    keyDisplay,
    baseFrequency,
    staffLineBandByPitch,
    leafCells,
    selectedLeafFlags,
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
        sequenceCount: TRANSPORT_SEQUENCE_COUNT,
        topLevelCellCount: 0,
        leafTopLevelIndices: [] as number[],
        rootCells: [] as Cell[],
        selectedMeasureIndex: 0,
        selectedMeasureNumerator: 4,
        selectedMeasureDenominator: 4,
        selectedMeasureName: 'Init Test',
        timeSignature: '4/4',
        scaleName: 'major diatonic',
        scaleMode: 3,
        tuningName: '12EDO',
        keyDisplay: 2,
        baseFrequency: 440,
        staffLineBandByPitch: defaultStaffLineBand,
        leafCells: [] as LeafCell[],
        selectedLeafFlags: [] as boolean[],
        rulerRatios: getTuningRatios(Array.from({ length: DEFAULT_TUNING_LENGTH }, (_, i) => i * 100)),
        highlightedPitches: new Set<number>(),
      }
    }

    const rawTuningLength = snapshot.engine.tuning.intervals.length
    const derivedTuningLength = rawTuningLength > 0 ? rawTuningLength : DEFAULT_TUNING_LENGTH
    const selectedIndex = Math.max(
      0,
      Math.min(snapshot.editor.selected.measure, snapshot.engine.sequence_bank.length - 1)
    )
    const selectedMeasure = snapshot.engine.sequence_bank[selectedIndex] ?? null
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
    const selectedNumerator = selectedMeasure?.time_signature?.numerator ?? 4
    const selectedDenominator = selectedMeasure?.time_signature?.denominator ?? 4
    const directLeafCells = collectLeafCells(directCells)
    const topLevelIndices = directLeafCells.map((leafCell) => leafCell.path[0] ?? 0)
    const selectionPath = snapshot.editor.selected.cell
    const selectionFlags = directLeafCells.map((leafCell) =>
      isPathPrefix(selectionPath, leafCell.path)
    )

    return {
      tuningLength: derivedTuningLength,
      sequenceCount: snapshot.engine.sequence_bank.length,
      topLevelCellCount: directCells.length,
      leafTopLevelIndices: topLevelIndices,
      rootCells: directCells,
      selectedMeasureIndex: selectedIndex,
      selectedMeasureNumerator: selectedNumerator,
      selectedMeasureDenominator: selectedDenominator,
      selectedMeasureName: sequenceName,
      timeSignature: signature,
      scaleName: snapshot.engine.scale?.name ?? 'none',
      scaleMode: snapshot.engine.scale?.mode ?? 0,
      tuningName: snapshot.engine.tuning_name,
      keyDisplay: snapshot.engine.key,
      baseFrequency: snapshot.engine.base_frequency,
      staffLineBandByPitch: staffLineBands,
      leafCells: directLeafCells,
      selectedLeafFlags: selectionFlags,
      rulerRatios: tuningRatios,
      highlightedPitches: mappedHighlights,
    }
  }, [snapshot])

  useEffect(() => {
    selectedMeasureIndexRef.current = selectedMeasureIndex
    selectedTimeSignatureRef.current = {
      numerator: selectedMeasureNumerator,
      denominator: selectedMeasureDenominator,
    }

    if (transportRef.current.active[selectedMeasureIndex]) {
      setPlayheadPhase(transportRef.current.phase[selectedMeasureIndex] ?? 0)
      return
    }

    setPlayheadPhase(null)
  }, [selectedMeasureDenominator, selectedMeasureIndex, selectedMeasureNumerator])

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
  const selectSequenceFromBank = useCallback(
    (sequenceIndex: number): void => {
      if (bridgeUnavailableMessage !== null) {
        return
      }

      void executeBackendCommand(`select sequence ${sequenceIndex}`).catch((error: unknown) => {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      })
    },
    [bridgeUnavailableMessage, executeBackendCommand]
  )

  const sequenceBankCells = useMemo(
    () =>
      Array.from({ length: TRANSPORT_SEQUENCE_COUNT }, (_, index) => {
        const row = 4 - Math.floor(index / 4)
        const column = (index % 4) + 1
        return { index, row, column }
      }),
    []
  )

  const sequenceViewReferenceBindings = useMemo(
    () =>
      sessionReference.keybindings
        .filter((group) => group.component === 'SequenceView')
        .flatMap((group) => group.bindings),
    [sessionReference.keybindings]
  )

  const tuningHierarchyRows = useMemo(
    () => getHierarchyRows(librarySnapshot.tunings),
    [librarySnapshot.tunings]
  )

  const sequenceHierarchyRows = useMemo(
    () => getHierarchyRows(librarySnapshot.sequenceBanks),
    [librarySnapshot.sequenceBanks]
  )

  const displayedLeafFlags = useMemo(() => {
    if (!isCommandMode) {
      return selectedLeafFlags
    }

    const pattern = parsePatternPrefix(commandText)
    if (!pattern) {
      return selectedLeafFlags
    }

    const matchingIndices = getPatternIndices(topLevelCellCount, pattern)
    return leafCells.map((_, index) => matchingIndices.has(leafTopLevelIndices[index] ?? -1))
  }, [
    commandText,
    isCommandMode,
    leafCells,
    leafTopLevelIndices,
    selectedLeafFlags,
    topLevelCellCount,
  ])

  const selectedLeafPathKeySet = useMemo(() => {
    const selectedKeys = new Set<string>()
    displayedLeafFlags.forEach((isSelected, index) => {
      if (!isSelected) {
        return
      }

      const leafPath = leafCells[index]?.path
      if (!leafPath) {
        return
      }

      selectedKeys.add(pathToKey(leafPath))
    })
    return selectedKeys
  }, [displayedLeafFlags, leafCells])

  const selectedLeafStartPathKeySet = useMemo(() => {
    const selectedStartKeys = new Set<string>()
    displayedLeafFlags.forEach((isSelected, index) => {
      if (!isSelected || (displayedLeafFlags[index - 1] ?? false)) {
        return
      }

      const leafPath = leafCells[index]?.path
      if (!leafPath) {
        return
      }

      selectedStartKeys.add(pathToKey(leafPath))
    })
    return selectedStartKeys
  }, [displayedLeafFlags, leafCells])

  const selectedLeafEndPathKeySet = useMemo(() => {
    const selectedEndKeys = new Set<string>()
    displayedLeafFlags.forEach((isSelected, index) => {
      if (!isSelected || (displayedLeafFlags[index + 1] ?? false)) {
        return
      }

      const leafPath = leafCells[index]?.path
      if (!leafPath) {
        return
      }

      selectedEndKeys.add(pathToKey(leafPath))
    })
    return selectedEndKeys
  }, [displayedLeafFlags, leafCells])

  const renderRollCells = useCallback(
    (cells: Cell[], parentPath: number[], sequenceDepth: number) => {
      if (cells.length === 0) {
        return []
      }

      const siblings = cells

      return siblings.map((cell, index) => {
        const normalizedWeight = getCellWeight(cell.weight)
        const cellPath = [...parentPath, index]
        const cellKey = pathToKey(cellPath)
        const previousSibling = index > 0 ? siblings[index - 1] : null
        const hasSequenceBoundary =
          index > 0 && (cell.type === 'Sequence' || previousSibling?.type === 'Sequence')

        if (cell.type === 'Sequence' && cell.cells.length > 0) {
          return (
            <div
              key={`roll-segment-${cellKey}`}
              className={`rollSegment${hasSequenceBoundary ? ' rollSegment-sequenceBoundary' : ''}`}
              style={
                {
                  flexGrow: normalizedWeight,
                  flexBasis: 0,
                  '--roll-sequence-boundary-depth': sequenceDepth,
                } as CSSProperties
              }
            >
              <div className="rollBranch">{renderRollCells(cell.cells, cellPath, sequenceDepth + 1)}</div>
            </div>
          )
        }

        const isSelected = selectedLeafPathKeySet.has(cellKey)
        const isSelectedStart = selectedLeafStartPathKeySet.has(cellKey)
        const isSelectedEnd = selectedLeafEndPathKeySet.has(cellKey)
        const normalizedVelocity =
          cell.type === 'Note' ? clampNumber(cell.velocity, 0, 1) : 0
        const normalizedDelay = cell.type === 'Note' ? clampNumber(cell.delay, 0, 1) : 0
        const normalizedGate = cell.type === 'Note' ? clampNumber(cell.gate, 0, 1) : 0
        const normalizedPitch =
          cell.type === 'Note' && tuningLength > 0
            ? normalizePitch(cell.pitch, tuningLength)
            : cell.type === 'Note'
              ? Math.trunc(cell.pitch)
              : 0
        const noteOctave =
          cell.type === 'Note' && tuningLength > 0 ? Math.floor(cell.pitch / tuningLength) : 0

        return (
          <div
            key={`roll-segment-${cellKey}`}
            className={`rollSegment${hasSequenceBoundary ? ' rollSegment-sequenceBoundary' : ''}`}
            style={
              {
                flexGrow: normalizedWeight,
                flexBasis: 0,
                '--roll-sequence-boundary-depth': sequenceDepth,
              } as CSSProperties
            }
          >
            <div
              className={`rollIsland${isSelected ? ' rollIsland-selected' : ''}${isSelectedStart ? ' rollIsland-selectedStart' : ''}${isSelectedEnd ? ' rollIsland-selectedEnd' : ''}`}
            >
              <div className="rollIslandGrid">
                {pitchRows.map((pitch) => (
                  <div
                    key={`roll-island-${cellKey}-row-${pitch}`}
                    className={`rollRow ${(staffLineBandByPitch[pitch] ?? 0) === 0 ? 'rollRow-bandEven' : 'rollRow-bandOdd'}`}
                  >
                    <div className="rollRowLine" aria-hidden="true" />
                    {cell.type === 'Note' && normalizedPitch === pitch ? (
                      <div
                        className={`rollNote${normalizedDelay > 0 ? ' rollNote-hasDelay' : ''}${normalizedGate < 1 ? ' rollNote-shortGate' : ''}`}
                        style={
                          {
                            left: `${normalizedDelay * 100}%`,
                            width: `max(${(1 - normalizedDelay) * normalizedGate * 100}%, 4px)`,
                            background: `rgb(241 245 249 / ${0.18 + normalizedVelocity * 0.72})`,
                          } as CSSProperties
                        }
                        aria-hidden="true"
                      >
                        {noteOctave !== 0 ? (
                          <span className="rollNoteOctave mono">
                            {noteOctave > 0 ? `+${noteOctave}` : noteOctave}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })
    },
    [
      pitchRows,
      selectedLeafEndPathKeySet,
      selectedLeafPathKeySet,
      selectedLeafStartPathKeySet,
      staffLineBandByPitch,
      tuningLength,
    ]
  )

  const { waveAPreviewPath, waveBPreviewPath, morphedWavePreviewPath } = useMemo(() => {
    const width = 420
    const height = 140
    const steps = 96
    const waveAPoints: string[] = []
    const waveBPoints: string[] = []
    const mixedPoints: string[] = []
    const normalizedWaveAPhase = toNormalizedPhase(lfoAPhaseOffset)
    const normalizedWaveBPhase = toNormalizedPhase(lfoBPhaseOffset)

    for (let index = 0; index <= steps; index += 1) {
      const progress = index / steps
      const x = progress * width
      const waveA = sampleWaveShape(
        waveAType,
        progress * lfoAFrequency + normalizedWaveAPhase,
        waveAPulseWidth
      )
      const waveB = sampleWaveShape(
        waveBType,
        progress * lfoBFrequency + normalizedWaveBPhase,
        waveBPulseWidth
      )
      const mixed = clampNumber(waveA * (1 - waveLerp) + waveB * waveLerp, -1, 1)
      const waveAY = (1 - (waveA + 1) / 2) * height
      const waveBY = (1 - (waveB + 1) / 2) * height
      const mixedY = (1 - (mixed + 1) / 2) * height
      waveAPoints.push(`${x.toFixed(2)},${waveAY.toFixed(2)}`)
      waveBPoints.push(`${x.toFixed(2)},${waveBY.toFixed(2)}`)
      mixedPoints.push(`${x.toFixed(2)},${mixedY.toFixed(2)}`)
    }

    return {
      waveAPreviewPath: waveAPoints.join(' '),
      waveBPreviewPath: waveBPoints.join(' '),
      morphedWavePreviewPath: mixedPoints.join(' '),
    }
  }, [
    lfoAFrequency,
    lfoAPhaseOffset,
    lfoBFrequency,
    lfoBPhaseOffset,
    waveAType,
    waveAPulseWidth,
    waveBType,
    waveBPulseWidth,
    waveLerp,
  ])

  const baseMorphModulator = useMemo(
    () =>
      createMorphModulator(
        waveAType,
        waveBType,
        waveAPulseWidth,
        waveBPulseWidth,
        lfoAFrequency,
        toNormalizedPhase(lfoAPhaseOffset),
        lfoBFrequency,
        toNormalizedPhase(lfoBPhaseOffset),
        waveLerp
      ),
    [
      lfoAFrequency,
      lfoAPhaseOffset,
      lfoBFrequency,
      lfoBPhaseOffset,
      waveAType,
      waveAPulseWidth,
      waveBType,
      waveBPulseWidth,
      waveLerp,
    ]
  )

  const emitCommandsNow = useCallback(
    (commands: string[]): void => {
      if (bridgeUnavailableMessage !== null || commands.length === 0) {
        return
      }

      void executeBackendCommand(commands.join('; ')).catch((error: unknown) => {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      })
    },
    [bridgeUnavailableMessage, executeBackendCommand]
  )

  const scheduleLiveEmit = useCallback(
    (commands: string[]): void => {
      if (bridgeUnavailableMessage !== null || commands.length === 0) {
        return
      }

      liveEmitCommandsRef.current = commands
      if (liveEmitFrameRef.current !== null) {
        return
      }

      liveEmitFrameRef.current = requestAnimationFrame(() => {
        liveEmitFrameRef.current = null
        const pending = liveEmitCommandsRef.current
        liveEmitCommandsRef.current = null
        if (!pending || pending.length === 0) {
          return
        }
        emitCommandsNow(pending)
      })
    },
    [bridgeUnavailableMessage, emitCommandsNow]
  )

  useEffect(
    () => () => {
      if (liveEmitFrameRef.current !== null) {
        cancelAnimationFrame(liveEmitFrameRef.current)
        liveEmitFrameRef.current = null
      }
      liveEmitCommandsRef.current = null
    },
    []
  )

  useEffect(() => {
    modulatorInstancesRef.current = modulatorInstances
  }, [modulatorInstances])

  useEffect(() => {
    const nextState = modulatorInstancesRef.current[activeModulatorTab]
    if (!nextState) {
      return
    }

    isSwitchingModTabRef.current = true
    setWaveAType(nextState.waveAType)
    setWaveBType(nextState.waveBType)
    setWaveAPulseWidth(nextState.waveAPulseWidth)
    setWaveBPulseWidth(nextState.waveBPulseWidth)
    setWaveLerp(nextState.waveLerp)
    setLfoAFrequency(nextState.lfoAFrequency)
    setLfoAPhaseOffset(nextState.lfoAPhaseOffset)
    setLfoBFrequency(nextState.lfoBFrequency)
    setLfoBPhaseOffset(nextState.lfoBPhaseOffset)
    setTargetControls(nextState.targetControls)

    queueMicrotask(() => {
      isSwitchingModTabRef.current = false
    })
  }, [activeModulatorTab])

  useEffect(() => {
    if (isSwitchingModTabRef.current) {
      return
    }

    setModulatorInstances((previous) =>
      previous.map((instance, index) =>
        index === activeModulatorTab
          ? {
              ...instance,
              waveAType,
              waveBType,
              waveAPulseWidth,
              waveBPulseWidth,
              waveLerp,
              lfoAFrequency,
              lfoAPhaseOffset,
              lfoBFrequency,
              lfoBPhaseOffset,
              targetControls,
            }
          : instance
      )
    )
  }, [
    activeModulatorTab,
    lfoAFrequency,
    lfoAPhaseOffset,
    lfoBFrequency,
    lfoBPhaseOffset,
    targetControls,
    waveAPulseWidth,
    waveAType,
    waveBPulseWidth,
    waveBType,
    waveLerp,
  ])

  useEffect(() => {
    if (openWaveMenu === null) {
      return
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const host = waveMenuRef.current
      if (!host) {
        return
      }
      if (event.target instanceof Node && !host.contains(event.target)) {
        setOpenWaveMenu(null)
      }
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpenWaveMenu(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [openWaveMenu])

  const updateTargetControl = useCallback(
    (target: ModTarget, update: Partial<TargetControl>): void => {
      setTargetControls((previous) => ({
        ...previous,
        [target]: {
          ...previous[target],
          ...update,
        },
      }))
    },
    []
  )

  const applyPadMotion = useCallback(
    (
      target: ModTarget,
      host: HTMLDivElement,
      clientX: number,
      clientY: number,
      mode: 'amount' | 'center',
      dragStart?: {
        startClientX: number
        startClientY: number
        startAmount: number
        startCenter: number
      },
      speedMode?: 'coarse' | 'fine'
    ) => {
      const spec = MOD_TARGET_SPECS[target]
      const bounds = host.getBoundingClientRect()
      const xRatio = clampNumber((clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1)
      const currentControl = targetControls[target]

      if (mode === 'center') {
        const nextCenterRaw =
          dragStart && bounds.width > 0
            ? dragStart.startCenter + ((clientX - dragStart.startClientX) / bounds.width) * (spec.max - spec.min)
            : spec.min + xRatio * (spec.max - spec.min)
        const nextCenter = roundByStep(nextCenterRaw, spec.step)
        const resolvedCenter = clampNumber(nextCenter, spec.min, spec.max)
        updateTargetControl(target, { center: resolvedCenter })
        scheduleLiveEmit([
          buildCommandForTarget(target, { ...currentControl, enabled: true, center: resolvedCenter }, baseMorphModulator),
        ])
        return
      }

      const deltaY = dragStart ? dragStart.startClientY - clientY : 0
      const sensitivityDivisor = speedMode === 'fine' ? 620 : 260
      const nextAmount = clampNumber(
        (dragStart?.startAmount ?? currentControl.amount) + deltaY / sensitivityDivisor,
        -1,
        1
      )
      updateTargetControl(target, { amount: nextAmount })
      scheduleLiveEmit([
        buildCommandForTarget(target, { ...currentControl, enabled: true, amount: nextAmount }, baseMorphModulator),
      ])
    },
    [baseMorphModulator, scheduleLiveEmit, targetControls, updateTargetControl]
  )

  const getWaveHandlePosition = useCallback((frequency: number, phaseOffset: number) => {
    const clampedFrequencyRatio = frequencyToRatio(frequency)
    const phaseRatio = 0.5 - phaseOffset
    return {
      x: clampedFrequencyRatio * 100,
      y: clampNumber(phaseRatio, 0, 1) * 100,
    }
  }, [])

  const waveHandleA = useMemo(
    () => getWaveHandlePosition(lfoAFrequency, lfoAPhaseOffset),
    [getWaveHandlePosition, lfoAFrequency, lfoAPhaseOffset]
  )
  const waveHandleB = useMemo(
    () => getWaveHandlePosition(lfoBFrequency, lfoBPhaseOffset),
    [getWaveHandlePosition, lfoBFrequency, lfoBPhaseOffset]
  )
  const waveAOpacity = clampNumber(1 - waveLerp, 0, 1)
  const waveBOpacity = clampNumber(waveLerp, 0, 1)

  const applyWavePadMotion = useCallback(
    (
      wave: 'a' | 'b',
      host: HTMLDivElement,
      clientX: number,
      clientY: number,
      lockMode?: 'none' | 'frequency' | 'offset'
    ): void => {
      const bounds = host.getBoundingClientRect()
      const xRatio = clampNumber((clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1)
      const yRatio = clampNumber((clientY - bounds.top) / Math.max(bounds.height, 1), 0, 1)
      const rawNextFrequency = ratioToFrequency(xRatio)
      const rawNextPhaseOffset = clampNumber(0.5 - yRatio, LFO_PHASE_OFFSET_MIN, LFO_PHASE_OFFSET_MAX)

      const nextFrequency =
        lockMode === 'offset'
          ? wave === 'a'
            ? lfoAFrequency
            : lfoBFrequency
          : rawNextFrequency
      const nextPhaseOffset =
        lockMode === 'frequency'
          ? wave === 'a'
            ? lfoAPhaseOffset
            : lfoBPhaseOffset
          : rawNextPhaseOffset
      const nextAFrequency = wave === 'a' ? nextFrequency : lfoAFrequency
      const nextAPhaseOffset = wave === 'a' ? nextPhaseOffset : lfoAPhaseOffset
      const nextBFrequency = wave === 'b' ? nextFrequency : lfoBFrequency
      const nextBPhaseOffset = wave === 'b' ? nextPhaseOffset : lfoBPhaseOffset

      if (wave === 'a') {
        setLfoAFrequency(nextFrequency)
        setLfoAPhaseOffset(nextPhaseOffset)
      } else {
        setLfoBFrequency(nextFrequency)
        setLfoBPhaseOffset(nextPhaseOffset)
      }
      lastWaveHandleUsedRef.current = wave

      const liveBase = createMorphModulator(
        waveAType,
        waveBType,
        waveAPulseWidth,
        waveBPulseWidth,
        nextAFrequency,
        toNormalizedPhase(nextAPhaseOffset),
        nextBFrequency,
        toNormalizedPhase(nextBPhaseOffset),
        waveLerp
      )
      scheduleLiveEmit(buildCommandLines(targetControls, liveBase))
    },
    [
      lfoAFrequency,
      lfoAPhaseOffset,
      lfoBFrequency,
      lfoBPhaseOffset,
      scheduleLiveEmit,
      targetControls,
      waveAPulseWidth,
      waveAType,
      waveBPulseWidth,
      waveBType,
      waveLerp,
    ]
  )

  const snapWaveToCenterGuides = useCallback(
    (wave: 'a' | 'b', options: { snapFrequency?: boolean; snapOffset?: boolean }): void => {
      const nextAFrequency = wave === 'a' && options.snapFrequency ? 1 : lfoAFrequency
      const nextBFrequency = wave === 'b' && options.snapFrequency ? 1 : lfoBFrequency
      const nextAPhaseOffset = wave === 'a' && options.snapOffset ? 0 : lfoAPhaseOffset
      const nextBPhaseOffset = wave === 'b' && options.snapOffset ? 0 : lfoBPhaseOffset

      if (wave === 'a') {
        if (options.snapFrequency) {
          setLfoAFrequency(1)
        }
        if (options.snapOffset) {
          setLfoAPhaseOffset(0)
        }
      } else {
        if (options.snapFrequency) {
          setLfoBFrequency(1)
        }
        if (options.snapOffset) {
          setLfoBPhaseOffset(0)
        }
      }
      lastWaveHandleUsedRef.current = wave

      const liveBase = createMorphModulator(
        waveAType,
        waveBType,
        waveAPulseWidth,
        waveBPulseWidth,
        nextAFrequency,
        toNormalizedPhase(nextAPhaseOffset),
        nextBFrequency,
        toNormalizedPhase(nextBPhaseOffset),
        waveLerp
      )
      scheduleLiveEmit(buildCommandLines(targetControls, liveBase))
    },
    [
      lfoAFrequency,
      lfoAPhaseOffset,
      lfoBFrequency,
      lfoBPhaseOffset,
      scheduleLiveEmit,
      targetControls,
      waveAPulseWidth,
      waveAType,
      waveBPulseWidth,
      waveBType,
      waveLerp,
    ]
  )

  const selectWaveType = useCallback((wave: 'a' | 'b', waveType: WaveType): void => {
    if (wave === 'a') {
      setWaveAType(waveType)
    } else {
      setWaveBType(waveType)
    }
    setOpenWaveMenu(null)
  }, [])

  const refreshLibraryView = useCallback(async (): Promise<void> => {
    if (bridgeUnavailableMessage !== null) {
      return
    }

    setLibraryLoading(true)
    try {
      const libraryResponse = await sendBridgeRequest('library.get', {})
      const libraryError = getPayloadError(libraryResponse.payload)
      if (libraryError) {
        throw new Error(libraryError)
      }
      const parsedLibrary = getLibrarySnapshot(libraryResponse.payload)
      setLibrarySnapshot(parsedLibrary)
    } catch (error) {
      setStatusMessage(`Library refresh failed: ${getErrorMessage(error)}`)
      setStatusLevel('error')
    } finally {
      setLibraryLoading(false)
    }
  }, [bridgeUnavailableMessage, sendBridgeRequest])

  const runLibraryCommand = useCallback(
    async (command: string): Promise<void> => {
      if (!command || bridgeUnavailableMessage !== null) {
        return
      }

      try {
        await executeBackendCommand(command)
      } catch (error) {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      }
    },
    [bridgeUnavailableMessage, executeBackendCommand]
  )

  useEffect(() => {
    if (libraryLoading) {
      return
    }

    if (activeLibraryTab === 'tunings' && librarySnapshot.tunings.length === 0) {
      void refreshLibraryView()
      return
    }

    if (activeLibraryTab === 'sequences' && librarySnapshot.sequenceBanks.length === 0) {
      void refreshLibraryView()
    }
  }, [
    activeLibraryTab,
    libraryLoading,
    librarySnapshot.sequenceBanks.length,
    librarySnapshot.tunings.length,
    refreshLibraryView,
  ])

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
                {renderRollCells(
                  rootCells.length > 0 ? rootCells : [{ type: 'Rest', weight: 1 }],
                  [],
                  0
                )}
              </div>
              {playheadPhase !== null ? (
                <div
                  className="rollPlayhead"
                  style={{ left: `${Math.max(0, Math.min(playheadPhase, 1)) * 100}%` }}
                  aria-hidden="true"
                />
              ) : null}
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
      <section className="bottomModules" aria-label="Temporary module area">
        <div className="bottomModuleRow">
          <article className="bottomModule bottomModule-rowItem">
            <p className="bottomModuleLabel">Sequence Bank</p>
            <div className="sequenceBankGrid" role="grid" aria-label="Sequence bank">
              {sequenceBankCells.map(({ index, row, column }) => {
                const isSelected = index === selectedMeasureIndex
                const isActive = activeSequenceFlags[index] ?? false
                const isDisabled = index >= sequenceCount
                return (
                  <button
                    key={`sequence-bank-cell-${index}`}
                    type="button"
                    className={`sequenceBankCell${isSelected ? ' sequenceBankCell-selected' : ''}${isActive ? ' sequenceBankCell-active' : ''}`}
                    style={{ gridRow: row, gridColumn: column }}
                    onClick={() => selectSequenceFromBank(index)}
                    disabled={isDisabled}
                    aria-label={`Select sequence 0x${index.toString(16).toUpperCase()}`}
                  >
                    <span className="mono">{`0x${index.toString(16).toUpperCase()}`}</span>
                  </button>
                )
              })}
            </div>
          </article>
          <article className="bottomModule bottomModule-rowItem bottomModule-modulators">
            <div className="bottomModuleHeader">
              <p className="bottomModuleLabel">Modulators</p>
              <div className="modTabs" role="tablist" aria-label="Modulator instances">
                {Array.from({ length: 4 }, (_, index) => (
                  <button
                    key={`mod-tab-${index}`}
                    type="button"
                    className={`modTab${activeModulatorTab === index ? ' modTab-active' : ''}`}
                    onClick={() => {
                      setOpenWaveMenu(null)
                      setActiveModulatorTab(index)
                    }}
                    role="tab"
                    aria-selected={activeModulatorTab === index}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
            <div className="modulatorPanel">
              <div className="modulatorTopRow" ref={waveMenuRef}>
                <div className="waveSelect">
                  <button
                    type="button"
                    className="waveSelectTrigger mono"
                    onClick={() => setOpenWaveMenu((previous) => (previous === 'a' ? null : 'a'))}
                    aria-haspopup="listbox"
                    aria-expanded={openWaveMenu === 'a'}
                    aria-label="Wave A type"
                  >
                    <span>{WAVE_OPTION_LABELS[waveAType]}</span>
                    <span className="waveSelectChevron" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                  {openWaveMenu === 'a' ? (
                    <div className="waveSelectMenu" role="listbox" aria-label="Wave A options">
                      {WAVE_OPTIONS.map((waveType) => (
                        <button
                          key={`wave-a-option-${waveType}`}
                          type="button"
                          className={`waveSelectOption mono${waveType === waveAType ? ' waveSelectOption-active' : ''}`}
                          onClick={() => selectWaveType('a', waveType)}
                          role="option"
                          aria-selected={waveType === waveAType}
                        >
                          {WAVE_OPTION_LABELS[waveType]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <input
                  className="modulatorSlider modulatorTopLerp"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={waveLerp}
                  onChange={(event) => setWaveLerp(Number(event.target.value))}
                  aria-label="Wave lerp"
                />
                <div className="waveSelect">
                  <button
                    type="button"
                    className="waveSelectTrigger mono"
                    onClick={() => setOpenWaveMenu((previous) => (previous === 'b' ? null : 'b'))}
                    aria-haspopup="listbox"
                    aria-expanded={openWaveMenu === 'b'}
                    aria-label="Wave B type"
                  >
                    <span>{WAVE_OPTION_LABELS[waveBType]}</span>
                    <span className="waveSelectChevron" aria-hidden="true">
                      ▾
                    </span>
                  </button>
                  {openWaveMenu === 'b' ? (
                    <div className="waveSelectMenu" role="listbox" aria-label="Wave B options">
                      {WAVE_OPTIONS.map((waveType) => (
                        <button
                          key={`wave-b-option-${waveType}`}
                          type="button"
                          className={`waveSelectOption mono${waveType === waveBType ? ' waveSelectOption-active' : ''}`}
                          onClick={() => selectWaveType('b', waveType)}
                          role="option"
                          aria-selected={waveType === waveBType}
                        >
                          {WAVE_OPTION_LABELS[waveType]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {(waveAType === 'square' || waveBType === 'square') && (
                <div className="modulatorRow">
                  {waveAType === 'square' ? (
                    <label className="modulatorField">
                      <span className="modulatorFieldLabel">Wave A Pulse Width</span>
                      <input
                        className="modulatorSlider"
                        type="range"
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        value={waveAPulseWidth}
                        onChange={(event) => setWaveAPulseWidth(Number(event.target.value))}
                      />
                    </label>
                  ) : (
                    <div className="modulatorField modulatorField-empty" />
                  )}
                  {waveBType === 'square' ? (
                    <label className="modulatorField">
                      <span className="modulatorFieldLabel">Wave B Pulse Width</span>
                      <input
                        className="modulatorSlider"
                        type="range"
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        value={waveBPulseWidth}
                        onChange={(event) => setWaveBPulseWidth(Number(event.target.value))}
                      />
                    </label>
                  ) : (
                    <div className="modulatorField modulatorField-empty" />
                  )}
                </div>
              )}

              <div
                className="modWavePreview"
                aria-label="Morphed wave preview"
                onPointerDown={(event) => {
                  if (!(event.currentTarget instanceof HTMLDivElement)) {
                    return
                  }
                  const bounds = event.currentTarget.getBoundingClientRect()
                  const xRatio = clampNumber((event.clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1)
                  const yRatio = clampNumber((event.clientY - bounds.top) / Math.max(bounds.height, 1), 0, 1)
                  const distanceA = Math.hypot(xRatio - waveHandleA.x / 100, yRatio - waveHandleA.y / 100)
                  const distanceB = Math.hypot(xRatio - waveHandleB.x / 100, yRatio - waveHandleB.y / 100)
                  const selectedWave: 'a' | 'b' = distanceA <= distanceB ? 'a' : 'b'
                  wavePadDragRef.current = {
                    pointerId: event.pointerId,
                    wave: selectedWave,
                    host: event.currentTarget,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    moved: false,
                  }
                  event.currentTarget.setPointerCapture(event.pointerId)
                }}
                onPointerMove={(event) => {
                  const drag = wavePadDragRef.current
                  if (!drag || drag.pointerId !== event.pointerId) {
                    return
                  }
                  const movedDistance = Math.hypot(
                    event.clientX - drag.startClientX,
                    event.clientY - drag.startClientY
                  )
                  if (!drag.moved && movedDistance >= 3) {
                    drag.moved = true
                  }
                  if (!drag.moved) {
                    return
                  }
                  const lockMode = event.shiftKey
                    ? 'frequency'
                    : event.altKey
                      ? 'offset'
                      : 'none'
                  applyWavePadMotion(drag.wave, drag.host, event.clientX, event.clientY, lockMode)
                }}
                onPointerUp={(event) => {
                  const drag = wavePadDragRef.current
                  if (drag?.pointerId === event.pointerId) {
                    if (!drag.moved) {
                      const clickWave = lastWaveHandleUsedRef.current
                      const bounds = drag.host.getBoundingClientRect()
                      const xRatio = clampNumber(
                        (event.clientX - bounds.left) / Math.max(bounds.width, 1),
                        0,
                        1
                      )
                      const yRatio = clampNumber(
                        (event.clientY - bounds.top) / Math.max(bounds.height, 1),
                        0,
                        1
                      )
                      const isNearFreqCenterLine = Math.abs(xRatio - 0.5) <= 0.06
                      const isNearCenterLine = Math.abs(yRatio - 0.5) <= 0.06
                      if (isNearCenterLine || isNearFreqCenterLine) {
                        snapWaveToCenterGuides(clickWave, {
                          snapFrequency: isNearFreqCenterLine,
                          snapOffset: isNearCenterLine,
                        })
                      } else {
                        const lockMode = event.shiftKey
                          ? 'frequency'
                          : event.altKey
                            ? 'offset'
                            : 'none'
                        applyWavePadMotion(clickWave, drag.host, event.clientX, event.clientY, lockMode)
                      }
                    }
                    wavePadDragRef.current = null
                  }
                }}
                onPointerCancel={(event) => {
                  if (wavePadDragRef.current?.pointerId === event.pointerId) {
                    wavePadDragRef.current = null
                  }
                }}
                title="Drag handle: horizontal = frequency, vertical = phase offset. Shift=frequency only. Option/Alt=offset only."
              >
                <svg viewBox="0 0 420 140" preserveAspectRatio="none">
                  <line x1="0" y1="70" x2="420" y2="70" className="modWaveAxis" />
                  <line x1="210" y1="0" x2="210" y2="140" className="modWaveAxis" />
                  <line
                    x1={`${waveHandleA.x * 4.2}`}
                    y1="0"
                    x2={`${waveHandleA.x * 4.2}`}
                    y2="140"
                    className="modWaveGuide modWaveGuide-a"
                    style={{ opacity: waveAOpacity }}
                  />
                  <line
                    x1="0"
                    y1={`${waveHandleA.y * 1.4}`}
                    x2="420"
                    y2={`${waveHandleA.y * 1.4}`}
                    className="modWaveGuide modWaveGuide-a"
                    style={{ opacity: waveAOpacity }}
                  />
                  <line
                    x1={`${waveHandleB.x * 4.2}`}
                    y1="0"
                    x2={`${waveHandleB.x * 4.2}`}
                    y2="140"
                    className="modWaveGuide modWaveGuide-b"
                    style={{ opacity: waveBOpacity }}
                  />
                  <line
                    x1="0"
                    y1={`${waveHandleB.y * 1.4}`}
                    x2="420"
                    y2={`${waveHandleB.y * 1.4}`}
                    className="modWaveGuide modWaveGuide-b"
                    style={{ opacity: waveBOpacity }}
                  />
                  <polyline
                    points={waveAPreviewPath}
                    className="modWaveLine modWaveLine-a"
                    style={{ opacity: waveAOpacity }}
                  />
                  <polyline
                    points={waveBPreviewPath}
                    className="modWaveLine modWaveLine-b"
                    style={{ opacity: waveBOpacity }}
                  />
                  <polyline points={morphedWavePreviewPath} className="modWaveLine modWaveLine-mix" />
                  <circle
                    cx={`${waveHandleA.x * 4.2}`}
                    cy={`${waveHandleA.y * 1.4}`}
                    r="5"
                    className="modWaveHandle modWaveHandle-a"
                    style={{ opacity: waveAOpacity }}
                  />
                  <circle
                    cx={`${waveHandleB.x * 4.2}`}
                    cy={`${waveHandleB.y * 1.4}`}
                    r="5"
                    className="modWaveHandle modWaveHandle-b"
                    style={{ opacity: waveBOpacity }}
                  />
                </svg>
              </div>
              <div className="modTargetList">
                {MOD_TARGET_ORDER.map((target) => {
                  const spec = MOD_TARGET_SPECS[target]
                  const control = targetControls[target]
                  const clampedCenter = clampNumber(control.center, spec.min, spec.max)
                  const maxPositiveSpan = spec.max - clampedCenter
                  const maxNegativeSpan = clampedCenter - spec.min
                  const spanMagnitude = Math.min(maxPositiveSpan, maxNegativeSpan) * Math.abs(control.amount)
                  const isInverted = control.amount < 0
                  const spanMin = clampNumber(clampedCenter - spanMagnitude, spec.min, spec.max)
                  const spanMax = clampNumber(clampedCenter + spanMagnitude, spec.min, spec.max)
                  const left = ((spanMin - spec.min) / (spec.max - spec.min)) * 100
                  const right = ((spanMax - spec.min) / (spec.max - spec.min)) * 100
                  const center = ((clampedCenter - spec.min) / (spec.max - spec.min)) * 100

                  return (
                    <div key={`mod-target-${target}`} className="modTargetRow">
                      <label className="modTargetHeader">
                        <input
                          className="modTargetLed"
                          type="checkbox"
                          checked={control.enabled}
                          onChange={(event) => updateTargetControl(target, { enabled: event.target.checked })}
                        />
                        <span className="mono">{spec.label}</span>
                      </label>
                      <div
                        className={`modRangePad${control.enabled ? '' : ' modRangePad-disabled'}`}
                        onPointerDown={(event) => {
                          if (!(event.currentTarget instanceof HTMLDivElement)) {
                            return
                          }
                          if (!control.enabled) {
                            updateTargetControl(target, { enabled: true })
                          }
                          const mode = event.metaKey || event.ctrlKey ? 'center' : 'amount'
                          padDragRef.current = {
                            pointerId: event.pointerId,
                            target,
                            mode,
                            host: event.currentTarget,
                            startClientX: event.clientX,
                            startClientY: event.clientY,
                            startAmount: control.amount,
                            startCenter: control.center,
                          }
                          event.currentTarget.setPointerCapture(event.pointerId)
                          applyPadMotion(
                            target,
                            event.currentTarget,
                            event.clientX,
                            event.clientY,
                            mode,
                            {
                              startClientX: event.clientX,
                              startClientY: event.clientY,
                              startAmount: control.amount,
                              startCenter: control.center,
                            },
                            event.shiftKey ? 'fine' : 'coarse'
                          )
                        }}
                        onPointerMove={(event) => {
                          const drag = padDragRef.current
                          if (!drag || drag.pointerId !== event.pointerId || drag.target !== target) {
                            return
                          }
                          applyPadMotion(
                            target,
                            drag.host,
                            event.clientX,
                            event.clientY,
                            drag.mode,
                            {
                              startClientX: drag.startClientX,
                              startClientY: drag.startClientY,
                              startAmount: drag.startAmount,
                              startCenter: drag.startCenter,
                            },
                            event.shiftKey ? 'fine' : 'coarse'
                          )
                        }}
                        onPointerUp={(event) => {
                          if (padDragRef.current?.pointerId === event.pointerId) {
                            padDragRef.current = null
                          }
                        }}
                        onPointerCancel={(event) => {
                          if (padDragRef.current?.pointerId === event.pointerId) {
                            padDragRef.current = null
                          }
                        }}
                        onDoubleClick={() => {
                          const resetCenter = spec.defaultCenter
                          const resetAmount = 0
                          updateTargetControl(target, {
                            center: resetCenter,
                            amount: resetAmount,
                          })
                          if (control.enabled) {
                            scheduleLiveEmit([
                              buildCommandForTarget(
                                target,
                                {
                                  ...control,
                                  center: resetCenter,
                                  amount: resetAmount,
                                },
                                baseMorphModulator
                              ),
                            ])
                          }
                        }}
                        title="Drag up/down to set depth and inversion. Shift=finer. Cmd/Ctrl+drag moves center."
                      >
                        <div className="modRangeTrack" />
                        <div
                          className={`modRangeBand${isInverted ? ' modRangeBand-inverted' : ''}`}
                          style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
                        />
                        <div className="modRangeCenter" style={{ left: `${center}%` }} />
                      </div>

                    </div>
                  )
                })}
              </div>

            </div>
          </article>
          <article className="bottomModule bottomModule-rowItem bottomModule-reference">
            <div className="bottomModuleHeader">
              <p className="bottomModuleLabel">Reference</p>
              <div className="referenceTabs" role="tablist" aria-label="Reference tabs">
                <button
                  type="button"
                  className={`referenceTab${activeReferenceTab === 'commands' ? ' referenceTab-active' : ''}`}
                  role="tab"
                  aria-selected={activeReferenceTab === 'commands'}
                  onClick={() => setActiveReferenceTab('commands')}
                >
                  Commands
                </button>
                <button
                  type="button"
                  className={`referenceTab${activeReferenceTab === 'keybindings' ? ' referenceTab-active' : ''}`}
                  role="tab"
                  aria-selected={activeReferenceTab === 'keybindings'}
                  onClick={() => setActiveReferenceTab('keybindings')}
                >
                  Keybindings
                </button>
              </div>
            </div>
            <div className="referenceBody">
              {activeReferenceTab === 'commands' ? (
                sessionReference.commands.length > 0 ? (
                  <div className="referenceCommands">
                    {sessionReference.commands.map((command) => (
                      <div key={`reference-command-${command.id}`} className="referenceCommandRow">
                        <p className="referenceCommandId mono">{command.id}</p>
                        <p className="referenceCommandSignature mono">{command.signature}</p>
                        <p className="referenceCommandDescription">{command.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="referencePlaceholder">No command reference data received.</p>
                )
              ) : (
                sequenceViewReferenceBindings.length > 0 ? (
                  <div className="referenceKeybindings">
                    <div className="referenceModeLegend">
                      <span className="referenceModeBadge mono">[p] Pitch</span>
                      <span className="referenceModeBadge mono">[v] Velocity</span>
                      <span className="referenceModeBadge mono">[d] Delay</span>
                      <span className="referenceModeBadge mono">[g] Gate</span>
                      <span className="referenceModeBadge mono">[c] Scale</span>
                    </div>
                    <div className="referenceKeybindingGroup">
                      <table className="referenceKeybindingTable">
                        <thead>
                          <tr>
                            <th className="mono">Key Chord</th>
                            <th className="mono">Command</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sequenceViewReferenceBindings.map((binding, index) => (
                            <tr key={`reference-keybinding-sequence-view-${index}`}>
                              <td className="referenceKeybindingKey mono">{binding.key}</td>
                              <td className="referenceKeybindingCommand mono">{binding.command}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="referencePlaceholder">No SequenceView keybindings received.</p>
                )
              )}
            </div>
          </article>
          <article className="bottomModule bottomModule-rowItem bottomModule-library">
          <div className="bottomModuleHeader">
            <p className="bottomModuleLabel">Library View</p>
            <div className="libraryActions">
              <button
                type="button"
                className="libraryActionButton mono"
                onClick={() => {
                  void refreshLibraryView()
                }}
                disabled={libraryLoading}
              >
                {libraryLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          </div>
          <div className="libraryTabs" role="tablist" aria-label="Library tabs">
            <button
              type="button"
              className={`libraryTab${activeLibraryTab === 'scales' ? ' libraryTab-active' : ''}`}
              role="tab"
              aria-selected={activeLibraryTab === 'scales'}
              onClick={() => setActiveLibraryTab('scales')}
            >
              Scales
            </button>
            <button
              type="button"
              className={`libraryTab${activeLibraryTab === 'tunings' ? ' libraryTab-active' : ''}`}
              role="tab"
              aria-selected={activeLibraryTab === 'tunings'}
              onClick={() => setActiveLibraryTab('tunings')}
            >
              Tunings
            </button>
            <button
              type="button"
              className={`libraryTab${activeLibraryTab === 'sequences' ? ' libraryTab-active' : ''}`}
              role="tab"
              aria-selected={activeLibraryTab === 'sequences'}
              onClick={() => setActiveLibraryTab('sequences')}
            >
              Sequences Saved
            </button>
          </div>
          <div className="libraryList" role="list">
            {activeLibraryTab === 'scales' ? (
              librarySnapshot.scales.length > 0 ? (
                librarySnapshot.scales.map((scale, index) => {
                  const isActive =
                    librarySnapshot.active.scaleName !== null &&
                    scale.name.toLowerCase() === librarySnapshot.active.scaleName.toLowerCase()

                  return (
                    <button
                      key={`library-scale-${index}-${scale.name}`}
                      type="button"
                      className={`libraryItem${isActive ? ' libraryItem-active' : ''}`}
                      onClick={() => {
                        void runLibraryCommand(
                          scale.command || `set scale ${quoteCommandArg(scale.name)}`
                        )
                      }}
                    >
                      <span className="libraryItemName mono">{scale.name}</span>
                      <span className="libraryItemMeta mono">{scale.command}</span>
                    </button>
                  )
                })
              ) : (
                <p className="libraryPlaceholder">No scales loaded.</p>
              )
            ) : null}

            {activeLibraryTab === 'tunings' ? (
              tuningHierarchyRows.length > 0 ? (
                tuningHierarchyRows.map((row) => {
                  if (row.kind === 'directory') {
                    return (
                      <div
                        key={row.key}
                        className="libraryDirectoryRow mono"
                        style={{ paddingLeft: `${row.depth * 0.9 + 0.4}rem` }}
                      >
                        <span className="libraryDirectoryCaret" aria-hidden="true">
                          ▸
                        </span>
                        <span className="libraryDirectoryName">{row.label}</span>
                      </div>
                    )
                  }

                  const tuning = row.entry
                  if (!tuning) {
                    return null
                  }
                  const isActive =
                    tuning.name.toLowerCase() === librarySnapshot.active.tuningName.toLowerCase() ||
                    tuning.stem.toLowerCase() === librarySnapshot.active.tuningName.toLowerCase()

                  return (
                    <button
                      key={row.key}
                      type="button"
                      className={`libraryItem${isActive ? ' libraryItem-active' : ''}`}
                      style={{ paddingLeft: `${row.depth * 0.9 + 0.5}rem` }}
                      onClick={() => {
                        void runLibraryCommand(
                          tuning.command || `load tuning ${quoteCommandArg(tuning.name)}`
                        )
                      }}
                    >
                      <span className="libraryItemName mono">{row.label}</span>
                      <span className="libraryItemMeta mono">{tuning.path}</span>
                    </button>
                  )
                })
              ) : (
                <p className="libraryPlaceholder">No tuning files found.</p>
              )
            ) : null}

            {activeLibraryTab === 'sequences' ? (
              sequenceHierarchyRows.length > 0 ? (
                sequenceHierarchyRows.map((row) => {
                  if (row.kind === 'directory') {
                    return (
                      <div
                        key={row.key}
                        className="libraryDirectoryRow mono"
                        style={{ paddingLeft: `${row.depth * 0.9 + 0.4}rem` }}
                      >
                        <span className="libraryDirectoryCaret" aria-hidden="true">
                          ▸
                        </span>
                        <span className="libraryDirectoryName">{row.label}</span>
                      </div>
                    )
                  }

                  const sequenceBank = row.entry
                  if (!sequenceBank) {
                    return null
                  }
                  return (
                    <button
                      key={row.key}
                      type="button"
                      className="libraryItem"
                      style={{ paddingLeft: `${row.depth * 0.9 + 0.5}rem` }}
                      onClick={() => {
                        void runLibraryCommand(
                          sequenceBank.command ||
                            `load sequenceBank ${quoteCommandArg(sequenceBank.name)}`
                        )
                      }}
                    >
                      <span className="libraryItemName mono">{row.label}</span>
                      <span className="libraryItemMeta mono">{sequenceBank.path}</span>
                    </button>
                  )
                })
              ) : (
                <p className="libraryPlaceholder">No saved sequences found.</p>
              )
            ) : null}
          </div>
          </article>
        </div>
      </section>
    </div>
  )
}

export default App
