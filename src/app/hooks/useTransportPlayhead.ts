import { useEffect, useRef } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { TransportState } from '../constants'

type UseTransportPlayheadArgs = {
  sequenceNumerator: number
  sequenceDenominator: number
  transportRef: MutableRefObject<TransportState>
  selectedTimeSignatureRef: MutableRefObject<{ numerator: number; denominator: number }>
  setPlayheadPhase: Dispatch<SetStateAction<number | null>>
}

export function useTransportPlayhead({
  sequenceNumerator,
  sequenceDenominator,
  transportRef,
  selectedTimeSignatureRef,
  setPlayheadPhase,
}: UseTransportPlayheadArgs) {
  const animationFrameRef = useRef<number | null>(null)
  const lastAnimationFrameMsRef = useRef<number | null>(null)

  useEffect(() => {
    selectedTimeSignatureRef.current = {
      numerator: sequenceNumerator,
      denominator: sequenceDenominator,
    }

    if (transportRef.current.active) {
      setPlayheadPhase(transportRef.current.phase)
      return
    }

    setPlayheadPhase(null)
  }, [
    sequenceDenominator,
    sequenceNumerator,
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

      const { numerator, denominator } = selectedTimeSignatureRef.current
      const transport = transportRef.current

      if (!transport.active || transport.bpm <= 0 || numerator <= 0 || denominator <= 0) {
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

      const nextPhase = (transport.phase + dtSec / loopSec) % 1
      transport.phase = nextPhase
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
  }, [selectedTimeSignatureRef, setPlayheadPhase, transportRef])
}
