import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  formatTimeSignature,
  getErrorMessage,
  parseIntegerInput,
  parsePositiveFloatInput,
  parseTimeSignatureInput,
  quoteCommandArg,
} from '../shared'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { LibrarySnapshot, MessageLevel, TranslateDirection } from '../shared'

type UseHeaderEditingArgs = {
  bridgeUnavailableMessage: string | null
  timeSignature: string
  keyDisplay: number
  baseFrequency: number
  selectedMeasureName: string
  selectedMeasureIndex: number
  scaleName: string
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
  sequenceNameInputRef: MutableRefObject<HTMLInputElement | null>
}

export function useHeaderEditing({
  bridgeUnavailableMessage,
  timeSignature,
  keyDisplay,
  baseFrequency,
  selectedMeasureName,
  selectedMeasureIndex,
  scaleName,
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
  sequenceNameInputRef,
}: UseHeaderEditingArgs) {
  const [isTimeSignatureEditing, setIsTimeSignatureEditing] = useState(false)
  const [timeSignatureDraft, setTimeSignatureDraft] = useState('4/4')
  const [isKeyEditing, setIsKeyEditing] = useState(false)
  const [keyDraft, setKeyDraft] = useState('0')
  const [isBaseFrequencyEditing, setIsBaseFrequencyEditing] = useState(false)
  const [baseFrequencyDraft, setBaseFrequencyDraft] = useState('440')
  const [isSequenceNameEditing, setIsSequenceNameEditing] = useState(false)
  const [sequenceNameDraft, setSequenceNameDraft] = useState('')
  const [isScaleUpdating, setIsScaleUpdating] = useState(false)

  useEffect(() => {
    if (isTimeSignatureEditing) {
      return
    }
    setTimeSignatureDraft(timeSignature)
  }, [isTimeSignatureEditing, timeSignature])

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
    if (isKeyEditing) {
      return
    }
    setKeyDraft(`${keyDisplay}`)
  }, [isKeyEditing, keyDisplay])

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
    if (isBaseFrequencyEditing) {
      return
    }
    setBaseFrequencyDraft(`${baseFrequency}`)
  }, [baseFrequency, isBaseFrequencyEditing])

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

  useEffect(() => {
    if (isSequenceNameEditing) {
      return
    }
    setSequenceNameDraft(selectedMeasureName)
  }, [isSequenceNameEditing, selectedMeasureName])

  useEffect(() => {
    if (!isSequenceNameEditing) {
      return
    }
    const input = sequenceNameInputRef.current
    if (!input) {
      return
    }
    input.focus()
    input.select()
  }, [isSequenceNameEditing, sequenceNameInputRef])

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
        await executeBackendCommand(`set sequence timeSignature ${normalized}`)
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
        await executeBackendCommand(`set key ${parsed}`)
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
        await executeBackendCommand(`set baseFrequency ${parsed}`)
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

  const commitSequenceName = useCallback(
    async (value: string): Promise<boolean> => {
      if (bridgeUnavailableMessage !== null) {
        return false
      }

      const normalized = value.trim()
      if (!normalized) {
        setStatusMessage('Sequence name cannot be empty.')
        setStatusLevel('warning')
        setSequenceNameDraft(selectedMeasureName)
        setIsSequenceNameEditing(false)
        return false
      }

      try {
        await executeBackendCommand(`set sequence name ${quoteCommandArg(normalized)} ${selectedMeasureIndex}`)
        setIsSequenceNameEditing(false)
        return true
      } catch (error) {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
        setSequenceNameDraft(selectedMeasureName)
        setIsSequenceNameEditing(false)
        return false
      }
    },
    [
      bridgeUnavailableMessage,
      executeBackendCommand,
      selectedMeasureIndex,
      selectedMeasureName,
      setStatusLevel,
      setStatusMessage,
    ]
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

  const beginSequenceNameEdit = useCallback((): void => {
    setSequenceNameDraft(selectedMeasureName)
    setIsSequenceNameEditing(true)
  }, [selectedMeasureName])

  const cancelSequenceNameEdit = useCallback((): void => {
    setSequenceNameDraft(selectedMeasureName)
    setIsSequenceNameEditing(false)
  }, [selectedMeasureName])

  const applyTimeSignatureScale = useCallback(
    (mode: 'half' | 'double'): void => {
      if (bridgeUnavailableMessage !== null || isTimeSignatureEditing) {
        return
      }

      const parsed = parseTimeSignatureInput(timeSignature)
      if (!parsed) {
        return
      }

      const next =
        mode === 'double'
          ? formatTimeSignature({
              numerator: parsed.numerator * 2,
              denominator: parsed.denominator,
            })
          : parsed.numerator > 1
            ? formatTimeSignature({
                numerator: Math.max(1, Math.round(parsed.numerator / 2)),
                denominator: parsed.denominator,
              })
            : formatTimeSignature({
                numerator: 1,
                denominator: parsed.denominator * 2,
              })
      void commitTimeSignature(next)
    },
    [bridgeUnavailableMessage, commitTimeSignature, isTimeSignatureEditing, timeSignature]
  )

  const scaleOptions = useMemo(() => {
    const names = new Set<string>()
    librarySnapshot.scales.forEach((scale) => names.add(scale.name))
    if (scaleName.trim().length > 0) {
      names.add(scaleName)
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [librarySnapshot.scales, scaleName])

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
        await executeBackendCommand(`set mode ${modeIndex}`)
      } catch (error) {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      }
    },
    [bridgeUnavailableMessage, executeBackendCommand, scaleMode, setStatusLevel, setStatusMessage]
  )

  const applyScaleSelection = useCallback(
    async (nextScaleName: string): Promise<void> => {
      if (
        bridgeUnavailableMessage !== null ||
        isScaleUpdating ||
        !nextScaleName ||
        nextScaleName === scaleName
      ) {
        return
      }

      setIsScaleUpdating(true)
      try {
        await executeBackendCommand(`set scale ${quoteCommandArg(nextScaleName)}`)
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
      scaleName,
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
      await executeBackendCommand(`set translateDirection ${nextDirection}`)
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
    isSequenceNameEditing,
    sequenceNameDraft,
    setSequenceNameDraft,
    isScaleUpdating,
    commitTimeSignature,
    commitKey,
    commitBaseFrequency,
    commitSequenceName,
    beginTimeSignatureEdit,
    cancelTimeSignatureEdit,
    beginKeyEdit,
    cancelKeyEdit,
    beginBaseFrequencyEdit,
    cancelBaseFrequencyEdit,
    beginSequenceNameEdit,
    cancelSequenceNameEdit,
    applyTimeSignatureScale,
    scaleOptions,
    modeOptions,
    applyModeSelection,
    applyScaleSelection,
    toggleTranslateDirection,
  }
}
