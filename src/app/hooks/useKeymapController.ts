import { useCallback, useRef, useState } from 'react'
import { BridgePayloadError } from '../bridge/BridgeClient'
import { ingestKeymapResource } from '../domain/resources'
import { getErrorMessage } from '../shared'
import { triggersEqual } from '../domain/keymap'
import type {
  BridgeMethodMap,
  KeymapOverrideRemoveRequest,
  KeymapOverrideSetRequest,
  KeymapResetRequest,
  RequestOptions,
} from '../bridge/BridgeClient'
import type {
  KeymapResource,
  KeymapTarget,
  KeymapTrigger,
} from '../domain/contracts'

type BridgeRequest = <K extends keyof BridgeMethodMap>(
  name: K,
  payload: BridgeMethodMap[K]['request'],
  options?: RequestOptions
) => Promise<BridgeMethodMap[K]['response']>

type KeymapMutationMethod =
  | 'keymap.override.set'
  | 'keymap.override.remove'
  | 'keymap.reset'

type KeymapMutationPayload = {
  'keymap.override.set': Omit<KeymapOverrideSetRequest, 'expected_revision'>
  'keymap.override.remove': Omit<KeymapOverrideRemoveRequest, 'expected_revision'>
  'keymap.reset': Omit<KeymapResetRequest, 'expected_revision'>
}

type UseKeymapControllerArgs = {
  request: BridgeRequest
}

export function useKeymapController({ request }: UseKeymapControllerArgs) {
  const keymapRef = useRef<KeymapResource | null>(null)
  const [resource, setResource] = useState<KeymapResource | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback((): void => {
    setError(null)
  }, [])

  const ingestKeymap = useCallback((nextResource: KeymapResource): KeymapResource => {
    const result = ingestKeymapResource(keymapRef.current, nextResource)
    if (result.installed) {
      keymapRef.current = result.resource
      setResource(result.resource)
    }
    return result.resource
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    ingestKeymap(await request('keymap.get', {}))
  }, [ingestKeymap, request])

  const mutate = useCallback(async <K extends KeymapMutationMethod>(
    name: K,
    payload: KeymapMutationPayload[K]
  ): Promise<void> => {
    const current = keymapRef.current
    if (!current) throw new Error('Keymap is not loaded')
    setBusy(true)
    setError(null)
    try {
      const response = await request(name, {
        expected_revision: current.revision,
        ...payload,
      } as BridgeMethodMap[K]['request'])
      ingestKeymap(response)
    } catch (caught) {
      if (caught instanceof BridgePayloadError && caught.code === 'invalid_request') {
        await refresh()
        const retryError = new Error(
          'Shortcuts changed elsewhere. The latest version was loaded; retry your edit.'
        )
        setError(retryError.message)
        throw retryError
      }
      const message = getErrorMessage(caught)
      setError(message)
      throw caught
    } finally {
      setBusy(false)
    }
  }, [ingestKeymap, refresh, request])

  const setOverride = useCallback(async (
    context: string,
    trigger: KeymapTrigger,
    target: KeymapTarget,
    originalTrigger?: KeymapTrigger
  ): Promise<void> => {
    await mutate('keymap.override.set', { context, trigger, target })
    if (!originalTrigger || triggersEqual(originalTrigger, trigger)) return

    const originalWasOverride = keymapRef.current?.overrides.some((override) =>
      override.context === context && triggersEqual(override.trigger, originalTrigger)
    )
    if (originalWasOverride) {
      await mutate('keymap.override.remove', { context, trigger: originalTrigger })
    } else {
      await mutate('keymap.override.set', {
        context,
        trigger: originalTrigger,
        target: null,
      })
    }
  }, [mutate])

  const disable = useCallback((context: string, trigger: KeymapTrigger): Promise<void> =>
    mutate('keymap.override.set', { context, trigger, target: null }),
  [mutate])

  const restore = useCallback((context: string, trigger: KeymapTrigger): Promise<void> =>
    mutate('keymap.override.remove', { context, trigger }),
  [mutate])

  const reset = useCallback((): Promise<void> =>
    mutate('keymap.reset', {}),
  [mutate])

  return {
    keymapRef,
    resource,
    busy,
    error,
    clearError,
    ingestKeymap,
    refresh,
    setOverride,
    disable,
    restore,
    reset,
  }
}
