import { useMemo } from 'react'
import { DEFAULT_TUNING_LENGTH } from '../constants'
import {
  collectNotePitches,
  generateValidPitches,
  getChildCells,
  getSelectedElement,
  getTuningRatios,
  mapPitchToScale,
  normalizePitch,
} from '../domain/music'
import { getCompositionColumn, sequenceFromTarget } from '../domain/composition'
import { resolveSelection } from '../domain/selection'
import {
  collectLeafCells,
  getCellAtPath,
  getSelectionInspector,
  isPathPrefix,
} from '../presentation/viewModels'
import type { ActiveSequenceTarget, ProjectSnapshot, Selection } from '../domain/models'

export type ProjectViewModel = {
  tuningLength: number
  patternScopeCellCount: number
  leafPatternScopeIndices: number[]
  rootCell: ProjectSnapshot['sequence']['cell']
  sequenceNumerator: number
  sequenceDenominator: number
  hasHeaderColumnMetadata: boolean
  timeSignature: string
  scaleName: string
  scaleSourceId: string | null
  scaleMode: number
  scaleSize: number
  scaleTranslateDirection: ProjectSnapshot['pitch']['translationDirection'] | null
  tuningName: string
  keyDisplay: number | string
  baseFrequency: number | string
  staffLineBandByPitch: number[]
  leafCells: ReturnType<typeof collectLeafCells>
  selectedLeafFlags: boolean[]
  selectionInspector: ReturnType<typeof getSelectionInspector>
  rulerRatios: ReturnType<typeof getTuningRatios>
  highlightedPitches: Set<number>
  selectedCellPath: number[]
  selectedElementIndex: number | null
  selectedElementKind: string | null
}

export function useProjectViewModel(
  projectSnapshot: ProjectSnapshot | null,
  selection: Selection,
  activeSequenceTarget: ActiveSequenceTarget | null,
  headerColumnCoordinate: number | null
): ProjectViewModel | null {
  return useMemo(() => {
    if (!projectSnapshot) {
      return null
    }

    const composition = projectSnapshot.composition
    const headerColumn = composition && headerColumnCoordinate !== null
      ? getCompositionColumn(composition, headerColumnCoordinate)
      : null
    const contentPitchState = composition && activeSequenceTarget
      ? getCompositionColumn(composition, activeSequenceTarget.columnCoordinate)?.pitch ??
        projectSnapshot.pitch
      : projectSnapshot.pitch
    const contentScale = contentPitchState.scale
    const rawTuningLength = contentPitchState.tuning.definition.intervals.length
    const derivedTuningLength = rawTuningLength > 0 ? rawTuningLength : DEFAULT_TUNING_LENGTH
    const sequence = sequenceFromTarget(
      projectSnapshot.sequence,
      projectSnapshot.sequenceBank,
      projectSnapshot.composition,
      activeSequenceTarget
    )
    const scaleValidPitches = contentScale
      ? generateValidPitches(contentScale.definition, derivedTuningLength)
      : []
    const translateDirection = contentPitchState.translationDirection

    const mapPitch = (pitch: number): number =>
      mapPitchToScale(pitch, scaleValidPitches, derivedTuningLength, translateDirection)

    const rootCell = sequence.cell

    const tuningRatios = getTuningRatios(contentPitchState.tuning.definition.intervals)
    const rowMap = Array.from({ length: derivedTuningLength }, (_, pitch) => mapPitch(pitch))
    const hasScale = contentScale !== null
    const staffLineBands: number[] = []

    if (hasScale) {
      let currentBand = 0
      let previousMappedPitch = 0

      for (let pitch = 0; pitch < derivedTuningLength; pitch += 1) {
        const mappedPitch = rowMap[pitch] ?? pitch
        if (mappedPitch !== previousMappedPitch) {
          currentBand = currentBand === 0 ? 1 : 0
        }
        staffLineBands.push(currentBand)
        previousMappedPitch = mappedPitch
      }
    } else {
      for (let pitch = 0; pitch < derivedTuningLength; pitch += 1) {
        staffLineBands.push(pitch % 2 === 0 ? 0 : 1)
      }
    }

    const headerPitchState = headerColumn?.pitch ?? null
    const headerScale = headerPitchState?.scale ?? null
    const signature = headerColumn
      ? `${headerColumn.length.numerator}/${headerColumn.length.denominator}`
      : '--'
    const selectedNumerator = sequence.timeSignature.numerator
    const selectedDenominator = sequence.timeSignature.denominator
    const directLeafCells = collectLeafCells(rootCell)
    const resolvedSelection = resolveSelection(rootCell, selection)
    const selectedCellPath = resolvedSelection?.cellPath ?? []
    const resolvedSelectedCell = resolvedSelection?.selectedCell ?? rootCell
    const resolvedSelectedElement = resolvedSelection?.selectedElement ?? null
    const selectedPitchSource = resolvedSelectedElement ?? resolvedSelectedCell ?? rootCell
    const selectedPitches = collectNotePitches(selectedPitchSource)
    const mappedHighlights = new Set(
      selectedPitches.map((pitch) =>
        normalizePitch(mapPitch(normalizePitch(pitch, derivedTuningLength)), derivedTuningLength)
      )
    )
    const selectedElementForScope =
      resolvedSelectedElement ?? getSelectedElement(resolvedSelectedCell ?? rootCell, null)
    const patternScopePath =
      selectedElementForScope?.type === 'Sequence'
        ? selectedCellPath
        : selectedCellPath.length > 0
          ? selectedCellPath.slice(0, -1)
          : []
    const patternScopeCell = getCellAtPath(rootCell, patternScopePath)
    const patternScopeCells = patternScopeCell ? getChildCells(patternScopeCell) : []
    const scopeIndices = directLeafCells.map((leafCell) => {
      if (!isPathPrefix(patternScopePath, leafCell.path)) {
        return -1
      }
      return leafCell.path[patternScopePath.length] ?? -1
    })
    const selectionFlags = directLeafCells.map((leafCell) =>
      isPathPrefix(selectedCellPath, leafCell.path)
    )

    return {
      tuningLength: derivedTuningLength,
      patternScopeCellCount: patternScopeCells.length,
      leafPatternScopeIndices: scopeIndices,
      rootCell,
      sequenceNumerator: selectedNumerator,
      sequenceDenominator: selectedDenominator,
      hasHeaderColumnMetadata: headerColumn !== null,
      timeSignature: signature,
      scaleName: headerPitchState ? headerScale?.definition.name ?? 'chromatic' : '--',
      scaleSourceId: headerPitchState ? headerScale?.sourceId ?? 'chromatic' : null,
      scaleMode: headerScale?.definition.mode ?? 0,
      scaleSize: headerScale?.definition.intervals.length ?? 0,
      scaleTranslateDirection: headerPitchState?.translationDirection ?? null,
      tuningName: headerPitchState?.tuning.name ?? '--',
      keyDisplay: headerPitchState?.transposition ?? '--',
      baseFrequency: headerPitchState?.baseFrequency ?? '--',
      staffLineBandByPitch: staffLineBands,
      leafCells: directLeafCells,
      selectedLeafFlags: selectionFlags,
      selectionInspector: getSelectionInspector(resolvedSelectedCell, resolvedSelectedElement),
      rulerRatios: tuningRatios,
      highlightedPitches: mappedHighlights,
      selectedCellPath,
      selectedElementIndex: resolvedSelection?.selectedElementIndex ?? null,
      selectedElementKind: resolvedSelection?.selectedElementKind ?? null,
    }
  }, [activeSequenceTarget, headerColumnCoordinate, projectSnapshot, selection])
}
