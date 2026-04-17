import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { REFERENCE_RATIOS } from '../shared'
import type { BgOverlayState } from '../shared'

type RollNoteSpan = {
  x: number
  width: number
  pitch: number
  velocity: number
  isGlowing: boolean
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

type SequencerSectionProps = {
  bridgeUnavailableMessage: string | null
  pitchRows: number[]
  staffLineBandByPitch: number[]
  backgroundOverlayStates: BgOverlayState[]
  selectionSpans: RollSelectionSpan[]
  tuningLength: number
  rollNotes: RollNoteSpan[]
  playheadPhase: number | null
  ratioToBottom: (ratio: number) => number
  rulerRatios: number[]
  highlightedPitches: Set<number>
}

export function SequencerSection({
  bridgeUnavailableMessage,
  pitchRows,
  staffLineBandByPitch,
  backgroundOverlayStates: _backgroundOverlayStates,
  selectionSpans,
  tuningLength,
  rollNotes,
  playheadPhase,
  ratioToBottom,
  rulerRatios,
  highlightedPitches: _highlightedPitches,
}: SequencerSectionProps) {
  void [_backgroundOverlayStates, _highlightedPitches]
  const pianoRollRef = useRef<HTMLDivElement | null>(null)
  const [pianoRollHeight, setPianoRollHeight] = useState(0)

  useLayoutEffect(() => {
    const element = pianoRollRef.current
    if (!element) {
      return
    }

    const updateHeight = (): void => {
      setPianoRollHeight(element.clientHeight)
    }

    updateHeight()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight)
      return () => {
        window.removeEventListener('resize', updateHeight)
      }
    }

    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [])

  const rollRowMetrics = useMemo(() => {
    if (pianoRollHeight <= 0 || tuningLength <= 0) {
      return null
    }

    const rowHeight = Math.floor(pianoRollHeight / tuningLength)
    const lastRowHeight = pianoRollHeight - rowHeight * (tuningLength - 1)

    return {
      rowHeight,
      lastRowHeight,
      gridTemplateRows: `${Array.from({ length: Math.max(tuningLength - 1, 0) }, () => `${rowHeight}px`).join(' ')}${tuningLength > 1 ? ' ' : ''}${lastRowHeight}px`,
    }
  }, [pianoRollHeight, tuningLength])

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

          <div className="pianoRoll" ref={pianoRollRef} role="img" aria-label="Single octave piano roll">
            <div
              className="rollGrid"
              aria-hidden="true"
              style={rollRowMetrics ? { gridTemplateRows: rollRowMetrics.gridTemplateRows } : undefined}
            >
              {pitchRows.map((pitch) => (
                <div
                  key={`roll-row-${pitch}`}
                  className={`rollRow ${(staffLineBandByPitch[pitch] ?? 0) === 0 ? 'rollRow-bandEven' : 'rollRow-bandOdd'}`}
                />
              ))}
            </div>
            {selectionSpans.length > 1 ? (
              <div className="rollCellDividerLayer" aria-hidden="true">
                <span
                  className="rollCellDivider rollCellDivider-edge"
                  style={{ left: `${selectionSpans[0].x * 100}%` }}
                />
                {selectionSpans.map((span, index) =>
                  span.hasRightDivider ? (
                    <span
                      key={`roll-divider-${index}`}
                      className="rollCellDivider"
                      style={{ left: `${(span.x + span.width) * 100}%` }}
                    />
                  ) : null
                )}
                <span
                  className="rollCellDivider rollCellDivider-edge"
                  style={{
                    left: `${(selectionSpans[selectionSpans.length - 1].x + selectionSpans[selectionSpans.length - 1].width) * 100}%`,
                  }}
                />
              </div>
            ) : null}
            <div className="rollNoteLayer" aria-hidden="true">
              {rollNotes.map((note, noteIndex) => {
                const rowFromTop = tuningLength - 1 - note.pitch
                const isBottomRow = rowFromTop === tuningLength - 1
                const rowHeightPx = rollRowMetrics?.rowHeight ?? 0
                const lastRowHeightPx = rollRowMetrics?.lastRowHeight ?? 0
                const rowTopPx = rollRowMetrics ? rowFromTop * rowHeightPx : 0
                const rowHeight = isBottomRow ? lastRowHeightPx : Math.max(0, rowHeightPx - 1)

                return (
                  <div
                    key={`roll-note-${noteIndex}`}
                    className="rollCellNote"
                    style={
                      {
                        left: `${note.x * 100}%`,
                        width: `${note.width * 100}%`,
                        top: `${rowTopPx}px`,
                        height: `${rowHeight}px`,
                        background: `rgb(241 245 249 / ${0.18 + note.velocity * 0.72})`,
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
