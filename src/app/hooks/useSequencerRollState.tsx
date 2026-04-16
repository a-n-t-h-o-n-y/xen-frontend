import { type CSSProperties, useCallback, useMemo } from 'react'
import {
  REFERENCE_RATIOS,
  clampNumber,
  getChildCells,
  getCellWeight,
  getLargestElement,
  getPatternIndices,
  normalizePitch,
  parsePatternPrefix,
  pathToKey,
} from '../shared'
import type { BgOverlayState, Cell, LeafCell, SelectionStep } from '../shared'

type IndexedNoteElement = {
  element: Extract<Cell['elements'][number], { type: 'Note' }>
  elementIndex: number
}

type UseSequencerRollStateArgs = {
  commandText: string
  isCommandMode: boolean
  selectedCellPath: number[]
  selectedElementIndex: number | null
  selectedElementKind: SelectionStep['kind'] | null
  selectedLeafFlags: boolean[]
  leafCells: LeafCell[]
  leafPatternScopeIndices: number[]
  patternScopeCellCount: number
  staffLineBandByPitch: number[]
  tuningLength: number
}

export function useSequencerRollState({
  commandText,
  isCommandMode,
  selectedCellPath,
  selectedElementIndex,
  selectedElementKind,
  selectedLeafFlags,
  leafCells,
  leafPatternScopeIndices,
  patternScopeCellCount,
  staffLineBandByPitch,
  tuningLength,
}: UseSequencerRollStateArgs) {
  const backgroundOverlayStates = useMemo((): BgOverlayState[] => [], [])

  const pitchRows = useMemo(
    () => Array.from({ length: tuningLength }, (_, index) => tuningLength - 1 - index),
    [tuningLength]
  )

  const referenceMax = getLargestElement(REFERENCE_RATIOS)
  const rulerOffset = (1 - referenceMax) / 2

  const ratioToBottom = useCallback(
    (ratio: number): number => {
      let bottom = ratio + rulerOffset
      while (bottom > 1) {
        bottom -= 1
      }
      while (bottom < 0) {
        bottom += 1
      }
      return bottom * 100
    },
    [rulerOffset]
  )

  const selectedCellPathKey = useMemo(() => pathToKey(selectedCellPath), [selectedCellPath])

  const displayedLeafFlags = useMemo(() => {
    if (!isCommandMode) {
      return selectedLeafFlags
    }

    const pattern = parsePatternPrefix(commandText)
    if (!pattern) {
      return selectedLeafFlags
    }

    const matchingIndices = getPatternIndices(patternScopeCellCount, pattern)
    return leafCells.map((_, index) => matchingIndices.has(leafPatternScopeIndices[index] ?? -1))
  }, [
    commandText,
    isCommandMode,
    leafCells,
    leafPatternScopeIndices,
    patternScopeCellCount,
    selectedLeafFlags,
  ])

  const selectedLeafPathKeySet = useMemo(() => {
    const selectedKeys = new Set<string>()
    displayedLeafFlags.forEach((isSelected, index) => {
      if (!isSelected) {
        return
      }

      const leafPath = leafCells[index]?.path
      if (!leafPath) {
        return
      }

      selectedKeys.add(pathToKey(leafPath))
    })
    return selectedKeys
  }, [displayedLeafFlags, leafCells])

  const selectedLeafStartPathKeySet = useMemo(() => {
    const selectedStartKeys = new Set<string>()
    displayedLeafFlags.forEach((isSelected, index) => {
      if (!isSelected || (displayedLeafFlags[index - 1] ?? false)) {
        return
      }

      const leafPath = leafCells[index]?.path
      if (!leafPath) {
        return
      }

      selectedStartKeys.add(pathToKey(leafPath))
    })
    return selectedStartKeys
  }, [displayedLeafFlags, leafCells])

  const selectedLeafEndPathKeySet = useMemo(() => {
    const selectedEndKeys = new Set<string>()
    displayedLeafFlags.forEach((isSelected, index) => {
      if (!isSelected || (displayedLeafFlags[index + 1] ?? false)) {
        return
      }

      const leafPath = leafCells[index]?.path
      if (!leafPath) {
        return
      }

      selectedEndKeys.add(pathToKey(leafPath))
    })
    return selectedEndKeys
  }, [displayedLeafFlags, leafCells])

  const renderRollCell = useCallback(
    function renderCell(
      cell: Cell,
      cellPath: number[],
      sequenceDepth: number,
      previousSibling: Cell | null = null
    ) {
      const normalizedWeight = getCellWeight(cell.weight)
      const cellKey = pathToKey(cellPath)
      const childCells = getChildCells(cell)
      const hasChildCells = childCells.length > 0
      const isSelectedCell = selectedCellPathKey === cellKey
      const noteElements = cell.elements
        .map((element, elementIndex) => ({ element, elementIndex }))
        .filter((entry): entry is IndexedNoteElement => entry.element.type === 'Note')
      const previousSiblingHasChildren = previousSibling ? getChildCells(previousSibling).length > 0 : false
      const hasSequenceBoundary = previousSibling !== null && (hasChildCells || previousSiblingHasChildren)

      const renderedNotes =
        tuningLength > 0
          ? noteElements.map((noteElement, noteIndex) => {
              const normalizedVelocity = clampNumber(noteElement.element.velocity, 0, 1)
              const normalizedDelay = clampNumber(noteElement.element.delay, 0, 1)
              const normalizedGate = clampNumber(noteElement.element.gate, 0, 1)
              const normalizedPitch = normalizePitch(noteElement.element.pitch, tuningLength)
              const rowFromTop = tuningLength - 1 - normalizedPitch
              const rowHeightPercent = 100 / Math.max(tuningLength, 1)
              const noteHeightPercent = rowHeightPercent * 0.76
              const noteTopPercent =
                rowFromTop * rowHeightPercent + (rowHeightPercent - noteHeightPercent) / 2
              const noteOctave = Math.floor(noteElement.element.pitch / tuningLength)
              const isSelectedNote =
                isSelectedCell &&
                selectedElementKind === 'element' &&
                selectedElementIndex === noteElement.elementIndex

              return (
                <div
                  key={`roll-segment-${cellKey}-note-${noteIndex}`}
                  className={`rollCellNote${normalizedDelay > 0 ? ' rollNote-hasDelay' : ''}${normalizedGate < 1 ? ' rollNote-shortGate' : ''}${isSelectedNote ? ' rollCellNote-selected' : ''}`}
                  style={
                    {
                      left: `${normalizedDelay * 100}%`,
                      width: `max(${(1 - normalizedDelay) * normalizedGate * 100}%, 4px)`,
                      top: `${noteTopPercent}%`,
                      height: `${noteHeightPercent}%`,
                      background: `rgb(241 245 249 / ${0.18 + normalizedVelocity * 0.72})`,
                    } as CSSProperties
                  }
                  aria-hidden="true"
                >
                  {noteOctave !== 0 ? (
                    <span className="rollNoteOctave mono">
                      {noteOctave > 0 ? `+${noteOctave}` : noteOctave}
                    </span>
                  ) : null}
                </div>
              )
            })
          : []

      const isSelected = selectedLeafPathKeySet.has(cellKey)
      const isSelectedStart = selectedLeafStartPathKeySet.has(cellKey)
      const isSelectedEnd = selectedLeafEndPathKeySet.has(cellKey)

      return (
        <div
          key={`roll-segment-${cellKey}`}
          className={`rollSegment${hasSequenceBoundary ? ' rollSegment-sequenceBoundary' : ''}${isSelectedCell ? ' rollSegment-selected' : ''}`}
          style={
            {
              flexGrow: normalizedWeight,
              flexBasis: 0,
              '--roll-sequence-boundary-depth': sequenceDepth,
            } as CSSProperties
          }
        >
          {renderedNotes.length > 0 ? (
            <div className="rollCellNoteLayer" aria-hidden="true">
              {renderedNotes}
            </div>
          ) : null}
          {hasChildCells ? (
            <div className="rollBranch">
              {childCells.map((childCell, index) =>
                renderCell(
                  childCell,
                  [...cellPath, index],
                  sequenceDepth + 1,
                  index > 0 ? childCells[index - 1] ?? null : null
                )
              )}
            </div>
          ) : (
            <div
              className={`rollIsland${isSelected ? ' rollIsland-selected' : ''}${isSelectedStart ? ' rollIsland-selectedStart' : ''}${isSelectedEnd ? ' rollIsland-selectedEnd' : ''}`}
            >
              <div className="rollIslandGrid">
                {pitchRows.map((pitch) => (
                  <div
                    key={`roll-island-${cellKey}-row-${pitch}`}
                    className={`rollRow ${(staffLineBandByPitch[pitch] ?? 0) === 0 ? 'rollRow-bandEven' : 'rollRow-bandOdd'}`}
                  >
                    <div className="rollRowLine" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    },
    [
      pitchRows,
      selectedCellPathKey,
      selectedElementIndex,
      selectedElementKind,
      selectedLeafEndPathKeySet,
      selectedLeafPathKeySet,
      selectedLeafStartPathKeySet,
      staffLineBandByPitch,
      tuningLength,
    ]
  )

  const renderRootRollCell = useCallback(
    (cell: Cell, path: number[], sequenceDepth: number) => {
      const rootPath = path.length === 0 ? [] : path
      return renderRollCell(cell, rootPath, sequenceDepth)
    },
    [renderRollCell]
  )

  return {
    backgroundOverlayStates,
    pitchRows,
    ratioToBottom,
    renderRollCell: renderRootRollCell,
  }
}
