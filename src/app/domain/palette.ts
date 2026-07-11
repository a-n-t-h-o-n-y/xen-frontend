import type {
  CommandReferenceEntry,
  LibrarySnapshot,
} from './models'

export type PaletteScope = 'all' | 'commands' | 'files' | 'tunings' | 'scales'

type PaletteItemBase = {
  id: string
  label: string
  detail: string
  keywords: string[]
  searchText: string
  active: boolean
}

export type CommandPaletteItem = PaletteItemBase & {
  kind: 'command'
  command: CommandReferenceEntry
}

export type FilePaletteItem = PaletteItemBase & {
  kind: 'file'
  fileKind: 'cell' | 'composition'
  backendCommand: string
}

export type TuningPaletteItem = PaletteItemBase & {
  kind: 'tuning'
  backendCommand: string
}

export type ScalePaletteItem = PaletteItemBase & {
  kind: 'scale'
  backendCommand: string
}

export type PaletteItem =
  | CommandPaletteItem
  | FilePaletteItem
  | TuningPaletteItem
  | ScalePaletteItem

export type PaletteSection = {
  id: string
  label: string
  items: PaletteItem[]
}

export type PaletteSources = {
  commands: CommandReferenceEntry[]
  library: LibrarySnapshot
  activeTuningName: string
  activeScaleId: string | null
}

const normalize = (value: string): string => value.trim().toLowerCase()

const leafName = (value: string): string => {
  const parts = value.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts[parts.length - 1] ?? value
}

const parentPath = (value: string): string => {
  const parts = value.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts.slice(0, -1).join('/')
}

const formatOctave = (value: number): string => {
  const rounded = value.toFixed(2)
  return rounded.endsWith('.00') ? rounded.slice(0, -3) : rounded
}

const commandItems = (commands: CommandReferenceEntry[]): CommandPaletteItem[] =>
  commands.map((command) => ({
    kind: 'command',
    id: `command:${command.id}`,
    label: command.id,
    detail: command.description,
    keywords: command.keywords,
    searchText: [command.id, command.signature, command.description, ...command.keywords].join(' '),
    active: false,
    command,
  }))

const libraryFileItems = (
  entries: LibrarySnapshot['cells'],
  fileKind: FilePaletteItem['fileKind']
): FilePaletteItem[] => entries.map((entry) => {
    const sourceName = entry.stem || entry.relativePath || entry.name
    const directory = parentPath(sourceName)
    return {
      kind: 'file',
      fileKind,
      id: `file:${fileKind}:${entry.path || entry.relativePath || entry.name}`,
      label: leafName(sourceName),
      detail: directory || entry.relativePath || entry.path,
      keywords: ['file', fileKind, entry.name, entry.stem, entry.relativePath],
      searchText: [entry.name, entry.stem, entry.relativePath, entry.path, `${fileKind} file`].join(' '),
      active: false,
      backendCommand: entry.command,
    }
  })

const fileItems = (library: LibrarySnapshot): FilePaletteItem[] => [
  ...libraryFileItems(library.cells, 'cell'),
  ...libraryFileItems(library.compositions, 'composition'),
]

const tuningItems = (
  library: LibrarySnapshot,
  activeTuningName: string
): TuningPaletteItem[] => library.tunings.map((tuning) => {
  const sourceName = tuning.stem || tuning.name
  const metadata = [
    tuning.description,
    `${tuning.noteCount} notes`,
    `octave ${formatOctave(tuning.octave)}`,
  ].filter(Boolean).join(' · ')
  return {
    kind: 'tuning',
    id: `tuning:${tuning.path || tuning.relativePath || tuning.name}`,
    label: leafName(sourceName),
    detail: metadata,
    keywords: [tuning.name, tuning.stem, tuning.relativePath, 'tuning'],
    searchText: [
      tuning.name,
      tuning.stem,
      tuning.relativePath,
      tuning.path,
      tuning.description,
      tuning.noteCount.toString(),
      tuning.octave.toString(),
    ].join(' '),
    active:
      normalize(tuning.name) === normalize(activeTuningName) ||
      normalize(tuning.stem) === normalize(activeTuningName),
    backendCommand: tuning.command,
  }
})

const scaleItems = (
  library: LibrarySnapshot,
  activeScaleId: string | null
): ScalePaletteItem[] => library.scales.map((scale) => {
  const label = scale.definition?.name ?? 'chromatic'
  const detail = scale.definition?.intervals.length
    ? `[${scale.definition.intervals.join(', ')}]`
    : 'Chromatic'
  return {
    kind: 'scale',
    id: `scale:${scale.id}`,
    label,
    detail,
    keywords: ['scale', label, scale.id],
    searchText: [label, scale.id, detail, 'scale'].join(' '),
    active: scale.id === activeScaleId,
    backendCommand: scale.command,
  }
})

export const buildPaletteItems = ({
  commands,
  library,
  activeTuningName,
  activeScaleId,
}: PaletteSources): PaletteItem[] => [
  ...commandItems(commands),
  ...fileItems(library),
  ...tuningItems(library, activeTuningName),
  ...scaleItems(library, activeScaleId),
]

export const scopeForItem = (item: PaletteItem): Exclude<PaletteScope, 'all'> => {
  if (item.kind === 'command') return 'commands'
  if (item.kind === 'file') return 'files'
  if (item.kind === 'tuning') return 'tunings'
  return 'scales'
}

const scopeLabels: Record<Exclude<PaletteScope, 'all'>, string> = {
  commands: 'Commands',
  files: 'Files',
  tunings: 'Tunings',
  scales: 'Scales',
}

const scopeOrder: Array<Exclude<PaletteScope, 'all'>> = [
  'commands',
  'files',
  'tunings',
  'scales',
]

const editDistance = (left: string, right: string): number => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0] ?? 0
    previous[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex] ?? 0
      previous[rightIndex] = left[leftIndex - 1] === right[rightIndex - 1]
        ? diagonal
        : Math.min(diagonal, above, previous[rightIndex - 1] ?? 0) + 1
      diagonal = above
    }
  }
  return previous[right.length] ?? Math.max(left.length, right.length)
}

type RankedItem = {
  item: PaletteItem
  quality: number
  score: number
  sourceIndex: number
  recentIndex: number
}

const rankItem = (
  item: PaletteItem,
  query: string,
  sourceIndex: number,
  recentItemIds: string[]
): RankedItem | null => {
  const normalizedQuery = normalize(query)
  const label = normalize(item.label)
  const words = label.split(/\s+/).filter(Boolean)
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean)
  const searchText = normalize(item.searchText)
  const recentIndex = recentItemIds.indexOf(item.id)

  if (!normalizedQuery) {
    return { item, quality: 0, score: 0, sourceIndex, recentIndex }
  }
  if (label === normalizedQuery) {
    return { item, quality: 0, score: 1, sourceIndex, recentIndex }
  }
  if (label.startsWith(normalizedQuery)) {
    return {
      item,
      quality: 1,
      score: normalizedQuery.length / Math.max(label.length, 1),
      sourceIndex,
      recentIndex,
    }
  }
  if (words.some((word) => word.startsWith(normalizedQuery))) {
    return { item, quality: 2, score: 1, sourceIndex, recentIndex }
  }
  const acronym = words.map((word) => word[0] ?? '').join('')
  if (normalizedQuery.length > 1 && acronym.startsWith(normalizedQuery)) {
    return { item, quality: 3, score: normalizedQuery.length / acronym.length, sourceIndex, recentIndex }
  }
  if (queryWords.every((queryWord) => words.some((word) => word.includes(queryWord)))) {
    return { item, quality: 4, score: queryWords.length / Math.max(words.length, 1), sourceIndex, recentIndex }
  }
  if (searchText.includes(normalizedQuery)) {
    return { item, quality: 5, score: normalizedQuery.length / Math.max(searchText.length, 1), sourceIndex, recentIndex }
  }
  if (
    normalizedQuery.length >= 3 &&
    words.some((word) =>
      Math.abs(word.length - normalizedQuery.length) <= 2 &&
      editDistance(normalizedQuery, word) <= (normalizedQuery.length >= 7 ? 2 : 1)
    )
  ) {
    return { item, quality: 6, score: 0, sourceIndex, recentIndex }
  }
  return null
}

export const rankPaletteItems = (
  items: PaletteItem[],
  query: string,
  recentItemIds: string[] = []
): PaletteItem[] => items
  .map((item, index) => rankItem(item, query, index, recentItemIds))
  .filter((item): item is RankedItem => item !== null)
  .sort((left, right) => {
    if (left.quality !== right.quality) return left.quality - right.quality
    const leftRecent = left.recentIndex === -1 ? Number.MAX_SAFE_INTEGER : left.recentIndex
    const rightRecent = right.recentIndex === -1 ? Number.MAX_SAFE_INTEGER : right.recentIndex
    if (leftRecent !== rightRecent) return leftRecent - rightRecent
    if (left.score !== right.score) return right.score - left.score
    return left.sourceIndex - right.sourceIndex
  })
  .map(({ item }) => item)

export const getPaletteSections = (
  items: PaletteItem[],
  scope: Exclude<PaletteScope, 'commands'>,
  query: string,
  recentItemIds: string[]
): PaletteSection[] => {
  if (scope !== 'all') {
    const scoped = items.filter((item) => scopeForItem(item) === scope)
    return [{
      id: scope,
      label: scopeLabels[scope],
      items: rankPaletteItems(scoped, query, recentItemIds),
    }]
  }

  if (query.trim()) {
    const merged = scopeOrder.flatMap((providerScope) =>
      rankPaletteItems(
        items.filter((item) => scopeForItem(item) === providerScope),
        query,
        recentItemIds
      ).slice(0, 10)
    )
    return [{
      id: 'results',
      label: 'Results',
      items: rankPaletteItems(merged, query, recentItemIds),
    }]
  }

  const recentItems = recentItemIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is PaletteItem => item !== undefined)
    .slice(0, 6)
  const recentSet = new Set(recentItems.map((item) => item.id))
  const sections: PaletteSection[] = recentItems.length > 0
    ? [{ id: 'recent', label: 'Recent', items: recentItems }]
    : []

  for (const providerScope of scopeOrder) {
    const providerItems = items
      .filter((item) => scopeForItem(item) === providerScope && !recentSet.has(item.id))
      .slice(0, 4)
    if (providerItems.length > 0) {
      sections.push({
        id: providerScope,
        label: scopeLabels[providerScope],
        items: providerItems,
      })
    }
  }
  return sections
}

export const consumePaletteScopePrefix = (
  value: string
): { scope: Exclude<PaletteScope, 'all'>; query: string } | null => {
  const trimmedStart = value.trimStart()
  if (trimmedStart.startsWith('>')) {
    return { scope: 'commands', query: trimmedStart.slice(1).trimStart() }
  }
  const match = trimmedStart.match(/^(file|tuning|scale):\s*/i)
  if (!match) return null
  const scope = match[1]?.toLowerCase()
  return {
    scope: scope === 'file' ? 'files' : scope === 'tuning' ? 'tunings' : 'scales',
    query: trimmedStart.slice(match[0].length),
  }
}
