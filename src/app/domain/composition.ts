import type {
  ActiveMeasureTarget,
  Composition,
  CompositionSelection,
  Measure,
  MeasureBank,
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

export const getMeasureById = (
  measureBank: MeasureBank | null,
  measureId: number
): MeasureBank['measures'][number] | null =>
  measureBank?.measures.find((entry) => entry.id === measureId) ?? null

export const getActiveMeasureTarget = (
  composition: Composition | null,
  selection: CompositionSelection
): ActiveMeasureTarget | null => {
  if (!composition) return null
  const safeSelection = clampCompositionSelection(composition, selection)
  const measureId = composition.rows[safeSelection.rowIndex]?.cells[safeSelection.columnIndex]
  if (measureId === null || measureId === undefined) return null
  return { ...safeSelection, measureId }
}

export const isActiveMeasureTargetValid = (
  composition: Composition | null,
  target: ActiveMeasureTarget | null
): target is ActiveMeasureTarget =>
  Boolean(
    composition &&
    target &&
    composition.rows[target.rowIndex]?.cells[target.columnIndex] === target.measureId
  )

export const measureFromTarget = (
  fallbackMeasure: Measure,
  measureBank: MeasureBank | null,
  composition: Composition | null,
  target: ActiveMeasureTarget | null
): Measure => {
  if (!target || !composition) {
    return fallbackMeasure
  }

  if (composition.rows[target.rowIndex]?.cells[target.columnIndex] !== target.measureId) {
    return fallbackMeasure
  }

  const entry = getMeasureById(measureBank, target.measureId)
  const columnLength = composition.columns[target.columnIndex]?.length
  if (!entry || !columnLength) {
    return fallbackMeasure
  }

  return {
    cell: entry.measure.cell,
    timeSignature: {
      numerator: columnLength.numerator,
      denominator: columnLength.denominator,
    },
  }
}
