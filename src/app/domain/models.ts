import type { Cell, Measure, Selection, SelectionPath } from './music'
import type { InputMode, KeymapBinding, KeymapOverride, KeymapTarget, KeymapTrigger } from './keymap'

export type MessageLevel = 'debug' | 'info' | 'warning' | 'error'
export type TranslateDirection = 'up' | 'down'

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

export type MeasureBankEntry = {
  id: number
  name: string
  measure: {
    cell: Cell
  }
}

export type MeasureBank = {
  nextId: number
  measures: MeasureBankEntry[]
}

export type CompositionLength = {
  numerator: number
  denominator: number
}

export type CompositionColumn = {
  length: CompositionLength
}

export type CompositionRow = {
  name: string
  channelId: string
  cells: Array<number | null>
}

export type CompositionLoopRegion = {
  startColumn: number
  endColumn: number
}

export type Composition = {
  columns: CompositionColumn[]
  rows: CompositionRow[]
  loopRegion: CompositionLoopRegion
}

export type CompositionSelection = {
  rowIndex: number
  columnIndex: number
}

export type ActiveMeasureTarget = CompositionSelection & {
  measureId: number
}

export type ProjectSnapshot = {
  revision: number
  historyEntryId: number
  measure: Measure
  measureBank: MeasureBank | null
  composition: Composition | null
  pitch: PitchState
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
  revision: number
  paths: {
    library: string
    sequences: string
    tunings: string
  }
  measures: LibraryCommandEntry[]
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
  revision: number
  keySemantics: 'KeyboardEvent.key'
  bindings: Record<string, KeymapBinding[]>
  overrides: KeymapOverride[]
}

export type CommandContext = {
  expectedProjectRevision: number
  selection: Selection
  activeMeasureTarget: ActiveMeasureTarget | null
}

export type {
  Cell,
  InputMode,
  KeymapBinding,
  KeymapTarget,
  KeymapTrigger,
  Measure,
  Selection,
  SelectionPath,
}
