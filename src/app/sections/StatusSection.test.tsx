import { useRef, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StatusSection } from './StatusSection'
import type { CompletionMode } from '../domain/commandCompletion'
import type { CommandReferenceEntry } from '../domain/models'

const commands: CommandReferenceEntry[] = [{
  id: 'set velocity',
  signature: 'set velocity <amount>',
  keywords: ['volume'],
  description: 'Set velocity.',
  targetRequirement: 'element',
  acceptsPatternPrefix: true,
  arguments: [{
    kind: 'number',
    displayName: 'amount',
    required: true,
    defaultValue: null,
    constraints: [],
  }],
}]

function CommandHarness({
  initialCommandText = 'set v',
  submitCommand = vi.fn(),
}: {
  initialCommandText?: string
  submitCommand?: () => void
}) {
  const [commandText, setCommandText] = useState(initialCommandText)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [completionMode, setCompletionMode] = useState<CompletionMode>('commandSearch')
  const [isCompletionDismissed, setIsCompletionDismissed] = useState(false)
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0)
  const [isCompletionNavigationActive, setIsCompletionNavigationActive] = useState(false)
  const [isHistoryNavigationFrozen, setIsHistoryNavigationFrozen] = useState(false)
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([])
  const commandInputRef = useRef<HTMLInputElement>(null)
  const liveCommandBufferRef = useRef(commandText)

  return (
    <StatusSection
      currentInputMode="pitch"
      currentInputModeLetter="P"
      workspaceView="sequencer"
      setWorkspaceView={vi.fn()}
      isModulatorMode={false}
      setIsModulatorMode={vi.fn()}
      isCommandMode
      submitCommand={submitCommand}
      keymapResource={null}
      commandInputRef={commandInputRef}
      commandText={commandText}
      setCommandText={setCommandText}
      historyIndex={historyIndex}
      setHistoryIndex={setHistoryIndex}
      closeCommandMode={vi.fn()}
      commandHistory={[]}
      liveCommandBufferRef={liveCommandBufferRef}
      commands={commands}
      completionMode={completionMode}
      setCompletionMode={setCompletionMode}
      isCompletionDismissed={isCompletionDismissed}
      setIsCompletionDismissed={setIsCompletionDismissed}
      selectedCompletionIndex={selectedCompletionIndex}
      setSelectedCompletionIndex={setSelectedCompletionIndex}
      isCompletionNavigationActive={isCompletionNavigationActive}
      setIsCompletionNavigationActive={setIsCompletionNavigationActive}
      isHistoryNavigationFrozen={isHistoryNavigationFrozen}
      setIsHistoryNavigationFrozen={setIsHistoryNavigationFrozen}
      recentCommandIds={recentCommandIds}
      setRecentCommandIds={setRecentCommandIds}
      statusLevel="info"
      statusMessage=""
      selectedCellMeta={[]}
      commandDisabled={false}
      workspaceDisabled={false}
      modulatorDisabled={false}
      onOpenSettings={vi.fn()}
      modulatorRail={null}
    />
  )
}

describe('StatusSection command interactions', () => {
  it('accepts the selected completion with Tab', async () => {
    const user = userEvent.setup()
    render(<CommandHarness />)

    const input = screen.getByRole('textbox', { name: 'Command input' })
    await user.click(input)
    await user.keyboard('{Tab}')

    expect(input).toHaveValue('set velocity ')
    expect(screen.queryByRole('listbox', { name: 'Command completions' })).not.toBeInTheDocument()
  })

  it('submits command input with Enter', async () => {
    const user = userEvent.setup()
    const submitCommand = vi.fn()
    render(<CommandHarness initialCommandText="set velocity" submitCommand={submitCommand} />)

    await user.click(screen.getByRole('textbox', { name: 'Command input' }))
    await user.keyboard('{Enter}')

    expect(submitCommand).toHaveBeenCalledOnce()
  })
})
