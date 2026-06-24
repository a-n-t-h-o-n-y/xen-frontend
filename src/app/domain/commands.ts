import type { CommandContext, ProjectSnapshot, Selection } from './models'
import { projectRootCell, reconcileSelection } from './selection'

export const buildCommandContext = (
  project: ProjectSnapshot,
  selection: Selection
): CommandContext => ({
  expectedProjectRevision: project.revision,
  selection: reconcileSelection(projectRootCell(project), selection),
})

export const createSerialExecutor = () => {
  let tail = Promise.resolve()
  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task, task)
    tail = result.then(() => undefined, () => undefined)
    return result
  }
}
