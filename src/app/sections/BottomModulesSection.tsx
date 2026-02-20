import type { ComponentProps } from 'react'
import { LibraryPanel } from './bottom/LibraryPanel'
import { ModulatorsPanel } from './bottom/ModulatorsPanel'
import { ReferencePanel } from './bottom/ReferencePanel'
import { SequenceBankPanel } from './bottom/SequenceBankPanel'

type BottomModulesSectionProps = ComponentProps<typeof SequenceBankPanel> &
  ComponentProps<typeof ModulatorsPanel> &
  ComponentProps<typeof ReferencePanel> &
  ComponentProps<typeof LibraryPanel>

export function BottomModulesSection(props: BottomModulesSectionProps) {
  return (
    <section className="bottomModules" aria-label="Temporary module area">
      <div className="bottomModuleRow">
        <SequenceBankPanel
          sequenceBankCells={props.sequenceBankCells}
          selectedMeasureIndex={props.selectedMeasureIndex}
          activeSequenceFlags={props.activeSequenceFlags}
          sequenceCount={props.sequenceCount}
          selectSequenceFromBank={props.selectSequenceFromBank}
        />
        <ModulatorsPanel
          activeModulatorTab={props.activeModulatorTab}
          setOpenWaveMenu={props.setOpenWaveMenu}
          setActiveModulatorTab={props.setActiveModulatorTab}
          waveMenuRef={props.waveMenuRef}
          openWaveMenu={props.openWaveMenu}
          waveAType={props.waveAType}
          waveBType={props.waveBType}
          selectWaveType={props.selectWaveType}
          waveLerp={props.waveLerp}
          setWaveLerp={props.setWaveLerp}
          waveAPulseWidth={props.waveAPulseWidth}
          setWaveAPulseWidth={props.setWaveAPulseWidth}
          waveBPulseWidth={props.waveBPulseWidth}
          setWaveBPulseWidth={props.setWaveBPulseWidth}
          wavePadDragRef={props.wavePadDragRef}
          clampNumber={props.clampNumber}
          waveHandleA={props.waveHandleA}
          waveHandleB={props.waveHandleB}
          lastWaveHandleUsedRef={props.lastWaveHandleUsedRef}
          snapWaveToCenterGuides={props.snapWaveToCenterGuides}
          applyWavePadMotion={props.applyWavePadMotion}
          waveAOpacity={props.waveAOpacity}
          waveBOpacity={props.waveBOpacity}
          waveAPreviewPath={props.waveAPreviewPath}
          waveBPreviewPath={props.waveBPreviewPath}
          morphedWavePreviewPath={props.morphedWavePreviewPath}
          targetControls={props.targetControls}
          updateTargetControl={props.updateTargetControl}
          padDragRef={props.padDragRef}
          applyPadMotion={props.applyPadMotion}
          scheduleLiveEmit={props.scheduleLiveEmit}
          buildCommandForTarget={props.buildCommandForTarget}
          baseMorphModulator={props.baseMorphModulator}
        />
        <ReferencePanel
          activeReferenceTab={props.activeReferenceTab}
          setActiveReferenceTab={props.setActiveReferenceTab}
          sessionReference={props.sessionReference}
          referenceSearchInputRef={props.referenceSearchInputRef}
          referenceCommandSearch={props.referenceCommandSearch}
          setReferenceCommandSearch={props.setReferenceCommandSearch}
          filteredReferenceCommands={props.filteredReferenceCommands}
          focusCommandBarWithText={props.focusCommandBarWithText}
          sequenceViewReferenceBindings={props.sequenceViewReferenceBindings}
        />
        <LibraryPanel
          activeLibraryTab={props.activeLibraryTab}
          setActiveLibraryTab={props.setActiveLibraryTab}
          librarySnapshot={props.librarySnapshot}
          runLibraryCommand={props.runLibraryCommand}
          quoteCommandArg={props.quoteCommandArg}
          tuningSearchInputRef={props.tuningSearchInputRef}
          tuningSearch={props.tuningSearch}
          setTuningSearch={props.setTuningSearch}
          tuningSortMode={props.tuningSortMode}
          setTuningSortMode={props.setTuningSortMode}
          tuningHierarchyRows={props.tuningHierarchyRows}
          formatOctaveForDisplay={props.formatOctaveForDisplay}
          sequenceSearchInputRef={props.sequenceSearchInputRef}
          sequenceSearch={props.sequenceSearch}
          setSequenceSearch={props.setSequenceSearch}
          sequenceHierarchyRows={props.sequenceHierarchyRows}
        />
      </div>
    </section>
  )
}
