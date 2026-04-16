import { describe, expect, it } from 'vitest'
import {
  collectLeafCells,
  collectNotePitches,
  flattenMeasureToNoteIR,
  getCellAtPath,
  getChildCells,
  getPrimaryElement,
  getSelectedElement,
  getSequenceElements,
  getStatusCellMeta,
  parseUiStateSnapshot,
  resolveSelectionPath,
} from './shared'
import type { SelectionStep } from './shared'

const createSnapshot = (path: SelectionStep[]) => ({
  schema_version: 4,
  snapshot_version: 7,
  commit_id: 1,
  engine: {
    measure: {
      cell: {
        weight: 1,
        elements: [{ type: 'Note', pitch: 7, velocity: 0.8, delay: 0.1, gate: 0.5 }],
      },
      time_signature: {
        numerator: 4,
        denominator: 4,
      },
    },
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
      path,
    },
    input_mode: 'pitch' as const,
  },
})

describe('parseUiStateSnapshot', () => {
  it('parses a v4 note-only cell with an empty selection path', () => {
    const snapshot = createSnapshot([])

    const parsed = parseUiStateSnapshot(snapshot)

    expect(parsed).not.toBeNull()
    expect(parsed?.schema_version).toBe(4)
    expect(parsed?.editor.selected.path).toEqual([])

    const cell = parsed?.engine.measure.cell
    expect(cell).toBeDefined()
    expect(cell ? collectNotePitches(cell) : []).toEqual([7])
    expect(cell ? getPrimaryElement(cell)?.type : null).toBe('Note')

    const selection = parsed ? resolveSelectionPath(parsed.engine.measure.cell, parsed.editor.selected.path) : null
    expect(selection?.cellPath).toEqual([])
    expect(selection?.selectedElement).toBeNull()
  })

  it('parses a v4 sequence-only cell and exposes its child cells', () => {
    const snapshot = {
      ...createSnapshot([{ kind: 'element', index: 0 }]),
      engine: {
        ...createSnapshot([{ kind: 'element', index: 0 }]).engine,
        measure: {
          cell: {
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
          time_signature: {
            numerator: 4,
            denominator: 4,
          },
        },
      },
    }

    const parsed = parseUiStateSnapshot(snapshot)
    const rootCell = parsed?.engine.measure.cell

    expect(parsed).not.toBeNull()
    expect(rootCell ? getPrimaryElement(rootCell)?.type : null).toBe('Sequence')
    expect(rootCell ? getChildCells(rootCell) : []).toHaveLength(1)
    expect(rootCell ? getSequenceElements(rootCell) : []).toHaveLength(1)
    expect(rootCell ? collectNotePitches(rootCell) : []).toEqual([5])
  })

  it('treats the root cell as the top-level render node with notes and child branches', () => {
    const snapshot = {
      ...createSnapshot([]),
      engine: {
        ...createSnapshot([]).engine,
        measure: {
          cell: {
            weight: 1,
            elements: [
              { type: 'Note', pitch: 7, velocity: 0.8, delay: 0.1, gate: 0.5 },
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
          time_signature: {
            numerator: 4,
            denominator: 4,
          },
        },
      },
    }

    const parsed = parseUiStateSnapshot(snapshot)
    const rootCell = parsed?.engine.measure.cell ?? null

    expect(rootCell ? collectLeafCells(rootCell) : []).toEqual([{ path: [0] }])
    expect(rootCell ? getCellAtPath(rootCell, []) : null).toEqual(rootCell)
    expect(rootCell ? collectNotePitches(rootCell) : []).toEqual([7, 11])
  })

  it('parses an empty-elements cell as a blank cell', () => {
    const snapshot = {
      ...createSnapshot([]),
      engine: {
        ...createSnapshot([]).engine,
        measure: {
          cell: {
            weight: 3,
            elements: [],
          },
          time_signature: {
            numerator: 4,
            denominator: 4,
          },
        },
      },
    }

    const parsed = parseUiStateSnapshot(snapshot)
    const cell = parsed?.engine.measure.cell

    expect(parsed).not.toBeNull()
    expect(cell ? getPrimaryElement(cell) : null).toBeNull()
    expect(cell ? getChildCells(cell) : []).toEqual([])
    expect(cell ? getStatusCellMeta(cell) : []).toEqual([{ label: 'w', value: '3' }])
  })

  it('resolves a typed selection path to a nested note', () => {
    const snapshot = {
      ...createSnapshot([
        { kind: 'element', index: 1 },
        { kind: 'cell', index: 0 },
        { kind: 'element', index: 0 },
      ]),
      engine: {
        ...createSnapshot([
          { kind: 'element', index: 1 },
          { kind: 'cell', index: 0 },
          { kind: 'element', index: 0 },
        ]).engine,
        measure: {
          cell: {
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
          time_signature: {
            numerator: 4,
            denominator: 4,
          },
        },
      },
    }

    const parsed = parseUiStateSnapshot(snapshot)
    const measure = parsed?.engine.measure
    const selection = parsed ? resolveSelectionPath(parsed.engine.measure.cell, parsed.editor.selected.path) : null
    const selectedCell = selection?.selectedCell ?? null
    const selectedElement = selection?.selectedElement ?? null

    expect(parsed).not.toBeNull()
    expect(measure).toBeDefined()
    expect(selection?.cellPath).toEqual([0])
    expect(selectedCell ? getPrimaryElement(selectedCell)?.type : null).toBe('Note')
    expect(selectedElement?.type).toBe('Note')
    expect(selectedElement && selectedElement.type === 'Note' ? selectedElement.pitch : null).toBe(11)
    expect(measure ? flattenMeasureToNoteIR(measure, 0).map((note) => note.pitch).sort((a, b) => a - b) : []).toEqual([7, 11])
    expect(selectedCell ? getStatusCellMeta(selectedCell, selectedElement) : []).toEqual([
      { label: 'p', value: '11' },
      { label: 'd', value: '0.00' },
      { label: 'g', value: '1.00' },
      { label: 'v', value: '0.60' },
      { label: 'w', value: '1' },
    ])
  })

  it('exposes child cells from multiple sequence elements in element order', () => {
    const snapshot = {
      ...createSnapshot([]),
      engine: {
        ...createSnapshot([]).engine,
        measure: {
          cell: {
            weight: 1,
            elements: [
              {
                type: 'Sequence',
                cells: [
                  {
                    weight: 1,
                    elements: [{ type: 'Note', pitch: 3, velocity: 1, delay: 0, gate: 1 }],
                  },
                ],
              },
              { type: 'Note', pitch: 7, velocity: 0.8, delay: 0.1, gate: 0.5 },
              {
                type: 'Sequence',
                cells: [
                  {
                    weight: 1,
                    elements: [{ type: 'Note', pitch: 9, velocity: 1, delay: 0, gate: 1 }],
                  },
                ],
              },
            ],
          },
          time_signature: {
            numerator: 4,
            denominator: 4,
          },
        },
      },
    }

    const parsed = parseUiStateSnapshot(snapshot)
    const rootCell = parsed?.engine.measure.cell ?? null
    const childPitches = rootCell
      ? getChildCells(rootCell).map((cell) => {
          const primaryElement = getPrimaryElement(cell)
          return primaryElement?.type === 'Note' ? primaryElement.pitch : null
        })
      : []

    expect(childPitches).toEqual([3, 9])
    expect(rootCell ? collectLeafCells(rootCell) : []).toEqual([{ path: [0] }, { path: [1] }])
    expect(rootCell ? getCellAtPath(rootCell, [1]) : null).toEqual(rootCell ? getChildCells(rootCell)[1] : null)
  })

  it('uses metadata fallback without changing traversal when a cell is selected', () => {
    const snapshot = {
      ...createSnapshot([{ kind: 'element', index: 1 }, { kind: 'cell', index: 0 }]),
      engine: {
        ...createSnapshot([{ kind: 'element', index: 1 }, { kind: 'cell', index: 0 }]).engine,
        measure: {
          cell: {
            weight: 1,
            elements: [
              { type: 'Note', pitch: 7, velocity: 0.9, delay: 0.25, gate: 0.5 },
              {
                type: 'Sequence',
                cells: [
                  {
                    weight: 1,
                    elements: [
                      { type: 'Note', pitch: 11, velocity: 0.6, delay: 0, gate: 1 },
                      {
                        type: 'Sequence',
                        cells: [
                          {
                            weight: 1,
                            elements: [{ type: 'Note', pitch: 14, velocity: 0.5, delay: 0, gate: 1 }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          time_signature: {
            numerator: 4,
            denominator: 4,
          },
        },
      },
    }

    const parsed = parseUiStateSnapshot(snapshot)
    const selection = parsed ? resolveSelectionPath(parsed.engine.measure.cell, parsed.editor.selected.path) : null
    const selectedCell = selection?.selectedCell ?? null
    const fallbackElement = selectedCell ? getSelectedElement(selectedCell, null) : null

    expect(selection?.cellPath).toEqual([0])
    expect(selection?.selectedElement).toBeNull()
    expect(fallbackElement?.type).toBe('Note')
    expect(selectedCell ? getStatusCellMeta(selectedCell, selection?.selectedElement) : []).toEqual([
      { label: 'p', value: '11' },
      { label: 'd', value: '0.00' },
      { label: 'g', value: '1.00' },
      { label: 'v', value: '0.60' },
      { label: 'w', value: '1' },
    ])
  })

  it('rejects snapshots with a non-v4 schema version', () => {
    const snapshot = {
      ...createSnapshot([]),
      schema_version: 3,
    }

    expect(parseUiStateSnapshot(snapshot)).toBeNull()
  })
})
