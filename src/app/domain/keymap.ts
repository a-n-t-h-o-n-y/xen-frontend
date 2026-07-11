import { usesMetaForCommand } from '../platform'
import { formatUiActionTarget } from './uiActions'
import type { KeymapResource } from './models'

export type InputMode = 'pitch' | 'velocity' | 'delay' | 'gate' | 'scale'

export type KeymapTrigger = {
  key: string
  modifiers: {
    shift: boolean
    command: boolean
    alt: boolean
  }
  when?: {
    inputMode: InputMode
  }
}

export type CommandKeymapTarget = {
  type: 'command'
  command: string
}

export type UiActionKeymapTarget =
  | {
      type: 'ui_action'
      action: 'selection.move'
      arguments: {
        direction: 'left' | 'right' | 'up' | 'down'
        amount: number
      }
    }
  | {
      type: 'ui_action'
      action: 'input_mode.set'
      arguments: {
        mode: InputMode
      }
    }
  | {
      type: 'ui_action'
      action:
        | 'workspace.view.toggle'
        | 'workspace.view.composition'
        | 'workspace.view.sequencer'
        | 'composition.cell.edit_measure'
        | 'composition.cell.copy'
        | 'composition.cell.cut'
        | 'composition.cell.paste'
        | 'composition.cell.duplicate_right'
        | 'composition.cell.rename_or_create_measure'
        | 'composition.cell.clear'
        | 'composition.row.insert_before'
        | 'composition.row.insert_after'
        | 'composition.row.delete'
        | 'composition.row.rename'
        | 'composition.row.channel'
        | 'composition.column.insert_before'
        | 'composition.column.insert_after'
        | 'composition.column.delete'
        | 'composition.column.length'
        | 'composition.loop.set_start'
        | 'composition.loop.set_end'
        | 'modulator.mode.toggle'
        | 'command.cancel'
      arguments: Record<string, never>
    }
  | {
      type: 'ui_action'
      action: 'composition.selection.move'
      arguments: {
        direction: 'left' | 'right' | 'up' | 'down'
        amount: number
      }
    }
  | {
      type: 'ui_action'
      action: 'modulator.slot.select'
      arguments: {
        slot: 1 | 2 | 3 | 4
      }
    }
  | {
      type: 'ui_action'
      action: 'modulator.target.toggle'
      arguments: {
        target: 'pitch' | 'velocity' | 'delay' | 'gate' | 'weights'
      }
    }
  | {
      type: 'ui_action'
      action:
        | 'command.open'
        | 'command.submit'
        | 'command.close_if_empty'
        | 'command.history.previous'
        | 'command.history.next'
        | 'command.completion.accept'
        | 'command.completion.dismiss'
        | 'command.completion.previous'
        | 'command.completion.next'
      arguments: Record<string, never>
    }

export type KeymapTarget = CommandKeymapTarget | UiActionKeymapTarget

export type KeymapBinding = {
  trigger: KeymapTrigger
  target: KeymapTarget
}

export type KeymapOverride = {
  context: string
  trigger: KeymapTrigger
  target: KeymapTarget | null
}

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
  trigger.when?.inputMode ?? '',
].join('\u0000')

export const triggersEqual = (left: KeymapTrigger, right: KeymapTrigger): boolean =>
  triggerIdentity(left) === triggerIdentity(right)

export const mergeKeymapOverrides = (
  defaults: Readonly<Record<string, readonly KeymapBinding[]>>,
  overrides: readonly KeymapOverride[]
): Record<string, KeymapBinding[]> => {
  const merged = Object.fromEntries(
    Object.entries(defaults).map(([context, contextBindings]) => [
      context,
      contextBindings.map((binding) => ({ ...binding })),
    ])
  )
  for (const override of overrides) {
    const contextBindings = merged[override.context] ?? []
    const index = contextBindings.findIndex((binding) =>
      triggersEqual(binding.trigger, override.trigger)
    )
    if (override.target === null) {
      if (index >= 0) contextBindings.splice(index, 1)
    } else if (index >= 0) {
      contextBindings[index] = { trigger: override.trigger, target: override.target }
    } else {
      contextBindings.push({ trigger: override.trigger, target: override.target })
    }
    if (contextBindings.length > 0) merged[override.context] = contextBindings
    else delete merged[override.context]
  }
  return merged
}

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
    (trigger.when === undefined || trigger.when.inputMode === inputMode)
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

export const findKeymapTriggerConflict = (
  resource: KeymapResource | null,
  context: string,
  trigger: KeymapTrigger,
  originalTrigger?: KeymapTrigger
): KeymapBinding | null =>
  resource?.bindings[context]?.find((binding) =>
    triggersEqual(binding.trigger, trigger) &&
    (!originalTrigger || !triggersEqual(binding.trigger, originalTrigger))
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
  if (trigger.when) parts.push(`in ${trigger.when.inputMode}`)
  return parts.join(' + ')
}

export const formatKeymapTarget = (target: KeymapTarget): string => {
  if (target.type === 'command') {
    return target.command
  }
  return formatUiActionTarget(target)
}
