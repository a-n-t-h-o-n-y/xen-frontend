import { describe, expect, it } from 'vitest'
import {
  buildEnabledModulatorTargetCommands,
  buildModulatorTargetCommand,
  joinModulatorCommands,
} from './modulatorCommands'
import { createInitialModulatorPanelState } from './modulation'

describe('modulator command builders', () => {
  it('builds tuning-aware target commands', () => {
    const state = createInitialModulatorPanelState()
    const command = buildModulatorTargetCommand(
      'pitch',
      {
        ...state.targetControls.pitch,
        center: 0,
        amount: 48,
      },
      state,
      24
    )

    const payload = JSON.parse(command.replace(/^set pitch /, ''))
    expect(command.startsWith('set pitch ')).toBe(true)
    expect(payload.children[2]).toEqual({ type: 'bias', amount: 0 })
    expect(payload.children[3]).toEqual({ type: 'clamp', min: -48, max: 48 })
  })

  it('builds commands only for enabled targets', () => {
    const state = createInitialModulatorPanelState()
    state.targetControls.pitch = {
      ...state.targetControls.pitch,
      enabled: true,
      amount: 7,
    }
    state.targetControls.velocity = {
      ...state.targetControls.velocity,
      enabled: false,
      amount: 0.25,
    }

    expect(buildEnabledModulatorTargetCommands(state, 12)).toHaveLength(1)
    expect(buildEnabledModulatorTargetCommands(state, 12)[0]?.startsWith('set pitch ')).toBe(true)
  })

  it('preserves square pulse width in command payloads', () => {
    const state = createInitialModulatorPanelState()
    state.waveAType = 'square'
    state.waveAPulseWidth = 0.27
    state.targetControls.velocity = {
      ...state.targetControls.velocity,
      enabled: true,
      amount: 0.25,
    }

    const command = buildEnabledModulatorTargetCommands(state, 12)[0]
    const payload = JSON.parse(command?.replace(/^set velocity /, '') ?? '{}')
    expect(payload.children[0]).toEqual({
      type: 'square',
      frequency: 1,
      amplitude: 1,
      phase: 0,
      pulse_width: 0.27,
    })
  })

  it('joins commands with backend command-chain separators', () => {
    expect(joinModulatorCommands(['set pitch {}', 'set gate {}'])).toBe('set pitch {}; set gate {}')
  })
})

