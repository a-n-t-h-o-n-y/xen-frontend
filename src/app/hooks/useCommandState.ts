import { useCallback, useRef, useState } from 'react'

export function useCommandState() {
  const [isCommandMode, setIsCommandMode] = useState(false)
  const [commandText, setCommandText] = useState('')
  const [commandSuffix, setCommandSuffix] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const liveCommandBufferRef = useRef('')

  const openCommandMode = useCallback((): void => {
    liveCommandBufferRef.current = commandText
    setHistoryIndex(-1)
    setIsCommandMode(true)
  }, [commandText])

  const closeCommandMode = useCallback(
    (options?: { preserveText?: boolean }): void => {
      setIsCommandMode(false)
      setHistoryIndex(-1)
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
    commandSuffix,
    setCommandSuffix,
    commandHistory,
    setCommandHistory,
    historyIndex,
    setHistoryIndex,
    liveCommandBufferRef,
    openCommandMode,
    closeCommandMode,
  }
}
