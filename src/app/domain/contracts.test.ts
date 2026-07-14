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
    expect(() => parseKeymapDocument({
      schema_version: 2,
      bindings: {
        composition: [{
          trigger,
          target: {
            type: 'ui_action',
            action: 'composition.row.insert_before',
            arguments: {},
          },
        }],
      },
    })).toThrow()
  })

  it('accepts envelopes and rejects invalid payloads', () => {
    expect(parseEnvelope({
      protocol: 'xen.bridge.v6',
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
      protocol: 'xen.bridge.v6',
      plugin_version: '1.0.0',
      project_schema_version: 6,
      library_schema_version: 2,
      catalog: {
        schema_version: 4,
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
      preferences: {
        revision: '340282366920938463463374607431768211455',
        document: {
          schema_version: 1,
          theme: 'dark',
          workspace_layout: 'dual',
          future_preference: true,
        },
      },
    })
    expect(hello.keymap.revision).toBe('18446744073709551615')
    expect(hello.preferences.revision).toBe('340282366920938463463374607431768211455')
    expect(() => parseSessionHello({
      ...hello,
      keymap: { revision: 9_223_372_036_854_776_000, document: null },
    })).toThrow()
    expect(() => parseSessionHello({
      ...hello,
      preferences: { revision: 'opaque', document: null },
    })).toThrow('Expected a decimal revision string')
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
    expect(arrangedProject.schema_version).toBe(6)
    expect(arrangedProject.project.composition.placements[2]).toEqual({
      row: 3,
      column: -4,
      sequence_id: 2,
    })
    expect(arrangedProject.project.composition.loop_region.start_column).toBe(-2)
    expect(parseLibrarySnapshot(libraryFixture()).scales[0]?.id).toBe('chromatic')
    expect(() => parseLibrarySnapshot({
      ...libraryFixture(),
      projects: [{
        name: 'legacy.xencomp',
        relative_path: 'legacy.xencomp',
        stem: 'legacy',
        file_revision: 'sha256:legacy',
      }],
    })).toThrow('Expected a .xenproj path')
    expect(() => parseLibrarySnapshot({
      ...libraryFixture(),
      cells: [{
        name: 'outside.xencell',
        relative_path: '/outside.xencell',
        stem: 'outside',
        file_revision: 'sha256:outside',
      }],
    })).toThrow('Expected a content-relative path')
    expect(() => parseLibrarySnapshot({
      ...libraryFixture(),
      compositions: [],
    })).toThrow()
    expect(parseCommandResponse({
      status: { level: 'info', message: 'ok' },
      suggested_selection: { path: [{ kind: 'element', index: 0 }] },
      snapshot: projectFixture(),
    }).status.message).toBe('ok')
    expect(parseBridgeEvent({
      protocol: 'xen.bridge.v6',
      type: 'event',
      name: 'library.changed',
      payload: libraryFixture(),
    }).name).toBe('library.changed')
    expect(parseBridgeEvent({
      protocol: 'xen.bridge.v6',
      type: 'event',
      name: 'preferences.changed',
      payload: {
        revision: '340282366920938463463374607431768211456',
        document: { schema_version: 1, theme: 'light', unknown: true },
      },
    }).name).toBe('preferences.changed')
    expect(() => parseProjectSnapshot({ ...projectFixture(), schema_version: 5 })).toThrow()
    expect(() => parseProjectSnapshot({
      ...projectFixture(),
      state_revision: 9_223_372_036_854_776_000,
    })).toThrow('expected string')
    const dense = structuredClone(projectFixture()) as unknown as Record<string, unknown>
    const denseProject = dense.project as { composition: Record<string, unknown> }
    denseProject.composition = {
      columns: [],
      rows: [{ channel_id: 'channel-1', cells: [1] }],
      loop_region: { start_column: 0, end_column: 0 },
    }
    expect(() => parseProjectSnapshot(dense)).toThrow()
    expect(() => parseProjectSnapshot({
      ...arrangedProjectFixture(),
      project: {
        ...arrangedProjectFixture().project,
        composition: {
          ...arrangedProjectFixture().project.composition,
          placements: [{ row: -2, column: -4, sequence_id: 404 }],
        },
      },
    })).toThrow()
    expect(() => parseProjectSnapshot({
      ...arrangedProjectFixture(),
      project: {
        ...arrangedProjectFixture().project,
        composition: {
          ...arrangedProjectFixture().project.composition,
          placements: [{ row: 999, column: -4, sequence_id: 1 }],
        },
      },
    })).toThrow()
    const outOfRange = arrangedProjectFixture()
    outOfRange.project.composition.rows[0]!.coordinate = 2_147_483_648
    expect(() => parseProjectSnapshot(outOfRange)).toThrow()
    const reversedLoop = arrangedProjectFixture()
    reversedLoop.project.composition.loop_region = { start_column: 3, end_column: -1 }
    expect(() => parseProjectSnapshot(reversedLoop)).toThrow()
  })
})
