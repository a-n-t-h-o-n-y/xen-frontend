import { z } from 'zod'
import { getXenBridgeRequest } from './juceBridge'
import {
  BRIDGE_PROTOCOL,
  cellRelativePathSchema,
  commandResponseSchema,
  decimalRevisionSchema,
  documentOperationResultSchema,
  envelopeSchema,
  fileRevisionSchema,
  instanceBindingSchema,
  keymapStorageResourceSchema,
  keymapRevisionSchema,
  librarySnapshotSchema,
  modulationDefinitionSchema,
  modulationDestinationSchema,
  modulationOutputRangeSchema,
  modulationPreviewUpdateResponseSchema,
  modulationTargetSchema,
  preferencesResourceSchema,
  preferencesRevisionSchema,
  projectSnapshotSchema,
  projectRelativePathSchema,
  previewBeginResponseSchema,
  previewEndResponseSchema,
  recoveryRevisionSchema,
  selectionSchema,
  sessionHelloSchema,
} from '../domain/contracts'
import { createRequestId } from '../utils/requestId'
import type {
  CommandExecuteResponseDto,
  DocumentOperationResultDto,
  InstanceBindingDto,
  KeymapStorageResourceDto,
  LibrarySnapshotDto,
  ModulationDefinitionDto,
  ModulationDestinationDto,
  ModulationOutputRangeDto,
  ModulationPreviewUpdateResponseDto,
  ModulationTargetDto,
  PreferencesResourceDto,
  ProjectSnapshotDto,
  SelectionDto,
  SessionHelloDto,
} from '../domain/contracts'

type NativeRequestFn = (requestJson: string) => Promise<unknown>

export type SessionHelloRequest = {
  protocol: typeof BRIDGE_PROTOCOL
  frontend_app: string
  frontend_version: string
}

type EmptyRequest = Record<string, never>

export type CommandCursor = {
  row_coordinate: number
  column_coordinate: number
  sequence_id: number | null
}

export type CommandExecuteRequest = {
  command: string
  context?: {
    expected_project_revision?: string | undefined
    preview_id?: string | undefined
    selection?: SelectionDto | undefined
    cursor: CommandCursor
  } | undefined
}

export type PreviewBeginRequest = {
  expected_project_revision: string
}

export type PreviewEndRequest = PreviewBeginRequest & {
  preview_id: string
}

export type ModulationPreviewBeginRequest = {
  expected_project_revision: string
  target: ModulationTargetDto
}

export type ModulationPreviewUpdateRequest = {
  preview_id: string
  update_sequence: string
  expected_project_revision: string
  destination: ModulationDestinationDto
  output_range: ModulationOutputRangeDto
  modulation: ModulationDefinitionDto
}

export type KeymapWriteRequest = {
  expected_revision: string
  document: unknown
}

export type KeymapDeleteRequest = {
  expected_revision: string
}

export type PreferencesWriteRequest = {
  expected_revision: string
  document: Record<string, unknown>
}

export type PreferencesDeleteRequest = {
  expected_revision: string
}

export type SessionBindingSetRequest = {
  channel_id: string
}

export type ProjectNewRequest = {
  expected_project_revision: string
  discard_unsaved: boolean
}

export type ProjectOpenRequest = ProjectNewRequest & {
  relative_path: string
}

export type ProjectSaveRequest = {
  expected_project_revision: string
}

export type ProjectSaveAsRequest = ProjectSaveRequest & {
  relative_path: string
  expected_file_revision: string | null
}

export type RecoveryRestoreRequest = ProjectNewRequest & {
  recovery_revision: string
}

export type RecoveryDiscardRequest = {
  recovery_revision: string
}

export type CellImportRequest = ProjectSaveRequest & {
  relative_path: string
  cursor: CommandCursor
}

export type CellSaveRequest = CellImportRequest & {
  selection: SelectionDto
  expected_file_revision: string | null
}

export type BridgeMethodMap = {
  'session.hello': {
    request: SessionHelloRequest
    response: SessionHelloDto
  }
  'session.binding.get': {
    request: EmptyRequest
    response: InstanceBindingDto
  }
  'session.binding.set': {
    request: SessionBindingSetRequest
    response: InstanceBindingDto
  }
  'state.get': {
    request: EmptyRequest
    response: ProjectSnapshotDto
  }
  'library.get': {
    request: EmptyRequest
    response: LibrarySnapshotDto
  }
  'project.new': {
    request: ProjectNewRequest
    response: DocumentOperationResultDto
  }
  'project.open': {
    request: ProjectOpenRequest
    response: DocumentOperationResultDto
  }
  'project.save': {
    request: ProjectSaveRequest
    response: DocumentOperationResultDto
  }
  'project.save_as': {
    request: ProjectSaveAsRequest
    response: DocumentOperationResultDto
  }
  'project.recovery.restore': {
    request: RecoveryRestoreRequest
    response: DocumentOperationResultDto
  }
  'project.recovery.discard': {
    request: RecoveryDiscardRequest
    response: DocumentOperationResultDto
  }
  'cell.import': {
    request: CellImportRequest
    response: DocumentOperationResultDto
  }
  'cell.save': {
    request: CellSaveRequest
    response: DocumentOperationResultDto
  }
  'command.execute': {
    request: CommandExecuteRequest
    response: CommandExecuteResponseDto
  }
  'preview.begin': {
    request: PreviewBeginRequest
    response: import('../domain/contracts').PreviewBeginResponseDto
  }
  'preview.commit': {
    request: PreviewEndRequest
    response: import('../domain/contracts').PreviewEndResponseDto
  }
  'preview.cancel': {
    request: PreviewEndRequest
    response: import('../domain/contracts').PreviewEndResponseDto
  }
  'modulation.preview.begin': {
    request: ModulationPreviewBeginRequest
    response: import('../domain/contracts').PreviewBeginResponseDto
  }
  'modulation.preview.update': {
    request: ModulationPreviewUpdateRequest
    response: ModulationPreviewUpdateResponseDto
  }
  'modulation.preview.commit': {
    request: PreviewEndRequest
    response: import('../domain/contracts').PreviewEndResponseDto
  }
  'modulation.preview.cancel': {
    request: PreviewEndRequest
    response: import('../domain/contracts').PreviewEndResponseDto
  }
  'keymap.read': {
    request: EmptyRequest
    response: KeymapStorageResourceDto
  }
  'keymap.write': {
    request: KeymapWriteRequest
    response: KeymapStorageResourceDto
  }
  'keymap.delete': {
    request: KeymapDeleteRequest
    response: KeymapStorageResourceDto
  }
  'preferences.read': {
    request: EmptyRequest
    response: PreferencesResourceDto
  }
  'preferences.write': {
    request: PreferencesWriteRequest
    response: PreferencesResourceDto
  }
  'preferences.delete': {
    request: PreferencesDeleteRequest
    response: PreferencesResourceDto
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
    details: z.record(z.string(), z.unknown()).optional(),
  }),
})

const projectRevisionRequestSchema = z.object({
  expected_project_revision: decimalRevisionSchema,
})

const cursorSchema = z.object({
  row_coordinate: z.number().int().min(-2_147_483_648).max(2_147_483_647),
  column_coordinate: z.number().int().min(-2_147_483_648).max(2_147_483_647),
  sequence_id: z.number().int().nonnegative().nullable(),
})

const keymapWriteRequestSchema = z.object({
  expected_revision: keymapRevisionSchema,
  document: z.unknown(),
})
const keymapDeleteRequestSchema = z.object({
  expected_revision: keymapRevisionSchema,
})
const preferencesWriteRequestSchema = z.object({
  expected_revision: preferencesRevisionSchema,
  document: z.record(z.string(), z.unknown()),
})
const preferencesDeleteRequestSchema = z.object({
  expected_revision: preferencesRevisionSchema,
})

const responseSchemas = {
  'session.hello': sessionHelloSchema,
  'session.binding.get': instanceBindingSchema,
  'session.binding.set': instanceBindingSchema,
  'state.get': projectSnapshotSchema,
  'library.get': librarySnapshotSchema,
  'project.new': documentOperationResultSchema,
  'project.open': documentOperationResultSchema,
  'project.save': documentOperationResultSchema,
  'project.save_as': documentOperationResultSchema,
  'project.recovery.restore': documentOperationResultSchema,
  'project.recovery.discard': documentOperationResultSchema,
  'cell.import': documentOperationResultSchema,
  'cell.save': documentOperationResultSchema,
  'command.execute': commandResponseSchema,
  'preview.begin': previewBeginResponseSchema,
  'preview.commit': previewEndResponseSchema,
  'preview.cancel': previewEndResponseSchema,
  'modulation.preview.begin': previewBeginResponseSchema,
  'modulation.preview.update': modulationPreviewUpdateResponseSchema,
  'modulation.preview.commit': previewEndResponseSchema,
  'modulation.preview.cancel': previewEndResponseSchema,
  'keymap.read': keymapStorageResourceSchema,
  'keymap.write': keymapStorageResourceSchema,
  'keymap.delete': keymapStorageResourceSchema,
  'preferences.read': preferencesResourceSchema,
  'preferences.write': preferencesResourceSchema,
  'preferences.delete': preferencesResourceSchema,
} satisfies { [K in BridgeMethod]: z.ZodType<BridgeMethodMap[K]['response']> }

const requestSchemas = {
  'session.hello': z.object({
    protocol: z.literal(BRIDGE_PROTOCOL),
    frontend_app: z.string(),
    frontend_version: z.string(),
  }),
  'session.binding.get': z.object({}).strict(),
  'session.binding.set': z.object({
    channel_id: z.string().min(1),
  }),
  'state.get': z.object({}).strict(),
  'library.get': z.object({}).strict(),
  'command.execute': z.object({
    command: z.string(),
    context: z.object({
      expected_project_revision: decimalRevisionSchema.optional(),
      preview_id: z.string().min(1).optional(),
      selection: selectionSchema.optional(),
      cursor: cursorSchema,
    }).optional(),
  }),
  'project.new': projectRevisionRequestSchema.extend({
    discard_unsaved: z.boolean(),
  }),
  'project.open': projectRevisionRequestSchema.extend({
    relative_path: projectRelativePathSchema,
    discard_unsaved: z.boolean(),
  }),
  'project.save': projectRevisionRequestSchema,
  'project.save_as': projectRevisionRequestSchema.extend({
    relative_path: projectRelativePathSchema,
    expected_file_revision: fileRevisionSchema.nullable(),
  }),
  'project.recovery.restore': projectRevisionRequestSchema.extend({
    recovery_revision: recoveryRevisionSchema,
    discard_unsaved: z.boolean(),
  }),
  'project.recovery.discard': z.object({
    recovery_revision: recoveryRevisionSchema,
  }),
  'cell.import': projectRevisionRequestSchema.extend({
    relative_path: cellRelativePathSchema,
    cursor: cursorSchema,
  }),
  'cell.save': projectRevisionRequestSchema.extend({
    relative_path: cellRelativePathSchema,
    cursor: cursorSchema,
    selection: selectionSchema,
    expected_file_revision: fileRevisionSchema.nullable(),
  }),
  'preview.begin': projectRevisionRequestSchema,
  'preview.commit': z.object({
    preview_id: z.string().min(1),
    expected_project_revision: decimalRevisionSchema,
  }),
  'preview.cancel': z.object({
    preview_id: z.string().min(1),
    expected_project_revision: decimalRevisionSchema,
  }),
  'modulation.preview.begin': z.object({
    expected_project_revision: decimalRevisionSchema,
    target: modulationTargetSchema,
  }),
  'modulation.preview.update': z.object({
    preview_id: z.string().min(1),
    update_sequence: decimalRevisionSchema,
    expected_project_revision: decimalRevisionSchema,
    destination: modulationDestinationSchema,
    output_range: modulationOutputRangeSchema,
    modulation: modulationDefinitionSchema,
  }),
  'modulation.preview.commit': z.object({
    preview_id: z.string().min(1),
    expected_project_revision: decimalRevisionSchema,
  }),
  'modulation.preview.cancel': z.object({
    preview_id: z.string().min(1),
    expected_project_revision: decimalRevisionSchema,
  }),
  'keymap.read': z.object({}).strict(),
  'keymap.write': keymapWriteRequestSchema,
  'keymap.delete': keymapDeleteRequestSchema,
  'preferences.read': z.object({}).strict(),
  'preferences.write': preferencesWriteRequestSchema,
  'preferences.delete': preferencesDeleteRequestSchema,
} satisfies { [K in BridgeMethod]: z.ZodType<BridgeMethodMap[K]['request']> }

const defaultTimeouts = {
  'session.hello': 5_000,
  'session.binding.get': 5_000,
  'session.binding.set': 15_000,
  'state.get': 5_000,
  'library.get': 5_000,
  'project.new': 15_000,
  'project.open': 15_000,
  'project.save': 15_000,
  'project.save_as': 15_000,
  'project.recovery.restore': 15_000,
  'project.recovery.discard': 15_000,
  'cell.import': 15_000,
  'cell.save': 15_000,
  'command.execute': 15_000,
  'preview.begin': 15_000,
  'preview.commit': 15_000,
  'preview.cancel': 15_000,
  'modulation.preview.begin': 15_000,
  'modulation.preview.update': 15_000,
  'modulation.preview.commit': 15_000,
  'modulation.preview.cancel': 15_000,
  'keymap.read': 5_000,
  'keymap.write': 15_000,
  'keymap.delete': 15_000,
  'preferences.read': 5_000,
  'preferences.write': 15_000,
  'preferences.delete': 15_000,
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
  readonly details: Record<string, unknown> | undefined

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'BridgePayloadError'
    this.code = code
    this.details = details
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
          backendError.data.error.message,
          backendError.data.error.details
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
