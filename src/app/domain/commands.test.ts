import { describe, expect, it } from 'vitest'
import {
  compositionCellAssign,
  compositionCellUnassign,
  compositionCellMove,
  compositionLoopBoundary,
  compositionRowChannel,
  compositionRowRename,
  scaleDuration,
  removeMidiCc,
  removeMidiCcLabel,
  setMidiCc,
  setMidiCcLabel,
  shiftMidiCc,
  setBaseFrequency,
  setKey,
  setDuration,
  setMode,
  setTranslateDirection,
} from './commands'

describe('composition command builders', () => {
  it('builds cell unassign commands with signed coordinates', () => {
    expect(compositionCellUnassign(-2, 3)).toBe('composition cell unassign -2 3')
  })

  it('builds cell assign commands with JSON-quoted names', () => {
    expect(compositionCellAssign(1, 2, 'lead')).toBe('composition cell assign 1 2 "lead"')
  })

  it('escapes quotes inside cell assign names', () => {
    expect(compositionCellAssign(0, 0, 'a"b')).toBe('composition cell assign 0 0 "a\\"b"')
  })

  it('builds sparse cell move commands', () => {
    expect(compositionCellMove(-8, 3, 21, -34))
      .toBe('composition cell move -8 3 21 -34')
  })

  it('builds row rename commands', () => {
    expect(compositionRowRename(4, 'bass')).toBe('composition row rename 4 "bass"')
  })

  it('builds row channel commands', () => {
    expect(compositionRowChannel(0, 'ch1')).toBe('composition row channel 0 "ch1"')
  })

  it('builds loop boundary commands for both boundaries', () => {
    expect(compositionLoopBoundary('start', -4)).toBe('composition loop start -4')
    expect(compositionLoopBoundary('end', 4)).toBe('composition loop end 4')
  })
})

describe('set command builders', () => {
  it('builds set duration commands', () => {
    expect(setDuration('3/4')).toBe('set duration 3/4')
  })

  it('builds set key commands', () => {
    expect(setKey(5)).toBe('set key 5')
  })

  it('builds set baseFrequency commands', () => {
    expect(setBaseFrequency(440)).toBe('set baseFrequency 440')
  })

  it('builds set mode commands', () => {
    expect(setMode(2)).toBe('set mode 2')
  })

  it('builds set translateDirection commands for both directions', () => {
    expect(setTranslateDirection('up')).toBe('set translateDirection up')
    expect(setTranslateDirection('down')).toBe('set translateDirection down')
  })

  it('builds scale duration commands for both modes', () => {
    expect(scaleDuration('half')).toBe('halve duration')
    expect(scaleDuration('double')).toBe('double duration')
  })
})

describe('MIDI CC command builders', () => {
  it('builds parameterized value commands', () => {
    expect(setMidiCc(74, 0.625)).toBe('set midiCC 74 0.625')
    expect(shiftMidiCc(74, 1 / 127)).toBe(`shift midiCC 74 +${1 / 127}`)
    expect(removeMidiCc(74)).toBe('remove midiCC 74')
  })

  it('quotes labels and builds label removal', () => {
    expect(setMidiCcLabel(74, 'Filter "cutoff"'))
      .toBe('set midiCCLabel 74 "Filter \\"cutoff\\""')
    expect(removeMidiCcLabel(74)).toBe('remove midiCCLabel 74')
  })
})
