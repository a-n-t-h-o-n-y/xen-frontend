import { describe, expect, it } from 'vitest'
import {
  analyzeCommandCompletion,
  applyCommandCompletion,
  getVisibleCompletionMode,
  rankCommandCompletions,
} from './commandCompletion'
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
import { buildSessionReference, filterCommandReference } from './reference'
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

describe('schema 2 contract validation', () => {
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
        schema_version: 2,
        commands: [{
          path: ['set', 'pitch'],
          keywords: ['note'],
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

describe('command reference', () => {
  const reference = buildSessionReference({
    schema_version: 2,
    commands: [
      {
        path: ['set', 'velocity'],
        keywords: ['volume', 'gain', 'level'],
        accepts_pattern_prefix: true,
        target_requirement: 'element',
        description: 'Set note velocity',
        arguments: [
          {
            kind: 'decimal',
            display_name: 'amount',
            required: false,
            default_value: '0.8',
            constraints: [{
              kind: 'range',
              minimum: 0,
              maximum: 1,
              values: [],
            }],
          },
        ],
      },
      {
        path: ['transport', 'stop'],
        keywords: ['pause', 'halt'],
        accepts_pattern_prefix: false,
        target_requirement: 'none',
        description: 'Stop playback',
        arguments: [],
      },
    ],
  })

  it('normalizes catalog command metadata', () => {
    expect(reference.commands[0]).toEqual({
      id: 'set velocity',
      signature: 'set velocity [amount=0.8]',
      keywords: ['volume', 'gain', 'level'],
      description: 'Set note velocity',
      targetRequirement: 'element',
      acceptsPatternPrefix: true,
      arguments: [{
        kind: 'decimal',
        displayName: 'amount',
        required: false,
        defaultValue: '0.8',
        constraints: [{
          kind: 'range',
          minimum: 0,
          maximum: 1,
          values: [],
        }],
      }],
    })
  })

  it('searches names, signatures, descriptions, and argument metadata', () => {
    expect(filterCommandReference(reference.commands, 'velocity')).toHaveLength(1)
    expect(filterCommandReference(reference.commands, 'playback')[0]?.id).toBe('transport stop')
    expect(filterCommandReference(reference.commands, 'amount=0.8')[0]?.id).toBe('set velocity')
    expect(filterCommandReference(reference.commands, 'decimal')[0]?.id).toBe('set velocity')
    expect(filterCommandReference(reference.commands, 'range')[0]?.id).toBe('set velocity')
  })
})

describe('command completion', () => {
  const commands = buildSessionReference({
    schema_version: 2,
    commands: [
      {
        path: ['set', 'velocity'],
        keywords: ['volume', 'gain', 'level'],
        accepts_pattern_prefix: true,
        target_requirement: 'element',
        description: 'Set note velocity',
        arguments: [
          {
            kind: 'decimal',
            display_name: 'amount',
            required: true,
            default_value: null,
            constraints: [{
              kind: 'range',
              minimum: 0,
              maximum: 1,
              values: [],
            }],
          },
          {
            kind: 'mode',
            display_name: 'curve',
            required: false,
            default_value: 'linear',
            constraints: [{
              kind: 'enum',
              minimum: null,
              maximum: null,
              values: ['linear', 'exp'],
            }],
          },
        ],
      },
      {
        path: ['set', 'gate'],
        keywords: ['duration'],
        accepts_pattern_prefix: true,
        target_requirement: 'element',
        description: 'Set note gate',
        arguments: [],
      },
      {
        path: ['transport', 'stop'],
        keywords: ['pause', 'halt'],
        accepts_pattern_prefix: false,
        target_requirement: 'none',
        description: 'Stop playback',
        arguments: [],
      },
      {
        path: ['load', 'measure'],
        keywords: ['open', 'file'],
        accepts_pattern_prefix: false,
        target_requirement: 'none',
        description: 'Load measure',
        arguments: [],
      },
      {
        path: ['mute', 'selected'],
        keywords: ['silence'],
        accepts_pattern_prefix: false,
        target_requirement: 'cell_or_element',
        description: 'Mute selected item',
        arguments: [],
      },
    ],
  }).commands

  it('strips pattern prefixes before command matching', () => {
    const analysis = analyzeCommandCompletion('+2  1 3 set vel', commands)
    const joined = applyCommandCompletion('+2  1 3 set vel', analysis.segment, analysis.candidates[0].command)

    expect(analysis.candidates[0]?.command.id).toBe('set velocity')
    expect(analysis.segment.patternPrefix).toBe('+2  1 3 ')
    expect(joined).toBe('+2  1 3 set velocity ')
  })

  it('shows catalog order for empty command text with recent boosts', () => {
    const ranked = rankCommandCompletions(commands, '', ['transport stop'])

    expect(ranked.map((candidate) => candidate.command.id).slice(0, 3)).toEqual([
      'transport stop',
      'set velocity',
      'set gate',
    ])
  })

  it('matches multi-word commands and inserts the canonical command', () => {
    const analysis = analyzeCommandCompletion('copy; +1 trans st', commands)
    const nextText = applyCommandCompletion('copy; +1 trans st', analysis.segment, analysis.candidates[0].command)

    expect(analysis.candidates[0]?.command.id).toBe('transport stop')
    expect(nextText).toBe('copy; +1 transport stop ')
  })

  it('prioritizes prefix, token prefix, acronym, order-insensitive, typo, then keyword matches', () => {
    expect(rankCommandCompletions(commands, 'set')[0]?.matchKind).toBe('exactPrefix')
    expect(rankCommandCompletions(commands, 'vel')[0]?.matchKind).toBe('tokenPrefix')
    expect(rankCommandCompletions(commands, 'ts')[0]?.matchKind).toBe('acronym')
    expect(rankCommandCompletions(commands, 'measure load')[0]?.matchKind).toBe('orderInsensitive')
    expect(rankCommandCompletions(commands, 'velocitty')[0]?.matchKind).toBe('typo')
    expect(rankCommandCompletions(commands, 'gain')[0]?.matchKind).toBe('keyword')
  })

  it('recognizes exact commands and argument input separately from command search', () => {
    const exact = analyzeCommandCompletion('set velocity', commands)
    const argumentInput = analyzeCommandCompletion('set velocity 0.5', commands)

    expect(exact.mode).toBe('argumentAssist')
    expect(exact.recognizedCommand?.id).toBe('set velocity')
    expect(exact.candidates).toHaveLength(0)
    expect(argumentInput.recognizedCommand?.id).toBe('set velocity')
    expect(argumentInput.argumentPlaceholders.map((placeholder) => placeholder.displayName)).toEqual(['curve'])
  })

  it('generates argument placeholders and hides typed arguments', () => {
    const noArgsTyped = analyzeCommandCompletion('set velocity ', commands)
    const oneArgTyped = analyzeCommandCompletion('set velocity 0.75', commands)

    expect(noArgsTyped.argumentPlaceholders.map((placeholder) => placeholder.text)).toEqual([
      '<amount:decimal>',
      '[curve=linear:mode]',
    ])
    expect(oneArgTyped.argumentPlaceholders.map((placeholder) => placeholder.text)).toEqual([
      '[curve=linear:mode]',
    ])
  })

  it('keeps history-selected text frozen until editing resumes', () => {
    const analysis = analyzeCommandCompletion('set veloc', commands, ['transport stop'])

    expect(analysis.mode).toBe('commandSearch')
    expect(getVisibleCompletionMode(true, false, true, analysis.mode)).toBe('none')
    expect(getVisibleCompletionMode(true, false, false, analysis.mode)).toBe('commandSearch')
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
