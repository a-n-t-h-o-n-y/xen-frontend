import { useCallback, useMemo, useRef, useState } from 'react'
import { BridgePayloadError } from '../bridge/BridgeClient'
import { getErrorMessage } from '../utils/errors'
import {
  DEFAULT_PREFERENCES,
  applyPreferenceMutation,
  applyPreferencePatch,
  readCachedPreferences,
  resolvePreferencesDocument,
  writeCachedPreferences,
  type AppPreferences,
  type PreferenceMutation,
  type PreferencesResource,
} from './preferences'
import type { BridgeMethodMap, RequestOptions } from '../bridge/BridgeClient'
import type { ThemePreference } from '../theme/theme'
import type { WorkspaceLayoutPreference } from '../workspace/workspaceLayout'

type BridgeRequest = <K extends keyof BridgeMethodMap>(
  name: K,
  payload: BridgeMethodMap[K]['request'],
  options?: RequestOptions
) => Promise<BridgeMethodMap[K]['response']>

type UsePreferencesControllerArgs = {
  request: BridgeRequest
}

const isBridgeUnavailable = (error: unknown): boolean =>
  getErrorMessage(error).startsWith('JUCE bridge unavailable:')

export function usePreferencesController({ request }: UsePreferencesControllerArgs) {
  const resourceRef = useRef<PreferencesResource | null>(null)
  const pendingPatchRef = useRef<Partial<AppPreferences> | null>(null)
  const busyRef = useRef(false)
  const [preferences, setPreferences] = useState<AppPreferences>(readCachedPreferences)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const installResource = useCallback((resource: PreferencesResource): void => {
    if (resourceRef.current?.revision === resource.revision) return
    resourceRef.current = resource
    const resolved = resolvePreferencesDocument(resource.document)
    const effective = { ...resolved.preferences, ...pendingPatchRef.current }
    setPreferences(effective)
    writeCachedPreferences(effective)
    if (!pendingPatchRef.current) setError(resolved.loadError)
  }, [])

  const readLatest = useCallback(async (): Promise<PreferencesResource> => {
    const latest = await request('preferences.read', {})
    resourceRef.current = latest
    return latest
  }, [request])

  const persistMutation = useCallback(async (mutation: PreferenceMutation): Promise<void> => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    const patch = mutation.field === 'theme'
      ? { theme: mutation.value }
      : { workspaceLayout: mutation.value }
    pendingPatchRef.current = patch
    setPreferences((current) => {
      const next = applyPreferencePatch(current, mutation)
      writeCachedPreferences(next)
      return next
    })

    try {
      let current = resourceRef.current ?? await readLatest()
      const write = () => request('preferences.write', {
        expected_revision: current.revision,
        document: applyPreferenceMutation(current.document, mutation),
      })

      let response: PreferencesResource
      try {
        response = await write()
      } catch (caught) {
        if (!(caught instanceof BridgePayloadError) || caught.code !== 'conflict') throw caught
        current = await readLatest()
        response = await write()
      }

      pendingPatchRef.current = null
      resourceRef.current = null
      installResource(response)
    } catch (caught) {
      pendingPatchRef.current = null
      if (!isBridgeUnavailable(caught)) setError(getErrorMessage(caught))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [installResource, readLatest, request])

  const reset = useCallback(async (): Promise<void> => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    pendingPatchRef.current = DEFAULT_PREFERENCES
    setPreferences(DEFAULT_PREFERENCES)
    writeCachedPreferences(DEFAULT_PREFERENCES)

    try {
      let current = resourceRef.current ?? await readLatest()
      const remove = () => request('preferences.delete', {
        expected_revision: current.revision,
      })
      let response: PreferencesResource
      try {
        response = await remove()
      } catch (caught) {
        if (!(caught instanceof BridgePayloadError) || caught.code !== 'conflict') throw caught
        current = await readLatest()
        response = await remove()
      }
      pendingPatchRef.current = null
      resourceRef.current = null
      installResource(response)
    } catch (caught) {
      pendingPatchRef.current = null
      if (!isBridgeUnavailable(caught)) setError(getErrorMessage(caught))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [installResource, readLatest, request])

  return useMemo(() => ({
    theme: preferences.theme,
    workspaceLayout: preferences.workspaceLayout,
    busy,
    error,
    ingestPreferences: installResource,
    setTheme: (preference: ThemePreference) => {
      void persistMutation({ field: 'theme', value: preference })
    },
    setWorkspaceLayout: (preference: WorkspaceLayoutPreference) => {
      void persistMutation({ field: 'workspace_layout', value: preference })
    },
    reset,
  }), [busy, error, installResource, persistMutation, preferences, reset])
}
