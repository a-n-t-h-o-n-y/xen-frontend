import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFERENCES,
  applyPreferenceMutation,
  readCachedPreferences,
  resolvePreferencesDocument,
  writeCachedPreferences,
} from './preferences'

describe('preferences document', () => {
  beforeEach(() => window.localStorage.clear())

  it('uses defaults for missing and invalid recognized fields', () => {
    expect(resolvePreferencesDocument(null)).toEqual({
      preferences: DEFAULT_PREFERENCES,
      loadError: null,
    })
    const invalid = resolvePreferencesDocument({ theme: 'sepia', workspace_layout: 2 })
    expect(invalid.preferences).toEqual(DEFAULT_PREFERENCES)
    expect(invalid.loadError).toContain('theme and workspace_layout')
  })

  it('updates one field while preserving unknown data and future schemas', () => {
    const future = {
      schema_version: 912,
      workspace_layout: 'dual',
      future: { enabled: true, arguments: [1, 'two'] },
    }
    expect(applyPreferenceMutation(future, { field: 'theme', value: 'dark' })).toEqual({
      ...future,
      theme: 'dark',
    })
    expect(applyPreferenceMutation({ legacy: true }, {
      field: 'workspace_layout',
      value: 'dual',
    })).toEqual({
      schema_version: 1,
      legacy: true,
      workspace_layout: 'dual',
    })
  })

  it('round trips recognized values through the startup cache', () => {
    writeCachedPreferences({ theme: 'dark', workspaceLayout: 'dual' })
    expect(readCachedPreferences()).toEqual({ theme: 'dark', workspaceLayout: 'dual' })
  })
})
