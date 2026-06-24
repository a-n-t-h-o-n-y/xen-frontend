export const FRONTEND_APP = 'xen-web-ui'
export const FRONTEND_VERSION = '0.2.0'
export const MAX_COMMAND_HISTORY = 100
export const DEFAULT_TUNING_LENGTH = 12
export const DEFAULT_TRANSPORT_BPM = 120

export type TransportState = {
  active: boolean
  phase: number
  bpm: number
}

export const createTransportState = (): TransportState => ({
  active: false,
  phase: 0,
  bpm: DEFAULT_TRANSPORT_BPM,
})
