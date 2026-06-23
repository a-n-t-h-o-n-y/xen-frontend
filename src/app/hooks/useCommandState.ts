import { useCallback, useRef, useState } from 'react'
import type { CompletionMode } from '../domain/commandCompletion'

export function useCommandState() {
  const [isCommandMode, setIsCommandMode] = useState(false)
  const [commandText, setCommandText] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const [completionMode, setCompletionMode] = useState<CompletionMode>('none')
  const [isCompletionDismissed, setIsCompletionDismissed] = useState(false)
  const [selectedCompletionIndex, setSelectedCompletionIndex] = useState(0)
  const [isCompletionNavigationActive, setIsCompletionNavigationActive] = useState(false)
  const [isHistoryNavigationFrozen, setIsHistoryNavigationFrozen] = useState(false)
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([])
  const liveCommandBufferRef = useRef('')

  const openCommandMode = useCallback((): void => {
    liveCommandBufferRef.current = commandText
    setHistoryIndex(-1)
    setIsCompletionDismissed(false)
    setSelectedCompletionIndex(0)
    setIsCompletionNavigationActive(false)
    setIsHistoryNavigationFrozen(false)
    setIsCommandMode(true)
  }, [commandText])

  const closeCommandMode = useCallback(
    (options?: { preserveText?: boolean }): void => {
      setIsCommandMode(false)
      setHistoryIndex(-1)
      setCompletionMode('none')
      setIsCompletionDismissed(false)
      setSelectedCompletionIndex(0)
      setIsCompletionNavigationActive(false)
      setIsHistoryNavigationFrozen(false)
      if (!options?.preserveText) {
        setCommandText('')
        liveCommandBufferRef.current = ''
      }
    },
    []
  )

  return {
    isCommandMode,
    setIsCommandMode,
    commandText,
    setCommandText,
    commandHistory,
    setCommandHistory,
    historyIndex,
    setHistoryIndex,
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
    liveCommandBufferRef,
    openCommandMode,
    closeCommandMode,
  }
}
