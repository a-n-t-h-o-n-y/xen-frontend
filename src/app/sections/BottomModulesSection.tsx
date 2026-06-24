import type { ComponentProps } from 'react'
import { ModulatorsPanel } from './bottom/ModulatorsPanel'

type BottomModulesSectionProps = ComponentProps<typeof ModulatorsPanel>

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
      </div>
    </details>
  )
}
