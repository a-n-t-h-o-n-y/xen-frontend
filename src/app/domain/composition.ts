import type {
  ActiveSequenceTarget,
  Composition,
  CompositionColumn,
  CompositionPlacement,
  CompositionSelection,
  Sequence,
  SequenceBank,
  ProjectSnapshot,
} from './models'

export const MIN_COMPOSITION_COORDINATE = -2_147_483_648
export const MAX_COMPOSITION_COORDINATE = 2_147_483_647

export const compositionPlacementKey = (
  rowCoordinate: number,
  columnCoordinate: number
): string => `${rowCoordinate},${columnCoordinate}`

export const getCompositionPlacement = (
  composition: Composition,
  rowCoordinate: number,
  columnCoordinate: number
): CompositionPlacement | null =>
  composition.placements.get(compositionPlacementKey(rowCoordinate, columnCoordinate)) ?? null

export const getCompositionColumn = (
  composition: Composition,
  columnCoordinate: number
): CompositionColumn | null => composition.columns.get(columnCoordinate) ?? null

export const getCompositionColumnOrDefault = (
  composition: Composition,
  columnCoordinate: number
): Omit<CompositionColumn, 'coordinate'> =>
  getCompositionColumn(composition, columnCoordinate) ?? composition.defaultColumn

export const addCompositionCoordinate = (coordinate: number, delta: number): number => {
  const next = coordinate + Math.trunc(delta)
  return Number.isInteger(next) &&
    next >= MIN_COMPOSITION_COORDINATE &&
    next <= MAX_COMPOSITION_COORDINATE
    ? next
    : coordinate
}

export const moveCompositionSelection = (
  selection: CompositionSelection,
  direction: 'left' | 'right' | 'up' | 'down',
  amount = 1
): CompositionSelection => {
  const count = Math.max(0, Math.trunc(amount))
  if (direction === 'left' || direction === 'right') {
    return {
      ...selection,
      columnCoordinate: addCompositionCoordinate(
        selection.columnCoordinate,
        direction === 'right' ? count : -count
      ),
    }
  }

  return {
    ...selection,
    rowCoordinate: addCompositionCoordinate(
      selection.rowCoordinate,
      direction === 'down' ? count : -count
    ),
  }
}

export const isColumnInLoopRegion = (
  columnCoordinate: number,
  loopRegion: Composition['loopRegion']
): boolean =>
  columnCoordinate >= loopRegion.startColumn && columnCoordinate <= loopRegion.endColumn

export const getSequenceById = (
  sequenceBank: SequenceBank | null,
  sequenceId: number
): SequenceBank['sequences'][number] | null =>
  sequenceBank?.sequences.find((entry) => entry.id === sequenceId) ?? null

export const getNextGeneratedSequenceName = (sequenceBank: SequenceBank | null): string => {
  const existingNames = new Set(
    sequenceBank?.sequences.map((entry) => entry.name.trim().toLocaleLowerCase()) ?? []
  )
  let candidateId = Math.max(1, Math.trunc(sequenceBank?.nextId ?? 1))
  while (existingNames.has(`s${candidateId}`)) candidateId += 1
  return `S${candidateId}`
}

export const getActiveSequenceTarget = (
  composition: Composition | null,
  selection: CompositionSelection
): ActiveSequenceTarget | null => {
  if (!composition) return null
  const placement = getCompositionPlacement(
    composition,
    selection.rowCoordinate,
    selection.columnCoordinate
  )
  return placement ? { ...selection, sequenceId: placement.sequenceId } : null
}

export const getContextualSequenceName = (
  project: ProjectSnapshot | null,
  workspaceView: 'composition' | 'sequencer',
  compositionSelection: CompositionSelection,
  activeSequenceTarget: ActiveSequenceTarget | null
): string => {
  const target = workspaceView === 'composition'
    ? getActiveSequenceTarget(project?.composition ?? null, compositionSelection)
    : activeSequenceTarget
  if (!target) return workspaceView === 'composition' ? 'Empty cell' : 'Sequence unavailable'
  return getSequenceById(project?.sequenceBank ?? null, target.sequenceId)?.name ??
    'Sequence unavailable'
}

export const isActiveSequenceTargetValid = (
  composition: Composition | null,
  target: ActiveSequenceTarget | null
): target is ActiveSequenceTarget =>
  Boolean(
    composition &&
    target &&
    getCompositionPlacement(
      composition,
      target.rowCoordinate,
      target.columnCoordinate
    )?.sequenceId === target.sequenceId
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
  if (!target || !composition || !isActiveSequenceTargetValid(composition, target)) {
    return fallbackSequence
  }

  const entry = getSequenceById(sequenceBank, target.sequenceId)
  const column = getCompositionColumn(composition, target.columnCoordinate)
  if (!entry || !column) {
    return fallbackSequence
  }

  return {
    cell: entry.sequence.cell,
    timeSignature: column.length,
  }
}
