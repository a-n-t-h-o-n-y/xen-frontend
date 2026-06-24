import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { HeaderSection } from './app/sections/HeaderSection'
import { BottomModulesSection } from './app/sections/BottomModulesSection'
import { useBridgeSession } from './app/hooks/useBridgeSession'
import { useCommandState } from './app/hooks/useCommandState'
import { recognizeCommandIds } from './app/domain/commandCompletion'
import { useHeaderEditing } from './app/hooks/useHeaderEditing'
import { useLibraryPanelState } from './app/hooks/useLibraryPanelState'
import { useModulatorPanelState } from './app/hooks/useModulatorPanelState'
import { useSequencerRollState } from './app/hooks/useSequencerRollState'
import { useTransportPlayhead } from './app/hooks/useTransportPlayhead'
import { SequencerSection } from './app/sections/SequencerSection'
import { StatusSection } from './app/sections/StatusSection'
import { SettingsOverlay } from './app/sections/SettingsOverlay'
import { LibraryPanel } from './app/sections/bottom/LibraryPanel'
import {
  MAX_COMMAND_HISTORY,
  DEFAULT_TUNING_LENGTH,
  LFO_PHASE_OFFSET_MIN,
  LFO_PHASE_OFFSET_MAX,
  clampNumber,
  roundByStep,
  toNormalizedPhase,
  frequencyToRatio,
  ratioToFrequency,
  createTransportState,
  getErrorMessage,
  getPayloadError,
  formatOctaveForDisplay,
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
  getChildCells,
  getSelectedElement,
  normalizePitch,
  isPathPrefix,
  getCellAtPath,
  getStatusCellMeta,
} from './app/shared'
import type {
  MessageLevel,
  TranslateDirection,
  Cell,
  EditorState,
  TransportState,
  ModTarget,
  WaveType,
  TargetControl,
  LeafCell,
  StatusCellMetaItem,
  SelectionStep,
} from './app/shared'
import {
  expandNumericPlaceholders,
  findKeymapBinding,
  triggersEqual,
} from './app/domain/keymap'
import { isCommandUiActionId } from './app/domain/uiActions'
import {
  moveSelection,
  projectRootCell,
  resolveSelection,
} from './app/domain/selection'
import { parseKeymapResource } from './app/domain/contracts'
import type {
  KeymapResource,
  KeymapTarget,
  KeymapTrigger,
  ProjectSnapshot,
} from './app/domain/contracts'

type WorkspaceView = 'sequencer' | 'library'

function App() {
  const [editorState, setEditorState] = useState<EditorState>({
    selection: { path: [] },
    inputMode: 'pitch',
  })
  const [statusMessage, setStatusMessage] = useState('')
  const [statusLevel, setStatusLevel] = useState<MessageLevel>('info')
  const [bridgeUnavailableMessage, setBridgeUnavailableMessage] = useState<string | null>(null)
  const [projectSnapshot, setProjectSnapshot] = useState<ProjectSnapshot | null>(null)
  const [openScaleMenu, setOpenScaleMenu] = useState(false)
  const [keymapResource, setKeymapResource] = useState<KeymapResource | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('sequencer')
  const [keymapBusy, setKeymapBusy] = useState(false)
  const [keymapError, setKeymapError] = useState<string | null>(null)
  const {
    isCommandMode,
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
  } = useCommandState()
  const eventTokenRef = useRef<unknown>(null)
  const commandInputRef = useRef<HTMLInputElement>(null)
  const timeSignatureInputRef = useRef<HTMLInputElement>(null)
  const keyInputRef = useRef<HTMLInputElement>(null)
  const baseFrequencyInputRef = useRef<HTMLInputElement>(null)
  const scaleMenuRef = useRef<HTMLDivElement | null>(null)
  const projectRef = useRef<ProjectSnapshot | null>(null)
  const editorStateRef = useRef<EditorState>(editorState)
  const libraryRevisionRef = useRef(-1)
  const keymapRef = useRef<KeymapResource | null>(null)
  const pendingNumberRef = useRef('')
  const lastShortcutCommandRef = useRef<{ command: 'copy' | 'cut' | 'paste'; at: number } | null>(
    null
  )
  const transportRef = useRef<TransportState>(createTransportState())
  const selectedTimeSignatureRef = useRef({ numerator: 4, denominator: 4 })
  const [playheadPhase, setPlayheadPhase] = useState<number | null>(null)
  const {
    tuningSearch,
    setTuningSearch,
    tuningSearchInputRef,
    measureSearch,
    setMeasureSearch,
    measureSearchInputRef,
    tuningSortMode,
    setTuningSortMode,
    sessionReference,
    setSessionReference,
    librarySnapshot,
    setLibrarySnapshot,
    setLibraryLoading,
    tuningHierarchyRows,
    measureHierarchyRows,
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
  const { sendBridgeRequest, ingestKeymap, executeBackendCommand } = useBridgeSession({
    eventTokenRef,
    transportRef,
    projectRef,
    editorStateRef,
    libraryRevisionRef,
    keymapRef,
    setProject: setProjectSnapshot,
    setEditorState,
    setStatusMessage,
    setStatusLevel,
    setBridgeUnavailableMessage,
    setSessionReference,
    setKeymapResource,
    setLibraryLoading,
    setLibrarySnapshot,
    setPlayheadPhase,
  })

  const installEditorState = useCallback((nextState: EditorState): void => {
    editorStateRef.current = nextState
    setEditorState(nextState)
  }, [])

  const refreshKeymap = useCallback(async (): Promise<void> => {
    const response = await sendBridgeRequest('keymap.get', {})
    const payloadError = getPayloadError(response.payload)
    if (payloadError) throw new Error(payloadError)
    ingestKeymap(response.payload)
  }, [ingestKeymap, sendBridgeRequest])

  const mutateKeymap = useCallback(async (
    name: 'keymap.override.set' | 'keymap.override.remove' | 'keymap.reset',
    payload: Record<string, unknown>
  ): Promise<void> => {
    const current = keymapRef.current
    if (!current) throw new Error('Keymap is not loaded')
    setKeymapBusy(true)
    setKeymapError(null)
    try {
      const response = await sendBridgeRequest(name, {
        expected_revision: current.revision,
        ...payload,
      })
      const payloadError = getPayloadError(response.payload)
      if (payloadError) {
        const rawError = response.payload.error
        const code = typeof rawError === 'object' && rawError !== null
          ? (rawError as Record<string, unknown>).code
          : null
        if (code === 'invalid_request') {
          await refreshKeymap()
          throw new Error('Shortcuts changed elsewhere. The latest version was loaded; retry your edit.')
        }
        throw new Error(payloadError)
      }
      ingestKeymap(parseKeymapResource(response.payload))
    } catch (error) {
      const message = getErrorMessage(error)
      setKeymapError(message)
      throw error
    } finally {
      setKeymapBusy(false)
    }
  }, [ingestKeymap, keymapRef, refreshKeymap, sendBridgeRequest])

  const setKeymapOverride = useCallback(async (
    context: string,
    trigger: KeymapTrigger,
    target: KeymapTarget,
    originalTrigger?: KeymapTrigger
  ): Promise<void> => {
    await mutateKeymap('keymap.override.set', { context, trigger, target })
    if (!originalTrigger || triggersEqual(originalTrigger, trigger)) return

    const originalWasOverride = keymapRef.current?.overrides.some((override) =>
      override.context === context && triggersEqual(override.trigger, originalTrigger)
    )
    if (originalWasOverride) {
      await mutateKeymap('keymap.override.remove', { context, trigger: originalTrigger })
    } else {
      await mutateKeymap('keymap.override.set', {
        context,
        trigger: originalTrigger,
        target: null,
      })
    }
  }, [mutateKeymap])

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
  }, [isCommandMode])

  const toggleWorkspaceView = useCallback((): void => {
    setWorkspaceView((current) => current === 'sequencer' ? 'library' : 'sequencer')
  }, [])

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent): void => {
      const editableTarget = isEditableTarget(event.target)

      if (bridgeUnavailableMessage !== null) {
        return
      }

      if (settingsOpen) {
        return
      }

      if (editableTarget) {
        return
      }

      const isDigitKey =
        event.key.length === 1 &&
        event.key >= '0' &&
        event.key <= '9' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey

      const matchedBinding = findKeymapBinding(
        keymapRef.current,
        'sequence',
        event,
        editorStateRef.current.inputMode
      )

      if (matchedBinding) {
        event.preventDefault()
        void (async () => {
          try {
            if (matchedBinding.target.type === 'command') {
              const command = expandNumericPlaceholders(
                matchedBinding.target.command,
                pendingNumberRef.current
              )
              const normalizedCommand = command.trim().toLowerCase()
              if (
                normalizedCommand === 'copy' ||
                normalizedCommand === 'cut' ||
                normalizedCommand === 'paste'
              ) {
                lastShortcutCommandRef.current = {
                  command: normalizedCommand,
                  at: Date.now(),
                }
              }
              await executeBackendCommand(command)
              return
            }

            if (matchedBinding.target.action === 'selection.move') {
              const project = projectRef.current
              if (!project) return
              const selection = moveSelection(
                projectRootCell(project),
                editorStateRef.current.selection,
                matchedBinding.target.arguments.direction,
                matchedBinding.target.arguments.amount
              )
              installEditorState({ ...editorStateRef.current, selection })
              return
            }

            if (matchedBinding.target.action === 'input_mode.set') {
              installEditorState({
                ...editorStateRef.current,
                inputMode: matchedBinding.target.arguments.mode,
              })
              return
            }

            if (matchedBinding.target.action === 'workspace.view.toggle') {
              toggleWorkspaceView()
              return
            }

            if (
              isCommandUiActionId(matchedBinding.target.action) &&
              matchedBinding.target.action === 'command.open'
            ) {
              openCommandMode()
            }
          } catch (error) {
            setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
            setStatusLevel('error')
          }
        })()
        pendingNumberRef.current = ''
        return
      }

      if (!isCommandMode && isDigitKey) {
        pendingNumberRef.current = `${pendingNumberRef.current}${event.key}`
        event.preventDefault()
        return
      }

      pendingNumberRef.current = ''

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
    executeBackendCommand,
    installEditorState,
    isCommandMode,
    openCommandMode,
    settingsOpen,
    toggleWorkspaceView,
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
    async (): Promise<void> => {
      const command = commandText.trim()
      if (!command) {
        closeCommandMode({ preserveText: true })
        return
      }

      setCommandHistory((previous) => [command, ...previous].slice(0, MAX_COMMAND_HISTORY))
      const recognizedCommandIds = recognizeCommandIds(command, sessionReference.commands)
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
      executeBackendCommand,
      liveCommandBufferRef,
      sessionReference.commands,
      setCommandHistory,
      setHistoryIndex,
      setRecentCommandIds,
    ]
  )

  const {
    tuningLength,
    rootCell,
    measureNumerator,
    measureDenominator,
    timeSignature,
    scaleName,
    scaleSourceId,
    scaleMode,
    scaleSize,
    scaleTranslateDirection,
    tuningName,
    keyDisplay,
    baseFrequency,
    staffLineBandByPitch,
    selectedCellMeta,
    rulerRatios,
    highlightedPitches,
  } = useMemo(() => {
    if (!projectSnapshot) {
      const defaultStaffLineBand = Array.from(
        { length: DEFAULT_TUNING_LENGTH },
        (_, pitch) => (pitch % 2 === 0 ? 0 : 1)
      )
      return {
        tuningLength: DEFAULT_TUNING_LENGTH,
        patternScopeCellCount: 0,
        leafPatternScopeIndices: [] as number[],
        rootCell: { weight: 1, elements: [] } as Cell,
        measureNumerator: 4,
        measureDenominator: 4,
        timeSignature: '4/4',
        scaleName: 'major diatonic',
        scaleSourceId: null as string | null,
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
        selectedCellPath: [] as number[],
        selectedElementIndex: null as number | null,
        selectedElementKind: null as SelectionStep['kind'] | null,
      }
    }

    const pitchState = projectSnapshot.project.pitch
    const activeScale = pitchState.scale
    const rawTuningLength = pitchState.tuning.definition.intervals.length
    const derivedTuningLength = rawTuningLength > 0 ? rawTuningLength : DEFAULT_TUNING_LENGTH
    const measure = projectSnapshot.project.measure
    const scaleValidPitches = activeScale
      ? generateValidPitches(activeScale.definition, derivedTuningLength)
      : []
    const translateDirection = pitchState.translation_direction

    const mapPitch = (pitch: number): number =>
      mapPitchToScale(pitch, scaleValidPitches, derivedTuningLength, translateDirection)

    const rootCell = measure.cell

    const tuningRatios = getTuningRatios(pitchState.tuning.definition.intervals)
    const rowMap = Array.from({ length: derivedTuningLength }, (_, pitch) => mapPitch(pitch))
    const hasScale = activeScale !== null
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

    const signature = `${measure.time_signature.numerator}/${measure.time_signature.denominator}`
    const selectedNumerator = measure.time_signature.numerator
    const selectedDenominator = measure.time_signature.denominator
    const directLeafCells = collectLeafCells(rootCell)
    const selection = resolveSelection(rootCell, editorState.selection)
    const selectedCellPath = selection?.cellPath ?? []
    const resolvedSelectedCell = selection?.selectedCell ?? rootCell
    const resolvedSelectedElement = selection?.selectedElement ?? null
    const selectedPitchSource = resolvedSelectedElement ?? resolvedSelectedCell ?? rootCell
    const selectedPitches = collectNotePitches(selectedPitchSource)
    const mappedHighlights = new Set(
      selectedPitches.map((pitch) =>
        normalizePitch(mapPitch(normalizePitch(pitch, derivedTuningLength)), derivedTuningLength)
      )
    )
    const selectedElementForScope =
      resolvedSelectedElement ?? getSelectedElement(resolvedSelectedCell ?? rootCell, null)
    const patternScopePath =
      selectedElementForScope?.type === 'Sequence'
        ? selectedCellPath
        : selectedCellPath.length > 0
          ? selectedCellPath.slice(0, -1)
          : []
    const patternScopeCell = getCellAtPath(rootCell, patternScopePath)
    const patternScopeCells = patternScopeCell ? getChildCells(patternScopeCell) : []
    const scopeIndices = directLeafCells.map((leafCell) => {
      if (!isPathPrefix(patternScopePath, leafCell.path)) {
        return -1
      }
      return leafCell.path[patternScopePath.length] ?? -1
    })
    const selectionFlags = directLeafCells.map((leafCell) =>
      isPathPrefix(selectedCellPath, leafCell.path)
    )

    return {
      tuningLength: derivedTuningLength,
      patternScopeCellCount: patternScopeCells.length,
      leafPatternScopeIndices: scopeIndices,
      rootCell,
      measureNumerator: selectedNumerator,
      measureDenominator: selectedDenominator,
      timeSignature: signature,
      scaleName: activeScale?.definition.name ?? 'chromatic',
      scaleSourceId: activeScale?.source_id ?? 'chromatic',
      scaleMode: activeScale?.definition.mode ?? 0,
      scaleSize: activeScale?.definition.intervals.length ?? 0,
      scaleTranslateDirection: pitchState.translation_direction,
      tuningName: pitchState.tuning.name,
      keyDisplay: pitchState.transposition,
      baseFrequency: pitchState.base_frequency,
      staffLineBandByPitch: staffLineBands,
      leafCells: directLeafCells,
      selectedLeafFlags: selectionFlags,
      selectedCellMeta: getStatusCellMeta(resolvedSelectedCell, resolvedSelectedElement),
      rulerRatios: tuningRatios,
      highlightedPitches: mappedHighlights,
      selectedCellPath,
      selectedElementIndex: selection?.selectedElementIndex ?? null,
      selectedElementKind: selection?.selectedElementKind ?? null,
    }
  }, [editorState.selection, projectSnapshot])

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
  } = useHeaderEditing({
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
  })

  useTransportPlayhead({
    measureNumerator,
    measureDenominator,
    transportRef,
    selectedTimeSignatureRef,
    setPlayheadPhase,
  })

  const {
    backgroundOverlayStates,
    cellMuteWindow,
    pitchRows,
    ratioToBottom,
    sequenceDividerPositions,
    rollNotes,
    selectionSpans,
  } = useSequencerRollState({
    rootCell,
    selectionPath: editorState.selection.path,
    tuningLength,
  })

  const currentInputModeLetter = editorState.inputMode.charAt(0).toUpperCase()

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
      />
      <section className="workspaceSection" aria-label="Workspace">
        <div
          className="workspacePane"
          hidden={workspaceView !== 'sequencer'}
          aria-hidden={workspaceView !== 'sequencer'}
        >
          <SequencerSection
            bridgeUnavailableMessage={bridgeUnavailableMessage}
            pitchRows={pitchRows}
            staffLineBandByPitch={staffLineBandByPitch}
            backgroundOverlayStates={backgroundOverlayStates}
            cellMuteWindow={cellMuteWindow}
            sequenceDividerPositions={sequenceDividerPositions}
            selectionSpans={selectionSpans}
            tuningLength={tuningLength}
            rollNotes={rollNotes}
            playheadPhase={playheadPhase}
            ratioToBottom={ratioToBottom}
            rulerRatios={rulerRatios}
            highlightedPitches={highlightedPitches}
          />
        </div>
        <div
          className="workspacePane"
          hidden={workspaceView !== 'library'}
          aria-hidden={workspaceView !== 'library'}
        >
          <LibraryPanel
            librarySnapshot={librarySnapshot}
            activeTuningName={tuningName}
            activeScaleId={scaleSourceId}
            runLibraryCommand={runLibraryCommand}
            tuningSearchInputRef={tuningSearchInputRef}
            tuningSearch={tuningSearch}
            setTuningSearch={setTuningSearch}
            tuningSortMode={tuningSortMode}
            setTuningSortMode={setTuningSortMode}
            tuningHierarchyRows={tuningHierarchyRows}
            formatOctaveForDisplay={formatOctaveForDisplay}
            measureSearchInputRef={measureSearchInputRef}
            measureSearch={measureSearch}
            setMeasureSearch={setMeasureSearch}
            measureHierarchyRows={measureHierarchyRows}
          />
        </div>
      </section>
      <BottomModulesSection
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
      />
      <StatusSection
        currentInputMode={editorState.inputMode}
        currentInputModeLetter={currentInputModeLetter}
        workspaceView={workspaceView}
        setWorkspaceView={setWorkspaceView}
        isCommandMode={isCommandMode}
        submitCommand={submitCommand}
        keymapResource={keymapResource}
        commandInputRef={commandInputRef}
        commandText={commandText}
        setCommandText={setCommandText}
        historyIndex={historyIndex}
        setHistoryIndex={setHistoryIndex}
        closeCommandMode={closeCommandMode}
        commandHistory={commandHistory}
        liveCommandBufferRef={liveCommandBufferRef}
        commands={sessionReference.commands}
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
        statusLevel={statusLevel}
        statusMessage={statusMessage}
        selectedCellMeta={selectedCellMeta}
        onOpenSettings={() => {
          setKeymapError(null)
          setSettingsOpen(true)
        }}
      />
      <SettingsOverlay
        open={settingsOpen}
        resource={keymapResource}
        commands={sessionReference.commands}
        busy={keymapBusy}
        error={keymapError}
        onClose={() => setSettingsOpen(false)}
        onSetOverride={setKeymapOverride}
        onDisable={(context, trigger) =>
          mutateKeymap('keymap.override.set', { context, trigger, target: null })
        }
        onRestore={(context, trigger) =>
          mutateKeymap('keymap.override.remove', { context, trigger })
        }
        onReset={() => mutateKeymap('keymap.reset', {})}
      />
    </div>
  )
}

export default App
