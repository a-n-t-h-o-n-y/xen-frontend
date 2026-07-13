import type {
  InputMode,
  KeymapBinding,
  KeymapDocument,
  KeymapTarget,
  KeymapTrigger,
} from './keymap'

const bindings: Record<string, KeymapBinding[]> = {}

const trigger = (
  key: string,
  shift = false,
  command = false,
  alt = false,
  inputMode?: InputMode
): KeymapTrigger => inputMode
  ? {
      match: { kind: 'key', value: key },
      modifiers: { shift, alt, primary: command, control: false, meta: false },
      when: { inputMode },
    }
  : {
      match: { kind: 'key', value: key },
      modifiers: { shift, alt, primary: command, control: false, meta: false },
    }

const command = (value: string): KeymapTarget => ({ type: 'command', command: value })
const action = (value: Extract<KeymapTarget, { type: 'ui_action' }>): KeymapTarget => value
const emptyAction = (
  name: Extract<KeymapTarget, { type: 'ui_action' }>['action']
): KeymapTarget => ({ type: 'ui_action', action: name, arguments: {} } as KeymapTarget)

const add = (bindingTrigger: KeymapTrigger, target: KeymapTarget, context = 'sequencer'): void => {
  const contextBindings = bindings[context] ?? []
  contextBindings.push({ trigger: bindingTrigger, target })
  bindings[context] = contextBindings
}

const addHistoryBindings = (context = 'sequencer'): void => {
  add(trigger('z', false, true), command('undo'), context)
  add(trigger('z', true, true), command('redo'), context)
  add(trigger('y', false, true), command('redo'), context)
}

const move = (direction: 'left' | 'right' | 'up' | 'down'): KeymapTarget => action({
  type: 'ui_action',
  action: 'selection.move',
  arguments: { direction, amount: 1 },
})
const compositionMove = (direction: 'left' | 'right' | 'up' | 'down'): KeymapTarget => action({
  type: 'ui_action',
  action: 'composition.selection.move',
  arguments: { direction, amount: 1 },
})
const inputMode = (mode: InputMode): KeymapTarget => action({
  type: 'ui_action',
  action: 'input_mode.set',
  arguments: { mode },
})

add(trigger('Escape'), inputMode('pitch'))
add(trigger('p'), inputMode('pitch'))
add(trigger('v'), inputMode('velocity'))
add(trigger('d'), inputMode('delay'))
add(trigger('g'), inputMode('gate'))
add(trigger('c'), inputMode('scale'))

add(trigger('c', false, true), emptyAction('edit.copy'))
add(trigger('x', false, true), emptyAction('edit.cut'))
add(trigger('v', false, true), emptyAction('edit.paste'))
add(trigger('d', false, true), command('duplicate'))
addHistoryBindings()
add(trigger('.'), command('again'))

for (const [key, direction] of [
  ['h', 'left'], ['ArrowLeft', 'left'], ['l', 'right'], ['ArrowRight', 'right'],
] as const) {
  add(trigger(key), move(direction))
  add(trigger(key, true), move(direction))
}
for (const [key, direction] of [
  ['j', 'down'], ['ArrowDown', 'down'], ['k', 'up'], ['ArrowUp', 'up'],
] as const) {
  add(trigger(key, true), move(direction))
}

const addModeShift = (
  mode: InputMode,
  key: string,
  value: string,
  commandModifier = false
): void => add(trigger(key, false, commandModifier, false, mode), command(value))

addModeShift('pitch', 'j', 'shift Pitch -1')
addModeShift('pitch', 'ArrowDown', 'shift Pitch -1')
addModeShift('pitch', 'k', 'shift Pitch +1')
addModeShift('pitch', 'ArrowUp', 'shift Pitch +1')
add(trigger('PageDown'), command('shift Octave -1'))
add(trigger('PageUp'), command('shift Octave +1'))

for (const [mode, field, coarse, fine] of [
  ['velocity', 'Velocity', '0.015', '0.007'],
  ['delay', 'Delay', '0.05', '0.01'],
  ['gate', 'Gate', '0.05', '0.01'],
] as const) {
  for (const [key, sign] of [
    ['j', '-'], ['ArrowDown', '-'], ['k', '+'], ['ArrowUp', '+'],
  ] as const) {
    addModeShift(mode, key, `shift ${field} ${sign}${coarse}`)
    addModeShift(mode, key, `shift ${field} ${sign}${fine}`, true)
  }
}

for (const [key, sign] of [
  ['j', '-'], ['ArrowDown', '-'], ['k', '+'], ['ArrowUp', '+'],
] as const) {
  addModeShift('scale', key, `shift entireScale ${sign}1`)
  addModeShift('scale', key, `shift scale ${sign}1`, true)
}

add(trigger('+', true), command('double duration'))
add(trigger('-'), command('halve duration'))
add(trigger('Delete'), command('delete'))
add(trigger('s'), command('split :N=2:'))
add(trigger('n'), command('note :N=0:'))
add(trigger('r'), command('rest'))
add(trigger('k', false, true), emptyAction('command.open'))
add(trigger(':', true), emptyAction('command.open'))
for (const [key, direction] of [
  ['h', 'left'], ['ArrowLeft', 'left'], ['l', 'right'], ['ArrowRight', 'right'],
  ['j', 'down'], ['ArrowDown', 'down'], ['k', 'up'], ['ArrowUp', 'up'],
] as const) add(trigger(key), compositionMove(direction), 'composition')

for (const key of ['j', 'ArrowDown']) {
  add(trigger(key, true), move('down'), 'composition')
}

for (const [key, name, shift, commandModifier] of [
  ['c', 'edit.copy', false, true],
  ['x', 'edit.cut', false, true],
  ['v', 'edit.paste', false, true],
  ['d', 'composition.cell.duplicate_right', false, true],
  ['n', 'composition.cell.rename_or_create_sequence', false, false],
  ['Delete', 'composition.cell.unassign', false, false],
  ['Backspace', 'composition.cell.unassign', false, false],
  ['r', 'composition.row.rename', false, false],
  ['o', 'composition.row.channel', false, false],
  ['[', 'composition.loop.set_start', false, false],
  [']', 'composition.loop.set_end', false, false],
] as const) add(trigger(key, shift, commandModifier), emptyAction(name), 'composition')
addHistoryBindings('composition')

for (const [context, entries] of [
  ['quick_access.command', [
    ['Escape', 'command.cancel'],
    ['Enter', 'command.submit'],
    ['ArrowUp', 'command.history.previous'],
    ['ArrowDown', 'command.history.next'],
    ['Tab', 'command.completion.accept'],
  ]],
  ['quick_access.completions', [
    ['Escape', 'command.completion.dismiss'],
    ['Enter', 'command.submit'],
    ['Tab', 'command.completion.accept'],
    ['ArrowUp', 'command.completion.previous'],
    ['ArrowDown', 'command.completion.next'],
  ]],
] as const) {
  for (const [key, name] of entries) add(trigger(key), emptyAction(name), context)
}

add(trigger('Backspace'), emptyAction('command.close_if_empty'), 'quick_access.command')
for (const [context, previous, next] of [
  ['quick_access.command', 'command.history.previous', 'command.history.next'],
  ['quick_access.completions', 'command.completion.previous', 'command.completion.next'],
] as const) {
  const previousTrigger = trigger('p')
  previousTrigger.modifiers.control = true
  add(previousTrigger, emptyAction(previous), context)
  const nextTrigger = trigger('n')
  nextTrigger.modifiers.control = true
  add(nextTrigger, emptyAction(next), context)
}

for (const [key, name, control] of [
  ['Escape', 'command.cancel', false],
  ['Enter', 'command.submit', false],
  ['ArrowDown', 'command.completion.next', false],
  ['ArrowUp', 'command.completion.previous', false],
  ['n', 'command.completion.next', true],
  ['p', 'command.completion.previous', true],
] as const) {
  const bindingTrigger = trigger(key)
  if (control) bindingTrigger.modifiers.control = true
  add(bindingTrigger, emptyAction(name), 'quick_access.browse')
}

const repeatableActions = new Set([
  'selection.move',
  'composition.selection.move',
  'command.history.previous',
  'command.history.next',
  'command.completion.previous',
  'command.completion.next',
])
for (const contextBindings of Object.values(bindings)) {
  for (const binding of contextBindings) {
    binding.repeat = binding.target.type === 'command'
      ? binding.target.command.startsWith('shift ') ? 'allow' : 'ignore'
      : repeatableActions.has(binding.target.action) ? 'allow' : 'ignore'
  }
}

export const defaultKeymapDocument: KeymapDocument = {
  schemaVersion: 2,
  bindings,
}
