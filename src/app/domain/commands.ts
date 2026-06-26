import type { ActiveMeasureTarget, CommandContext, ProjectSnapshot, Selection } from './models'
import { isActiveMeasureTargetValid } from './composition'
import { projectRootCell, reconcileSelection } from './selection'

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
