import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useQuickAccessPalette } from '../hooks/useQuickAccessPalette'
import { QuickAccessPalette } from './QuickAccessPalette'
import { libraryFromDto } from '../domain/mappers'
import { buildSessionReference } from '../domain/reference'
import { libraryFixture } from '../domain/testFixtures'
import { defaultKeymapDocument } from '../domain/defaultKeymap'
import type { KeymapResource } from '../domain/models'

const commands = buildSessionReference({
  schema_version: 3,
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
    {
      path: ['set', 'translateDirection'],
      keywords: [],
      accepts_pattern_prefix: false,
      target_requirement: 'none',
      arguments: [{
        kind: 'translate_direction',
        display_name: 'direction',
        required: true,
        default_value: null,
        constraints: [{
          kind: 'one_of',
          minimum: null,
          maximum: null,
          values: ['up', 'down'],
        }],
      }],
      description: 'Set scale translate direction',
    },
    {
      path: ['chord'],
      keywords: [],
      accepts_pattern_prefix: false,
      target_requirement: 'cell',
      arguments: [{
        kind: 'chord_name',
        display_name: 'chord',
        required: false,
        default_value: '"cycle"',
        constraints: [],
      }, {
        kind: 'chord_inversion',
        display_name: 'inversion',
        required: false,
        default_value: '-1',
        constraints: [],
      }],
      description: 'Apply a chord',
    },
  ],
}).commands

const library = libraryFromDto(libraryFixture())
const keymapResource: KeymapResource = {
  revision: '0',
  keySemantics: 'KeyboardEvent.key-or-code',
  bindings: defaultKeymapDocument.bindings,
  document: defaultKeymapDocument,
  source: 'default',
  loadError: null,
}

function PaletteHarness({
  execute = vi.fn().mockResolvedValue(undefined),
  keymap = keymapResource,
}: {
  execute?: (command: string) => Promise<void>
  keymap?: KeymapResource
}) {
  const controller = useQuickAccessPalette({
    commands,
    executeBackendCommand: execute,
    setStatusMessage: vi.fn(),
    setStatusLevel: vi.fn(),
  })
  return (
    <>
      <button type="button" onClick={() => controller.open('all')}>Open all</button>
      <button type="button" onClick={() => controller.open('commands')}>Open commands</button>
      <QuickAccessPalette
        controller={controller}
        commands={commands}
        librarySnapshot={library}
        activeTuningName="12EDO"
        activeScaleId="scale:major"
        sequenceBank={null}
        keymapResource={keymap}
        currentInputMode="pitch"
      />
    </>
  )
}

describe('QuickAccessPalette', () => {
  it('opens all resources, consumes scope prefixes, and excludes chords', async () => {
    const user = userEvent.setup()
    render(<PaletteHarness />)

    await user.click(screen.getByRole('button', { name: 'Open all' }))
    const input = screen.getByRole('combobox')
    expect(input).toHaveFocus()
    expect(screen.getByRole('option', { name: /Sequence: sequence/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Project: song/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /major \[4, 3\]/i })).not.toBeInTheDocument()

    await user.type(input, 'scale: major')
    expect(screen.getByRole('button', { name: 'Scales' })).toHaveAttribute('aria-pressed', 'true')
    expect(input).toHaveValue('major')
    expect(screen.getByRole('option', { name: /Scale: major/i })).toBeInTheDocument()
  })

  it('opens project documents with the backend-provided project command', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<PaletteHarness execute={execute} />)

    await user.click(screen.getByRole('button', { name: 'Open all' }))
    await user.click(screen.getByRole('option', { name: /Project: song/i }))

    await waitFor(() => expect(execute).toHaveBeenCalledWith('project open "song"'))
  })

  it('executes a zero-argument command directly', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<PaletteHarness execute={execute} />)

    await user.click(screen.getByRole('button', { name: 'Open commands' }))
    await user.type(screen.getByRole('combobox'), 'transport st')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(execute).toHaveBeenCalledWith('transport stop'))
    expect(screen.queryByRole('dialog', { name: 'Quick access' })).not.toBeInTheDocument()
  })

  it('offers exact successful command invocations on the empty home state', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<PaletteHarness execute={execute} />)

    await user.click(screen.getByRole('button', { name: 'Open commands' }))
    const input = screen.getByRole('combobox')
    await user.type(input, 'set velocity 0.75')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(execute).toHaveBeenCalledWith('set velocity 0.75'))

    await user.click(screen.getByRole('button', { name: 'Open commands' }))
    expect(screen.getByRole('heading', { name: 'Recent' })).toBeInTheDocument()
    await user.click(screen.getByRole('option', {
      name: /Command: set velocity 0\.75\. Run this command again/i,
    }))

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2))
    expect(execute).toHaveBeenLastCalledWith('set velocity 0.75')
  })

  it('shows suggestions instead of an empty recent section without history', async () => {
    const user = userEvent.setup()
    render(<PaletteHarness />)

    await user.click(screen.getByRole('button', { name: 'Open all' }))

    expect(screen.queryByRole('heading', { name: 'Recent' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Suggested' })).toBeInTheDocument()
  })

  it('preserves command prefixes when smart-activating a completion', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<PaletteHarness execute={execute} />)

    await user.click(screen.getByRole('button', { name: 'Open commands' }))
    await user.type(screen.getByRole('combobox'), '+2 transport st')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(execute).toHaveBeenCalledWith('+2 transport stop'))
  })

  it('enters command editing for commands with arguments and submits the completed text', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<PaletteHarness execute={execute} />)

    await user.click(screen.getByRole('button', { name: 'Open commands' }))
    const input = screen.getByRole('combobox')
    await user.type(input, 'set v')
    await user.keyboard('{Enter}')

    expect(input).toHaveValue('set velocity ')
    expect(screen.getByLabelText('Command arguments')).toHaveTextContent('amount: decimal')
    await user.type(input, '0.75')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(execute).toHaveBeenCalledWith('set velocity 0.75'))
  })

  it('keeps failed actions open with an inline error', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('native rejected it'))
    const user = userEvent.setup()
    render(<PaletteHarness execute={execute} />)

    await user.click(screen.getByRole('button', { name: 'Open all' }))
    await user.click(screen.getByRole('option', { name: /Sequence: sequence/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('native rejected it')
    expect(screen.getByRole('dialog', { name: 'Quick access' })).toBeInTheDocument()
  })

  it('does not fall back to hardcoded command keys when a binding is deleted', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const bindings = structuredClone(defaultKeymapDocument.bindings)
    bindings['quick_access.command'] = bindings['quick_access.command']?.filter((binding) =>
      binding.trigger.match.value !== 'Enter'
    ) ?? []
    const keymap = {
      ...keymapResource,
      bindings,
      document: { schemaVersion: 2 as const, bindings },
    }
    const user = userEvent.setup()
    render(<PaletteHarness execute={execute} keymap={keymap} />)

    await user.click(screen.getByRole('button', { name: 'Open commands' }))
    await user.type(screen.getByRole('combobox'), 'transport stop')
    await user.keyboard('{Enter}')

    expect(execute).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Quick access' })).toBeInTheDocument()
  })

  it('filters and accepts one_of values before executing on a separate Enter', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<PaletteHarness execute={execute} />)

    await user.click(screen.getByRole('button', { name: 'Open commands' }))
    const input = screen.getByRole('combobox')
    await user.type(input, 'set trans')
    await user.keyboard('{Enter}')

    expect(input).toHaveValue('set translateDirection ')
    expect(screen.queryByRole('button', { name: 'Scales' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'up' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'down' })).toBeInTheDocument()

    await user.type(input, 'd')
    expect(screen.queryByRole('option', { name: 'up' })).not.toBeInTheDocument()
    await user.keyboard('{Enter}')

    expect(input).toHaveValue('set translateDirection down ')
    expect(execute).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(execute).toHaveBeenCalledWith('set translateDirection down'))
  })

  it('completes a runtime chord with Tab and advances to its defaulted inversion', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<PaletteHarness execute={execute} />)

    await user.click(screen.getByRole('button', { name: 'Open commands' }))
    const input = screen.getByRole('combobox')
    await user.type(input, 'cho')
    await user.keyboard('{Enter}')
    await user.type(input, 'maj')

    expect(screen.getByRole('option', { name: /major.*4 · 3/i })).toBeInTheDocument()
    await user.keyboard('{Tab}')
    expect(input).toHaveValue('chord major ')
    expect(screen.getByLabelText('Command arguments')).toHaveTextContent('inversion: chord_inversion = -1')

    await user.keyboard('{Enter}')
    await waitFor(() => expect(execute).toHaveBeenCalledWith('chord major'))
  })
})
