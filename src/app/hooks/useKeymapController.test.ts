import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { keymapFromDto } from '../domain/mappers'
import { useKeymapController } from './useKeymapController'

describe('useKeymapController', () => {
  it('persists edits as complete documents and resets with delete', async () => {
    const requestMock = vi.fn(async (name: string, payload: unknown) => {
      if (name === 'keymap.write') {
        const request = payload as { document: unknown }
        return { revision: 20, document: request.document }
      }
      if (name === 'keymap.delete') return { revision: 0, document: null }
      return { revision: 10, document: null }
    })
    const request = requestMock as unknown as Parameters<typeof useKeymapController>[0]['request']
    const { result } = renderHook(() => useKeymapController({ request }))

    act(() => {
      result.current.ingestKeymap(keymapFromDto({
        revision: 10,
        document: { schema_version: 1, future_setting: true, overrides: [] },
      }))
    })

    const trigger = {
      key: 'q',
      modifiers: { shift: false, command: false, alt: false },
    } as const
    await act(() => result.current.disable('sequence', trigger))

    expect(requestMock).toHaveBeenCalledWith('keymap.write', {
      expected_revision: 10,
      document: {
        schema_version: 1,
        future_setting: true,
        overrides: [{ context: 'sequence', trigger, target: null }],
      },
    })
    expect(result.current.resource?.revision).toBe(20)

    await act(() => result.current.reset())
    expect(requestMock).toHaveBeenLastCalledWith('keymap.delete', { expected_revision: 20 })
    expect(result.current.resource?.document).toBeNull()
    expect(result.current.resource?.bindings.sequence).not.toHaveLength(0)
  })
})
