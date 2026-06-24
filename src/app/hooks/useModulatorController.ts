import { useCallback, useEffect, useMemo } from 'react'
import {
  LFO_PHASE_OFFSET_MAX,
  LFO_PHASE_OFFSET_MIN,
  MOD_TARGET_ORDER,
  clampNumber,
  createMorphModulator,
  createTargetModulator,
  frequencyToRatio,
  getErrorMessage,
  getModTargetSpecForTuning,
  ratioToFrequency,
  sampleWaveShape,
  toNormalizedPhase,
  roundByStep,
} from '../shared'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  MessageLevel,
  ModTarget,
  ModulatorPanelState,
  TargetControl,
  WaveType,
} from '../shared'

type UseModulatorControllerArgs = {
  bridgeUnavailableMessage: string | null
  tuningLength: number
  executeBackendCommand: (command: string) => Promise<void>
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
  modulatorInstances: ModulatorPanelState[]
  setModulatorInstances: Dispatch<SetStateAction<ModulatorPanelState[]>>
  activeModulatorTab: number
  waveAType: WaveType
  setWaveAType: Dispatch<SetStateAction<WaveType>>
  waveBType: WaveType
  setWaveBType: Dispatch<SetStateAction<WaveType>>
  waveAPulseWidth: number
  setWaveAPulseWidth: Dispatch<SetStateAction<number>>
  waveBPulseWidth: number
  setWaveBPulseWidth: Dispatch<SetStateAction<number>>
  waveLerp: number
  setWaveLerp: Dispatch<SetStateAction<number>>
  lfoAFrequency: number
  setLfoAFrequency: Dispatch<SetStateAction<number>>
  lfoAPhaseOffset: number
  setLfoAPhaseOffset: Dispatch<SetStateAction<number>>
  lfoBFrequency: number
  setLfoBFrequency: Dispatch<SetStateAction<number>>
  lfoBPhaseOffset: number
  setLfoBPhaseOffset: Dispatch<SetStateAction<number>>
  targetControls: Record<ModTarget, TargetControl>
  setTargetControls: Dispatch<SetStateAction<Record<ModTarget, TargetControl>>>
  setOpenWaveMenu: Dispatch<SetStateAction<'a' | 'b' | null>>
  lastWaveHandleUsedRef: MutableRefObject<'a' | 'b'>
  liveEmitFrameRef: MutableRefObject<number | null>
  liveEmitCommandsRef: MutableRefObject<string[] | null>
  isSwitchingModTabRef: MutableRefObject<boolean>
  modulatorInstancesRef: MutableRefObject<ModulatorPanelState[]>
}

export function useModulatorController({
  bridgeUnavailableMessage,
  tuningLength,
  executeBackendCommand,
  setStatusMessage,
  setStatusLevel,
  modulatorInstances,
  setModulatorInstances,
  activeModulatorTab,
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
  targetControls,
  setTargetControls,
  setOpenWaveMenu,
  lastWaveHandleUsedRef,
  liveEmitFrameRef,
  liveEmitCommandsRef,
  isSwitchingModTabRef,
  modulatorInstancesRef,
}: UseModulatorControllerArgs) {
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

  const handleWaveAPulseWidthChange = useCallback(
    (nextPulseWidth: number): void => {
      setWaveAPulseWidth(nextPulseWidth)
      const liveBase = createMorphModulator(
        waveAType,
        waveBType,
        nextPulseWidth,
        waveBPulseWidth,
        lfoAFrequency,
        toNormalizedPhase(lfoAPhaseOffset),
        lfoBFrequency,
        toNormalizedPhase(lfoBPhaseOffset),
        waveLerp
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
      setWaveAPulseWidth,
      targetControls,
      waveAType,
      waveBType,
      waveBPulseWidth,
      waveLerp,
    ]
  )

  const handleWaveBPulseWidthChange = useCallback(
    (nextPulseWidth: number): void => {
      setWaveBPulseWidth(nextPulseWidth)
      const liveBase = createMorphModulator(
        waveAType,
        waveBType,
        waveAPulseWidth,
        nextPulseWidth,
        lfoAFrequency,
        toNormalizedPhase(lfoAPhaseOffset),
        lfoBFrequency,
        toNormalizedPhase(lfoBPhaseOffset),
        waveLerp
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
      setWaveBPulseWidth,
      targetControls,
      waveAPulseWidth,
      waveAType,
      waveBType,
      waveLerp,
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
        const nextControl = {
          ...currentControl,
          enabled: true,
          center: resolvedCenter,
          amount: resolvedAmount,
        }
        updateTargetControl(target, nextControl)
        scheduleLiveEmit([buildModTargetCommand(target, nextControl, baseMorphModulator)])
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
      updateTargetControl(target, nextControl)
      scheduleLiveEmit([buildModTargetCommand(target, nextControl, baseMorphModulator)])
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

  const selectWaveType = useCallback(
    (wave: 'a' | 'b', waveType: WaveType): void => {
      const nextWaveAType = wave === 'a' ? waveType : waveAType
      const nextWaveBType = wave === 'b' ? waveType : waveBType
      if (wave === 'a') {
        setWaveAType(waveType)
      } else {
        setWaveBType(waveType)
      }
      setOpenWaveMenu(null)
      const liveBase = createMorphModulator(
        nextWaveAType,
        nextWaveBType,
        waveAPulseWidth,
        waveBPulseWidth,
        lfoAFrequency,
        toNormalizedPhase(lfoAPhaseOffset),
        lfoBFrequency,
        toNormalizedPhase(lfoBPhaseOffset),
        waveLerp
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
      setOpenWaveMenu,
      setWaveAType,
      setWaveBType,
      targetControls,
      waveAPulseWidth,
      waveAType,
      waveBPulseWidth,
      waveBType,
      waveLerp,
    ]
  )

  return {
    waveAPreviewPath,
    waveBPreviewPath,
    morphedWavePreviewPath,
    baseMorphModulator,
    scheduleLiveEmit,
    updateTargetControl,
    buildModTargetCommand,
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

