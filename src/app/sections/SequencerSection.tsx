import { useMemo, type CSSProperties } from 'react'
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
  host: HTMLDivElement
  startClientX: number
  startClientY: number
  startFrequency: number
  startPhase: number
  mode: 'frequency-amplitude' | 'phase-offset'
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
  modulationTargetAvailable: boolean
  wavePadDragRef: { current: WavePadDragState | null }
  selectedWaveformId: string
  selectedFrequency: number
  selectedPhase: number
  waveformPaths: Array<{ id: string; points: string }>
  combinedWaveformPath: string
  updateSelectedWaveform: (update: {
    frequency?: number
    phase?: number
    amplitude?: number
    amplitude_offset?: number
  }) => void
  beginContinuousEdit: () => boolean
  commitContinuousEdit: () => void
  cancelContinuousEdit: () => void
}

function ModulatorOverlay({
  selectedOutline,
  targetAvailable,
  wavePadDragRef,
  selectedWaveformId,
  selectedFrequency,
  selectedPhase,
  waveformPaths,
  combinedWaveformPath,
  updateSelectedWaveform,
  beginContinuousEdit,
  commitContinuousEdit,
  cancelContinuousEdit,
}: {
  selectedOutline: RollSelectionSpan | null
  targetAvailable: boolean
  wavePadDragRef: { current: WavePadDragState | null }
  selectedWaveformId: string
  selectedFrequency: number
  selectedPhase: number
  waveformPaths: Array<{ id: string; points: string }>
  combinedWaveformPath: string
  updateSelectedWaveform: SequencerSectionProps['updateSelectedWaveform']
  beginContinuousEdit: () => boolean
  commitContinuousEdit: () => void
  cancelContinuousEdit: () => void
}) {
  const hasSelection = targetAvailable && selectedOutline !== null && selectedOutline.width > 0
  const overlaySpan = hasSelection ? selectedOutline : { x: 0, width: 1 }
  const overlayStyle = {
    left: `${overlaySpan.x * 100}%`,
    width: `${overlaySpan.width * 100}%`,
  } as CSSProperties

  return (
    <div className="rollModulatorOverlayLayer" aria-hidden="true">
      <div
        className={`rollModulatorOverlay${hasSelection ? '' : ' rollModulatorOverlay-previewOnly'}`}
        style={overlayStyle}
        onPointerDown={
          hasSelection
            ? (event) => {
                if (!(event.currentTarget instanceof HTMLDivElement)) {
                  return
                }
                if (!beginContinuousEdit()) return
                wavePadDragRef.current = {
                  pointerId: event.pointerId,
                  host: event.currentTarget,
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                  startFrequency: selectedFrequency,
                  startPhase: selectedPhase,
                  mode: event.shiftKey ? 'phase-offset' : 'frequency-amplitude',
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
                const bounds = drag.host.getBoundingClientRect()
                const xDelta = (event.clientX - drag.startClientX) / Math.max(bounds.width, 1)
                const yRatio = Math.max(0, Math.min(
                  (event.clientY - bounds.top) / Math.max(bounds.height, 1),
                  1
                ))
                const bipolarY = 1 - yRatio * 2
                if (drag.mode === 'phase-offset') {
                  updateSelectedWaveform({
                    phase: ((drag.startPhase + xDelta) % 1 + 1) % 1,
                    amplitude_offset: bipolarY,
                  })
                } else {
                  updateSelectedWaveform({
                    frequency: Math.max(0, Math.min(drag.startFrequency + xDelta, 1)),
                    amplitude: bipolarY,
                  })
                }
              }
            : undefined
        }
        onPointerUp={
          hasSelection
            ? (event) => {
                const drag = wavePadDragRef.current
                if (drag?.pointerId === event.pointerId) {
                  wavePadDragRef.current = null
                  if (drag.moved) commitContinuousEdit()
                  else cancelContinuousEdit()
                }
              }
            : undefined
        }
        onPointerCancel={
          hasSelection
            ? (event) => {
                if (wavePadDragRef.current?.pointerId === event.pointerId) {
                  wavePadDragRef.current = null
                  cancelContinuousEdit()
                }
              }
            : undefined
        }
        title="Drag to edit frequency and amplitude. Shift-drag edits phase and amplitude offset."
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          {waveformPaths.map((waveform) => (
            <polyline
              key={waveform.id}
              points={waveform.points}
              className={`modWaveLine${waveform.id === selectedWaveformId ? ' modWaveLine-selected' : ''}`}
            />
          ))}
          <polyline points={combinedWaveformPath} className="modWaveLine modWaveLine-mix" />
        </svg>
        {!hasSelection ? (
          <span className="rollModulatorEmpty">
            Select a Sequence or a Cell containing a Sequence to apply modulation.
          </span>
        ) : null}
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
  modulationTargetAvailable,
  wavePadDragRef,
  selectedWaveformId,
  selectedFrequency,
  selectedPhase,
  waveformPaths,
  combinedWaveformPath,
  updateSelectedWaveform,
  beginContinuousEdit,
  commitContinuousEdit,
  cancelContinuousEdit,
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
                selectedOutline={selectedOutline ?? null}
                targetAvailable={modulationTargetAvailable}
                wavePadDragRef={wavePadDragRef}
                selectedWaveformId={selectedWaveformId}
                selectedFrequency={selectedFrequency}
                selectedPhase={selectedPhase}
                waveformPaths={waveformPaths}
                combinedWaveformPath={combinedWaveformPath}
                updateSelectedWaveform={updateSelectedWaveform}
                beginContinuousEdit={beginContinuousEdit}
                commitContinuousEdit={commitContinuousEdit}
                cancelContinuousEdit={cancelContinuousEdit}
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
