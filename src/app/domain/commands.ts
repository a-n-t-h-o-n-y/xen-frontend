import type { ActiveSequenceTarget, CommandContext, ProjectSnapshot, Selection } from './models'
import type { TranslateDirection } from './models'
import { isActiveSequenceTargetValid } from './composition'
import { projectRootCell, reconcileSelection } from './selection'

const quoteCommandArgument = (value: string): string => JSON.stringify(value)

/* =========================================================
   Composition command builders
   ========================================================= */

export const compositionCellUnassign = (
  rowIndex: number,
  columnIndex: number
): string => `composition cell unassign ${rowIndex} ${columnIndex}`

export const compositionCellAssign = (
  rowIndex: number,
  columnIndex: number,
  sequenceName: string
): string =>
  `composition cell assign ${rowIndex} ${columnIndex} ${quoteCommandArgument(sequenceName)}`

export const compositionRowRename = (rowIndex: number, name: string): string =>
  `composition row rename ${rowIndex} ${quoteCommandArgument(name)}`

export const compositionRowChannel = (rowIndex: number, channelId: string): string =>
  `composition row channel ${rowIndex} ${quoteCommandArgument(channelId)}`

export const compositionRowInsert = (
  placement: 'before' | 'after',
  rowIndex: number
): string => `composition row insert ${placement} ${rowIndex}`

export const compositionRowDelete = (rowIndex: number): string =>
  `composition row delete ${rowIndex}`

export const compositionColumnInsert = (
  placement: 'before' | 'after',
  columnIndex: number
): string => `composition column insert ${placement} ${columnIndex}`

export const compositionColumnDelete = (columnIndex: number): string =>
  `composition column delete ${columnIndex}`

export const compositionLoopBoundary = (
  boundary: 'start' | 'end',
  columnIndex: number
): string => `composition loop ${boundary} ${columnIndex}`

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
  activeSequenceTarget: ActiveSequenceTarget | null = null
): CommandContext => {
  const validTarget = isActiveSequenceTargetValid(project.composition, activeSequenceTarget)
    ? activeSequenceTarget
    : null

  return {
    expectedProjectRevision: project.revision,
    selection: reconcileSelection(projectRootCell(project, validTarget), selection),
    activeSequenceTarget: validTarget,
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
