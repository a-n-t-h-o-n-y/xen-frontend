import { useCallback, useMemo } from 'react'
import {
  REFERENCE_RATIOS,
  clampNumber,
  getCellWeight,
  getLargestElement,
  normalizePitch,
  resolveSelectionPath,
} from '../shared'
import type { BgOverlayState, Cell, SelectionPath } from '../shared'

type RollNoteSpan = {
  x: number
  width: number
  pitch: number
  velocity: number
  isGlowing: boolean
  hasDelay: boolean
  shortGate: boolean
  octaveLabel: string | null
}

type RollSelectionSpan = {
  x: number
  width: number
  tone: 'selected' | 'sequenceEven' | 'sequenceOdd'
  hasRightDivider: boolean
}

type UseSequencerRollStateArgs = {
  rootCell: Cell
  selectionPath: SelectionPath
  tuningLength: number
}

export function useSequencerRollState({
  rootCell,
  selectionPath,
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

  const flattenRollNotes = useCallback(
    (cell: Cell, selection: ReturnType<typeof resolveSelectionPath>): RollNoteSpan[] => {
      const noteSpans: RollNoteSpan[] = []
      const selectedElement = selection.selectedElement
      const selectedElementKind = selection.selectedElementKind

      const walkCell = (
        currentCell: Cell,
        segmentStart: number,
        segmentWidth: number,
        glowSubtree: boolean
      ): void => {
        if (segmentWidth <= 0) {
          return
        }

        for (const element of currentCell.elements) {
          if (element.type !== 'Note') {
            continue
          }

          const normalizedVelocity = clampNumber(element.velocity, 0, 1)
          const normalizedDelay = clampNumber(element.delay, 0, 1)
          const normalizedGate = clampNumber(element.gate, 0, 1)
          const noteStart = segmentStart + normalizedDelay * segmentWidth
          const noteWidth = Math.max(0, (1 - normalizedDelay) * normalizedGate * segmentWidth)
          const clampedStart = clampNumber(noteStart, 0, 1)
          const clampedEnd = clampNumber(noteStart + noteWidth, 0, 1)
          const clampedWidth = clampedEnd - clampedStart
          if (clampedWidth <= 0) {
            continue
          }

          const noteOctave = tuningLength > 0 ? Math.floor(element.pitch / tuningLength) : 0

          noteSpans.push({
            x: clampedStart,
            width: clampedWidth,
            pitch: normalizePitch(element.pitch, tuningLength),
            velocity: normalizedVelocity,
            isGlowing:
              glowSubtree ||
              (selectedElementKind === 'element' &&
                selectedElement?.type === 'Note' &&
                element === selectedElement),
            hasDelay: normalizedDelay > 0,
            shortGate: normalizedGate < 1,
            octaveLabel: noteOctave === 0 ? null : noteOctave > 0 ? `+${noteOctave}` : `${noteOctave}`,
          })
        }

        for (const element of currentCell.elements) {
          if (element.type !== 'Sequence' || element.cells.length === 0) {
            continue
          }

          const totalWeight = element.cells.reduce((sum, child) => sum + getCellWeight(child.weight), 0)
          if (totalWeight <= 0) {
            continue
          }

          let cursor = segmentStart
          for (const child of element.cells) {
            const childWidth = (segmentWidth * getCellWeight(child.weight)) / totalWeight
            walkCell(
              child,
              cursor,
              childWidth,
              glowSubtree ||
                (selectedElementKind === 'element' &&
                  selectedElement?.type === 'Sequence' &&
                  element === selectedElement)
            )
            cursor += childWidth
          }
        }
      }

      walkCell(cell, 0, 1, false)
      return noteSpans
    },
    [tuningLength]
  )

  const resolvedSelection = useMemo(
    () => resolveSelectionPath(rootCell, selectionPath),
    [rootCell, selectionPath]
  )

  const rollNotes = useMemo(
    () => flattenRollNotes(rootCell, resolvedSelection),
    [flattenRollNotes, resolvedSelection, rootCell]
  )

  const selectionSpans = useMemo((): RollSelectionSpan[] => {
    let currentCell = rootCell
    let currentStart = 0
    let currentWidth = 1
    let selectedElement: Cell['elements'][number] | null = null
    let selectedElementKind: 'element' | 'cell' | null = null

    for (const step of selectionPath) {
      if (step.kind === 'element') {
        if (step.index >= currentCell.elements.length) {
          break
        }

        selectedElement = currentCell.elements[step.index] ?? null
        selectedElementKind = 'element'
        continue
      }

      if (selectedElement?.type !== 'Sequence' || step.index >= selectedElement.cells.length) {
        break
      }

      const totalWeight = selectedElement.cells.reduce((sum, child) => sum + getCellWeight(child.weight), 0)
      if (totalWeight <= 0) {
        break
      }

      let cursor = currentStart
      let nextCell: Cell | null = null
      let nextStart = currentStart
      let nextWidth = currentWidth

      selectedElement.cells.forEach((child, index) => {
        const childWidth = (currentWidth * getCellWeight(child.weight)) / totalWeight
        if (index === step.index) {
          nextCell = child
          nextStart = cursor
          nextWidth = childWidth
        }
        cursor += childWidth
      })

      if (!nextCell) {
        break
      }

      currentCell = nextCell
      currentStart = nextStart
      currentWidth = nextWidth
      selectedElement = null
      selectedElementKind = 'cell'
    }

    const spans: RollSelectionSpan[] = [
      {
        x: currentStart,
        width: currentWidth,
        tone: 'selected',
        hasRightDivider: false,
      },
    ]

    if (selectedElementKind === 'element' && selectedElement?.type === 'Sequence') {
      const totalWeight = selectedElement.cells.reduce((sum, child) => sum + getCellWeight(child.weight), 0)
      if (totalWeight > 0) {
        let cursor = currentStart
        selectedElement.cells.forEach((child, index) => {
          const childWidth = (currentWidth * getCellWeight(child.weight)) / totalWeight
          spans.push({
            x: cursor,
            width: childWidth,
            tone: index % 2 === 0 ? 'sequenceEven' : 'sequenceOdd',
            hasRightDivider: index < selectedElement.cells.length - 1,
          })
          cursor += childWidth
        })
      }
    }

    return spans.filter((span) => span.width > 0)
  }, [rootCell, selectionPath])

  return {
    backgroundOverlayStates,
    pitchRows,
    ratioToBottom,
    rollNotes,
    selectionSpans,
  }
}
