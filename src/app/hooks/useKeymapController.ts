import { useCallback, useRef, useState } from 'react'
import { BridgePayloadError } from '../bridge/BridgeClient'
import {
  keymapFromDto,
  keymapOverrideRemoveRequestToDto,
  keymapOverrideSetRequestToDto,
} from '../domain/mappers'
import { ingestKeymapResource } from '../domain/resources'
import { getErrorMessage } from '../utils/errors'
import { triggersEqual } from '../domain/keymap'
import type {
  BridgeMethodMap,
  KeymapResetRequest,
  RequestOptions,
} from '../bridge/BridgeClient'
import type {
  KeymapResource,
  KeymapTarget,
  KeymapTrigger,
} from '../domain/models'

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
  'keymap.override.set': {
    context: string
    trigger: KeymapTrigger
    target: KeymapTarget | null
  }
  'keymap.override.remove': {
    context: string
    trigger: KeymapTrigger
  }
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
    ingestKeymap(keymapFromDto(await request('keymap.get', {})))
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
      const requestPayload = name === 'keymap.override.set'
        ? keymapOverrideSetRequestToDto(current.revision, payload as KeymapMutationPayload['keymap.override.set'])
        : name === 'keymap.override.remove'
          ? keymapOverrideRemoveRequestToDto(
              current.revision,
              payload as KeymapMutationPayload['keymap.override.remove']
            )
          : { expected_revision: current.revision }
      const response = await request(name, requestPayload as BridgeMethodMap[K]['request'])
      ingestKeymap(keymapFromDto(response))
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
