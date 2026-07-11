import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CommandReferenceSection } from './CommandReferenceSection'
import type { CommandReferenceEntry } from '../../domain/models'

const commands: CommandReferenceEntry[] = [
  {
    id: 'set velocity',
    signature: 'set velocity <amount>',
    keywords: ['volume'],
    description: 'Set the selected note velocity.',
    targetRequirement: 'element',
    acceptsPatternPrefix: true,
    arguments: [{
      kind: 'number',
      displayName: 'amount',
      required: true,
      defaultValue: null,
      constraints: [{ kind: 'range', minimum: 0, maximum: 1, values: [] }],
    }],
  },
  {
    id: 'transport stop',
    signature: 'transport stop',
    keywords: ['playback'],
    description: 'Stop playback.',
    targetRequirement: 'none',
    acceptsPatternPrefix: false,
    arguments: [],
  },
]

describe('CommandReferenceSection', () => {
  it('filters commands by catalog metadata and clears the search', async () => {
    const user = userEvent.setup()
    render(<CommandReferenceSection commands={commands} />)

    const search = screen.getByRole('searchbox', { name: 'Search commands' })
    await user.type(search, 'playback')

    expect(screen.getByText('transport stop')).toBeInTheDocument()
    expect(screen.queryByText('set velocity <amount>')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear command search' }))
    expect(search).toHaveValue('')
    expect(screen.getByText('set velocity <amount>')).toBeInTheDocument()
  })

  it('renders argument constraints for expanded command details', async () => {
    const user = userEvent.setup()
    render(<CommandReferenceSection commands={commands} />)

    await user.click(screen.getByText('set velocity <amount>'))

    expect(screen.getByText('range · min 0 · max 1')).toBeVisible()
    expect(screen.getByText('Element')).toBeVisible()
  })
})
