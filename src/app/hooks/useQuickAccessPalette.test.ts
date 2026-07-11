import { describe, expect, it } from 'vitest'
import {
  initialQuickAccessState,
  quickAccessReducer,
} from './useQuickAccessPalette'

describe('quick access state', () => {
  it('opens global browse and legacy command scopes', () => {
    const all = quickAccessReducer(initialQuickAccessState, { type: 'open', scope: 'all' })
    const commands = quickAccessReducer(initialQuickAccessState, {
      type: 'open',
      scope: 'commands',
    })

    expect(all).toMatchObject({ open: true, mode: 'browse', scope: 'all' })
    expect(commands).toMatchObject({ open: true, mode: 'command', scope: 'commands' })
  })

  it('consumes prefixes and returns from staged command editing', () => {
    const opened = quickAccessReducer(initialQuickAccessState, { type: 'open', scope: 'all' })
    const files = quickAccessReducer(opened, { type: 'set_input', value: 'file: groove' })
    const command = quickAccessReducer(files, {
      type: 'enter_command',
      commandText: 'set velocity ',
    })
    const returned = quickAccessReducer(command, { type: 'return_to_browse' })

    expect(files).toMatchObject({ scope: 'files', query: 'groove' })
    expect(command).toMatchObject({
      mode: 'command',
      returnBrowse: { scope: 'files', query: 'groove' },
    })
    expect(returned).toMatchObject({ mode: 'browse', scope: 'files', query: 'groove' })
  })

  it('keeps history and recents across close and de-duplicates recents', () => {
    let state = quickAccessReducer(initialQuickAccessState, {
      type: 'record_command',
      command: 'transport stop',
    })
    state = quickAccessReducer(state, {
      type: 'record_recent',
      itemIds: ['command:transport stop', 'scale:major'],
    })
    state = quickAccessReducer(state, {
      type: 'record_recent',
      itemIds: ['scale:major'],
    })
    state = quickAccessReducer(state, { type: 'close' })

    expect(state.commandHistory).toEqual(['transport stop'])
    expect(state.recentItemIds).toEqual(['scale:major', 'command:transport stop'])
  })
})
