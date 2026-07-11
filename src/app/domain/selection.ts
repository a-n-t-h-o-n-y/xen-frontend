import type {
  Cell,
  MusicElement,
  Selection,
  SelectionPath,
  SelectionStep,
} from './music'
import { measureFromTarget } from './composition'
import type { ActiveMeasureTarget, ProjectSnapshot } from './models'

export type ResolvedSelection = {
  cellPath: number[]
  selectedCell: Cell
  selectedElement: MusicElement | null
  selectedElementIndex: number | null
  selectedElementKind: SelectionStep['kind'] | null
}

export const ROOT_SELECTION: Selection = { path: [] }

export const resolveSelection = (
  rootCell: Cell,
  selection: Selection
): ResolvedSelection | null => {
  let currentCell = rootCell
  let currentElement: MusicElement | null = null
  const cellPath: number[] = []

  for (let index = 0; index < selection.path.length; index += 1) {
    const step = selection.path[index]
    if (!step) {
      return null
    }
    if (index % 2 === 0) {
      if (step.kind !== 'element' || step.index >= currentCell.elements.length) {
        return null
      }
      currentElement = currentCell.elements[step.index] ?? null
      continue
    }

    if (
      step.kind !== 'cell' ||
      currentElement?.type !== 'Sequence' ||
      step.index >= currentElement.cells.length
    ) {
      return null
    }
    const nextCell = currentElement.cells[step.index]
    if (!nextCell) {
      return null
    }
    currentCell = nextCell
    currentElement = null
    cellPath.push(step.index)
  }

  const finalStep = selection.path.at(-1)
  return {
    cellPath,
    selectedCell: currentCell,
    selectedElement: finalStep?.kind === 'element' ? currentElement : null,
    selectedElementIndex: finalStep?.kind === 'element' ? finalStep.index : null,
    selectedElementKind: finalStep?.kind ?? null,
  }
}

export const reconcileSelection = (rootCell: Cell, selection: Selection): Selection =>
  resolveSelection(rootCell, selection) ? selection : ROOT_SELECTION

const parentPath = (path: SelectionPath): SelectionPath => path.slice(0, -1)

const resolveParentCell = (rootCell: Cell, selection: Selection): Cell | null => {
  const path = selection.path
  if (path.length === 0) {
    return null
  }
  const parentSelection = { path: parentPath(path) }
  return resolveSelection(rootCell, parentSelection)?.selectedCell ?? null
}

export type MoveDirection = 'left' | 'right' | 'up' | 'down'

export const moveSelection = (
  rootCell: Cell,
  selection: Selection,
  direction: MoveDirection,
  amount = 1
): Selection => {
  const validSelection = reconcileSelection(rootCell, selection)
  const count = Math.max(0, Math.trunc(amount))
  let path = [...validSelection.path]

  if (direction === 'left' || direction === 'right') {
    if (path.length === 0) {
      return validSelection
    }
    const current = path.at(-1)
    if (!current) {
      return validSelection
    }

    let siblingCount = 0
    if (current.kind === 'element') {
      siblingCount = resolveParentCell(rootCell, { path })?.elements.length ?? 0
    } else {
      const sequenceSelection = { path: path.slice(0, -1) }
      const sequence = resolveSelection(rootCell, sequenceSelection)?.selectedElement
      siblingCount = sequence?.type === 'Sequence' ? sequence.cells.length : 0
    }
    if (siblingCount === 0) {
      return validSelection
    }

    const delta = count % siblingCount
    const index = direction === 'right'
      ? (current.index + delta) % siblingCount
      : (current.index - delta + siblingCount) % siblingCount
    path[path.length - 1] = { ...current, index }
    return { path }
  }

  for (let index = 0; index < count; index += 1) {
    if (direction === 'up') {
      if (path.length === 0) {
        break
      }
      if (path.at(-1)?.kind === 'element') {
        path.pop()
        continue
      }

      const current = resolveSelection(rootCell, { path })
      const parent = resolveParentCell(rootCell, { path })
      if (
        current &&
        parent?.elements.length === 1 &&
        parent.elements[0]?.type === 'Sequence'
      ) {
        path = path.slice(0, -2)
      } else {
        path.pop()
      }
      continue
    }

    const resolved = resolveSelection(rootCell, { path })
    if (!resolved) {
      break
    }
    const lastKind = path.at(-1)?.kind
    if (path.length === 0 || lastKind === 'cell') {
      const elements = resolved.selectedCell.elements
      if (elements.length === 0) {
        break
      }
      if (elements.length === 1) {
        const element = elements[0]
        if (element?.type === 'Sequence' && element.cells.length > 0) {
          path.push({ kind: 'element', index: 0 }, { kind: 'cell', index: 0 })
          continue
        }
        break
      }
      path.push({ kind: 'element', index: 0 })
      continue
    }

    const element = resolved.selectedElement
    if (element?.type !== 'Sequence' || element.cells.length === 0) {
      break
    }
    path.push({ kind: 'cell', index: 0 })
  }

  return { path }
}

export const projectRootCell = (
  snapshot: ProjectSnapshot,
  activeMeasureTarget: ActiveMeasureTarget | null = null
): Cell =>
  measureFromTarget(
    snapshot.measure,
    snapshot.measureBank,
    snapshot.composition,
    activeMeasureTarget
  ).cell
