import type { Dispatch, FormEvent, SetStateAction } from 'react'
import type { InputMode, MessageLevel, StatusCellMetaItem } from '../shared'

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
  commandSuffix: string
  closeCommandMode: (options?: { preserveText?: boolean }) => void
  commandHistory: string[]
  liveCommandBufferRef: { current: string }
  statusLevel: MessageLevel
  statusMessage: string
  selectedCellMeta: StatusCellMetaItem[]
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
  commandSuffix,
  closeCommandMode,
  commandHistory,
  liveCommandBufferRef,
  statusLevel,
  statusMessage,
  selectedCellMeta,
}: StatusSectionProps) {
  return (
    <footer className="statusBar">
      <div className="statusLeft">
        <span className="modeBadge mono" aria-label={`Input mode ${currentInputMode}`}>
          {currentInputModeLetter}
        </span>
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
              size={Math.max(1, commandText.length)}
              onChange={(event) => {
                const nextValue = event.target.value
                if (historyIndex !== -1) {
                  setHistoryIndex(-1)
                }
                setCommandText(nextValue)
                liveCommandBufferRef.current = nextValue
              }}
              onKeyDown={(event) => {
                if (event.key === 'Tab') {
                  event.preventDefault()

                  if (!commandSuffix) {
                    return
                  }

                  const completedCore = `${commandText}${commandSuffix}`
                  const completedText = completedCore.endsWith(' ') ? completedCore : `${completedCore} `
                  if (historyIndex !== -1) {
                    setHistoryIndex(-1)
                  }
                  setCommandText(completedText)
                  liveCommandBufferRef.current = completedText
                  return
                }

                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeCommandMode({ preserveText: true })
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
                    return
                  }

                  const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1)
                  setHistoryIndex(nextIndex)
                  setCommandText(commandHistory[nextIndex])
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
                    return
                  }

                  const nextIndex = historyIndex - 1
                  setHistoryIndex(nextIndex)
                  setCommandText(commandHistory[nextIndex])
                }
              }}
              onBlur={() => closeCommandMode({ preserveText: true })}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-label="Command input"
            />
            {commandSuffix ? <span className="statusCommandGhost mono">{commandSuffix}</span> : null}
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
    </footer>
  )
}
