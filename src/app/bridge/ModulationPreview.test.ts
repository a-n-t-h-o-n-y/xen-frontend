import { describe, expect, it, vi } from 'vitest'
import { createModulationPreview } from './ModulationPreview'
import type { ModulationUpdate } from './ModulationPreview'

const definition = (frequency: number): ModulationUpdate => ({
  destination: 'pitch',
  outputRange: { minimum: 0, maximum: 11 },
  modulation: {
    operation: 'average',
    waveforms: [{
      enabled: true,
      shape: 'sine',
      frequency,
      phase: 0,
      amplitude: 1,
      amplitude_offset: 0,
    }],
  },
})

describe('modulation preview queue', () => {
  it('keeps one update in flight and replaces the pending slot with the newest definition', async () => {
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
    let markFirstStarted!: () => void
    const firstStarted = new Promise<void>((resolve) => { markFirstStarted = resolve })
    const calls: Array<{ sequence: string; frequency: number; revision: string }> = []
    const update = vi.fn(async (
      _previewId: string,
      sequence: string,
      revision: string,
      next: ModulationUpdate
    ) => {
      calls.push({
        sequence,
        revision,
        frequency: next.modulation.waveforms[0]?.frequency ?? -1,
      })
      if (sequence === '1') {
        markFirstStarted()
        await firstGate
      }
      return {
        status: { level: 'info' as const, message: 'ok' },
        preview_id: 'preview-1',
        accepted_update_sequence: sequence,
        accepted: true,
        project_changed: true,
        project_revision: `${10 + Number(sequence)}`,
        state_revision: `${20 + Number(sequence)}`,
      }
    })
    const end = vi.fn().mockResolvedValue(undefined)
    const preview = createModulationPreview({
      begin: async () => ({ previewId: 'preview-1', projectRevision: '10' }),
      update,
      end,
      onFinish: vi.fn(),
    })

    const first = preview.update(definition(0.1))
    await firstStarted
    const second = preview.update(definition(0.2))
    const third = preview.update(definition(0.3))
    expect(calls).toEqual([{ sequence: '1', frequency: 0.1, revision: '10' }])

    releaseFirst()
    await Promise.all([first, second, third])
    expect(calls).toEqual([
      { sequence: '1', frequency: 0.1, revision: '10' },
      { sequence: '3', frequency: 0.3, revision: '11' },
    ])

    await preview.commit()
    expect(end).toHaveBeenCalledWith('modulation.preview.commit', 'preview-1', '13')
  })
})
