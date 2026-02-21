import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { HeaderSection } from './app/sections/HeaderSection'
import { BottomModulesSection } from './app/sections/BottomModulesSection'
import { useBridgeSession } from './app/hooks/useBridgeSession'
import { useCommandState } from './app/hooks/useCommandState'
import { useHeaderEditing } from './app/hooks/useHeaderEditing'
import { useLibraryPanelState } from './app/hooks/useLibraryPanelState'
import { useModulatorPanelState } from './app/hooks/useModulatorPanelState'
import { useSequencerRollState } from './app/hooks/useSequencerRollState'
import { useTransportPlayhead } from './app/hooks/useTransportPlayhead'
import { SequencerSection } from './app/sections/SequencerSection'
import { StatusSection } from './app/sections/StatusSection'
import {
  MAX_COMMAND_HISTORY,
  DEFAULT_TUNING_LENGTH,
  TRANSPORT_SEQUENCE_COUNT,
  LFO_PHASE_OFFSET_MIN,
  LFO_PHASE_OFFSET_MAX,
  clampNumber,
  roundByStep,
  toNormalizedPhase,
  frequencyToRatio,
  ratioToFrequency,
  createTransportState,
  getErrorMessage,
  getMeasureLoopQuarterNotes,
  getLibrarySnapshot,
  getPayloadError,
  getCommandSuffix,
  quoteCommandArg,
  formatOctaveForDisplay,
  parseKeyBinding,
  matchesBinding,
  applyNumberParameter,
  sampleWaveShape,
  createMorphModulator,
  createTargetModulator,
  MOD_TARGET_ORDER,
  getModTargetSpecForTuning,
  isEditableTarget,
  getTuningRatios,
  generateValidPitches,
  mapPitchToScale,
  collectNotePitches,
  collectLeafCells,
  normalizePitch,
  isPathPrefix,
  getCellAtPath,
  getStatusCellMeta,
} from './app/shared'
import type {
  MessageLevel,
  TranslateDirection,
  InputMode,
  Cell,
  Measure,
  UiStateSnapshot,
  TransportState,
  SyncedTransportPhases,
  ModTarget,
  WaveType,
  TargetControl,
  LeafCell,
  StatusCellMetaItem,
} from './app/shared'
function App() {
  const [currentInputMode, setCurrentInputMode] = useState<InputMode>('pitch')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusLevel, setStatusLevel] = useState<MessageLevel>('info')
  const [bridgeUnavailableMessage, setBridgeUnavailableMessage] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<UiStateSnapshot | null>(null)
  const [openScaleMenu, setOpenScaleMenu] = useState(false)
  const [sequenceViewKeymap, setSequenceViewKeymap] = useState<Record<string, string>>({})
  const {
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
  } = useCommandState()
  const eventTokenRef = useRef<unknown>(null)
  const commandInputRef = useRef<HTMLInputElement>(null)
  const timeSignatureInputRef = useRef<HTMLInputElement>(null)
  const keyInputRef = useRef<HTMLInputElement>(null)
  const baseFrequencyInputRef = useRef<HTMLInputElement>(null)
  const sequenceNameInputRef = useRef<HTMLInputElement>(null)
  const scaleMenuRef = useRef<HTMLDivElement | null>(null)
  const lastSnapshotVersionRef = useRef<number>(-1)
  const completionRequestVersionRef = useRef(0)
  const pendingNumberRef = useRef('')
  const lastShortcutCommandRef = useRef<{ command: 'copy' | 'cut' | 'paste'; at: number } | null>(
    null
  )
  const transportRef = useRef<TransportState>(createTransportState())
  const selectedMeasureIndexRef = useRef(0)
  const selectedTimeSignatureRef = useRef({ numerator: 4, denominator: 4 })
  const [playheadPhase, setPlayheadPhase] = useState<number | null>(null)
  const [syncedTransportPhases, setSyncedTransportPhases] = useState<SyncedTransportPhases>({
    wrapped: Array(TRANSPORT_SEQUENCE_COUNT).fill(0),
    unwrapped: Array(TRANSPORT_SEQUENCE_COUNT).fill(0),
  })
  const [activeSequenceFlags, setActiveSequenceFlags] = useState<boolean[]>(
    Array(TRANSPORT_SEQUENCE_COUNT).fill(false)
  )
  const {
    activeReferenceTab,
    setActiveReferenceTab,
    referenceCommandSearch,
    setReferenceCommandSearch,
    referenceSearchInputRef,
    tuningSearch,
    setTuningSearch,
    tuningSearchInputRef,
    sequenceSearch,
    setSequenceSearch,
    sequenceSearchInputRef,
    tuningSortMode,
    setTuningSortMode,
    activeLibraryTab,
    setActiveLibraryTab,
    sessionReference,
    setSessionReference,
    librarySnapshot,
    setLibrarySnapshot,
    libraryLoading,
    setLibraryLoading,
    sequenceViewReferenceBindings,
    filteredReferenceCommands,
    tuningHierarchyRows,
    sequenceHierarchyRows,
  } = useLibraryPanelState()
  const {
    modulatorInstances,
    setModulatorInstances,
    activeModulatorTab,
    setActiveModulatorTab,
    waveAType,
    setWaveAType,
    waveBType,
    setWaveBType,
    waveAPulseWidth,
    setWaveAPulseWidth,
    waveBPulseWidth,
    setWaveBPulseWidth,
    waveLerp,
    setWaveLerp,
    lfoAFrequency,
    setLfoAFrequency,
    lfoAPhaseOffset,
    setLfoAPhaseOffset,
    lfoBFrequency,
    setLfoBFrequency,
    lfoBPhaseOffset,
    setLfoBPhaseOffset,
    openWaveMenu,
    setOpenWaveMenu,
    targetControls,
    setTargetControls,
    padDragRef,
    wavePadDragRef,
    lastWaveHandleUsedRef,
    liveEmitFrameRef,
    liveEmitCommandsRef,
    waveMenuRef,
    isSwitchingModTabRef,
    modulatorInstancesRef,
  } = useModulatorPanelState()
  const { sendBridgeRequest, executeBackendCommand } = useBridgeSession({
    eventTokenRef,
    transportRef,
    selectedMeasureIndexRef,
    lastSnapshotVersionRef,
    setSnapshot,
    setCurrentInputMode,
    setStatusMessage,
    setStatusLevel,
    setBridgeUnavailableMessage,
    setSessionReference,
    setSequenceViewKeymap,
    setLibraryLoading,
    setLibrarySnapshot,
    setActiveSequenceFlags,
    setPlayheadPhase,
    setSyncedTransportPhases,
  })

  useEffect(() => {
    if (!isCommandMode) {
      setCommandSuffix('')
      return
    }

    const input = commandInputRef.current
    if (!input) {
      return
    }

    input.focus()
    const textLength = input.value.length
    input.setSelectionRange(textLength, textLength)
  }, [isCommandMode, setCommandSuffix])

  useEffect(() => {
    if (!isCommandMode || bridgeUnavailableMessage !== null) {
      setCommandSuffix('')
      return
    }

    const currentVersion = completionRequestVersionRef.current + 1
    completionRequestVersionRef.current = currentVersion

    const loadSuffix = async (): Promise<void> => {
      try {
        const completionResponse = await sendBridgeRequest('command.completeText', {
          partial: commandText,
        })
        const payloadError = getPayloadError(completionResponse.payload)
        if (payloadError) {
          throw new Error(payloadError)
        }

        const suffix = getCommandSuffix(completionResponse.payload) ?? ''
        if (completionRequestVersionRef.current === currentVersion) {
          setCommandSuffix(suffix)
        }
      } catch {
        if (completionRequestVersionRef.current === currentVersion) {
          setCommandSuffix('')
        }
      }
    }

    void loadSuffix()
  }, [bridgeUnavailableMessage, commandText, isCommandMode, sendBridgeRequest, setCommandSuffix])

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent): void => {
      const editableTarget = isEditableTarget(event.target)

      if (bridgeUnavailableMessage !== null) {
        return
      }

      if (editableTarget) {
        return
      }

      const isPlainSpace =
        (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      if (!isCommandMode && isPlainSpace) {
        event.preventDefault()
        pendingNumberRef.current = ''
        return
      }

      const isDigitKey =
        event.key.length === 1 &&
        event.key >= '0' &&
        event.key <= '9' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey

      if (!isCommandMode && isDigitKey) {
        pendingNumberRef.current = `${pendingNumberRef.current}${event.key}`
        event.preventDefault()
        return
      }

      const matchedBinding = Object.entries(sequenceViewKeymap).find(([binding]) => {
        const parsedBinding = parseKeyBinding(binding)
        if (!parsedBinding) {
          return false
        }

        return matchesBinding(parsedBinding, event, currentInputMode)
      })

      if (matchedBinding) {
        event.preventDefault()
        const command = applyNumberParameter(matchedBinding[1], pendingNumberRef.current)
        const normalizedCommand = command.trim().toLowerCase()
        if (normalizedCommand === 'copy' || normalizedCommand === 'cut' || normalizedCommand === 'paste') {
          lastShortcutCommandRef.current = { command: normalizedCommand, at: Date.now() }
        }
        pendingNumberRef.current = ''
        void executeBackendCommand(command).catch((error: unknown) => {
          setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
          setStatusLevel('error')
        })
        return
      }

      if (!isDigitKey) {
        pendingNumberRef.current = ''
      }

      if (isCommandMode) {
        return
      }

      if (event.key === ':' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        openCommandMode()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    bridgeUnavailableMessage,
    currentInputMode,
    executeBackendCommand,
    isCommandMode,
    openCommandMode,
    sequenceViewKeymap,
  ])

  useEffect(() => {
    const handleClipboardCommand = (command: string, event: ClipboardEvent): void => {
      const recentShortcut = lastShortcutCommandRef.current
      if (
        recentShortcut &&
        recentShortcut.command === command &&
        Date.now() - recentShortcut.at < 250
      ) {
        return
      }

      const editableTarget = isEditableTarget(event.target)

      if (bridgeUnavailableMessage !== null || editableTarget || isCommandMode) {
        return
      }

      event.preventDefault()

      void executeBackendCommand(command).catch((error: unknown) => {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      })
    }

    const handleCopy = (event: ClipboardEvent): void => {
      handleClipboardCommand('copy', event)
    }
    const handleCut = (event: ClipboardEvent): void => {
      handleClipboardCommand('cut', event)
    }
    const handlePaste = (event: ClipboardEvent): void => {
      handleClipboardCommand('paste', event)
    }

    window.addEventListener('copy', handleCopy)
    window.addEventListener('cut', handleCut)
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('copy', handleCopy)
      window.removeEventListener('cut', handleCut)
      window.removeEventListener('paste', handlePaste)
    }
  }, [
    bridgeUnavailableMessage,
    executeBackendCommand,
    isCommandMode,
  ])

  const submitCommand = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault()

      const command = commandText.trim()
      if (!command) {
        closeCommandMode({ preserveText: true })
        return
      }

      setCommandHistory((previous) => [command, ...previous].slice(0, MAX_COMMAND_HISTORY))
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
      executeBackendCommand,
      liveCommandBufferRef,
      setCommandHistory,
      setHistoryIndex,
    ]
  )

  const {
    tuningLength,
    sequenceBank,
    selectedMeasure,
    selectedLoopQuarterNotes,
    sequenceCount,
    patternScopeCellCount,
    leafPatternScopeIndices,
    rootCells,
    selectedMeasureIndex,
    selectedMeasureNumerator,
    selectedMeasureDenominator,
    selectedMeasureName,
    timeSignature,
    scaleName,
    scaleMode,
    scaleSize,
    scaleTranslateDirection,
    tuningName,
    keyDisplay,
    baseFrequency,
    staffLineBandByPitch,
    leafCells,
    selectedLeafFlags,
    selectedCellMeta,
    rulerRatios,
    highlightedPitches,
  } = useMemo(() => {
    if (!snapshot) {
      const defaultStaffLineBand = Array.from(
        { length: DEFAULT_TUNING_LENGTH },
        (_, pitch) => (pitch % 2 === 0 ? 0 : 1)
      )
      return {
        tuningLength: DEFAULT_TUNING_LENGTH,
        sequenceBank: [] as Measure[],
        selectedMeasure: null as Measure | null,
        selectedLoopQuarterNotes: 4,
        sequenceCount: TRANSPORT_SEQUENCE_COUNT,
        patternScopeCellCount: 0,
        leafPatternScopeIndices: [] as number[],
        rootCells: [] as Cell[],
        selectedMeasureIndex: 0,
        selectedMeasureNumerator: 4,
        selectedMeasureDenominator: 4,
        selectedMeasureName: 'Init Test',
        timeSignature: '4/4',
        scaleName: 'major diatonic',
        scaleMode: 3,
        scaleSize: 7,
        scaleTranslateDirection: 'up' as TranslateDirection,
        tuningName: '12EDO',
        keyDisplay: 2,
        baseFrequency: 440,
        staffLineBandByPitch: defaultStaffLineBand,
        leafCells: [] as LeafCell[],
        selectedLeafFlags: [] as boolean[],
        selectedCellMeta: [] as StatusCellMetaItem[],
        rulerRatios: getTuningRatios(Array.from({ length: DEFAULT_TUNING_LENGTH }, (_, i) => i * 100)),
        highlightedPitches: new Set<number>(),
      }
    }

    const rawTuningLength = snapshot.engine.tuning.intervals.length
    const derivedTuningLength = rawTuningLength > 0 ? rawTuningLength : DEFAULT_TUNING_LENGTH
    const selectedIndex = Math.max(
      0,
      Math.min(snapshot.editor.selected.measure, snapshot.engine.sequence_bank.length - 1)
    )
    const selectedMeasure = snapshot.engine.sequence_bank[selectedIndex] ?? null
    const sequenceName = snapshot.engine.sequence_names[selectedIndex] ?? `Sequence ${selectedIndex}`
    const scaleValidPitches = snapshot.engine.scale
      ? generateValidPitches(snapshot.engine.scale, derivedTuningLength)
      : []
    const translateDirection = snapshot.engine.scale_translate_direction

    const mapPitch = (pitch: number): number =>
      mapPitchToScale(pitch, scaleValidPitches, derivedTuningLength, translateDirection)

    const selectedCell = selectedMeasure?.cell ?? null
    const directCells =
      selectedCell?.type === 'Sequence' ? selectedCell.cells : selectedCell ? [selectedCell] : []

    const tuningRatios = getTuningRatios(snapshot.engine.tuning.intervals)
    const rowMap = Array.from({ length: derivedTuningLength }, (_, pitch) => mapPitch(pitch))
    const hasScale = snapshot.engine.scale !== null
    const staffLineBands: number[] = []

    if (hasScale) {
      let currentBand = 0
      let previousMappedPitch = 0

      for (let pitch = 0; pitch < derivedTuningLength; pitch += 1) {
        const mappedPitch = rowMap[pitch] ?? pitch
        if (mappedPitch !== previousMappedPitch) {
          currentBand = currentBand === 0 ? 1 : 0
        }
        staffLineBands.push(currentBand)
        previousMappedPitch = mappedPitch
      }
    } else {
      for (let pitch = 0; pitch < derivedTuningLength; pitch += 1) {
        staffLineBands.push(pitch % 2 === 0 ? 0 : 1)
      }
    }

    const signature = selectedMeasure?.time_signature
      ? `${selectedMeasure.time_signature.numerator}/${selectedMeasure.time_signature.denominator}`
      : '4/4'
    const selectedNumerator = selectedMeasure?.time_signature?.numerator ?? 4
    const selectedDenominator = selectedMeasure?.time_signature?.denominator ?? 4
    const directLeafCells = collectLeafCells(directCells)
    const selectionPath = snapshot.editor.selected.cell
    const resolvedSelectedCell =
      getCellAtPath(directCells, selectionPath) ?? (selectionPath.length === 0 ? selectedCell : null)
    const selectedPitches = resolvedSelectedCell ? collectNotePitches(resolvedSelectedCell) : []
    const mappedHighlights = new Set(
      selectedPitches.map((pitch) =>
        normalizePitch(mapPitch(normalizePitch(pitch, derivedTuningLength)), derivedTuningLength)
      )
    )
    const patternScopePath =
      resolvedSelectedCell?.type === 'Sequence'
        ? selectionPath
        : selectionPath.length > 0
          ? selectionPath.slice(0, -1)
          : []
    const patternScopeCell =
      patternScopePath.length === 0 ? null : getCellAtPath(directCells, patternScopePath)
    const patternScopeCells =
      patternScopePath.length === 0
        ? directCells
        : patternScopeCell?.type === 'Sequence'
          ? patternScopeCell.cells
          : []
    const scopeIndices = directLeafCells.map((leafCell) => {
      if (!isPathPrefix(patternScopePath, leafCell.path)) {
        return -1
      }
      return leafCell.path[patternScopePath.length] ?? -1
    })
    const selectionFlags = directLeafCells.map((leafCell) =>
      isPathPrefix(selectionPath, leafCell.path)
    )

    return {
      tuningLength: derivedTuningLength,
      sequenceBank: snapshot.engine.sequence_bank,
      selectedMeasure,
      selectedLoopQuarterNotes: getMeasureLoopQuarterNotes(selectedMeasure),
      sequenceCount: snapshot.engine.sequence_bank.length,
      patternScopeCellCount: patternScopeCells.length,
      leafPatternScopeIndices: scopeIndices,
      rootCells: directCells,
      selectedMeasureIndex: selectedIndex,
      selectedMeasureNumerator: selectedNumerator,
      selectedMeasureDenominator: selectedDenominator,
      selectedMeasureName: sequenceName,
      timeSignature: signature,
      scaleName: snapshot.engine.scale?.name ?? 'chromatic',
      scaleMode: snapshot.engine.scale?.mode ?? 0,
      scaleSize: snapshot.engine.scale?.intervals.length ?? 0,
      scaleTranslateDirection: snapshot.engine.scale_translate_direction,
      tuningName: snapshot.engine.tuning_name,
      keyDisplay: snapshot.engine.key,
      baseFrequency: snapshot.engine.base_frequency,
      staffLineBandByPitch: staffLineBands,
      leafCells: directLeafCells,
      selectedLeafFlags: selectionFlags,
      selectedCellMeta: getStatusCellMeta(resolvedSelectedCell),
      rulerRatios: tuningRatios,
      highlightedPitches: mappedHighlights,
    }
  }, [snapshot])

  const {
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
  } = useHeaderEditing({
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
  })

  useTransportPlayhead({
    selectedMeasureIndex,
    selectedMeasureNumerator,
    selectedMeasureDenominator,
    transportRef,
    selectedMeasureIndexRef,
    selectedTimeSignatureRef,
    setPlayheadPhase,
  })

  const {
    backgroundOverlayStates,
    pitchRows,
    ratioToBottom,
    selectSequenceFromBank,
    sequenceBankCells,
    renderRollCells,
  } = useSequencerRollState({
    snapshot,
    selectedMeasure,
    selectedLoopQuarterNotes,
    selectedMeasureIndex,
    sequenceBank,
    syncedTransportPhases,
    activeSequenceFlags,
    tuningLength,
    commandText,
    isCommandMode,
    selectedLeafFlags,
    leafCells,
    leafPatternScopeIndices,
    patternScopeCellCount,
    staffLineBandByPitch,
    bridgeUnavailableMessage,
    executeBackendCommand,
    setStatusMessage,
    setStatusLevel,
  })

  const currentInputModeLetter = currentInputMode.charAt(0).toUpperCase()

  const focusCommandBarWithText = useCallback(
    (commandTemplate: string): void => {
      const commandWithoutPlaceholders = commandTemplate.replace(/\[[^\]]*]/g, '')
      const normalizedCommand = commandWithoutPlaceholders.replace(/\s+/g, ' ').trim()
      if (!normalizedCommand) {
        return
      }

      const nextCommandText = `${normalizedCommand} `
      if (historyIndex !== -1) {
        setHistoryIndex(-1)
      }
      setIsCommandMode(true)
      setCommandText(nextCommandText)
      liveCommandBufferRef.current = nextCommandText

      requestAnimationFrame(() => {
        const input = commandInputRef.current
        if (!input) {
          return
        }
        input.focus()
        const textLength = input.value.length
        input.setSelectionRange(textLength, textLength)
      })
    },
    [historyIndex, liveCommandBufferRef, setCommandText, setHistoryIndex, setIsCommandMode]
  )


  const { waveAPreviewPath, waveBPreviewPath, morphedWavePreviewPath } = useMemo(() => {
    const width = 420
    const height = 140
    const steps = 96
    const waveAPoints: string[] = []
    const waveBPoints: string[] = []
    const mixedPoints: string[] = []
    const normalizedWaveAPhase = toNormalizedPhase(lfoAPhaseOffset)
    const normalizedWaveBPhase = toNormalizedPhase(lfoBPhaseOffset)

    for (let index = 0; index <= steps; index += 1) {
      const progress = index / steps
      const x = progress * width
      const waveA = sampleWaveShape(
        waveAType,
        progress * lfoAFrequency + normalizedWaveAPhase,
        waveAPulseWidth
      )
      const waveB = sampleWaveShape(
        waveBType,
        progress * lfoBFrequency + normalizedWaveBPhase,
        waveBPulseWidth
      )
      const mixed = clampNumber(waveA * (1 - waveLerp) + waveB * waveLerp, -1, 1)
      const waveAY = (1 - (waveA + 1) / 2) * height
      const waveBY = (1 - (waveB + 1) / 2) * height
      const mixedY = (1 - (mixed + 1) / 2) * height
      waveAPoints.push(`${x.toFixed(2)},${waveAY.toFixed(2)}`)
      waveBPoints.push(`${x.toFixed(2)},${waveBY.toFixed(2)}`)
      mixedPoints.push(`${x.toFixed(2)},${mixedY.toFixed(2)}`)
    }

    return {
      waveAPreviewPath: waveAPoints.join(' '),
      waveBPreviewPath: waveBPoints.join(' '),
      morphedWavePreviewPath: mixedPoints.join(' '),
    }
  }, [
    lfoAFrequency,
    lfoAPhaseOffset,
    lfoBFrequency,
    lfoBPhaseOffset,
    waveAType,
    waveAPulseWidth,
    waveBType,
    waveBPulseWidth,
    waveLerp,
  ])

  const baseMorphModulator = useMemo(
    () =>
      createMorphModulator(
        waveAType,
        waveBType,
        waveAPulseWidth,
        waveBPulseWidth,
        lfoAFrequency,
        toNormalizedPhase(lfoAPhaseOffset),
        lfoBFrequency,
        toNormalizedPhase(lfoBPhaseOffset),
        waveLerp
      ),
    [
      lfoAFrequency,
      lfoAPhaseOffset,
      lfoBFrequency,
      lfoBPhaseOffset,
      waveAType,
      waveAPulseWidth,
      waveBType,
      waveBPulseWidth,
      waveLerp,
    ]
  )

  const emitCommandsNow = useCallback(
    (commands: string[]): void => {
      if (bridgeUnavailableMessage !== null || commands.length === 0) {
        return
      }

      void executeBackendCommand(commands.join('; ')).catch((error: unknown) => {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      })
    },
    [bridgeUnavailableMessage, executeBackendCommand]
  )

  const scheduleLiveEmit = useCallback(
    (commands: string[]): void => {
      if (bridgeUnavailableMessage !== null || commands.length === 0) {
        return
      }

      liveEmitCommandsRef.current = commands
      if (liveEmitFrameRef.current !== null) {
        return
      }

      liveEmitFrameRef.current = requestAnimationFrame(() => {
        liveEmitFrameRef.current = null
        const pending = liveEmitCommandsRef.current
        liveEmitCommandsRef.current = null
        if (!pending || pending.length === 0) {
          return
        }
        emitCommandsNow(pending)
      })
    },
    [bridgeUnavailableMessage, emitCommandsNow, liveEmitCommandsRef, liveEmitFrameRef]
  )

  useEffect(
    () => () => {
      if (liveEmitFrameRef.current !== null) {
        cancelAnimationFrame(liveEmitFrameRef.current)
        liveEmitFrameRef.current = null
      }
      liveEmitCommandsRef.current = null
    },
    [liveEmitCommandsRef, liveEmitFrameRef]
  )

  useEffect(() => {
    modulatorInstancesRef.current = modulatorInstances
  }, [modulatorInstances, modulatorInstancesRef])

  useEffect(() => {
    const nextState = modulatorInstancesRef.current[activeModulatorTab]
    if (!nextState) {
      return
    }

    isSwitchingModTabRef.current = true
    setWaveAType(nextState.waveAType)
    setWaveBType(nextState.waveBType)
    setWaveAPulseWidth(nextState.waveAPulseWidth)
    setWaveBPulseWidth(nextState.waveBPulseWidth)
    setWaveLerp(nextState.waveLerp)
    setLfoAFrequency(nextState.lfoAFrequency)
    setLfoAPhaseOffset(nextState.lfoAPhaseOffset)
    setLfoBFrequency(nextState.lfoBFrequency)
    setLfoBPhaseOffset(nextState.lfoBPhaseOffset)
    setTargetControls(nextState.targetControls)

    queueMicrotask(() => {
      isSwitchingModTabRef.current = false
    })
  }, [
    activeModulatorTab,
    isSwitchingModTabRef,
    modulatorInstancesRef,
    setLfoAFrequency,
    setLfoAPhaseOffset,
    setLfoBFrequency,
    setLfoBPhaseOffset,
    setTargetControls,
    setWaveAPulseWidth,
    setWaveAType,
    setWaveBPulseWidth,
    setWaveBType,
    setWaveLerp,
  ])

  useEffect(() => {
    if (isSwitchingModTabRef.current) {
      return
    }

    setModulatorInstances((previous) =>
      previous.map((instance, index) =>
        index === activeModulatorTab
          ? {
              ...instance,
              waveAType,
              waveBType,
              waveAPulseWidth,
              waveBPulseWidth,
              waveLerp,
              lfoAFrequency,
              lfoAPhaseOffset,
              lfoBFrequency,
              lfoBPhaseOffset,
              targetControls,
            }
          : instance
      )
    )
  }, [
    activeModulatorTab,
    lfoAFrequency,
    lfoAPhaseOffset,
    lfoBFrequency,
    lfoBPhaseOffset,
    targetControls,
    waveAPulseWidth,
    waveAType,
    waveBPulseWidth,
    waveBType,
    waveLerp,
    isSwitchingModTabRef,
    setModulatorInstances,
  ])

  useEffect(() => {
    if (openWaveMenu === null) {
      return
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const host = waveMenuRef.current
      if (!host) {
        return
      }
      if (event.target instanceof Node && !host.contains(event.target)) {
        setOpenWaveMenu(null)
      }
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpenWaveMenu(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [openWaveMenu, setOpenWaveMenu, waveMenuRef])

  useEffect(() => {
    if (!openScaleMenu) {
      return
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const host = scaleMenuRef.current
      if (!host) {
        return
      }
      if (event.target instanceof Node && !host.contains(event.target)) {
        setOpenScaleMenu(false)
      }
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpenScaleMenu(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [openScaleMenu])

  const updateTargetControl = useCallback(
    (target: ModTarget, update: Partial<TargetControl>): void => {
      setTargetControls((previous) => ({
        ...previous,
        [target]: {
          ...previous[target],
          ...update,
        },
      }))
    },
    [setTargetControls]
  )

  const buildModTargetCommand = useCallback(
    (target: ModTarget, control: TargetControl, modulator: ReturnType<typeof createMorphModulator>): string => {
      const spec = getModTargetSpecForTuning(target, tuningLength)
      const targetModulator = createTargetModulator(modulator, spec, control.center, control.amount)
      return `set ${target} ${JSON.stringify(targetModulator)}`
    },
    [tuningLength]
  )

  const buildModTargetCommands = useCallback(
    (controls: Record<ModTarget, TargetControl>, modulator: ReturnType<typeof createMorphModulator>): string[] =>
      MOD_TARGET_ORDER.filter((target) => controls[target].enabled).map((target) =>
        buildModTargetCommand(target, controls[target], modulator)
      ),
    [buildModTargetCommand]
  )

  const handleWaveLerpChange = useCallback(
    (nextLerp: number): void => {
      setWaveLerp(nextLerp)
      const liveBase = createMorphModulator(
        waveAType,
        waveBType,
        waveAPulseWidth,
        waveBPulseWidth,
        lfoAFrequency,
        toNormalizedPhase(lfoAPhaseOffset),
        lfoBFrequency,
        toNormalizedPhase(lfoBPhaseOffset),
        nextLerp
      )
      scheduleLiveEmit(buildModTargetCommands(targetControls, liveBase))
    },
    [
      buildModTargetCommands,
      lfoAFrequency,
      lfoAPhaseOffset,
      lfoBFrequency,
      lfoBPhaseOffset,
      scheduleLiveEmit,
      setWaveLerp,
      targetControls,
      waveAPulseWidth,
      waveAType,
      waveBPulseWidth,
      waveBType,
    ]
  )

  const applyPadMotion = useCallback(
    (
      target: ModTarget,
      host: HTMLDivElement,
      clientX: number,
      clientY: number,
      mode: 'amount' | 'center',
      dragStart?: {
        startClientX: number
        startClientY: number
        startAmount: number
        startCenter: number
      },
      speedMode?: 'coarse' | 'fine'
    ) => {
      const spec = getModTargetSpecForTuning(target, tuningLength)
      const bounds = host.getBoundingClientRect()
      const xRatio = clampNumber((clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1)
      const currentControl = targetControls[target]

      if (mode === 'center') {
        const nextCenterRaw = spec.min + xRatio * (spec.max - spec.min)
        const nextCenter = roundByStep(nextCenterRaw, spec.step)
        const resolvedCenter = clampNumber(nextCenter, spec.min, spec.max)
        const maxPositiveSpan = spec.max - resolvedCenter
        const maxNegativeSpan = resolvedCenter - spec.min
        const amountLimit = Math.max(maxPositiveSpan, maxNegativeSpan)
        const resolvedAmount = clampNumber(currentControl.amount, -amountLimit, amountLimit)
        updateTargetControl(target, { center: resolvedCenter, amount: resolvedAmount })
        scheduleLiveEmit([
          buildModTargetCommand(
            target,
            { ...currentControl, enabled: true, center: resolvedCenter, amount: resolvedAmount },
            baseMorphModulator
          ),
        ])
        return
      }

      const deltaY = dragStart ? dragStart.startClientY - clientY : 0
      const sensitivityDivisor = speedMode === 'fine' ? 620 : 260
      const targetRange = spec.max - spec.min
      const amountCenter = clampNumber(dragStart?.startCenter ?? currentControl.center, spec.min, spec.max)
      const maxPositiveSpan = spec.max - amountCenter
      const maxNegativeSpan = amountCenter - spec.min
      const amountLimit = Math.max(maxPositiveSpan, maxNegativeSpan)
      const nextAmount = clampNumber(
        (dragStart?.startAmount ?? currentControl.amount) + (deltaY / sensitivityDivisor) * targetRange,
        -amountLimit,
        amountLimit
      )
      updateTargetControl(target, { amount: nextAmount })
      scheduleLiveEmit([
        buildModTargetCommand(target, { ...currentControl, enabled: true, amount: nextAmount }, baseMorphModulator),
      ])
    },
    [baseMorphModulator, buildModTargetCommand, scheduleLiveEmit, targetControls, tuningLength, updateTargetControl]
  )

  const getWaveHandlePosition = useCallback((frequency: number, phaseOffset: number) => {
    const clampedFrequencyRatio = frequencyToRatio(frequency)
    const phaseRatio = 0.5 - phaseOffset
    return {
      x: clampedFrequencyRatio * 100,
      y: clampNumber(phaseRatio, 0, 1) * 100,
    }
  }, [])

  const waveHandleA = useMemo(
    () => getWaveHandlePosition(lfoAFrequency, lfoAPhaseOffset),
    [getWaveHandlePosition, lfoAFrequency, lfoAPhaseOffset]
  )
  const waveHandleB = useMemo(
    () => getWaveHandlePosition(lfoBFrequency, lfoBPhaseOffset),
    [getWaveHandlePosition, lfoBFrequency, lfoBPhaseOffset]
  )
  const waveAOpacity = clampNumber(1 - waveLerp, 0, 1)
  const waveBOpacity = clampNumber(waveLerp, 0, 1)

  const applyWavePadMotion = useCallback(
    (
      wave: 'a' | 'b',
      host: HTMLDivElement,
      clientX: number,
      clientY: number,
      lockMode?: 'none' | 'frequency' | 'offset'
    ): void => {
      const bounds = host.getBoundingClientRect()
      const xRatio = clampNumber((clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1)
      const yRatio = clampNumber((clientY - bounds.top) / Math.max(bounds.height, 1), 0, 1)
      const rawNextFrequency = ratioToFrequency(xRatio)
      const rawNextPhaseOffset = clampNumber(0.5 - yRatio, LFO_PHASE_OFFSET_MIN, LFO_PHASE_OFFSET_MAX)

      const nextFrequency =
        lockMode === 'offset'
          ? wave === 'a'
            ? lfoAFrequency
            : lfoBFrequency
          : rawNextFrequency
      const nextPhaseOffset =
        lockMode === 'frequency'
          ? wave === 'a'
            ? lfoAPhaseOffset
            : lfoBPhaseOffset
          : rawNextPhaseOffset
      const nextAFrequency = wave === 'a' ? nextFrequency : lfoAFrequency
      const nextAPhaseOffset = wave === 'a' ? nextPhaseOffset : lfoAPhaseOffset
      const nextBFrequency = wave === 'b' ? nextFrequency : lfoBFrequency
      const nextBPhaseOffset = wave === 'b' ? nextPhaseOffset : lfoBPhaseOffset

      if (wave === 'a') {
        setLfoAFrequency(nextFrequency)
        setLfoAPhaseOffset(nextPhaseOffset)
      } else {
        setLfoBFrequency(nextFrequency)
        setLfoBPhaseOffset(nextPhaseOffset)
      }
      lastWaveHandleUsedRef.current = wave

      const liveBase = createMorphModulator(
        waveAType,
        waveBType,
        waveAPulseWidth,
        waveBPulseWidth,
        nextAFrequency,
        toNormalizedPhase(nextAPhaseOffset),
        nextBFrequency,
        toNormalizedPhase(nextBPhaseOffset),
        waveLerp
      )
      scheduleLiveEmit(buildModTargetCommands(targetControls, liveBase))
    },
    [
      lfoAFrequency,
      lfoAPhaseOffset,
      lfoBFrequency,
      lfoBPhaseOffset,
      buildModTargetCommands,
      scheduleLiveEmit,
      targetControls,
      waveAPulseWidth,
      waveAType,
      waveBPulseWidth,
      waveBType,
      waveLerp,
      lastWaveHandleUsedRef,
      setLfoAFrequency,
      setLfoAPhaseOffset,
      setLfoBFrequency,
      setLfoBPhaseOffset,
    ]
  )

  const snapWaveToCenterGuides = useCallback(
    (wave: 'a' | 'b', options: { snapFrequency?: boolean; snapOffset?: boolean }): void => {
      const nextAFrequency = wave === 'a' && options.snapFrequency ? 1 : lfoAFrequency
      const nextBFrequency = wave === 'b' && options.snapFrequency ? 1 : lfoBFrequency
      const nextAPhaseOffset = wave === 'a' && options.snapOffset ? 0 : lfoAPhaseOffset
      const nextBPhaseOffset = wave === 'b' && options.snapOffset ? 0 : lfoBPhaseOffset

      if (wave === 'a') {
        if (options.snapFrequency) {
          setLfoAFrequency(1)
        }
        if (options.snapOffset) {
          setLfoAPhaseOffset(0)
        }
      } else {
        if (options.snapFrequency) {
          setLfoBFrequency(1)
        }
        if (options.snapOffset) {
          setLfoBPhaseOffset(0)
        }
      }
      lastWaveHandleUsedRef.current = wave

      const liveBase = createMorphModulator(
        waveAType,
        waveBType,
        waveAPulseWidth,
        waveBPulseWidth,
        nextAFrequency,
        toNormalizedPhase(nextAPhaseOffset),
        nextBFrequency,
        toNormalizedPhase(nextBPhaseOffset),
        waveLerp
      )
      scheduleLiveEmit(buildModTargetCommands(targetControls, liveBase))
    },
    [
      lfoAFrequency,
      lfoAPhaseOffset,
      lfoBFrequency,
      lfoBPhaseOffset,
      buildModTargetCommands,
      scheduleLiveEmit,
      targetControls,
      waveAPulseWidth,
      waveAType,
      waveBPulseWidth,
      waveBType,
      waveLerp,
      lastWaveHandleUsedRef,
      setLfoAFrequency,
      setLfoAPhaseOffset,
      setLfoBFrequency,
      setLfoBPhaseOffset,
    ]
  )

  const selectWaveType = useCallback((wave: 'a' | 'b', waveType: WaveType): void => {
    if (wave === 'a') {
      setWaveAType(waveType)
    } else {
      setWaveBType(waveType)
    }
    setOpenWaveMenu(null)
  }, [setOpenWaveMenu, setWaveAType, setWaveBType])

  const refreshLibraryView = useCallback(async (): Promise<void> => {
    if (bridgeUnavailableMessage !== null || libraryLoading) {
      return
    }

    setLibraryLoading(true)
    try {
      const libraryResponse = await sendBridgeRequest('library.get', {})
      const libraryError = getPayloadError(libraryResponse.payload)
      if (libraryError) {
        throw new Error(libraryError)
      }
      const parsedLibrary = getLibrarySnapshot(libraryResponse.payload)
      setLibrarySnapshot(parsedLibrary)
    } catch (error) {
      setStatusMessage(`Library refresh failed: ${getErrorMessage(error)}`)
      setStatusLevel('error')
    } finally {
      setLibraryLoading(false)
    }
  }, [
    bridgeUnavailableMessage,
    libraryLoading,
    sendBridgeRequest,
    setLibraryLoading,
    setLibrarySnapshot,
  ])

  const runLibraryCommand = useCallback(
    async (command: string): Promise<void> => {
      if (!command || bridgeUnavailableMessage !== null) {
        return
      }

      try {
        await executeBackendCommand(command)
      } catch (error) {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      }
    },
    [bridgeUnavailableMessage, executeBackendCommand]
  )

  const previousLibraryTabRef = useRef(activeLibraryTab)

  useEffect(() => {
    if (isScaleUpdating) {
      setOpenScaleMenu(false)
    }
  }, [isScaleUpdating])

  useEffect(() => {
    if (previousLibraryTabRef.current === activeLibraryTab) {
      return
    }
    previousLibraryTabRef.current = activeLibraryTab
    void refreshLibraryView()
  }, [activeLibraryTab, refreshLibraryView])

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent): void => {
      event.preventDefault()
    }

    window.addEventListener('contextmenu', handleContextMenu)
    return () => window.removeEventListener('contextmenu', handleContextMenu)
  }, [])

  return (
    <div className="app">
      <HeaderSection
        isTimeSignatureEditing={isTimeSignatureEditing}
        timeSignatureInputRef={timeSignatureInputRef}
        timeSignatureDraft={timeSignatureDraft}
        setTimeSignatureDraft={setTimeSignatureDraft}
        commitTimeSignature={commitTimeSignature}
        cancelTimeSignatureEdit={cancelTimeSignatureEdit}
        beginTimeSignatureEdit={beginTimeSignatureEdit}
        bridgeUnavailableMessage={bridgeUnavailableMessage}
        timeSignature={timeSignature}
        applyTimeSignatureScale={applyTimeSignatureScale}
        isKeyEditing={isKeyEditing}
        keyInputRef={keyInputRef}
        keyDraft={keyDraft}
        setKeyDraft={setKeyDraft}
        commitKey={commitKey}
        cancelKeyEdit={cancelKeyEdit}
        beginKeyEdit={beginKeyEdit}
        keyDisplay={keyDisplay}
        isBaseFrequencyEditing={isBaseFrequencyEditing}
        baseFrequencyInputRef={baseFrequencyInputRef}
        baseFrequencyDraft={baseFrequencyDraft}
        setBaseFrequencyDraft={setBaseFrequencyDraft}
        commitBaseFrequency={commitBaseFrequency}
        cancelBaseFrequencyEdit={cancelBaseFrequencyEdit}
        beginBaseFrequencyEdit={beginBaseFrequencyEdit}
        baseFrequency={baseFrequency}
        scaleMenuRef={scaleMenuRef}
        openScaleMenu={openScaleMenu}
        setOpenScaleMenu={setOpenScaleMenu}
        isScaleUpdating={isScaleUpdating}
        scaleOptions={scaleOptions}
        scaleName={scaleName}
        applyScaleSelection={applyScaleSelection}
        scaleTranslateDirection={scaleTranslateDirection}
        toggleTranslateDirection={toggleTranslateDirection}
        modeOptions={modeOptions}
        scaleMode={scaleMode}
        applyModeSelection={applyModeSelection}
        tuningName={tuningName}
        selectedMeasureIndex={selectedMeasureIndex}
        isSequenceNameEditing={isSequenceNameEditing}
        sequenceNameInputRef={sequenceNameInputRef}
        sequenceNameDraft={sequenceNameDraft}
        setSequenceNameDraft={setSequenceNameDraft}
        commitSequenceName={commitSequenceName}
        cancelSequenceNameEdit={cancelSequenceNameEdit}
        beginSequenceNameEdit={beginSequenceNameEdit}
        selectedMeasureName={selectedMeasureName}
      />
      <SequencerSection
        bridgeUnavailableMessage={bridgeUnavailableMessage}
        pitchRows={pitchRows}
        backgroundOverlayStates={backgroundOverlayStates}
        tuningLength={tuningLength}
        renderRollCells={renderRollCells}
        rootCells={rootCells}
        playheadPhase={playheadPhase}
        ratioToBottom={ratioToBottom}
        rulerRatios={rulerRatios}
        highlightedPitches={highlightedPitches}
      />
      <StatusSection
        currentInputMode={currentInputMode}
        currentInputModeLetter={currentInputModeLetter}
        isCommandMode={isCommandMode}
        submitCommand={submitCommand}
        commandInputRef={commandInputRef}
        commandText={commandText}
        setCommandText={setCommandText}
        historyIndex={historyIndex}
        setHistoryIndex={setHistoryIndex}
        commandSuffix={commandSuffix}
        closeCommandMode={closeCommandMode}
        commandHistory={commandHistory}
        liveCommandBufferRef={liveCommandBufferRef}
        statusLevel={statusLevel}
        statusMessage={statusMessage}
        selectedCellMeta={selectedCellMeta}
      />
      <BottomModulesSection
        sequenceBankCells={sequenceBankCells}
        selectedMeasureIndex={selectedMeasureIndex}
        activeSequenceFlags={activeSequenceFlags}
        sequenceCount={sequenceCount}
        selectSequenceFromBank={selectSequenceFromBank}
        activeModulatorTab={activeModulatorTab}
        setOpenWaveMenu={setOpenWaveMenu}
        setActiveModulatorTab={setActiveModulatorTab}
        waveMenuRef={waveMenuRef}
        openWaveMenu={openWaveMenu}
        waveAType={waveAType}
        waveBType={waveBType}
        selectWaveType={selectWaveType}
        waveLerp={waveLerp}
        onWaveLerpChange={handleWaveLerpChange}
        waveAPulseWidth={waveAPulseWidth}
        setWaveAPulseWidth={setWaveAPulseWidth}
        waveBPulseWidth={waveBPulseWidth}
        setWaveBPulseWidth={setWaveBPulseWidth}
        wavePadDragRef={wavePadDragRef}
        clampNumber={clampNumber}
        waveHandleA={waveHandleA}
        waveHandleB={waveHandleB}
        lastWaveHandleUsedRef={lastWaveHandleUsedRef}
        snapWaveToCenterGuides={snapWaveToCenterGuides}
        applyWavePadMotion={applyWavePadMotion}
        waveAOpacity={waveAOpacity}
        waveBOpacity={waveBOpacity}
        waveAPreviewPath={waveAPreviewPath}
        waveBPreviewPath={waveBPreviewPath}
        morphedWavePreviewPath={morphedWavePreviewPath}
        targetControls={targetControls}
        updateTargetControl={updateTargetControl}
        padDragRef={padDragRef}
        applyPadMotion={applyPadMotion}
        scheduleLiveEmit={scheduleLiveEmit}
        buildCommandForTarget={buildModTargetCommand}
        baseMorphModulator={baseMorphModulator}
        tuningLength={tuningLength}
        activeReferenceTab={activeReferenceTab}
        setActiveReferenceTab={setActiveReferenceTab}
        sessionReference={sessionReference}
        referenceSearchInputRef={referenceSearchInputRef}
        referenceCommandSearch={referenceCommandSearch}
        setReferenceCommandSearch={setReferenceCommandSearch}
        filteredReferenceCommands={filteredReferenceCommands}
        focusCommandBarWithText={focusCommandBarWithText}
        sequenceViewReferenceBindings={sequenceViewReferenceBindings}
        activeLibraryTab={activeLibraryTab}
        setActiveLibraryTab={setActiveLibraryTab}
        librarySnapshot={librarySnapshot}
        runLibraryCommand={runLibraryCommand}
        quoteCommandArg={quoteCommandArg}
        tuningSearchInputRef={tuningSearchInputRef}
        tuningSearch={tuningSearch}
        setTuningSearch={setTuningSearch}
        tuningSortMode={tuningSortMode}
        setTuningSortMode={setTuningSortMode}
        tuningHierarchyRows={tuningHierarchyRows}
        formatOctaveForDisplay={formatOctaveForDisplay}
        sequenceSearchInputRef={sequenceSearchInputRef}
        sequenceSearch={sequenceSearch}
        setSequenceSearch={setSequenceSearch}
        sequenceHierarchyRows={sequenceHierarchyRows}
      />
    </div>
  )
}

export default App
