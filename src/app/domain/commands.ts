import type { ActiveMeasureTarget, CommandContext, ProjectSnapshot, Selection } from './models'
import type { TranslateDirection } from './models'
import { isActiveMeasureTargetValid } from './composition'
import { projectRootCell, reconcileSelection } from './selection'

const quoteCommandArgument = (value: string): string => JSON.stringify(value)

/* =========================================================
   Composition command builders
   ========================================================= */

export const compositionCellClear = (
  rowIndex: number,
  columnIndex: number
): string => `composition cell clear ${rowIndex} ${columnIndex}`

export const compositionCellAssign = (
  rowIndex: number,
  columnIndex: number,
  measureName: string
): string =>
  `composition cell assign ${rowIndex} ${columnIndex} ${quoteCommandArgument(measureName)}`

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

export const compositionColumnLength = (
  columnIndex: number,
  timeSignature: string
): string => `composition column length ${columnIndex} ${timeSignature}`

export const compositionLoopBoundary = (
  boundary: 'start' | 'end',
  columnIndex: number
): string => `composition loop ${boundary} ${columnIndex}`

/* =========================================================
   Set command builders
   ========================================================= */

export const setMeasureTimeSignature = (timeSignature: string): string =>
  `set measure timeSignature ${timeSignature}`

export const setKey = (value: number): string => `set key ${value}`

export const setBaseFrequency = (value: number): string => `set baseFrequency ${value}`

export const setMode = (modeIndex: number): string => `set mode ${modeIndex}`

export const setTranslateDirection = (direction: TranslateDirection): string =>
  `set translateDirection ${direction}`

export const scaleMeasureTimeSignature = (mode: 'half' | 'double'): string =>
  `${mode === 'double' ? 'double' : 'halve'} measure timeSignature`

/* =========================================================
   Command context + executor
   ========================================================= */

export const buildCommandContext = (
  project: ProjectSnapshot,
  selection: Selection,
  activeMeasureTarget: ActiveMeasureTarget | null = null
): CommandContext => {
  const validTarget = isActiveMeasureTargetValid(project.composition, activeMeasureTarget)
    ? activeMeasureTarget
    : null

  return {
    expectedProjectRevision: project.revision,
    selection: reconcileSelection(projectRootCell(project, validTarget), selection),
    activeMeasureTarget: validTarget,
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
