import { useRef } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import {
  MOD_TARGET_ORDER,
  getModTargetSpecForTuning,
  WAVE_OPTIONS,
  WAVE_OPTION_LABELS,
  type ModTarget,
  type ModulatorPanelState,
  type WaveType,
} from '../../domain/modulation'

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

type ModulatorsPanelProps = {
  activeModulatorTab: number
  activeModulator: ModulatorPanelState
  selectActiveModulatorTab: (index: number) => void
  selectWaveType: (wave: 'a' | 'b', waveType: WaveType) => void
  onWaveLerpChange: (value: number) => void
  onWaveAPulseWidthChange: (value: number) => void
  onWaveBPulseWidthChange: (value: number) => void
  clampNumber: (value: number, min: number, max: number) => number
  setTargetEnabled: (target: ModTarget, enabled: boolean) => void
  resetTargetControl: (target: ModTarget) => void
  padDragRef: { current: PadDragState | null }
  applyPadMotion: (
    target: ModTarget,
    host: HTMLDivElement,
    clientX: number,
    clientY: number,
    mode: 'amount' | 'center',
    start: {
      startClientX: number
      startClientY: number
      startAmount: number
      startCenter: number
    },
    precision: 'fine' | 'coarse'
  ) => void
  tuningLength: number
  beginContinuousEdit: () => boolean
  commitContinuousEdit: () => void
  cancelContinuousEdit: () => void
}

const RANGE_ADJUSTMENT_KEYS = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
])

const useContinuousRangeKeyboardEdit = (
  begin: () => boolean,
  commit: () => void,
  cancel: () => void
) => {
  const keyboardActiveRef = useRef(false)

  return {
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (RANGE_ADJUSTMENT_KEYS.has(event.key) && !event.repeat) {
        keyboardActiveRef.current = begin()
      }
    },
    onKeyUp: (event: KeyboardEvent<HTMLInputElement>) => {
      if (!RANGE_ADJUSTMENT_KEYS.has(event.key) || !keyboardActiveRef.current) return
      keyboardActiveRef.current = false
      commit()
    },
    onBlur: () => {
      if (!keyboardActiveRef.current) return
      keyboardActiveRef.current = false
      cancel()
    },
  }
}

const formatSignedAmount = (value: number): string => {
  if (Math.abs(value) < 0.005) {
    return '0'
  }
  const formatted = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)
  return value > 0 ? `+${formatted}` : formatted
}

const WAVE_OPTION_SHORT_LABELS: Record<WaveType, string> = {
  sine: 'Sine',
  triangle: 'Tri',
  sawtooth_up: 'Saw+',
  sawtooth_down: 'Saw-',
  square: 'Sqr',
}

function WaveSelectControl({
  wave,
  label,
  waveType,
  pulseWidth,
  setPulseWidth,
  selectWaveType,
  beginContinuousEdit,
  commitContinuousEdit,
  cancelContinuousEdit,
}: {
  wave: 'a' | 'b'
  label: string
  waveType: WaveType
  pulseWidth: number
  setPulseWidth: (value: number) => void
  selectWaveType: (wave: 'a' | 'b', waveType: WaveType) => void
  beginContinuousEdit: () => boolean
  commitContinuousEdit: () => void
  cancelContinuousEdit: () => void
}) {
  const keyboardEditHandlers = useContinuousRangeKeyboardEdit(
    beginContinuousEdit,
    commitContinuousEdit,
    cancelContinuousEdit
  )

  return (
    <div className="modRailWaveSelect" role="radiogroup" aria-label={`${label} type`}>
      <span className="modRailWaveLabel">{label}</span>
      <div className="modRailWaveSegmentList">
        {WAVE_OPTIONS.map((option) => (
          <button
            key={`wave-${wave}-option-${option}`}
            type="button"
            className={`modRailWaveSegment mono${option === waveType ? ' modRailWaveSegment-active' : ''}`}
            onClick={() => selectWaveType(wave, option)}
            role="radio"
            aria-checked={option === waveType}
            title={WAVE_OPTION_LABELS[option]}
          >
            {WAVE_OPTION_SHORT_LABELS[option]}
          </button>
        ))}
      </div>
      {waveType === 'square' ? (
        <label className="modRailPulseControl">
          <span className="modRailPulseLabel">PW</span>
          <input
            className="modulatorSlider modulatorTopLerp"
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            value={pulseWidth}
            onChange={(event) => setPulseWidth(Number(event.target.value))}
            onPointerDown={() => beginContinuousEdit()}
            onPointerUp={commitContinuousEdit}
            onPointerCancel={cancelContinuousEdit}
            {...keyboardEditHandlers}
          />
          <span className="mono">{pulseWidth.toFixed(2)}</span>
        </label>
      ) : null}
    </div>
  )
}

export function ModulatorsPanel({
  activeModulatorTab,
  activeModulator,
  selectActiveModulatorTab,
  selectWaveType,
  onWaveLerpChange,
  onWaveAPulseWidthChange,
  onWaveBPulseWidthChange,
  clampNumber,
  setTargetEnabled,
  resetTargetControl,
  padDragRef,
  applyPadMotion,
  tuningLength,
  beginContinuousEdit,
  commitContinuousEdit,
  cancelContinuousEdit,
}: ModulatorsPanelProps) {
  const lerpKeyboardEditHandlers = useContinuousRangeKeyboardEdit(
    beginContinuousEdit,
    commitContinuousEdit,
    cancelContinuousEdit
  )

  return (
    <section className="modulatorRail" aria-label="Modulation controls">
      <div className="modTabs" role="tablist" aria-label="Modulator slots">
        {Array.from({ length: 4 }, (_, index) => (
          <button
            key={`mod-tab-${index}`}
            type="button"
            className={`modTab${activeModulatorTab === index ? ' modTab-active' : ''}`}
            onClick={() => selectActiveModulatorTab(index)}
            role="tab"
            aria-selected={activeModulatorTab === index}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <div className="modulatorRailControls">
        <WaveSelectControl
          wave="a"
          label="A"
          waveType={activeModulator.waveAType}
          pulseWidth={activeModulator.waveAPulseWidth}
          setPulseWidth={onWaveAPulseWidthChange}
          selectWaveType={selectWaveType}
          beginContinuousEdit={beginContinuousEdit}
          commitContinuousEdit={commitContinuousEdit}
          cancelContinuousEdit={cancelContinuousEdit}
        />
        <label className="modRailLerp">
          <span className="modRailLerpValue mono">{Math.round(activeModulator.waveLerp * 100)}%</span>
          <input
            className="modulatorSlider modulatorTopLerp"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={activeModulator.waveLerp}
            onChange={(event) => onWaveLerpChange(Number(event.target.value))}
            onPointerDown={() => beginContinuousEdit()}
            onPointerUp={commitContinuousEdit}
            onPointerCancel={cancelContinuousEdit}
            {...lerpKeyboardEditHandlers}
            aria-label="Wave lerp"
          />
        </label>
        <WaveSelectControl
          wave="b"
          label="B"
          waveType={activeModulator.waveBType}
          pulseWidth={activeModulator.waveBPulseWidth}
          setPulseWidth={onWaveBPulseWidthChange}
          selectWaveType={selectWaveType}
          beginContinuousEdit={beginContinuousEdit}
          commitContinuousEdit={commitContinuousEdit}
          cancelContinuousEdit={cancelContinuousEdit}
        />
      </div>
      <div className="modTargetChipList">
          {MOD_TARGET_ORDER.map((target) => {
            const spec = getModTargetSpecForTuning(target, tuningLength)
            const control = activeModulator.targetControls[target]
            const clampedCenter = clampNumber(control.center, spec.min, spec.max)
            const maxPositiveSpan = spec.max - clampedCenter
            const maxNegativeSpan = clampedCenter - spec.min
            const amountLimit = Math.max(maxPositiveSpan, maxNegativeSpan)
            const displayAmount = clampNumber(control.amount, -amountLimit, amountLimit)
            const centerRatio = spec.max === spec.min
              ? 0.5
              : clampNumber((clampedCenter - spec.min) / (spec.max - spec.min), 0, 1)

            return (
              <div
                key={`mod-target-${target}`}
                className={`modTargetChip${control.enabled ? ' modTargetChip-enabled' : ''}`}
                onDoubleClick={(event) => {
                  event.preventDefault()
                  resetTargetControl(target)
                }}
                onPointerDown={(event) => {
                  if (!(event.currentTarget instanceof HTMLDivElement)) {
                    return
                  }
                  if (event.target instanceof HTMLElement && event.target.closest('.modTargetChipLed')) {
                    return
                  }
                  if (!beginContinuousEdit()) return
                  const mode = event.metaKey || event.ctrlKey ? 'center' : 'amount'
                  padDragRef.current = {
                    pointerId: event.pointerId,
                    target,
                    mode,
                    host: event.currentTarget,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    startAmount: control.amount,
                    startCenter: control.center,
                  }
                  event.currentTarget.setPointerCapture(event.pointerId)
                }}
                onPointerMove={(event) => {
                  const drag = padDragRef.current
                  if (!drag || drag.pointerId !== event.pointerId || drag.target !== target) {
                    return
                  }
                  applyPadMotion(
                    target,
                    drag.host,
                    event.clientX,
                    event.clientY,
                    drag.mode,
                    {
                      startClientX: drag.startClientX,
                      startClientY: drag.startClientY,
                      startAmount: drag.startAmount,
                      startCenter: drag.startCenter,
                    },
                    event.shiftKey ? 'fine' : 'coarse'
                  )
                }}
                onPointerUp={(event) => {
                  if (padDragRef.current?.pointerId === event.pointerId) {
                    padDragRef.current = null
                    commitContinuousEdit()
                  }
                }}
                onPointerCancel={(event) => {
                  if (padDragRef.current?.pointerId === event.pointerId) {
                    padDragRef.current = null
                    cancelContinuousEdit()
                  }
                }}
                title="Drag up/down for amount. Shift=fine. Cmd/Ctrl+drag moves center."
              >
                <label className="modTargetChipLed" aria-label={`${spec.label} modulator enabled`}>
                  <input
                    className="modTargetLed"
                    type="checkbox"
                    checked={control.enabled}
                    onChange={(event) => {
                      setTargetEnabled(target, event.target.checked)
                    }}
                  />
                </label>
                <span className="modTargetChipLabel">{spec.label}</span>
                <span
                  className="modTargetChipCenter"
                  aria-hidden="true"
                  style={{ '--mod-center-ratio': centerRatio } as CSSProperties}
                >
                  <span className="modTargetChipCenterDot" />
                </span>
                <span className="modTargetChipAmount mono">{formatSignedAmount(displayAmount)}</span>
              </div>
            )
          })}
      </div>
    </section>
  )
}
