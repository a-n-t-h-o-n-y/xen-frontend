import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BridgeAbortError,
  BridgeClient,
  BridgePayloadError,
  BridgePayloadValidationError,
  BridgeProtocolError,
  BridgeTimeoutError,
} from './BridgeClient'
import type { ProjectSnapshotDto } from '../domain/contracts'

const projectFixture = (): ProjectSnapshotDto => ({
  schema_version: 4,
  history_entry_id: 2,
  project_revision: 3,
  project: {
    sequence_bank: {
      next_id: 2,
      sequences: [
        {
          id: 1,
          cell: {
              weight: 1,
              elements: [{ type: 'Note', pitch: 0, velocity: 1, delay: 0, gate: 1 }],
          },
        },
      ],
    },
    composition: {
      columns: [{ duration: { numerator: 4, denominator: 4 }, pitch: {
        tuning: { name: '12EDO', definition: { intervals: [], octave: 1200 } },
        scale: null,
        transposition: 0,
        translation_direction: 'up',
        base_frequency: 440,
      } }],
      rows: [
        {
          channel_id: 'channel-1',
          cells: [1],
        },
      ],
    },
  },
})

const responseEnvelope = (
  name: string,
  requestId: string,
  payload: Record<string, unknown>
) => ({
  protocol: 'xen.bridge.v3',
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
  it('builds typed request envelopes and returns validated payloads', async () => {
    let rawRequest = ''
    const client = createClient(async (requestJson) => {
      rawRequest = requestJson
      return responseEnvelope('state.get', 'req-test', projectFixture())
    })

    const payload = await client.request('state.get', {})

    expect(payload.project_revision).toBe(3)
    expect(JSON.parse(rawRequest)).toEqual({
      protocol: 'xen.bridge.v3',
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
        expected_project_revision: 3,
        selection: { path: [] },
        cursor: { row_index: 0, column_index: 0, sequence_id: null },
      },
    })

    expect(JSON.parse(rawRequest).payload.context.cursor).toEqual({
      row_index: 0,
      column_index: 0,
      sequence_id: null,
    })
  })

  it('serializes instance listener channels in session binding requests', async () => {
    let rawRequest = ''
    const client = createClient(async (requestJson) => {
      rawRequest = requestJson
      return responseEnvelope('session.binding.set', 'req-test', {})
    })

    await client.request('session.binding.set', {
      channel_id: 'drums',
    })

    expect(JSON.parse(rawRequest).payload).toEqual({ channel_id: 'drums' })
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
        error: { code: 'invalid_request', message: 'stale revision' },
      })
    )

    await expect(client.request('state.get', {})).rejects.toMatchObject({
      name: 'BridgePayloadError',
      code: 'invalid_request',
      message: 'stale revision',
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
