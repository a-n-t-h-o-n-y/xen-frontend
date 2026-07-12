import { describe, expect, it, vi } from 'vitest'
import { createProjectPreview } from './ProjectPreview'

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('project preview transaction', () => {
  it('coalesces queued absolute updates before sending them', async () => {
    const started = deferred<string>()
    const update = vi.fn().mockResolvedValue(undefined)
    const preview = createProjectPreview({
      begin: () => started.promise,
      update,
      commit: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      onFinish: vi.fn(),
    })

    const first = preview.update('set key 1')
    const second = preview.update('set key 2')
    const third = preview.update('set key 3')
    started.resolve('preview-1')
    await Promise.all([first, second, third])

    expect(update).toHaveBeenCalledExactlyOnceWith('preview-1', 'set key 3')
  })

  it('preserves relative update order and does not coalesce across it', async () => {
    const started = deferred<string>()
    const update = vi.fn().mockResolvedValue(undefined)
    const preview = createProjectPreview({
      begin: () => started.promise,
      update,
      commit: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      onFinish: vi.fn(),
    })

    const updates = [
      preview.update('set key 1'),
      preview.update('transpose 1', 'relative'),
      preview.update('set key 4'),
    ]
    started.resolve('preview-2')
    await Promise.all(updates)

    expect(update.mock.calls.map((call) => call[1])).toEqual([
      'set key 1',
      'transpose 1',
      'set key 4',
    ])
  })

  it('queues commit behind the final pending update', async () => {
    const updateFinished = deferred<void>()
    const order: string[] = []
    const preview = createProjectPreview({
      begin: async () => 'preview-3',
      update: async () => {
        order.push('update-start')
        await updateFinished.promise
        order.push('update-end')
      },
      commit: async () => {
        order.push('commit')
      },
      cancel: vi.fn().mockResolvedValue(undefined),
      onFinish: vi.fn(),
    })

    const update = preview.update('set key 5')
    const commit = preview.commit()
    await Promise.resolve()
    expect(order).toEqual(['update-start'])
    updateFinished.resolve()
    await Promise.all([update, commit])
    expect(order).toEqual(['update-start', 'update-end', 'commit'])
  })

  it('cancels instead of committing after an update failure', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined)
    const commit = vi.fn().mockResolvedValue(undefined)
    const preview = createProjectPreview({
      begin: async () => 'preview-4',
      update: async () => {
        throw new Error('update failed')
      },
      commit,
      cancel,
      onFinish: vi.fn(),
    })

    const update = preview.update('set key 6')
    await expect(preview.commit()).rejects.toThrow('update failed')
    await expect(update).rejects.toThrow('update failed')
    expect(commit).not.toHaveBeenCalled()
    expect(cancel).toHaveBeenCalledWith('preview-4')
  })
})
