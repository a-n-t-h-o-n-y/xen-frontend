import { describe, expect, it } from 'vitest'
import { libraryFromDto, projectFromDto } from './mappers'
import { compareDecimalRevisions, ingestLibrarySnapshot, ingestProjectSnapshot } from './resources'
import { libraryFixture, projectFixture } from './testFixtures'

describe('revision ingestion', () => {
  it('orders decimal revision strings without numeric coercion', () => {
    expect(compareDecimalRevisions('10', '9')).toBeGreaterThan(0)
    expect(compareDecimalRevisions('18446744073709551616', '18446744073709551615'))
      .toBeGreaterThan(0)
    expect(compareDecimalRevisions('0007', '7')).toBe(0)
  })

  it('installs first and newer projects while ignoring older and equal revisions', () => {
    const selection = { path: [{ kind: 'element' as const, index: 0 }] }
    const first = ingestProjectSnapshot(null, projectFromDto(projectFixture(2)), selection)
    expect(first.installed).toBe(true)
    expect(ingestProjectSnapshot(first.snapshot, projectFromDto(projectFixture(1)), selection).installed)
      .toBe(false)
    expect(ingestProjectSnapshot(first.snapshot, projectFromDto(projectFixture(2)), selection).installed)
      .toBe(false)
    expect(ingestProjectSnapshot(first.snapshot, projectFromDto(projectFixture(3)), selection).installed)
      .toBe(true)
  })

  it('uses state revision for preview and document-only changes', () => {
    const selection = { path: [] }
    const first = projectFromDto(projectFixture(2))
    const preview = { ...first, stateRevision: '3', previewActive: true }

    expect(ingestProjectSnapshot(first, preview, selection).installed).toBe(true)
    expect(ingestProjectSnapshot(preview, preview, selection).installed).toBe(false)
  })

  it('reconciles invalid selections and tracks library revisions independently', () => {
    const invalid = { path: [{ kind: 'element' as const, index: 99 }] }
    expect(ingestProjectSnapshot(null, projectFromDto(projectFixture()), invalid).selection)
      .toEqual({ path: [] })
    const project = projectFromDto(projectFixture(9))
    const library = libraryFromDto(libraryFixture(2))
    expect(ingestLibrarySnapshot(null, library).installed).toBe(true)
    expect(ingestLibrarySnapshot(library, libraryFromDto(libraryFixture(1))).installed).toBe(false)
    expect(project.projectRevision).toBe('9')
  })
})
