import type { InputMode } from '../shared'
import type { MoveDirection } from './selection'

export type KeymapAction =
  | { type: 'move'; direction: MoveDirection; amount: number }
  | { type: 'inputMode'; inputMode: InputMode }
  | { type: 'backend'; command: string }

export const expandNumericPlaceholders = (command: string, pendingDigits: string): string =>
  command.replace(/:N=(\d+):/g, (_, defaultValue: string) =>
    pendingDigits.length > 0 ? pendingDigits : defaultValue
  )

export const splitCommandChain = (command: string): string[] => {
  const segments: string[] = []
  let start = 0
  let quote: '"' | "'" | null = null
  let escaped = false

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\' && quote !== null) {
      escaped = true
      continue
    }
    if (character === '"' || character === "'") {
      quote = quote === character ? null : quote ?? character
      continue
    }
    if (character === ';' && quote === null) {
      const segment = command.slice(start, index).trim()
      if (segment) {
        segments.push(segment)
      }
      start = index + 1
    }
  }

  const finalSegment = command.slice(start).trim()
  if (finalSegment) {
    segments.push(finalSegment)
  }
  return segments
}

const parseInputMode = (value: string): InputMode | null => {
  const normalized = value.toLowerCase()
  if (
    normalized === 'pitch' ||
    normalized === 'velocity' ||
    normalized === 'delay' ||
    normalized === 'gate' ||
    normalized === 'scale'
  ) {
    return normalized
  }
  return null
}

export const routeKeymapAction = (command: string): KeymapAction[] => {
  const actions: KeymapAction[] = []
  let backendSegments: string[] = []

  const flushBackend = (): void => {
    if (backendSegments.length === 0) {
      return
    }
    actions.push({ type: 'backend', command: backendSegments.join('; ') })
    backendSegments = []
  }

  for (const segment of splitCommandChain(command)) {
    const tokens = segment.trim().split(/\s+/)
    const actionName = tokens[0]?.toLowerCase()
    if (actionName === 'move') {
      const direction = tokens[1]?.toLowerCase()
      if (
        direction === 'left' ||
        direction === 'right' ||
        direction === 'up' ||
        direction === 'down'
      ) {
        flushBackend()
        const amount = tokens[2] === undefined ? 1 : Number.parseInt(tokens[2], 10)
        actions.push({
          type: 'move',
          direction,
          amount: Number.isNaN(amount) ? 1 : amount,
        })
        continue
      }
    }
    if (actionName === 'inputmode') {
      const nextMode = parseInputMode(tokens[1] ?? '')
      if (nextMode) {
        flushBackend()
        actions.push({ type: 'inputMode', inputMode: nextMode })
        continue
      }
    }
    backendSegments.push(segment)
  }

  flushBackend()
  return actions
}
