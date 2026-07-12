import type {
  ActiveSequenceTarget,
  Composition,
  CompositionSelection,
  Sequence,
  SequenceBank,
} from './models'

export const clampCompositionSelection = (
  composition: Composition,
  selection: CompositionSelection
): CompositionSelection => ({
  rowIndex: Math.min(Math.max(selection.rowIndex, 0), Math.max(0, composition.rows.length - 1)),
  columnIndex: Math.min(
    Math.max(selection.columnIndex, 0),
    Math.max(0, composition.columns.length - 1)
  ),
})

export const moveCompositionSelection = (
  composition: Composition,
  selection: CompositionSelection,
  direction: 'left' | 'right' | 'up' | 'down',
  amount = 1
): CompositionSelection => {
  const current = clampCompositionSelection(composition, selection)
  const rowCount = composition.rows.length
  const columnCount = composition.columns.length
  const count = Math.max(0, Math.trunc(amount))

  if (rowCount === 0 || columnCount === 0) {
    return current
  }

  if (direction === 'left' || direction === 'right') {
    const delta = count % columnCount
    return {
      ...current,
      columnIndex: direction === 'right'
        ? (current.columnIndex + delta) % columnCount
        : (current.columnIndex - delta + columnCount) % columnCount,
    }
  }

  const delta = count % rowCount
  return {
    ...current,
    rowIndex: direction === 'down'
      ? (current.rowIndex + delta) % rowCount
      : (current.rowIndex - delta + rowCount) % rowCount,
  }
}

export const isColumnInLoopRegion = (
  columnIndex: number,
  loopRegion: Composition['loopRegion']
): boolean => {
  if (loopRegion.startColumn <= loopRegion.endColumn) {
    return columnIndex >= loopRegion.startColumn && columnIndex <= loopRegion.endColumn
  }

  return columnIndex >= loopRegion.startColumn || columnIndex <= loopRegion.endColumn
}

export const getSequenceById = (
  sequenceBank: SequenceBank | null,
  sequenceId: number
): SequenceBank['sequences'][number] | null =>
  sequenceBank?.sequences.find((entry) => entry.id === sequenceId) ?? null

export const getActiveSequenceTarget = (
  composition: Composition | null,
  selection: CompositionSelection
): ActiveSequenceTarget | null => {
  if (!composition) return null
  const safeSelection = clampCompositionSelection(composition, selection)
  const sequenceId = composition.rows[safeSelection.rowIndex]?.cells[safeSelection.columnIndex]
  if (sequenceId === null || sequenceId === undefined) return null
  return { ...safeSelection, sequenceId }
}

export const isActiveSequenceTargetValid = (
  composition: Composition | null,
  target: ActiveSequenceTarget | null
): target is ActiveSequenceTarget =>
  Boolean(
    composition &&
    target &&
    composition.rows[target.rowIndex]?.cells[target.columnIndex] === target.sequenceId
  )

export const reconcileActiveSequenceTarget = (
  composition: Composition | null,
  target: ActiveSequenceTarget | null,
  selection: CompositionSelection
): ActiveSequenceTarget | null =>
  isActiveSequenceTargetValid(composition, target)
    ? target
    : getActiveSequenceTarget(composition, selection)

export const sequenceFromTarget = (
  fallbackSequence: Sequence,
  sequenceBank: SequenceBank | null,
  composition: Composition | null,
  target: ActiveSequenceTarget | null
): Sequence => {
  if (!target || !composition) {
    return fallbackSequence
  }

  if (composition.rows[target.rowIndex]?.cells[target.columnIndex] !== target.sequenceId) {
    return fallbackSequence
  }

  const entry = getSequenceById(sequenceBank, target.sequenceId)
  const columnLength = composition.columns[target.columnIndex]?.length
  if (!entry || !columnLength) {
    return fallbackSequence
  }

  return {
    cell: entry.sequence.cell,
    timeSignature: {
      numerator: columnLength.numerator,
      denominator: columnLength.denominator,
    },
  }
}
