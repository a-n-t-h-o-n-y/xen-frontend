import { useEffect, useRef } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { TransportState } from '../shared'

type UseTransportPlayheadArgs = {
  selectedMeasureIndex: number
  selectedMeasureNumerator: number
  selectedMeasureDenominator: number
  transportRef: MutableRefObject<TransportState>
  selectedMeasureIndexRef: MutableRefObject<number>
  selectedTimeSignatureRef: MutableRefObject<{ numerator: number; denominator: number }>
  setPlayheadPhase: Dispatch<SetStateAction<number | null>>
}

export function useTransportPlayhead({
  selectedMeasureIndex,
  selectedMeasureNumerator,
  selectedMeasureDenominator,
  transportRef,
  selectedMeasureIndexRef,
  selectedTimeSignatureRef,
  setPlayheadPhase,
}: UseTransportPlayheadArgs) {
  const animationFrameRef = useRef<number | null>(null)
  const lastAnimationFrameMsRef = useRef<number | null>(null)

  useEffect(() => {
    selectedMeasureIndexRef.current = selectedMeasureIndex
    selectedTimeSignatureRef.current = {
      numerator: selectedMeasureNumerator,
      denominator: selectedMeasureDenominator,
    }

    if (transportRef.current.active[selectedMeasureIndex]) {
      setPlayheadPhase(transportRef.current.phase[selectedMeasureIndex] ?? 0)
      return
    }

    setPlayheadPhase(null)
  }, [
    selectedMeasureDenominator,
    selectedMeasureIndex,
    selectedMeasureIndexRef,
    selectedMeasureNumerator,
    selectedTimeSignatureRef,
    setPlayheadPhase,
    transportRef,
  ])

  useEffect(() => {
    const tick = (frameTimeMs: number): void => {
      if (lastAnimationFrameMsRef.current === null) {
        lastAnimationFrameMsRef.current = frameTimeMs
      }

      const dtSec = Math.max(0, (frameTimeMs - (lastAnimationFrameMsRef.current ?? frameTimeMs)) / 1000)
      lastAnimationFrameMsRef.current = frameTimeMs

      const selectedIndex = selectedMeasureIndexRef.current
      const { numerator, denominator } = selectedTimeSignatureRef.current
      const transport = transportRef.current

      if (!transport.active[selectedIndex] || transport.bpm <= 0 || numerator <= 0 || denominator <= 0) {
        setPlayheadPhase((previous) => (previous === null ? previous : null))
        animationFrameRef.current = requestAnimationFrame(tick)
        return
      }

      const quartersPerLoop = numerator * (4 / denominator)
      const loopSec = (quartersPerLoop * 60) / transport.bpm
      if (loopSec <= 0) {
        setPlayheadPhase((previous) => (previous === null ? previous : null))
        animationFrameRef.current = requestAnimationFrame(tick)
        return
      }

      const nextPhase = (transport.phase[selectedIndex] + dtSec / loopSec) % 1
      transport.phase[selectedIndex] = nextPhase
      setPlayheadPhase(nextPhase)
      animationFrameRef.current = requestAnimationFrame(tick)
    }

    animationFrameRef.current = requestAnimationFrame(tick)
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      lastAnimationFrameMsRef.current = null
    }
  }, [selectedMeasureIndexRef, selectedTimeSignatureRef, setPlayheadPhase, transportRef])
}
