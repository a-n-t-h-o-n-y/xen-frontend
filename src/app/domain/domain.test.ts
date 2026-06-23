import { describe, expect, it } from 'vitest'
import {
  parseBridgeEvent,
  parseCommandResponse,
  parseEnvelope,
  parseKeymapResource,
  parseLibrarySnapshot,
  parseProjectSnapshot,
  parseSessionHello,
} from './contracts'
import { buildCommandContext, createSerialExecutor } from './commands'
import {
  expandNumericPlaceholders,
  findKeymapBinding,
  formatKeymapTarget,
  formatKeymapTrigger,
  normalizeKey,
  triggerIdentity,
} from './keymap'
import { ingestKeymapResource, ingestLibrarySnapshot, ingestProjectSnapshot } from './resources'
import { moveSelection, reconcileSelection, resolveSelection } from './selection'
import type { Cell, LibrarySnapshot, ProjectSnapshot, Selection } from './contracts'

const nestedCell: Cell = {
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

const projectFixture = (revision = 3): ProjectSnapshot => ({
  schema_version: 1,
  history_entry_id: 2,
  project_revision: revision,
  project: {
    measure: {
      cell: nestedCell,
      time_signature: { numerator: 4, denominator: 4 },
    },
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
  },
})

const libraryFixture = (revision = 4): LibrarySnapshot => ({
  schema_version: 1,
  library_revision: revision,
  paths: { library: '/library', sequences: '/library/sequences', tunings: '/library/tunings' },
  measures: [
    {
      name: 'measure.xen',
      relative_path: 'measure.xen',
      stem: 'measure',
      path: '/library/sequences/measure.xen',
      command: 'load measure "measure.xen"',
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

describe('schema 1 contract validation', () => {
  it('accepts envelopes and rejects invalid payloads', () => {
    expect(parseEnvelope({
      protocol: 'xen.bridge.v1',
      type: 'response',
      name: 'state.get',
      request_id: '1',
      payload: {},
    }).name).toBe('state.get')
    expect(() => parseEnvelope({
      protocol: 'old',
      type: 'response',
      name: 'state.get',
      payload: {},
    })).toThrow()
  })

  it('validates hello catalog and merged keymap', () => {
    const hello = parseSessionHello({
      protocol: 'xen.bridge.v1',
      plugin_version: '1.0.0',
      project_schema_version: 1,
      library_schema_version: 1,
      catalog: {
        schema_version: 1,
        commands: [{
          path: ['set', 'pitch'],
          accepts_pattern_prefix: false,
          target_requirement: 'element',
          arguments: [],
          description: 'Set pitch',
        }],
      },
      keymap: {
        schema_version: 1,
        revision: 2,
        key_semantics: 'KeyboardEvent.key',
        bindings: {
          sequence: [{
            trigger: {
              key: 'ArrowLeft',
              modifiers: { shift: false, command: false, alt: false },
            },
            target: {
              type: 'ui_action',
              action: 'selection.move',
              arguments: { direction: 'left', amount: 1 },
            },
          }],
        },
        overrides: [],
      },
    })
    expect(hello.keymap.bindings.sequence[0]?.target.type).toBe('ui_action')
    expect(() => parseSessionHello({
      ...hello,
      project_schema_version: 4,
    })).toThrow()
  })

  it('validates project, library, command response, and events', () => {
    expect(parseProjectSnapshot(projectFixture()).project.pitch.transposition).toBe(2)
    expect(parseLibrarySnapshot(libraryFixture()).scales[0]?.id).toBe('chromatic')
    expect(parseCommandResponse({
      status: { level: 'info', message: 'ok' },
      suggested_selection: { path: [{ kind: 'element', index: 0 }] },
      snapshot: projectFixture(),
    }).status.message).toBe('ok')
    expect(parseBridgeEvent({
      protocol: 'xen.bridge.v1',
      type: 'event',
      name: 'library.changed',
      payload: libraryFixture(),
    }).name).toBe('library.changed')
    expect(() => parseProjectSnapshot({ ...projectFixture(), schema_version: 4 })).toThrow()
  })
})

describe('revision ingestion', () => {
  it('installs first and newer projects while ignoring older and equal revisions', () => {
    const selection = { path: [{ kind: 'element' as const, index: 0 }] }
    const first = ingestProjectSnapshot(null, projectFixture(2), selection)
    expect(first.installed).toBe(true)
    expect(ingestProjectSnapshot(first.snapshot, projectFixture(1), selection).installed).toBe(false)
    expect(ingestProjectSnapshot(first.snapshot, projectFixture(2), selection).installed).toBe(false)
    expect(ingestProjectSnapshot(first.snapshot, projectFixture(3), selection).installed).toBe(true)
  })

  it('reconciles invalid selections and tracks library revisions independently', () => {
    const invalid = { path: [{ kind: 'element' as const, index: 99 }] }
    expect(ingestProjectSnapshot(null, projectFixture(), invalid).selection).toEqual({ path: [] })
    const project = projectFixture(9)
    const library = libraryFixture(2)
    expect(ingestLibrarySnapshot(null, library).installed).toBe(true)
    expect(ingestLibrarySnapshot(library, libraryFixture(1)).installed).toBe(false)
    expect(project.project_revision).toBe(9)
  })
})

describe('command execution primitives', () => {
  it('builds context from the latest revision and reconciles selection', () => {
    expect(buildCommandContext(projectFixture(12), {
      path: [{ kind: 'element', index: 99 }],
    })).toEqual({
      expected_project_revision: 12,
      selection: { path: [] },
    })
  })

  it('serializes asynchronous command work after both success and failure', async () => {
    const execute = createSerialExecutor()
    const order: string[] = []
    let releaseFirst = (): void => undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = execute(async () => {
      order.push('first:start')
      await firstGate
      order.push('first:end')
    })
    const second = execute(async () => {
      order.push('second')
    })

    await Promise.resolve()
    expect(order).toEqual(['first:start'])
    releaseFirst()
    await Promise.all([first, second])
    expect(order).toEqual(['first:start', 'first:end', 'second'])
  })
})

describe('strict selection and local navigation', () => {
  it('strictly resolves typed paths and falls back to root', () => {
    const nested: Selection = {
      path: [
        { kind: 'element', index: 1 },
        { kind: 'cell', index: 1 },
        { kind: 'element', index: 0 },
      ],
    }
    expect(resolveSelection(nestedCell, nested)?.selectedElement).toMatchObject({
      type: 'Note',
      pitch: 2,
    })
    expect(resolveSelection(nestedCell, {
      path: [{ kind: 'element', index: 0 }, { kind: 'cell', index: 0 }],
    })).toBeNull()
    expect(reconcileSelection(nestedCell, {
      path: [{ kind: 'element', index: 99 }],
    })).toEqual({ path: [] })
  })

  it('matches backend left, right, up, and down behavior', () => {
    const child: Selection = {
      path: [{ kind: 'element', index: 1 }, { kind: 'cell', index: 1 }],
    }
    expect(moveSelection(nestedCell, child, 'left')).toEqual({
      path: [{ kind: 'element', index: 1 }, { kind: 'cell', index: 0 }],
    })
    expect(moveSelection(nestedCell, child, 'right')).toEqual({
      path: [{ kind: 'element', index: 1 }, { kind: 'cell', index: 0 }],
    })
    expect(moveSelection(nestedCell, child, 'down')).toEqual({
      path: [
        { kind: 'element', index: 1 },
        { kind: 'cell', index: 1 },
        { kind: 'element', index: 0 },
      ],
    })
    expect(moveSelection(nestedCell, child, 'up')).toEqual({
      path: [{ kind: 'element', index: 1 }],
    })
  })
})

describe('keymap routing', () => {
  const resource = parseKeymapResource({
    schema_version: 1,
    revision: 4,
    key_semantics: 'KeyboardEvent.key',
    bindings: {
      sequence: [
        {
          trigger: {
            key: 'h',
            modifiers: { shift: true, command: false, alt: false },
            when: { input_mode: 'pitch' },
          },
          target: {
            type: 'ui_action',
            action: 'selection.move',
            arguments: { direction: 'left', amount: 2 },
          },
        },
      ],
    },
    overrides: [],
  })

  it('normalizes only ASCII capital letters and expands numeric placeholders', () => {
    expect(normalizeKey('H')).toBe('h')
    expect(normalizeKey('ArrowLeft')).toBe('ArrowLeft')
    expect(normalizeKey('É')).toBe('É')
    expect(expandNumericPlaceholders('duplicate :N=2:', '7')).toBe('duplicate 7')
    expect(expandNumericPlaceholders('duplicate :N=2:', '')).toBe('duplicate 2')
  })

  it('matches exact key, modifiers, context, and input mode', () => {
    const event = {
      key: 'H',
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    } as KeyboardEvent
    expect(findKeymapBinding(resource, 'sequence', event, 'pitch')?.target.type).toBe('ui_action')
    expect(findKeymapBinding(resource, 'sequence', event, 'gate')).toBeNull()
    expect(findKeymapBinding(resource, 'other', event, 'pitch')).toBeNull()
  })

  it('formats typed triggers and targets with stable identities', () => {
    const binding = resource.bindings.sequence[0]!
    expect(triggerIdentity(binding.trigger)).toContain('h')
    expect(formatKeymapTrigger(binding.trigger)).toContain('Shift')
    expect(formatKeymapTarget(binding.target)).toBe('Move left by 2')
  })

  it('installs only newer keymap revisions', () => {
    expect(ingestKeymapResource(null, resource).installed).toBe(true)
    expect(ingestKeymapResource(resource, { ...resource, revision: 4 }).installed).toBe(false)
    expect(ingestKeymapResource(resource, { ...resource, revision: 5 }).installed).toBe(true)
  })
})
