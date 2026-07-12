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
    expect(project.measure.timeSignature).toEqual({ numerator: 4, denominator: 4 })
    expect(project.pitch.scale?.sourceId).toBe('scale:major')
    expect(project.pitch.scale?.definition.tuningLength).toBe(12)
    expect(project.pitch.translationDirection).toBe('up')
    expect(project.pitch.baseFrequency).toBe(440)
  })

  it('maps arranged project snapshots to the first row first-column measure', () => {
    const project = projectFromDto(arrangedProjectFixture(10))

    expect(project.revision).toBe(10)
    expect(project.measure.timeSignature).toEqual({ numerator: 7, denominator: 8 })
    expect(project.measure.cell).toEqual({
      weight: 1,
      elements: [{ type: 'Note', pitch: 99, velocity: 1, delay: 0, gate: 1 }],
    })
    expect(project.measureBank?.measures.map((entry) => entry.name)).toEqual(['M1', 'M2'])
    expect(project.composition?.columns).toHaveLength(3)
    expect(project.composition?.rows[1]).toMatchObject({
      name: 'channel-1',
      channelId: 'channel-1',
      cells: [2, 1, null],
    })
    expect(project.composition?.loopRegion).toEqual({ startColumn: 2, endColumn: 0 })
    expect(project.pitch.scale?.definition.name).toBe('major')
  })

  it('uses backend measure and row names when arranged snapshots provide them', () => {
    const fixture = arrangedProjectFixture(12)
    if (fixture.schema_version === 4) {
      fixture.project.sequence_bank.sequences[0]!.name = 'Intro'
      fixture.project.sequence_bank.sequences[1]!.name = 'Pulse'
      fixture.project.composition.rows[0]!.name = 'Lead'
      fixture.project.composition.rows[1]!.name = 'Layer'
    }

    const project = projectFromDto(fixture)

    expect(project.measureBank?.measures.map((entry) => entry.name)).toEqual(['Intro', 'Pulse'])
    expect(project.composition?.rows.map((row) => row.name)).toEqual(['Lead', 'Layer'])
  })

  it('defaults missing arranged loop regions to the full composition length', () => {
    const fixture = arrangedProjectFixture(11)
    delete fixture.project.composition.loop_region

    expect(projectFromDto(fixture).composition?.loopRegion).toEqual({
      startColumn: 0,
      endColumn: 2,
    })
  })

  it('maps library snapshots to camelCase resources and commands', () => {
    const library = libraryFromDto(libraryFixture(7))

    expect(library.revision).toBe(7)
    expect(library.cells[0]?.relativePath).toBe('measure.xen')
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
