import { useCallback, useEffect, useMemo } from 'react'
import {
  LFO_FREQUENCY_MAX,
  LFO_PHASE_OFFSET_MAX,
  LFO_PHASE_OFFSET_MIN,
  frequencyToRatio,
  getModTargetSpecForTuning,
  ratioToFrequency,
  sampleWaveShape,
  toNormalizedPhase,
} from '../domain/modulation'
import {
  buildEnabledModulatorTargetCommands,
  buildModulatorTargetCommand,
  joinModulatorCommands,
} from '../domain/modulatorCommands'
import { clampNumber, roundByStep } from '../domain/music'
import { getErrorMessage } from '../utils/errors'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { MessageLevel } from '../domain/models'
import type {
  ModTarget,
  ModulatorPanelState,
  TargetControl,
  WaveType,
} from '../domain/modulation'

type TargetControlUpdate =
  | Partial<TargetControl>
  | ((current: TargetControl) => Partial<TargetControl>)

const WAVE_PREVIEW_VIEWBOX_SIZE = 100
const WAVE_PREVIEW_SAMPLES_PER_PIXEL = 2
const WAVE_PREVIEW_SAMPLES_PER_CYCLE = 72

type UseModulatorControllerArgs = {
  bridgeUnavailableMessage: string | null
  tuningLength: number
  modulatorPreviewWidth: number
  executeBackendCommand: (command: string) => Promise<void>
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
  activeModulator: ModulatorPanelState
  updateActiveModulator: (
    update:
      | Partial<ModulatorPanelState>
      | ((current: ModulatorPanelState) => Partial<ModulatorPanelState>)
  ) => void
  updateActiveTargetControl: (target: ModTarget, update: TargetControlUpdate) => void
  setOpenWaveMenu: Dispatch<SetStateAction<'a' | 'b' | null>>
  lastWaveHandleUsedRef: MutableRefObject<'a' | 'b'>
  liveEmitFrameRef: MutableRefObject<number | null>
  liveEmitCommandsRef: MutableRefObject<string[] | null>
}

export function useModulatorController({
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
}: UseModulatorControllerArgs) {
  const { waveAPreviewPath, waveBPreviewPath, morphedWavePreviewPath } = useMemo(() => {
    const maxVisibleFrequency = clampNumber(
      Math.max(activeModulator.lfoAFrequency, activeModulator.lfoBFrequency),
      1,
      LFO_FREQUENCY_MAX
    )
    const steps = Math.max(
      Math.ceil(Math.max(modulatorPreviewWidth, 1) * WAVE_PREVIEW_SAMPLES_PER_PIXEL),
      Math.ceil(maxVisibleFrequency * WAVE_PREVIEW_SAMPLES_PER_CYCLE)
    )
    const waveAPoints: string[] = []
    const waveBPoints: string[] = []
    const mixedPoints: string[] = []
    const normalizedWaveAPhase = toNormalizedPhase(activeModulator.lfoAPhaseOffset)
    const normalizedWaveBPhase = toNormalizedPhase(activeModulator.lfoBPhaseOffset)

    for (let index = 0; index <= steps; index += 1) {
      const progress = index / steps
      const x = progress * WAVE_PREVIEW_VIEWBOX_SIZE
      const waveA = sampleWaveShape(
        activeModulator.waveAType,
        progress * activeModulator.lfoAFrequency + normalizedWaveAPhase,
        activeModulator.waveAPulseWidth
      )
      const waveB = sampleWaveShape(
        activeModulator.waveBType,
        progress * activeModulator.lfoBFrequency + normalizedWaveBPhase,
        activeModulator.waveBPulseWidth
      )
      const mixed = clampNumber(
        waveA * (1 - activeModulator.waveLerp) + waveB * activeModulator.waveLerp,
        -1,
        1
      )
      const waveAY = (1 - (waveA + 1) / 2) * WAVE_PREVIEW_VIEWBOX_SIZE
      const waveBY = (1 - (waveB + 1) / 2) * WAVE_PREVIEW_VIEWBOX_SIZE
      const mixedY = (1 - (mixed + 1) / 2) * WAVE_PREVIEW_VIEWBOX_SIZE
      waveAPoints.push(`${x.toFixed(2)},${waveAY.toFixed(2)}`)
      waveBPoints.push(`${x.toFixed(2)},${waveBY.toFixed(2)}`)
      mixedPoints.push(`${x.toFixed(2)},${mixedY.toFixed(2)}`)
    }

    return {
      waveAPreviewPath: waveAPoints.join(' '),
      waveBPreviewPath: waveBPoints.join(' '),
      morphedWavePreviewPath: mixedPoints.join(' '),
    }
  }, [activeModulator, modulatorPreviewWidth])

  const emitCommandsNow = useCallback(
    (commands: string[]): void => {
      if (bridgeUnavailableMessage !== null || commands.length === 0) {
        return
      }

      void executeBackendCommand(joinModulatorCommands(commands)).catch((error: unknown) => {
        setStatusMessage(`Command failed: ${getErrorMessage(error)}`)
        setStatusLevel('error')
      })
    },
    [bridgeUnavailableMessage, executeBackendCommand, setStatusLevel, setStatusMessage]
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

  const emitEnabledTargetsForState = useCallback(
    (state: ModulatorPanelState): void => {
      scheduleLiveEmit(buildEnabledModulatorTargetCommands(state, tuningLength))
    },
    [scheduleLiveEmit, tuningLength]
  )

  const updateTargetControl = useCallback(
    (target: ModTarget, update: TargetControlUpdate): TargetControl => {
      const currentControl = activeModulator.targetControls[target]
      const patch = typeof update === 'function' ? update(currentControl) : update
      const nextControl = {
        ...currentControl,
        ...patch,
      }
      updateActiveTargetControl(target, patch)
      return nextControl
    },
    [activeModulator.targetControls, updateActiveTargetControl]
  )

  const handleWaveLerpChange = useCallback(
    (nextLerp: number): void => {
      const nextState = { ...activeModulator, waveLerp: nextLerp }
      updateActiveModulator({ waveLerp: nextLerp })
      emitEnabledTargetsForState(nextState)
    },
    [activeModulator, emitEnabledTargetsForState, updateActiveModulator]
  )

  const handleWaveAPulseWidthChange = useCallback(
    (nextPulseWidth: number): void => {
      const nextState = { ...activeModulator, waveAPulseWidth: nextPulseWidth }
      updateActiveModulator({ waveAPulseWidth: nextPulseWidth })
      emitEnabledTargetsForState(nextState)
    },
    [activeModulator, emitEnabledTargetsForState, updateActiveModulator]
  )

  const handleWaveBPulseWidthChange = useCallback(
    (nextPulseWidth: number): void => {
      const nextState = { ...activeModulator, waveBPulseWidth: nextPulseWidth }
      updateActiveModulator({ waveBPulseWidth: nextPulseWidth })
      emitEnabledTargetsForState(nextState)
    },
    [activeModulator, emitEnabledTargetsForState, updateActiveModulator]
  )

  const resetTargetControl = useCallback(
    (target: ModTarget): void => {
      const spec = getModTargetSpecForTuning(target, tuningLength)
      const control = activeModulator.targetControls[target]
      const nextControl = {
        ...control,
        enabled: false,
        center: spec.defaultCenter,
        amount: 0,
      }
      updateActiveTargetControl(target, nextControl)
      if (control.enabled) {
        scheduleLiveEmit([
          buildModulatorTargetCommand(
            target,
            {
              ...nextControl,
              enabled: true,
            },
            activeModulator,
            tuningLength
          ),
        ])
      }
    },
    [activeModulator, scheduleLiveEmit, tuningLength, updateActiveTargetControl]
  )

  const setTargetEnabled = useCallback(
    (target: ModTarget, enabled: boolean): void => {
      const nextControl = updateTargetControl(target, { enabled })
      if (enabled) {
        scheduleLiveEmit([
          buildModulatorTargetCommand(target, nextControl, activeModulator, tuningLength),
        ])
      }
    },
    [activeModulator, scheduleLiveEmit, tuningLength, updateTargetControl]
  )

  const toggleTargetEnabled = useCallback(
    (target: ModTarget): void => {
      const enabled = !activeModulator.targetControls[target].enabled
      setTargetEnabled(target, enabled)
    },
    [activeModulator.targetControls, setTargetEnabled]
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
      const currentControl = activeModulator.targetControls[target]

      if (mode === 'center') {
        const nextCenterRaw = spec.min + xRatio * (spec.max - spec.min)
        const nextCenter = roundByStep(nextCenterRaw, spec.step)
        const resolvedCenter = clampNumber(nextCenter, spec.min, spec.max)
        const maxPositiveSpan = spec.max - resolvedCenter
        const maxNegativeSpan = resolvedCenter - spec.min
        const amountLimit = Math.max(maxPositiveSpan, maxNegativeSpan)
        const resolvedAmount = clampNumber(currentControl.amount, -amountLimit, amountLimit)
        const nextControl = {
          ...currentControl,
          enabled: true,
          center: resolvedCenter,
          amount: resolvedAmount,
        }
        updateActiveTargetControl(target, nextControl)
        scheduleLiveEmit([
          buildModulatorTargetCommand(target, nextControl, activeModulator, tuningLength),
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
      const nextControl = { ...currentControl, enabled: true, amount: nextAmount }
      updateActiveTargetControl(target, nextControl)
      scheduleLiveEmit([
        buildModulatorTargetCommand(target, nextControl, activeModulator, tuningLength),
      ])
    },
    [activeModulator, scheduleLiveEmit, tuningLength, updateActiveTargetControl]
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
    () => getWaveHandlePosition(activeModulator.lfoAFrequency, activeModulator.lfoAPhaseOffset),
    [activeModulator.lfoAFrequency, activeModulator.lfoAPhaseOffset, getWaveHandlePosition]
  )
  const waveHandleB = useMemo(
    () => getWaveHandlePosition(activeModulator.lfoBFrequency, activeModulator.lfoBPhaseOffset),
    [activeModulator.lfoBFrequency, activeModulator.lfoBPhaseOffset, getWaveHandlePosition]
  )
  const waveAOpacity = clampNumber(1 - activeModulator.waveLerp, 0, 1)
  const waveBOpacity = clampNumber(activeModulator.waveLerp, 0, 1)

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
            ? activeModulator.lfoAFrequency
            : activeModulator.lfoBFrequency
          : rawNextFrequency
      const nextPhaseOffset =
        lockMode === 'frequency'
          ? wave === 'a'
            ? activeModulator.lfoAPhaseOffset
            : activeModulator.lfoBPhaseOffset
          : rawNextPhaseOffset
      const nextState = {
        ...activeModulator,
        lfoAFrequency: wave === 'a' ? nextFrequency : activeModulator.lfoAFrequency,
        lfoAPhaseOffset: wave === 'a' ? nextPhaseOffset : activeModulator.lfoAPhaseOffset,
        lfoBFrequency: wave === 'b' ? nextFrequency : activeModulator.lfoBFrequency,
        lfoBPhaseOffset: wave === 'b' ? nextPhaseOffset : activeModulator.lfoBPhaseOffset,
      }

      updateActiveModulator({
        lfoAFrequency: nextState.lfoAFrequency,
        lfoAPhaseOffset: nextState.lfoAPhaseOffset,
        lfoBFrequency: nextState.lfoBFrequency,
        lfoBPhaseOffset: nextState.lfoBPhaseOffset,
      })
      lastWaveHandleUsedRef.current = wave
      emitEnabledTargetsForState(nextState)
    },
    [activeModulator, emitEnabledTargetsForState, lastWaveHandleUsedRef, updateActiveModulator]
  )

  const snapWaveToCenterGuides = useCallback(
    (wave: 'a' | 'b', options: { snapFrequency?: boolean; snapOffset?: boolean }): void => {
      const nextState = {
        ...activeModulator,
        lfoAFrequency: wave === 'a' && options.snapFrequency ? 1 : activeModulator.lfoAFrequency,
        lfoAPhaseOffset: wave === 'a' && options.snapOffset ? 0 : activeModulator.lfoAPhaseOffset,
        lfoBFrequency: wave === 'b' && options.snapFrequency ? 1 : activeModulator.lfoBFrequency,
        lfoBPhaseOffset: wave === 'b' && options.snapOffset ? 0 : activeModulator.lfoBPhaseOffset,
      }

      updateActiveModulator({
        lfoAFrequency: nextState.lfoAFrequency,
        lfoAPhaseOffset: nextState.lfoAPhaseOffset,
        lfoBFrequency: nextState.lfoBFrequency,
        lfoBPhaseOffset: nextState.lfoBPhaseOffset,
      })
      lastWaveHandleUsedRef.current = wave
      emitEnabledTargetsForState(nextState)
    },
    [activeModulator, emitEnabledTargetsForState, lastWaveHandleUsedRef, updateActiveModulator]
  )

  const selectWaveType = useCallback(
    (wave: 'a' | 'b', waveType: WaveType): void => {
      const nextState = {
        ...activeModulator,
        waveAType: wave === 'a' ? waveType : activeModulator.waveAType,
        waveBType: wave === 'b' ? waveType : activeModulator.waveBType,
      }
      updateActiveModulator({
        waveAType: nextState.waveAType,
        waveBType: nextState.waveBType,
      })
      setOpenWaveMenu(null)
      emitEnabledTargetsForState(nextState)
    },
    [activeModulator, emitEnabledTargetsForState, setOpenWaveMenu, updateActiveModulator]
  )

  return {
    waveAPreviewPath,
    waveBPreviewPath,
    morphedWavePreviewPath,
    scheduleLiveEmit,
    updateTargetControl,
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
  }
}
