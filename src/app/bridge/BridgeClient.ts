import { z } from 'zod'
import { getXenBridgeRequest } from '../../bridge/juceBridge'
import {
  BRIDGE_PROTOCOL,
  commandResponseSchema,
  envelopeSchema,
  keymapResourceSchema,
  keymapTargetSchema,
  keymapTriggerSchema,
  librarySnapshotSchema,
  projectSnapshotSchema,
  selectionSchema,
  sessionHelloSchema,
} from '../domain/contracts'
import { createRequestId } from '../shared'
import type { CommandContext } from '../domain/commands'
import type {
  CommandExecuteResponse,
  KeymapResource,
  KeymapTarget,
  KeymapTrigger,
  LibrarySnapshot,
  ProjectSnapshot,
  SessionHello,
} from '../domain/contracts'

type NativeRequestFn = (requestJson: string) => Promise<unknown>

export type SessionHelloRequest = {
  protocol: typeof BRIDGE_PROTOCOL
  frontend_app: string
  frontend_version: string
}

type EmptyRequest = Record<string, never>

export type CommandExecuteRequest = {
  command: string
  context: CommandContext
}

export type KeymapOverrideSetRequest = {
  expected_revision: number
  context: string
  trigger: KeymapTrigger
  target: KeymapTarget | null
}

export type KeymapOverrideRemoveRequest = {
  expected_revision: number
  context: string
  trigger: KeymapTrigger
}

export type KeymapResetRequest = {
  expected_revision: number
}

export type BridgeMethodMap = {
  'session.hello': {
    request: SessionHelloRequest
    response: SessionHello
  }
  'state.get': {
    request: EmptyRequest
    response: ProjectSnapshot
  }
  'library.get': {
    request: EmptyRequest
    response: LibrarySnapshot
  }
  'command.execute': {
    request: CommandExecuteRequest
    response: CommandExecuteResponse
  }
  'keymap.get': {
    request: EmptyRequest
    response: KeymapResource
  }
  'keymap.override.set': {
    request: KeymapOverrideSetRequest
    response: KeymapResource
  }
  'keymap.override.remove': {
    request: KeymapOverrideRemoveRequest
    response: KeymapResource
  }
  'keymap.reset': {
    request: KeymapResetRequest
    response: KeymapResource
  }
}

export type BridgeMethod = keyof BridgeMethodMap

export type RequestOptions = {
  timeoutMs?: number
  signal?: AbortSignal
}

type BridgeClientOptions = {
  getRequestFn?: () => Promise<NativeRequestFn>
  createRequestId?: () => string
}

const backendErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

const keymapRevisionSchema = z.number().int().nonnegative()
const keymapOverrideSetRequestSchema = z.object({
  expected_revision: keymapRevisionSchema,
  context: z.string().min(1),
  trigger: keymapTriggerSchema,
  target: keymapTargetSchema.nullable(),
})
const keymapOverrideRemoveRequestSchema = keymapOverrideSetRequestSchema.omit({
  target: true,
})
const keymapResetRequestSchema = z.object({
  expected_revision: keymapRevisionSchema,
})

const responseSchemas = {
  'session.hello': sessionHelloSchema,
  'state.get': projectSnapshotSchema,
  'library.get': librarySnapshotSchema,
  'command.execute': commandResponseSchema,
  'keymap.get': keymapResourceSchema,
  'keymap.override.set': keymapResourceSchema,
  'keymap.override.remove': keymapResourceSchema,
  'keymap.reset': keymapResourceSchema,
} satisfies { [K in BridgeMethod]: z.ZodType<BridgeMethodMap[K]['response']> }

const requestSchemas = {
  'session.hello': z.object({
    protocol: z.literal(BRIDGE_PROTOCOL),
    frontend_app: z.string(),
    frontend_version: z.string(),
  }),
  'state.get': z.object({}).strict(),
  'library.get': z.object({}).strict(),
  'command.execute': z.object({
    command: z.string(),
    context: z.object({
      expected_project_revision: z.number().int().nonnegative(),
      selection: selectionSchema,
    }),
  }),
  'keymap.get': z.object({}).strict(),
  'keymap.override.set': keymapOverrideSetRequestSchema,
  'keymap.override.remove': keymapOverrideRemoveRequestSchema,
  'keymap.reset': keymapResetRequestSchema,
} satisfies { [K in BridgeMethod]: z.ZodType<BridgeMethodMap[K]['request']> }

const defaultTimeouts = {
  'session.hello': 5_000,
  'state.get': 5_000,
  'library.get': 5_000,
  'command.execute': 15_000,
  'keymap.get': 5_000,
  'keymap.override.set': 15_000,
  'keymap.override.remove': 15_000,
  'keymap.reset': 15_000,
} satisfies Record<BridgeMethod, number>

export class BridgeTimeoutError extends Error {
  constructor(method: BridgeMethod, timeoutMs: number) {
    super(`Bridge request '${method}' timed out after ${timeoutMs}ms`)
    this.name = 'BridgeTimeoutError'
  }
}

export class BridgeAbortError extends Error {
  constructor(method: BridgeMethod) {
    super(`Bridge request '${method}' was aborted`)
    this.name = 'BridgeAbortError'
  }
}

export class BridgeProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BridgeProtocolError'
  }
}

export class BridgePayloadValidationError extends Error {
  constructor(method: BridgeMethod, message: string) {
    super(`Bridge response payload for '${method}' is invalid: ${message}`)
    this.name = 'BridgePayloadValidationError'
  }
}

export class BridgePayloadError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'BridgePayloadError'
    this.code = code
  }
}

const zodMessage = (error: z.ZodError): string =>
  error.issues.map((issue) => issue.message).join('; ')

const createAbortPromise = (
  method: BridgeMethod,
  signal: AbortSignal
): { promise: Promise<never>, clear: () => void } => {
  let onAbort: (() => void) | null = null
  const promise = new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(new BridgeAbortError(method))
      return
    }

    onAbort = () => reject(new BridgeAbortError(method))
    signal.addEventListener('abort', onAbort, { once: true })
  })

  return {
    promise,
    clear: () => {
      if (onAbort) {
        signal.removeEventListener('abort', onAbort)
      }
    },
  }
}

const createTimeoutPromise = (
  method: BridgeMethod,
  timeoutMs: number
): { promise: Promise<never>, clear: () => void } => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new BridgeTimeoutError(method, timeoutMs))
    }, timeoutMs)
  })

  return {
    promise,
    clear: () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    },
  }
}

export class BridgeClient {
  private readonly getRequestFn: () => Promise<NativeRequestFn>
  private readonly newRequestId: () => string

  constructor(options: BridgeClientOptions = {}) {
    this.getRequestFn = options.getRequestFn ?? getXenBridgeRequest
    this.newRequestId = options.createRequestId ?? createRequestId
  }

  async request<K extends BridgeMethod>(
    name: K,
    payload: BridgeMethodMap[K]['request'],
    options: RequestOptions = {}
  ): Promise<BridgeMethodMap[K]['response']> {
    const requestId = this.newRequestId()
    const timeoutMs = options.timeoutMs ?? defaultTimeouts[name]
    const requestPayload = requestSchemas[name].parse(payload)
    const request = {
      protocol: BRIDGE_PROTOCOL,
      type: 'request' as const,
      name,
      request_id: requestId,
      payload: requestPayload,
    }

    if (options.signal?.aborted) {
      throw new BridgeAbortError(name)
    }

    const nativePromise = this.getRequestFn().then((requestFn) =>
      requestFn(JSON.stringify(request))
    )
    const timeout = createTimeoutPromise(name, timeoutMs)
    const abort = options.signal ? createAbortPromise(name, options.signal) : null
    const raced = abort
      ? Promise.race([nativePromise, timeout.promise, abort.promise])
      : Promise.race([nativePromise, timeout.promise])

    try {
      const rawResponse = await raced
      const envelopeResult = envelopeSchema.safeParse(rawResponse)
      if (!envelopeResult.success) {
        throw new BridgeProtocolError(
          `Invalid bridge envelope for '${name}': ${zodMessage(envelopeResult.error)}`
        )
      }

      const envelope = envelopeResult.data
      if (envelope.type !== 'response') {
        throw new BridgeProtocolError(
          `Unexpected bridge envelope type '${envelope.type}' for '${name}'`
        )
      }

      if (envelope.name !== name) {
        throw new BridgeProtocolError(
          `Unexpected bridge response name '${envelope.name}' for '${name}'`
        )
      }

      if (envelope.request_id !== requestId) {
        throw new BridgeProtocolError(`Mismatched bridge request_id for '${name}'`)
      }

      const backendError = backendErrorSchema.safeParse(envelope.payload)
      if (backendError.success) {
        throw new BridgePayloadError(
          backendError.data.error.code,
          backendError.data.error.message
        )
      }

      const payloadResult = responseSchemas[name].safeParse(envelope.payload)
      if (!payloadResult.success) {
        throw new BridgePayloadValidationError(name, zodMessage(payloadResult.error))
      }

      return payloadResult.data
    } finally {
      timeout.clear()
      abort?.clear()
    }
  }
}

export const bridgeClient = new BridgeClient()
