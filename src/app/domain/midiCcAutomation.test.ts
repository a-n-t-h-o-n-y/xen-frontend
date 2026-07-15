import { describe, expect, it } from 'vitest'
import {
  buildMidiCcAutomationSegments,
  summarizeSelectedMidiCc,
} from './midiCcAutomation'

describe('MIDI CC automation presentation', () => {
  const notes = [
    {
      x: 0,
      width: 0.5,
      midiCc: [{ controller: 1, value: 0.1 }, { controller: 74, value: 0 }],
      isSelected: true,
    },
    {
      x: 0.5,
      width: 0.5,
      midiCc: [{ controller: 74, value: 1 }],
      isSelected: false,
    },
  ]

  it('keeps explicit zero and connects only touching values of the same controller', () => {
    const segments = buildMidiCcAutomationSegments(notes, 74)
    expect(segments).toEqual([
      expect.objectContaining({ controller: 1, value: 0.1, connectFromValue: null, active: false }),
      expect.objectContaining({ controller: 74, value: 0, connectFromValue: null, active: true }),
      expect.objectContaining({ controller: 74, value: 1, connectFromValue: 0, active: true }),
    ])
  })

  it('summarizes unset, single, and mixed selected values', () => {
    expect(summarizeSelectedMidiCc(notes, 74)).toBe('0.000')
    expect(summarizeSelectedMidiCc(notes, 2)).toBe('Unset')
    expect(summarizeSelectedMidiCc(notes.map((note) => ({ ...note, isSelected: true })), 74))
      .toBe('Mixed')
  })
})
