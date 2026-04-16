import { type CSSProperties, useCallback, useMemo } from 'react'
import {
  REFERENCE_RATIOS,
  clampNumber,
  getCellWeight,
  getLargestElement,
  getPatternIndices,
  getPrimaryElement,
  normalizePitch,
  parsePatternPrefix,
  pathToKey,
} from '../shared'
import type { BgOverlayState, Cell, LeafCell } from '../shared'

type UseSequencerRollStateArgs = {
  commandText: string
  isCommandMode: boolean
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

  const renderRollCells = useCallback(
    function renderCells(cells: Cell[], parentPath: number[], sequenceDepth: number) {
      if (cells.length === 0) {
        return []
      }

      return cells.map((cell, index) => {
        const normalizedWeight = getCellWeight(cell.weight)
        const cellPath = [...parentPath, index]
        const cellKey = pathToKey(cellPath)
        const primaryElement = getPrimaryElement(cell)
        const noteElements = cell.elements.filter((element) => element.type === 'Note')
        const previousSibling = index > 0 ? cells[index - 1] : null
        const previousPrimaryElement = previousSibling ? getPrimaryElement(previousSibling) : null
        const hasSequenceBoundary =
          index > 0 &&
          (primaryElement?.type === 'Sequence' || previousPrimaryElement?.type === 'Sequence')

        const renderedNotes =
          tuningLength > 0
            ? noteElements.map((noteElement, noteIndex) => {
                const normalizedVelocity = clampNumber(noteElement.velocity, 0, 1)
                const normalizedDelay = clampNumber(noteElement.delay, 0, 1)
                const normalizedGate = clampNumber(noteElement.gate, 0, 1)
                const normalizedPitch = normalizePitch(noteElement.pitch, tuningLength)
                const rowFromTop = tuningLength - 1 - normalizedPitch
                const rowHeightPercent = 100 / Math.max(tuningLength, 1)
                const noteHeightPercent = rowHeightPercent * 0.76
                const noteTopPercent =
                  rowFromTop * rowHeightPercent + (rowHeightPercent - noteHeightPercent) / 2
                const noteOctave = Math.floor(noteElement.pitch / tuningLength)

                return (
                  <div
                    key={`roll-segment-${cellKey}-note-${noteIndex}`}
                    className={`rollCellNote${normalizedDelay > 0 ? ' rollNote-hasDelay' : ''}${normalizedGate < 1 ? ' rollNote-shortGate' : ''}`}
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

        if (primaryElement?.type === 'Sequence' && primaryElement.cells.length > 0) {
          return (
            <div
              key={`roll-segment-${cellKey}`}
              className={`rollSegment${hasSequenceBoundary ? ' rollSegment-sequenceBoundary' : ''}`}
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
              <div className="rollBranch">
                {renderCells(primaryElement.cells, cellPath, sequenceDepth + 1)}
              </div>
            </div>
          )
        }

        const isSelected = selectedLeafPathKeySet.has(cellKey)
        const isSelectedStart = selectedLeafStartPathKeySet.has(cellKey)
        const isSelectedEnd = selectedLeafEndPathKeySet.has(cellKey)

        return (
          <div
            key={`roll-segment-${cellKey}`}
            className={`rollSegment${hasSequenceBoundary ? ' rollSegment-sequenceBoundary' : ''}`}
            style={
              {
                flexGrow: normalizedWeight,
                flexBasis: 0,
                '--roll-sequence-boundary-depth': sequenceDepth,
              } as CSSProperties
            }
          >
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
                {renderedNotes.length > 0 ? (
                  <div className="rollCellNoteLayer" aria-hidden="true">
                    {renderedNotes}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )
      })
    },
    [
      pitchRows,
      selectedLeafEndPathKeySet,
      selectedLeafPathKeySet,
      selectedLeafStartPathKeySet,
      staffLineBandByPitch,
      tuningLength,
    ]
  )

  return {
    backgroundOverlayStates,
    pitchRows,
    ratioToBottom,
    renderRollCells,
  }
}
