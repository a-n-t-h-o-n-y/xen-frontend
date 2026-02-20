import type { CSSProperties, ReactNode } from 'react'
import {
  REFERENCE_RATIOS,
  getSequenceOverlayColor,
  normalizePitch,
} from '../shared'
import type { BgOverlayState, Cell } from '../shared'

type SequencerSectionProps = {
  bridgeUnavailableMessage: string | null
  pitchRows: number[]
  backgroundOverlayStates: BgOverlayState[]
  tuningLength: number
  renderRollCells: (cells: Cell[], path: number[], depth: number) => ReactNode
  rootCells: Cell[]
  playheadPhase: number | null
  ratioToBottom: (ratio: number) => number
  rulerRatios: number[]
  highlightedPitches: Set<number>
}

export function SequencerSection({
  bridgeUnavailableMessage,
  pitchRows,
  backgroundOverlayStates,
  tuningLength,
  renderRollCells,
  rootCells,
  playheadPhase,
  ratioToBottom,
  rulerRatios,
  highlightedPitches,
}: SequencerSectionProps) {
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
            <div className="rollBackgroundOverlay" aria-hidden="true">
              {backgroundOverlayStates.map((overlay) => (
                <div
                  key={`roll-bg-overlay-${overlay.sequenceIndex}`}
                  className="rollBackgroundLayer"
                  aria-hidden="true"
                >
                  {overlay.notes.map((note, noteIndex) => {
                    const normalizedPitch = normalizePitch(note.pitch, tuningLength)
                    const rowFromTop = tuningLength - 1 - normalizedPitch
                    const rowHeightPercent = 100 / Math.max(tuningLength, 1)
                    const rowTopPercent = rowFromTop * rowHeightPercent
                    const bgNoteHeightPercent = rowHeightPercent * 0.76
                    const bgNoteTopPercent = rowTopPercent + (rowHeightPercent - bgNoteHeightPercent) / 2
                    const noteAlpha = 0.06 + note.velocity * 0.14

                    return (
                      <div
                        key={`roll-bg-note-${overlay.sequenceIndex}-${noteIndex}`}
                        className="rollBgNote"
                        style={
                          {
                            left: `calc(${note.x * 100}% + 4px)`,
                            width: `max(calc(${note.width * 100}% - 9px), 1px)`,
                            top: `${bgNoteTopPercent}%`,
                            height: `${bgNoteHeightPercent}%`,
                            background: getSequenceOverlayColor(overlay.sequenceIndex, noteAlpha),
                            borderColor: getSequenceOverlayColor(overlay.sequenceIndex, 0.24),
                          } as CSSProperties
                        }
                      />
                    )
                  })}
                  {overlay.triggerPhase !== null ? (
                    <div
                      className="rollBgTrigger"
                      style={
                        {
                          left: `${overlay.triggerPhase * 100}%`,
                          background: getSequenceOverlayColor(overlay.sequenceIndex, 0.64),
                        } as CSSProperties
                      }
                    />
                  ) : null}
                </div>
              ))}
            </div>
            <div className="rollIslands" aria-hidden="true">
              {renderRollCells(
                rootCells.length > 0 ? rootCells : [{ type: 'Rest', weight: 1 }],
                [],
                0
              )}
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
                className={`rulerMark rulerMark-tuning${highlightedPitches.has(index) ? ' rulerMark-active' : ''}`}
                style={{ bottom: `${ratioToBottom(ratio)}%` }}
              />
            ))}
          </aside>
        </section>
      )}
    </main>
  )
}
