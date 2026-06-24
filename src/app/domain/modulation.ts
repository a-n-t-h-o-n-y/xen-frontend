import { DEFAULT_TUNING_LENGTH } from '../constants'
import { clampNumber, normalizePhase } from './music'

export type ModTarget = 'pitch' | 'velocity' | 'delay' | 'gate' | 'weights'
export type WaveType = 'sine' | 'triangle' | 'sawtooth_up' | 'sawtooth_down' | 'square'

export type ConstantModulator = {
  type: 'constant'
  value: number
}

export type OscillatorModulator = {
  type: 'sine' | 'triangle' | 'sawtooth_up' | 'sawtooth_down'
  frequency: number
  amplitude: number
  phase: number
}

export type SquareModulator = {
  type: 'square'
  frequency: number
  amplitude: number
  phase: number
  pulse_width: number
}

export type ScaleModulator = {
  type: 'scale'
  factor: number
}

export type BiasModulator = {
  type: 'bias'
  amount: number
}

export type ClampModulator = {
  type: 'clamp'
  min: number
  max: number
}

export type ChainModulator = {
  type: 'chain'
  children: Modulator[]
}

export type BlendModulator = {
  type: 'blend'
  children: Modulator[]
}

export type Modulator =
  | ConstantModulator
  | OscillatorModulator
  | SquareModulator
  | ScaleModulator
  | BiasModulator
  | ClampModulator
  | ChainModulator
  | BlendModulator

export type ModTargetSpec = {
  label: string
  min: number
  max: number
  defaultCenter: number
  defaultScalar: number
  step: number
  integer: boolean
}

export type TargetControl = {
  enabled: boolean
  useScalar: boolean
  center: number
  amount: number
  scalar: number
}

export type ModulatorPanelState = {
  waveAType: WaveType
  waveBType: WaveType
  waveAPulseWidth: number
  waveBPulseWidth: number
  waveLerp: number
  lfoAFrequency: number
  lfoAPhaseOffset: number
  lfoBFrequency: number
  lfoBPhaseOffset: number
  targetControls: Record<ModTarget, TargetControl>
}

export const MOD_TARGET_SPECS: Record<ModTarget, ModTargetSpec> = {
  pitch: {
    label: 'Pitch',
    min: -24,
    max: 24,
    defaultCenter: 0,
    defaultScalar: 0,
    step: 1,
    integer: true,
  },
  velocity: {
    label: 'Velocity',
    min: 0,
    max: 1,
    defaultCenter: 0.5,
    defaultScalar: 0.787402,
    step: 0.01,
    integer: false,
  },
  delay: {
    label: 'Delay',
    min: 0,
    max: 1,
    defaultCenter: 0.5,
    defaultScalar: 0,
    step: 0.01,
    integer: false,
  },
  gate: {
    label: 'Gate',
    min: 0,
    max: 1,
    defaultCenter: 0.5,
    defaultScalar: 1,
    step: 0.01,
    integer: false,
  },
  weights: {
    label: 'Weights',
    min: 0,
    max: 1,
    defaultCenter: 0.5,
    defaultScalar: 0.5,
    step: 0.01,
    integer: false,
  },
}

export const MOD_TARGET_ORDER: ModTarget[] = ['pitch', 'velocity', 'delay', 'gate', 'weights']
export const WAVE_OPTIONS: WaveType[] = ['sine', 'triangle', 'sawtooth_up', 'sawtooth_down', 'square']
export const WAVE_OPTION_LABELS: Record<WaveType, string> = {
  sine: 'Sine',
  triangle: 'Triangle',
  sawtooth_up: 'Saw Up',
  sawtooth_down: 'Saw Down',
  square: 'Square',
}
export const LFO_FREQUENCY_RANGE_RATIO = 1000
export const LFO_FREQUENCY_MIN = 1 / Math.sqrt(LFO_FREQUENCY_RANGE_RATIO)
export const LFO_FREQUENCY_MAX = Math.sqrt(LFO_FREQUENCY_RANGE_RATIO)
export const LFO_PHASE_OFFSET_MIN = -0.5
export const LFO_PHASE_OFFSET_MAX = 0.5

export const getModTargetSpecForTuning = (target: ModTarget, tuningLength: number): ModTargetSpec => {
  const baseSpec = MOD_TARGET_SPECS[target]
  if (target !== 'pitch') {
    return baseSpec
  }

  const clampedTuningLength = Number.isFinite(tuningLength) && tuningLength > 0
    ? Math.max(1, Math.trunc(tuningLength))
    : DEFAULT_TUNING_LENGTH
  const pitchSpan = clampedTuningLength * 2

  return {
    ...baseSpec,
    min: -pitchSpan,
    max: pitchSpan,
  }
}

export const toNormalizedPhase = (phaseOffset: number): number => normalizePhase(phaseOffset)

export const frequencyToRatio = (frequency: number): number => {
  const clamped = clampNumber(frequency, LFO_FREQUENCY_MIN, LFO_FREQUENCY_MAX)
  const span = Math.log(LFO_FREQUENCY_MAX / LFO_FREQUENCY_MIN)
  if (span <= 0) {
    return 0
  }
  return clampNumber(Math.log(clamped / LFO_FREQUENCY_MIN) / span, 0, 1)
}

export const ratioToFrequency = (ratio: number): number => {
  const clampedRatio = clampNumber(ratio, 0, 1)
  const base = LFO_FREQUENCY_MAX / LFO_FREQUENCY_MIN
  if (base <= 0) {
    return LFO_FREQUENCY_MIN
  }
  return LFO_FREQUENCY_MIN * Math.pow(base, clampedRatio)
}

export const createInitialTargetControls = (): Record<ModTarget, TargetControl> => ({
  pitch: {
    enabled: false,
    useScalar: false,
    center: MOD_TARGET_SPECS.pitch.defaultCenter,
    amount: 0,
    scalar: MOD_TARGET_SPECS.pitch.defaultScalar,
  },
  velocity: {
    enabled: false,
    useScalar: false,
    center: MOD_TARGET_SPECS.velocity.defaultCenter,
    amount: 0,
    scalar: MOD_TARGET_SPECS.velocity.defaultScalar,
  },
  delay: {
    enabled: false,
    useScalar: false,
    center: MOD_TARGET_SPECS.delay.defaultCenter,
    amount: 0,
    scalar: MOD_TARGET_SPECS.delay.defaultScalar,
  },
  gate: {
    enabled: false,
    useScalar: false,
    center: MOD_TARGET_SPECS.gate.defaultCenter,
    amount: 0,
    scalar: MOD_TARGET_SPECS.gate.defaultScalar,
  },
  weights: {
    enabled: false,
    useScalar: false,
    center: MOD_TARGET_SPECS.weights.defaultCenter,
    amount: 0,
    scalar: MOD_TARGET_SPECS.weights.defaultScalar,
  },
})

export const createInitialModulatorPanelState = (): ModulatorPanelState => ({
  waveAType: 'sine',
  waveBType: 'triangle',
  waveAPulseWidth: 0.5,
  waveBPulseWidth: 0.5,
  waveLerp: 0,
  lfoAFrequency: 1,
  lfoAPhaseOffset: 0,
  lfoBFrequency: 1,
  lfoBPhaseOffset: 0,
  targetControls: createInitialTargetControls(),
})

export const sampleWaveShape = (type: WaveType, phase: number, pulseWidth: number): number => {
  const wrappedPhase = ((phase % 1) + 1) % 1
  const clampedPulseWidth = clampNumber(pulseWidth, 0.01, 0.99)

  if (type === 'sine') {
    return Math.sin(wrappedPhase * Math.PI * 2)
  }

  if (type === 'triangle') {
    return 1 - 4 * Math.abs(wrappedPhase - 0.5)
  }

  if (type === 'sawtooth_up') {
    return wrappedPhase * 2 - 1
  }

  if (type === 'sawtooth_down') {
    return 1 - wrappedPhase * 2
  }

  return wrappedPhase < clampedPulseWidth ? 1 : -1
}

export const createWaveModulator = (
  waveType: WaveType,
  frequency: number,
  phase: number,
  pulseWidth: number
): Modulator => {
  if (waveType === 'square') {
    return {
      type: 'square',
      frequency,
      amplitude: 1,
      phase,
      pulse_width: clampNumber(pulseWidth, 0.01, 0.99),
    }
  }

  return {
    type: waveType,
    frequency,
    amplitude: 1,
    phase,
  }
}

export const createMorphModulator = (
  waveAType: WaveType,
  waveBType: WaveType,
  waveAPulseWidth: number,
  waveBPulseWidth: number,
  waveAFrequency: number,
  waveAPhase: number,
  waveBFrequency: number,
  waveBPhase: number,
  lerp: number
): Modulator => {
  const clampedLerp = clampNumber(lerp, 0, 1)
  const waveA = createWaveModulator(waveAType, waveAFrequency, waveAPhase, waveAPulseWidth)
  const waveB = createWaveModulator(waveBType, waveBFrequency, waveBPhase, waveBPulseWidth)

  if (clampedLerp <= 0) {
    return waveA
  }
  if (clampedLerp >= 1) {
    return waveB
  }

  return {
    type: 'blend',
    children: [
      {
        type: 'chain',
        children: [waveA, { type: 'scale', factor: 1 - clampedLerp }],
      },
      {
        type: 'chain',
        children: [waveB, { type: 'scale', factor: clampedLerp }],
      },
    ],
  }
}

export const createTargetModulator = (
  base: Modulator,
  spec: ModTargetSpec,
  center: number,
  amount: number
): Modulator => {
  const clampedCenter = clampNumber(center, spec.min, spec.max)
  const maxPositiveSpan = spec.max - clampedCenter
  const maxNegativeSpan = clampedCenter - spec.min
  const amountLimit = Math.max(maxPositiveSpan, maxNegativeSpan)
  const signedSpan = clampNumber(amount, -amountLimit, amountLimit)

  return {
    type: 'chain',
    children: [
      base,
      { type: 'scale', factor: signedSpan },
      { type: 'bias', amount: clampedCenter },
      { type: 'clamp', min: spec.min, max: spec.max },
    ],
  }
}

export const buildCommandForTarget = (
  target: ModTarget,
  control: TargetControl,
  baseModulator: Modulator
): string => {
  const spec = MOD_TARGET_SPECS[target]
  const modulator = createTargetModulator(baseModulator, spec, control.center, control.amount)
  return `set ${target} ${JSON.stringify(modulator)}`
}

export const buildCommandLines = (
  controls: Record<ModTarget, TargetControl>,
  baseModulator: Modulator,
  onlyTargets?: ModTarget[]
): string[] => {
  const filterSet = onlyTargets ? new Set(onlyTargets) : null
  return MOD_TARGET_ORDER.filter((target) => controls[target].enabled)
    .filter((target) => (filterSet ? filterSet.has(target) : true))
    .map((target) => buildCommandForTarget(target, controls[target], baseModulator))
}
