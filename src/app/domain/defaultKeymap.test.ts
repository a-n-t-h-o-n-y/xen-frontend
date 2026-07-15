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
