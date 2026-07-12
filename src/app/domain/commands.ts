import type {
  ActiveSequenceTarget,
  CommandContext,
  CompositionSelection,
  ProjectSnapshot,
  Selection,
} from './models'
import type { TranslateDirection } from './models'
import { getActiveSequenceTarget, isActiveSequenceTargetValid } from './composition'
import { projectRootCell, reconcileSelection } from './selection'

const quoteCommandArgument = (value: string): string => JSON.stringify(value)

/* =========================================================
   Composition command builders
   ========================================================= */

export const compositionCellClear = (
  rowCoordinate: number,
  columnCoordinate: number
): string => `composition cell clear ${rowCoordinate} ${columnCoordinate}`

export const compositionCellAssign = (
  rowCoordinate: number,
  columnCoordinate: number,
  sequenceName: string
): string =>
  `composition cell assign ${rowCoordinate} ${columnCoordinate} ${quoteCommandArgument(sequenceName)}`

export const compositionCellMove = (
  fromRowCoordinate: number,
  fromColumnCoordinate: number,
  toRowCoordinate: number,
  toColumnCoordinate: number
): string => `composition cell move ${fromRowCoordinate} ${fromColumnCoordinate} ${toRowCoordinate} ${toColumnCoordinate}`

export const compositionRowRename = (rowCoordinate: number, name: string): string =>
  `composition row rename ${rowCoordinate} ${quoteCommandArgument(name)}`

export const compositionRowChannel = (rowCoordinate: number, channelId: string): string =>
  `composition row channel ${rowCoordinate} ${quoteCommandArgument(channelId)}`

export const compositionLoopBoundary = (
  boundary: 'start' | 'end',
  columnCoordinate: number
): string => `composition loop ${boundary} ${columnCoordinate}`

/* =========================================================
   Set command builders
   ========================================================= */

export const setDuration = (duration: string): string => `set duration ${duration}`

export const setKey = (value: number): string => `set key ${value}`

export const setBaseFrequency = (value: number): string => `set baseFrequency ${value}`

export const setMode = (modeIndex: number): string => `set mode ${modeIndex}`

export const setTranslateDirection = (direction: TranslateDirection): string =>
  `set translateDirection ${direction}`

export const scaleDuration = (mode: 'half' | 'double'): string =>
  `${mode === 'double' ? 'double' : 'halve'} duration`

/* =========================================================
   Command context + executor
   ========================================================= */

export const buildCommandContext = (
  project: ProjectSnapshot,
  selection: Selection,
  activeSequenceTarget: ActiveSequenceTarget | null = null,
  compositionSelection: CompositionSelection | null = null
): CommandContext => {
  const validTarget = isActiveSequenceTargetValid(project.composition, activeSequenceTarget)
    ? activeSequenceTarget
    : null
  const selectedTarget = compositionSelection
    ? getActiveSequenceTarget(project.composition, compositionSelection)
    : null
  const originTarget = getActiveSequenceTarget(
    project.composition,
    { rowCoordinate: 0, columnCoordinate: 0 }
  )
  const cursorTarget = compositionSelection
    ? selectedTarget ?? { ...compositionSelection, sequenceId: null }
    : validTarget ?? originTarget ?? { rowCoordinate: 0, columnCoordinate: 0, sequenceId: null }

  return {
    expectedProjectRevision: project.revision,
    selection: reconcileSelection(projectRootCell(project, validTarget), selection),
    cursor: cursorTarget,
  }
}

export const createSerialExecutor = () => {
  let tail = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task, task)
    tail = result.then(() => undefined, () => undefined)
    return result
  }
}
