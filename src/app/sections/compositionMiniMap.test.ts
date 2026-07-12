import { describe, expect, it } from 'vitest'
import { maxMiniMapNotes, selectMiniMapNotePreview } from './compositionMiniMap'
import type { NoteSpanIR } from '../domain/music'

const note = (
  x: number,
  overrides: Partial<NoteSpanIR> = {}
): NoteSpanIR => ({
  sequenceIndex: 0,
  pitch: 0,
  x,
  width: 0.01,
  velocity: 0.5,
  ...overrides,
})

describe('composition minimap note preview', () => {
  it('keeps every note when the sequence is at or below the minimap cap', () => {
    const notes = Array.from({ length: maxMiniMapNotes }, (_, index) =>
      note(index / maxMiniMapNotes, { pitch: index })
    )

    expect(selectMiniMapNotePreview(notes)).toEqual(notes)
  })

  it('limits dense sequences to the minimap cap', () => {
    const notes = Array.from({ length: maxMiniMapNotes * 2 }, (_, index) =>
      note(index / (maxMiniMapNotes * 2), { pitch: index })
    )

    expect(selectMiniMapNotePreview(notes)).toHaveLength(maxMiniMapNotes)
  })

  it('preserves notes across the full sequence instead of only early notes', () => {
    const notes = Array.from({ length: maxMiniMapNotes * 2 }, (_, index) =>
      note(index / (maxMiniMapNotes * 2), { pitch: index })
    )
    const preview = selectMiniMapNotePreview(notes)

    expect(preview[0]?.x).toBe(0)
    expect(preview.at(-1)?.x).toBeGreaterThan(0.99)
    expect(preview.at(-1)?.pitch).toBeGreaterThan(maxMiniMapNotes * 2 - 4)
  })

  it('chooses the strongest bucket representative by velocity, width, then original order', () => {
    const baseNotes = Array.from({ length: maxMiniMapNotes + 1 }, (_, index) =>
      note((index + 1) / (maxMiniMapNotes + 2), { pitch: index })
    )
    const bucketNotes = [
      note(0, { pitch: 1000, velocity: 0.2, width: 0.9 }),
      note(0, { pitch: 1001, velocity: 0.8, width: 0.1 }),
      note(0, { pitch: 1002, velocity: 0.8, width: 0.4 }),
      note(0, { pitch: 1003, velocity: 0.8, width: 0.4 }),
    ]
    const preview = selectMiniMapNotePreview([...bucketNotes, ...baseNotes])

    expect(preview[0]?.pitch).toBe(1002)
  })
})
