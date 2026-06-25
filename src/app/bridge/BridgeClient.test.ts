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
  schema_version: 2,
  history_entry_id: 2,
  project_revision: 3,
  project: {
    measure_bank: {
      next_id: 2,
      measures: [
        {
          id: 1,
          measure: {
            cell: {
              weight: 1,
              elements: [{ type: 'Note', pitch: 0, velocity: 1, delay: 0, gate: 1 }],
            },
          },
        },
      ],
    },
    composition: {
      columns: [{ length: { numerator: 4, denominator: 4 } }],
      rows: [
        {
          output_id: 'current',
          cells: [1],
        },
      ],
    },
    pitch: {
      tuning: {
        name: '12EDO',
        definition: {
          intervals: Array.from({ length: 12 }, (_, index) => index * 100),
          octave: 1200,
        },
      },
      scale: null,
      transposition: 0,
      translation_direction: 'up',
      base_frequency: 440,
    },
  },
})

const responseEnvelope = (
  name: string,
  requestId: string,
  payload: Record<string, unknown>
) => ({
  protocol: 'xen.bridge.v1',
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
      protocol: 'xen.bridge.v1',
      type: 'request',
      name: 'state.get',
      request_id: 'req-test',
      payload: {},
    })
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
