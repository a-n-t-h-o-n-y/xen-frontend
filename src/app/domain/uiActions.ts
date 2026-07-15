import type { KeymapTarget } from './keymap'

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
  | 'workspace.view.composition'
  | 'workspace.view.sequencer'
  | 'composition.selection.move'
  | 'composition.cell.edit_sequence'
  | 'composition.cell.duplicate_right'
  | 'composition.cell.rename_or_create_sequence'
  | 'composition.cell.unassign'
  | 'composition.row.rename'
  | 'composition.row.channel'
  | 'composition.column.length'
  | 'composition.loop.set_start'
  | 'composition.loop.set_end'
  | 'edit.copy'
  | 'edit.cut'
  | 'edit.paste'
  | 'modulator.mode.toggle'
  | CommandUiActionId

type UiActionMetadata = {
  id: FrontendUiActionId
  label: string
  section: string
  argumentKind:
    | 'none'
    | 'selectionDirection'
    | 'inputMode'
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
  'workspace.view.composition': {
    id: 'workspace.view.composition',
    label: 'View composition',
    section: 'Workspace',
    argumentKind: 'none',
  },
  'workspace.view.sequencer': {
    id: 'workspace.view.sequencer',
    label: 'View sequencer',
    section: 'Workspace',
    argumentKind: 'none',
  },
  'composition.selection.move': {
    id: 'composition.selection.move',
    label: 'Move composition selection',
    section: 'Composition',
    argumentKind: 'selectionDirection',
  },
  'composition.cell.edit_sequence': {
    id: 'composition.cell.edit_sequence',
    label: 'Edit composition cell sequence',
    section: 'Composition',
    argumentKind: 'none',
  },
  'composition.cell.duplicate_right': {
    id: 'composition.cell.duplicate_right',
    label: 'Duplicate composition cell right',
    section: 'Composition',
    argumentKind: 'none',
  },
  'composition.cell.rename_or_create_sequence': {
    id: 'composition.cell.rename_or_create_sequence',
    label: 'Rename or assign composition cell',
    section: 'Composition',
    argumentKind: 'none',
  },
  'composition.cell.unassign': {
    id: 'composition.cell.unassign',
    label: 'Unassign composition cell',
    section: 'Composition',
    argumentKind: 'none',
  },
  'composition.row.rename': {
    id: 'composition.row.rename',
    label: 'Rename row',
    section: 'Composition',
    argumentKind: 'none',
  },
  'composition.row.channel': {
    id: 'composition.row.channel',
    label: 'Edit row channel',
    section: 'Composition',
    argumentKind: 'none',
  },
  'composition.column.length': {
    id: 'composition.column.length',
    label: 'Edit column length',
    section: 'Composition',
    argumentKind: 'none',
  },
  'composition.loop.set_start': {
    id: 'composition.loop.set_start',
    label: 'Set loop start column',
    section: 'Composition',
    argumentKind: 'none',
  },
  'composition.loop.set_end': {
    id: 'composition.loop.set_end',
    label: 'Set loop end column',
    section: 'Composition',
    argumentKind: 'none',
  },
  'edit.copy': {
    id: 'edit.copy',
    label: 'Copy',
    section: 'Editing',
    argumentKind: 'none',
  },
  'edit.cut': {
    id: 'edit.cut',
    label: 'Cut',
    section: 'Editing',
    argumentKind: 'none',
  },
  'edit.paste': {
    id: 'edit.paste',
    label: 'Paste',
    section: 'Editing',
    argumentKind: 'none',
  },
  'modulator.mode.toggle': {
    id: 'modulator.mode.toggle',
    label: 'Toggle modulator mode',
    section: 'Modulators',
    argumentKind: 'none',
  },
  'command.open': {
    id: 'command.open',
    label: 'Open Quick Access commands',
    section: 'Quick Access',
    argumentKind: 'none',
  },
  'command.cancel': {
    id: 'command.cancel',
    label: 'Cancel command',
    section: 'Quick Access',
    argumentKind: 'none',
  },
  'command.submit': {
    id: 'command.submit',
    label: 'Submit command',
    section: 'Quick Access',
    argumentKind: 'none',
  },
  'command.close_if_empty': {
    id: 'command.close_if_empty',
    label: 'Close Quick Access if empty',
    section: 'Quick Access',
    argumentKind: 'none',
  },
  'command.history.previous': {
    id: 'command.history.previous',
    label: 'Previous command',
    section: 'Quick Access',
    argumentKind: 'none',
  },
  'command.history.next': {
    id: 'command.history.next',
    label: 'Next command',
    section: 'Quick Access',
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
  sequencer: 'Sequencer',
  composition: 'Composition',
  'quick_access.browse': 'Quick Access Browse',
  'quick_access.command': 'Quick Access Command',
  'quick_access.completions': 'Quick Access Completions',
}

export const keymapContexts = Object.keys(keymapContextLabels)

export const commandUiActionSet = new Set<string>(commandUiActionIds)

export const isCommandUiActionId = (action: string): action is CommandUiActionId =>
  commandUiActionSet.has(action)

export const isUiActionAllowedInContext = (
  action: FrontendUiActionId,
  context: string
): boolean => {
  if (action === 'command.open') return context === 'sequencer' || context === 'composition'
  if (action.startsWith('command.')) return context.startsWith('quick_access.')
  if (action.startsWith('composition.')) return context === 'composition'
  if (action.startsWith('edit.')) return context === 'sequencer' || context === 'composition'
  if (action.startsWith('workspace.')) return context === 'sequencer' || context === 'composition'
  return context === 'sequencer'
}

export const formatKeymapContext = (context: string): string =>
  keymapContextLabels[context] ?? context

export const getCommandKeymapContext = (isCompletionPopupActive: boolean): string =>
  isCompletionPopupActive ? 'quick_access.completions' : 'quick_access.command'

export const formatUiActionTarget = (
  target: Extract<KeymapTarget, { type: 'ui_action' }>
): string => {
  if (target.action === 'selection.move') {
    return `Move ${target.arguments.direction} by ${target.arguments.amount}`
  }
  if (target.action === 'composition.selection.move') {
    return `Move composition ${target.arguments.direction} by ${target.arguments.amount}`
  }
  if (target.action === 'input_mode.set') {
    return `Set input mode to ${target.arguments.mode}`
  }
  return uiActionRegistry[target.action].label
}

export type CommandActionRunnerState = {
  commandText: string
  historyIndex: number
  commandHistory: string[]
  isCompletionVisible: boolean
  isCompletionDismissed: boolean
  isExactCommandInput: boolean
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
      handlers.submit()
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
