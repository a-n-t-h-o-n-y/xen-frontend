import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BridgeAbortError,
  BridgeClient,
  BridgePayloadError,
  BridgePayloadValidationError,
  BridgeProtocolError,
  BridgeTimeoutError,
} from './BridgeClient'
import { projectFixture } from '../domain/testFixtures'

const responseEnvelope = (
  name: string,
  requestId: string,
  payload: Record<string, unknown>
) => ({
  protocol: 'xen.bridge.v9',
  type: 'response',
  name,
  request_id: requestId,
  payload,
})

const createClient = (
  requestFn: (requestJson: string) => Promise<unknown>,
  requestId = 'req-test'
) => new BridgeClient({
  getRequestFn: async () => requestFn,
  createRequestId: () => requestId,
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BridgeClient', () => {
  it('serializes the dedicated modulation preview lifecycle', async () => {
    const requests: Array<Record<string, unknown>> = []
    const client = createClient(async (requestJson) => {
      const request = JSON.parse(requestJson) as { name: string; request_id: string }
      requests.push(request as unknown as Record<string, unknown>)
      if (request.name === 'modulation.preview.update') {
        return responseEnvelope(request.name, request.request_id, {
          status: { level: 'info', message: 'ok' },
          preview_id: 'mod-1',
          accepted_update_sequence: '1',
          accepted: true,
          project_changed: true,
          project_revision: '4',
          state_revision: '9',
        })
      }
      return responseEnvelope(request.name, request.request_id, {
        status: { level: 'info', message: 'ok' },
        preview_id: 'mod-1',
        snapshot: projectFixture(),
      })
    })

    await client.request('modulation.preview.begin', {
      expected_project_revision: '3',
      target: {
        cursor: { row_coordinate: 0, column_coordinate: 0, sequence_id: null },
        selection: { path: [] },
        pattern: { offset: 0, intervals: [1] },
      },
    })
    await client.request('modulation.preview.update', {
      preview_id: 'mod-1',
      update_sequence: '1',
      expected_project_revision: '3',
      destination: { id: 'weight' },
      output_range: { minimum: 0.1, maximum: 2 },
      modulation: {
        operation: 'average',
        waveforms: [{
          enabled: true,
          shape: 'sine',
          frequency: 1,
          phase: 0,
          amplitude: 1,
          amplitude_offset: 0,
        }],
      },
    })

    expect(requests.map((request) => request.name)).toEqual([
      'modulation.preview.begin',
      'modulation.preview.update',
    ])
  })

  it('builds typed request envelopes and returns validated payloads', async () => {
    let rawRequest = ''
    const client = createClient(async (requestJson) => {
      rawRequest = requestJson
      return responseEnvelope('state.get', 'req-test', projectFixture())
    })

    const payload = await client.request('state.get', {})

    expect(payload.project_revision).toBe('3')
    expect(JSON.parse(rawRequest)).toEqual({
      protocol: 'xen.bridge.v9',
      type: 'request',
      name: 'state.get',
      request_id: 'req-test',
      payload: {},
    })
  })

  it('serializes the required cursor with a nullable sequence id', async () => {
    let rawRequest = ''
    const client = createClient(async (requestJson) => {
      rawRequest = requestJson
      return responseEnvelope('command.execute', 'req-test', {
        status: { level: 'info', message: 'ok' },
        suggested_selection: null,
        snapshot: projectFixture(),
      })
    })

    await client.request('command.execute', {
      command: 'transport stop',
      context: {
        expected_project_revision: '3',
        selection: { path: [] },
        cursor: { row_coordinate: -8, column_coordinate: 13, sequence_id: null },
      },
    })

    expect(JSON.parse(rawRequest).payload.context.cursor).toEqual({
      row_coordinate: -8,
      column_coordinate: 13,
      sequence_id: null,
    })
  })

  it('serializes preview lifecycle requests and preview command context', async () => {
    const requests: Array<Record<string, unknown>> = []
    const client = createClient(async (requestJson) => {
      const request = JSON.parse(requestJson) as { name: string }
      requests.push(request as unknown as Record<string, unknown>)
      if (request.name === 'preview.begin') {
        return responseEnvelope('preview.begin', 'req-test', {
          status: { level: 'info', message: 'Preview started.' },
          preview_id: 'preview-1',
          snapshot: { ...projectFixture(), preview_active: true },
        })
      }
      if (request.name === 'command.execute') {
        return responseEnvelope('command.execute', 'req-test', {
          status: { level: 'info', message: 'ok' },
          suggested_selection: null,
          snapshot: { ...projectFixture(), preview_active: true },
        })
      }
      return responseEnvelope(request.name, 'req-test', {
        status: { level: 'info', message: 'Preview finished.' },
        snapshot: projectFixture(),
      })
    })

    await client.request('preview.begin', { expected_project_revision: '3' })
    await client.request('command.execute', {
      command: 'set key 4',
      context: {
        expected_project_revision: '3',
        preview_id: 'preview-1',
        selection: { path: [] },
        cursor: { row_coordinate: 0, column_coordinate: 0, sequence_id: null },
      },
    })
    await client.request('preview.commit', {
      preview_id: 'preview-1',
      expected_project_revision: '4',
    })

    expect(requests.map((request) => request.name)).toEqual([
      'preview.begin',
      'command.execute',
      'preview.commit',
    ])
    expect((requests[1]?.payload as { context: { preview_id: string } }).context.preview_id)
      .toBe('preview-1')
  })

  it('serializes instance listener channels in session binding requests', async () => {
    let rawRequest = ''
    const client = createClient(async (requestJson) => {
      rawRequest = requestJson
      return responseEnvelope('session.binding.set', 'req-test', {
        session_id: 'session-1',
        instance_id: 'instance-1',
        channel_id: 'drums',
      })
    })

    await client.request('session.binding.set', {
      channel_id: 'drums',
    })

    expect(JSON.parse(rawRequest).payload).toEqual({ channel_id: 'drums' })
  })

  it('serializes every dedicated project, recovery, and cell document request', async () => {
    const requests: Array<{ name: string; payload: Record<string, unknown> }> = []
    const file = {
      name: 'song.xenproj',
      relative_path: 'sets/song.xenproj',
      stem: 'song',
      file_revision: 'sha256:updated',
    }
    const client = createClient(async (requestJson) => {
      const request = JSON.parse(requestJson) as {
        name: string
        payload: Record<string, unknown>
      }
      requests.push(request)
      const cellFile = {
            name: 'bass.xencell',
            relative_path: 'cells/bass.xencell',
            stem: 'bass',
            file_revision: 'sha256:updated-cell',
      }
      const hasProjectFile = request.name === 'project.open' ||
        request.name === 'project.save' || request.name === 'project.save_as'
      const hasCellFile = request.name === 'cell.import' || request.name === 'cell.save'
      return responseEnvelope(request.name, 'req-test', {
        snapshot: projectFixture('4'),
        file: hasProjectFile ? file : hasCellFile ? cellFile : null,
        suggested_selection: request.name === 'cell.import' || request.name === 'cell.save'
          ? { path: [] }
          : null,
      })
    })

    await client.request('project.new', {
      expected_project_revision: '3',
      discard_unsaved: false,
    })
    await client.request('project.open', {
      relative_path: 'sets/song.xenproj',
      expected_project_revision: '3',
      discard_unsaved: true,
    })
    await client.request('project.save', { expected_project_revision: '3' })
    await client.request('project.save_as', {
      relative_path: 'sets/song.xenproj',
      expected_project_revision: '3',
      expected_file_revision: null,
    })
    await client.request('project.recovery.restore', {
      recovery_revision: 'recovery:17-alpha',
      expected_project_revision: '3',
      discard_unsaved: true,
    })
    await client.request('project.recovery.discard', { recovery_revision: 'recovery:17-alpha' })
    await client.request('cell.import', {
      relative_path: 'cells/bass.xencell',
      expected_project_revision: '3',
      cursor: { row_coordinate: -2, column_coordinate: 9, sequence_id: 2 },
    })
    await client.request('cell.save', {
      relative_path: 'cells/bass.xencell',
      expected_project_revision: '3',
      cursor: { row_coordinate: -2, column_coordinate: 9, sequence_id: 2 },
      selection: { path: [{ kind: 'element', index: 0 }] },
      expected_file_revision: 'sha256:before',
    })

    expect(requests.map((request) => request.name)).toEqual([
      'project.new',
      'project.open',
      'project.save',
      'project.save_as',
      'project.recovery.restore',
      'project.recovery.discard',
      'cell.import',
      'cell.save',
    ])
    expect(requests[3]?.payload).toMatchObject({
      relative_path: 'sets/song.xenproj',
      expected_project_revision: '3',
      expected_file_revision: null,
    })
    expect(requests[7]?.payload).toMatchObject({
      relative_path: 'cells/bass.xencell',
      expected_file_revision: 'sha256:before',
    })
  })

  it('rejects legacy and absolute document paths before invoking the backend', async () => {
    const requestFn = vi.fn()
    const client = createClient(requestFn)

    await expect(client.request('project.open', {
      relative_path: 'legacy.xencomp',
      expected_project_revision: '3',
      discard_unsaved: false,
    })).rejects.toThrow('Expected a .xenproj path')
    await expect(client.request('cell.import', {
      relative_path: '/outside.xencell',
      expected_project_revision: '3',
      cursor: { row_coordinate: 0, column_coordinate: 0, sequence_id: null },
    })).rejects.toThrow('Expected a content-relative path')
    await expect(client.request('project.open', {
      relative_path: '../outside.xenproj',
      expected_project_revision: '3',
      discard_unsaved: false,
    })).rejects.toThrow('Expected a content-relative path')
    expect(requestFn).not.toHaveBeenCalled()
  })

  it('writes opaque keymap documents using the storage revision', async () => {
    let rawRequest = ''
    const client = createClient(async (requestJson) => {
      rawRequest = requestJson
      return responseEnvelope('keymap.write', 'req-test', {
        revision: '18446744073709551615',
        document: { schema_version: 1, overrides: [], future_setting: true },
      })
    })

    const result = await client.request('keymap.write', {
      expected_revision: '9223372036854775808',
      document: { schema_version: 1, overrides: [], future_setting: true },
    })

    expect(JSON.parse(rawRequest).payload.expected_revision).toBe('9223372036854775808')
    expect(result.document).toMatchObject({ future_setting: true })
  })

  it('writes opaque preferences objects using the storage revision', async () => {
    let rawRequest = ''
    const client = createClient(async (requestJson) => {
      rawRequest = requestJson
      return responseEnvelope('preferences.write', 'req-test', {
        revision: '21',
        document: { schema_version: 912, theme: 'dark', future_setting: true },
      })
    })

    const result = await client.request('preferences.write', {
      expected_revision: '20',
      document: { schema_version: 912, theme: 'dark', future_setting: true },
    })

    expect(JSON.parse(rawRequest).payload.expected_revision).toBe('20')
    expect(result.document).toMatchObject({ future_setting: true })
  })

  it('deletes preferences using the opaque storage revision', async () => {
    let rawRequest = ''
    const client = createClient(async (requestJson) => {
      rawRequest = requestJson
      return responseEnvelope('preferences.delete', 'req-test', {
        revision: '22',
        document: null,
      })
    })

    const result = await client.request('preferences.delete', {
      expected_revision: '21',
    })

    expect(JSON.parse(rawRequest).payload).toEqual({
      expected_revision: '21',
    })
    expect(result.document).toBeNull()
  })

  it('rejects mismatched response method names', async () => {
    const client = createClient(async () =>
      responseEnvelope('library.get', 'req-test', projectFixture())
    )

    await expect(client.request('state.get', {})).rejects.toBeInstanceOf(
      BridgeProtocolError
    )
  })

  it('rejects mismatched response request ids', async () => {
    const client = createClient(async () =>
      responseEnvelope('state.get', 'req-other', projectFixture())
    )

    await expect(client.request('state.get', {})).rejects.toBeInstanceOf(
      BridgeProtocolError
    )
  })

  it('converts backend error payloads into BridgePayloadError', async () => {
    const client = createClient(async () =>
      responseEnvelope('state.get', 'req-test', {
        error: {
          code: 'file_exists',
          message: 'target exists',
          details: { current_file_revision: 'sha256:on-disk' },
        },
      })
    )

    await expect(client.request('state.get', {})).rejects.toMatchObject({
      name: 'BridgePayloadError',
      code: 'file_exists',
      message: 'target exists',
      details: { current_file_revision: 'sha256:on-disk' },
    } satisfies Partial<BridgePayloadError>)
  })

  it('rejects invalid success payloads distinctly', async () => {
    const client = createClient(async () =>
      responseEnvelope('state.get', 'req-test', { project_revision: 3 })
    )

    await expect(client.request('state.get', {})).rejects.toBeInstanceOf(
      BridgePayloadValidationError
    )
  })

  it('rejects timeout paths distinctly', async () => {
    vi.useFakeTimers()
    const client = createClient(async () => new Promise(() => undefined))
    const result = client.request('state.get', {}, { timeoutMs: 50 })
    // eslint-disable-next-line vitest/valid-expect -- assertion is awaited after advancing fake timers below
    const assertion = expect(result).rejects.toBeInstanceOf(BridgeTimeoutError)

    await vi.advanceTimersByTimeAsync(50)

    await assertion
  })

  it('rejects abort paths distinctly', async () => {
    const abortController = new AbortController()
    const client = createClient(async () => new Promise(() => undefined))
    const result = client.request('state.get', {}, { signal: abortController.signal })

    abortController.abort()

    await expect(result).rejects.toBeInstanceOf(BridgeAbortError)
  })
})
