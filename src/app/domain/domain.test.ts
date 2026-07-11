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
  buildEnabledModulatorTargetCommands,
  buildModulatorTargetCommand,
  joinModulatorCommands,
} from './modulatorCommands'
import {
  commandContextToDto,
  keymapFromDto,
  keymapOverrideRemoveRequestToDto,
  keymapOverrideSetRequestToDto,
  libraryFromDto,
  projectFromDto,
} from './mappers'
import {
  getActiveMeasureTarget,
  isColumnInLoopRegion,
  measureFromTarget,
  moveCompositionSelection,
} from './composition'
import {
  expandNumericPlaceholders,
  findKeymapBinding,
  findKeymapTriggerConflict,
  formatKeymapTarget,
  formatKeymapTrigger,
  normalizeKey,
  triggerIdentity,
} from './keymap'
import { ingestKeymapResource, ingestLibrarySnapshot, ingestProjectSnapshot } from './resources'
import { buildSessionReference, filterCommandReference } from './reference'
import { moveSelection, reconcileSelection, resolveSelection } from './selection'
import {
  formatKeymapContext,
  getCommandKeymapContext,
  runCommandUiAction,
} from './uiActions'
import { createInitialModulatorPanelState } from './modulation'
import type { LibrarySnapshotDto, ProjectSnapshotDto } from './contracts'
import type { Cell, Selection } from './music'

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

const projectFixture = (revision = 3): ProjectSnapshotDto => ({
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

const arrangedProjectFixture = (revision = 3): ProjectSnapshotDto => ({
  schema_version: 3,
  history_entry_id: 2,
  project_revision: revision,
  project: {
    measure_bank: {
      next_id: 3,
      measures: [
        {
          id: 1,
          measure: {
            cell: {
              weight: 1,
              elements: [{ type: 'Note', pitch: 99, velocity: 1, delay: 0, gate: 1 }],
            },
          },
        },
        {
          id: 2,
          measure: {
            cell: nestedCell,
          },
        },
      ],
    },
    composition: {
      columns: [
        { length: { numerator: 7, denominator: 8 } },
        { length: { numerator: 4, denominator: 4 } },
        { length: { numerator: 5, denominator: 16 } },
      ],
      rows: [
        {
          channel_id: 'other',
          cells: [1, null, 2],
        },
        {
          channel_id: 'channel-1',
          cells: [2, 1, null],
        },
      ],
      loop_region: {
        start_column: 2,
        end_column: 0,
      },
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

const libraryFixture = (revision = 4): LibrarySnapshotDto => ({
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

describe('schema contract validation', () => {
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
      project_schema_version: 3,
      library_schema_version: 1,
      catalog: {
        schema_version: 2,
        commands: [{
          path: ['set', 'pitch'],
          keywords: ['note'],
          accepts_pattern_prefix: false,
          target_requirement: 'element',
          arguments: [{
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
          }],
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
    expect(hello.keymap.bindings.sequence![0]?.target.type).toBe('ui_action')
    expect(hello.catalog.commands[0]?.arguments[0]?.constraints[0]?.maximum).toBe(1)
    expect(() => parseSessionHello({
      ...hello,
      project_schema_version: 4,
    })).toThrow()
    expect(() => parseSessionHello({
      ...hello,
      catalog: {
        ...hello.catalog,
        commands: [{
          ...hello.catalog.commands[0],
          arguments: [{
            ...hello.catalog.commands[0]!.arguments[0],
            constraints: [{
              kind: 'range',
              minimum: [0],
              maximum: [1],
              values: [],
            }],
          }],
        }],
      },
    })).toThrow()
  })

  it('validates project, library, command response, and events', () => {
    expect(parseProjectSnapshot(projectFixture()).project.pitch.transposition).toBe(2)
    const arrangedProject = parseProjectSnapshot(arrangedProjectFixture())
    expect(arrangedProject.schema_version).toBe(3)
    if (arrangedProject.schema_version === 3) {
      expect(arrangedProject.project.composition.rows[1]?.cells[0]).toBe(2)
      expect(arrangedProject.project.composition.loop_region?.start_column).toBe(2)
    }
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
    expect(() => parseProjectSnapshot({
      ...arrangedProjectFixture(),
      project: {
        ...arrangedProjectFixture().project,
        composition: {
          columns: [{ length: { numerator: 4, denominator: 4 } }],
          rows: [{ channel_id: 'channel-1', cells: [404] }],
        },
      },
    })).toThrow()
    expect(() => parseProjectSnapshot({
      ...arrangedProjectFixture(),
      project: {
        ...arrangedProjectFixture().project,
        composition: {
          columns: [{ length: { numerator: 4, denominator: 4 } }],
          rows: [{ channel_id: 'channel-1', cells: [1] }],
          loop_region: { start_column: 1, end_column: 0 },
        },
      },
    })).toThrow()
  })
})

describe('modulator command builders', () => {
  it('builds tuning-aware target commands', () => {
    const state = createInitialModulatorPanelState()
    const command = buildModulatorTargetCommand(
      'pitch',
      {
        ...state.targetControls.pitch,
        center: 0,
        amount: 48,
      },
      state,
      24
    )

    const payload = JSON.parse(command.replace(/^set pitch /, ''))
    expect(command.startsWith('set pitch ')).toBe(true)
    expect(payload.children[2]).toEqual({ type: 'bias', amount: 0 })
    expect(payload.children[3]).toEqual({ type: 'clamp', min: -48, max: 48 })
  })

  it('builds commands only for enabled targets', () => {
    const state = createInitialModulatorPanelState()
    state.targetControls.pitch = {
      ...state.targetControls.pitch,
      enabled: true,
      amount: 7,
    }
    state.targetControls.velocity = {
      ...state.targetControls.velocity,
      enabled: false,
      amount: 0.25,
    }

    expect(buildEnabledModulatorTargetCommands(state, 12)).toHaveLength(1)
    expect(buildEnabledModulatorTargetCommands(state, 12)[0]?.startsWith('set pitch ')).toBe(true)
  })

  it('preserves square pulse width in command payloads', () => {
    const state = createInitialModulatorPanelState()
    state.waveAType = 'square'
    state.waveAPulseWidth = 0.27
    state.targetControls.velocity = {
      ...state.targetControls.velocity,
      enabled: true,
      amount: 0.25,
    }

    const command = buildEnabledModulatorTargetCommands(state, 12)[0]
    const payload = JSON.parse(command?.replace(/^set velocity /, '') ?? '{}')
    expect(payload.children[0]).toEqual({
      type: 'square',
      frequency: 1,
      amplitude: 1,
      phase: 0,
      pulse_width: 0.27,
    })
  })

  it('joins commands with backend command-chain separators', () => {
    expect(joinModulatorCommands(['set pitch {}', 'set gate {}'])).toBe('set pitch {}; set gate {}')
  })
})

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
    if (fixture.schema_version === 3) {
      fixture.project.measure_bank.measures[0]!.name = 'Intro'
      fixture.project.measure_bank.measures[1]!.name = 'Pulse'
      fixture.project.composition.rows[0]!.name = 'Lead'
      fixture.project.composition.rows[1]!.name = 'Layer'
    }

    const project = projectFromDto(fixture)

    expect(project.measureBank?.measures.map((entry) => entry.name)).toEqual(['Intro', 'Pulse'])
    expect(project.composition?.rows.map((row) => row.name)).toEqual(['Lead', 'Layer'])
  })

  it('defaults missing arranged loop regions to the full composition length', () => {
    const fixture = arrangedProjectFixture(11)
    if (fixture.schema_version === 3) {
      delete fixture.project.composition.loop_region
    }

    expect(projectFromDto(fixture).composition?.loopRegion).toEqual({
      startColumn: 0,
      endColumn: 2,
    })
  })

  it('maps library snapshots to camelCase resources and commands', () => {
    const library = libraryFromDto(libraryFixture(7))

    expect(library.revision).toBe(7)
    expect(library.measures[0]?.relativePath).toBe('measure.xen')
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
    const joined = applyCommandCompletion('+2  1 3 set vel', analysis.segment, analysis.candidates[0]!.command)

    expect(analysis.candidates[0]?.command.id).toBe('set velocity')
    expect(analysis.segment.patternPrefix).toBe('+2  1 3 ')
    expect(joined).toBe('+2  1 3 set velocity ')
  })

  it('shows catalog order for empty command text with recent boosts', () => {
    const ranked = rankCommandCompletions(commands, '', ['transport stop'])

    expect(ranked).toHaveLength(commands.length)
    expect(ranked.map((candidate) => candidate.command.id).slice(0, 3)).toEqual([
      'transport stop',
      'set velocity',
      'set gate',
    ])
  })

  it('matches multi-word commands and inserts the canonical command', () => {
    const analysis = analyzeCommandCompletion('copy; +1 trans st', commands)
    const nextText = applyCommandCompletion('copy; +1 trans st', analysis.segment, analysis.candidates[0]!.command)

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

  it('hides completions for an exact command without a trailing space', () => {
    const exact = analyzeCommandCompletion('set velocity', commands)

    expect(exact.mode).toBe('none')
    expect(exact.recognizedCommand?.id).toBe('set velocity')
    expect(exact.isExactCommandInput).toBe(true)
    expect(exact.candidates).toHaveLength(0)
    expect(exact.argumentPlaceholders).toHaveLength(0)
  })

  it('hides unrelated fuzzy matches after an exact command is typed', () => {
    const exactCommands = [
      ...commands,
      {
        id: 'undo',
        keywords: ['revert'],
        acceptsPatternPrefix: false,
        targetRequirement: 'none' as const,
        description: 'Undo the last edit',
        arguments: [],
        signature: 'undo',
      },
      {
        id: 'set tuningDirectory',
        keywords: ['undo'],
        acceptsPatternPrefix: false,
        targetRequirement: 'none' as const,
        description: 'Set tuning directory',
        arguments: [],
        signature: 'set tuningDirectory',
      },
      {
        id: 'set sequenceDirectory',
        keywords: ['undo'],
        acceptsPatternPrefix: false,
        targetRequirement: 'none' as const,
        description: 'Set sequence directory',
        arguments: [],
        signature: 'set sequenceDirectory',
      },
    ]
    const exact = analyzeCommandCompletion('undo', exactCommands)

    expect(exact.mode).toBe('none')
    expect(exact.recognizedCommand?.id).toBe('undo')
    expect(exact.isExactCommandInput).toBe(true)
    expect(exact.candidates).toHaveLength(0)
  })

  it('keeps longer completions visible when the exact command is also a prefix', () => {
    const prefixCommands = [
      ...commands,
      {
        id: 'set',
        keywords: ['assign'],
        acceptsPatternPrefix: true,
        targetRequirement: 'element' as const,
        description: 'Set selected item',
        arguments: [],
        signature: 'set',
      },
    ]
    const exactPrefix = analyzeCommandCompletion('set', prefixCommands)

    expect(exactPrefix.mode).toBe('commandSearch')
    expect(exactPrefix.recognizedCommand?.id).toBe('set')
    expect(exactPrefix.isExactCommandInput).toBe(true)
    expect(exactPrefix.candidates.map((candidate) => candidate.command.id)).not.toContain('set')
    expect(exactPrefix.candidates.map((candidate) => candidate.command.id)).toEqual(
      expect.arrayContaining(['set velocity', 'set gate'])
    )
  })

  it('recognizes commands with an argument boundary and argument input separately from command search', () => {
    const argumentBoundary = analyzeCommandCompletion('set velocity ', commands)
    const argumentInput = analyzeCommandCompletion('set velocity 0.5', commands)

    expect(argumentBoundary.mode).toBe('argumentAssist')
    expect(argumentBoundary.recognizedCommand?.id).toBe('set velocity')
    expect(argumentBoundary.candidates).toHaveLength(0)
    expect(argumentInput.recognizedCommand?.id).toBe('set velocity')
    expect(argumentInput.argumentPlaceholders.map((placeholder) => placeholder.displayName)).toEqual(['curve'])
  })

  it('generates argument placeholders and hides typed arguments', () => {
    const noArgsTyped = analyzeCommandCompletion('set velocity ', commands)
    const oneArgTyped = analyzeCommandCompletion('set velocity 0.75', commands)

    expect(noArgsTyped.argumentPlaceholders.map((placeholder) => placeholder.text)).toEqual([
      '<amount:decimal>',
      '[curve:linear | exp = linear]',
    ])
    expect(oneArgTyped.argumentPlaceholders.map((placeholder) => placeholder.text)).toEqual([
      '[curve:linear | exp = linear]',
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
    const first = ingestProjectSnapshot(null, projectFromDto(projectFixture(2)), selection)
    expect(first.installed).toBe(true)
    expect(ingestProjectSnapshot(first.snapshot, projectFromDto(projectFixture(1)), selection).installed)
      .toBe(false)
    expect(ingestProjectSnapshot(first.snapshot, projectFromDto(projectFixture(2)), selection).installed)
      .toBe(false)
    expect(ingestProjectSnapshot(first.snapshot, projectFromDto(projectFixture(3)), selection).installed)
      .toBe(true)
  })

  it('reconciles invalid selections and tracks library revisions independently', () => {
    const invalid = { path: [{ kind: 'element' as const, index: 99 }] }
    expect(ingestProjectSnapshot(null, projectFromDto(projectFixture()), invalid).selection)
      .toEqual({ path: [] })
    const project = projectFromDto(projectFixture(9))
    const library = libraryFromDto(libraryFixture(2))
    expect(ingestLibrarySnapshot(null, library).installed).toBe(true)
    expect(ingestLibrarySnapshot(library, libraryFromDto(libraryFixture(1))).installed).toBe(false)
    expect(project.revision).toBe(9)
  })
})

describe('command execution primitives', () => {
  it('builds context from the latest revision and reconciles selection', () => {
    expect(buildCommandContext(projectFromDto(projectFixture(12)), {
      path: [{ kind: 'element', index: 99 }],
    })).toEqual({
      expectedProjectRevision: 12,
      selection: { path: [] },
      activeMeasureTarget: null,
    })
    expect(commandContextToDto(buildCommandContext(projectFromDto(projectFixture(12)), {
      path: [{ kind: 'element', index: 99 }],
    }))).toEqual({
      expected_project_revision: 12,
      selection: { path: [] },
      active_measure_target: null,
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

describe('composition helpers', () => {
  const project = projectFromDto(arrangedProjectFixture())
  const composition = project.composition!

  it('moves composition selection with wrapping', () => {
    expect(moveCompositionSelection(composition, { rowIndex: 0, columnIndex: 0 }, 'left'))
      .toEqual({ rowIndex: 0, columnIndex: 2 })
    expect(moveCompositionSelection(composition, { rowIndex: 0, columnIndex: 2 }, 'right'))
      .toEqual({ rowIndex: 0, columnIndex: 0 })
    expect(moveCompositionSelection(composition, { rowIndex: 0, columnIndex: 1 }, 'up'))
      .toEqual({ rowIndex: 1, columnIndex: 1 })
  })

  it('detects normal, wrapped, and single-column loop regions', () => {
    expect([0, 1, 2].map((index) =>
      isColumnInLoopRegion(index, { startColumn: 0, endColumn: 2 })
    )).toEqual([true, true, true])
    expect([0, 1, 2].map((index) =>
      isColumnInLoopRegion(index, { startColumn: 2, endColumn: 0 })
    )).toEqual([true, false, true])
    expect([0, 1, 2].map((index) =>
      isColumnInLoopRegion(index, { startColumn: 1, endColumn: 1 })
    )).toEqual([false, true, false])
  })

  it('derives active measure targets and measure views from composition cells', () => {
    const target = getActiveMeasureTarget(composition, { rowIndex: 1, columnIndex: 1 })
    expect(target).toEqual({ rowIndex: 1, columnIndex: 1, measureId: 1 })
    expect(measureFromTarget(project.measure, project.measureBank, composition, target).timeSignature)
      .toEqual({ numerator: 4, denominator: 4 })
    expect(getActiveMeasureTarget(composition, { rowIndex: 1, columnIndex: 2 })).toBeNull()
  })
})

describe('keymap routing', () => {
  const resource = keymapFromDto(parseKeymapResource({
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
        {
          trigger: {
            key: 'l',
            modifiers: { shift: true, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'workspace.view.toggle',
            arguments: {},
          },
        },
      ],
      'command.input': [
        {
          trigger: {
            key: 'Escape',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'command.cancel',
            arguments: {},
          },
        },
      ],
      'command.completions': [
        {
          trigger: {
            key: 'Escape',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'command.completion.dismiss',
            arguments: {},
          },
        },
      ],
      composition: [
        {
          trigger: {
            key: 'l',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'composition.selection.move',
            arguments: { direction: 'right', amount: 1 },
          },
        },
        {
          trigger: {
            key: 'Enter',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'composition.cell.edit_measure',
            arguments: {},
          },
        },
        {
          trigger: {
            key: '[',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'composition.loop.set_start',
            arguments: {},
          },
        },
        {
          trigger: {
            key: ']',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'composition.loop.set_end',
            arguments: {},
          },
        },
        {
          trigger: {
            key: 'n',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'composition.cell.rename_or_create_measure',
            arguments: {},
          },
        },
        {
          trigger: {
            key: 'c',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'composition.cell.copy',
            arguments: {},
          },
        },
        {
          trigger: {
            key: 'v',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'composition.cell.paste',
            arguments: {},
          },
        },
        {
          trigger: {
            key: 'x',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'composition.cell.cut',
            arguments: {},
          },
        },
        {
          trigger: {
            key: 'd',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'composition.cell.duplicate_right',
            arguments: {},
          },
        },
        {
          trigger: {
            key: 'o',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'composition.row.channel',
            arguments: {},
          },
        },
        {
          trigger: {
            key: 't',
            modifiers: { shift: false, command: false, alt: false },
          },
          target: {
            type: 'ui_action',
            action: 'composition.column.length',
            arguments: {},
          },
        },
      ],
    },
    overrides: [],
  }))

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

  it('parses command UI actions and matches identical triggers in separate contexts', () => {
    const event = {
      key: 'Escape',
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    } as KeyboardEvent

    expect(findKeymapBinding(resource, 'command.input', event, 'pitch')?.target)
      .toMatchObject({ type: 'ui_action', action: 'command.cancel', arguments: {} })
    expect(findKeymapBinding(resource, 'command.completions', event, 'pitch')?.target)
      .toMatchObject({ type: 'ui_action', action: 'command.completion.dismiss', arguments: {} })
  })

  it('parses composition UI actions in their own context', () => {
    const moveEvent = {
      key: 'l',
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    } as KeyboardEvent
    const enterEvent = {
      key: 'Enter',
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    } as KeyboardEvent

    expect(findKeymapBinding(resource, 'composition', moveEvent, 'pitch')?.target)
      .toMatchObject({ type: 'ui_action', action: 'composition.selection.move' })
    expect(findKeymapBinding(resource, 'composition', enterEvent, 'pitch')?.target)
      .toMatchObject({ type: 'ui_action', action: 'composition.cell.edit_measure' })
  })

  it('parses new editable composition UI actions', () => {
    for (const [key, action] of [
      ['n', 'composition.cell.rename_or_create_measure'],
      ['c', 'composition.cell.copy'],
      ['v', 'composition.cell.paste'],
      ['x', 'composition.cell.cut'],
      ['d', 'composition.cell.duplicate_right'],
      ['o', 'composition.row.channel'],
      ['t', 'composition.column.length'],
    ] as const) {
      expect(findKeymapBinding(resource, 'composition', {
        key,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      } as KeyboardEvent, 'pitch')?.target).toMatchObject({
        type: 'ui_action',
        action,
        arguments: {},
      })
    }
  })

  it('finds trigger conflicts only inside the requested context', () => {
    const escapeTrigger = resource.bindings['command.input']![0]!.trigger
    const conflict = findKeymapTriggerConflict(resource, 'command.input', escapeTrigger)
    expect(conflict?.target).toMatchObject({ type: 'ui_action', action: 'command.cancel' })
    expect(findKeymapTriggerConflict(resource, 'sequence', escapeTrigger)).toBeNull()
  })

  it('does not conflict with the binding original trigger', () => {
    const trigger = resource.bindings.sequence![1]!.trigger
    expect(findKeymapTriggerConflict(resource, 'sequence', trigger, trigger)).toBeNull()
  })

  it('formats typed triggers and targets with stable identities', () => {
    const binding = resource.bindings.sequence![0]!
    const workspaceBinding = resource.bindings.sequence![1]!
    expect(triggerIdentity(binding.trigger)).toContain('h')
    expect(formatKeymapTrigger(binding.trigger)).toContain('Shift')
    expect(formatKeymapTarget(binding.target)).toBe('Move left by 2')
    expect(formatKeymapTarget(workspaceBinding.target)).toBe('Toggle workspace view')
    expect(formatKeymapTarget(resource.bindings.composition![0]!.target))
      .toBe('Move composition right by 1')
    expect(formatKeymapTarget(resource.bindings['command.input']![0]!.target)).toBe('Cancel command')
    expect(formatKeymapContext('composition')).toBe('Composition')
    expect(formatKeymapContext('command.completions')).toBe('Command Completions')
    expect(getCommandKeymapContext(false)).toBe('command.input')
    expect(getCommandKeymapContext(true)).toBe('command.completions')
  })

  it('maps keymap override requests back to DTO trigger conditions', () => {
    const trigger = resource.bindings.sequence![0]!.trigger
    expect(keymapOverrideSetRequestToDto(4, {
      context: 'sequence',
      trigger,
      target: resource.bindings.sequence![0]!.target,
    })).toMatchObject({
      expected_revision: 4,
      context: 'sequence',
      trigger: { when: { input_mode: 'pitch' } },
    })
    expect(keymapOverrideRemoveRequestToDto(4, {
      context: 'sequence',
      trigger,
    })).toMatchObject({
      expected_revision: 4,
      trigger: { when: { input_mode: 'pitch' } },
    })
  })

  it('parses no-argument workspace UI actions', () => {
    const binding = resource.bindings.sequence![1]!
    expect(binding.target).toMatchObject({
      type: 'ui_action',
      action: 'workspace.view.toggle',
      arguments: {},
    })
  })

  it('installs only newer keymap revisions', () => {
    expect(ingestKeymapResource(null, resource).installed).toBe(true)
    expect(ingestKeymapResource(resource, { ...resource, revision: 4 }).installed).toBe(false)
    expect(ingestKeymapResource(resource, { ...resource, revision: 5 }).installed).toBe(true)
  })

  it('runs command UI actions with applicability checks', () => {
    const calls: string[] = []
    const handlers = {
      cancel: () => calls.push('cancel'),
      submit: () => calls.push('submit'),
      closeIfEmpty: () => calls.push('closeIfEmpty'),
      historyPrevious: () => calls.push('historyPrevious'),
      historyNext: () => calls.push('historyNext'),
      completionAccept: () => calls.push('completionAccept'),
      completionDismiss: () => calls.push('completionDismiss'),
      completionPrevious: () => calls.push('completionPrevious'),
      completionNext: () => calls.push('completionNext'),
    }
    const baseState = {
      commandText: 'set',
      historyIndex: -1,
      commandHistory: ['copy'],
      isCompletionVisible: false,
      isCompletionDismissed: false,
      isExactCommandInput: false,
      completionMode: 'none' as const,
    }

    expect(runCommandUiAction('command.submit', baseState, handlers)).toBe(true)
    expect(runCommandUiAction('command.close_if_empty', baseState, handlers)).toBe(false)
    expect(runCommandUiAction('command.history.previous', baseState, handlers)).toBe(true)
    expect(runCommandUiAction('command.history.next', baseState, handlers)).toBe(false)
    expect(runCommandUiAction('command.completion.accept', baseState, handlers)).toBe(false)
    expect(runCommandUiAction('command.cancel', {
      ...baseState,
      completionMode: 'commandSearch',
    }, handlers)).toBe(true)
    expect(runCommandUiAction('command.completion.next', {
      ...baseState,
      isCompletionVisible: true,
    }, handlers)).toBe(true)
    expect(runCommandUiAction('command.completion.previous', {
      ...baseState,
      isCompletionVisible: true,
    }, handlers)).toBe(true)
    expect(runCommandUiAction('command.completion.dismiss', {
      ...baseState,
      completionMode: 'commandSearch',
    }, handlers)).toBe(true)
    expect(runCommandUiAction('command.close_if_empty', {
      ...baseState,
      commandText: '',
    }, handlers)).toBe(true)
    expect(runCommandUiAction('command.submit', {
      ...baseState,
      isCompletionVisible: true,
    }, handlers)).toBe(true)
    expect(runCommandUiAction('command.submit', {
      ...baseState,
      isCompletionVisible: true,
      isExactCommandInput: true,
    }, handlers)).toBe(true)

    expect(calls).toEqual([
      'submit',
      'historyPrevious',
      'completionDismiss',
      'completionNext',
      'completionPrevious',
      'completionDismiss',
      'closeIfEmpty',
      'completionAccept',
      'submit',
    ])
  })
})
