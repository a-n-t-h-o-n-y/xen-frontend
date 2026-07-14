import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { projectFromDto } from '../domain/mappers'
import { projectFixture } from '../domain/testFixtures'
import { ProjectDocumentMenu } from './ProjectDocumentMenu'

const callbacks = () => ({
  onNewProject: vi.fn().mockResolvedValue(undefined),
  onSaveProject: vi.fn().mockResolvedValue(undefined),
  onSaveProjectAs: vi.fn().mockResolvedValue(undefined),
  onSaveCell: vi.fn().mockResolvedValue(undefined),
  onRestoreRecovery: vi.fn().mockResolvedValue(undefined),
  onDiscardRecovery: vi.fn().mockResolvedValue(undefined),
})

describe('ProjectDocumentMenu', () => {
  it('shows backend-owned document identity, dirty state, and persistence actions', async () => {
    const user = userEvent.setup()
    const handlers = callbacks()
    const fixture = projectFixture()
    fixture.document.dirty = true
    render(
      <ProjectDocumentMenu
        project={projectFromDto(fixture)}
        busy={false}
        disabledReason={null}
        {...handlers}
      />
    )

    expect(screen.getByRole('button', { name: 'Project actions for song' }))
      .toHaveTextContent('song')
    expect(screen.getByLabelText('Unsaved changes')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(handlers.onSaveProject).toHaveBeenCalledOnce()
  })

  it('exposes explicit recovery restore and discard choices', async () => {
    const user = userEvent.setup()
    const handlers = callbacks()
    const fixture = projectFixture()
    fixture.recovery = {
      revision: '22',
      saved_at_unix_ms: '18446744073709551615',
      relative_path: 'song.xenproj',
      project_revision: '2',
    }
    render(
      <ProjectDocumentMenu
        project={projectFromDto(fixture)}
        busy={false}
        disabledReason={null}
        {...handlers}
      />
    )

    expect(screen.getByText('A recovery copy is available.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Restore' }))
    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(handlers.onRestoreRecovery).toHaveBeenCalledOnce()
    expect(handlers.onDiscardRecovery).toHaveBeenCalledOnce()
  })

  it('blocks document actions while a preview is active', () => {
    const fixture = projectFixture()
    fixture.preview_active = true
    fixture.document.dirty = true
    render(
      <ProjectDocumentMenu
        project={projectFromDto(fixture)}
        busy={false}
        disabledReason={null}
        {...callbacks()}
      />
    )

    expect(screen.getByRole('button', { name: 'New project' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByText(/finish the active preview/i)).toBeInTheDocument()
  })
})
