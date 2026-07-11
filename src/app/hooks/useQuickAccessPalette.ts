import { useCallback, useReducer, useRef } from 'react'
import { MAX_COMMAND_HISTORY } from '../constants'
import { recognizeCommandIds } from '../domain/commandCompletion'
import {
  consumePaletteScopePrefix,
  type PaletteItem,
  type PaletteScope,
} from '../domain/palette'
import { getErrorMessage } from '../utils/errors'
import type { Dispatch, SetStateAction } from 'react'
import type { CommandReferenceEntry, MessageLevel } from '../domain/models'

type BrowseReturnState = {
  scope: Exclude<PaletteScope, 'commands'>
  query: string
}

export type QuickAccessState = {
  open: boolean
  mode: 'browse' | 'command'
  scope: PaletteScope
  query: string
  selectedId: string | null
  returnBrowse: BrowseReturnState | null
  commandHistory: string[]
  historyIndex: number
  liveCommandBuffer: string
  isCompletionDismissed: boolean
  isHistoryNavigationFrozen: boolean
  recentItemIds: string[]
  busy: boolean
  error: string | null
}

type QuickAccessAction =
  | { type: 'open'; scope: PaletteScope }
  | { type: 'close' }
  | { type: 'set_scope'; scope: PaletteScope }
  | { type: 'set_input'; value: string }
  | { type: 'enter_command'; commandText: string }
  | { type: 'return_to_browse' }
  | { type: 'patch'; patch: Partial<QuickAccessState> }
  | { type: 'record_recent'; itemIds: string[] }
  | { type: 'record_command'; command: string }

export const initialQuickAccessState: QuickAccessState = {
  open: false,
  mode: 'browse',
  scope: 'all',
  query: '',
  selectedId: null,
  returnBrowse: null,
  commandHistory: [],
  historyIndex: -1,
  liveCommandBuffer: '',
  isCompletionDismissed: false,
  isHistoryNavigationFrozen: false,
  recentItemIds: [],
  busy: false,
  error: null,
}

export const quickAccessReducer = (
  state: QuickAccessState,
  action: QuickAccessAction
): QuickAccessState => {
  switch (action.type) {
    case 'open':
      return {
        ...state,
        open: true,
        mode: action.scope === 'commands' ? 'command' : 'browse',
        scope: action.scope,
        query: '',
        selectedId: null,
        returnBrowse: null,
        historyIndex: -1,
        liveCommandBuffer: '',
        isCompletionDismissed: false,
        isHistoryNavigationFrozen: false,
        busy: false,
        error: null,
      }
    case 'close':
      return {
        ...state,
        open: false,
        mode: 'browse',
        scope: 'all',
        query: '',
        selectedId: null,
        returnBrowse: null,
        historyIndex: -1,
        liveCommandBuffer: '',
        isCompletionDismissed: false,
        isHistoryNavigationFrozen: false,
        busy: false,
        error: null,
      }
    case 'set_scope':
      return {
        ...state,
        mode: action.scope === 'commands' ? 'command' : 'browse',
        scope: action.scope,
        selectedId: null,
        returnBrowse: null,
        historyIndex: -1,
        liveCommandBuffer: state.query,
        isCompletionDismissed: false,
        isHistoryNavigationFrozen: false,
        error: null,
      }
    case 'set_input': {
      const prefix = consumePaletteScopePrefix(action.value)
      if (prefix) {
        return {
          ...state,
          mode: prefix.scope === 'commands' ? 'command' : 'browse',
          scope: prefix.scope,
          query: prefix.query,
          selectedId: null,
          returnBrowse: null,
          historyIndex: -1,
          liveCommandBuffer: prefix.query,
          isCompletionDismissed: false,
          isHistoryNavigationFrozen: false,
          error: null,
        }
      }
      const value = state.query.length === 0 ? action.value.trimStart() : action.value
      return {
        ...state,
        query: value,
        selectedId: null,
        historyIndex: -1,
        liveCommandBuffer: value,
        isCompletionDismissed: false,
        isHistoryNavigationFrozen: false,
        error: null,
      }
    }
    case 'enter_command':
      return {
        ...state,
        mode: 'command',
        scope: 'commands',
        query: action.commandText,
        selectedId: null,
        returnBrowse: state.mode === 'browse'
          ? { scope: state.scope as Exclude<PaletteScope, 'commands'>, query: state.query }
          : state.returnBrowse,
        historyIndex: -1,
        liveCommandBuffer: action.commandText,
        isCompletionDismissed: false,
        isHistoryNavigationFrozen: false,
        error: null,
      }
    case 'return_to_browse':
      if (!state.returnBrowse) return state
      return {
        ...state,
        mode: 'browse',
        scope: state.returnBrowse.scope,
        query: state.returnBrowse.query,
        selectedId: null,
        returnBrowse: null,
        historyIndex: -1,
        liveCommandBuffer: '',
        isCompletionDismissed: false,
        isHistoryNavigationFrozen: false,
        error: null,
      }
    case 'record_recent':
      return {
        ...state,
        recentItemIds: [
          ...action.itemIds,
          ...state.recentItemIds.filter((id) => !action.itemIds.includes(id)),
        ].slice(0, 30),
      }
    case 'record_command':
      return {
        ...state,
        commandHistory: [action.command, ...state.commandHistory].slice(0, MAX_COMMAND_HISTORY),
        historyIndex: -1,
        liveCommandBuffer: '',
      }
    case 'patch':
      return { ...state, ...action.patch }
  }
}

type UseQuickAccessPaletteArgs = {
  commands: CommandReferenceEntry[]
  executeBackendCommand: (command: string) => Promise<void>
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
}

export type QuickAccessController = ReturnType<typeof useQuickAccessPalette>

export function useQuickAccessPalette({
  commands,
  executeBackendCommand,
  setStatusMessage,
  setStatusLevel,
}: UseQuickAccessPaletteArgs) {
  const [state, dispatch] = useReducer(quickAccessReducer, initialQuickAccessState)
  const openerRef = useRef<HTMLElement | null>(null)

  const open = useCallback((scope: PaletteScope = 'all'): void => {
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    dispatch({ type: 'open', scope })
  }, [])

  const close = useCallback((restoreFocus = true): void => {
    dispatch({ type: 'close' })
    if (!restoreFocus) return
    window.requestAnimationFrame(() => {
      const opener = openerRef.current
      if (opener?.isConnected) opener.focus()
    })
  }, [])

  const setScope = useCallback((scope: PaletteScope): void => {
    dispatch({ type: 'set_scope', scope })
  }, [])

  const setInput = useCallback((value: string): void => {
    dispatch({ type: 'set_input', value })
  }, [])

  const runBackendCommand = useCallback(async (
    command: string,
    recentIds: string[]
  ): Promise<boolean> => {
    dispatch({ type: 'patch', patch: { busy: true, error: null } })
    try {
      await executeBackendCommand(command)
      if (recentIds.length > 0) {
        dispatch({ type: 'record_recent', itemIds: recentIds })
      }
      dispatch({ type: 'patch', patch: { busy: false } })
      close()
      return true
    } catch (error) {
      const message = getErrorMessage(error)
      dispatch({ type: 'patch', patch: { busy: false, error: `Command failed: ${message}` } })
      setStatusMessage(`Command failed: ${message}`)
      setStatusLevel('error')
      return false
    }
  }, [close, executeBackendCommand, setStatusLevel, setStatusMessage])

  const activateItem = useCallback(async (item: PaletteItem): Promise<void> => {
    if (item.kind === 'command') {
      if (item.command.arguments.length > 0) {
        dispatch({ type: 'enter_command', commandText: `${item.command.id} ` })
        return
      }
      await runBackendCommand(item.command.id, [item.id])
      return
    }
    await runBackendCommand(item.backendCommand, [item.id])
  }, [runBackendCommand])

  const submitCommand = useCallback(async (commandOverride?: string): Promise<void> => {
    const command = (commandOverride ?? state.query).trim()
    if (!command) {
      close()
      return
    }
    dispatch({ type: 'record_command', command })
    const commandIds = recognizeCommandIds(command, commands)
    await runBackendCommand(command, commandIds.map((id) => `command:${id}`))
  }, [close, commands, runBackendCommand, state.query])

  return {
    state,
    dispatch,
    open,
    close,
    setScope,
    setInput,
    activateItem,
    submitCommand,
  }
}
