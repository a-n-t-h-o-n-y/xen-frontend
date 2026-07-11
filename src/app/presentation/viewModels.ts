import { clampNumber, getChildCells, getPrimaryElement } from '../domain/music'
import type { Cell, MusicElement, NoteSpanIR } from '../domain/music'
import type { LibraryCommandEntry, PatternPrefix } from '../domain/models'

export type LibraryHierarchyRow = {
  kind: 'directory' | 'file'
  key: string
  label: string
  depth: number
  entry?: LibraryCommandEntry
}

export type TuningSortMode = 'name' | 'noteCount' | 'octave'

export type BgOverlayState = {
  sequenceIndex: number
  notes: NoteSpanIR[]
  triggerPhase: number | null
}

export type LeafCell = {
  path: number[]
}

export type StatusCellMetaItem = {
  label: string
  value: string
}

export type TimeSignatureParts = {
  numerator: number
  denominator: number
}

export const getSequenceOverlayColor = (_sequenceIndex: number, alpha: number): string =>
  `rgb(245 196 90 / ${clampNumber(alpha, 0, 1)})`

export const formatOctaveForDisplay = (value: number): string => {
  const rounded = value.toFixed(2)
  return rounded.endsWith('.00') ? rounded.slice(0, -3) : rounded
}

export const getHierarchyRows = (
  entries: LibraryCommandEntry[],
  options?: { sortByName?: boolean }
): LibraryHierarchyRow[] => {
  const directoryRows = new Set<string>()
  const rows: LibraryHierarchyRow[] = []

  const sortedEntries = options?.sortByName === false
    ? [...entries]
    : [...entries].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  for (const entry of sortedEntries) {
    const normalized = entry.name.replace(/\\/g, '/')
    const parts = normalized.split('/').filter((part) => part.length > 0)
    const fallbackLabel = entry.name || entry.stem
    const leafLabel = parts[parts.length - 1] ?? fallbackLabel
    const directories = parts.slice(0, -1)

    let currentPath = ''
    directories.forEach((directory, index) => {
      currentPath = currentPath ? `${currentPath}/${directory}` : directory
      if (directoryRows.has(currentPath)) {
        return
      }
      directoryRows.add(currentPath)
      rows.push({
        kind: 'directory',
        key: `dir:${currentPath}`,
        label: directory,
        depth: index,
      })
    })

    rows.push({
      kind: 'file',
      key: `file:${normalized}:${entry.path || entry.name}`,
      label: leafLabel,
      depth: directories.length,
      entry,
    })
  }

  return rows
}

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

export const formatMetaNumber = (value: number, precision = 2): string => {
  if (!Number.isFinite(value)) {
    return '0'
  }
  const rounded = value.toFixed(precision)
  return rounded.replace(/\.?0+$/, '')
}

export const formatMetaFixed2 = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0.00'
  }
  return value.toFixed(2)
}

export const getStatusCellMeta = (
  cell: Cell | null,
  selectedElement?: MusicElement | null
): StatusCellMetaItem[] => {
  if (!cell) {
    return []
  }

  const element = selectedElement ?? getPrimaryElement(cell)

  if (!element) {
    return [{ label: 'w', value: formatMetaNumber(cell.weight) }]
  }

  if (element.type === 'Sequence') {
    return [
      { label: 'n', value: `${element.cells.length}` },
      { label: 'w', value: formatMetaNumber(cell.weight) },
    ]
  }

  return [
    { label: 'p', value: `${Math.trunc(element.pitch)}` },
    { label: 'd', value: formatMetaFixed2(element.delay) },
    { label: 'g', value: formatMetaFixed2(element.gate) },
    { label: 'v', value: formatMetaFixed2(element.velocity) },
    { label: 'w', value: formatMetaNumber(cell.weight) },
  ]
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
