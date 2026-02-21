/* Shared app declarations extracted from App.tsx */
export const BRIDGE_PROTOCOL = 'xen.bridge.v1'
export const FRONTEND_APP = 'xen-frontend-skeleton'
export const FRONTEND_VERSION = '0.2.0'
export const MAX_COMMAND_HISTORY = 100
export const DEFAULT_TUNING_LENGTH = 12
export const TRANSPORT_SEQUENCE_COUNT = 16
export const DEFAULT_TRANSPORT_BPM = 120
export const BG_SEQUENCE_COLORS = [
  '245 158 11',
  '14 165 233',
  '244 63 94',
  '34 197 94',
  '168 85 247',
  '249 115 22',
  '236 72 153',
  '45 212 191',
  '251 191 36',
  '96 165 250',
  '251 113 133',
  '74 222 128',
  '196 181 253',
  '251 146 60',
  '244 114 182',
  '94 234 212',
]

export const isApplePlatform = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false
  }

  const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData
  const platform = userAgentData?.platform ?? navigator.platform ?? ''
  if (/mac|iphone|ipad|ipod/i.test(platform)) {
    return true
  }

  const userAgent = navigator.userAgent ?? ''
  return /macintosh|iphone|ipad|ipod/i.test(userAgent)
}

export const usesMetaForCommand = isApplePlatform()

export type MessageLevel = 'debug' | 'info' | 'warning' | 'error'
export type TranslateDirection = 'up' | 'down'
export type InputMode = 'pitch' | 'velocity' | 'delay' | 'gate' | 'scale'

export type EnvelopePayload = Record<string, unknown>
export type SequenceViewKeymap = Record<string, string>
export type PatternPrefix = {
  offset: number
  intervals: number[]
}

export type CommandReferenceEntry = {
  id: string
  signature: string
  description: string
}

export type KeybindingReferenceEntry = {
  key: string
  command: string
}

export type KeybindingReferenceGroup = {
  component: string
  bindings: KeybindingReferenceEntry[]
}

export type SessionReference = {
  commands: CommandReferenceEntry[]
  keybindings: KeybindingReferenceGroup[]
}

export type LibraryCommandEntry = {
  name: string
  stem: string
  path: string
  command: string
  relativePath: string
  description: string
  intervals: number[]
  octave: number | null
  noteCount: number | null
}

export type LibraryScaleEntry = {
  name: string
  command: string
  intervals: number[]
}

export type LibraryChordEntry = {
  name: string
  command: string
  intervals: number[]
}

export type LibraryHierarchyRow = {
  kind: 'directory' | 'file'
  key: string
  label: string
  depth: number
  entry?: LibraryCommandEntry
}

export type LibrarySnapshot = {
  paths: {
    library: string
    sequences: string
    tunings: string
  }
  sequenceBanks: LibraryCommandEntry[]
  tunings: LibraryCommandEntry[]
  scales: LibraryScaleEntry[]
  chords: LibraryChordEntry[]
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

export type TuningSortMode = 'name' | 'noteCount' | 'octave'

export type Envelope = {
  protocol: string
  type: 'request' | 'response' | 'event'
  name: string
  request_id?: string
  payload: EnvelopePayload
}

export type NoteCell = {
  type: 'Note'
  weight: number
  pitch: number
  velocity: number
  delay: number
  gate: number
}

export type RestCell = {
  type: 'Rest'
  weight: number
}

export type SequenceCell = {
  type: 'Sequence'
  weight: number
  cells: Cell[]
}

export type Cell = NoteCell | RestCell | SequenceCell

export type Measure = {
  cell: Cell
  time_signature: {
    numerator: number
    denominator: number
  }
}

export type NoteSpanIR = {
  sequenceIndex: number
  pitch: number
  x: number
  width: number
  velocity: number
}

export type BgOverlayState = {
  sequenceIndex: number
  notes: NoteSpanIR[]
  triggerPhase: number | null
}

export type Scale = {
  name: string
  tuning_length: number
  intervals: number[]
  mode: number
}

export type UiStateSnapshot = {
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

export type TransportState = {
  active: boolean[]
  phase: number[]
  bpm: number
}

export type SyncedTransportPhases = {
  wrapped: number[]
  unwrapped: number[]
}

export type ModTarget = 'pitch' | 'velocity' | 'delay' | 'gate' | 'weights'
export type WaveType = 'sine' | 'triangle' | 'sawtooth_up' | 'sawtooth_down' | 'square'

export type ConstantModulator = {
  type: 'constant'
  value: number
}

export type OscillatorModulator = {
  type: 'sine' | 'triangle' | 'sawtooth_up' | 'sawtooth_down'
  frequency: number
  amplitude: number
  phase: number
}

export type SquareModulator = {
  type: 'square'
  frequency: number
  amplitude: number
  phase: number
  pulse_width: number
}

export type ScaleModulator = {
  type: 'scale'
  factor: number
}

export type BiasModulator = {
  type: 'bias'
  amount: number
}

export type ClampModulator = {
  type: 'clamp'
  min: number
  max: number
}

export type ChainModulator = {
  type: 'chain'
  children: Modulator[]
}

export type BlendModulator = {
  type: 'blend'
  children: Modulator[]
}

export type Modulator =
  | ConstantModulator
  | OscillatorModulator
  | SquareModulator
  | ScaleModulator
  | BiasModulator
  | ClampModulator
  | ChainModulator
  | BlendModulator

export type ModTargetSpec = {
  label: string
  min: number
  max: number
  defaultCenter: number
  defaultScalar: number
  step: number
  integer: boolean
}

export type TargetControl = {
  enabled: boolean
  useScalar: boolean
  center: number
  amount: number
  scalar: number
}

export type ModulatorPanelState = {
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

export const MOD_TARGET_SPECS: Record<ModTarget, ModTargetSpec> = {
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

export const MOD_TARGET_ORDER: ModTarget[] = ['pitch', 'velocity', 'delay', 'gate', 'weights']
export const WAVE_OPTIONS: WaveType[] = ['sine', 'triangle', 'sawtooth_up', 'sawtooth_down', 'square']
export const WAVE_OPTION_LABELS: Record<WaveType, string> = {
  sine: 'Sine',
  triangle: 'Triangle',
  sawtooth_up: 'Saw Up',
  sawtooth_down: 'Saw Down',
  square: 'Square',
}
export const LFO_FREQUENCY_RANGE_RATIO = 1000
export const LFO_FREQUENCY_MIN = 1 / Math.sqrt(LFO_FREQUENCY_RANGE_RATIO)
export const LFO_FREQUENCY_MAX = Math.sqrt(LFO_FREQUENCY_RANGE_RATIO)
export const LFO_PHASE_OFFSET_MIN = -0.5
export const LFO_PHASE_OFFSET_MAX = 0.5

export const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const normalizePhase = (value: number): number => ((value % 1) + 1) % 1

export const roundByStep = (value: number, step: number): number =>
  step <= 0 ? value : Math.round(value / step) * step

export const toNormalizedPhase = (phaseOffset: number): number => normalizePhase(phaseOffset)

export const getMeasureLoopQuarterNotes = (measure: Measure | null): number => {
  if (!measure) {
    return 0
  }

  const numerator = measure.time_signature.numerator
  const denominator = measure.time_signature.denominator
  if (numerator <= 0 || denominator <= 0) {
    return 0
  }

  return numerator * (4 / denominator)
}

export const getSequenceOverlayColor = (sequenceIndex: number, alpha: number): string =>
  `rgb(${BG_SEQUENCE_COLORS[sequenceIndex % BG_SEQUENCE_COLORS.length]} / ${clampNumber(alpha, 0, 1)})`

export const frequencyToRatio = (frequency: number): number => {
  const clamped = clampNumber(frequency, LFO_FREQUENCY_MIN, LFO_FREQUENCY_MAX)
  const span = Math.log(LFO_FREQUENCY_MAX / LFO_FREQUENCY_MIN)
  if (span <= 0) {
    return 0
  }
  return clampNumber(Math.log(clamped / LFO_FREQUENCY_MIN) / span, 0, 1)
}

export const ratioToFrequency = (ratio: number): number => {
  const clampedRatio = clampNumber(ratio, 0, 1)
  const base = LFO_FREQUENCY_MAX / LFO_FREQUENCY_MIN
  if (base <= 0) {
    return LFO_FREQUENCY_MIN
  }
  return LFO_FREQUENCY_MIN * Math.pow(base, clampedRatio)
}

export const createInitialTargetControls = (): Record<ModTarget, TargetControl> => ({
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

export const createInitialModulatorPanelState = (): ModulatorPanelState => ({
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

export const REFERENCE_RATIOS = [
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

export const createRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `req-${Date.now()}`
}

export const createTransportState = (): TransportState => ({
  active: Array(TRANSPORT_SEQUENCE_COUNT).fill(false),
  phase: Array(TRANSPORT_SEQUENCE_COUNT).fill(0),
  bpm: DEFAULT_TRANSPORT_BPM,
})

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export const parseWireEnvelope = (rawValue: unknown): Envelope => {
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

export const getPayloadError = (payload: EnvelopePayload): string | null => {
  const rawError = payload.error
  if (typeof rawError !== 'object' || rawError === null || Array.isArray(rawError)) {
    return null
  }

  const message = (rawError as Record<string, unknown>).message
  return typeof message === 'string' ? message : null
}

export const getCommandSnapshot = (payload: EnvelopePayload): unknown =>
  'snapshot' in payload ? payload.snapshot : null

export const isMessageLevel = (value: unknown): value is MessageLevel =>
  value === 'debug' || value === 'info' || value === 'warning' || value === 'error'

export const getCommandStatus = (
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

export const getCommandSuffix = (payload: EnvelopePayload): string | null => {
  const suffix = payload.suffix
  return typeof suffix === 'string' ? suffix : null
}

export const getSequenceViewKeymap = (payload: EnvelopePayload): SequenceViewKeymap => {
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

export const getSessionReference = (payload: EnvelopePayload): SessionReference => {
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

export const parseLibraryCommandEntries = (value: unknown): LibraryCommandEntry[] => {
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
          relativePath: '',
          description: '',
          intervals: [],
          octave: null,
          noteCount: null,
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
      const relativePath =
        typeof record.relative_path === 'string'
          ? record.relative_path
          : typeof record.relativePath === 'string'
            ? record.relativePath
            : ''
      const description = typeof record.description === 'string' ? record.description : ''
      const intervals = Array.isArray(record.intervals)
        ? record.intervals.filter((value): value is number => typeof value === 'number')
        : []
      const octave =
        typeof record.octave === 'number' && Number.isFinite(record.octave) ? record.octave : null
      const noteCount =
        typeof record.note_count === 'number' && Number.isFinite(record.note_count)
          ? record.note_count
          : typeof record.noteCount === 'number' && Number.isFinite(record.noteCount)
            ? record.noteCount
            : null
      return {
        name,
        stem,
        path,
        command,
        relativePath,
        description,
        intervals,
        octave,
        noteCount,
      } satisfies LibraryCommandEntry
    })
    .filter((entry): entry is LibraryCommandEntry => entry !== null)
}

export const parseLibraryScaleEntries = (value: unknown): LibraryScaleEntry[] => {
  const rows = Array.isArray(value) ? value : []
  return rows
    .map((row) => {
      const record = asRecord(row)
      if (!record || typeof record.name !== 'string' || typeof record.command !== 'string') {
        return null
      }
      const intervals = Array.isArray(record.intervals)
        ? record.intervals.filter((value): value is number => typeof value === 'number')
        : []
      return {
        name: record.name,
        command: record.command,
        intervals,
      } satisfies LibraryScaleEntry
    })
    .filter((entry): entry is LibraryScaleEntry => entry !== null)
}

export const parseLibraryChordEntries = (value: unknown): LibraryChordEntry[] => {
  const rows = Array.isArray(value) ? value : []
  return rows
    .map((row) => {
      const record = asRecord(row)
      if (!record || typeof record.name !== 'string' || typeof record.command !== 'string') {
        return null
      }
      const intervals = Array.isArray(record.intervals)
        ? record.intervals.filter((value): value is number => typeof value === 'number')
        : []
      return {
        name: record.name,
        command: record.command,
        intervals,
      } satisfies LibraryChordEntry
    })
    .filter((entry): entry is LibraryChordEntry => entry !== null)
}

export const getLibrarySnapshot = (payload: EnvelopePayload): LibrarySnapshot => {
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
    chords: parseLibraryChordEntries(payload.chords),
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

export const quoteCommandArg = (value: string): string => `"${value.replace(/"/g, '\\"')}"`

export const formatOctaveForDisplay = (value: number): string => {
  const rounded = value.toFixed(2)
  return rounded.endsWith('.00') ? rounded.slice(0, -3) : rounded
}

export const getHierarchyRows = (
  entries: LibraryCommandEntry[],
  options?: { sortByName?: boolean }
): LibraryHierarchyRow[] => {
  const directoryRows = new Set<string>()
  const rows: LibraryHierarchyRow[] = []

  const sortedEntries = options?.sortByName === false
    ? [...entries]
    : [...entries].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

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

export type ParsedKeyBinding = {
  requiredMode: InputMode | null
  requiresShift: boolean
  requiresCmd: boolean
  requiresAlt: boolean
  key: string
}

export const parseModeToken = (token: string): InputMode | null => {
  const normalizedToken = token.trim().toLowerCase()
  if (normalizedToken === '[p]') return 'pitch'
  if (normalizedToken === '[v]') return 'velocity'
  if (normalizedToken === '[d]') return 'delay'
  if (normalizedToken === '[g]') return 'gate'
  if (normalizedToken === '[c]') return 'scale'
  return null
}

export const normalizeKeyToken = (token: string): string => {
  const trimmed = token.trim()
  if (trimmed.toLowerCase() === 'plus') {
    return '+'
  }
  return trimmed.toLowerCase()
}

export const parseKeyBinding = (binding: string): ParsedKeyBinding | null => {
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

export const getEventKeyAliases = (event: KeyboardEvent): Set<string> => {
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

export const matchesBinding = (
  parsedBinding: ParsedKeyBinding,
  event: KeyboardEvent,
  inputMode: InputMode
): boolean => {
  if (parsedBinding.requiredMode && parsedBinding.requiredMode !== inputMode) {
    return false
  }

  const commandModifier = usesMetaForCommand ? event.metaKey : event.ctrlKey
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

export const applyNumberParameter = (command: string, pendingDigits: string): string => {
  const hasPendingNumber = pendingDigits.length > 0
  return command.replace(/:N=(\d+):/g, (_, defaultValue: string) =>
    hasPendingNumber ? pendingDigits : defaultValue
  )
}

export const parsePatternPrefix = (value: string): PatternPrefix | null => {
  const tokens = value
    .trimStart()
    .split(/\s+/)
    .filter((token) => token.length > 0)

  if (tokens.length === 0) {
    return null
  }

  let cursor = 0
  let offset = 0
  let hasOffsetToken = false
  if (/^\+\d+$/.test(tokens[0])) {
    offset = Math.max(0, Math.trunc(Number(tokens[0].slice(1))))
    hasOffsetToken = true
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

  if (intervals.length === 0 && hasOffsetToken) {
    return { offset, intervals: [1] }
  }

  if (intervals.length === 0) {
    return null
  }

  return { offset, intervals }
}

export const getPatternIndices = (sequenceLength: number, pattern: PatternPrefix): Set<number> => {
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

export const sampleWaveShape = (type: WaveType, phase: number, pulseWidth: number): number => {
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

export const createWaveModulator = (
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

export const createMorphModulator = (
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

export const createTargetModulator = (
  base: Modulator,
  spec: ModTargetSpec,
  center: number,
  amount: number
): Modulator => {
  const clampedCenter = clampNumber(center, spec.min, spec.max)
  const maxPositiveSpan = spec.max - clampedCenter
  const maxNegativeSpan = clampedCenter - spec.min
  const amountLimit = Math.max(maxPositiveSpan, maxNegativeSpan)
  const signedSpan = clampNumber(amount, -amountLimit, amountLimit)

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

export const buildCommandForTarget = (
  target: ModTarget,
  control: TargetControl,
  baseModulator: Modulator
): string => {
  const spec = MOD_TARGET_SPECS[target]
  const modulator = createTargetModulator(baseModulator, spec, control.center, control.amount)
  return `set ${target} ${JSON.stringify(modulator)}`
}

export const buildCommandLines = (
  controls: Record<ModTarget, TargetControl>,
  baseModulator: Modulator,
  onlyTargets?: ModTarget[]
): string[] => {
  const filterSet = onlyTargets ? new Set(onlyTargets) : null
  return MOD_TARGET_ORDER.filter((target) => controls[target].enabled)
    .filter((target) => (filterSet ? filterSet.has(target) : true))
    .map((target) => buildCommandForTarget(target, controls[target], baseModulator))
}

export const isEditableTarget = (target: EventTarget | null): boolean => {
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

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

export const toSequenceIndex = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null
  }
  if (value < 0 || value >= TRANSPORT_SEQUENCE_COUNT) {
    return null
  }
  return value
}

export const toNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is number => typeof item === 'number')
}

export const normalizePitch = (pitch: number, tuningLength: number): number => {
  const modulo = pitch % tuningLength
  return modulo >= 0 ? modulo : modulo + tuningLength
}

export const parseCell = (value: unknown): Cell | null => {
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

export const parseMeasure = (value: unknown): Measure | null => {
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

export const parseScale = (value: unknown): Scale | null => {
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

export const parseUiStateSnapshot = (value: unknown): UiStateSnapshot | null => {
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

export const getTuningRatios = (intervals: number[]): number[] =>
  Array.from(new Set(intervals.map((cents) => cents / 1200))).sort((a, b) => a - b)

export const getLargestElement = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }

  return values[values.length - 1]
}

export const euclidMod = (value: number, modulo: number): number => {
  if (modulo === 0) {
    return 0
  }
  return ((value % modulo) + modulo) % modulo
}

export const generateValidPitches = (scale: Scale, tuningLength: number): number[] => {
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

export const mapPitchToScale = (
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

export const collectNotePitches = (cell: Cell): number[] => {
  if (cell.type === 'Note') {
    return [cell.pitch]
  }

  if (cell.type === 'Sequence') {
    return cell.cells.flatMap(collectNotePitches)
  }

  return []
}

export const getCellWeight = (weight: number): number => (weight > 0 ? weight : 1)

export const flattenMeasureToNoteIR = (measure: Measure, sequenceIndex: number): NoteSpanIR[] => {
  const noteSpans: NoteSpanIR[] = []

  const walkCell = (cell: Cell, segmentStart: number, segmentWidth: number): void => {
    if (segmentWidth <= 0) {
      return
    }

    if (cell.type === 'Rest') {
      return
    }

    if (cell.type === 'Note') {
      const noteDelay = clampNumber(cell.delay, 0, 1)
      const noteGate = clampNumber(cell.gate, 0, 1)
      const noteStart = segmentStart + noteDelay * segmentWidth
      const noteEnd = noteStart + Math.max(0, (1 - noteDelay) * noteGate * segmentWidth)
      const clampedStart = clampNumber(noteStart, 0, 1)
      const clampedEnd = clampNumber(noteEnd, 0, 1)
      const clampedWidth = clampedEnd - clampedStart
      if (clampedWidth <= 0) {
        return
      }

      noteSpans.push({
        sequenceIndex,
        pitch: cell.pitch,
        x: clampedStart,
        width: clampedWidth,
        velocity: clampNumber(cell.velocity, 0, 1),
      })
      return
    }

    if (cell.cells.length === 0) {
      return
    }

    const totalWeight = cell.cells.reduce((sum, child) => sum + getCellWeight(child.weight), 0)
    if (totalWeight <= 0) {
      return
    }

    let cursor = segmentStart
    for (const child of cell.cells) {
      const childWidth = (segmentWidth * getCellWeight(child.weight)) / totalWeight
      walkCell(child, cursor, childWidth)
      cursor += childWidth
    }
  }

  walkCell(measure.cell, 0, 1)
  return noteSpans
}

export const windowBackgroundNotes = (
  bgIr: NoteSpanIR[],
  ratioFgToBg: number,
  selectedPhase: number,
  bgPhase: number
): NoteSpanIR[] => {
  if (!Number.isFinite(ratioFgToBg) || ratioFgToBg <= 0) {
    return []
  }

  const bgPhaseAtSelectedStart = bgPhase - selectedPhase * ratioFgToBg
  const bgWindowStart = bgPhaseAtSelectedStart
  const bgWindowEnd = bgPhaseAtSelectedStart + ratioFgToBg
  const projectedNotes: NoteSpanIR[] = []

  for (const note of bgIr) {
    const noteStart = clampNumber(note.x, 0, 1)
    const noteEnd = clampNumber(note.x + note.width, 0, 1)
    if (noteEnd <= noteStart) {
      continue
    }

    const firstLoop = Math.floor(bgWindowStart - noteEnd) + 1
    const lastLoop = Math.ceil(bgWindowEnd - noteStart) - 1

    for (let loopIndex = firstLoop; loopIndex <= lastLoop; loopIndex += 1) {
      const loopStart = loopIndex + noteStart
      const loopEnd = loopIndex + noteEnd
      const overlapStart = Math.max(loopStart, bgWindowStart)
      const overlapEnd = Math.min(loopEnd, bgWindowEnd)
      if (overlapEnd <= overlapStart) {
        continue
      }

      const projectedStart = clampNumber(
        (overlapStart - bgPhaseAtSelectedStart) / ratioFgToBg,
        0,
        1
      )
      const projectedEnd = clampNumber((overlapEnd - bgPhaseAtSelectedStart) / ratioFgToBg, 0, 1)
      const projectedWidth = projectedEnd - projectedStart
      if (projectedWidth <= 0) {
        continue
      }

      projectedNotes.push({
        sequenceIndex: note.sequenceIndex,
        pitch: note.pitch,
        x: projectedStart,
        width: projectedWidth,
        velocity: note.velocity,
      })
    }
  }

  return projectedNotes
}

export const getProjectedBgTriggerPhase = (
  ratioFgToBg: number,
  selectedPhase: number,
  bgPhase: number
): number | null => {
  if (!Number.isFinite(ratioFgToBg) || ratioFgToBg <= 0) {
    return null
  }

  const bgPhaseAtSelectedStart = bgPhase - selectedPhase * ratioFgToBg
  const eps = 1e-9
  const triggerOrdinal = Math.ceil(bgPhaseAtSelectedStart - eps)
  const projected = (triggerOrdinal - bgPhaseAtSelectedStart) / ratioFgToBg
  if (!Number.isFinite(projected) || projected < 0 || projected >= 1) {
    return null
  }

  return projected
}

export type LeafCell = {
  path: number[]
}

export type StatusCellMetaItem = {
  label: string
  value: string
}

export type TimeSignatureParts = {
  numerator: number
  denominator: number
}

export const collectLeafCells = (cells: Cell[]): LeafCell[] => {
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

export const isPathPrefix = (prefix: number[], path: number[]): boolean => {
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

export const pathToKey = (path: number[]): string => path.join('.')

export const getCellAtPath = (cells: Cell[], path: number[]): Cell | null => {
  if (path.length === 0) {
    return null
  }

  let currentCells = cells
  let currentCell: Cell | null = null

  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index]
    const nextCell = currentCells[segment]
    if (!nextCell) {
      return null
    }

    currentCell = nextCell
    if (index < path.length - 1) {
      if (nextCell.type !== 'Sequence') {
        return null
      }
      currentCells = nextCell.cells
    }
  }

  return currentCell
}

export const formatMetaNumber = (value: number, precision = 2): string => {
  if (!Number.isFinite(value)) {
    return '0'
  }
  const rounded = value.toFixed(precision)
  return rounded.replace(/\.?0+$/, '')
}

export const formatMetaFixed2 = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0.00'
  }
  return value.toFixed(2)
}

export const getStatusCellMeta = (cell: Cell | null): StatusCellMetaItem[] => {
  if (!cell) {
    return []
  }

  if (cell.type === 'Sequence') {
    return [
      { label: 'n', value: `${cell.cells.length}` },
      { label: 'w', value: formatMetaNumber(cell.weight) },
    ]
  }

  if (cell.type === 'Rest') {
    return [{ label: 'w', value: formatMetaNumber(cell.weight) }]
  }

  return [
    { label: 'p', value: `${Math.trunc(cell.pitch)}` },
    { label: 'd', value: formatMetaFixed2(cell.delay) },
    { label: 'g', value: formatMetaFixed2(cell.gate) },
    { label: 'v', value: formatMetaFixed2(cell.velocity) },
    { label: 'w', value: formatMetaNumber(cell.weight) },
  ]
}

export const parseTimeSignatureInput = (value: string): TimeSignatureParts | null => {
  const match = value.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) {
    return null
  }

  const numerator = Number.parseInt(match[1], 10)
  const denominator = Number.parseInt(match[2], 10)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null
  }
  if (numerator <= 0 || denominator <= 0) {
    return null
  }

  return { numerator, denominator }
}

export const formatTimeSignature = ({ numerator, denominator }: TimeSignatureParts): string =>
  `${numerator}/${denominator}`

export const parseIntegerInput = (value: string): number | null => {
  const trimmed = value.trim()
  if (!/^-?\d+$/.test(trimmed)) {
    return null
  }
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export const parsePositiveFloatInput = (value: string): number | null => {
  const trimmed = value.trim()
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return null
  }
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}
