import type {
  ActiveSequenceTarget,
  KeymapResource,
  LibrarySnapshot,
  ProjectSnapshot,
  Selection,
} from './models'
import { projectRootCell, reconcileSelection } from './selection'

export const compareDecimalRevisions = (left: string, right: string): number => {
  const normalizedLeft = left.replace(/^0+(?=\d)/, '')
  const normalizedRight = right.replace(/^0+(?=\d)/, '')
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length < normalizedRight.length ? -1 : 1
  }
  if (normalizedLeft === normalizedRight) return 0
  return normalizedLeft < normalizedRight ? -1 : 1
}

export type ProjectIngestion = {
  snapshot: ProjectSnapshot
  selection: Selection
  installed: boolean
}

export const ingestProjectSnapshot = (
  current: ProjectSnapshot | null,
  incoming: ProjectSnapshot,
  selection: Selection,
  activeSequenceTarget: ActiveSequenceTarget | null = null
): ProjectIngestion => {
  if (
    current &&
    compareDecimalRevisions(incoming.stateRevision, current.stateRevision) <= 0
  ) {
    return { snapshot: current, selection, installed: false }
  }
  return {
    snapshot: incoming,
    selection: reconcileSelection(projectRootCell(incoming, activeSequenceTarget), selection),
    installed: true,
  }
}

export const ingestLibrarySnapshot = (
  current: LibrarySnapshot | null,
  incoming: LibrarySnapshot
): { snapshot: LibrarySnapshot; installed: boolean } => {
  if (current && compareDecimalRevisions(incoming.revision, current.revision) <= 0) {
    return { snapshot: current, installed: false }
  }
  return { snapshot: incoming, installed: true }
}

export const ingestKeymapResource = (
  current: KeymapResource | null,
  incoming: KeymapResource
): { resource: KeymapResource; installed: boolean } => {
  if (current && incoming.revision === current.revision) {
    return { resource: current, installed: false }
  }
  return { resource: incoming, installed: true }
}
