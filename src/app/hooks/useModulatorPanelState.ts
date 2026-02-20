import { useRef, useState } from 'react'
import { createInitialModulatorPanelState, createInitialTargetControls } from '../shared'
import type {
  ModTarget,
  ModulatorPanelState,
  TargetControl,
  WaveType,
} from '../shared'

type PadDragState = {
  pointerId: number
  target: ModTarget
  mode: 'amount' | 'center'
  host: HTMLDivElement
  startClientX: number
  startClientY: number
  startAmount: number
  startCenter: number
}

type WavePadDragState = {
  pointerId: number
  wave: 'a' | 'b'
  host: HTMLDivElement
  startClientX: number
  startClientY: number
  moved: boolean
}

export function useModulatorPanelState() {
  const [modulatorInstances, setModulatorInstances] = useState<ModulatorPanelState[]>(() =>
    Array.from({ length: 4 }, () => createInitialModulatorPanelState())
  )
  const [activeModulatorTab, setActiveModulatorTab] = useState(0)

  const [waveAType, setWaveAType] = useState<WaveType>('sine')
  const [waveBType, setWaveBType] = useState<WaveType>('triangle')
  const [waveAPulseWidth, setWaveAPulseWidth] = useState(0.5)
  const [waveBPulseWidth, setWaveBPulseWidth] = useState(0.5)
  const [waveLerp, setWaveLerp] = useState(0)
  const [lfoAFrequency, setLfoAFrequency] = useState(1)
  const [lfoAPhaseOffset, setLfoAPhaseOffset] = useState(0)
  const [lfoBFrequency, setLfoBFrequency] = useState(1)
  const [lfoBPhaseOffset, setLfoBPhaseOffset] = useState(0)
  const [openWaveMenu, setOpenWaveMenu] = useState<'a' | 'b' | null>(null)

  const [targetControls, setTargetControls] = useState<Record<ModTarget, TargetControl>>(
    createInitialTargetControls()
  )

  const padDragRef = useRef<PadDragState | null>(null)
  const wavePadDragRef = useRef<WavePadDragState | null>(null)
  const lastWaveHandleUsedRef = useRef<'a' | 'b'>('a')

  const liveEmitFrameRef = useRef<number | null>(null)
  const liveEmitCommandsRef = useRef<string[] | null>(null)
  const waveMenuRef = useRef<HTMLDivElement | null>(null)
  const isSwitchingModTabRef = useRef(false)
  const modulatorInstancesRef = useRef(modulatorInstances)

  return {
    modulatorInstances,
    setModulatorInstances,
    activeModulatorTab,
    setActiveModulatorTab,
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
    openWaveMenu,
    setOpenWaveMenu,
    targetControls,
    setTargetControls,
    padDragRef,
    wavePadDragRef,
    lastWaveHandleUsedRef,
    liveEmitFrameRef,
    liveEmitCommandsRef,
    waveMenuRef,
    isSwitchingModTabRef,
    modulatorInstancesRef,
  }
}
