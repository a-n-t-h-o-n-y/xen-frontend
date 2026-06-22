import type { LibrarySnapshot, ProjectSnapshot, Selection } from './contracts'
import { projectRootCell, reconcileSelection } from './selection'

export type ProjectIngestion = {
  snapshot: ProjectSnapshot
  selection: Selection
  installed: boolean
}

export const ingestProjectSnapshot = (
  current: ProjectSnapshot | null,
  incoming: ProjectSnapshot,
  selection: Selection
): ProjectIngestion => {
  if (current && incoming.project_revision <= current.project_revision) {
    return { snapshot: current, selection, installed: false }
  }
  return {
    snapshot: incoming,
    selection: reconcileSelection(projectRootCell(incoming), selection),
    installed: true,
  }
}

export const ingestLibrarySnapshot = (
  current: LibrarySnapshot | null,
  incoming: LibrarySnapshot
): { snapshot: LibrarySnapshot; installed: boolean } => {
  if (current && incoming.library_revision <= current.library_revision) {
    return { snapshot: current, installed: false }
  }
  return { snapshot: incoming, installed: true }
}
