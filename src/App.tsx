import { useCallback, useEffect, useRef, useState } from 'react'
import { HeaderSection } from './app/sections/HeaderSection'
import { useCompositionCommands } from './app/hooks/useCompositionCommands'
import { useHeaderEditing } from './app/hooks/useHeaderEditing'
import { useModulatorPanelState } from './app/hooks/useModulatorPanelState'
import { useProjectSession } from './app/hooks/useProjectSession'
import { useKeyboardController } from './app/hooks/useKeyboardController'
import { useModulatorController } from './app/hooks/useModulatorController'
import { useProjectViewModel } from './app/hooks/useProjectViewModel'
import { useQuickAccessPalette } from './app/hooks/useQuickAccessPalette'
import { useScaleMenu } from './app/hooks/useScaleMenu'
import { useSessionResources } from './app/hooks/useSessionResources'
import { useSettingsOverlayState } from './app/hooks/useSettingsOverlayState'
import { useSequencerRollState } from './app/hooks/useSequencerRollState'
import { useTransportPlayhead } from './app/hooks/useTransportPlayhead'
import { CompositionSection } from './app/sections/CompositionSection'
import { SequencerSection } from './app/sections/SequencerSection'
import { StatusSection } from './app/sections/StatusSection'
import { SettingsOverlay } from './app/sections/SettingsOverlay'
import { QuickAccessPalette } from './app/sections/QuickAccessPalette'
import { ModulatorsPanel } from './app/sections/bottom/ModulatorsPanel'
import {
  DEFAULT_TUNING_LENGTH,
  createTransportState,
} from './app/constants'
import { reconcileActiveMeasureTarget } from './app/domain/composition'
import { clampNumber } from './app/domain/music'
import type {
  Cell,
  ActiveMeasureTarget,
  CompositionSelection,
  EditorState,
  TransportState,
} from './app/domain/models'

type WorkspaceView = 'composition' | 'sequencer'

const EMPTY_ROOT_CELL: Cell = { weight: 1, elements: [] }
const INITIAL_COMPOSITION_SELECTION: CompositionSelection = { rowIndex: 0, columnIndex: 0 }

function App() {
  const [editorState, setEditorState] = useState<EditorState>({
    selection: { path: [] },
    inputMode: 'pitch',
  })
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('sequencer')
  const [compositionSelection, setCompositionSelection] = useState<CompositionSelection>(
    INITIAL_COMPOSITION_SELECTION
  )
  const [activeMeasureTarget, setActiveMeasureTarget] = useState<ActiveMeasureTarget | null>(null)
  const activeMeasureTargetRef = useRef<ActiveMeasureTarget | null>(activeMeasureTarget)
  const compositionSelectionRef = useRef<CompositionSelection>(compositionSelection)
  const workspaceViewRef = useRef<WorkspaceView>(workspaceView)
  const [isModulatorMode, setIsModulatorMode] = useState(false)
  const timeSignatureInputRef = useRef<HTMLInputElement>(null)
  const keyInputRef = useRef<HTMLInputElement>(null)
  const baseFrequencyInputRef = useRef<HTMLInputElement>(null)
  const { openScaleMenu, setOpenScaleMenu, scaleMenuRef } = useScaleMenu()
  const editorStateRef = useRef<EditorState>(editorState)
  const transportRef = useRef<TransportState>(createTransportState())
  const selectedTimeSignatureRef = useRef({ numerator: 4, denominator: 4 })
  const [playheadPhase, setPlayheadPhase] = useState<number | null>(null)
  const [modulatorPreviewWidth, setModulatorPreviewWidth] = useState(0)
  const {
    sessionReference,
    setSessionReference,
    librarySnapshot,
    setLibrarySnapshot,
  } = useSessionResources()
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
    beginBackendPreview,
  } = useProjectSession({
    transportRef,
    editorStateRef,
    activeMeasureTargetRef,
    setEditorState,
    setSessionReference,
    setLibrarySnapshot,
    setPlayheadPhase,
  })
  const settingsOverlay = useSettingsOverlayState(keymapController.clearError)
  const quickAccess = useQuickAccessPalette({
    commands: sessionReference.commands,
    executeBackendCommand,
    setStatusMessage,
    setStatusLevel,
  })
  const openQuickAccess = quickAccess.open
  const openAllQuickAccess = useCallback((): void => {
    setOpenScaleMenu(false)
    openQuickAccess('all')
  }, [openQuickAccess, setOpenScaleMenu])
  const openCommandPalette = useCallback((): void => {
    setOpenScaleMenu(false)
    openQuickAccess('commands')
  }, [openQuickAccess, setOpenScaleMenu])

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

  const installActiveMeasureTarget = useCallback((nextTarget: ActiveMeasureTarget | null): void => {
    activeMeasureTargetRef.current = nextTarget
    setActiveMeasureTarget(nextTarget)
  }, [])

  useEffect(() => {
    if (!projectSnapshot) return

    const nextTarget = reconcileActiveMeasureTarget(
      projectSnapshot.composition,
      activeMeasureTargetRef.current,
      compositionSelectionRef.current
    )
    if (nextTarget !== activeMeasureTargetRef.current) {
      installActiveMeasureTarget(nextTarget)
    }
  }, [installActiveMeasureTarget, projectSnapshot])

  const projectViewModel = useProjectViewModel(
    projectSnapshot,
    editorState.selection,
    activeMeasureTarget
  )

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

  const {
    compositionEditTarget,
    setCompositionEditTarget,
    displayedCompositionSelection,
    editSelectedCompositionCell,
    setLoopBoundary,
    runSelectedCompositionAction,
    beginCompositionEdit,
    commitCompositionCellName,
    commitCompositionRowName,
    commitCompositionRowChannel,
    commitCompositionColumnLength,
    insertCompositionRow,
    deleteCompositionRow,
    insertCompositionColumn,
    deleteCompositionColumn,
    clearCompositionCell,
  } = useCompositionCommands({
    projectRef,
    compositionSelectionRef,
    editorStateRef,
    compositionSelection,
    projectComposition: projectSnapshot?.composition ?? null,
    bridgeUnavailableMessage,
    executeBackendCommand,
    setStatusMessage,
    setStatusLevel,
    installActiveMeasureTarget,
    installEditorState,
    installWorkspaceView,
  })

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
    beginContinuousEdit,
    commitContinuousEdit,
    cancelContinuousEdit,
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
    beginBackendPreview,
    setStatusMessage,
    setStatusLevel,
    activeModulator,
    updateActiveModulator,
    updateActiveTargetControl,
    setOpenWaveMenu,
    lastWaveHandleUsedRef,
  })

  useKeyboardController({
    bridgeUnavailableMessage,
    isProjectReady,
    settingsOpen: settingsOverlay.open,
    isQuickAccessOpen: quickAccess.state.open,
    openCommandPalette,
    executeBackendCommand,
    projectRef,
    editorStateRef,
    activeMeasureTargetRef,
    keymapRef,
    installEditorState,
    workspaceView,
    workspaceViewRef,
    compositionSelectionRef,
    installCompositionSelection,
    setWorkspaceView: installWorkspaceView,
    editSelectedCompositionCell,
    runSelectedCompositionAction,
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
    if (!isModulatorMode || workspaceView !== 'sequencer') {
      setOpenWaveMenu(null)
      cancelContinuousEdit()
    }
  }, [cancelContinuousEdit, isModulatorMode, setOpenWaveMenu, workspaceView])

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
        onOpenQuickAccess={openAllQuickAccess}
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
                  editTarget={compositionEditTarget}
                  onSelectCell={(selection) => {
                    setCompositionEditTarget(null)
                    installCompositionSelection(selection)
                  }}
                  onBeginEdit={beginCompositionEdit}
                  onCancelEdit={() => setCompositionEditTarget(null)}
                  onCommitCellName={commitCompositionCellName}
                  onCommitRowName={commitCompositionRowName}
                  onCommitRowChannel={commitCompositionRowChannel}
                  onCommitColumnLength={commitCompositionColumnLength}
                  onInsertRow={insertCompositionRow}
                  onDeleteRow={deleteCompositionRow}
                  onInsertColumn={insertCompositionColumn}
                  onDeleteColumn={deleteCompositionColumn}
                  onClearCell={clearCompositionCell}
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
                beginContinuousEdit={beginContinuousEdit}
                commitContinuousEdit={commitContinuousEdit}
                cancelContinuousEdit={cancelContinuousEdit}
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
        statusLevel={statusLevel}
        statusMessage={statusMessage}
        selectedCellMeta={selectedCellMeta}
        workspaceDisabled={!isProjectReady}
        modulatorDisabled={!isProjectReady || workspaceView !== 'sequencer'}
        onOpenSettings={() => {
          quickAccess.close(false)
          settingsOverlay.openOverlay()
        }}
        modulatorRail={isProjectReady && isModulatorMode && workspaceView === 'sequencer' ? (
          <ModulatorsPanel
            activeModulatorTab={activeModulatorTab}
            activeModulator={activeModulator}
            selectActiveModulatorTab={(index) => {
              cancelContinuousEdit()
              selectActiveModulatorTab(index)
            }}
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
            beginContinuousEdit={beginContinuousEdit}
            commitContinuousEdit={commitContinuousEdit}
            cancelContinuousEdit={cancelContinuousEdit}
          />
        ) : null}
      />
      <QuickAccessPalette
        controller={quickAccess}
        commands={sessionReference.commands}
        librarySnapshot={librarySnapshot}
        activeTuningName={tuningName}
        activeScaleId={scaleSourceId}
        keymapResource={keymapController.resource}
        currentInputMode={editorState.inputMode}
      />
      <SettingsOverlay
        open={settingsOverlay.open}
        resource={keymapController.resource}
        commands={sessionReference.commands}
        busy={keymapController.busy}
        error={keymapController.error}
        onClose={settingsOverlay.closeOverlay}
        onSetBinding={keymapController.setBinding}
        onDelete={keymapController.deleteBinding}
        onReset={keymapController.reset}
      />
    </div>
  )
}

export default App
