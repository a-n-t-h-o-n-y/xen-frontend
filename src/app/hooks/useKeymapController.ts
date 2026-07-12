import { useCallback, useRef, useState } from 'react'
import { BridgePayloadError } from '../bridge/BridgeClient'
import {
  keymapFromDto,
  keymapDocumentToDto,
} from '../domain/mappers'
import { ingestKeymapResource } from '../domain/resources'
import { getErrorMessage } from '../utils/errors'
import { triggersConflict, triggersEqual } from '../domain/keymap'
import type { BridgeMethodMap, RequestOptions } from '../bridge/BridgeClient'
import type {
  KeymapBinding,
  KeymapDocument,
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

  const persistDocument = useCallback(async (
    createDocument: (current: KeymapResource) => KeymapDocument
  ): Promise<void> => {
    const current = keymapRef.current
    if (!current) throw new Error('Keymap is not loaded')
    setBusy(true)
    setError(null)
    try {
      const document = createDocument(current)
      const response = await request('keymap.write', {
        expected_revision: current.revision,
        document: keymapDocumentToDto(document),
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

  const setBinding = useCallback(async (
    context: string,
    trigger: KeymapTrigger,
    target: KeymapTarget,
    originalTrigger?: KeymapTrigger,
    repeat: KeymapBinding['repeat'] = 'ignore'
  ): Promise<void> => {
    await persistDocument((current) => {
      const bindings = current.bindings[context] ?? []
      const nextBindings = bindings.filter((binding) =>
        !triggersConflict(binding.trigger, trigger) &&
        (!originalTrigger || !triggersEqual(binding.trigger, originalTrigger))
      )
      nextBindings.push({ trigger, target, repeat })
      return {
        schemaVersion: 2,
        bindings: { ...current.bindings, [context]: nextBindings },
      }
    })
  }, [persistDocument])

  const deleteBinding = useCallback((context: string, trigger: KeymapTrigger): Promise<void> =>
    persistDocument((current) => {
      const nextContext = (current.bindings[context] ?? []).filter((binding) =>
        !triggersEqual(binding.trigger, trigger)
      )
      const bindings = { ...current.bindings }
      if (nextContext.length > 0) bindings[context] = nextContext
      else delete bindings[context]
      return { schemaVersion: 2, bindings }
    }),
  [persistDocument])

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
    setBinding,
    deleteBinding,
    reset,
  }
}
