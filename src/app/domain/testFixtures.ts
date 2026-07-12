import type { LibrarySnapshotDto, ProjectSnapshotDto } from './contracts'
import type { Cell } from './music'

export const nestedCell: Cell = {
  weight: 1,
  elements: [
    { type: 'Note', pitch: 0, velocity: 1, delay: 0, gate: 1 },
    {
      type: 'Sequence',
      cells: [
        {
          weight: 1,
          elements: [{ type: 'Note', pitch: 1, velocity: 1, delay: 0, gate: 1 }],
        },
        {
          weight: 1,
          elements: [
            { type: 'Note', pitch: 2, velocity: 1, delay: 0, gate: 1 },
            {
              type: 'Sequence',
              cells: [
                {
                  weight: 1,
                  elements: [{ type: 'Note', pitch: 7, velocity: 1, delay: 0, gate: 1 }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

const pitchFixture = () => ({
  tuning: {
    name: '12EDO',
    definition: {
      intervals: Array.from({ length: 12 }, (_, index) => index * 100),
      octave: 1200,
    },
  },
  scale: {
    source_id: 'scale:major',
    definition: {
      name: 'major',
      tuning_length: 12,
      intervals: [2, 2, 1, 2, 2, 2, 1],
      mode: 1,
    },
  },
  transposition: 2,
  translation_direction: 'up' as const,
  base_frequency: 440,
})

export const projectFixture = (revision = 3): ProjectSnapshotDto => ({
  schema_version: 5,
  history_entry_id: 2,
  project_revision: revision,
  preview_active: false,
  project: {
    sequence_bank: {
      next_id: 2,
      sequences: [{ id: 1, cell: nestedCell }],
    },
    composition: {
      default_column: {
        duration: { numerator: 4, denominator: 4 },
        pitch: pitchFixture(),
      },
      columns: [{
        coordinate: 0,
        duration: { numerator: 4, denominator: 4 },
        pitch: {
      tuning: {
        name: '12EDO',
        definition: {
          intervals: Array.from({ length: 12 }, (_, index) => index * 100),
          octave: 1200,
        },
      },
      scale: {
        source_id: 'scale:major',
        definition: {
          name: 'major',
          tuning_length: 12,
          intervals: [2, 2, 1, 2, 2, 2, 1],
          mode: 1,
        },
      },
      transposition: 2,
      translation_direction: 'up',
      base_frequency: 440,
        },
      }],
      rows: [{ coordinate: 0, channel_id: 'channel-1' }],
      placements: [{ row: 0, column: 0, sequence_id: 1 }],
      loop_region: { start_column: 0, end_column: 0 },
    },
  },
})

export const arrangedProjectFixture = (revision = 3): ProjectSnapshotDto => ({
  schema_version: 5,
  history_entry_id: 2,
  project_revision: revision,
  preview_active: false,
  project: {
    sequence_bank: {
      next_id: 3,
      sequences: [
        {
          id: 1,
          cell: {
              weight: 1,
              elements: [{ type: 'Note', pitch: 99, velocity: 1, delay: 0, gate: 1 }],
          },
        },
        {
          id: 2,
          cell: nestedCell,
        },
      ],
    },
    composition: {
      default_column: { duration: { numerator: 4, denominator: 4 }, pitch: pitchFixture() },
      columns: [
        { coordinate: -4, duration: { numerator: 7, denominator: 8 }, pitch: pitchFixture() },
        { coordinate: 0, duration: { numerator: 4, denominator: 4 }, pitch: pitchFixture() },
        { coordinate: 9, duration: { numerator: 5, denominator: 16 }, pitch: pitchFixture() },
      ],
      rows: [
        {
          coordinate: -2,
          channel_id: 'other',
        },
        {
          coordinate: 3,
          channel_id: 'channel-1',
        },
      ],
      placements: [
        { row: -2, column: -4, sequence_id: 1 },
        { row: -2, column: 9, sequence_id: 2 },
        { row: 3, column: -4, sequence_id: 2 },
        { row: 3, column: 0, sequence_id: 1 },
      ],
      loop_region: {
        start_column: -2,
        end_column: 6,
      },
    },
  },
})

export const libraryFixture = (revision = 4): LibrarySnapshotDto => ({
  schema_version: 1,
  library_revision: revision,
  paths: { library: '/library', content: '/library/content', tunings: '/library/tunings' },
  cells: [
    {
      name: 'sequence.xen',
      relative_path: 'sequence.xen',
      stem: 'sequence',
      path: '/library/sequences/sequence.xen',
      command: 'load cell "sequence.xen"',
    },
  ],
  compositions: [
    {
      name: 'song.xencomp',
      relative_path: 'song.xencomp',
      stem: 'song',
      path: '/library/content/song.xencomp',
      command: 'project open "song"',
    },
  ],
  tunings: [],
  scales: [
    {
      id: 'chromatic',
      name: 'chromatic',
      definition: null,
      intervals: [],
      command: 'set scale chromatic',
    },
    {
      id: 'scale:major',
      definition: {
        name: 'major',
        tuning_length: 12,
        intervals: [2, 2, 1, 2, 2, 2, 1],
        mode: 1,
      },
      command: 'set scaleId "scale:major"',
    },
  ],
  chords: [{ name: 'major', intervals: [4, 3], command: 'arp "major"' }],
  commands: {
    reload_scales: 'load scales',
    reload_chords: 'load chords',
    library_directory: 'libraryDirectory',
  },
})
