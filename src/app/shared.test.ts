import { describe, expect, it } from 'vitest'
import {
  collectNotePitches,
  flattenMeasureToNoteIR,
  getChildCells,
  getPrimaryElement,
  getSelectedElement,
  getStatusCellMeta,
  parseUiStateSnapshot,
} from './shared'

const createSnapshot = (cell: unknown, elementIndex: number | null) => ({
  schema_version: 2,
  snapshot_version: 7,
  engine: {
    sequence_bank: [
      {
        cell,
        time_signature: {
          numerator: 4,
          denominator: 4,
        },
      },
    ],
    sequence_names: ['Sequence 0'],
    tuning: {
      intervals: [0, 100, 200, 300],
      octave: 1200,
    },
    tuning_name: '12EDO',
    scale: null,
    key: 0,
    scale_translate_direction: 'up' as const,
    base_frequency: 440,
  },
  editor: {
    selected: {
      measure: 0,
      cell: [],
      element_index: elementIndex,
    },
    input_mode: 'pitch' as const,
  },
})

describe('parseUiStateSnapshot', () => {
  it('parses a v2 note-only cell and accepts null element_index', () => {
    const snapshot = createSnapshot(
      {
        weight: 1,
        elements: [{ type: 'Note', pitch: 7, velocity: 0.8, delay: 0.1, gate: 0.5 }],
      },
      null
    )

    const parsed = parseUiStateSnapshot(snapshot)

    expect(parsed).not.toBeNull()
    expect(parsed?.schema_version).toBe(2)
    expect(parsed?.editor.selected.element_index).toBeNull()

    const cell = parsed?.engine.sequence_bank[0]?.cell
    expect(cell).toBeDefined()
    expect(cell ? collectNotePitches(cell) : []).toEqual([7])
    expect(cell ? getPrimaryElement(cell)?.type : null).toBe('Note')
  })

  it('parses a v2 sequence-only cell and exposes its child cells', () => {
    const snapshot = createSnapshot(
      {
        weight: 1,
        elements: [
          {
            type: 'Sequence',
            cells: [
              {
                weight: 2,
                elements: [{ type: 'Note', pitch: 5, velocity: 1, delay: 0, gate: 1 }],
              },
            ],
          },
        ],
      },
      null
    )

    const parsed = parseUiStateSnapshot(snapshot)
    const rootCell = parsed?.engine.sequence_bank[0]?.cell

    expect(parsed).not.toBeNull()
    expect(rootCell ? getPrimaryElement(rootCell)?.type : null).toBe('Sequence')
    expect(rootCell ? getChildCells(rootCell) : []).toHaveLength(1)
    expect(rootCell ? collectNotePitches(rootCell) : []).toEqual([5])
  })

  it('parses an empty-elements cell as a blank cell', () => {
    const snapshot = createSnapshot(
      {
        weight: 3,
        elements: [],
      },
      null
    )

    const parsed = parseUiStateSnapshot(snapshot)
    const cell = parsed?.engine.sequence_bank[0]?.cell

    expect(parsed).not.toBeNull()
    expect(cell ? getPrimaryElement(cell) : null).toBeNull()
    expect(cell ? getChildCells(cell) : []).toEqual([])
    expect(cell ? getStatusCellMeta(cell) : []).toEqual([{ label: 'w', value: '3' }])
  })

  it('preserves multi-element cells and honors selected.element_index', () => {
    const snapshot = createSnapshot(
      {
        weight: 1,
        elements: [
          { type: 'Note', pitch: 7, velocity: 0.9, delay: 0.25, gate: 0.5 },
          {
            type: 'Sequence',
            cells: [
              {
                weight: 1,
                elements: [{ type: 'Note', pitch: 11, velocity: 0.6, delay: 0, gate: 1 }],
              },
            ],
          },
        ],
      },
      0
    )

    const parsed = parseUiStateSnapshot(snapshot)
    const measure = parsed?.engine.sequence_bank[0]
    const cell = measure?.cell
    const selectedElement = cell ? getSelectedElement(cell, parsed?.editor.selected.element_index) : null

    expect(parsed).not.toBeNull()
    expect(measure).toBeDefined()
    expect(cell ? getPrimaryElement(cell)?.type : null).toBe('Sequence')
    expect(selectedElement?.type).toBe('Note')
    expect(selectedElement && selectedElement.type === 'Note' ? selectedElement.pitch : null).toBe(7)
    expect(measure ? flattenMeasureToNoteIR(measure, 0).map((note) => note.pitch).sort((a, b) => a - b) : []).toEqual([7, 11])
    expect(cell ? getStatusCellMeta(cell, selectedElement) : []).toEqual([
      { label: 'p', value: '7' },
      { label: 'd', value: '0.25' },
      { label: 'g', value: '0.50' },
      { label: 'v', value: '0.90' },
      { label: 'w', value: '1' },
    ])
  })

  it('rejects snapshots with a non-v2 schema version', () => {
    const snapshot = {
      ...createSnapshot(
        {
          weight: 1,
          elements: [{ type: 'Note', pitch: 7, velocity: 1, delay: 0, gate: 1 }],
        },
        null
      ),
      schema_version: 1,
    }

    expect(parseUiStateSnapshot(snapshot)).toBeNull()
  })
})
