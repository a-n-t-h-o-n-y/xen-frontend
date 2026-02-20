import { type CSSProperties, useCallback, useMemo } from 'react'
import {
  REFERENCE_RATIOS,
  TRANSPORT_SEQUENCE_COUNT,
  clampNumber,
  flattenMeasureToNoteIR,
  getCellWeight,
  getErrorMessage,
  getLargestElement,
  getMeasureLoopQuarterNotes,
  getPatternIndices,
  getProjectedBgTriggerPhase,
  normalizePitch,
  parsePatternPrefix,
  pathToKey,
  windowBackgroundNotes,
} from '../shared'
import type {
  BgOverlayState,
  Cell,
  LeafCell,
  Measure,
  MessageLevel,
  NoteSpanIR,
  SyncedTransportPhases,
  UiStateSnapshot,
} from '../shared'

type UseSequencerRollStateArgs = {
  snapshot: UiStateSnapshot | null
  selectedMeasure: Measure | null
  selectedLoopQuarterNotes: number
  selectedMeasureIndex: number
  sequenceBank: Measure[]
  syncedTransportPhases: SyncedTransportPhases
  activeSequenceFlags: boolean[]
  tuningLength: number
  commandText: string
  isCommandMode: boolean
  selectedLeafFlags: boolean[]
  leafCells: LeafCell[]
  leafPatternScopeIndices: number[]
  patternScopeCellCount: number
  staffLineBandByPitch: number[]
  bridgeUnavailableMessage: string | null
  executeBackendCommand: (command: string) => Promise<void>
  setStatusMessage: (value: string) => void
  setStatusLevel: (value: MessageLevel) => void
}

export function useSequencerRollState({
  snapshot,
  selectedMeasure,
  selectedLoopQuarterNotes,
  selectedMeasureIndex,
  sequenceBank,
  syncedTransportPhases,
  activeSequenceFlags,
  tuningLength,
  commandText,
  isCommandMode,
  selectedLeafFlags,
  leafCells,
  leafPatternScopeIndices,
  patternScopeCellCount,
  staffLineBandByPitch,
  bridgeUnavailableMessage,
  executeBackendCommand,
  setStatusMessage,
  setStatusLevel,
}: UseSequencerRollStateArgs) {
  const flattenedNoteIrBySequence = useMemo(() => {
    const flattened = Array.from({ length: TRANSPORT_SEQUENCE_COUNT }, () => [] as NoteSpanIR[])
    const boundedLength = Math.min(sequenceBank.length, TRANSPORT_SEQUENCE_COUNT)
    for (let index = 0; index < boundedLength; index += 1) {
      const measure = sequenceBank[index]
      if (!measure) {
        continue
      }
      flattened[index] = flattenMeasureToNoteIR(measure, index)
    }
    return flattened
  }, [sequenceBank])

  const backgroundOverlayStates = useMemo((): BgOverlayState[] => {
    if (!snapshot || !selectedMeasure || selectedLoopQuarterNotes <= 0) {
      return []
    }

    if (!activeSequenceFlags[selectedMeasureIndex]) {
      return []
    }

    const selectedPhase = syncedTransportPhases.unwrapped[selectedMeasureIndex] ?? 0
    const overlays: BgOverlayState[] = []

    for (let sequenceIndex = 0; sequenceIndex < TRANSPORT_SEQUENCE_COUNT; sequenceIndex += 1) {
      if (sequenceIndex === selectedMeasureIndex || !activeSequenceFlags[sequenceIndex]) {
        continue
      }

      const bgMeasure = sequenceBank[sequenceIndex]
      if (!bgMeasure) {
        continue
      }

      const bgLoopQuarterNotes = getMeasureLoopQuarterNotes(bgMeasure)
      if (bgLoopQuarterNotes <= 0) {
        continue
      }

      const ratioFgToBg = selectedLoopQuarterNotes / bgLoopQuarterNotes
      const bgPhase = syncedTransportPhases.unwrapped[sequenceIndex] ?? 0
      const projectedNotes = windowBackgroundNotes(
        flattenedNoteIrBySequence[sequenceIndex] ?? [],
        ratioFgToBg,
        selectedPhase,
        bgPhase
      )
      const triggerPhase = getProjectedBgTriggerPhase(ratioFgToBg, selectedPhase, bgPhase)
      if (projectedNotes.length === 0 && triggerPhase === null) {
        continue
      }

      overlays.push({
        sequenceIndex,
        notes: projectedNotes,
        triggerPhase,
      })
    }

    return overlays
  }, [
    activeSequenceFlags,
    flattenedNoteIrBySequence,
    selectedLoopQuarterNotes,
    selectedMeasure,
    selectedMeasureIndex,
    sequenceBank,
    snapshot,
    syncedTransportPhases,
  ])

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

  const selectSequenceFromBank = useCallback(
    (sequenceIndex: number): void => {
      if (bridgeUnavailableMessage !== null) {
        return
      }

      void executeBackendCommand(`select sequence ${sequenceIndex}`).catch((error: unknown) => {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      })
    },
    [bridgeUnavailableMessage, executeBackendCommand, setStatusLevel, setStatusMessage]
  )

  const sequenceBankCells = useMemo(
    () =>
      Array.from({ length: TRANSPORT_SEQUENCE_COUNT }, (_, index) => {
        const row = 4 - Math.floor(index / 4)
        const column = (index % 4) + 1
        return { index, row, column }
      }),
    []
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

      const siblings = cells

      return siblings.map((cell, index) => {
        const normalizedWeight = getCellWeight(cell.weight)
        const cellPath = [...parentPath, index]
        const cellKey = pathToKey(cellPath)
        const previousSibling = index > 0 ? siblings[index - 1] : null
        const hasSequenceBoundary =
          index > 0 && (cell.type === 'Sequence' || previousSibling?.type === 'Sequence')

        if (cell.type === 'Sequence' && cell.cells.length > 0) {
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
              <div className="rollBranch">{renderCells(cell.cells, cellPath, sequenceDepth + 1)}</div>
            </div>
          )
        }

        const isSelected = selectedLeafPathKeySet.has(cellKey)
        const isSelectedStart = selectedLeafStartPathKeySet.has(cellKey)
        const isSelectedEnd = selectedLeafEndPathKeySet.has(cellKey)
        const normalizedVelocity = cell.type === 'Note' ? clampNumber(cell.velocity, 0, 1) : 0
        const normalizedDelay = cell.type === 'Note' ? clampNumber(cell.delay, 0, 1) : 0
        const normalizedGate = cell.type === 'Note' ? clampNumber(cell.gate, 0, 1) : 0
        const normalizedPitch =
          cell.type === 'Note' && tuningLength > 0
            ? normalizePitch(cell.pitch, tuningLength)
            : cell.type === 'Note'
              ? Math.trunc(cell.pitch)
              : 0
        const noteOctave = cell.type === 'Note' && tuningLength > 0 ? Math.floor(cell.pitch / tuningLength) : 0

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
                    {cell.type === 'Note' && normalizedPitch === pitch ? (
                      <div
                        className={`rollNote${normalizedDelay > 0 ? ' rollNote-hasDelay' : ''}${normalizedGate < 1 ? ' rollNote-shortGate' : ''}`}
                        style={
                          {
                            left: `${normalizedDelay * 100}%`,
                            width: `max(${(1 - normalizedDelay) * normalizedGate * 100}%, 4px)`,
                            background: `rgb(241 245 249 / ${0.18 + normalizedVelocity * 0.72})`,
                          } as CSSProperties
                        }
                        aria-hidden="true"
                      >
                        {noteOctave !== 0 ? (
                          <span className="rollNoteOctave mono">{noteOctave > 0 ? `+${noteOctave}` : noteOctave}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
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
    selectSequenceFromBank,
    sequenceBankCells,
    renderRollCells,
  }
}
