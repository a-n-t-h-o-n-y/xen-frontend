import { createContext } from 'react'
import type { PreferencesResource } from './preferences'
import type { ThemePreference } from '../theme/theme'
import type { WorkspaceLayoutPreference } from '../workspace/workspaceLayout'

export type PreferencesContextValue = {
  theme: ThemePreference
  workspaceLayout: WorkspaceLayoutPreference
  busy: boolean
  error: string | null
  ingestPreferences: (resource: PreferencesResource) => void
  setTheme: (preference: ThemePreference) => void
  setWorkspaceLayout: (preference: WorkspaceLayoutPreference) => void
  reset: () => Promise<void>
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)
