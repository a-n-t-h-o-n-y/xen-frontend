import { useEffect, useMemo, useRef } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import {
  analyzeCommandCompletion,
  applyCommandCompletion,
  getVisibleCompletionMode,
  type CompletionMode,
} from '../domain/commandCompletion'
import type { CommandReferenceEntry, InputMode, MessageLevel, StatusCellMetaItem } from '../shared'

type StatusSectionProps = {
  currentInputMode: InputMode
  currentInputModeLetter: string
  isCommandMode: boolean
  submitCommand: (event: FormEvent<HTMLFormElement>) => void
  commandInputRef: { current: HTMLInputElement | null }
  commandText: string
  setCommandText: Dispatch<SetStateAction<string>>
  historyIndex: number
  setHistoryIndex: Dispatch<SetStateAction<number>>
  closeCommandMode: (options?: { preserveText?: boolean }) => void
  commandHistory: string[]
  liveCommandBufferRef: { current: string }
  commands: CommandReferenceEntry[]
  completionMode: CompletionMode
  setCompletionMode: Dispatch<SetStateAction<CompletionMode>>
  isCompletionDismissed: boolean
  setIsCompletionDismissed: Dispatch<SetStateAction<boolean>>
  selectedCompletionIndex: number
  setSelectedCompletionIndex: Dispatch<SetStateAction<number>>
  isCompletionNavigationActive: boolean
  setIsCompletionNavigationActive: Dispatch<SetStateAction<boolean>>
  isHistoryNavigationFrozen: boolean
  setIsHistoryNavigationFrozen: Dispatch<SetStateAction<boolean>>
  recentCommandIds: string[]
  setRecentCommandIds: Dispatch<SetStateAction<string[]>>
  statusLevel: MessageLevel
  statusMessage: string
  selectedCellMeta: StatusCellMetaItem[]
  onOpenSettings: () => void
}

export function StatusSection({
  currentInputMode,
  currentInputModeLetter,
  isCommandMode,
  submitCommand,
  commandInputRef,
  commandText,
  setCommandText,
  historyIndex,
  setHistoryIndex,
  closeCommandMode,
  commandHistory,
  liveCommandBufferRef,
  commands,
  completionMode,
  setCompletionMode,
  isCompletionDismissed,
  setIsCompletionDismissed,
  selectedCompletionIndex,
  setSelectedCompletionIndex,
  isCompletionNavigationActive,
  setIsCompletionNavigationActive,
  isHistoryNavigationFrozen,
  setIsHistoryNavigationFrozen,
  recentCommandIds,
  setRecentCommandIds,
  statusLevel,
  statusMessage,
  selectedCellMeta,
  onOpenSettings,
}: StatusSectionProps) {
  const activeCompletionRowRef = useRef<HTMLButtonElement | null>(null)
  const completion = useMemo(
    () => analyzeCommandCompletion(commandText, commands, recentCommandIds),
    [commandText, commands, recentCommandIds]
  )
  const isEmptyCompletionQuery = completion.segment.commandText.trim().length === 0
  const isPopupVisible = isCommandMode &&
    !isCompletionDismissed &&
    !isHistoryNavigationFrozen &&
    completion.mode === 'commandSearch' &&
    completion.candidates.length > 0
  const visibleCandidates = isEmptyCompletionQuery
    ? completion.candidates
    : completion.candidates.slice(0, 8)
  const selectedCandidate = visibleCandidates[selectedCompletionIndex] ?? visibleCandidates[0]
  const isGhostVisible = isCommandMode &&
    !isCompletionDismissed &&
    !isHistoryNavigationFrozen &&
    completion.mode === 'argumentAssist' &&
    completion.argumentPlaceholders.length > 0

  useEffect(() => {
    setCompletionMode(getVisibleCompletionMode(
      isCommandMode,
      isCompletionDismissed,
      isHistoryNavigationFrozen,
      completion.mode
    ))
  }, [
    completion.mode,
    isCommandMode,
    isCompletionDismissed,
    isHistoryNavigationFrozen,
    setCompletionMode,
  ])

  useEffect(() => {
    setSelectedCompletionIndex((current) => {
      if (visibleCandidates.length === 0) return 0
      return Math.min(current, visibleCandidates.length - 1)
    })
  }, [setSelectedCompletionIndex, visibleCandidates.length])

  useEffect(() => {
    if (!isPopupVisible || !isCompletionNavigationActive) return

    activeCompletionRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [isCompletionNavigationActive, isPopupVisible, selectedCompletionIndex])

  const acceptCompletion = (candidate = selectedCandidate): void => {
    if (!candidate) return

    const nextText = applyCommandCompletion(commandText, completion.segment, candidate.command)
    setCommandText(nextText)
    liveCommandBufferRef.current = nextText
    setRecentCommandIds((previous) => [
      candidate.command.id,
      ...previous.filter((id) => id !== candidate.command.id),
    ].slice(0, 20))
    setSelectedCompletionIndex(0)
    setIsCompletionDismissed(false)
    setIsCompletionNavigationActive(false)
    setIsHistoryNavigationFrozen(false)
  }

  const navigateCompletion = (direction: 1 | -1): void => {
    if (!isPopupVisible) return

    setSelectedCompletionIndex((current) => {
      const count = visibleCandidates.length
      return (current + direction + count) % count
    })
    setIsCompletionNavigationActive(true)
  }

  return (
    <footer className="statusBarShell">
      {isPopupVisible ? (
        <div className="commandCompletionPopup" role="listbox" aria-label="Command completions">
          <div className="commandCompletionList">
            {visibleCandidates.map((candidate, index) => (
              <button
                type="button"
                key={candidate.command.id}
                ref={index === selectedCompletionIndex ? activeCompletionRowRef : null}
                className={`commandCompletionRow${index === selectedCompletionIndex ? ' commandCompletionRow-active' : ''}`}
                role="option"
                aria-selected={index === selectedCompletionIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => acceptCompletion(candidate)}
              >
                <span className="commandCompletionMarker mono">
                  {candidate.command.acceptsPatternPrefix ? '# ' : ''}
                </span>
                <span className="commandCompletionName mono">{candidate.command.id}</span>
                <span className="commandCompletionSignature mono">
                  {candidate.signature.slice(candidate.command.id.length).trim()}
                </span>
              </button>
            ))}
          </div>
          {selectedCandidate ? (
            <div className="commandCompletionDetail">{selectedCandidate.command.description}</div>
          ) : null}
        </div>
      ) : null}
      <div className="statusBar">
      <div className="statusLeft">
        <span className="modeBadge mono" aria-label={`Input mode ${currentInputMode}`}>
          {currentInputModeLetter}
        </span>
        <button
          type="button"
          className="statusSettingsButton"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </div>
      {isCommandMode ? (
        <form className="statusCommandForm" onSubmit={submitCommand}>
          <span className="statusPrompt mono">:</span>
          <div className="statusCommandField">
            <input
              ref={commandInputRef}
              className="statusCommandInput mono"
              type="text"
              value={commandText}
              onChange={(event) => {
                const nextValue = event.target.value
                if (historyIndex !== -1) {
                  setHistoryIndex(-1)
                }
                setIsHistoryNavigationFrozen(false)
                setIsCompletionDismissed(false)
                setIsCompletionNavigationActive(false)
                setSelectedCompletionIndex(0)
                setCommandText(nextValue)
                liveCommandBufferRef.current = nextValue
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  if (completionMode !== 'none' && !isCompletionDismissed) {
                    setIsCompletionDismissed(true)
                    setIsCompletionNavigationActive(false)
                    return
                  }
                  closeCommandMode({ preserveText: true })
                  return
                }

                if (event.key === 'Tab') {
                  if (isPopupVisible && selectedCandidate) {
                    event.preventDefault()
                    acceptCompletion(selectedCandidate)
                  }
                  return
                }

                if (event.key === 'Enter' && isPopupVisible && selectedCandidate) {
                  event.preventDefault()
                  acceptCompletion(selectedCandidate)
                  return
                }

                if (event.key === 'ArrowDown' && isPopupVisible) {
                  event.preventDefault()
                  navigateCompletion(1)
                  return
                }

                if (event.key === 'ArrowUp' && isPopupVisible) {
                  event.preventDefault()
                  navigateCompletion(-1)
                  return
                }

                if (event.ctrlKey && event.key.toLowerCase() === 'n') {
                  if (isPopupVisible) {
                    event.preventDefault()
                    navigateCompletion(1)
                  }
                  return
                }

                if (event.ctrlKey && event.key.toLowerCase() === 'p') {
                  if (isPopupVisible) {
                    event.preventDefault()
                    navigateCompletion(-1)
                  }
                  return
                }

                if (event.key === 'Backspace' && commandText.length === 0) {
                  event.preventDefault()
                  closeCommandMode({ preserveText: true })
                  return
                }

                if (event.key === 'ArrowUp') {
                  if (commandHistory.length === 0) {
                    return
                  }

                  event.preventDefault()

                  if (historyIndex === -1) {
                    liveCommandBufferRef.current = commandText
                    setHistoryIndex(0)
                    setCommandText(commandHistory[0])
                    setIsHistoryNavigationFrozen(true)
                    setIsCompletionDismissed(true)
                    return
                  }

                  const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
                  setHistoryIndex(nextIndex)
                  setCommandText(commandHistory[nextIndex])
                  setIsHistoryNavigationFrozen(true)
                  setIsCompletionDismissed(true)
                  return
                }

                if (event.key === 'ArrowDown') {
                  if (commandHistory.length === 0 || historyIndex === -1) {
                    return
                  }

                  event.preventDefault()

                  if (historyIndex === 0) {
                    setHistoryIndex(-1)
                    setCommandText(liveCommandBufferRef.current)
                    setIsHistoryNavigationFrozen(true)
                    setIsCompletionDismissed(true)
                    return
                  }

                  const nextIndex = historyIndex - 1
                  setHistoryIndex(nextIndex)
                  setCommandText(commandHistory[nextIndex])
                  setIsHistoryNavigationFrozen(true)
                  setIsCompletionDismissed(true)
                }
              }}
              onBlur={() => closeCommandMode({ preserveText: true })}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-label="Command input"
            />
            {isGhostVisible ? (
              <span className="statusCommandGhost mono" aria-hidden="true">
                <span className="statusCommandGhostMirror">{commandText}</span>
                {completion.argumentPlaceholders.map((placeholder) => (
                  <span className="statusCommandGhostArgument" key={placeholder.displayName}>
                    {placeholder.text}
                  </span>
                ))}
              </span>
            ) : null}
          </div>
        </form>
      ) : (
        <span className={`statusText status-${statusLevel}`}>{statusMessage}</span>
      )}
      {selectedCellMeta.length > 0 ? (
        <div className="statusMeta mono" aria-label="Selected cell metadata">
          {selectedCellMeta.map((item) => (
            <span key={`cell-meta-${item.label}`} className="statusMetaItem">
              <span className="statusMetaKey">{item.label}</span>
              <span className="statusMetaValue">{item.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      </div>
    </footer>
  )
}
