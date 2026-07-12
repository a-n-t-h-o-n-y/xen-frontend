import { describe, expect, it } from 'vitest'
import {
  keymapFromDto,
  keymapDocumentToDto,
  libraryFromDto,
  projectFromDto,
} from './mappers'
import { arrangedProjectFixture, libraryFixture, projectFixture } from './testFixtures'

describe('DTO to domain mappers', () => {
  it('maps project snapshots to camelCase while preserving revision and pitch fields', () => {
    const project = projectFromDto(projectFixture(9))

    expect(project.revision).toBe(9)
    expect(project.historyEntryId).toBe(2)
    expect(project.previewActive).toBe(false)
    expect(project.sequence.timeSignature).toEqual({ numerator: 4, denominator: 4 })
    expect(project.pitch.scale?.sourceId).toBe('scale:major')
    expect(project.pitch.scale?.definition.tuningLength).toBe(12)
    expect(project.pitch.translationDirection).toBe('up')
    expect(project.pitch.baseFrequency).toBe(440)
  })

  it('maps arranged snapshots to sparse coordinate lookup maps', () => {
    const project = projectFromDto(arrangedProjectFixture(10))

    expect(project.revision).toBe(10)
    expect(project.sequence.timeSignature).toEqual({ numerator: 7, denominator: 8 })
    expect(project.sequence.cell).toEqual({
      weight: 1,
      elements: [{ type: 'Note', pitch: 99, velocity: 1, delay: 0, gate: 1 }],
    })
    expect(project.sequenceBank?.sequences.map((entry) => entry.name)).toEqual(['S1', 'S2'])
    expect(project.composition?.columns.size).toBe(3)
    expect(project.composition?.rows.get(3)).toMatchObject({
      coordinate: 3,
      name: 'channel-1',
      channelId: 'channel-1',
    })
    expect(project.composition?.placements.get('3,0')).toEqual({
      rowCoordinate: 3,
      columnCoordinate: 0,
      sequenceId: 1,
    })
    expect(project.composition?.loopRegion).toEqual({ startColumn: -2, endColumn: 6 })
    expect(project.pitch.scale?.definition.name).toBe('major')
  })

  it('uses backend sequence and row names when arranged snapshots provide them', () => {
    const fixture = arrangedProjectFixture(12)
    fixture.project.sequence_bank.sequences[0]!.name = 'Intro'
    fixture.project.sequence_bank.sequences[1]!.name = 'Pulse'
    fixture.project.composition.rows[0]!.name = 'Lead'
    fixture.project.composition.rows[1]!.name = 'Layer'

    const project = projectFromDto(fixture)

    expect(project.sequenceBank?.sequences.map((entry) => entry.name)).toEqual(['Intro', 'Pulse'])
    expect(Array.from(project.composition?.rows.values() ?? []).map((row) => row.name))
      .toEqual(['Lead', 'Layer'])
  })

  it('does not retain axis metadata after the final placement is cleared', () => {
    const fixture = arrangedProjectFixture()
    fixture.project.composition.placements = fixture.project.composition.placements.filter(
      (placement) => placement.row !== 3
    )
    fixture.project.composition.rows = fixture.project.composition.rows.filter(
      (row) => row.coordinate !== 3
    )
    fixture.project.composition.columns = fixture.project.composition.columns.filter(
      (column) => column.coordinate !== 0
    )

    const composition = projectFromDto(fixture).composition!
    expect(composition.rows.has(3)).toBe(false)
    expect(composition.columns.has(0)).toBe(false)
    expect(composition.placements.has('3,0')).toBe(false)
  })

  it('maps library snapshots to camelCase resources and commands', () => {
    const library = libraryFromDto(libraryFixture(7))

    expect(library.revision).toBe(7)
    expect(library.cells[0]?.relativePath).toBe('sequence.xen')
    expect(library.tunings).toEqual([])
    expect(library.scales[1]).toMatchObject({
      id: 'scale:major',
      definition: { tuningLength: 12 },
    })
    expect(library.commands).toEqual({
      reloadScales: 'load scales',
      reloadChords: 'load chords',
      libraryDirectory: 'libraryDirectory',
    })
  })

  it('loads complete schema-v2 keymap documents', () => {
    const keymap = keymapFromDto({
      revision: '18446744073709551615',
      document: {
        schema_version: 2,
        bindings: { sequencer: [{
          trigger: {
            match: { kind: 'key', value: 'q' },
            modifiers: {
              shift: false,
              alt: false,
              primary: false,
              control: false,
              meta: false,
            },
          },
          target: {
            type: 'ui_action',
            action: 'input_mode.set',
            arguments: { mode: 'pitch' },
          },
        }] },
      },
    })

    expect(keymap.revision).toBe('18446744073709551615')
    expect(keymap.bindings.sequencer?.[0]?.trigger.match.value).toBe('q')
    expect(keymap.source).toBe('stored')
    expect(keymap.loadError).toBeNull()
  })

  it('uses defaults for missing or unsupported documents and serializes complete documents', () => {
    const keymap = keymapFromDto({ revision: '7', document: null })
    expect(keymap.bindings.composition).not.toHaveLength(0)
    expect(keymap.source).toBe('default')

    const legacy = keymapFromDto({
      revision: '8',
      document: { schema_version: 1, overrides: [] },
    })
    expect(legacy.source).toBe('default')
    expect(legacy.loadError).toContain('Stored shortcuts were ignored')
    expect(keymapDocumentToDto(keymap.document).schema_version).toBe(2)
  })
})
