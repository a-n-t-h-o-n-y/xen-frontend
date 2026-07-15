import { describe, expect, it } from 'vitest'
import {
  analyzeCommandCompletion,
  applyArgumentCompletion,
  applyCommandCompletion,
  getArgumentCompletionCandidates,
  getVisibleCompletionMode,
  rankCommandCompletions,
} from './commandCompletion'
import { libraryFromDto, projectFromDto } from './mappers'
import { buildSessionReference } from './reference'
import { libraryFixture, projectFixture } from './testFixtures'
import type { ActiveArgument } from './commandCompletion'

describe('command completion', () => {
  const commands = buildSessionReference({
    schema_version: 7,
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
        path: ['set', 'translateDirection'],
        keywords: [],
        accepts_pattern_prefix: false,
        target_requirement: 'none',
        description: 'Set scale translate direction',
        arguments: [{
          kind: 'translate_direction',
          display_name: 'direction',
          required: true,
          default_value: null,
          constraints: [{
            kind: 'one_of',
            minimum: null,
            maximum: null,
            values: ['up', 'down'],
          }],
        }],
      },
      {
        path: ['chord'],
        keywords: [],
        accepts_pattern_prefix: false,
        target_requirement: 'cell',
        description: 'Apply a chord',
        arguments: [{
          kind: 'chord_name',
          display_name: 'chord',
          required: false,
          default_value: '"cycle"',
          constraints: [],
        }, {
          kind: 'chord_inversion',
          display_name: 'inversion',
          required: false,
          default_value: '-1',
          constraints: [],
        }],
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
        path: ['load', 'sequence'],
        keywords: ['open', 'file'],
        accepts_pattern_prefix: false,
        target_requirement: 'none',
        description: 'Load sequence',
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
      'set translateDirection',
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
    expect(rankCommandCompletions(commands, 'sequence load')[0]?.matchKind).toBe('orderInsensitive')
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

  it('uses one_of constraints as finite argument completions', () => {
    const analysis = analyzeCommandCompletion('set translateDirection d', commands)
    const candidates = getArgumentCompletionCandidates(analysis.activeArgument, {
      library: libraryFromDto(libraryFixture()),
      sequenceBank: null,
      activeTuningName: '',
      activeScaleId: null,
    })

    expect(analysis.activeArgument?.typedValue).toBe('d')
    expect(candidates.map((candidate) => candidate.label)).toEqual(['down'])
  })

  it('completes quoted runtime values and advances to the next argument', () => {
    const library = libraryFromDto(libraryFixture())
    library.chords = [
      ...library.chords,
      { name: 'major seventh', intervals: [0, 4, 7, 11], command: 'arp "major seventh"' },
    ]
    const input = 'chord "major se'
    const analysis = analyzeCommandCompletion(input, commands)
    const candidates = getArgumentCompletionCandidates(analysis.activeArgument, {
      library,
      sequenceBank: null,
      activeTuningName: '',
      activeScaleId: null,
    })
    const applied = applyArgumentCompletion(
      input,
      analysis.activeArgument!,
      candidates[0]!.insertionText
    )

    expect(candidates[0]?.label).toBe('major seventh')
    expect(applied.text).toBe('chord "major seventh" ')
    expect(analyzeCommandCompletion(applied.text, commands).activeArgument?.argument.displayName)
      .toBe('inversion')
  })

  it('analyzes the semicolon segment containing the caret and replaces a token in place', () => {
    const input = 'set velocity 0.5; chord major; transport stop'
    const caret = input.indexOf('major') + 2
    const analysis = analyzeCommandCompletion(input, commands, [], caret)
    const applied = applyArgumentCompletion(input, analysis.activeArgument!, 'minor')

    expect(analysis.recognizedCommand?.id).toBe('chord')
    expect(analysis.activeArgument?.typedValue).toBe('ma')
    expect(applied.text).toBe('set velocity 0.5; chord minor; transport stop')
  })

  it('sources scale, tuning, file, project, and sequence values from runtime snapshots', () => {
    const library = libraryFromDto(libraryFixture())
    library.tunings = [{
      name: '12EDO.scl',
      stem: '12EDO',
      relativePath: '12EDO.scl',
      fileRevision: 'sha256:12edo',
      command: 'load tuning "12EDO"',
      description: 'Equal temperament',
      intervals: [],
      octave: 1200,
      noteCount: 12,
    }]
    const resources = {
      library,
      sequenceBank: projectFromDto(projectFixture()).sequenceBank,
      activeTuningName: '12EDO.scl',
      activeScaleId: 'scale:major',
    }
    const active = (kind: string): ActiveArgument => ({
      argumentIndex: 0,
      argument: {
        kind,
        displayName: 'value',
        required: true,
        defaultValue: null,
        constraints: [],
      },
      replaceStart: 0,
      replaceEnd: 0,
      typedValue: '',
      rawValue: '',
      hasValue: false,
    })

    expect(getArgumentCompletionCandidates(active('scale_id'), resources)[0]).toMatchObject({
      label: 'major', insertionText: 'scale:major', isActive: true,
    })
    expect(getArgumentCompletionCandidates({
      ...active('scale_id'),
      typedValue: 'scale:',
      rawValue: 'scale:',
      hasValue: true,
    }, resources)[0]?.insertionText).toBe('scale:major')
    expect(getArgumentCompletionCandidates(active('tuning_name'), resources)[0]).toMatchObject({
      label: '12EDO', isActive: true,
    })
    expect(getArgumentCompletionCandidates(active('cell_name'), resources)[0]).toMatchObject({
      label: 'sequence', insertionText: 'sequence.xencell',
    })
    expect(getArgumentCompletionCandidates(active('project_name'), resources)[0]).toMatchObject({
      label: 'song', insertionText: 'song.xenproj',
    })
    expect(getArgumentCompletionCandidates(active('sequence_name'), resources)[0]?.label).toBe('S1')

    const controllerCandidates = getArgumentCompletionCandidates({
      ...active('midi_controller'),
      typedValue: 'bright',
      rawValue: 'bright',
      hasValue: true,
    }, {
      ...resources,
      midiCcLabels: new Map([[74, 'Brightness']]),
      activeMidiCcController: 74,
    })
    expect(controllerCandidates[0]).toMatchObject({
      label: 'CC 74 — Brightness',
      insertionText: '74',
      isActive: true,
    })
  })
})
