import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BridgePayloadError } from '../bridge/BridgeClient'
import { usePreferencesController } from './usePreferencesController'

describe('usePreferencesController', () => {
  beforeEach(() => window.localStorage.clear())

  it('applies changes optimistically and preserves unknown fields', async () => {
    const requestMock = vi.fn(async (name: string, payload: unknown) => {
      if (name === 'preferences.write') {
        const request = payload as { document: Record<string, unknown> }
        return { revision: '20', document: request.document }
      }
      return { revision: '10', document: null }
    })
    const request = requestMock as unknown as Parameters<typeof usePreferencesController>[0]['request']
    const { result } = renderHook(() => usePreferencesController({ request }))

    act(() => result.current.ingestPreferences({
      revision: '10',
      document: { schema_version: 1, future: { enabled: true } },
    }))
    act(() => result.current.setTheme('dark'))

    expect(result.current.theme).toBe('dark')
    await waitFor(() => expect(result.current.busy).toBe(false))
    const write = requestMock.mock.calls.find(([name]) => name === 'preferences.write')
    expect(write?.[1]).toEqual({
      expected_revision: '10',
      document: {
        schema_version: 1,
        theme: 'dark',
        future: { enabled: true },
      },
    })
  })

  it('reloads and reapplies only the intended field after a conflict', async () => {
    let writeCount = 0
    const requestMock = vi.fn(async (name: string, payload: unknown) => {
      if (name === 'preferences.read') {
        return {
          revision: '11',
          document: { schema_version: 1, workspace_layout: 'dual', remote: true },
        }
      }
      if (name === 'preferences.write') {
        writeCount += 1
        if (writeCount === 1) throw new BridgePayloadError('conflict', 'stale revision')
        const request = payload as { document: Record<string, unknown> }
        return { revision: '12', document: request.document }
      }
      throw new Error(`Unexpected request: ${name}`)
    })
    const request = requestMock as unknown as Parameters<typeof usePreferencesController>[0]['request']
    const { result } = renderHook(() => usePreferencesController({ request }))

    act(() => result.current.ingestPreferences({
      revision: '10',
      document: { schema_version: 1, workspace_layout: 'single' },
    }))
    act(() => result.current.setTheme('dark'))
    await waitFor(() => expect(result.current.busy).toBe(false))

    const writes = requestMock.mock.calls.filter(([name]) => name === 'preferences.write')
    expect(writes).toHaveLength(2)
    expect(writes[1]?.[1]).toEqual({
      expected_revision: '11',
      document: {
        schema_version: 1,
        theme: 'dark',
        workspace_layout: 'dual',
        remote: true,
      },
    })
    expect(result.current.workspaceLayout).toBe('dual')
    expect(result.current.theme).toBe('dark')
  })

  it('keeps the local choice and reports final persistence errors', async () => {
    const requestMock = vi.fn(async (name: string) => {
      if (name === 'preferences.write') throw new Error('disk full')
      return { revision: '10', document: null }
    })
    const request = requestMock as unknown as Parameters<typeof usePreferencesController>[0]['request']
    const { result } = renderHook(() => usePreferencesController({ request }))

    act(() => result.current.ingestPreferences({ revision: '10', document: null }))
    act(() => result.current.setWorkspaceLayout('dual'))
    await waitFor(() => expect(result.current.busy).toBe(false))

    expect(result.current.workspaceLayout).toBe('dual')
    expect(result.current.error).toBe('disk full')
  })

  it('ingests external changes and resets through preferences.delete', async () => {
    const requestMock = vi.fn(async (name: string) => {
      if (name === 'preferences.delete') return { revision: '0', document: null }
      throw new Error(`Unexpected request: ${name}`)
    })
    const request = requestMock as unknown as Parameters<typeof usePreferencesController>[0]['request']
    const { result } = renderHook(() => usePreferencesController({ request }))

    act(() => result.current.ingestPreferences({
      revision: '20',
      document: { schema_version: 1, theme: 'light', workspace_layout: 'dual' },
    }))
    expect(result.current.theme).toBe('light')
    expect(result.current.workspaceLayout).toBe('dual')

    await act(() => result.current.reset())

    expect(requestMock).toHaveBeenCalledWith('preferences.delete', {
      expected_revision: '20',
    })
    expect(result.current.theme).toBe('system')
    expect(result.current.workspaceLayout).toBe('single')
  })
})
