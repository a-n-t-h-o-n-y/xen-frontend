import type { ProjectSnapshot, Selection } from './contracts'
import { projectRootCell, reconcileSelection } from './selection'

export type CommandContext = {
  expected_project_revision: number
  selection: Selection
}

export const buildCommandContext = (
  project: ProjectSnapshot,
  selection: Selection
): CommandContext => ({
  expected_project_revision: project.project_revision,
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

