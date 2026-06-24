import type { KeymapTarget } from './contracts'

export const commandUiActionIds = [
  'command.open',
  'command.cancel',
  'command.submit',
  'command.close_if_empty',
  'command.history.previous',
  'command.history.next',
  'command.completion.accept',
  'command.completion.dismiss',
  'command.completion.previous',
  'command.completion.next',
] as const

export type CommandUiActionId = typeof commandUiActionIds[number]

export type FrontendUiActionId =
  | 'selection.move'
  | 'input_mode.set'
  | 'workspace.view.toggle'
  | 'modulator.mode.toggle'
  | 'modulator.slot.select'
  | 'modulator.target.toggle'
  | CommandUiActionId

type UiActionMetadata = {
  id: FrontendUiActionId
  label: string
  section: string
  argumentKind: 'none' | 'selectionDirection' | 'inputMode' | 'modulatorSlot' | 'modTarget'
}

export const uiActionRegistry: Record<FrontendUiActionId, UiActionMetadata> = {
  'selection.move': {
    id: 'selection.move',
    label: 'Move selection',
    section: 'Sequencer',
    argumentKind: 'selectionDirection',
  },
  'input_mode.set': {
    id: 'input_mode.set',
    label: 'Set input mode',
    section: 'Sequencer',
    argumentKind: 'inputMode',
  },
  'workspace.view.toggle': {
    id: 'workspace.view.toggle',
    label: 'Toggle workspace view',
    section: 'Workspace',
    argumentKind: 'none',
  },
  'modulator.mode.toggle': {
    id: 'modulator.mode.toggle',
    label: 'Toggle modulator mode',
    section: 'Modulators',
    argumentKind: 'none',
  },
  'modulator.slot.select': {
    id: 'modulator.slot.select',
    label: 'Select modulator slot',
    section: 'Modulators',
    argumentKind: 'modulatorSlot',
  },
  'modulator.target.toggle': {
    id: 'modulator.target.toggle',
    label: 'Toggle modulator target',
    section: 'Modulators',
    argumentKind: 'modTarget',
  },
  'command.open': {
    id: 'command.open',
    label: 'Open command bar',
    section: 'Command Bar',
    argumentKind: 'none',
  },
  'command.cancel': {
    id: 'command.cancel',
    label: 'Cancel command',
    section: 'Command Bar',
    argumentKind: 'none',
  },
  'command.submit': {
    id: 'command.submit',
    label: 'Submit command',
    section: 'Command Bar',
    argumentKind: 'none',
  },
  'command.close_if_empty': {
    id: 'command.close_if_empty',
    label: 'Close command bar if empty',
    section: 'Command Bar',
    argumentKind: 'none',
  },
  'command.history.previous': {
    id: 'command.history.previous',
    label: 'Previous command',
    section: 'Command Bar',
    argumentKind: 'none',
  },
  'command.history.next': {
    id: 'command.history.next',
    label: 'Next command',
    section: 'Command Bar',
    argumentKind: 'none',
  },
  'command.completion.accept': {
    id: 'command.completion.accept',
    label: 'Accept completion',
    section: 'Command Completions',
    argumentKind: 'none',
  },
  'command.completion.dismiss': {
    id: 'command.completion.dismiss',
    label: 'Dismiss completions',
    section: 'Command Completions',
    argumentKind: 'none',
  },
  'command.completion.previous': {
    id: 'command.completion.previous',
    label: 'Previous completion',
    section: 'Command Completions',
    argumentKind: 'none',
  },
  'command.completion.next': {
    id: 'command.completion.next',
    label: 'Next completion',
    section: 'Command Completions',
    argumentKind: 'none',
  },
}

export const keymapContextLabels: Record<string, string> = {
  sequence: 'Sequencer',
  'command.input': 'Command Bar',
  'command.completions': 'Command Completions',
}

export const commandUiActionSet = new Set<string>(commandUiActionIds)

export const isCommandUiActionId = (action: string): action is CommandUiActionId =>
  commandUiActionSet.has(action)

export const formatKeymapContext = (context: string): string =>
  keymapContextLabels[context] ?? context

export const getCommandKeymapContext = (isCompletionPopupActive: boolean): string =>
  isCompletionPopupActive ? 'command.completions' : 'command.input'

export const formatUiActionTarget = (
  target: Extract<KeymapTarget, { type: 'ui_action' }>
): string => {
  if (target.action === 'selection.move') {
    return `Move ${target.arguments.direction} by ${target.arguments.amount}`
  }
  if (target.action === 'input_mode.set') {
    return `Set input mode to ${target.arguments.mode}`
  }
  if (target.action === 'modulator.slot.select') {
    return `Select modulator slot ${target.arguments.slot}`
  }
  if (target.action === 'modulator.target.toggle') {
    return `Toggle ${target.arguments.target} modulator`
  }
  return uiActionRegistry[target.action].label
}

export type CommandActionRunnerState = {
  commandText: string
  historyIndex: number
  commandHistory: string[]
  isCompletionVisible: boolean
  isCompletionDismissed: boolean
  completionMode: 'none' | 'commandSearch' | 'argumentAssist'
}

export type CommandActionRunnerHandlers = {
  cancel: () => void
  submit: () => void
  closeIfEmpty: () => void
  historyPrevious: () => void
  historyNext: () => void
  completionAccept: () => void
  completionDismiss: () => void
  completionPrevious: () => void
  completionNext: () => void
}

export const runCommandUiAction = (
  action: CommandUiActionId,
  state: CommandActionRunnerState,
  handlers: CommandActionRunnerHandlers
): boolean => {
  switch (action) {
    case 'command.cancel':
      if (state.completionMode !== 'none' && !state.isCompletionDismissed) {
        handlers.completionDismiss()
      } else {
        handlers.cancel()
      }
      return true
    case 'command.submit':
      if (state.isCompletionVisible) {
        handlers.completionAccept()
      } else {
        handlers.submit()
      }
      return true
    case 'command.close_if_empty':
      if (state.commandText.length === 0) {
        handlers.closeIfEmpty()
        return true
      }
      return false
    case 'command.history.previous':
      if (state.commandHistory.length === 0) return false
      handlers.historyPrevious()
      return true
    case 'command.history.next':
      if (state.commandHistory.length === 0 || state.historyIndex === -1) return false
      handlers.historyNext()
      return true
    case 'command.completion.accept':
      if (!state.isCompletionVisible) return false
      handlers.completionAccept()
      return true
    case 'command.completion.dismiss':
      if (state.completionMode === 'none' || state.isCompletionDismissed) return false
      handlers.completionDismiss()
      return true
    case 'command.completion.previous':
      if (!state.isCompletionVisible) return false
      handlers.completionPrevious()
      return true
    case 'command.completion.next':
      if (!state.isCompletionVisible) return false
      handlers.completionNext()
      return true
    case 'command.open':
      return false
  }
}
