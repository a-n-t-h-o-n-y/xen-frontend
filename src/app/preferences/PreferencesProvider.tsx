import { useCallback, type ReactNode } from 'react'
import { bridgeClient } from '../bridge/BridgeClient'
import { PreferencesContext } from './PreferencesContext'
import { usePreferencesController } from './usePreferencesController'
import type { BridgeMethodMap, RequestOptions } from '../bridge/BridgeClient'

type PreferencesProviderProps = {
  children: ReactNode
}

export function PreferencesProvider({ children }: PreferencesProviderProps) {
  const request = useCallback(<K extends keyof BridgeMethodMap>(
    name: K,
    payload: BridgeMethodMap[K]['request'],
    options?: RequestOptions
  ): Promise<BridgeMethodMap[K]['response']> => bridgeClient.request(name, payload, options), [])
  const value = usePreferencesController({ request })

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
