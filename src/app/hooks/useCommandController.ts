import { useCallback, useEffect } from 'react'
import { recognizeCommandIds } from '../domain/commandCompletion'
import { MAX_COMMAND_HISTORY } from '../constants'
import { getErrorMessage } from '../utils/errors'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { CommandReferenceEntry, MessageLevel } from '../domain/models'

type UseCommandControllerArgs = {
  isCommandMode: boolean
  commandText: string
  commandInputRef: MutableRefObject<HTMLInputElement | null>
  setCommandHistory: Dispatch<SetStateAction<string[]>>
  setHistoryIndex: Dispatch<SetStateAction<number>>
  liveCommandBufferRef: MutableRefObject<string>
  closeCommandMode: (options?: { preserveText?: boolean }) => void
  setRecentCommandIds: Dispatch<SetStateAction<string[]>>
  commands: CommandReferenceEntry[]
  executeBackendCommand: (command: string) => Promise<void>
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
}

export function useCommandController({
  isCommandMode,
  commandText,
  commandInputRef,
  setCommandHistory,
  setHistoryIndex,
  liveCommandBufferRef,
  closeCommandMode,
  setRecentCommandIds,
  commands,
  executeBackendCommand,
  setStatusMessage,
  setStatusLevel,
}: UseCommandControllerArgs) {
  useEffect(() => {
    if (!isCommandMode) {
      return
    }
    const input = commandInputRef.current
    if (!input) {
      return
    }

    input.focus()
    const textLength = input.value.length
    input.setSelectionRange(textLength, textLength)
  }, [commandInputRef, isCommandMode])

  const submitCommand = useCallback(
    async (): Promise<void> => {
      const command = commandText.trim()
      if (!command) {
        closeCommandMode({ preserveText: true })
        return
      }

      setCommandHistory((previous) => [command, ...previous].slice(0, MAX_COMMAND_HISTORY))
      const recognizedCommandIds = recognizeCommandIds(command, commands)
      if (recognizedCommandIds.length > 0) {
        setRecentCommandIds((previous) => [
          ...recognizedCommandIds,
          ...previous.filter((id) => !recognizedCommandIds.includes(id)),
        ].slice(0, 20))
      }
      setHistoryIndex(-1)
      liveCommandBufferRef.current = ''

      let shouldClearCommandText = false

      try {
        await executeBackendCommand(command)
        shouldClearCommandText = true
      } catch (error) {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      } finally {
        closeCommandMode({ preserveText: !shouldClearCommandText })
      }
    },
    [
      closeCommandMode,
      commandText,
      commands,
      executeBackendCommand,
      liveCommandBufferRef,
      setCommandHistory,
      setHistoryIndex,
      setRecentCommandIds,
      setStatusLevel,
      setStatusMessage,
    ]
  )

  return { submitCommand }
}
