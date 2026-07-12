import { describe, expect, it } from 'vitest'
import { buildCommandContext, createSerialExecutor } from './commands'
import { commandContextToDto, projectFromDto } from './mappers'
import { projectFixture } from './testFixtures'

describe('command execution primitives', () => {
  it('builds context from the latest revision and reconciles selection', () => {
    expect(buildCommandContext(projectFromDto(projectFixture(12)), {
      path: [{ kind: 'element', index: 99 }],
    })).toEqual({
      expectedProjectRevision: 12,
      selection: { path: [] },
      activeSequenceTarget: null,
    })
    expect(commandContextToDto(buildCommandContext(projectFromDto(projectFixture(12)), {
      path: [{ kind: 'element', index: 99 }],
    }))).toEqual({
      expected_project_revision: 12,
      selection: { path: [] },
      cursor: { row_index: 0, column_index: 0, sequence_id: null },
    })
  })

  it('serializes asynchronous command work after both success and failure', async () => {
    const execute = createSerialExecutor()
    const order: string[] = []
    let releaseFirst = (): void => undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    const first = execute(async () => {
      order.push('first:start')
      await firstGate
      order.push('first:end')
    })
    const second = execute(async () => {
      order.push('second')
    })

    await Promise.resolve()
    expect(order).toEqual(['first:start'])
    releaseFirst()
    await Promise.all([first, second])
    expect(order).toEqual(['first:start', 'first:end', 'second'])
  })
})
