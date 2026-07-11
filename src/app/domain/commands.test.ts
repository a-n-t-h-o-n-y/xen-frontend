import { describe, expect, it } from 'vitest'
import {
  compositionCellAssign,
  compositionCellClear,
  compositionColumnDelete,
  compositionColumnInsert,
  compositionLoopBoundary,
  compositionRowChannel,
  compositionRowDelete,
  compositionRowInsert,
  compositionRowRename,
  scaleDuration,
  setBaseFrequency,
  setKey,
  setDuration,
  setMode,
  setTranslateDirection,
} from './commands'

describe('composition command builders', () => {
  it('builds cell clear commands', () => {
    expect(compositionCellClear(2, 3)).toBe('composition cell clear 2 3')
  })

  it('builds cell assign commands with JSON-quoted names', () => {
    expect(compositionCellAssign(1, 2, 'lead')).toBe('composition cell assign 1 2 "lead"')
  })

  it('escapes quotes inside cell assign names', () => {
    expect(compositionCellAssign(0, 0, 'a"b')).toBe('composition cell assign 0 0 "a\\"b"')
  })

  it('builds row rename commands', () => {
    expect(compositionRowRename(4, 'bass')).toBe('composition row rename 4 "bass"')
  })

  it('builds row channel commands', () => {
    expect(compositionRowChannel(0, 'ch1')).toBe('composition row channel 0 "ch1"')
  })

  it('builds row insert commands for both placements', () => {
    expect(compositionRowInsert('before', 1)).toBe('composition row insert before 1')
    expect(compositionRowInsert('after', 1)).toBe('composition row insert after 1')
  })

  it('builds row delete commands', () => {
    expect(compositionRowDelete(2)).toBe('composition row delete 2')
  })

  it('builds column insert commands for both placements', () => {
    expect(compositionColumnInsert('before', 3)).toBe('composition column insert before 3')
    expect(compositionColumnInsert('after', 3)).toBe('composition column insert after 3')
  })

  it('builds column delete commands', () => {
    expect(compositionColumnDelete(1)).toBe('composition column delete 1')
  })

  it('builds loop boundary commands for both boundaries', () => {
    expect(compositionLoopBoundary('start', 0)).toBe('composition loop start 0')
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
