import type { ComponentProps } from 'react'
import { LibraryPanel } from './bottom/LibraryPanel'
import { ModulatorsPanel } from './bottom/ModulatorsPanel'
import { ReferencePanel } from './bottom/ReferencePanel'

type BottomModulesSectionProps = ComponentProps<typeof ModulatorsPanel> &
  ComponentProps<typeof ReferencePanel> &
  ComponentProps<typeof LibraryPanel>

export function BottomModulesSection(props: BottomModulesSectionProps) {
  return (
    <details className="bottomModules" aria-label="Module area">
      <summary className="bottomModulesSummary">
        <span className="bottomModulesSummaryTitle mono">Panels</span>
        <span className="bottomModulesSummaryIcon mono" aria-hidden="true">
          ▸
        </span>
      </summary>
      <div className="bottomModuleRow">
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
          onWaveLerpChange={props.onWaveLerpChange}
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
          tuningLength={props.tuningLength}
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
          measureSearchInputRef={props.measureSearchInputRef}
          measureSearch={props.measureSearch}
          setMeasureSearch={props.setMeasureSearch}
          measureHierarchyRows={props.measureHierarchyRows}
        />
      </div>
    </details>
  )
}
