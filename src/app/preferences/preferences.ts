import { isThemePreference, readThemePreference, writeThemePreference } from '../theme/theme'
import {
  isWorkspaceLayoutPreference,
  readWorkspaceLayoutPreference,
  writeWorkspaceLayoutPreference,
} from '../workspace/workspaceLayout'
import type { PreferencesResourceDto } from '../domain/contracts'
import type { ThemePreference } from '../theme/theme'
import type { WorkspaceLayoutPreference } from '../workspace/workspaceLayout'

export const PREFERENCES_SCHEMA_VERSION = 1

export type AppPreferences = {
  theme: ThemePreference
  workspaceLayout: WorkspaceLayoutPreference
}

export type PreferencesResource = PreferencesResourceDto

export type PreferenceMutation =
  | { field: 'theme', value: ThemePreference }
  | { field: 'workspace_layout', value: WorkspaceLayoutPreference }

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'system',
  workspaceLayout: 'single',
}

export const readCachedPreferences = (): AppPreferences => ({
  theme: readThemePreference(),
  workspaceLayout: readWorkspaceLayoutPreference(),
})

export const writeCachedPreferences = (preferences: AppPreferences): void => {
  writeThemePreference(preferences.theme)
  writeWorkspaceLayoutPreference(preferences.workspaceLayout)
}

export const resolvePreferencesDocument = (
  document: Record<string, unknown> | null
): { preferences: AppPreferences, loadError: string | null } => {
  if (document === null) return { preferences: DEFAULT_PREFERENCES, loadError: null }

  const invalidFields: string[] = []
  const theme = isThemePreference(document.theme)
    ? document.theme
    : DEFAULT_PREFERENCES.theme
  if (document.theme !== undefined && !isThemePreference(document.theme)) {
    invalidFields.push('theme')
  }

  const workspaceLayout = isWorkspaceLayoutPreference(document.workspace_layout)
    ? document.workspace_layout
    : DEFAULT_PREFERENCES.workspaceLayout
  if (
    document.workspace_layout !== undefined &&
    !isWorkspaceLayoutPreference(document.workspace_layout)
  ) {
    invalidFields.push('workspace_layout')
  }

  return {
    preferences: { theme, workspaceLayout },
    loadError: invalidFields.length > 0
      ? `Stored preferences contain invalid ${invalidFields.join(' and ')} values; defaults are in use.`
      : null,
  }
}

export const applyPreferenceMutation = (
  document: Record<string, unknown> | null,
  mutation: PreferenceMutation
): Record<string, unknown> => {
  const next = { ...(document ?? {}) }
  const schemaVersion = next.schema_version
  if (
    typeof schemaVersion !== 'number' ||
    !Number.isInteger(schemaVersion) ||
    schemaVersion <= PREFERENCES_SCHEMA_VERSION
  ) {
    next.schema_version = PREFERENCES_SCHEMA_VERSION
  }
  next[mutation.field] = mutation.value
  return next
}

export const applyPreferencePatch = (
  preferences: AppPreferences,
  mutation: PreferenceMutation
): AppPreferences => mutation.field === 'theme'
  ? { ...preferences, theme: mutation.value }
  : { ...preferences, workspaceLayout: mutation.value }
