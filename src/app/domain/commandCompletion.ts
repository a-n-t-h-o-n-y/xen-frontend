import { parsePatternPrefix, type CommandReferenceArgument, type CommandReferenceEntry } from '../shared'

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
  candidates: CommandCompletionCandidate[]
  argumentPlaceholders: ArgumentPlaceholder[]
}

export type ArgumentPlaceholder = {
  displayName: string
  kind: string
  defaultValue: string | null
  required: boolean
  text: string
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
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost
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
    return commandWords.some((commandWord) => commandWord.startsWith(queryWords[0]))
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

const formatPlaceholderText = (argument: CommandReferenceArgument): string => {
  const label = argument.defaultValue === null
    ? argument.displayName
    : `${argument.displayName}=${argument.defaultValue}`
  const enumConstraint = argument.constraints.find((constraint) =>
    constraint.kind === 'enum' && constraint.values.length > 0
  )
  const detail = enumConstraint ? enumConstraint.values.join(' | ') : argument.kind

  return argument.required ? `<${label}:${detail}>` : `[${label}:${detail}]`
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

export const getActiveCompletionSegment = (commandText: string): CompletionSegment => {
  const delimiterIndex = commandText.lastIndexOf(';')
  const start = delimiterIndex === -1 ? 0 : delimiterIndex + 1
  const raw = commandText.slice(start)
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
    end: commandText.length,
    raw,
    leadingWhitespace,
    patternPrefix,
    commandText: commandText.slice(commandTextStart),
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
  const typedCount = argumentInput.trim().length === 0
    ? 0
    : argumentInput.trim().split(/\s+/).length

  return command.arguments.slice(typedCount).map((argument) => ({
    displayName: argument.displayName,
    kind: argument.kind,
    defaultValue: argument.defaultValue,
    required: argument.required,
    text: formatPlaceholderText(argument),
  }))
}

export const analyzeCommandCompletion = (
  commandText: string,
  commands: CommandReferenceEntry[],
  recentCommandIds: string[] = []
): CompletionAnalysis => {
  const segment = getActiveCompletionSegment(commandText)
  const trimmedCommandText = segment.commandText.trimStart()
  const leadingCommandWhitespace = segment.commandText.length - trimmedCommandText.length
  const queryStartOffset = leadingCommandWhitespace
  const normalizedSegment = normalize(trimmedCommandText)
  const recognizedCommand = commands.find((command) => {
    const id = normalize(command.id)
    return normalizedSegment === id || normalizedSegment.startsWith(`${id} `)
  }) ?? null

  if (recognizedCommand) {
    const argumentInput = trimmedCommandText.slice(recognizedCommand.id.length)
    const isArgumentInputVisible = /^\s/.test(argumentInput)

    return {
      mode: 'argumentAssist',
      segment,
      recognizedCommand,
      candidates: [],
      argumentPlaceholders: isArgumentInputVisible
        ? getArgumentPlaceholders(recognizedCommand, argumentInput)
        : [],
    }
  }

  const query = segment.commandText.slice(queryStartOffset)
  const candidates = rankCommandCompletions(commands, query, recentCommandIds)

  return {
    mode: candidates.length > 0 ? 'commandSearch' : 'none',
    segment,
    recognizedCommand: null,
    candidates,
    argumentPlaceholders: [],
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
