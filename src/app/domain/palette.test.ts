import { describe, expect, it } from 'vitest'
import {
  buildCommandInvocationItems,
  buildPaletteItems,
  commandInvocationItemId,
  consumePaletteScopePrefix,
  getPaletteSections,
  rankPaletteItems,
} from './palette'
import { libraryFromDto } from './mappers'
import { buildSessionReference } from './reference'
import { libraryFixture } from './testFixtures'

const commands = buildSessionReference({
  schema_version: 5,
  commands: [
    {
      path: ['transport', 'stop'],
      keywords: ['pause'],
      accepts_pattern_prefix: false,
      target_requirement: 'none',
      arguments: [],
      description: 'Stop playback',
    },
    {
      path: ['set', 'velocity'],
      keywords: ['volume'],
      accepts_pattern_prefix: true,
      target_requirement: 'element',
      arguments: [{
        kind: 'decimal',
        display_name: 'amount',
        required: true,
        default_value: null,
        constraints: [],
      }],
      description: 'Set note velocity',
    },
  ],
}).commands

const createItems = () => {
  const fixture = libraryFixture()
  fixture.tunings.push({
    name: 'systems/19edo.scl',
    stem: 'systems/19edo',
    relative_path: 'systems/19edo.scl',
    file_revision: 'sha256:19edo',
    command: 'set tuning "systems/19edo.scl"',
    description: 'Nineteen equal divisions',
    intervals: Array.from({ length: 19 }, (_, index) => index * 1200 / 19),
    octave: 1200,
    note_count: 19,
  })
  return buildPaletteItems({
    commands,
    library: libraryFromDto(fixture),
    activeTuningName: 'systems/19edo',
    activeScaleId: 'scale:major',
  })
}

describe('quick access palette domain', () => {
  it('adapts actionable resources while excluding chords', () => {
    const items = createItems()

    expect(items.filter((item) => item.kind === 'command')).toHaveLength(2)
    expect(items.find((item) => item.kind === 'file')).toMatchObject({
      fileKind: 'cell',
      label: 'sequence',
    })
    expect(items.find((item) => item.kind === 'file' && item.fileKind === 'project'))
      .toMatchObject({
        label: 'song',
        relativePath: 'song.xenproj',
      })
    expect(items.find((item) => item.kind === 'tuning')).toMatchObject({
      label: '19edo',
      active: true,
    })
    expect(items.find((item) => item.id === 'scale:scale:major')).toMatchObject({ active: true })
    expect(items.some((item) => item.label === 'major' && item.kind !== 'scale')).toBe(false)
  })

  it('ranks across metadata and boosts recent matches', () => {
    const items = createItems()
    const tuning = items.find((item) => item.kind === 'tuning')!
    const results = rankPaletteItems(items, 'nineteen', [tuning.id])

    expect(results[0]).toBe(tuning)
    expect(rankPaletteItems(items, 'ts')[0]?.id).toBe('command:transport stop')
    expect(rankPaletteItems(items, 'velocitty')[0]?.id).toBe('command:set velocity')
  })

  it('builds bounded all-scope sections and consumes scope prefixes', () => {
    const items = createItems()
    const recentId = items.find((item) => item.kind === 'file')!.id
    const sections = getPaletteSections(items, 'all', '', [recentId])

    expect(sections[0]).toMatchObject({ id: 'recent', items: [{ id: recentId }] })
    expect(sections[1]).toMatchObject({ id: 'suggested' })
    expect(sections[0]!.items.length + sections[1]!.items.length).toBeLessThanOrEqual(6)
    expect(sections[1]!.items.length).toBeGreaterThan(0)
    expect(consumePaletteScopePrefix('> set vel')).toEqual({
      scope: 'commands',
      query: 'set vel',
    })
    expect(consumePaletteScopePrefix(' tuning:  edo')).toEqual({
      scope: 'tunings',
      query: 'edo',
    })
  })

  it('represents exact command invocations as rerunnable recent items', () => {
    const id = commandInvocationItemId('set velocity 0.75')
    const invocationItems = buildCommandInvocationItems([id])
    const sections = getPaletteSections(
      [...createItems(), ...invocationItems],
      'all',
      '',
      [id]
    )

    expect(sections[0]).toMatchObject({
      id: 'recent',
      items: [{
        id,
        kind: 'commandInvocation',
        label: 'set velocity 0.75',
        backendCommand: 'set velocity 0.75',
      }],
    })
  })

  it('shows diverse suggestions when there is no recent history', () => {
    const sections = getPaletteSections(createItems(), 'all', '', [])
    const suggested = sections.find((section) => section.id === 'suggested')

    expect(sections.some((section) => section.id === 'recent')).toBe(false)
    expect(suggested?.items.length).toBeGreaterThan(0)
    expect(suggested?.items.length).toBeLessThanOrEqual(6)
    expect(new Set(suggested?.items.map((item) => item.kind)).size).toBeGreaterThan(2)
  })
})
