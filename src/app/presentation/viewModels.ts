import { clampNumber, getChildCells } from '../domain/music'
import type { Cell, NoteSpanIR } from '../domain/music'
import type { PatternPrefix } from '../domain/models'

export type BgOverlayState = {
  sequenceIndex: number
  notes: NoteSpanIR[]
  triggerPhase: number | null
}

export type LeafCell = {
  path: number[]
}

export type TimeSignatureParts = {
  numerator: number
  denominator: number
}

export const getSequenceOverlayColor = (_sequenceIndex: number, alpha: number): string =>
  `rgb(245 196 90 / ${clampNumber(alpha, 0, 1)})`

export const parsePatternPrefix = (value: string): PatternPrefix | null => {
  const tokens = value
    .trimStart()
    .split(/\s+/)
    .filter((token) => token.length > 0)

  if (tokens.length === 0) {
    return null
  }

  let cursor = 0
  let offset = 0
  let hasOffsetToken = false
  const firstToken = tokens[0]
  if (firstToken && /^\+\d+$/.test(firstToken)) {
    offset = Math.max(0, Math.trunc(Number(firstToken.slice(1))))
    hasOffsetToken = true
    cursor += 1
  }

  const intervals: number[] = []
  while (cursor < tokens.length) {
    const token = tokens[cursor]
    if (!token || !/^\d+$/.test(token)) {
      break
    }

    const interval = Math.trunc(Number(token))
    if (interval > 0) {
      intervals.push(interval)
    }
    cursor += 1
  }

  if (intervals.length === 0 && hasOffsetToken) {
    return { offset, intervals: [1] }
  }

  if (intervals.length === 0) {
    return null
  }

  return { offset, intervals }
}

export const getPatternIndices = (sequenceLength: number, pattern: PatternPrefix): Set<number> => {
  const matches = new Set<number>()
  if (sequenceLength <= 0) {
    return matches
  }

  let position = pattern.offset
  let intervalIndex = 0
  while (position < sequenceLength) {
    if (position >= 0) {
      matches.add(position)
    }

    position += pattern.intervals[intervalIndex] ?? 1
    intervalIndex = (intervalIndex + 1) % pattern.intervals.length
  }

  return matches
}

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName
  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT'
  )
}

export const collectLeafCells = (rootCell: Cell): LeafCell[] => {
  const result: LeafCell[] = []

  const walk = (cell: Cell, path: number[]): void => {
    const childCells = getChildCells(cell)
    if (childCells.length === 0) {
      result.push({ path })
      return
    }

    childCells.forEach((childCell, index) => {
      walk(childCell, [...path, index])
    })
  }

  walk(rootCell, [])

  return result
}

export const isPathPrefix = (prefix: number[], path: number[]): boolean => {
  if (prefix.length > path.length) {
    return false
  }

  for (let index = 0; index < prefix.length; index += 1) {
    if (prefix[index] !== path[index]) {
      return false
    }
  }

  return true
}

export const pathToKey = (path: number[]): string => path.join('.')

export const getCellAtPath = (rootCell: Cell, path: number[]): Cell | null => {
  let currentCell: Cell | null = rootCell

  for (const segment of path) {
    const childCells: Cell[] = currentCell ? getChildCells(currentCell) : []
    const nextCell: Cell | undefined = childCells[segment]
    if (!nextCell) {
      return null
    }

    currentCell = nextCell
  }

  return currentCell
}

export const parseTimeSignatureInput = (value: string): TimeSignatureParts | null => {
  const match = value.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
  if (!match) {
    return null
  }

  const numeratorText = match[1]
  const denominatorText = match[2]
  if (!numeratorText || !denominatorText) {
    return null
  }
  const numerator = Number.parseInt(numeratorText, 10)
  const denominator = Number.parseInt(denominatorText, 10)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null
  }
  if (numerator <= 0 || denominator <= 0) {
    return null
  }

  return { numerator, denominator }
}

export const formatTimeSignature = ({ numerator, denominator }: TimeSignatureParts): string =>
  `${numerator}/${denominator}`

export const parseIntegerInput = (value: string): number | null => {
  const trimmed = value.trim()
  if (!/^-?\d+$/.test(trimmed)) {
    return null
  }
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export const parsePositiveFloatInput = (value: string): number | null => {
  const trimmed = value.trim()
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return null
  }
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}
