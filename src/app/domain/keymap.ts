import { usesMetaForCommand } from '../platform'
import { formatUiActionTarget } from './uiActions'
import type { KeymapResource } from './models'

export type InputMode = 'pitch' | 'velocity' | 'delay' | 'gate' | 'scale'

export type KeymapTrigger = {
  match: {
    kind: 'key' | 'code'
    value: string
  }
  modifiers: {
    shift: boolean
    alt: boolean
    primary: boolean
    control: boolean
    meta: boolean
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
        | 'composition.cell.edit_sequence'
        | 'composition.cell.duplicate_right'
        | 'composition.cell.rename_or_create_sequence'
        | 'composition.cell.unassign'
        | 'composition.row.rename'
        | 'composition.row.channel'
        | 'composition.column.length'
        | 'composition.loop.set_start'
        | 'composition.loop.set_end'
        | 'edit.copy'
        | 'edit.cut'
        | 'edit.paste'
        | 'modulator.mode.toggle'
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
        | 'command.cancel'
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
  repeat?: 'allow' | 'ignore'
}

export type KeymapDocument = {
  schemaVersion: 2
  bindings: Record<string, KeymapBinding[]>
}

export const expandNumericPlaceholders = (command: string, pendingDigits: string): string =>
  command.replace(/:N=(\d+):/g, (_, defaultValue: string) =>
    pendingDigits.length > 0 ? pendingDigits : defaultValue
  )

export const normalizeKey = (key: string): string =>
  /^[A-Z]$/.test(key) ? key.toLowerCase() : key

const physicalModifiers = (event: KeyboardEvent) => ({
  shift: event.shiftKey,
  alt: event.altKey,
  control: event.ctrlKey,
  meta: event.metaKey,
})

export const triggerFromKeyboardEvent = (
  event: KeyboardEvent,
  kind: 'key' | 'code' = 'key'
): KeymapTrigger => {
  const onlyPlatformPrimary = usesMetaForCommand
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
  return {
    match: {
      kind,
      value: kind === 'key' ? normalizeKey(event.key) : event.code,
    },
    modifiers: {
      shift: event.shiftKey,
      alt: event.altKey,
      primary: onlyPlatformPrimary,
      control: onlyPlatformPrimary ? false : event.ctrlKey,
      meta: onlyPlatformPrimary ? false : event.metaKey,
    },
  }
}

const expectedPhysicalModifiers = (trigger: KeymapTrigger) => ({
  shift: trigger.modifiers.shift,
  alt: trigger.modifiers.alt,
  control: trigger.modifiers.control || (trigger.modifiers.primary && !usesMetaForCommand),
  meta: trigger.modifiers.meta || (trigger.modifiers.primary && usesMetaForCommand),
})

export const triggerIdentity = (trigger: KeymapTrigger): string => [
  trigger.match.kind,
  trigger.match.value,
  trigger.modifiers.shift ? '1' : '0',
  trigger.modifiers.alt ? '1' : '0',
  trigger.modifiers.primary ? '1' : '0',
  trigger.modifiers.control ? '1' : '0',
  trigger.modifiers.meta ? '1' : '0',
  trigger.when?.inputMode ?? '',
].join('\u0000')

export const triggersEqual = (left: KeymapTrigger, right: KeymapTrigger): boolean =>
  triggerIdentity(left) === triggerIdentity(right)

export const triggersConflict = (left: KeymapTrigger, right: KeymapTrigger): boolean => {
  const leftModifiers = expectedPhysicalModifiers(left)
  const rightModifiers = expectedPhysicalModifiers(right)
  return left.match.kind === right.match.kind &&
    left.match.value === right.match.value &&
    leftModifiers.shift === rightModifiers.shift &&
    leftModifiers.alt === rightModifiers.alt &&
    leftModifiers.control === rightModifiers.control &&
    leftModifiers.meta === rightModifiers.meta &&
    left.when?.inputMode === right.when?.inputMode
}

export const matchesKeymapTrigger = (
  trigger: KeymapTrigger,
  event: KeyboardEvent,
  inputMode: InputMode
): boolean => {
  const expected = expectedPhysicalModifiers(trigger)
  const actual = physicalModifiers(event)
  const value = trigger.match.kind === 'key' ? normalizeKey(event.key) : event.code
  return trigger.match.value === value &&
    expected.shift === actual.shift &&
    expected.control === actual.control &&
    expected.meta === actual.meta &&
    expected.alt === actual.alt &&
    (trigger.when === undefined || trigger.when.inputMode === inputMode)
}

const bindingSpecificity = (binding: KeymapBinding): number =>
  Number(Boolean(binding.trigger.when)) * 2 + Number(!binding.trigger.modifiers.primary)

export const findKeymapBinding = (
  resource: KeymapResource | null,
  context: string,
  event: KeyboardEvent,
  inputMode: InputMode
): KeymapBinding | null =>
  resource?.bindings[context]
    ?.filter((binding) => matchesKeymapTrigger(binding.trigger, event, inputMode))
    .sort((left, right) => bindingSpecificity(right) - bindingSpecificity(left))[0]
    ?? null

export const findKeymapTriggerConflict = (
  resource: KeymapResource | null,
  context: string,
  trigger: KeymapTrigger,
  originalTrigger?: KeymapTrigger
): KeymapBinding | null =>
  resource?.bindings[context]?.find((binding) =>
    triggersConflict(binding.trigger, trigger) &&
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
  if (trigger.modifiers.primary) parts.push(usesMetaForCommand ? 'Cmd' : 'Ctrl')
  if (trigger.modifiers.control) parts.push('Ctrl')
  if (trigger.modifiers.meta) parts.push(usesMetaForCommand ? 'Cmd' : 'Meta')
  if (trigger.modifiers.alt) parts.push(usesMetaForCommand ? 'Option' : 'Alt')
  if (trigger.modifiers.shift) parts.push('Shift')
  parts.push(trigger.match.kind === 'code'
    ? `${trigger.match.value} (physical)`
    : displayKey(trigger.match.value))
  if (trigger.when) parts.push(`in ${trigger.when.inputMode}`)
  return parts.join(' + ')
}

export const formatKeymapTarget = (target: KeymapTarget): string => {
  if (target.type === 'command') {
    return target.command
  }
  return formatUiActionTarget(target)
}
