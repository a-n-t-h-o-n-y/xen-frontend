import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatusSection } from './StatusSection'

describe('StatusSection', () => {
  it('renders status and selection metadata without a command input', () => {
    render(
      <StatusSection
        currentInputMode="pitch"
        currentInputModeLetter="P"
        workspaceView="sequencer"
        setWorkspaceView={vi.fn()}
        isModulatorMode={false}
        setIsModulatorMode={vi.fn()}
        statusLevel="info"
        statusMessage="Project loaded"
        selectedCellMeta={[{ label: 'weight', value: '1' }]}
        workspaceDisabled={false}
        modulatorDisabled={false}
        onOpenSettings={vi.fn()}
        modulatorRail={null}
      />
    )

    expect(screen.getByText('Project loaded')).toBeInTheDocument()
    expect(screen.getByLabelText('Selected cell metadata')).toHaveTextContent('weight1')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
