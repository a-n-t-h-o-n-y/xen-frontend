import { describe, expect, it } from 'vitest'
import {
  expandNumericPlaceholders,
  findKeymapBinding,
  findKeymapTriggerConflict,
  formatKeymapTarget,
  formatKeymapTrigger,
  normalizeKey,
  triggerFromKeyboardEvent,
  triggerIdentity,
} from './keymap'
import { formatKeymapContext, getCommandKeymapContext } from './uiActions'
import { usesMetaForCommand } from '../platform'
import type { InputMode, KeymapBinding, KeymapResource, KeymapTrigger } from './models'

const trigger = (
  value: string,
  options: Partial<KeymapTrigger['modifiers']> = {},
  inputMode?: InputMode
): KeymapTrigger => ({
  match: { kind: 'key', value },
  modifiers: {
    shift: false,
    alt: false,
    primary: false,
    control: false,
    meta: false,
    ...options,
  },
  ...(inputMode ? { when: { inputMode } } : {}),
})

const binding = (bindingTrigger: KeymapTrigger, action = 'workspace.view.toggle'): KeymapBinding => ({
  trigger: bindingTrigger,
  target: { type: 'ui_action', action, arguments: {} } as KeymapBinding['target'],
})

const resource = (bindings: Record<string, KeymapBinding[]>): KeymapResource => ({
  revision: '1',
  keySemantics: 'KeyboardEvent.key-or-code',
  bindings,
  document: { schemaVersion: 2, bindings },
  source: 'stored',
  loadError: null,
})

const keyboardEvent = (key: string, init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent('keydown', { key, code: init.code ?? `Key${key.toUpperCase()}`, ...init })

describe('keymap routing', () => {
  it('normalizes ASCII capitals and expands numeric placeholders', () => {
    expect(normalizeKey('H')).toBe('h')
    expect(normalizeKey('ArrowLeft')).toBe('ArrowLeft')
    expect(expandNumericPlaceholders('duplicate :N=2:', '7')).toBe('duplicate 7')
    expect(expandNumericPlaceholders('duplicate :N=2:', '')).toBe('duplicate 2')
  })

  it('matches complete physical modifier state without dropping Meta', () => {
    const keymap = resource({ sequencer: [binding(trigger('c'))] })
    expect(findKeymapBinding(keymap, 'sequencer', keyboardEvent('c'), 'pitch')).not.toBeNull()
    expect(findKeymapBinding(
      keymap,
      'sequencer',
      keyboardEvent('c', { metaKey: true }),
      'pitch'
    )).toBeNull()
  })

  it('records primary and secondary accelerators distinctly', () => {
    const primary = triggerFromKeyboardEvent(keyboardEvent('k', { ctrlKey: true }))
    const secondary = triggerFromKeyboardEvent(keyboardEvent('k', { metaKey: true }))
    expect(primary.modifiers.primary).toBe(true)
    expect(primary.modifiers.control).toBe(false)
    expect(secondary.modifiers.primary).toBe(false)
    expect(secondary.modifiers.meta).toBe(true)
  })

  it('supports physical code matching', () => {
    const physical = trigger('unused')
    physical.match = { kind: 'code', value: 'KeyH' }
    const keymap = resource({ sequencer: [binding(physical)] })
    expect(findKeymapBinding(
      keymap,
      'sequencer',
      keyboardEvent('q', { code: 'KeyH' }),
      'pitch'
    )).not.toBeNull()
  })

  it('prefers input-mode-specific bindings over unconditional bindings', () => {
    const generic = binding(trigger('p'), 'workspace.view.toggle')
    const specific = binding(trigger('p', {}, 'velocity'), 'input_mode.set')
    specific.target = {
      type: 'ui_action',
      action: 'input_mode.set',
      arguments: { mode: 'pitch' },
    }
    const keymap = resource({ sequencer: [generic, specific] })
    expect(findKeymapBinding(keymap, 'sequencer', keyboardEvent('p'), 'velocity')?.target)
      .toMatchObject({ action: 'input_mode.set' })
    expect(findKeymapBinding(keymap, 'sequencer', keyboardEvent('p'), 'pitch')?.target)
      .toMatchObject({ action: 'workspace.view.toggle' })
  })

  it('finds exact conflicts only within a context', () => {
    const escape = trigger('Escape')
    const keymap = resource({ 'quick_access.command': [binding(escape, 'command.cancel')] })
    expect(findKeymapTriggerConflict(keymap, 'quick_access.command', escape)).not.toBeNull()
    expect(findKeymapTriggerConflict(keymap, 'sequencer', escape)).toBeNull()
    expect(findKeymapTriggerConflict(keymap, 'quick_access.command', escape, escape)).toBeNull()
  })

  it('detects semantic accelerator conflicts that resolve to the same physical stroke', () => {
    const physicalControl = trigger('n', usesMetaForCommand ? { meta: true } : { control: true })
    const primary = trigger('n', { primary: true })
    const keymap = resource({ 'quick_access.command': [binding(physicalControl)] })
    expect(findKeymapTriggerConflict(keymap, 'quick_access.command', primary)).not.toBeNull()
  })

  it('formats v2 triggers, targets, contexts, and stable identities', () => {
    const shortcut = trigger('h', { shift: true, primary: true })
    expect(triggerIdentity(shortcut)).toContain('key')
    expect(formatKeymapTrigger(shortcut)).toContain('Shift')
    expect(formatKeymapTarget({
      type: 'ui_action',
      action: 'selection.move',
      arguments: { direction: 'left', amount: 2 },
    })).toBe('Move left by 2')
    expect(formatKeymapContext('quick_access.completions')).toBe('Quick Access Completions')
    expect(getCommandKeymapContext(false)).toBe('quick_access.command')
    expect(getCommandKeymapContext(true)).toBe('quick_access.completions')
  })
})
