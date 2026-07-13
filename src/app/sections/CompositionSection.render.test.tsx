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
    expect(empty.style.width).toBe('')
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
