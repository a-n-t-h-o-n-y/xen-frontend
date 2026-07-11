import { describe, expect, it } from 'vitest'
import { parseKeymapResource } from './contracts'
import {
  expandNumericPlaceholders,
  findKeymapBinding,
  findKeymapTriggerConflict,
  formatKeymapTarget,
  formatKeymapTrigger,
  normalizeKey,
  triggerIdentity,
} from './keymap'
import {
  keymapFromDto,
  keymapOverrideRemoveRequestToDto,
  keymapOverrideSetRequestToDto,
} from './mappers'
import { ingestKeymapResource } from './resources'
import {
  formatKeymapContext,
  getCommandKeymapContext,
  runCommandUiAction,
} from './uiActions'

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

