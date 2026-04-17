import { useCallback, useMemo } from 'react'
import {
  REFERENCE_RATIOS,
  clampNumber,
  getCellWeight,
  getLargestElement,
  normalizePitch,
} from '../shared'
import type { BgOverlayState, Cell, SelectionPath, SequenceElement } from '../shared'

type RollNoteSpan = {
  x: number
  width: number
  pitch: number
  velocity: number
  isSelected: boolean
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

type SelectionTraversal = {
  currentCell: Cell
  currentStart: number
  currentWidth: number
  selectedElement: Cell['elements'][number] | null
  selectedElementKind: 'element' | 'cell' | null
  selectedCell: Cell | null
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

  const resolveSelectionTraversal = useCallback(
    (path: SelectionPath): SelectionTraversal => {
      let currentCell = rootCell
      let currentStart = 0
      let currentWidth = 1
      let selectedElement: Cell['elements'][number] | null = null
      let selectedElementKind: 'element' | 'cell' | null = path.length === 0 ? 'cell' : null

      for (const step of path) {
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

      if (path.length === 0) {
        selectedElementKind = 'cell'
      }

      return {
        currentCell,
        currentStart,
        currentWidth,
        selectedElement,
        selectedElementKind,
        selectedCell: currentCell,
      }
    },
    [rootCell]
  )

  const flattenRollNotes = useCallback(
    (cell: Cell, selection: SelectionTraversal): RollNoteSpan[] => {
      const noteSpans: RollNoteSpan[] = []
      const selectedElement = selection.selectedElement
      const selectedElementKind = selection.selectedElementKind
      const selectedCell = selection.selectedCell

      const walkCell = (
        currentCell: Cell,
        segmentStart: number,
        segmentWidth: number,
        selectedSubtree: boolean
      ): void => {
        if (segmentWidth <= 0) {
          return
        }

        const cellIsSelected = selectedElementKind === 'cell' && currentCell === selectedCell

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
            isSelected:
              selectedSubtree ||
              cellIsSelected ||
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
              selectedSubtree ||
                cellIsSelected ||
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

  const selectionTraversal = useMemo(
    () => resolveSelectionTraversal(selectionPath),
    [resolveSelectionTraversal, selectionPath]
  )

  const rollNotes = useMemo(
    () => flattenRollNotes(rootCell, selectionTraversal),
    [flattenRollNotes, rootCell, selectionTraversal]
  )

  const resolveSelectionSpans = useCallback((selection: SelectionTraversal): RollSelectionSpan[] => {
    const { currentStart, currentWidth, selectedElement, selectedElementKind } = selection
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
  }, [])

  const collectSequenceDividerPositions = useCallback(
    (selection: SelectionTraversal): number[] => {
      const positions = new Set<string>()
      const output: number[] = []

      const addPosition = (position: number): void => {
        const key = position.toFixed(6)
        if (positions.has(key)) {
          return
        }
        positions.add(key)
        output.push(position)
      }

      const walkCell = (currentCell: Cell, currentStart: number, currentWidth: number): void => {
        for (const element of currentCell.elements) {
          if (element.type !== 'Sequence' || element.cells.length === 0) {
            continue
          }

          walkSequence(element, currentStart, currentWidth)
        }
      }

      const walkSequence = (currentSequence: SequenceElement, currentStart: number, currentWidth: number): void => {
        addPosition(currentStart)

        const totalWeight = currentSequence.cells.reduce((sum, child) => sum + getCellWeight(child.weight), 0)
        if (totalWeight <= 0) {
          addPosition(currentStart + currentWidth)
          return
        }

        let cursor = currentStart
        currentSequence.cells.forEach((childCell, index) => {
          const childWidth = (currentWidth * getCellWeight(childCell.weight)) / totalWeight
          if (index > 0) {
            addPosition(cursor)
          }

          walkCell(childCell, cursor, childWidth)

          cursor += childWidth
        })

        addPosition(currentStart + currentWidth)
      }

      if (selection.selectedElementKind === 'element' && selection.selectedElement?.type === 'Sequence') {
        walkSequence(selection.selectedElement, selection.currentStart, selection.currentWidth)
      } else if (selection.selectedElementKind === 'cell') {
        walkCell(selection.currentCell, selection.currentStart, selection.currentWidth)
      } else {
        return []
      }

      return output.sort((a, b) => a - b)
    },
    []
  )

  const selectionSpans = useMemo(
    () => resolveSelectionSpans(selectionTraversal),
    [resolveSelectionSpans, selectionTraversal]
  )

  const sequenceDividerPositions = useMemo(() => {
    return collectSequenceDividerPositions(selectionTraversal)
  }, [collectSequenceDividerPositions, selectionTraversal])

  return {
    backgroundOverlayStates,
    pitchRows,
    ratioToBottom,
    rollNotes,
    sequenceDividerPositions,
    selectionSpans,
  }
}
