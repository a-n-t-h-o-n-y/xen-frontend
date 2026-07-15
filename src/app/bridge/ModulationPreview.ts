import type { ModulationPreviewUpdateResponseDto } from '../domain/contracts'
import type {
  ModulationDefinition,
  ModulationDestination,
  ModulationOutputRange,
} from '../domain/modulation'

export type ModulationUpdate = {
  destination: ModulationDestination
  outputRange: ModulationOutputRange
  modulation: ModulationDefinition
}

export type ModulationPreviewHandle = {
  update: (definition: ModulationUpdate) => Promise<ModulationPreviewUpdateResponseDto>
  commit: () => Promise<void>
  cancel: () => Promise<void>
}

type BeginResult = {
  previewId: string
  projectRevision: string
}

type PendingUpdate = {
  sequence: bigint
  definition: ModulationUpdate
  resolve: Array<(response: ModulationPreviewUpdateResponseDto) => void>
  reject: Array<(error: unknown) => void>
}

type ModulationPreviewOptions = {
  begin: () => Promise<BeginResult>
  update: (
    previewId: string,
    sequence: string,
    expectedProjectRevision: string,
    definition: ModulationUpdate
  ) => Promise<ModulationPreviewUpdateResponseDto>
  end: (
    action: 'modulation.preview.commit' | 'modulation.preview.cancel',
    previewId: string,
    expectedProjectRevision: string
  ) => Promise<void>
  recover?: (error: unknown) => Promise<{
    projectRevision: string
    stillOwnsPreview: boolean
  }>
  onFinish: () => void
}

export const createModulationPreview = ({
  begin,
  update,
  end,
  recover,
  onFinish,
}: ModulationPreviewOptions): ModulationPreviewHandle => {
  const beginPromise = begin()
  void beginPromise.catch(() => undefined)
  let pending: PendingUpdate | null = null
  let pumpPromise: Promise<void> | null = null
  let finishPromise: Promise<void> | null = null
  let nextSequence = 1n
  let expectedProjectRevision: string | null = null
  let terminalError: unknown = null
  let stillOwnsPreview = true
  let closed = false

  const pump = (): Promise<void> => {
    if (pumpPromise) return pumpPromise
    pumpPromise = (async () => {
      const started = await beginPromise
      expectedProjectRevision ??= started.projectRevision
      while (pending) {
        const current = pending
        pending = null
        try {
          const response = await update(
            started.previewId,
            current.sequence.toString(),
            expectedProjectRevision,
            current.definition
          )
          if (response.accepted) expectedProjectRevision = response.project_revision
          current.resolve.forEach((resolve) => resolve(response))
        } catch (error) {
          terminalError = error
          if (recover) {
            try {
              const recovered = await recover(error)
              expectedProjectRevision = recovered.projectRevision
              stillOwnsPreview = recovered.stillOwnsPreview
            } catch {
              // Preserve and report the original terminal update failure.
            }
          }
          current.reject.forEach((reject) => reject(error))
          const abandoned = pending as PendingUpdate | null
          abandoned?.reject.forEach((reject: (error: unknown) => void) => reject(error))
          pending = null
          throw error
        }
      }
    })().finally(() => {
      pumpPromise = null
    })
    return pumpPromise
  }

  const updatePreview = (
    definition: ModulationUpdate
  ): Promise<ModulationPreviewUpdateResponseDto> => {
    if (closed) return Promise.reject(new Error('Modulation preview is already finished'))
    if (terminalError) return Promise.reject(terminalError)
    const sequence = nextSequence
    nextSequence += 1n
    const promise = new Promise<ModulationPreviewUpdateResponseDto>((resolve, reject) => {
      const next: PendingUpdate = {
        sequence,
        definition,
        resolve: [resolve],
        reject: [reject],
      }
      if (pending) {
        next.resolve.unshift(...pending.resolve)
        next.reject.unshift(...pending.reject)
      }
      pending = next
    })
    void pump().catch(() => undefined)
    return promise
  }

  const finish = (action: 'modulation.preview.commit' | 'modulation.preview.cancel'): Promise<void> => {
    if (finishPromise) return finishPromise
    closed = true
    finishPromise = (async () => {
      const started = await beginPromise
      try {
        await pump()
      } catch {
        // The final cancel below is best-effort after a terminal update failure.
      }
      const finalAction = terminalError ? 'modulation.preview.cancel' : action
      if (!terminalError || stillOwnsPreview) {
        await end(
          finalAction,
          started.previewId,
          expectedProjectRevision ?? started.projectRevision
        )
      }
      if (terminalError) throw terminalError
    })().finally(onFinish)
    return finishPromise
  }

  return {
    update: updatePreview,
    commit: () => finish('modulation.preview.commit'),
    cancel: () => finish('modulation.preview.cancel'),
  }
}
