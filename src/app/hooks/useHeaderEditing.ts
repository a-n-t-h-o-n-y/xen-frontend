import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  formatTimeSignature,
  parseIntegerInput,
  parsePositiveFloatInput,
  parseTimeSignatureInput,
} from '../presentation/viewModels'
import { getErrorMessage } from '../utils/errors'
import {
  scaleDuration,
  setBaseFrequency,
  setKey,
  setDuration,
  setMode,
  setTranslateDirection,
} from '../domain/commands'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { LibrarySnapshot, MessageLevel, TranslateDirection } from '../domain/models'

type UseHeaderEditingArgs = {
  bridgeUnavailableMessage: string | null
  timeSignature: string
  keyDisplay: string | number
  baseFrequency: string | number
  scaleName: string
  scaleSourceId: string | null
  scaleMode: number
  scaleSize: number
  scaleTranslateDirection: TranslateDirection
  librarySnapshot: LibrarySnapshot
  executeBackendCommand: (command: string) => Promise<void>
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
  timeSignatureInputRef: MutableRefObject<HTMLInputElement | null>
  keyInputRef: MutableRefObject<HTMLInputElement | null>
  baseFrequencyInputRef: MutableRefObject<HTMLInputElement | null>
}

export function useHeaderEditing({
  bridgeUnavailableMessage,
  timeSignature,
  keyDisplay,
  baseFrequency,
  scaleName,
  scaleSourceId,
  scaleMode,
  scaleSize,
  scaleTranslateDirection,
  librarySnapshot,
  executeBackendCommand,
  setStatusMessage,
  setStatusLevel,
  timeSignatureInputRef,
  keyInputRef,
  baseFrequencyInputRef,
}: UseHeaderEditingArgs) {
  const [isTimeSignatureEditing, setIsTimeSignatureEditing] = useState(false)
  const [timeSignatureDraft, setTimeSignatureDraft] = useState('4/4')
  const [isKeyEditing, setIsKeyEditing] = useState(false)
  const [keyDraft, setKeyDraft] = useState('0')
  const [isBaseFrequencyEditing, setIsBaseFrequencyEditing] = useState(false)
  const [baseFrequencyDraft, setBaseFrequencyDraft] = useState('440')
  const [isScaleUpdating, setIsScaleUpdating] = useState(false)

  useEffect(() => {
    if (!isTimeSignatureEditing) {
      return
    }
    const input = timeSignatureInputRef.current
    if (!input) {
      return
    }
    input.focus()
    input.select()
  }, [isTimeSignatureEditing, timeSignatureInputRef])

  useEffect(() => {
    if (!isKeyEditing) {
      return
    }
    const input = keyInputRef.current
    if (!input) {
      return
    }
    input.focus()
    input.select()
  }, [isKeyEditing, keyInputRef])

  useEffect(() => {
    if (!isBaseFrequencyEditing) {
      return
    }
    const input = baseFrequencyInputRef.current
    if (!input) {
      return
    }
    input.focus()
    input.select()
  }, [baseFrequencyInputRef, isBaseFrequencyEditing])

  const commitTimeSignature = useCallback(
    async (value: string): Promise<boolean> => {
      if (bridgeUnavailableMessage !== null) {
        return false
      }

      const parsed = parseTimeSignatureInput(value)
      if (!parsed) {
        setStatusMessage('Invalid time signature. Use N/D, e.g. 4/4')
        setStatusLevel('warning')
        setTimeSignatureDraft(timeSignature)
        setIsTimeSignatureEditing(false)
        return false
      }

      const normalized = formatTimeSignature(parsed)
      try {
        await executeBackendCommand(setDuration(normalized))
        setIsTimeSignatureEditing(false)
        return true
      } catch (error) {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
        setTimeSignatureDraft(timeSignature)
        setIsTimeSignatureEditing(false)
        return false
      }
    },
    [bridgeUnavailableMessage, executeBackendCommand, setStatusLevel, setStatusMessage, timeSignature]
  )

  const commitKey = useCallback(
    async (value: string): Promise<boolean> => {
      if (bridgeUnavailableMessage !== null) {
        return false
      }

      const parsed = parseIntegerInput(value)
      if (parsed === null) {
        setStatusMessage('Invalid key. Use an integer value.')
        setStatusLevel('warning')
        setKeyDraft(`${keyDisplay}`)
        setIsKeyEditing(false)
        return false
      }

      try {
        await executeBackendCommand(setKey(parsed))
        setIsKeyEditing(false)
        return true
      } catch (error) {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
        setKeyDraft(`${keyDisplay}`)
        setIsKeyEditing(false)
        return false
      }
    },
    [bridgeUnavailableMessage, executeBackendCommand, keyDisplay, setStatusLevel, setStatusMessage]
  )

  const commitBaseFrequency = useCallback(
    async (value: string): Promise<boolean> => {
      if (bridgeUnavailableMessage !== null) {
        return false
      }

      const parsed = parsePositiveFloatInput(value)
      if (parsed === null) {
        setStatusMessage('Invalid base frequency. Use a positive number.')
        setStatusLevel('warning')
        setBaseFrequencyDraft(`${baseFrequency}`)
        setIsBaseFrequencyEditing(false)
        return false
      }

      try {
        await executeBackendCommand(setBaseFrequency(parsed))
        setIsBaseFrequencyEditing(false)
        return true
      } catch (error) {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
        setBaseFrequencyDraft(`${baseFrequency}`)
        setIsBaseFrequencyEditing(false)
        return false
      }
    },
    [baseFrequency, bridgeUnavailableMessage, executeBackendCommand, setStatusLevel, setStatusMessage]
  )

  const beginTimeSignatureEdit = useCallback((): void => {
    setTimeSignatureDraft(timeSignature)
    setIsTimeSignatureEditing(true)
  }, [timeSignature])

  const cancelTimeSignatureEdit = useCallback((): void => {
    setTimeSignatureDraft(timeSignature)
    setIsTimeSignatureEditing(false)
  }, [timeSignature])

  const beginKeyEdit = useCallback((): void => {
    setKeyDraft(`${keyDisplay}`)
    setIsKeyEditing(true)
  }, [keyDisplay])

  const cancelKeyEdit = useCallback((): void => {
    setKeyDraft(`${keyDisplay}`)
    setIsKeyEditing(false)
  }, [keyDisplay])

  const beginBaseFrequencyEdit = useCallback((): void => {
    setBaseFrequencyDraft(`${baseFrequency}`)
    setIsBaseFrequencyEditing(true)
  }, [baseFrequency])

  const cancelBaseFrequencyEdit = useCallback((): void => {
    setBaseFrequencyDraft(`${baseFrequency}`)
    setIsBaseFrequencyEditing(false)
  }, [baseFrequency])

  const applyTimeSignatureScale = useCallback(
    (mode: 'half' | 'double'): void => {
      if (bridgeUnavailableMessage !== null || isTimeSignatureEditing) {
        return
      }

      void executeBackendCommand(scaleDuration(mode)).catch(
        (error) => {
          setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
          setStatusLevel('error')
        }
      )
    },
    [
      bridgeUnavailableMessage,
      executeBackendCommand,
      isTimeSignatureEditing,
      setStatusLevel,
      setStatusMessage,
    ]
  )

  const scaleOptions = useMemo(() => {
    return librarySnapshot.scales
      .map((scale) => ({
        id: scale.id,
        name: scale.definition === null ? 'chromatic' : scale.definition.name,
        command: scale.command,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [librarySnapshot.scales])

  const modeOptions = useMemo(() => {
    const isChromatic = /chromatic/i.test(scaleName)
    if (isChromatic || scaleSize <= 1) {
      return [] as number[]
    }
    return Array.from({ length: scaleSize }, (_, index) => index + 1)
  }, [scaleName, scaleSize])

  const applyModeSelection = useCallback(
    async (modeIndex: number): Promise<void> => {
      if (
        bridgeUnavailableMessage !== null ||
        !Number.isFinite(modeIndex) ||
        modeIndex < 0 ||
        modeIndex === scaleMode
      ) {
        return
      }

      try {
        await executeBackendCommand(setMode(modeIndex))
      } catch (error) {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      }
    },
    [bridgeUnavailableMessage, executeBackendCommand, scaleMode, setStatusLevel, setStatusMessage]
  )

  const applyScaleSelection = useCallback(
    async (nextScaleId: string): Promise<void> => {
      const selectedScale = scaleOptions.find((scale) => scale.id === nextScaleId)
      if (
        bridgeUnavailableMessage !== null ||
        isScaleUpdating ||
        !selectedScale ||
        nextScaleId === scaleSourceId
      ) {
        return
      }

      setIsScaleUpdating(true)
      try {
        await executeBackendCommand(selectedScale.command)
      } catch (error) {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      } finally {
        setIsScaleUpdating(false)
      }
    },
    [
      bridgeUnavailableMessage,
      executeBackendCommand,
      isScaleUpdating,
      scaleOptions,
      scaleSourceId,
      setStatusLevel,
      setStatusMessage,
    ]
  )

  const toggleTranslateDirection = useCallback(async (): Promise<void> => {
    if (bridgeUnavailableMessage !== null) {
      return
    }

    const nextDirection: TranslateDirection = scaleTranslateDirection === 'down' ? 'up' : 'down'
    try {
      await executeBackendCommand(setTranslateDirection(nextDirection))
    } catch (error) {
      setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
      setStatusLevel('error')
    }
  }, [
    bridgeUnavailableMessage,
    executeBackendCommand,
    scaleTranslateDirection,
    setStatusLevel,
    setStatusMessage,
  ])

  return {
    isTimeSignatureEditing,
    timeSignatureDraft,
    setTimeSignatureDraft,
    isKeyEditing,
    keyDraft,
    setKeyDraft,
    isBaseFrequencyEditing,
    baseFrequencyDraft,
    setBaseFrequencyDraft,
    isScaleUpdating,
    commitTimeSignature,
    commitKey,
    commitBaseFrequency,
    beginTimeSignatureEdit,
    cancelTimeSignatureEdit,
    beginKeyEdit,
    cancelKeyEdit,
    beginBaseFrequencyEdit,
    cancelBaseFrequencyEdit,
    applyTimeSignatureScale,
    scaleOptions,
    modeOptions,
    applyModeSelection,
    applyScaleSelection,
    toggleTranslateDirection,
  }
}
