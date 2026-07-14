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
import { useSessionResources } from './app/hooks/useSessionResources'
import { useSettingsOverlayState } from './app/hooks/useSettingsOverlayState'
import { useSequencerRollState } from './app/hooks/useSequencerRollState'
import { useTransportPlayhead } from './app/hooks/useTransportPlayhead'
import { useWorkspaceLayout } from './app/hooks/useWorkspaceLayout'
import { useNotifications } from './app/hooks/useNotifications'
import { usePreferences } from './app/preferences/usePreferences'
import { CompositionSection } from './app/sections/CompositionSection'
import { SequencerSection } from './app/sections/SequencerSection'
import { ModulationHeader } from './app/sections/ModulationHeader'
import { NotificationToasts } from './app/sections/NotificationToasts'
import { ProjectDocumentMenu } from './app/sections/ProjectDocumentMenu'
import { SettingsOverlay } from './app/sections/SettingsOverlay'
import { WorkspaceEditors } from './app/sections/WorkspaceEditors'
import { QuickAccessPalette } from './app/sections/QuickAccessPalette'
import { ModulatorsPanel } from './app/sections/bottom/ModulatorsPanel'
import {
  DEFAULT_TUNING_LENGTH,
  createTransportState,
} from './app/constants'
import {
  getContextualSequenceName,
  reconcileActiveSequenceTarget,
} from './app/domain/composition'
import { clampNumber } from './app/domain/music'
import type {
  Cell,
  ActiveSequenceTarget,
  CompositionSelection,
  EditorState,
  TransportState,
} from './app/domain/models'
import type { FilePaletteItem } from './app/domain/palette'
import {
  resolveSequenceEditorPresentation,
  type WorkspaceView,
} from './app/workspace/workspaceLayout'

const EMPTY_ROOT_CELL: Cell = { weight: 1, elements: [] }
const INITIAL_COMPOSITION_SELECTION: CompositionSelection = {
  rowCoordinate: 0,
  columnCoordinate: 0,
}

function App() {
  const { notifications, notify, dismissNotification } = useNotifications()
  const { workspaceLayout } = usePreferences()
  const [editorState, setEditorState] = useState<EditorState>({
    selection: { path: [] },
    inputMode: 'pitch',
  })
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('sequencer')
  const [compositionSelection, setCompositionSelection] = useState<CompositionSelection>(
    INITIAL_COMPOSITION_SELECTION
  )
  const [activeSequenceTarget, setActiveSequenceTarget] = useState<ActiveSequenceTarget | null>(null)
  const activeSequenceTargetRef = useRef<ActiveSequenceTarget | null>(activeSequenceTarget)
  const compositionSelectionRef = useRef<CompositionSelection>(compositionSelection)
  const workspaceViewRef = useRef<WorkspaceView>(workspaceView)
  const [isModulatorMode, setIsModulatorMode] = useState(false)
  const timeSignatureInputRef = useRef<HTMLInputElement>(null)
  const keyInputRef = useRef<HTMLInputElement>(null)
  const baseFrequencyInputRef = useRef<HTMLInputElement>(null)
  const editorStateRef = useRef<EditorState>(editorState)
  const transportRef = useRef<TransportState>(createTransportState())
  const selectedTimeSignatureRef = useRef({ numerator: 4, denominator: 4 })
  const [isTransportActive, setIsTransportActive] = useState(false)
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
    statusRevision,
    setStatusMessage,
    setStatusLevel,
    bridgeUnavailableMessage,
    projectRef,
    keymapRef,
    keymapController,
    executeBackendCommand,
    beginBackendPreview,
    documentBusy,
    newProject,
    openProject,
    saveProject,
    saveProjectAs,
    importCell,
    saveCell,
    restoreRecovery,
    discardRecovery,
  } = useProjectSession({
    transportRef,
    editorStateRef,
    activeSequenceTargetRef,
    compositionSelectionRef,
    workspaceViewRef,
    setEditorState,
    setSessionReference,
    setLibrarySnapshot,
    setIsTransportActive,
    setPlayheadPhase,
  })
  useEffect(() => {
    if ((statusLevel === 'warning' || statusLevel === 'error') && statusMessage) {
      notify(statusLevel, statusMessage)
    }
  }, [notify, statusLevel, statusMessage, statusRevision])
  const settingsOverlay = useSettingsOverlayState(keymapController.clearError)
  const activateLibraryFile = useCallback((file: FilePaletteItem): Promise<void> =>
    file.fileKind === 'project' ? openProject(file) : importCell(file), [importCell, openProject])
  const quickAccess = useQuickAccessPalette({
    commands: sessionReference.commands,
    executeBackendCommand,
    activateFile: activateLibraryFile,
  })
  const openQuickAccess = quickAccess.open
  const openAllQuickAccess = useCallback((): void => {
    setIsModulatorMode(false)
    openQuickAccess('all')
  }, [openQuickAccess])
  const openCommandPalette = useCallback((): void => {
    setIsModulatorMode(false)
    openQuickAccess('commands')
  }, [openQuickAccess])

  const installEditorState = useCallback((nextState: EditorState): void => {
    editorStateRef.current = nextState
    setEditorState(nextState)
  }, [])

  const isProjectReady = projectState.status === 'ready'
  const modulationModeActive = isModulatorMode && isProjectReady && workspaceView === 'sequencer'
  const projectSnapshot = isProjectReady ? projectState.snapshot : null
  const {
    workspaceRef,
    showDualEditors,
  } = useWorkspaceLayout(Boolean(projectSnapshot?.composition), workspaceLayout)
  const disabledReason = isProjectReady
    ? null
    : projectState.status === 'error'
      ? projectState.message
      : 'Project is loading'

  useEffect(() => {
    document.title = projectSnapshot
      ? `${projectSnapshot.document.dirty ? '• ' : ''}${projectSnapshot.document.displayName} — XenSequencer`
      : 'XenSequencer'
  }, [projectSnapshot])

  const installCompositionSelection = useCallback((nextSelection: CompositionSelection): void => {
    compositionSelectionRef.current = nextSelection
    setCompositionSelection(nextSelection)
  }, [])

  const installWorkspaceView = useCallback((
    nextView: WorkspaceView | ((current: WorkspaceView) => WorkspaceView)
  ): void => {
    const resolved = typeof nextView === 'function'
      ? nextView(workspaceViewRef.current)
      : nextView
    workspaceViewRef.current = resolved
    setWorkspaceView(resolved)
    if (resolved !== 'sequencer') setIsModulatorMode(false)
  }, [])

  const installActiveSequenceTarget = useCallback((nextTarget: ActiveSequenceTarget | null): void => {
    activeSequenceTargetRef.current = nextTarget
    setActiveSequenceTarget(nextTarget)
  }, [])

  useEffect(() => {
    if (!projectSnapshot) return

    const nextTarget = reconcileActiveSequenceTarget(
      projectSnapshot.composition,
      activeSequenceTargetRef.current,
      compositionSelectionRef.current
    )
    if (nextTarget !== activeSequenceTargetRef.current) {
      installActiveSequenceTarget(nextTarget)
    }
  }, [installActiveSequenceTarget, projectSnapshot])

  const sequenceEditorPresentation = resolveSequenceEditorPresentation(
    showDualEditors,
    workspaceView,
    projectSnapshot?.composition ?? null,
    compositionSelection,
    activeSequenceTarget,
    editorState.selection
  )

  const projectViewModel = useProjectViewModel(
    projectSnapshot,
    sequenceEditorPresentation.selection,
    sequenceEditorPresentation.target,
    compositionSelection.columnCoordinate
  )

  const tuningLength = projectViewModel?.tuningLength ?? DEFAULT_TUNING_LENGTH
  const rootCell = projectViewModel?.rootCell ?? EMPTY_ROOT_CELL
  const sequenceNumerator = projectViewModel?.sequenceNumerator ?? 0
  const sequenceDenominator = projectViewModel?.sequenceDenominator ?? 0
  const hasHeaderColumnMetadata = projectViewModel?.hasHeaderColumnMetadata ?? false
  const timeSignature = projectViewModel?.timeSignature ?? '--'
  const scaleName = projectViewModel?.scaleName ?? '--'
  const scaleSourceId = projectViewModel?.scaleSourceId ?? null
  const scaleMode = projectViewModel?.scaleMode ?? 0
  const scaleSize = projectViewModel?.scaleSize ?? 0
  const scaleTranslateDirection = projectViewModel?.scaleTranslateDirection ?? null
  const tuningName = projectViewModel?.tuningName ?? '--'
  const keyDisplay = projectViewModel?.keyDisplay ?? '--'
  const baseFrequency = projectViewModel?.baseFrequency ?? '--'
  const staffLineBandByPitch = projectViewModel?.staffLineBandByPitch ?? []
  const rulerRatios = projectViewModel?.rulerRatios ?? []
  const highlightedPitches = projectViewModel?.highlightedPitches ?? new Set<number>()
  const metadataDisabledReason = disabledReason ?? (
    hasHeaderColumnMetadata ? null : 'Selected composition column has no metadata'
  )

  const headerSequenceName = getContextualSequenceName(
    projectSnapshot,
    workspaceView,
    compositionSelection,
    activeSequenceTarget
  )

  const {
    compositionEditTarget,
    setCompositionEditTarget,
    enterSelectedCompositionSequence,
    setLoopBoundary,
    runSelectedCompositionAction,
    commitCompositionCellName,
    commitCompositionRowName,
    commitCompositionRowChannel,
  } = useCompositionCommands({
    projectRef,
    compositionSelectionRef,
    editorStateRef,
    bridgeUnavailableMessage,
    executeBackendCommand,
    setStatusMessage,
    setStatusLevel,
    installActiveSequenceTarget,
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
    disabledReason: metadataDisabledReason,
    timeSignature,
    keyDisplay,
    baseFrequency,
    scaleName,
    scaleSourceId,
    scaleMode,
    scaleSize,
    scaleTranslateDirection: scaleTranslateDirection ?? 'up',
    librarySnapshot,
    executeBackendCommand,
    setStatusMessage,
    setStatusLevel,
    timeSignatureInputRef,
    keyInputRef,
    baseFrequencyInputRef,
  })

  useTransportPlayhead({
    sequenceNumerator,
    sequenceDenominator,
    transportRef,
    selectedTimeSignatureRef,
    isTransportActive,
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
    activeSequenceTargetRef,
    keymapRef,
    installEditorState,
    workspaceView,
    workspaceViewRef,
    compositionSelectionRef,
    installCompositionSelection,
    setWorkspaceView: installWorkspaceView,
    enterSelectedCompositionSequence,
    runSelectedCompositionAction,
    beginCompositionColumnLengthEdit: beginTimeSignatureEdit,
    setLoopStart: () => setLoopBoundary('start'),
    setLoopEnd: () => setLoopBoundary('end'),
    isModulatorMode: modulationModeActive,
    exitModulatorMode: () => setIsModulatorMode(false),
    setIsModulatorMode,
    selectActiveModulatorTab,
    setOpenWaveMenu,
    toggleActiveModulatorTarget: toggleTargetEnabled,
    setStatusMessage,
    setStatusLevel,
  })

  useEffect(() => {
    if (!modulationModeActive) {
      setOpenWaveMenu(null)
      cancelContinuousEdit()
    }
  }, [cancelContinuousEdit, modulationModeActive, setOpenWaveMenu])

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
        metadataDisabledReason={metadataDisabledReason}
        metadataAvailable={hasHeaderColumnMetadata}
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
        isScaleUpdating={isScaleUpdating}
        scaleOptions={scaleOptions}
        scaleName={scaleName}
        scaleSourceId={scaleSourceId}
        applyScaleSelection={applyScaleSelection}
        scaleTranslateDirection={scaleTranslateDirection}
        toggleTranslateDirection={toggleTranslateDirection}
        modeOptions={modeOptions}
        scaleMode={scaleMode}
        applyModeSelection={applyModeSelection}
        tuningName={tuningName}
        sequenceName={headerSequenceName}
        currentInputMode={editorState.inputMode}
        documentControls={(
          <ProjectDocumentMenu
            project={projectSnapshot}
            busy={documentBusy}
            disabledReason={disabledReason}
            onNewProject={newProject}
            onSaveProject={saveProject}
            onSaveProjectAs={saveProjectAs}
            onSaveCell={saveCell}
            onRestoreRecovery={restoreRecovery}
            onDiscardRecovery={discardRecovery}
          />
        )}
        onOpenQuickAccess={openAllQuickAccess}
        onOpenSettings={() => {
          quickAccess.close(false)
          settingsOverlay.openOverlay()
        }}
        onEnterModulation={() => setIsModulatorMode(true)}
        onExitModulation={() => setIsModulatorMode(false)}
        modulationDisabled={!isProjectReady || workspaceView !== 'sequencer'}
        modulationControls={modulationModeActive ? (
          <ModulationHeader
            controls={(
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
            )}
          />
        ) : undefined}
      />
      <section
        className="workspaceSection"
        aria-label="Workspace"
        ref={workspaceRef}
      >
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
          <WorkspaceEditors
            activeView={workspaceView}
            dual={showDualEditors}
            sequencer={sequenceEditorPresentation.emptyCompositionCell ? (
              <div className="workspaceNotice" role="status" aria-live="polite">
                <h1 className="workspaceNoticeTitle">Empty composition cell</h1>
                <p className="workspaceNoticeBody">
                  Enter this cell to create and edit a sequence.
                </p>
              </div>
            ) : (
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
                isModulatorMode={modulationModeActive}
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
            )}
            composition={projectSnapshot.composition ? (
              <CompositionSection
                composition={projectSnapshot.composition}
                sequenceBank={projectSnapshot.sequenceBank}
                selection={compositionSelection}
                tuningLength={tuningLength}
                editTarget={compositionEditTarget}
                onCancelEdit={() => setCompositionEditTarget(null)}
                onCommitCellName={commitCompositionCellName}
                onCommitRowName={commitCompositionRowName}
                onCommitRowChannel={commitCompositionRowChannel}
              />
            ) : (
              <div className="workspaceNotice" role="status" aria-live="polite">
                <h1 className="workspaceNoticeTitle">Composition unavailable</h1>
                <p className="workspaceNoticeBody">
                  This project snapshot does not include arrangement data.
                </p>
              </div>
            )}
          />
        ) : (
          <div className="workspaceNotice" role="status" aria-live="polite">
            <h1 className="workspaceNoticeTitle">Project unavailable</h1>
            <p className="workspaceNoticeBody">Project snapshot is not ready.</p>
          </div>
        )}
      </section>
      <NotificationToasts
        notifications={notifications}
        dismissNotification={dismissNotification}
      />
      <QuickAccessPalette
        controller={quickAccess}
        commands={sessionReference.commands}
        librarySnapshot={librarySnapshot}
        activeTuningName={tuningName}
        activeScaleId={scaleSourceId}
        sequenceBank={projectSnapshot?.sequenceBank ?? null}
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
