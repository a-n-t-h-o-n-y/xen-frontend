import { parsePatternPrefix } from '../presentation/viewModels'
import type {
  CommandReferenceArgument,
  CommandReferenceEntry,
  LibrarySnapshot,
  SequenceBank,
} from './models'

export type CompletionMode = 'none' | 'commandSearch' | 'argumentAssist'

export type CompletionSegment = {
  start: number
  end: number
  raw: string
  leadingWhitespace: string
  patternPrefix: string
  commandText: string
  commandTextStart: number
}

export type CommandCompletionCandidate = {
  command: CommandReferenceEntry
  replacement: string
  signature: string
  matchKind: MatchKind
}

export type CompletionAnalysis = {
  mode: CompletionMode
  segment: CompletionSegment
  recognizedCommand: CommandReferenceEntry | null
  isExactCommandInput: boolean
  candidates: CommandCompletionCandidate[]
  argumentPlaceholders: ArgumentPlaceholder[]
  activeArgument: ActiveArgument | null
  allRequiredArgumentsPresent: boolean
}

export type ArgumentPlaceholder = {
  displayName: string
  kind: string
  detail: string
  defaultValue: string | null
  required: boolean
  text: string
}

export type ActiveArgument = {
  argumentIndex: number
  argument: CommandReferenceArgument
  replaceStart: number
  replaceEnd: number
  typedValue: string
  rawValue: string
  hasValue: boolean
}

export type ArgumentCompletionCandidate = {
  id: string
  label: string
  insertionText: string
  detail: string | null
  isDefault: boolean
  isActive: boolean
}

export type CompletionResources = {
  library: LibrarySnapshot
  sequenceBank: SequenceBank | null
  activeTuningName: string
  activeScaleId: string | null
}

type LexedArgument = {
  start: number
  end: number
  value: string
  raw: string
}

type MatchKind = 'empty' | 'exactPrefix' | 'tokenPrefix' | 'acronym' | 'orderInsensitive' | 'typo' | 'keyword'

type RankedCandidate = CommandCompletionCandidate & {
  quality: number
  score: number
  catalogIndex: number
  recentIndex: number
}

const matchQuality: Record<MatchKind, number> = {
  empty: 0,
  exactPrefix: 1,
  tokenPrefix: 2,
  acronym: 3,
  orderInsensitive: 4,
  typo: 5,
  keyword: 6,
}

const normalize = (value: string): string => value.trim().toLowerCase()

const splitWords = (value: string): string[] =>
  normalize(value).split(/\s+/).filter(Boolean)

const isSubsequence = (query: string, value: string): boolean => {
  let cursor = 0
  for (const character of value) {
    if (character === query[cursor]) cursor += 1
    if (cursor === query.length) return true
  }
  return query.length === 0
}

const editDistance = (left: string, right: string): number => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = Array.from({ length: right.length + 1 }, () => 0)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! + cost
      )
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[right.length] ?? 0
}

const typoThreshold = (query: string): number => Math.max(1, Math.floor(query.length / 4))

const matchesOrderedTokenPrefix = (queryWords: string[], commandWords: string[]): boolean => {
  if (queryWords.length === 0) return false
  if (queryWords.length === 1) {
    const queryWord = queryWords[0]
    return queryWord !== undefined &&
      commandWords.some((commandWord) => commandWord.startsWith(queryWord))
  }

  return queryWords.every((word, index) => commandWords[index]?.startsWith(word) ?? false)
}

const buildSignature = (command: CommandReferenceEntry): string =>
  [command.id, ...command.arguments.map(formatArgumentToken)].join(' ')

const formatArgumentToken = (argument: CommandReferenceArgument): string => {
  const label = argument.defaultValue === null
    ? argument.displayName
    : `${argument.displayName}=${argument.defaultValue}`
  return argument.required ? `<${label}>` : `[${label}]`
}

export const formatArgumentDefault = (value: string | null): string | null => {
  if (value === null) return null
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\([\\"])/g, '$1')
  }
  return value
}

const formatPlaceholderText = (argument: CommandReferenceArgument): string => {
  const detail = getArgumentDetail(argument)
  const defaultValue = formatArgumentDefault(argument.defaultValue)
  const defaultText = defaultValue === null ? '' : ` = ${defaultValue}`
  const label = `${argument.displayName}:${detail}${defaultText}`

  return argument.required ? `<${label}>` : `[${label}]`
}

export const getArgumentDetail = (argument: CommandReferenceArgument): string => {
  const enumConstraint = argument.constraints.find((constraint) =>
    (constraint.kind === 'one_of' || constraint.kind === 'enum') && constraint.values.length > 0
  )

  return enumConstraint ? enumConstraint.values.join(' | ') : argument.kind
}

const decodeToken = (raw: string): string => {
  let value = ''
  let escaped = false
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index] ?? ''
    if (escaped) {
      value += character
      escaped = false
    } else if (character === '\\') {
      escaped = true
    } else if (character !== '"') {
      value += character
    }
  }
  if (escaped) value += '\\'
  return value
}

const lexArguments = (input: string): LexedArgument[] => {
  const tokens: LexedArgument[] = []
  let index = 0

  while (index < input.length) {
    while (/\s/.test(input[index] ?? '')) index += 1
    if (index >= input.length) break

    const start = index
    let quoted = false
    let escaped = false
    while (index < input.length) {
      const character = input[index] ?? ''
      if (escaped) {
        escaped = false
        index += 1
      } else if (character === '\\') {
        escaped = true
        index += 1
      } else if (character === '"') {
        quoted = !quoted
        index += 1
      } else if (!quoted && /\s/.test(character)) {
        break
      } else {
        index += 1
      }
    }
    const raw = input.slice(start, index)
    tokens.push({ start, end: index, raw, value: decodeToken(raw) })
  }

  return tokens
}

const argumentAtCaret = (
  commandText: string,
  command: CommandReferenceEntry,
  argumentInputStart: number,
  argumentInputEnd: number,
  caretOffset: number
): { active: ActiveArgument | null; tokens: LexedArgument[] } => {
  const input = commandText.slice(argumentInputStart, argumentInputEnd)
  const tokens = lexArguments(input)
  const relativeCaret = Math.max(0, Math.min(caretOffset - argumentInputStart, input.length))
  const tokenIndex = tokens.findIndex((token) =>
    relativeCaret >= token.start && relativeCaret <= token.end
  )
  const argumentsBeforeCaret = tokens.filter((token) => token.end < relativeCaret).length
  const argumentIndex = tokenIndex === -1 ? argumentsBeforeCaret : tokenIndex
  const argument = command.arguments[argumentIndex]
  if (!argument) return { active: null, tokens }

  const token = tokenIndex === -1 ? null : tokens[tokenIndex] ?? null
  const rawValue = token
    ? input.slice(token.start, Math.max(token.start, Math.min(relativeCaret, token.end)))
    : ''

  return {
    active: {
      argumentIndex,
      argument,
      replaceStart: argumentInputStart + (token?.start ?? relativeCaret),
      replaceEnd: argumentInputStart + (token?.end ?? relativeCaret),
      typedValue: decodeToken(rawValue),
      rawValue,
      hasValue: token !== null && token.raw.length > 0,
    },
    tokens,
  }
}

const unquoteCatalogValue = (value: string | null): string | null =>
  value === null ? null : decodeToken(value)

export const quoteCommandArgument = (value: string): string => {
  if (value.length > 0 && !/[\s;"\\]/.test(value)) return value
  return `"${value.replace(/([\\"])/g, '\\$1')}"`
}

const candidateId = (kind: string, value: string): string =>
  `argument:${kind}:${encodeURIComponent(value)}`

const matchesCandidate = (label: string, query: string): number | null => {
  const normalizedLabel = label.toLowerCase()
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return 3
  if (normalizedLabel === normalizedQuery) return 0
  if (normalizedLabel.startsWith(normalizedQuery)) return 1
  if (normalizedLabel.includes(normalizedQuery)) return 2
  return null
}

type CandidateSeed = {
  value: string
  label?: string
  detail?: string | null
  active?: boolean
}

const dynamicCandidateSeeds = (
  kind: string,
  resources: CompletionResources
): CandidateSeed[] => {
  switch (kind) {
    case 'chord_name':
      return resources.library.chords.map((chord) => ({
        value: chord.name,
        detail: chord.intervals.join(' · '),
      }))
    case 'scale_id':
      return resources.library.scales.map((scale) => ({
        value: scale.id,
        label: scale.definition?.name ?? ('name' in scale ? scale.name : scale.id),
        detail: scale.definition
          ? `${scale.definition.tuningLength}-tone · ${scale.definition.intervals.length} steps`
          : 'Chromatic',
        active: scale.id === resources.activeScaleId,
      }))
    case 'tuning_name':
      return resources.library.tunings.map((tuning) => ({
        value: tuning.stem,
        label: tuning.stem,
        detail: `${tuning.noteCount} notes`,
        active: tuning.name === resources.activeTuningName || tuning.stem === resources.activeTuningName,
      }))
    case 'cell_name':
    case 'cell_path':
      return resources.library.cells.map((cell) => ({
        value: cell.relativePath,
        label: cell.stem,
        detail: cell.relativePath,
      }))
    case 'project_name':
    case 'project_path':
      return resources.library.projects.map((project) => ({
        value: project.relativePath,
        label: project.stem,
        detail: project.relativePath,
      }))
    case 'sequence_name':
      return resources.sequenceBank?.sequences.map((sequence) => ({
        value: sequence.name,
        detail: `Sequence ${sequence.id}`,
      })) ?? []
    default:
      return []
  }
}

const dynamicArgumentKinds = new Set([
  'chord_name',
  'scale_id',
  'tuning_name',
  'cell_name',
  'cell_path',
  'project_name',
  'project_path',
  'sequence_name',
])

export const getArgumentCompletionCandidates = (
  activeArgument: ActiveArgument | null,
  resources: CompletionResources
): ArgumentCompletionCandidate[] => {
  if (!activeArgument) return []
  const { argument } = activeArgument
  const finiteConstraint = argument.constraints.find((constraint) =>
    (constraint.kind === 'one_of' || constraint.kind === 'enum') && constraint.values.length > 0
  )
  const defaultValue = unquoteCatalogValue(argument.defaultValue)
  const seeds: CandidateSeed[] = finiteConstraint
    ? finiteConstraint.values.map((value) => ({ value }))
    : dynamicCandidateSeeds(argument.kind, resources)

  if (
    defaultValue !== null &&
    (finiteConstraint !== undefined || dynamicArgumentKinds.has(argument.kind)) &&
    !seeds.some((seed) => seed.value === defaultValue)
  ) {
    seeds.unshift({ value: defaultValue })
  }

  return seeds
    .map((seed, index) => {
      const qualities = [seed.label ?? seed.value, seed.value]
        .map((value) => matchesCandidate(value, activeArgument.typedValue))
        .filter((quality): quality is number => quality !== null)
      return {
        seed,
        index,
        quality: qualities.length > 0 ? Math.min(...qualities) : null,
      }
    })
    .filter((entry): entry is typeof entry & { quality: number } => entry.quality !== null)
    .sort((left, right) => {
      if (!activeArgument.typedValue) {
        const leftDefault = left.seed.value === defaultValue ? 0 : 1
        const rightDefault = right.seed.value === defaultValue ? 0 : 1
        if (leftDefault !== rightDefault) return leftDefault - rightDefault
        const leftActive = left.seed.active ? 0 : 1
        const rightActive = right.seed.active ? 0 : 1
        if (leftActive !== rightActive) return leftActive - rightActive
      }
      return left.quality - right.quality || left.index - right.index
    })
    .slice(0, 8)
    .map(({ seed }) => ({
      id: candidateId(argument.kind, seed.value),
      label: seed.label ?? seed.value,
      insertionText: quoteCommandArgument(seed.value),
      detail: seed.detail ?? null,
      isDefault: seed.value === defaultValue,
      isActive: seed.active ?? false,
    }))
}

export const applyArgumentCompletion = (
  commandText: string,
  activeArgument: ActiveArgument,
  insertionText: string
): { text: string; caretOffset: number } => {
  const before = commandText.slice(0, activeArgument.replaceStart)
  const after = commandText.slice(activeArgument.replaceEnd)
  const needsSeparator = after.length === 0 || !/^[\s;]/.test(after)
  const separator = needsSeparator ? ' ' : ''
  const existingSeparatorLength = /^\s/.test(after) ? 1 : 0
  return {
    text: `${before}${insertionText}${separator}${after}`,
    caretOffset: before.length + insertionText.length +
      (needsSeparator ? 1 : existingSeparatorLength),
  }
}

const rankCommand = (
  command: CommandReferenceEntry,
  query: string,
  catalogIndex: number,
  recentCommandIds: string[]
): RankedCandidate | null => {
  const normalizedQuery = normalize(query)
  const id = normalize(command.id)
  const commandWords = splitWords(command.id)
  const queryWords = splitWords(normalizedQuery)
  const acronym = commandWords.map((word) => word[0] ?? '').join('')
  let matchKind: MatchKind | null = null
  let score = 0

  if (!normalizedQuery) {
    matchKind = 'empty'
  } else if (id.startsWith(normalizedQuery)) {
    matchKind = 'exactPrefix'
    score = normalizedQuery.length / Math.max(id.length, 1)
  } else if (matchesOrderedTokenPrefix(queryWords, commandWords)) {
    matchKind = 'tokenPrefix'
    score = queryWords.join('').length / Math.max(commandWords.join('').length, 1)
  } else if (acronym.startsWith(normalizedQuery) || isSubsequence(normalizedQuery, id.replace(/\s+/g, ''))) {
    matchKind = 'acronym'
    score = normalizedQuery.length / Math.max(id.replace(/\s+/g, '').length, 1)
  } else if (queryWords.length > 0 && queryWords.every((word) =>
    commandWords.some((commandWord) => commandWord.includes(word))
  )) {
    matchKind = 'orderInsensitive'
    score = queryWords.length / Math.max(commandWords.length, 1)
  } else if (
    normalizedQuery.length >= 3 &&
    [id.replace(/\s+/g, ''), ...commandWords].some((word) =>
      Math.abs(word.length - normalizedQuery.length) <= typoThreshold(normalizedQuery) &&
      editDistance(normalizedQuery, word) <= typoThreshold(normalizedQuery)
    )
  ) {
    matchKind = 'typo'
  } else if (command.keywords.some((keyword) => {
    const normalizedKeyword = normalize(keyword)
    return normalizedKeyword.startsWith(normalizedQuery) || normalizedKeyword.includes(normalizedQuery)
  })) {
    matchKind = 'keyword'
  }

  if (matchKind === null) return null

  return {
    command,
    replacement: `${command.id} `,
    signature: buildSignature(command),
    matchKind,
    quality: matchQuality[matchKind],
    score,
    catalogIndex,
    recentIndex: recentCommandIds.indexOf(command.id),
  }
}

export const getActiveCompletionSegment = (
  commandText: string,
  caretOffset: number = commandText.length
): CompletionSegment => {
  const caret = Math.max(0, Math.min(caretOffset, commandText.length))
  const delimiters: number[] = []
  let quoted = false
  let escaped = false
  for (let index = 0; index < commandText.length; index += 1) {
    const character = commandText[index] ?? ''
    if (escaped) {
      escaped = false
    } else if (character === '\\') {
      escaped = true
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ';' && !quoted) {
      delimiters.push(index)
    }
  }
  const previousDelimiter = delimiters.filter((index) => index < caret).at(-1) ?? -1
  const nextDelimiter = delimiters.find((index) => index >= caret) ?? commandText.length
  const start = previousDelimiter + 1
  const end = nextDelimiter
  const raw = commandText.slice(start, end)
  const leadingWhitespace = raw.match(/^\s*/)?.[0] ?? ''
  const afterWhitespace = raw.slice(leadingWhitespace.length)
  const patternTokens: string[] = []
  let consumedPrefixLength = 0

  while (consumedPrefixLength < afterWhitespace.length) {
    const match = afterWhitespace.slice(consumedPrefixLength).match(/^(\+\d+|\d+)(\s*)/)
    if (!match) break

    const token = match[1] ?? ''
    const spacing = match[2] ?? ''
    if (token.startsWith('+') && patternTokens.length > 0) break

    patternTokens.push(token)
    consumedPrefixLength += token.length + spacing.length
    if (!spacing) break
  }

  if (patternTokens.length === 0 || parsePatternPrefix(patternTokens.join(' ')) === null) {
    consumedPrefixLength = 0
  }

  let patternPrefix = consumedPrefixLength > 0 ? afterWhitespace.slice(0, consumedPrefixLength) : ''
  if (
    patternPrefix &&
    consumedPrefixLength < afterWhitespace.length &&
    !/\s$/.test(patternPrefix)
  ) {
    patternPrefix = ''
    consumedPrefixLength = 0
  }
  const commandTextStart = start + leadingWhitespace.length + patternPrefix.length

  return {
    start,
    end,
    raw,
    leadingWhitespace,
    patternPrefix,
    commandText: commandText.slice(commandTextStart, end),
    commandTextStart,
  }
}

export const rankCommandCompletions = (
  commands: CommandReferenceEntry[],
  query: string,
  recentCommandIds: string[] = []
): CommandCompletionCandidate[] =>
  commands
    .map((command, index) => rankCommand(command, query, index, recentCommandIds))
    .filter((candidate): candidate is RankedCandidate => candidate !== null)
    .sort((left, right) => {
      if (left.quality !== right.quality) return left.quality - right.quality
      const leftRecent = left.recentIndex === -1 ? Number.MAX_SAFE_INTEGER : left.recentIndex
      const rightRecent = right.recentIndex === -1 ? Number.MAX_SAFE_INTEGER : right.recentIndex
      if (leftRecent !== rightRecent) return leftRecent - rightRecent
      if (left.score !== right.score) return right.score - left.score
      return left.catalogIndex - right.catalogIndex
    })
    .map((candidate) => ({
      command: candidate.command,
      replacement: candidate.replacement,
      signature: candidate.signature,
      matchKind: candidate.matchKind,
    }))

export const getArgumentPlaceholders = (
  command: CommandReferenceEntry,
  argumentInput: string
): ArgumentPlaceholder[] => {
  const typedCount = lexArguments(argumentInput).length

  return command.arguments.slice(typedCount).map((argument) => ({
    displayName: argument.displayName,
    kind: argument.kind,
    detail: getArgumentDetail(argument),
    defaultValue: argument.defaultValue,
    required: argument.required,
    text: formatPlaceholderText(argument),
  }))
}

export const analyzeCommandCompletion = (
  commandText: string,
  commands: CommandReferenceEntry[],
  recentCommandIds: string[] = [],
  caretOffset: number = commandText.length
): CompletionAnalysis => {
  const segment = getActiveCompletionSegment(commandText, caretOffset)
  const trimmedCommandText = segment.commandText.trimStart()
  const leadingCommandWhitespace = segment.commandText.length - trimmedCommandText.length
  const queryStartOffset = leadingCommandWhitespace
  const normalizedSegment = normalize(trimmedCommandText)
  const hasExplicitArgumentBoundary = /\s$/.test(trimmedCommandText)
  const exactCommand = commands.find((command) => normalize(command.id) === normalizedSegment) ?? null
  const isExactCommandInput = exactCommand !== null
  const recognizedCommand = [...commands].sort((left, right) => right.id.length - left.id.length).find((command) => {
    const id = normalize(command.id)
    return (
      (normalizedSegment === id && hasExplicitArgumentBoundary) ||
      normalizedSegment.startsWith(`${id} `)
    )
  }) ?? null

  if (recognizedCommand) {
    const argumentInput = trimmedCommandText.slice(recognizedCommand.id.length)
    const isArgumentInputVisible = /^\s/.test(argumentInput)
    const commandBodyStart = segment.commandTextStart + leadingCommandWhitespace
    const argumentInputStart = commandBodyStart + recognizedCommand.id.length
    const argumentState = argumentAtCaret(
      commandText,
      recognizedCommand,
      argumentInputStart,
      segment.end,
      caretOffset
    )
    const allRequiredArgumentsPresent = recognizedCommand.arguments.every((argument, index) =>
      !argument.required || (argumentState.tokens[index]?.value.length ?? 0) > 0
    )

    return {
      mode: 'argumentAssist',
      segment,
      recognizedCommand,
      isExactCommandInput,
      candidates: [],
      argumentPlaceholders: isArgumentInputVisible
        ? getArgumentPlaceholders(recognizedCommand, argumentInput)
        : [],
      activeArgument: isArgumentInputVisible ? argumentState.active : null,
      allRequiredArgumentsPresent,
    }
  }

  const query = segment.commandText.slice(queryStartOffset)
  const rankedCandidates = rankCommandCompletions(commands, query, recentCommandIds)
  const candidates = exactCommand
    ? rankedCandidates.filter((candidate) =>
      normalize(candidate.command.id).startsWith(`${normalize(exactCommand.id)} `)
    )
    : rankedCandidates

  return {
    mode: candidates.length > 0 ? 'commandSearch' : 'none',
    segment,
    recognizedCommand: exactCommand,
    isExactCommandInput,
    candidates,
    argumentPlaceholders: [],
    activeArgument: null,
    allRequiredArgumentsPresent: exactCommand?.arguments.every((argument) => !argument.required) ?? false,
  }
}

export const applyCommandCompletion = (
  commandText: string,
  segment: CompletionSegment,
  command: CommandReferenceEntry
): string => [
  commandText.slice(0, segment.commandTextStart),
  command.id,
  ' ',
  commandText.slice(segment.end),
].join('')

export const recognizeCommandIds = (
  commandText: string,
  commands: CommandReferenceEntry[]
): string[] =>
  commandText
    .split(';')
    .map((segment) => {
      const completionSegment = getActiveCompletionSegment(segment)
      const normalizedSegment = normalize(completionSegment.commandText)
      return commands.find((command) => {
        const id = normalize(command.id)
        return normalizedSegment === id || normalizedSegment.startsWith(`${id} `)
      })?.id
    })
    .filter((id): id is string => id !== undefined)

export const getVisibleCompletionMode = (
  isCommandMode: boolean,
  isDismissed: boolean,
  isHistoryNavigationFrozen: boolean,
  mode: CompletionMode
): CompletionMode => {
  if (!isCommandMode || isDismissed || isHistoryNavigationFrozen) return 'none'
  return mode
}
