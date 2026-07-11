import { useCallback, useRef, useState } from 'react'
import { BridgePayloadError } from '../bridge/BridgeClient'
import {
  keymapFromDto,
  keymapOverridesToDocument,
} from '../domain/mappers'
import { ingestKeymapResource } from '../domain/resources'
import { getErrorMessage } from '../utils/errors'
import { triggersEqual } from '../domain/keymap'
import type { BridgeMethodMap, RequestOptions } from '../bridge/BridgeClient'
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
    ingestKeymap(keymapFromDto(await request('keymap.read', {})))
  }, [ingestKeymap, request])

  const persistOverrides = useCallback(async (
    createOverrides: (current: KeymapResource) => KeymapResource['overrides']
  ): Promise<void> => {
    const current = keymapRef.current
    if (!current) throw new Error('Keymap is not loaded')
    setBusy(true)
    setError(null)
    try {
      const overrides = createOverrides(current)
      const response = await request('keymap.write', {
        expected_revision: current.revision,
        document: keymapOverridesToDocument(current.document, overrides),
      })
      ingestKeymap(keymapFromDto(response))
    } catch (caught) {
      if (caught instanceof BridgePayloadError && caught.code === 'conflict') {
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
    await persistOverrides((current) => {
      const overrides = current.overrides.filter((override) =>
        override.context !== context ||
        (!triggersEqual(override.trigger, trigger) &&
          (!originalTrigger || !triggersEqual(override.trigger, originalTrigger)))
      )
      overrides.push({ context, trigger, target })
      if (originalTrigger && !triggersEqual(originalTrigger, trigger)) {
        const originalWasOverride = current.overrides.some((override) =>
          override.context === context && triggersEqual(override.trigger, originalTrigger)
        )
        if (!originalWasOverride) {
          overrides.push({ context, trigger: originalTrigger, target: null })
        }
      }
      return overrides
    })
  }, [persistOverrides])

  const disable = useCallback((context: string, trigger: KeymapTrigger): Promise<void> =>
    persistOverrides((current) => [
      ...current.overrides.filter((override) =>
        override.context !== context || !triggersEqual(override.trigger, trigger)
      ),
      { context, trigger, target: null },
    ]),
  [persistOverrides])

  const restore = useCallback((context: string, trigger: KeymapTrigger): Promise<void> =>
    persistOverrides((current) => current.overrides.filter((override) =>
      override.context !== context || !triggersEqual(override.trigger, trigger)
    )),
  [persistOverrides])

  const reset = useCallback(async (): Promise<void> => {
    const current = keymapRef.current
    if (!current) throw new Error('Keymap is not loaded')
    setBusy(true)
    setError(null)
    try {
      ingestKeymap(keymapFromDto(await request('keymap.delete', {
        expected_revision: current.revision,
      })))
    } catch (caught) {
      if (caught instanceof BridgePayloadError && caught.code === 'conflict') {
        await refresh()
        const message = 'Shortcuts changed elsewhere. The latest version was loaded; retry reset.'
        setError(message)
        throw new Error(message)
      }
      setError(getErrorMessage(caught))
      throw caught
    } finally {
      setBusy(false)
    }
  }, [ingestKeymap, refresh, request])

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
