import type { ProjectSnapshot } from '../domain/models'

export type ProjectSessionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; snapshot: ProjectSnapshot }
  | { status: 'error'; message: string; bridgeUnavailable: boolean }
