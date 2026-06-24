import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import {
  MOD_TARGET_ORDER,
  getModTargetSpecForTuning,
  WAVE_OPTIONS,
  WAVE_OPTION_LABELS,
  type ModTarget,
  type Modulator,
  type TargetControl,
  type WaveType,
} from '../../shared'

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
  setOpenWaveMenu: Dispatch<SetStateAction<'a' | 'b' | null>>
  setActiveModulatorTab: Dispatch<SetStateAction<number>>
  waveMenuRef: { current: HTMLDivElement | null }
  openWaveMenu: 'a' | 'b' | null
  waveAType: WaveType
  waveBType: WaveType
  selectWaveType: (wave: 'a' | 'b', waveType: WaveType) => void
  waveLerp: number
  onWaveLerpChange: (value: number) => void
  waveAPulseWidth: number
  setWaveAPulseWidth: (value: number) => void
  waveBPulseWidth: number
  setWaveBPulseWidth: (value: number) => void
  clampNumber: (value: number, min: number, max: number) => number
  targetControls: Record<ModTarget, TargetControl>
  updateTargetControl: (target: ModTarget, patch: Partial<TargetControl>) => void
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
  scheduleLiveEmit: (commands: string[]) => void
  buildCommandForTarget: (
    target: ModTarget,
    control: TargetControl,
    baseMorphModulator: Modulator
  ) => string
  baseMorphModulator: Modulator
  tuningLength: number
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
  openWaveMenu,
  setOpenWaveMenu,
  selectWaveType,
}: {
  wave: 'a' | 'b'
  label: string
  waveType: WaveType
  pulseWidth: number
  setPulseWidth: (value: number) => void
  openWaveMenu: 'a' | 'b' | null
  setOpenWaveMenu: Dispatch<SetStateAction<'a' | 'b' | null>>
  selectWaveType: (wave: 'a' | 'b', waveType: WaveType) => void
}) {
  return (
    <div className="waveSelect modRailWaveSelect">
      <button
        type="button"
        className="waveSelectTrigger modRailWaveTrigger mono"
        onClick={() => setOpenWaveMenu((previous) => (previous === wave ? null : wave))}
        aria-haspopup="listbox"
        aria-expanded={openWaveMenu === wave}
        aria-label={`${label} type`}
      >
        <span className="modRailWaveLabel">{label}</span>
        <span>{WAVE_OPTION_SHORT_LABELS[waveType]}</span>
        <span className="waveSelectChevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {openWaveMenu === wave ? (
        <div className="waveSelectMenu modRailWaveMenu" role="listbox" aria-label={`${label} options`}>
          {WAVE_OPTIONS.map((option) => (
            <button
              key={`wave-${wave}-option-${option}`}
              type="button"
              className={`waveSelectOption mono${option === waveType ? ' waveSelectOption-active' : ''}`}
              onClick={() => selectWaveType(wave, option)}
              role="option"
              aria-selected={option === waveType}
            >
              {WAVE_OPTION_LABELS[option]}
            </button>
          ))}
          {waveType === 'square' ? (
            <label className="modRailPulseControl">
              <span className="modRailPulseLabel">Pulse width</span>
              <input
                className="modulatorSlider modulatorTopLerp"
                type="range"
                min={0.05}
                max={0.95}
                step={0.01}
                value={pulseWidth}
                onChange={(event) => setPulseWidth(Number(event.target.value))}
              />
              <span className="mono">{pulseWidth.toFixed(2)}</span>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function ModulatorsPanel({
  activeModulatorTab,
  setOpenWaveMenu,
  setActiveModulatorTab,
  waveMenuRef,
  openWaveMenu,
  waveAType,
  waveBType,
  selectWaveType,
  waveLerp,
  onWaveLerpChange,
  waveAPulseWidth,
  setWaveAPulseWidth,
  waveBPulseWidth,
  setWaveBPulseWidth,
  clampNumber,
  targetControls,
  updateTargetControl,
  padDragRef,
  applyPadMotion,
  scheduleLiveEmit,
  buildCommandForTarget,
  baseMorphModulator,
  tuningLength,
}: ModulatorsPanelProps) {
  return (
    <section className="modulatorRail" aria-label="Modulator rail">
      <div className="modTabs" role="tablist" aria-label="Modulator slots">
        {Array.from({ length: 4 }, (_, index) => (
          <button
            key={`mod-tab-${index}`}
            type="button"
            className={`modTab${activeModulatorTab === index ? ' modTab-active' : ''}`}
            onClick={() => {
              setOpenWaveMenu(null)
              setActiveModulatorTab(index)
            }}
            role="tab"
            aria-selected={activeModulatorTab === index}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <div className="modulatorRailControls" ref={waveMenuRef}>
        <WaveSelectControl
          wave="a"
          label="A"
          waveType={waveAType}
          pulseWidth={waveAPulseWidth}
          setPulseWidth={setWaveAPulseWidth}
          openWaveMenu={openWaveMenu}
          setOpenWaveMenu={setOpenWaveMenu}
          selectWaveType={selectWaveType}
        />
        <label className="modRailLerp">
          <span className="modRailLerpValue mono">{Math.round(waveLerp * 100)}%</span>
          <input
            className="modulatorSlider modulatorTopLerp"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={waveLerp}
            onChange={(event) => onWaveLerpChange(Number(event.target.value))}
            aria-label="Wave lerp"
          />
        </label>
        <WaveSelectControl
          wave="b"
          label="B"
          waveType={waveBType}
          pulseWidth={waveBPulseWidth}
          setPulseWidth={setWaveBPulseWidth}
          openWaveMenu={openWaveMenu}
          setOpenWaveMenu={setOpenWaveMenu}
          selectWaveType={selectWaveType}
        />
      </div>
      <div className="modTargetChipList">
          {MOD_TARGET_ORDER.map((target) => {
            const spec = getModTargetSpecForTuning(target, tuningLength)
            const control = targetControls[target]
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
                  const nextControl = {
                    ...control,
                    enabled: false,
                    center: spec.defaultCenter,
                    amount: 0,
                  }
                  updateTargetControl(target, nextControl)
                  if (control.enabled) {
                    scheduleLiveEmit([
                      buildCommandForTarget(
                        target,
                        {
                          ...nextControl,
                          enabled: true,
                        },
                        baseMorphModulator
                      ),
                    ])
                  }
                }}
                onPointerDown={(event) => {
                  if (!(event.currentTarget instanceof HTMLDivElement)) {
                    return
                  }
                  if (event.target instanceof HTMLElement && event.target.closest('.modTargetChipLed')) {
                    return
                  }
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
                  }
                }}
                onPointerCancel={(event) => {
                  if (padDragRef.current?.pointerId === event.pointerId) {
                    padDragRef.current = null
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
                      const nextEnabled = event.target.checked
                      updateTargetControl(target, { enabled: nextEnabled })
                      if (nextEnabled) {
                        scheduleLiveEmit([
                          buildCommandForTarget(
                            target,
                            {
                              ...control,
                              enabled: true,
                            },
                            baseMorphModulator
                          ),
                        ])
                      }
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
