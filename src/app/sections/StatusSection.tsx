import { useEffect, useMemo, useRef } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import {
  analyzeCommandCompletion,
  applyCommandCompletion,
  getVisibleCompletionMode,
  type CompletionMode,
} from '../domain/commandCompletion'
import { findKeymapBinding } from '../domain/keymap'
import {
  getCommandKeymapContext,
  isCommandUiActionId,
  runCommandUiAction,
} from '../domain/uiActions'
import type { CommandReferenceEntry, InputMode, KeymapResource, MessageLevel } from '../domain/models'
import type { StatusCellMetaItem } from '../presentation/viewModels'

type WorkspaceView = 'sequencer' | 'library'

type StatusSectionProps = {
  currentInputMode: InputMode
  currentInputModeLetter: string
  workspaceView: WorkspaceView
  setWorkspaceView: Dispatch<SetStateAction<WorkspaceView>>
  isModulatorMode: boolean
  setIsModulatorMode: Dispatch<SetStateAction<boolean>>
  isCommandMode: boolean
  submitCommand: () => void
  keymapResource: KeymapResource | null
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
  commandDisabled: boolean
  workspaceDisabled: boolean
  modulatorDisabled: boolean
  onOpenSettings: () => void
  modulatorRail: ReactNode
}

export function StatusSection({
  currentInputMode,
  currentInputModeLetter,
  workspaceView,
  setWorkspaceView,
  isModulatorMode,
  setIsModulatorMode,
  isCommandMode,
  submitCommand,
  keymapResource,
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
  commandDisabled,
  workspaceDisabled,
  modulatorDisabled,
  onOpenSettings,
  modulatorRail,
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
  const displayedCandidates = [...visibleCandidates].reverse()
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
    if (!isPopupVisible) return

    activeCompletionRowRef.current?.scrollIntoView({
      block: isCompletionNavigationActive ? 'nearest' : 'end',
    })
  }, [isCompletionNavigationActive, isPopupVisible, selectedCompletionIndex, visibleCandidates.length])

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

  const dismissCompletion = (): void => {
    setIsCompletionDismissed(true)
    setIsCompletionNavigationActive(false)
  }

  const navigateHistoryPrevious = (): void => {
    if (historyIndex === -1) {
      liveCommandBufferRef.current = commandText
      setHistoryIndex(0)
      setCommandText(commandHistory[0] ?? '')
      setIsHistoryNavigationFrozen(true)
      setIsCompletionDismissed(true)
      return
    }

    const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
    setHistoryIndex(nextIndex)
    setCommandText(commandHistory[nextIndex] ?? '')
    setIsHistoryNavigationFrozen(true)
    setIsCompletionDismissed(true)
  }

  const navigateHistoryNext = (): void => {
    if (historyIndex === 0) {
      setHistoryIndex(-1)
      setCommandText(liveCommandBufferRef.current)
      setIsHistoryNavigationFrozen(true)
      setIsCompletionDismissed(true)
      return
    }

    const nextIndex = historyIndex - 1
    setHistoryIndex(nextIndex)
    setCommandText(commandHistory[nextIndex] ?? '')
    setIsHistoryNavigationFrozen(true)
    setIsCompletionDismissed(true)
  }

  const runLocalCommandAction = (action: string): boolean => {
    if (!isCommandUiActionId(action)) return false
    return runCommandUiAction(action, {
      commandText,
      historyIndex,
      commandHistory,
      isCompletionVisible: isPopupVisible && Boolean(selectedCandidate),
      isCompletionDismissed,
      completionMode,
    }, {
      cancel: () => closeCommandMode({ preserveText: true }),
      submit: submitCommand,
      closeIfEmpty: () => closeCommandMode({ preserveText: true }),
      historyPrevious: navigateHistoryPrevious,
      historyNext: navigateHistoryNext,
      completionAccept: () => acceptCompletion(selectedCandidate),
      completionDismiss: dismissCompletion,
      completionPrevious: () => navigateCompletion(1),
      completionNext: () => navigateCompletion(-1),
    })
  }

  return (
    <footer className="statusBarShell">
      {isPopupVisible ? (
        <div className="commandCompletionPopup" role="listbox" aria-label="Command completions">
          <div className="commandCompletionList">
            {displayedCandidates.map((candidate, displayIndex) => {
              const index = visibleCandidates.length - displayIndex - 1

              return (
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
              )
            })}
          </div>
          {selectedCandidate ? (
            <div className="commandCompletionDetail">{selectedCandidate.command.description}</div>
          ) : null}
        </div>
      ) : null}
      <div className={`statusBar${modulatorRail ? ' statusBar-modulatorDocked' : ''}`}>
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
        <div className="workspaceSwitch" role="group" aria-label="Workspace view">
          <button
            type="button"
            className={`workspaceSwitchButton${workspaceView === 'sequencer' ? ' workspaceSwitchButton-active' : ''}`}
            aria-pressed={workspaceView === 'sequencer'}
            onClick={() => setWorkspaceView('sequencer')}
            disabled={workspaceDisabled}
          >
            Seq
          </button>
          <button
            type="button"
            className={`workspaceSwitchButton${workspaceView === 'library' ? ' workspaceSwitchButton-active' : ''}`}
            aria-pressed={workspaceView === 'library'}
            onClick={() => setWorkspaceView('library')}
            disabled={workspaceDisabled}
          >
            Lib
          </button>
        </div>
        <button
          type="button"
          className={`statusModeButton${isModulatorMode ? ' statusModeButton-active' : ''}`}
          aria-pressed={isModulatorMode}
          onClick={() => setIsModulatorMode((previous) => !previous)}
          disabled={modulatorDisabled}
        >
          Mod
        </button>
      </div>
      {isCommandMode ? (
        <form className="statusCommandForm" onSubmit={(event) => {
          event.preventDefault()
          submitCommand()
        }}>
          <span className="statusPrompt mono">:</span>
          <div className="statusCommandField">
            <input
              ref={commandInputRef}
              className="statusCommandInput mono"
              type="text"
              value={commandText}
              disabled={commandDisabled}
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
                const activeContext = getCommandKeymapContext(isPopupVisible)
                const matchedBinding = findKeymapBinding(
                  keymapResource,
                  activeContext,
                  event.nativeEvent,
                  currentInputMode
                )
                if (matchedBinding?.target.type === 'ui_action') {
                  const handled = runLocalCommandAction(matchedBinding.target.action)
                  if (handled) {
                    event.preventDefault()
                    return
                  }
                }
                const hasContextBindings = keymapResource?.bindings[activeContext] !== undefined
                if (hasContextBindings) return

                if (event.key === 'Escape') {
                  event.preventDefault()
                  runLocalCommandAction('command.cancel')
                  return
                }

                if (event.key === 'Tab') {
                  event.preventDefault()
                  if (isPopupVisible && selectedCandidate) {
                    runLocalCommandAction('command.completion.accept')
                  }
                  return
                }

                if (event.key === 'Enter' && isPopupVisible && selectedCandidate) {
                  event.preventDefault()
                  runLocalCommandAction('command.completion.accept')
                  return
                }

                if (event.key === 'Enter') {
                  event.preventDefault()
                  runLocalCommandAction('command.submit')
                  return
                }

                if (event.key === 'ArrowDown' && isPopupVisible) {
                  event.preventDefault()
                  runLocalCommandAction('command.completion.next')
                  return
                }

                if (event.key === 'ArrowUp' && isPopupVisible) {
                  event.preventDefault()
                  runLocalCommandAction('command.completion.previous')
                  return
                }

                if (event.ctrlKey && event.key.toLowerCase() === 'n') {
                  if (isPopupVisible) {
                    event.preventDefault()
                    runLocalCommandAction('command.completion.next')
                  }
                  return
                }

                if (event.ctrlKey && event.key.toLowerCase() === 'p') {
                  if (isPopupVisible) {
                    event.preventDefault()
                    runLocalCommandAction('command.completion.previous')
                  }
                  return
                }

                if (event.key === 'Backspace' && commandText.length === 0) {
                  event.preventDefault()
                  runLocalCommandAction('command.close_if_empty')
                  return
                }

                if (event.key === 'ArrowUp') {
                  if (runLocalCommandAction('command.history.previous')) event.preventDefault()
                  return
                }

                if (event.key === 'ArrowDown') {
                  if (runLocalCommandAction('command.history.next')) event.preventDefault()
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
                    <span className="statusCommandGhostBracket">
                      {placeholder.required ? '<' : '['}
                    </span>
                    <span className="statusCommandGhostName">{placeholder.displayName}</span>
                    <span className="statusCommandGhostPunctuation">:</span>
                    <span className="statusCommandGhostKind">{placeholder.detail}</span>
                    {placeholder.defaultValue === null ? null : (
                      <>
                        <span className="statusCommandGhostSpacer" aria-hidden="true" />
                        <span className="statusCommandGhostPunctuation">=</span>
                        <span className="statusCommandGhostSpacer" aria-hidden="true" />
                        <span className="statusCommandGhostDefault">{placeholder.defaultValue}</span>
                      </>
                    )}
                    <span className="statusCommandGhostBracket">
                      {placeholder.required ? '>' : ']'}
                    </span>
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
      {modulatorRail ? (
        <div className="statusModulatorDock">
          {modulatorRail}
        </div>
      ) : null}
      </div>
    </footer>
  )
}
