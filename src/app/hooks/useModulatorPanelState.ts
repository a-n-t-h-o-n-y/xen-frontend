import { useCallback, useRef, useState } from 'react'
import { createInitialModulatorPanelState } from '../domain/modulation'
import type {
  ModTarget,
  ModulatorPanelState,
  TargetControl,
} from '../domain/modulation'

const INITIAL_MODULATOR = createInitialModulatorPanelState()

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
  const [openWaveMenu, setOpenWaveMenu] = useState<'a' | 'b' | null>(null)

  const padDragRef = useRef<PadDragState | null>(null)
  const wavePadDragRef = useRef<WavePadDragState | null>(null)
  const lastWaveHandleUsedRef = useRef<'a' | 'b'>('a')

  const liveEmitFrameRef = useRef<number | null>(null)
  const liveEmitCommandsRef = useRef<string[] | null>(null)
  const waveMenuRef = useRef<HTMLDivElement | null>(null)
  const activeModulator = modulatorInstances[activeModulatorTab] ??
    modulatorInstances[0] ??
    INITIAL_MODULATOR

  const updateActiveModulator = useCallback(
    (
      update:
        | Partial<ModulatorPanelState>
        | ((current: ModulatorPanelState) => Partial<ModulatorPanelState>)
    ): void => {
      setModulatorInstances((previous) =>
        previous.map((instance, index) => {
          if (index !== activeModulatorTab) {
            return instance
          }
          const patch = typeof update === 'function' ? update(instance) : update
          return {
            ...instance,
            ...patch,
          }
        })
      )
    },
    [activeModulatorTab]
  )

  const updateActiveTargetControl = useCallback(
    (
      target: ModTarget,
      update:
        | Partial<TargetControl>
        | ((current: TargetControl) => Partial<TargetControl>)
    ): void => {
      updateActiveModulator((current) => {
        const currentControl = current.targetControls[target]
        const patch = typeof update === 'function' ? update(currentControl) : update
        return {
          targetControls: {
            ...current.targetControls,
            [target]: {
              ...currentControl,
              ...patch,
            },
          },
        }
      })
    },
    [updateActiveModulator]
  )

  const selectActiveModulatorTab = useCallback((index: number): void => {
    setOpenWaveMenu(null)
    setActiveModulatorTab(index)
  }, [])

  return {
    modulatorInstances,
    setModulatorInstances,
    activeModulatorTab,
    setActiveModulatorTab,
    selectActiveModulatorTab,
    activeModulator,
    updateActiveModulator,
    updateActiveTargetControl,
    openWaveMenu,
    setOpenWaveMenu,
    padDragRef,
    wavePadDragRef,
    lastWaveHandleUsedRef,
    liveEmitFrameRef,
    liveEmitCommandsRef,
    waveMenuRef,
  }
}
