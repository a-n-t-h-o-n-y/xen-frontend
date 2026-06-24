import type { ProjectSnapshot } from '../domain/contracts'

export type ProjectSessionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; snapshot: ProjectSnapshot }
  | { status: 'error'; message: string; bridgeUnavailable: boolean }

