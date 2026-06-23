import { usesMetaForCommand } from '../shared'
import type {
  InputMode,
  KeymapBinding,
  KeymapResource,
  KeymapTarget,
  KeymapTrigger,
} from './contracts'

export const expandNumericPlaceholders = (command: string, pendingDigits: string): string =>
  command.replace(/:N=(\d+):/g, (_, defaultValue: string) =>
    pendingDigits.length > 0 ? pendingDigits : defaultValue
  )

export const normalizeKey = (key: string): string =>
  /^[A-Z]$/.test(key) ? key.toLowerCase() : key

export const triggerFromKeyboardEvent = (event: KeyboardEvent): KeymapTrigger => ({
  key: normalizeKey(event.key),
  modifiers: {
    shift: event.shiftKey,
    command: usesMetaForCommand ? event.metaKey : event.ctrlKey,
    alt: event.altKey,
  },
})

export const triggerIdentity = (trigger: KeymapTrigger): string => [
  trigger.key,
  trigger.modifiers.shift ? '1' : '0',
  trigger.modifiers.command ? '1' : '0',
  trigger.modifiers.alt ? '1' : '0',
  trigger.when?.input_mode ?? '',
].join('\u0000')

export const triggersEqual = (left: KeymapTrigger, right: KeymapTrigger): boolean =>
  triggerIdentity(left) === triggerIdentity(right)

export const matchesKeymapTrigger = (
  trigger: KeymapTrigger,
  event: KeyboardEvent,
  inputMode: InputMode
): boolean => {
  const eventTrigger = triggerFromKeyboardEvent(event)
  return trigger.key === eventTrigger.key &&
    trigger.modifiers.shift === eventTrigger.modifiers.shift &&
    trigger.modifiers.command === eventTrigger.modifiers.command &&
    trigger.modifiers.alt === eventTrigger.modifiers.alt &&
    (trigger.when === undefined || trigger.when.input_mode === inputMode)
}

export const findKeymapBinding = (
  resource: KeymapResource | null,
  context: string,
  event: KeyboardEvent,
  inputMode: InputMode
): KeymapBinding | null =>
  resource?.bindings[context]?.find((binding) =>
    matchesKeymapTrigger(binding.trigger, event, inputMode)
  ) ?? null

const displayKey = (key: string): string => {
  const labels: Record<string, string> = {
    ' ': 'Space',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    Escape: 'Esc',
  }
  return labels[key] ?? key
}

export const formatKeymapTrigger = (trigger: KeymapTrigger): string => {
  const parts: string[] = []
  if (trigger.modifiers.command) parts.push(usesMetaForCommand ? 'Cmd' : 'Ctrl')
  if (trigger.modifiers.alt) parts.push(usesMetaForCommand ? 'Option' : 'Alt')
  if (trigger.modifiers.shift) parts.push('Shift')
  parts.push(displayKey(trigger.key))
  if (trigger.when) parts.push(`in ${trigger.when.input_mode}`)
  return parts.join(' + ')
}

export const formatKeymapTarget = (target: KeymapTarget): string => {
  if (target.type === 'command') {
    return target.command
  }
  if (target.action === 'selection.move') {
    return `Move ${target.arguments.direction} by ${target.arguments.amount}`
  }
  return `Set input mode to ${target.arguments.mode}`
}
