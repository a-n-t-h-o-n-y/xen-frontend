import { describe, expect, it } from 'vitest'
import { buildSessionReference, filterCommandReference } from './reference'

describe('command reference', () => {
  const reference = buildSessionReference({
    schema_version: 4,
    commands: [
      {
        path: ['set', 'velocity'],
        keywords: ['volume', 'gain', 'level'],
        accepts_pattern_prefix: true,
        target_requirement: 'element',
        description: 'Set note velocity',
        arguments: [
          {
            kind: 'decimal',
            display_name: 'amount',
            required: false,
            default_value: '0.8',
            constraints: [{
              kind: 'range',
              minimum: 0,
              maximum: 1,
              values: [],
            }],
          },
        ],
      },
      {
        path: ['transport', 'stop'],
        keywords: ['pause', 'halt'],
        accepts_pattern_prefix: false,
        target_requirement: 'none',
        description: 'Stop playback',
        arguments: [],
      },
    ],
  })

  it('normalizes catalog command metadata', () => {
    expect(reference.commands[0]).toEqual({
      id: 'set velocity',
      signature: 'set velocity [amount=0.8]',
      keywords: ['volume', 'gain', 'level'],
      description: 'Set note velocity',
      targetRequirement: 'element',
      acceptsPatternPrefix: true,
      arguments: [{
        kind: 'decimal',
        displayName: 'amount',
        required: false,
        defaultValue: '0.8',
        constraints: [{
          kind: 'range',
          minimum: 0,
          maximum: 1,
          values: [],
        }],
      }],
    })
  })

  it('searches names, signatures, descriptions, and argument metadata', () => {
    expect(filterCommandReference(reference.commands, 'velocity')).toHaveLength(1)
    expect(filterCommandReference(reference.commands, 'playback')[0]?.id).toBe('transport stop')
    expect(filterCommandReference(reference.commands, 'amount=0.8')[0]?.id).toBe('set velocity')
    expect(filterCommandReference(reference.commands, 'decimal')[0]?.id).toBe('set velocity')
    expect(filterCommandReference(reference.commands, 'range')[0]?.id).toBe('set velocity')
  })
})
