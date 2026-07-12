import type { TranslateDirection } from './models'

export type SelectionStep = {
  kind: 'element' | 'cell'
  index: number
}

export type Selection = {
  path: SelectionStep[]
}

export type SelectionPath = Selection['path']

export type NoteElement = {
  type: 'Note'
  pitch: number
  velocity: number
  delay: number
  gate: number
}

export type SequenceElement = {
  type: 'Sequence'
  cells: Cell[]
}

export type MusicElement = NoteElement | SequenceElement

export type Cell = {
  weight: number
  elements: MusicElement[]
}

export type Sequence = {
  cell: Cell
  timeSignature: {
    numerator: number
    denominator: number
  }
}

export const REFERENCE_RATIOS = [
  Math.log2(1 / 1),
  Math.log2(3 / 2),
  Math.log2(4 / 3),
  Math.log2(5 / 4),
  Math.log2(6 / 5),
  Math.log2(5 / 3),
  Math.log2(8 / 5),
  Math.log2(9 / 8),
  Math.log2(16 / 9),
  Math.log2(15 / 8),
  Math.log2(16 / 15),
  Math.log2(45 / 32),
].sort((a, b) => a - b)

export const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const normalizePhase = (value: number): number => ((value % 1) + 1) % 1

export const roundByStep = (value: number, step: number): number =>
  step <= 0 ? value : Math.round(value / step) * step

export const getSequenceLoopQuarterNotes = (sequence: Sequence | null): number => {
  if (!sequence) {
    return 0
  }

  const numerator = sequence.timeSignature.numerator
  const denominator = sequence.timeSignature.denominator
  if (numerator <= 0 || denominator <= 0) {
    return 0
  }

  return numerator * (4 / denominator)
}

export const normalizePitch = (pitch: number, tuningLength: number): number => {
  const modulo = pitch % tuningLength
  return modulo >= 0 ? modulo : modulo + tuningLength
}

export const getPrimaryElement = (cell: Cell): MusicElement | null => cell.elements[0] ?? null

export const getSequenceElements = (
  cell: Cell
): Extract<MusicElement, { type: 'Sequence' }>[] =>
  cell.elements.filter(
    (element): element is Extract<MusicElement, { type: 'Sequence' }> => element.type === 'Sequence'
  )

export const getNoteElements = (cell: Cell): Extract<MusicElement, { type: 'Note' }>[] =>
  cell.elements.filter(
    (element): element is Extract<MusicElement, { type: 'Note' }> => element.type === 'Note'
  )

export const getSelectedElement = (
  cell: Cell,
  elementIndex: number | null | undefined
): MusicElement | null => {
  if (
    typeof elementIndex === 'number' &&
    Number.isInteger(elementIndex) &&
    elementIndex >= 0 &&
    elementIndex < cell.elements.length
  ) {
    return cell.elements[elementIndex] ?? null
  }

  return getPrimaryElement(cell)
}

export const getChildCells = (cell: Cell): Cell[] => {
  return getSequenceElements(cell).flatMap((element) => element.cells)
}

export const getTuningRatios = (intervals: number[]): number[] =>
  Array.from(new Set(intervals.map((cents) => cents / 1200))).sort((a, b) => a - b)

export const getLargestElement = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }

  return values[values.length - 1]!
}

export const euclidMod = (value: number, modulo: number): number => {
  if (modulo === 0) {
    return 0
  }
  return ((value % modulo) + modulo) % modulo
}

export type ScaleLike = {
  intervals: number[]
  mode: number
}

export const generateValidPitches = (scale: ScaleLike, tuningLength: number): number[] => {
  if (scale.intervals.length === 0) {
    return [0]
  }

  const modeOffset = euclidMod(Math.trunc(scale.mode) - 1, scale.intervals.length)
  const rotatedIntervals = scale.intervals.map((_, index) => {
    const intervalIndex = euclidMod(index + modeOffset, scale.intervals.length)
    return Math.trunc(scale.intervals[intervalIndex] ?? 0)
  })

  const validPitches = [0]
  for (const interval of rotatedIntervals) {
    const nextPitch = validPitches[validPitches.length - 1]! + interval
    if (nextPitch < tuningLength) {
      validPitches.push(nextPitch)
    }
  }

  return Array.from(new Set(validPitches)).sort((a, b) => a - b)
}

export const mapPitchToScale = (
  pitch: number,
  validPitches: number[],
  tuningLength: number,
  direction: TranslateDirection
): number => {
  if (validPitches.length === 0 || tuningLength <= 0) {
    return pitch
  }

  let octaveShift = Math.floor(pitch / tuningLength)
  const normalizedPitch = euclidMod(pitch, tuningLength)
  let index = validPitches.findIndex((validPitch) => validPitch >= normalizedPitch)

  if (index === -1 || validPitches[index] !== normalizedPitch) {
    if (direction === 'down') {
      if (index <= 0) {
        index = validPitches.length - 1
        octaveShift -= 1
      } else {
        index -= 1
      }
    } else if (index === -1) {
      index = 0
      octaveShift += 1
    }
  }

  return (validPitches[index] ?? normalizedPitch) + octaveShift * tuningLength
}

export const collectNotePitches = (target: Cell | MusicElement): number[] => {
  if ('elements' in target) {
    return target.elements.flatMap(collectNotePitches)
  }

  if (target.type === 'Note') {
    return [target.pitch]
  }

  return target.cells.flatMap(collectNotePitches)
}

export const getCellWeight = (weight: number): number => (weight > 0 ? weight : 1)

export type NoteSpanIR = {
  sequenceIndex: number
  pitch: number
  x: number
  width: number
  velocity: number
}

export const flattenSequenceToNoteIR = (sequence: Sequence, sequenceIndex: number): NoteSpanIR[] => {
  const noteSpans: NoteSpanIR[] = []

  const walkCell = (cell: Cell, segmentStart: number, segmentWidth: number): void => {
    if (segmentWidth <= 0) {
      return
    }

    for (const element of cell.elements) {
      if (element.type !== 'Note') {
        continue
      }

      const noteDelay = clampNumber(element.delay, 0, 1)
      const noteGate = clampNumber(element.gate, 0, 1)
      const noteStart = segmentStart + noteDelay * segmentWidth
      const noteEnd = noteStart + Math.max(0, (1 - noteDelay) * noteGate * segmentWidth)
      const clampedStart = clampNumber(noteStart, 0, 1)
      const clampedEnd = clampNumber(noteEnd, 0, 1)
      const clampedWidth = clampedEnd - clampedStart
      if (clampedWidth <= 0) {
        continue
      }

      noteSpans.push({
        sequenceIndex,
        pitch: element.pitch,
        x: clampedStart,
        width: clampedWidth,
        velocity: clampNumber(element.velocity, 0, 1),
      })
    }

    for (const element of cell.elements) {
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
        walkCell(child, cursor, childWidth)
        cursor += childWidth
      }
    }
  }

  walkCell(sequence.cell, 0, 1)
  return noteSpans
}

export const windowBackgroundNotes = (
  bgIr: NoteSpanIR[],
  ratioFgToBg: number,
  selectedPhase: number,
  bgPhase: number
): NoteSpanIR[] => {
  if (!Number.isFinite(ratioFgToBg) || ratioFgToBg <= 0) {
    return []
  }

  const bgPhaseAtSelectedStart = bgPhase - selectedPhase * ratioFgToBg
  const bgWindowStart = bgPhaseAtSelectedStart
  const bgWindowEnd = bgPhaseAtSelectedStart + ratioFgToBg
  const projectedNotes: NoteSpanIR[] = []

  for (const note of bgIr) {
    const noteStart = clampNumber(note.x, 0, 1)
    const noteEnd = clampNumber(note.x + note.width, 0, 1)
    if (noteEnd <= noteStart) {
      continue
    }

    const firstLoop = Math.floor(bgWindowStart - noteEnd) + 1
    const lastLoop = Math.ceil(bgWindowEnd - noteStart) - 1

    for (let loopIndex = firstLoop; loopIndex <= lastLoop; loopIndex += 1) {
      const loopStart = loopIndex + noteStart
      const loopEnd = loopIndex + noteEnd
      const overlapStart = Math.max(loopStart, bgWindowStart)
      const overlapEnd = Math.min(loopEnd, bgWindowEnd)
      if (overlapEnd <= overlapStart) {
        continue
      }

      const projectedStart = clampNumber(
        (overlapStart - bgPhaseAtSelectedStart) / ratioFgToBg,
        0,
        1
      )
      const projectedEnd = clampNumber((overlapEnd - bgPhaseAtSelectedStart) / ratioFgToBg, 0, 1)
      const projectedWidth = projectedEnd - projectedStart
      if (projectedWidth <= 0) {
        continue
      }

      projectedNotes.push({
        sequenceIndex: note.sequenceIndex,
        pitch: note.pitch,
        x: projectedStart,
        width: projectedWidth,
        velocity: note.velocity,
      })
    }
  }

  return projectedNotes
}

export const getProjectedBgTriggerPhase = (
  ratioFgToBg: number,
  selectedPhase: number,
  bgPhase: number
): number | null => {
  if (!Number.isFinite(ratioFgToBg) || ratioFgToBg <= 0) {
    return null
  }

  const bgPhaseAtSelectedStart = bgPhase - selectedPhase * ratioFgToBg
  const eps = 1e-9
  const triggerOrdinal = Math.ceil(bgPhaseAtSelectedStart - eps)
  const projected = (triggerOrdinal - bgPhaseAtSelectedStart) / ratioFgToBg
  if (!Number.isFinite(projected) || projected < 0 || projected >= 1) {
    return null
  }

  return projected
}
