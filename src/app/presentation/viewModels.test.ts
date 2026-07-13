import { describe, expect, it } from 'vitest'
import { nestedCell } from '../domain/testFixtures'
import { getSelectionInspector } from './viewModels'

describe('selection inspector presentation', () => {
  it('describes notes with semantic metadata labels', () => {
    const note = nestedCell.elements[0]
    expect(getSelectionInspector(nestedCell, note)).toEqual({
      kind: 'note',
      summary: 'Note · P0',
      items: [
        { label: 'Pitch', value: '0' },
        { label: 'Delay', value: '0.00' },
        { label: 'Gate', value: '1.00' },
        { label: 'Velocity', value: '1.00' },
        { label: 'Weight', value: '1' },
      ],
    })
  })

  it('summarizes nested sequences by child count', () => {
    const sequence = nestedCell.elements[1]
    expect(getSelectionInspector(nestedCell, sequence)).toMatchObject({
      kind: 'sequence',
      summary: 'Sequence · 2 cells',
    })
  })
})
