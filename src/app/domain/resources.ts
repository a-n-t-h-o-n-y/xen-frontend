import type { KeymapResource, LibrarySnapshot, ProjectSnapshot, Selection } from './models'
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
  if (current && incoming.revision <= current.revision) {
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
  if (current && incoming.revision <= current.revision) {
    return { snapshot: current, installed: false }
  }
  return { snapshot: incoming, installed: true }
}

export const ingestKeymapResource = (
  current: KeymapResource | null,
  incoming: KeymapResource
): { resource: KeymapResource; installed: boolean } => {
  if (current && incoming.revision <= current.revision) {
    return { resource: current, installed: false }
  }
  return { resource: incoming, installed: true }
}
