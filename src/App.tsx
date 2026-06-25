import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { HeaderSection } from './app/sections/HeaderSection'
import { useCommandState } from './app/hooks/useCommandState'
import { useHeaderEditing } from './app/hooks/useHeaderEditing'
import { useLibraryPanelState } from './app/hooks/useLibraryPanelState'
import { useModulatorPanelState } from './app/hooks/useModulatorPanelState'
import { useProjectSession } from './app/hooks/useProjectSession'
import { useCommandController } from './app/hooks/useCommandController'
import { useKeyboardController } from './app/hooks/useKeyboardController'
import { useModulatorController } from './app/hooks/useModulatorController'
import { useSequencerRollState } from './app/hooks/useSequencerRollState'
import { useTransportPlayhead } from './app/hooks/useTransportPlayhead'
import { CompositionSection } from './app/sections/CompositionSection'
import { SequencerSection } from './app/sections/SequencerSection'
import { StatusSection } from './app/sections/StatusSection'
import { SettingsOverlay } from './app/sections/SettingsOverlay'
import { LibraryPanel } from './app/sections/bottom/LibraryPanel'
import { ModulatorsPanel } from './app/sections/bottom/ModulatorsPanel'
import {
  DEFAULT_TUNING_LENGTH,
  createTransportState,
} from './app/constants'
import { getErrorMessage } from './app/utils/errors'
import {
  clampNumber,
  getTuningRatios,
  generateValidPitches,
  mapPitchToScale,
  collectNotePitches,
  getChildCells,
  getSelectedElement,
  normalizePitch,
} from './app/domain/music'
import {
  clampCompositionSelection,
  getActiveMeasureTarget,
  measureFromTarget,
} from './app/domain/composition'
import {
  collectLeafCells,
  formatOctaveForDisplay,
  isPathPrefix,
  getCellAtPath,
  getStatusCellMeta,
} from './app/presentation/viewModels'
import type {
  Cell,
  ActiveMeasureTarget,
  CompositionSelection,
  EditorState,
  TransportState,
} from './app/domain/models'
import { resolveSelection } from './app/domain/selection'

type WorkspaceView = 'composition' | 'sequencer' | 'library'

const EMPTY_ROOT_CELL: Cell = { weight: 1, elements: [] }
const INITIAL_COMPOSITION_SELECTION: CompositionSelection = { rowIndex: 0, columnIndex: 0 }

function App() {
  const [editorState, setEditorState] = useState<EditorState>({
    selection: { path: [] },
    inputMode: 'pitch',
  })
  const [openScaleMenu, setOpenScaleMenu] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsOpenerRef = useRef<HTMLElement | null>(null)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('sequencer')
  const [compositionSelection, setCompositionSelection] = useState<CompositionSelection>(
    INITIAL_COMPOSITION_SELECTION
  )
  const [activeMeasureTarget, setActiveMeasureTarget] = useState<ActiveMeasureTarget | null>(null)
  const compositionSelectionRef = useRef<CompositionSelection>(compositionSelection)
  const workspaceViewRef = useRef<WorkspaceView>(workspaceView)
  const [isModulatorMode, setIsModulatorMode] = useState(false)
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
  const commandInputRef = useRef<HTMLInputElement>(null)
  const timeSignatureInputRef = useRef<HTMLInputElement>(null)
  const keyInputRef = useRef<HTMLInputElement>(null)
  const baseFrequencyInputRef = useRef<HTMLInputElement>(null)
  const scaleMenuRef = useRef<HTMLDivElement | null>(null)
  const editorStateRef = useRef<EditorState>(editorState)
  const transportRef = useRef<TransportState>(createTransportState())
  const selectedTimeSignatureRef = useRef({ numerator: 4, denominator: 4 })
  const [playheadPhase, setPlayheadPhase] = useState<number | null>(null)
  const [modulatorPreviewWidth, setModulatorPreviewWidth] = useState(0)
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
    activeModulatorTab,
    selectActiveModulatorTab,
    activeModulator,
    updateActiveModulator,
    updateActiveTargetControl,
    setOpenWaveMenu,
    padDragRef,
    wavePadDragRef,
    lastWaveHandleUsedRef,
    liveEmitFrameRef,
    liveEmitCommandsRef,
  } = useModulatorPanelState()
  const {
    projectState,
    statusMessage,
    statusLevel,
    setStatusMessage,
    setStatusLevel,
    bridgeUnavailableMessage,
    projectRef,
    keymapRef,
    keymapController,
    executeBackendCommand,
  } = useProjectSession({
    transportRef,
    editorStateRef,
    setEditorState,
    setSessionReference,
    setLibrarySnapshot,
    setLibraryLoading,
    setPlayheadPhase,
  })

  const installEditorState = useCallback((nextState: EditorState): void => {
    editorStateRef.current = nextState
    setEditorState(nextState)
  }, [])

  const isProjectReady = projectState.status === 'ready'
  const projectSnapshot = isProjectReady ? projectState.snapshot : null
  const disabledReason = isProjectReady
    ? null
    : projectState.status === 'error'
      ? projectState.message
      : 'Project is loading'

  const { submitCommand } = useCommandController({
    isCommandMode,
    commandText,
    commandInputRef,
    setCommandHistory,
    setHistoryIndex,
    liveCommandBufferRef,
    closeCommandMode,
    setRecentCommandIds,
    commands: sessionReference.commands,
    executeBackendCommand,
    setStatusMessage,
    setStatusLevel,
  })

  const installCompositionSelection = useCallback((nextSelection: CompositionSelection): void => {
    compositionSelectionRef.current = nextSelection
    setCompositionSelection(nextSelection)
  }, [])

  const installWorkspaceView = useCallback((
    nextView: WorkspaceView | ((current: WorkspaceView) => WorkspaceView)
  ): void => {
    setWorkspaceView((current) => {
      const resolved = typeof nextView === 'function' ? nextView(current) : nextView
      workspaceViewRef.current = resolved
      return resolved
    })
  }, [])

  const projectViewModel = useMemo(() => {
    if (!projectSnapshot) {
      return null
    }

    const pitchState = projectSnapshot.pitch
    const activeScale = pitchState.scale
    const rawTuningLength = pitchState.tuning.definition.intervals.length
    const derivedTuningLength = rawTuningLength > 0 ? rawTuningLength : DEFAULT_TUNING_LENGTH
    const measure = measureFromTarget(
      projectSnapshot.measure,
      projectSnapshot.measureBank,
      projectSnapshot.composition,
      activeMeasureTarget
    )
    const scaleValidPitches = activeScale
      ? generateValidPitches(activeScale.definition, derivedTuningLength)
      : []
    const translateDirection = pitchState.translationDirection

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

    const signature = `${measure.timeSignature.numerator}/${measure.timeSignature.denominator}`
    const selectedNumerator = measure.timeSignature.numerator
    const selectedDenominator = measure.timeSignature.denominator
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
      scaleSourceId: activeScale?.sourceId ?? 'chromatic',
      scaleMode: activeScale?.definition.mode ?? 0,
      scaleSize: activeScale?.definition.intervals.length ?? 0,
      scaleTranslateDirection: pitchState.translationDirection,
      tuningName: pitchState.tuning.name,
      keyDisplay: pitchState.transposition,
      baseFrequency: pitchState.baseFrequency,
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
  }, [activeMeasureTarget, editorState.selection, projectSnapshot])

  const tuningLength = projectViewModel?.tuningLength ?? DEFAULT_TUNING_LENGTH
  const rootCell = projectViewModel?.rootCell ?? EMPTY_ROOT_CELL
  const measureNumerator = projectViewModel?.measureNumerator ?? 0
  const measureDenominator = projectViewModel?.measureDenominator ?? 0
  const timeSignature = projectViewModel?.timeSignature ?? '--'
  const scaleName = projectViewModel?.scaleName ?? '--'
  const scaleSourceId = projectViewModel?.scaleSourceId ?? null
  const scaleMode = projectViewModel?.scaleMode ?? 0
  const scaleSize = projectViewModel?.scaleSize ?? 0
  const scaleTranslateDirection = projectViewModel?.scaleTranslateDirection ?? 'up'
  const tuningName = projectViewModel?.tuningName ?? '--'
  const keyDisplay = projectViewModel?.keyDisplay ?? '--'
  const baseFrequency = projectViewModel?.baseFrequency ?? '--'
  const staffLineBandByPitch = projectViewModel?.staffLineBandByPitch ?? []
  const selectedCellMeta = projectViewModel?.selectedCellMeta ?? []
  const rulerRatios = projectViewModel?.rulerRatios ?? []
  const highlightedPitches = projectViewModel?.highlightedPitches ?? new Set<number>()

  const displayedCompositionSelection = projectSnapshot?.composition
    ? clampCompositionSelection(projectSnapshot.composition, compositionSelection)
    : compositionSelection

  const editSelectedCompositionCell = useCallback((): void => {
    const composition = projectRef.current?.composition
    if (!composition) {
      return
    }

    const target = getActiveMeasureTarget(composition, compositionSelectionRef.current)
    if (!target) {
      setStatusMessage('Empty composition cell. Assign a measure before opening it.')
      setStatusLevel('warning')
      return
    }

    setActiveMeasureTarget(target)
    installEditorState({ ...editorStateRef.current, selection: { path: [] } })
    installWorkspaceView('sequencer')
  }, [
    editorStateRef,
    installEditorState,
    installWorkspaceView,
    projectRef,
    setStatusLevel,
    setStatusMessage,
  ])

  const setLoopBoundary = useCallback((boundary: 'start' | 'end'): void => {
    const composition = projectRef.current?.composition
    if (!composition || bridgeUnavailableMessage !== null) {
      return
    }

    const selection = clampCompositionSelection(composition, compositionSelectionRef.current)
    const command = `composition loop ${boundary} ${selection.columnIndex}`
    void executeBackendCommand(command).catch((error: unknown) => {
      setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
      setStatusLevel('error')
    })
  }, [
    bridgeUnavailableMessage,
    executeBackendCommand,
    projectRef,
    setStatusLevel,
    setStatusMessage,
  ])

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
    bridgeUnavailableMessage: disabledReason,
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

  const {
    waveAPreviewPath,
    waveBPreviewPath,
    morphedWavePreviewPath,
    setTargetEnabled,
    toggleTargetEnabled,
    resetTargetControl,
    handleWaveLerpChange,
    handleWaveAPulseWidthChange,
    handleWaveBPulseWidthChange,
    applyPadMotion,
    waveHandleA,
    waveHandleB,
    waveAOpacity,
    waveBOpacity,
    applyWavePadMotion,
    snapWaveToCenterGuides,
    selectWaveType,
  } = useModulatorController({
    bridgeUnavailableMessage,
    tuningLength,
    modulatorPreviewWidth,
    executeBackendCommand,
    setStatusMessage,
    setStatusLevel,
    activeModulator,
    updateActiveModulator,
    updateActiveTargetControl,
    setOpenWaveMenu,
    lastWaveHandleUsedRef,
    liveEmitFrameRef,
    liveEmitCommandsRef,
  })

  useKeyboardController({
    bridgeUnavailableMessage,
    isProjectReady,
    settingsOpen,
    isCommandMode,
    openCommandMode,
    executeBackendCommand,
    projectRef,
    editorStateRef,
    keymapRef,
    installEditorState,
    workspaceViewRef,
    compositionSelectionRef,
    installCompositionSelection,
    setWorkspaceView: installWorkspaceView,
    editSelectedCompositionCell,
    setLoopStart: () => setLoopBoundary('start'),
    setLoopEnd: () => setLoopBoundary('end'),
    setIsModulatorMode,
    selectActiveModulatorTab,
    setOpenWaveMenu,
    toggleActiveModulatorTarget: toggleTargetEnabled,
    setStatusMessage,
    setStatusLevel,
  })

  useEffect(() => {
    if (!isModulatorMode) {
      setOpenWaveMenu(null)
    }
  }, [isModulatorMode, setOpenWaveMenu])

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

  const runLibraryCommand = useCallback(
    async (command: string): Promise<void> => {
      if (!command || bridgeUnavailableMessage !== null || !isProjectReady) {
        return
      }

      try {
        await executeBackendCommand(command)
      } catch (error) {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      }
    },
    [bridgeUnavailableMessage, executeBackendCommand, isProjectReady, setStatusLevel, setStatusMessage]
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
        disabledReason={disabledReason}
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
        {!isProjectReady ? (
          <div className="workspaceNotice" role="status" aria-live="polite">
            <h1 className="workspaceNoticeTitle">
              {projectState.status === 'error' ? 'Project unavailable' : 'Loading project'}
            </h1>
            <p className="workspaceNoticeBody">
              {projectState.status === 'error'
                ? projectState.message
                : 'Waiting for the native session and project snapshot.'}
            </p>
          </div>
        ) : projectSnapshot ? (
          <>
            <div
              className="workspacePane"
              hidden={workspaceView !== 'composition'}
              aria-hidden={workspaceView !== 'composition'}
            >
              {projectSnapshot.composition ? (
                <CompositionSection
                  composition={projectSnapshot.composition}
                  measureBank={projectSnapshot.measureBank}
                  selection={displayedCompositionSelection}
                  tuningLength={tuningLength}
                  onSelectCell={(selection) => {
                    installCompositionSelection(selection)
                  }}
                />
              ) : (
                <div className="workspaceNotice" role="status" aria-live="polite">
                  <h1 className="workspaceNoticeTitle">Composition unavailable</h1>
                  <p className="workspaceNoticeBody">
                    This project snapshot does not include arrangement data.
                  </p>
                </div>
              )}
            </div>
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
                isModulatorMode={isModulatorMode}
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
                setModulatorPreviewWidth={setModulatorPreviewWidth}
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
          </>
        ) : (
          <div className="workspaceNotice" role="status" aria-live="polite">
            <h1 className="workspaceNoticeTitle">Project unavailable</h1>
            <p className="workspaceNoticeBody">Project snapshot is not ready.</p>
          </div>
        )}
      </section>
      <StatusSection
        currentInputMode={editorState.inputMode}
        currentInputModeLetter={currentInputModeLetter}
        workspaceView={workspaceView}
        setWorkspaceView={installWorkspaceView}
        isModulatorMode={isModulatorMode}
        setIsModulatorMode={setIsModulatorMode}
        isCommandMode={isCommandMode}
        submitCommand={submitCommand}
        keymapResource={keymapController.resource}
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
        commandDisabled={!isProjectReady}
        workspaceDisabled={!isProjectReady}
        modulatorDisabled={!isProjectReady || workspaceView !== 'sequencer'}
        onOpenSettings={() => {
          settingsOpenerRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null
          keymapController.clearError()
          setSettingsOpen(true)
        }}
        modulatorRail={isProjectReady && isModulatorMode && workspaceView === 'sequencer' ? (
          <ModulatorsPanel
            activeModulatorTab={activeModulatorTab}
            activeModulator={activeModulator}
            selectActiveModulatorTab={selectActiveModulatorTab}
            selectWaveType={selectWaveType}
            onWaveLerpChange={handleWaveLerpChange}
            onWaveAPulseWidthChange={handleWaveAPulseWidthChange}
            onWaveBPulseWidthChange={handleWaveBPulseWidthChange}
            clampNumber={clampNumber}
            setTargetEnabled={setTargetEnabled}
            resetTargetControl={resetTargetControl}
            padDragRef={padDragRef}
            applyPadMotion={applyPadMotion}
            tuningLength={tuningLength}
          />
        ) : null}
      />
      <SettingsOverlay
        open={settingsOpen}
        resource={keymapController.resource}
        commands={sessionReference.commands}
        busy={keymapController.busy}
        error={keymapController.error}
        onClose={() => {
          setSettingsOpen(false)
          window.requestAnimationFrame(() => {
            const opener = settingsOpenerRef.current
            if (opener?.isConnected) opener.focus()
          })
        }}
        onSetOverride={keymapController.setOverride}
        onDisable={keymapController.disable}
        onRestore={keymapController.restore}
        onReset={keymapController.reset}
      />
    </div>
  )
}

export default App
