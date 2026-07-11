import { describe, expect, it } from 'vitest'
import { libraryFromDto, projectFromDto } from './mappers'
import { ingestLibrarySnapshot, ingestProjectSnapshot } from './resources'
import { libraryFixture, projectFixture } from './testFixtures'

describe('revision ingestion', () => {
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

  it('reconciles invalid selections and tracks library revisions independently', () => {
    const invalid = { path: [{ kind: 'element' as const, index: 99 }] }
    expect(ingestProjectSnapshot(null, projectFromDto(projectFixture()), invalid).selection)
      .toEqual({ path: [] })
    const project = projectFromDto(projectFixture(9))
    const library = libraryFromDto(libraryFixture(2))
    expect(ingestLibrarySnapshot(null, library).installed).toBe(true)
    expect(ingestLibrarySnapshot(library, libraryFromDto(libraryFixture(1))).installed).toBe(false)
    expect(project.revision).toBe(9)
  })
})

