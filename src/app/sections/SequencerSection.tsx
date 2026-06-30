import { useEffect, useMemo, useRef, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { REFERENCE_RATIOS } from '../domain/music'
import { getNoteFillColor, isNoteOffVelocity } from './sequencerNoteColor'
import type { BgOverlayState } from '../presentation/viewModels'

type RollNoteSpan = {
  x: number
  width: number
  pitch: number
  velocity: number
  isSelected: boolean
  hasDelay: boolean
  shortGate: boolean
  octaveLabel: string | null
}

type RollSelectionSpan = {
  x: number
  width: number
  tone: 'selected' | 'sequenceEven' | 'sequenceOdd'
  hasRightDivider: boolean
}

type RollCellMuteWindow = {
  x: number
  width: number
}

type RollSequenceDivider = {
  x: number
  depth: number
}

type WavePadDragState = {
  pointerId: number
  wave: 'a' | 'b'
  host: HTMLDivElement
  startClientX: number
  startClientY: number
  moved: boolean
}

type SequencerSectionProps = {
  bridgeUnavailableMessage: string | null
  pitchRows: number[]
  staffLineBandByPitch: number[]
  backgroundOverlayStates: BgOverlayState[]
  cellMuteWindow: RollCellMuteWindow | null
  sequenceDividerPositions: RollSequenceDivider[]
  selectionSpans: RollSelectionSpan[]
  tuningLength: number
  rollNotes: RollNoteSpan[]
  playheadPhase: number | null
  ratioToBottom: (ratio: number) => number
  rulerRatios: number[]
  highlightedPitches: Set<number>
  isModulatorMode: boolean
  wavePadDragRef: { current: WavePadDragState | null }
  clampNumber: (value: number, min: number, max: number) => number
  waveHandleA: { x: number; y: number }
  waveHandleB: { x: number; y: number }
  lastWaveHandleUsedRef: { current: 'a' | 'b' }
  snapWaveToCenterGuides: (
    wave: 'a' | 'b',
    options: { snapFrequency: boolean; snapOffset: boolean }
  ) => void
  applyWavePadMotion: (
    wave: 'a' | 'b',
    host: HTMLDivElement,
    clientX: number,
    clientY: number,
    lockMode: 'frequency' | 'offset' | 'none'
  ) => void
  waveAOpacity: number
  waveBOpacity: number
  waveAPreviewPath: string
  waveBPreviewPath: string
  morphedWavePreviewPath: string
  setModulatorPreviewWidth: Dispatch<SetStateAction<number>>
}

function ModulatorOverlay({
  selectedOutline,
  wavePadDragRef,
  clampNumber,
  waveHandleA,
  waveHandleB,
  lastWaveHandleUsedRef,
  snapWaveToCenterGuides,
  applyWavePadMotion,
  waveAOpacity,
  waveBOpacity,
  waveAPreviewPath,
  waveBPreviewPath,
  morphedWavePreviewPath,
  setModulatorPreviewWidth,
}: {
  selectedOutline: RollSelectionSpan | null
  wavePadDragRef: { current: WavePadDragState | null }
  clampNumber: (value: number, min: number, max: number) => number
  waveHandleA: { x: number; y: number }
  waveHandleB: { x: number; y: number }
  lastWaveHandleUsedRef: { current: 'a' | 'b' }
  snapWaveToCenterGuides: (
    wave: 'a' | 'b',
    options: { snapFrequency: boolean; snapOffset: boolean }
  ) => void
  applyWavePadMotion: (
    wave: 'a' | 'b',
    host: HTMLDivElement,
    clientX: number,
    clientY: number,
    lockMode: 'frequency' | 'offset' | 'none'
  ) => void
  waveAOpacity: number
  waveBOpacity: number
  waveAPreviewPath: string
  waveBPreviewPath: string
  morphedWavePreviewPath: string
  setModulatorPreviewWidth: Dispatch<SetStateAction<number>>
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const hasSelection = selectedOutline !== null && selectedOutline.width > 0
  const overlaySpan = hasSelection ? selectedOutline : { x: 0, width: 1 }
  const overlayStyle = {
    left: `${overlaySpan.x * 100}%`,
    width: `${overlaySpan.width * 100}%`,
  } as CSSProperties

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) {
      setModulatorPreviewWidth(0)
      return
    }

    const updateWidth = (): void => {
      setModulatorPreviewWidth(Math.round(overlay.getBoundingClientRect().width))
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(overlay)
    return () => observer.disconnect()
  }, [hasSelection, overlayStyle.left, overlayStyle.width, setModulatorPreviewWidth])

  return (
    <div className="rollModulatorOverlayLayer" aria-hidden="true">
      <div
        ref={overlayRef}
        className={`rollModulatorOverlay${hasSelection ? '' : ' rollModulatorOverlay-previewOnly'}`}
        style={overlayStyle}
        onPointerDown={
          hasSelection
            ? (event) => {
                if (!(event.currentTarget instanceof HTMLDivElement)) {
                  return
                }
                const bounds = event.currentTarget.getBoundingClientRect()
                const xRatio = clampNumber((event.clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1)
                const yRatio = clampNumber((event.clientY - bounds.top) / Math.max(bounds.height, 1), 0, 1)
                const distanceA = Math.hypot(xRatio - waveHandleA.x / 100, yRatio - waveHandleA.y / 100)
                const distanceB = Math.hypot(xRatio - waveHandleB.x / 100, yRatio - waveHandleB.y / 100)
                const selectedWave: 'a' | 'b' = distanceA <= distanceB ? 'a' : 'b'
                wavePadDragRef.current = {
                  pointerId: event.pointerId,
                  wave: selectedWave,
                  host: event.currentTarget,
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                  moved: false,
                }
                event.currentTarget.setPointerCapture(event.pointerId)
              }
            : undefined
        }
        onPointerMove={
          hasSelection
            ? (event) => {
                const drag = wavePadDragRef.current
                if (!drag || drag.pointerId !== event.pointerId) {
                  return
                }
                const movedDistance = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY)
                if (!drag.moved && movedDistance >= 3) {
                  drag.moved = true
                }
                if (!drag.moved) {
                  return
                }
                const lockMode = event.shiftKey ? 'frequency' : event.altKey ? 'offset' : 'none'
                applyWavePadMotion(drag.wave, drag.host, event.clientX, event.clientY, lockMode)
              }
            : undefined
        }
        onPointerUp={
          hasSelection
            ? (event) => {
                const drag = wavePadDragRef.current
                if (drag?.pointerId === event.pointerId) {
                  if (!drag.moved) {
                    const clickWave = lastWaveHandleUsedRef.current
                    const bounds = drag.host.getBoundingClientRect()
                    const xRatio = clampNumber((event.clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1)
                    const yRatio = clampNumber((event.clientY - bounds.top) / Math.max(bounds.height, 1), 0, 1)
                    const isNearFreqCenterLine = Math.abs(xRatio - 0.5) <= 0.06
                    const isNearCenterLine = Math.abs(yRatio - 0.5) <= 0.06
                    if (isNearCenterLine || isNearFreqCenterLine) {
                      snapWaveToCenterGuides(clickWave, {
                        snapFrequency: isNearFreqCenterLine,
                        snapOffset: isNearCenterLine,
                      })
                    } else {
                      const lockMode = event.shiftKey ? 'frequency' : event.altKey ? 'offset' : 'none'
                      applyWavePadMotion(clickWave, drag.host, event.clientX, event.clientY, lockMode)
                    }
                  }
                  wavePadDragRef.current = null
                }
              }
            : undefined
        }
        onPointerCancel={
          hasSelection
            ? (event) => {
                if (wavePadDragRef.current?.pointerId === event.pointerId) {
                  wavePadDragRef.current = null
                }
              }
            : undefined
        }
        title="Drag handle: horizontal = frequency, vertical = phase offset. Shift=frequency only. Option/Alt=offset only."
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline points={waveAPreviewPath} className="modWaveLine modWaveLine-a" style={{ opacity: waveAOpacity }} />
          <polyline points={waveBPreviewPath} className="modWaveLine modWaveLine-b" style={{ opacity: waveBOpacity }} />
          <polyline points={morphedWavePreviewPath} className="modWaveLine modWaveLine-mix" />
        </svg>
        <span
          className="modWaveHandle modWaveHandle-a"
          style={{ left: `${waveHandleA.x}%`, top: `${waveHandleA.y}%`, opacity: waveAOpacity }}
        />
        <span
          className="modWaveHandle modWaveHandle-b"
          style={{ left: `${waveHandleB.x}%`, top: `${waveHandleB.y}%`, opacity: waveBOpacity }}
        />
      </div>
    </div>
  )
}

export function SequencerSection({
  bridgeUnavailableMessage,
  pitchRows,
  staffLineBandByPitch,
  backgroundOverlayStates: _backgroundOverlayStates,
  cellMuteWindow,
  sequenceDividerPositions,
  selectionSpans,
  tuningLength,
  rollNotes,
  playheadPhase,
  ratioToBottom,
  rulerRatios,
  highlightedPitches: _highlightedPitches,
  isModulatorMode,
  wavePadDragRef,
  clampNumber,
  waveHandleA,
  waveHandleB,
  lastWaveHandleUsedRef,
  snapWaveToCenterGuides,
  applyWavePadMotion,
  waveAOpacity,
  waveBOpacity,
  waveAPreviewPath,
  waveBPreviewPath,
  morphedWavePreviewPath,
  setModulatorPreviewWidth,
}: SequencerSectionProps) {
  void [_backgroundOverlayStates, _highlightedPitches]
  const rollRowTemplate = useMemo(() => {
    if (tuningLength <= 0) {
      return null
    }

    return `repeat(${tuningLength}, minmax(0, 1fr))`
  }, [tuningLength])

  const selectedOutline = selectionSpans.length > 0 ? selectionSpans[0] : null

  return (
    <main className="sequencer">
      {bridgeUnavailableMessage ? (
        <section className="bridgeNotice" aria-live="polite">
          <h1 className="bridgeNoticeTitle">JUCE native bridge not detected</h1>
          <p className="bridgeNoticeBody">{bridgeUnavailableMessage}</p>
          <p className="bridgeNoticeHint">
            Run this frontend inside the JUCE WebView host to enable backend requests and events.
          </p>
        </section>
      ) : (
        <section className="sequencerShell" aria-label="Single octave sequencer view">
          <aside className="pitchIndexBar" aria-label="Pitch index">
            {pitchRows.map((pitch) => (
              <div key={`left-pitch-${pitch}`} className="pitchIndexRow mono">
                {pitch}
              </div>
            ))}
          </aside>

          <div className="pianoRoll" role="img" aria-label="Single octave piano roll">
            <div
              className="rollGrid"
              aria-hidden="true"
              style={rollRowTemplate ? { gridTemplateRows: rollRowTemplate } : undefined}
            >
              {pitchRows.map((pitch) => (
                <div
                  key={`roll-row-${pitch}`}
                  className={`rollRow ${(staffLineBandByPitch[pitch] ?? 0) === 0 ? 'rollRow-bandEven' : 'rollRow-bandOdd'}`}
                />
              ))}
            </div>
            {sequenceDividerPositions.length > 0 ? (
              <div className="rollCellDividerLayer" aria-hidden="true">
                {sequenceDividerPositions.map((divider, index) => (
                  <span
                    key={`roll-divider-${index}`}
                    className={`rollCellDivider${divider.depth > 0 ? ' rollCellDivider-nested' : ''}`}
                    style={{ left: `${divider.x * 100}%` }}
                  />
                ))}
              </div>
            ) : null}
            {cellMuteWindow ? (
              <div className="rollCellMuteLayer" aria-hidden="true">
                {cellMuteWindow.x > 0 ? (
                  <span
                    className="rollCellMuteSpan"
                    style={
                      {
                        left: 0,
                        width: `${cellMuteWindow.x * 100}%`,
                      } as CSSProperties
                    }
                  />
                ) : null}
                {cellMuteWindow.x + cellMuteWindow.width < 1 ? (
                  <span
                    className="rollCellMuteSpan"
                    style={
                      {
                        left: `${(cellMuteWindow.x + cellMuteWindow.width) * 100}%`,
                        right: 0,
                      } as CSSProperties
                    }
                  />
                ) : null}
              </div>
            ) : null}
            {selectedOutline ? (
              <div className="rollSelectionOutlineLayer" aria-hidden="true">
                <span
                  className="rollSelectionOutline"
                  style={
                    {
                      left: `${selectedOutline.x * 100}%`,
                      width: `${selectedOutline.width * 100}%`,
                    } as CSSProperties
                  }
                />
              </div>
            ) : null}
            <div className="rollNoteLayer" aria-hidden="true">
              {rollNotes.map((note, noteIndex) => {
                const rowFromTop = tuningLength - 1 - note.pitch
                const noteZIndex = note.isSelected ? 4 : 2
                const rowHeightPercent = tuningLength > 0 ? 100 / tuningLength : 0
                const isNoteOff = isNoteOffVelocity(note.velocity)

                return (
                  <div
                    key={`roll-note-${noteIndex}`}
                    className={[
                      'rollCellNote',
                      isNoteOff ? 'rollCellNote-noteOff' : '',
                      note.isSelected ? 'rollCellNote-selected' : '',
                    ].filter(Boolean).join(' ')}
                    style={
                      {
                        left: `calc(${note.x * 100}% + 1px)`,
                        width: `calc(${note.width * 100}% - 1px)`,
                        top: `${rowFromTop * rowHeightPercent}%`,
                        height: `calc(${rowHeightPercent}% - 1px)`,
                        zIndex: noteZIndex,
                        background: getNoteFillColor(note.velocity),
                      } as CSSProperties
                    }
                  >
                    {note.octaveLabel ? (
                      <span className="rollNoteOctave mono">{note.octaveLabel}</span>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {isModulatorMode ? (
              <ModulatorOverlay
                selectedOutline={selectedOutline}
                wavePadDragRef={wavePadDragRef}
                clampNumber={clampNumber}
                waveHandleA={waveHandleA}
                waveHandleB={waveHandleB}
                lastWaveHandleUsedRef={lastWaveHandleUsedRef}
                snapWaveToCenterGuides={snapWaveToCenterGuides}
                applyWavePadMotion={applyWavePadMotion}
                waveAOpacity={waveAOpacity}
                waveBOpacity={waveBOpacity}
                waveAPreviewPath={waveAPreviewPath}
                waveBPreviewPath={waveBPreviewPath}
                morphedWavePreviewPath={morphedWavePreviewPath}
                setModulatorPreviewWidth={setModulatorPreviewWidth}
              />
            ) : null}
            {playheadPhase !== null ? (
              <div
                className="rollPlayhead"
                style={{ left: `${Math.max(0, Math.min(playheadPhase, 1)) * 100}%` }}
                aria-hidden="true"
              />
            ) : null}
          </div>

          <aside className="tuningRuler" aria-label="Tuning ruler">
            <div className="tuningRulerLine" />
            {REFERENCE_RATIOS.map((ratio, index) => (
              <span
                key={`reference-mark-${index}`}
                className="rulerMark rulerMark-reference"
                style={{ bottom: `${ratioToBottom(ratio)}%` }}
              />
            ))}
            {rulerRatios.map((ratio, index) => (
              <span
                key={`tuning-mark-${index}`}
                className={`rulerMark rulerMark-tuning${_highlightedPitches.has(index) ? ' rulerMark-active' : ''}`}
                style={{ bottom: `${ratioToBottom(ratio)}%` }}
              />
            ))}
          </aside>
        </section>
      )}
    </main>
  )
}
