export type PreviewUpdateMode = 'absolute' | 'relative'

export type ProjectPreviewHandle = {
  update: (command: string, mode?: PreviewUpdateMode) => Promise<void>
  commit: () => Promise<void>
  cancel: () => Promise<void>
}

type PendingUpdate = {
  command: string
  mode: PreviewUpdateMode
  resolve: Array<() => void>
  reject: Array<(error: unknown) => void>
}

type ProjectPreviewOptions = {
  begin: () => Promise<string>
  update: (previewId: string, command: string) => Promise<void>
  commit: (previewId: string) => Promise<void>
  cancel: (previewId: string) => Promise<void>
  onFinish: () => void
}

export const createProjectPreview = ({
  begin,
  update,
  commit,
  cancel,
  onFinish,
}: ProjectPreviewOptions): ProjectPreviewHandle => {
  const beginPromise = begin()
  void beginPromise.catch(() => undefined)
  const pending: PendingUpdate[] = []
  let pumpPromise: Promise<void> | null = null
  let finishPromise: Promise<void> | null = null
  let terminalUpdateError: unknown = null
  let closed = false

  const pump = (): Promise<void> => {
    if (pumpPromise) {
      return pumpPromise
    }

    pumpPromise = (async () => {
      let current: PendingUpdate | null = null
      try {
        const previewId = await beginPromise
        while (pending.length > 0) {
          const next = pending.shift()
          if (!next) continue
          current = next
          await update(previewId, next.command)
          next.resolve.forEach((resolve) => resolve())
          current = null
        }
      } catch (error) {
        terminalUpdateError = error
        current?.reject.forEach((reject) => reject(error))
        pending.splice(0).forEach((entry) => {
          entry.reject.forEach((reject) => reject(error))
        })
        throw error
      }
    })().finally(() => {
      pumpPromise = null
    })

    return pumpPromise
  }

  const updatePreview = (
    command: string,
    mode: PreviewUpdateMode = 'absolute'
  ): Promise<void> => {
    if (closed) {
      return Promise.reject(new Error('Project preview is already finished'))
    }

    const result = new Promise<void>((resolve, reject) => {
      const entry: PendingUpdate = { command, mode, resolve: [resolve], reject: [reject] }
      if (mode === 'absolute') {
        let existingIndex = -1
        for (let index = pending.length - 1; index >= 0; index -= 1) {
          if (pending[index]?.mode === 'relative') break
          if (pending[index]?.mode === 'absolute') {
            existingIndex = index
            break
          }
        }
        if (existingIndex >= 0) {
          const existing = pending[existingIndex]
          if (existing) {
            entry.resolve.unshift(...existing.resolve)
            entry.reject.unshift(...existing.reject)
            pending.splice(existingIndex, 1)
          }
        }
      }
      pending.push(entry)
    })
    void pump().catch(() => undefined)
    return result
  }

  const finish = (action: 'commit' | 'cancel'): Promise<void> => {
    if (finishPromise) {
      return finishPromise
    }
    closed = true
    finishPromise = (async () => {
      const previewId = await beginPromise
      let updateError: unknown = terminalUpdateError
      try {
        await pump()
      } catch (error) {
        updateError = error
      }
      if (action === 'cancel' || updateError) {
        await cancel(previewId)
        if (updateError) throw updateError
        return
      }
      try {
        await commit(previewId)
      } catch (error) {
        await cancel(previewId).catch(() => undefined)
        throw error
      }
    })().finally(onFinish)
    return finishPromise
  }

  return {
    update: updatePreview,
    commit: () => finish('commit'),
    cancel: () => finish('cancel'),
  }
}
