import type { LibrarySnapshotDto, ProjectSnapshotDto } from './contracts'
import type { Cell } from './music'
import type { ModulationCatalog } from './modulation'

export const modulationCatalogFixture = (): ModulationCatalog => ({
  schema_version: 3,
  maximum_waveforms: 64,
  waveform_shapes: ['sine', 'triangle', 'sawtooth_up', 'sawtooth_down', 'square'],
  waveform_parameters: {
    frequency: { minimum: 0, maximum: 64 },
    phase: { minimum: 0, maximum: 1 },
    amplitude: { minimum: -1, maximum: 1 },
    amplitude_offset: { minimum: -1, maximum: 1 },
  },
  operations: [
    { id: 'average', minimum_enabled_waveforms: 1 },
    { id: 'sum', minimum_enabled_waveforms: 1 },
    { id: 'product', minimum_enabled_waveforms: 1 },
    { id: 'am', enabled_waveforms: 2, roles: ['carrier', 'modulator'] },
    { id: 'ring', enabled_waveforms: 2, roles: ['carrier', 'modulator'] },
    { id: 'fm', enabled_waveforms: 2, roles: ['carrier', 'modulator'] },
    { id: 'pm', enabled_waveforms: 2, roles: ['carrier', 'modulator'] },
  ],
  destinations: [
    { id: 'pitch', range: 'integer', quantization: 'nearest', parameters: [] },
    { id: 'velocity', range: 'unit', parameters: [] },
    { id: 'delay', range: 'unit', parameters: [] },
    { id: 'gate', range: 'unit', parameters: [] },
    { id: 'weight', range: 'positive', parameters: [] },
    {
      id: 'midi_cc',
      range: 'unit',
      parameters: [{
        id: 'controller',
        kind: 'integer',
        required: true,
        constraints: [{ kind: 'range', minimum: 0, maximum: 127 }],
      }],
    },
  ],
  normalization: 'clamp((raw + 1) / 2, 0, 1)',
})

export const nestedCell: Cell = {
  weight: 1,
  elements: [
    { type: 'Note', pitch: 0, velocity: 1, delay: 0, gate: 1, midiCc: [] },
    {
      type: 'Sequence',
      cells: [
        {
          weight: 1,
          elements: [{ type: 'Note', pitch: 1, velocity: 1, delay: 0, gate: 1, midiCc: [] }],
        },
        {
          weight: 1,
          elements: [
            { type: 'Note', pitch: 2, velocity: 1, delay: 0, gate: 1, midiCc: [] },
            {
              type: 'Sequence',
              cells: [
                {
                  weight: 1,
                  elements: [{ type: 'Note', pitch: 7, velocity: 1, delay: 0, gate: 1, midiCc: [] }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

const cellToDto = (
  cell: Cell
): ProjectSnapshotDto['project']['sequence_bank']['sequences'][number]['cell'] => ({
  weight: cell.weight,
  elements: cell.elements.map((element) => element.type === 'Note'
    ? {
        type: 'Note',
        pitch: element.pitch,
        velocity: element.velocity,
        delay: element.delay,
        gate: element.gate,
        midi_cc: element.midiCc,
      }
    : { type: 'Sequence', cells: element.cells.map(cellToDto) }),
})

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

export const projectFixture = (revision: string | number = '3'): ProjectSnapshotDto => ({
  schema_version: 7,
  state_revision: String(revision),
  history_entry_id: '2',
  project_revision: String(revision),
  preview_active: false,
  document: {
    relative_path: 'song.xenproj',
    display_name: 'song',
    dirty: false,
    file_revision: 'sha256:project',
  },
  recovery: null,
  project: {
    sequence_bank: {
      next_id: 2,
      sequences: [{ id: 1, cell: cellToDto(nestedCell) }],
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
    midi_cc_labels: [],
  },
})

export const arrangedProjectFixture = (revision: string | number = '3'): ProjectSnapshotDto => ({
  schema_version: 7,
  state_revision: String(revision),
  history_entry_id: '2',
  project_revision: String(revision),
  preview_active: false,
  document: {
    relative_path: 'arranged.xenproj',
    display_name: 'arranged',
    dirty: true,
    file_revision: 'sha256:arranged',
  },
  recovery: null,
  project: {
    sequence_bank: {
      next_id: 3,
      sequences: [
        {
          id: 1,
          cell: {
              weight: 1,
              elements: [{
                type: 'Note',
                pitch: 99,
                velocity: 1,
                delay: 0,
                gate: 1,
                midi_cc: [],
              }],
          },
        },
        {
          id: 2,
          cell: cellToDto(nestedCell),
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
    midi_cc_labels: [],
  },
})

export const libraryFixture = (revision: string | number = '4'): LibrarySnapshotDto => ({
  schema_version: 2,
  library_revision: String(revision),
  paths: {
    library: '/Library/Xen',
    content: '/Library/Xen/content',
    tunings: '/Library/Xen/tunings',
  },
  cells: [
    {
      name: 'sequence.xencell',
      relative_path: 'sequence.xencell',
      stem: 'sequence',
      file_revision: 'sha256:cell',
      command: 'load cell "sequence.xencell"',
    },
  ],
  projects: [
    {
      name: 'song.xenproj',
      relative_path: 'song.xenproj',
      stem: 'song',
      file_revision: 'sha256:project',
      command: 'project open "song.xenproj"',
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
