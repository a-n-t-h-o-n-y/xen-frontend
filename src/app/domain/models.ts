import type { Cell, Sequence, Selection, SelectionPath } from './music'
import type { InputMode, KeymapBinding, KeymapDocument, KeymapTarget, KeymapTrigger } from './keymap'

export type MessageLevel = 'debug' | 'info' | 'warning' | 'error'
export type TranslateDirection = 'up' | 'down'
export type FileRevision = string

export type EditorState = {
  selection: Selection
  inputMode: InputMode
}

export type { TransportState } from '../constants'

export type PatternPrefix = {
  offset: number
  intervals: number[]
}

export type CommandReferenceEntry = {
  id: string
  signature: string
  keywords: string[]
  description: string
  targetRequirement: 'none' | 'cell' | 'element' | 'cell_or_element'
  acceptsPatternPrefix: boolean
  arguments: CommandReferenceArgument[]
}

export type CommandReferenceConstraint = {
  kind: string
  minimum: number | null
  maximum: number | null
  values: string[]
}

export type CommandReferenceArgument = {
  kind: string
  displayName: string
  required: boolean
  defaultValue: string | null
  constraints: CommandReferenceConstraint[]
}

export type SessionReference = {
  commands: CommandReferenceEntry[]
}

export type Scale = {
  name: string
  tuningLength: number
  intervals: number[]
  mode: number
}

export type TuningDefinition = {
  intervals: number[]
  octave: number
}

export type Tuning = {
  name: string
  definition: TuningDefinition
}

export type ProjectScale = {
  sourceId: string | null
  definition: Scale
}

export type PitchState = {
  tuning: Tuning
  scale: ProjectScale | null
  transposition: number
  translationDirection: TranslateDirection
  baseFrequency: number
}

export type SequenceBankEntry = {
  id: number
  name: string
  sequence: {
    cell: Cell
  }
}

export type SequenceBank = {
  nextId: number
  sequences: SequenceBankEntry[]
}

export type CompositionLength = {
  numerator: number
  denominator: number
}

export type CompositionColumn = {
  coordinate: number
  length: CompositionLength
  pitch: PitchState
}

export type CompositionRow = {
  coordinate: number
  name: string
  channelId: string
}

export type CompositionPlacement = {
  rowCoordinate: number
  columnCoordinate: number
  sequenceId: number
}

export type CompositionLoopRegion = {
  startColumn: number
  endColumn: number
}

export type Composition = {
  defaultColumn: Omit<CompositionColumn, 'coordinate'>
  columns: Map<number, CompositionColumn>
  rows: Map<number, CompositionRow>
  placements: Map<string, CompositionPlacement>
  loopRegion: CompositionLoopRegion
}

export type CompositionSelection = {
  rowCoordinate: number
  columnCoordinate: number
}

export type ActiveSequenceTarget = CompositionSelection & {
  sequenceId: number
}

export type ProjectSnapshot = {
  stateRevision: string
  projectRevision: string
  historyEntryId: string
  previewActive: boolean
  document: ProjectDocument
  recovery: ProjectRecovery | null
  sequence: Sequence
  sequenceBank: SequenceBank | null
  composition: Composition | null
  pitch: PitchState
}

export type ProjectDocument = {
  relativePath: string | null
  displayName: string
  dirty: boolean
  fileRevision: FileRevision | null
}

export type ProjectRecovery = {
  revision: string
  savedAtUnixMs: string
  relativePath: string | null
  projectRevision: string
}

export type ContentFile = {
  name: string
  stem: string
  relativePath: string
  fileRevision: FileRevision
}

export type LibraryCommandEntry = {
  name: string
  stem: string
  command: string
  relativePath: string
  description: string
  intervals: number[]
  octave: number | null
  noteCount: number | null
}

export type LibraryTuningEntry = LibraryCommandEntry & {
  description: string
  intervals: number[]
  octave: number
  noteCount: number
}

export type LibraryChromaticScale = {
  id: 'chromatic'
  name: 'chromatic'
  definition: null
  intervals: []
  command: string
}

export type LibraryDefinedScale = {
  id: string
  definition: Scale
  command: string
}

export type LibraryScaleEntry = LibraryChromaticScale | LibraryDefinedScale

export type LibraryChordEntry = {
  name: string
  intervals: number[]
  command: string
}

export type LibrarySnapshot = {
  revision: string
  cells: ContentFile[]
  projects: ContentFile[]
  tunings: LibraryTuningEntry[]
  scales: LibraryScaleEntry[]
  chords: LibraryChordEntry[]
  commands: {
    reloadScales: string
    reloadChords: string
    libraryDirectory: string
  }
}

export type CommandStatus = {
  level: MessageLevel
  message: string
}

export type CommandExecuteResponse = {
  status: CommandStatus
  suggestedSelection: Selection | null
  snapshot: ProjectSnapshot
}

export type SessionHello = {
  pluginVersion: string
  catalog: SessionReference
  keymap: KeymapResource
}

export type KeymapResource = {
  revision: string
  keySemantics: 'KeyboardEvent.key-or-code'
  bindings: Record<string, KeymapBinding[]>
  document: KeymapDocument
  source: 'default' | 'stored'
  loadError: string | null
}

export type CommandContext = {
  expectedProjectRevision: string
  selection: Selection
  cursor: CompositionSelection & {
    sequenceId: number | null
  }
}

export type {
  Cell,
  InputMode,
  KeymapBinding,
  KeymapDocument,
  KeymapTarget,
  KeymapTrigger,
  Sequence,
  Selection,
  SelectionPath,
}
