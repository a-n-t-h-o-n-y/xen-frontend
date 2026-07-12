import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { keymapFromDto } from '../domain/mappers'
import { useKeymapController } from './useKeymapController'

describe('useKeymapController', () => {
  it('persists edits as complete documents and resets with delete', async () => {
    const requestMock = vi.fn(async (name: string, payload: unknown) => {
      if (name === 'keymap.write') {
        const request = payload as { document: unknown }
        return { revision: '20', document: request.document }
      }
      if (name === 'keymap.delete') return { revision: '0', document: null }
      return { revision: '10', document: null }
    })
    const request = requestMock as unknown as Parameters<typeof useKeymapController>[0]['request']
    const { result } = renderHook(() => useKeymapController({ request }))

    act(() => {
      result.current.ingestKeymap(keymapFromDto({
        revision: '10',
        document: null,
      }))
    })

    const trigger = {
      match: { kind: 'key', value: 'q' },
      modifiers: {
        shift: false,
        alt: false,
        primary: false,
        control: false,
        meta: false,
      },
    } as const
    await act(() => result.current.setBinding('sequencer', trigger, {
      type: 'ui_action',
      action: 'input_mode.set',
      arguments: { mode: 'pitch' },
    }))

    const write = requestMock.mock.calls.find(([name]) => name === 'keymap.write')
    expect(write?.[1]).toMatchObject({
      expected_revision: '10',
      document: { schema_version: 2 },
    })
    expect((write?.[1] as { document: { bindings: Record<string, unknown[]> } })
      .document.bindings.sequencer).toContainEqual(expect.objectContaining({ trigger }))
    expect(result.current.resource?.revision).toBe('20')

    await act(() => result.current.reset())
    expect(requestMock).toHaveBeenLastCalledWith('keymap.delete', { expected_revision: '20' })
    expect(result.current.resource?.source).toBe('default')
    expect(result.current.resource?.bindings.sequencer).not.toHaveLength(0)
  })
})
