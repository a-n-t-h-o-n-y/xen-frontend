import { describe, expect, it } from 'vitest'
import { defaultKeymapDocument } from './defaultKeymap'

describe('default Weight input bindings', () => {
  it('assigns W to Weight and provides additive tenth-step edits', () => {
    const sequencer = defaultKeymapDocument.bindings.sequencer ?? []
    expect(sequencer).toContainEqual(expect.objectContaining({
      trigger: expect.objectContaining({ match: { kind: 'key', value: 'w' } }),
      target: {
        type: 'ui_action',
        action: 'input_mode.set',
        arguments: { mode: 'weight' },
      },
    }))
    expect(sequencer).toContainEqual(expect.objectContaining({
      trigger: expect.objectContaining({
        match: { kind: 'key', value: 'ArrowUp' },
        when: { inputMode: 'weight' },
      }),
      target: { type: 'command', command: 'shift weight +0.1' },
    }))
    expect(sequencer).toContainEqual(expect.objectContaining({
      trigger: expect.objectContaining({
        match: { kind: 'key', value: 'ArrowDown' },
        when: { inputMode: 'weight' },
      }),
      target: { type: 'command', command: 'shift weight -0.1' },
    }))
  })
})

describe('default MIDI CC input bindings', () => {
  it('selects automation mode and provides parameterized value edits', () => {
    const sequencer = defaultKeymapDocument.bindings.sequencer ?? []
    expect(sequencer).toContainEqual(expect.objectContaining({
      trigger: expect.objectContaining({ match: { kind: 'key', value: 'a' } }),
      target: {
        type: 'ui_action',
        action: 'input_mode.set',
        arguments: { mode: 'midi_cc' },
      },
    }))
    expect(sequencer).toContainEqual(expect.objectContaining({
      trigger: expect.objectContaining({
        match: { kind: 'key', value: 'ArrowUp' },
        when: { inputMode: 'midi_cc' },
      }),
      target: {
        type: 'ui_action',
        action: 'midi_cc.shift',
        arguments: { amount: 8 / 127 },
      },
      repeat: 'allow',
    }))
    expect(sequencer).toContainEqual(expect.objectContaining({
      trigger: expect.objectContaining({
        match: { kind: 'key', value: 'x' },
        when: { inputMode: 'midi_cc' },
      }),
      target: { type: 'ui_action', action: 'midi_cc.remove', arguments: {} },
    }))
  })
})
