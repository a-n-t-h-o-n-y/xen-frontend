import {
  MOD_TARGET_ORDER,
  createMorphModulator,
  createTargetModulator,
  getModTargetSpecForTuning,
  toNormalizedPhase,
} from './modulation'
import type {
  ModTarget,
  Modulator,
  ModulatorPanelState,
  TargetControl,
} from './modulation'

export const buildModulatorForState = (state: ModulatorPanelState): Modulator =>
  createMorphModulator(
    state.waveAType,
    state.waveBType,
    state.waveAPulseWidth,
    state.waveBPulseWidth,
    state.lfoAFrequency,
    toNormalizedPhase(state.lfoAPhaseOffset),
    state.lfoBFrequency,
    toNormalizedPhase(state.lfoBPhaseOffset),
    state.waveLerp
  )

export const buildModulatorTargetCommand = (
  target: ModTarget,
  control: TargetControl,
  state: ModulatorPanelState,
  tuningLength: number
): string => {
  const spec = getModTargetSpecForTuning(target, tuningLength)
  const modulator = createTargetModulator(
    buildModulatorForState(state),
    spec,
    control.center,
    control.amount
  )
  return `set ${target} ${JSON.stringify(modulator)}`
}

export const buildEnabledModulatorTargetCommands = (
  state: ModulatorPanelState,
  tuningLength: number,
  onlyTargets?: ModTarget[]
): string[] => {
  const filterSet = onlyTargets ? new Set(onlyTargets) : null
  return MOD_TARGET_ORDER.filter((target) => state.targetControls[target].enabled)
    .filter((target) => (filterSet ? filterSet.has(target) : true))
    .map((target) =>
      buildModulatorTargetCommand(target, state.targetControls[target], state, tuningLength)
    )
}

export const joinModulatorCommands = (commands: string[]): string => commands.join('; ')
