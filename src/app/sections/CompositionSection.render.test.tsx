import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { projectFromDto } from '../domain/mappers'
import { arrangedProjectFixture } from '../domain/testFixtures'
import { CompositionSection } from './CompositionSection'
import type { ComponentProps } from 'react'

const createProps = (
  overrides: Partial<ComponentProps<typeof CompositionSection>> = {}
): ComponentProps<typeof CompositionSection> => {
  const project = projectFromDto(arrangedProjectFixture())
  if (!project.composition) throw new Error('Expected composition fixture')

  return {
    composition: project.composition,
    sequenceBank: project.sequenceBank,
    selection: { rowCoordinate: 3, columnCoordinate: 1 },
    tuningLength: 12,
    editTarget: null,
    onCancelEdit: vi.fn(),
    onCommitCellName: vi.fn(),
    onCommitRowName: vi.fn(),
    onCommitRowChannel: vi.fn(),
    ...overrides,
  }
}

describe('CompositionSection rendering', () => {
  it('uses a locked row rail and keeps the sparse grid free of pointer controls', () => {
    const { container } = render(<CompositionSection {...createProps()} />)

    expect(container.querySelector('.compositionRowRail')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText(/double-click assigns/i)).not.toBeInTheDocument()

    const materializedRow = screen.getByRole('rowheader', {
      name: 'Row +3, channel-1, channel channel-1',
    })
    expect(materializedRow).toHaveTextContent('channel-1')
    expect(materializedRow).not.toHaveTextContent('+3')
    const virtualRow = screen.getByRole('rowheader', { name: 'Row +2, virtual' })
    expect(virtualRow).toBeEmptyDOMElement()

    const populated = screen.getByRole('gridcell', {
      name: 'Row +3, column 0: S1',
    })
    expect(populated).toHaveClass('compositionCell-loop')
    expect(populated).not.toHaveAttribute('draggable')

    const empty = screen.getByRole('gridcell', {
      name: 'Row +3, column +1: Empty',
    })
    expect(empty).toHaveClass('compositionCell-empty')
    expect(empty).not.toHaveClass('compositionCell-loop')
    expect(empty).toBeEmptyDOMElement()
  })

  it('sizes column tracks from their musical durations', () => {
    const { container } = render(<CompositionSection {...createProps({
      selection: { rowCoordinate: 3, columnCoordinate: -4 },
    })} />)
    const world = container.querySelector<HTMLElement>('.compositionWorld')
    const tracks = world?.style.getPropertyValue('--composition-column-tracks') ?? ''

    expect(tracks).toContain('calc(var(--composition-beat-width) * 3.5)')
    expect(tracks).toContain('calc(var(--composition-beat-width) * 4)')
  })

  it('keeps keyboard-triggered cell assignment editable', async () => {
    const onCommitCellName = vi.fn()
    const onCancelEdit = vi.fn()
    render(<CompositionSection {...createProps({
      editTarget: { kind: 'cell', rowCoordinate: 3, columnCoordinate: 1 },
      onCommitCellName,
      onCancelEdit,
    })} />)
    const input = screen.getByRole('textbox', {
      name: 'Assign sequence at row +3, column +1',
    })

    await waitFor(() => expect(input).toHaveFocus())
    fireEvent.change(input, { target: { value: 'Verse' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onCommitCellName).toHaveBeenCalledWith(3, 1, 'Verse')
    expect(onCancelEdit).not.toHaveBeenCalled()
  })

  it('keeps keyboard-triggered row metadata editing available', async () => {
    const onCommitRowName = vi.fn()
    render(<CompositionSection {...createProps({
      editTarget: { kind: 'rowName', rowCoordinate: 3 },
      onCommitRowName,
    })} />)
    const input = screen.getByRole('textbox', { name: 'Rename row +3' })

    await waitFor(() => expect(input).toHaveFocus())
    fireEvent.change(input, { target: { value: 'Lead' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onCommitRowName).toHaveBeenCalledWith(3, 'Lead')
  })
})
