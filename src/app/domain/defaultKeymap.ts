import type {
  InputMode,
  KeymapBinding,
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
  ? { key, modifiers: { shift, command, alt }, when: { inputMode } }
  : { key, modifiers: { shift, command, alt } }

const command = (value: string): KeymapTarget => ({ type: 'command', command: value })
const action = (value: Extract<KeymapTarget, { type: 'ui_action' }>): KeymapTarget => value
const emptyAction = (
  name: Extract<KeymapTarget, { type: 'ui_action' }>['action']
): KeymapTarget => ({ type: 'ui_action', action: name, arguments: {} } as KeymapTarget)

const add = (bindingTrigger: KeymapTrigger, target: KeymapTarget, context = 'sequence'): void => {
  const contextBindings = bindings[context] ?? []
  contextBindings.push({ trigger: bindingTrigger, target })
  bindings[context] = contextBindings
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

add(trigger('c', false, true), command('copy'))
add(trigger('x', false, true), command('cut'))
add(trigger('v', false, true), command('paste'))
add(trigger('d', false, true), command('duplicate'))
add(trigger('z', false, true), command('undo'))
add(trigger('y', false, true), command('redo'))
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
add(trigger(':'), emptyAction('command.open'))
add(trigger('Tab'), emptyAction('workspace.view.composition'))

for (const [key, direction] of [
  ['h', 'left'], ['ArrowLeft', 'left'], ['l', 'right'], ['ArrowRight', 'right'],
  ['j', 'down'], ['ArrowDown', 'down'], ['k', 'up'], ['ArrowUp', 'up'],
] as const) add(trigger(key), compositionMove(direction), 'composition')

for (const [key, name, shift, commandModifier] of [
  ['c', 'composition.cell.copy', false, true],
  ['x', 'composition.cell.cut', false, true],
  ['v', 'composition.cell.paste', false, true],
  ['d', 'composition.cell.duplicate_right', false, true],
  ['Enter', 'composition.cell.edit_measure', false, false],
  ['n', 'composition.cell.rename_or_create_measure', false, false],
  ['Delete', 'composition.cell.clear', false, false],
  ['Backspace', 'composition.cell.clear', false, false],
  ['i', 'composition.row.insert_before', false, false],
  ['a', 'composition.row.insert_after', false, false],
  ['d', 'composition.row.delete', true, false],
  ['r', 'composition.row.rename', false, false],
  ['o', 'composition.row.channel', false, false],
  ['i', 'composition.column.insert_before', true, false],
  ['a', 'composition.column.insert_after', true, false],
  ['d', 'composition.column.delete', true, true],
  ['[', 'composition.loop.set_start', false, false],
  [']', 'composition.loop.set_end', false, false],
] as const) add(trigger(key, shift, commandModifier), emptyAction(name), 'composition')
add(trigger('Tab'), emptyAction('workspace.view.sequencer'), 'composition')

for (const [context, entries] of [
  ['command.input', [
    ['Escape', 'command.cancel'],
    ['Enter', 'command.submit'],
    ['ArrowUp', 'command.history.previous'],
    ['ArrowDown', 'command.history.next'],
    ['Tab', 'command.completion.accept'],
  ]],
  ['command.completions', [
    ['Escape', 'command.completion.dismiss'],
    ['Enter', 'command.completion.accept'],
    ['Tab', 'command.completion.accept'],
    ['ArrowUp', 'command.completion.previous'],
    ['ArrowDown', 'command.completion.next'],
  ]],
] as const) {
  for (const [key, name] of entries) add(trigger(key), emptyAction(name), context)
}

export const defaultKeymapBindings: Readonly<Record<string, readonly KeymapBinding[]>> = bindings
