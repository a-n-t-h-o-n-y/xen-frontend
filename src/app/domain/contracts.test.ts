import { describe, expect, it } from 'vitest'
import {
  parseBridgeEvent,
  parseCommandResponse,
  parseEnvelope,
  parseLibrarySnapshot,
  parseKeymapDocument,
  parseProjectSnapshot,
  parseSessionHello,
} from './contracts'
import { arrangedProjectFixture, libraryFixture, projectFixture } from './testFixtures'

describe('schema contract validation', () => {
  it('validates complete schema-v2 keymap documents and rejects v1', () => {
    const trigger = {
      match: { kind: 'key', value: 'q' },
      modifiers: {
        shift: false,
        alt: false,
        primary: false,
        control: false,
        meta: false,
      },
    }
    const binding = {
      trigger,
      target: {
        type: 'ui_action' as const,
        action: 'input_mode.set' as const,
        arguments: { mode: 'pitch' as const },
      },
    }
    expect(parseKeymapDocument({
      schema_version: 2,
      bindings: { sequencer: [binding] },
    }).bindings.sequencer).toHaveLength(1)
    expect(() => parseKeymapDocument({ schema_version: 1, overrides: [] })).toThrow()
    expect(() => parseKeymapDocument({
      schema_version: 2,
      bindings: { sequencer: [binding, binding] },
    })).toThrow('Duplicate keymap binding')
  })

  it('accepts envelopes and rejects invalid payloads', () => {
    expect(parseEnvelope({
      protocol: 'xen.bridge.v3',
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

  it('validates hello catalog and opaque keymap storage', () => {
    const hello = parseSessionHello({
      protocol: 'xen.bridge.v3',
      plugin_version: '1.0.0',
      project_schema_version: 4,
      library_schema_version: 1,
      catalog: {
        schema_version: 3,
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
        revision: '18446744073709551615',
        document: {
          schema_version: 1,
          overrides: [{
            context: 'sequence',
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
      },
    })
    expect(hello.keymap.revision).toBe('18446744073709551615')
    expect(() => parseSessionHello({
      ...hello,
      keymap: { revision: 9_223_372_036_854_776_000, document: null },
    })).toThrow()
    expect(hello.catalog.commands[0]?.arguments[0]?.constraints[0]?.maximum).toBe(1)
    expect(() => parseSessionHello({
      ...hello,
      project_schema_version: 3,
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
    expect(parseProjectSnapshot(projectFixture()).project.composition.columns[0]?.pitch.transposition)
      .toBe(2)
    const arrangedProject = parseProjectSnapshot(arrangedProjectFixture())
    expect(arrangedProject.schema_version).toBe(4)
    expect(arrangedProject.project.composition.rows[1]?.cells[0]).toBe(2)
    expect(arrangedProject.project.composition.loop_region?.start_column).toBe(2)
    expect(parseLibrarySnapshot(libraryFixture()).scales[0]?.id).toBe('chromatic')
    expect(parseCommandResponse({
      status: { level: 'info', message: 'ok' },
      suggested_selection: { path: [{ kind: 'element', index: 0 }] },
      snapshot: projectFixture(),
    }).status.message).toBe('ok')
    expect(parseBridgeEvent({
      protocol: 'xen.bridge.v3',
      type: 'event',
      name: 'library.changed',
      payload: libraryFixture(),
    }).name).toBe('library.changed')
    expect(() => parseProjectSnapshot({ ...projectFixture(), schema_version: 3 })).toThrow()
    expect(() => parseProjectSnapshot({
      ...arrangedProjectFixture(),
      project: {
        ...arrangedProjectFixture().project,
        composition: {
          columns: arrangedProjectFixture().project.composition.columns.slice(0, 1),
          rows: [{ channel_id: 'channel-1', cells: [404] }],
        },
      },
    })).toThrow()
    expect(() => parseProjectSnapshot({
      ...arrangedProjectFixture(),
      project: {
        ...arrangedProjectFixture().project,
        composition: {
          columns: arrangedProjectFixture().project.composition.columns.slice(0, 1),
          rows: [{ channel_id: 'channel-1', cells: [1] }],
          loop_region: { start_column: 1, end_column: 0 },
        },
      },
    })).toThrow()
  })
})
