import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  analyzeCommandCompletion,
  applyCommandCompletion,
} from '../domain/commandCompletion'
import { findKeymapBinding } from '../domain/keymap'
import {
  buildPaletteItems,
  getPaletteSections,
  type CommandPaletteItem,
  type PaletteItem,
  type PaletteScope,
} from '../domain/palette'
import { getCommandKeymapContext, isCommandUiActionId } from '../domain/uiActions'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { QuickAccessController } from '../hooks/useQuickAccessPalette'
import type {
  CommandReferenceEntry,
  InputMode,
  KeymapResource,
  LibrarySnapshot,
} from '../domain/models'

type QuickAccessPaletteProps = {
  controller: QuickAccessController
  commands: CommandReferenceEntry[]
  librarySnapshot: LibrarySnapshot
  activeTuningName: string
  activeScaleId: string | null
  keymapResource: KeymapResource | null
  currentInputMode: InputMode
}

const scopes: Array<{ id: PaletteScope; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'commands', label: 'Commands' },
  { id: 'files', label: 'Files' },
  { id: 'tunings', label: 'Tunings' },
  { id: 'scales', label: 'Scales' },
]

const itemBadge = (item: PaletteItem): string => {
  if (item.kind === 'command') return 'Command'
  if (item.kind === 'file') return 'Measure'
  if (item.kind === 'tuning') return 'Tuning'
  return 'Scale'
}

const optionId = (index: number): string => `quick-access-option-${index}`

export function QuickAccessPalette({
  controller,
  commands,
  librarySnapshot,
  activeTuningName,
  activeScaleId,
  keymapResource,
  currentInputMode,
}: QuickAccessPaletteProps) {
  const { state, dispatch } = controller
  const panelRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const activeOptionRef = useRef<HTMLDivElement | null>(null)
  useFocusTrap(state.open, panelRef)

  const items = useMemo(() => buildPaletteItems({
    commands,
    library: librarySnapshot,
    activeTuningName,
    activeScaleId,
  }), [activeScaleId, activeTuningName, commands, librarySnapshot])

  const completion = useMemo(
    () => analyzeCommandCompletion(
      state.query,
      commands,
      state.recentItemIds
        .filter((id) => id.startsWith('command:'))
        .map((id) => id.slice('command:'.length))
    ),
    [commands, state.query, state.recentItemIds]
  )
  const commandCandidates = state.mode === 'command' && !state.isCompletionDismissed &&
    !state.isHistoryNavigationFrozen && completion.mode === 'commandSearch'
    ? (completion.segment.commandText.trim()
        ? completion.candidates.slice(0, 8)
        : completion.candidates)
    : []
  const commandItems = commandCandidates.map<CommandPaletteItem>((candidate) => ({
    kind: 'command',
    id: `command:${candidate.command.id}`,
    label: candidate.command.id,
    detail: candidate.command.description,
    keywords: candidate.command.keywords,
    searchText: candidate.signature,
    active: false,
    command: candidate.command,
  }))
  const browseSections = state.mode === 'browse'
    ? getPaletteSections(items, state.scope as Exclude<PaletteScope, 'commands'>, state.query, state.recentItemIds)
    : []
  const visibleItems = state.mode === 'command'
    ? commandItems
    : browseSections.flatMap((section) => section.items)
  const selectedIndex = Math.max(0, visibleItems.findIndex((item) => item.id === state.selectedId))
  const selectedItem = visibleItems[selectedIndex] ?? null
  const activeDescendant = selectedItem ? optionId(selectedIndex) : undefined
  const argumentAssistVisible = state.mode === 'command' &&
    !state.isCompletionDismissed &&
    completion.mode === 'argumentAssist' &&
    completion.argumentPlaceholders.length > 0

  useEffect(() => {
    if (!state.open) return
    inputRef.current?.focus()
  }, [state.open])

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView({ block: 'nearest' })
  }, [state.selectedId])

  if (!state.open) return null

  const navigate = (direction: 1 | -1): void => {
    if (visibleItems.length === 0) return
    const current = visibleItems.findIndex((item) => item.id === state.selectedId)
    const nextIndex = current === -1
      ? 0
      : (current + direction + visibleItems.length) % visibleItems.length
    dispatch({ type: 'patch', patch: { selectedId: visibleItems[nextIndex]?.id ?? null } })
  }

  const acceptCommandCompletion = (item = selectedItem): void => {
    if (!item || item.kind !== 'command') return
    controller.setInput(applyCommandCompletion(state.query, completion.segment, item.command))
  }

  const activateCommandSelection = async (): Promise<void> => {
    if (!selectedItem || selectedItem.kind !== 'command') {
      await controller.submitCommand()
      return
    }
    if (completion.isExactCommandInput) {
      await controller.submitCommand()
      return
    }
    if (selectedItem.command.arguments.length === 0) {
      const completedCommand = applyCommandCompletion(
        state.query,
        completion.segment,
        selectedItem.command
      )
      await controller.submitCommand(completedCommand)
      return
    }
    acceptCommandCompletion(selectedItem)
  }

  const activateSelection = async (): Promise<void> => {
    if (state.mode === 'command') {
      await activateCommandSelection()
      return
    }
    if (selectedItem) await controller.activateItem(selectedItem)
  }

  const navigateHistoryPrevious = (): void => {
    if (state.commandHistory.length === 0) return
    if (state.historyIndex === -1) {
      dispatch({
        type: 'patch',
        patch: {
          historyIndex: 0,
          query: state.commandHistory[0] ?? '',
          liveCommandBuffer: state.query,
          isHistoryNavigationFrozen: true,
          isCompletionDismissed: true,
        },
      })
      return
    }
    const nextIndex = Math.min(state.historyIndex + 1, state.commandHistory.length - 1)
    dispatch({
      type: 'patch',
      patch: { historyIndex: nextIndex, query: state.commandHistory[nextIndex] ?? '' },
    })
  }

  const navigateHistoryNext = (): void => {
    if (state.historyIndex === -1) return
    if (state.historyIndex === 0) {
      dispatch({
        type: 'patch',
        patch: { historyIndex: -1, query: state.liveCommandBuffer },
      })
      return
    }
    const nextIndex = state.historyIndex - 1
    dispatch({
      type: 'patch',
      patch: { historyIndex: nextIndex, query: state.commandHistory[nextIndex] ?? '' },
    })
  }

  const cancelCommandLayer = (): void => {
    if (completion.mode !== 'none' && !state.isCompletionDismissed) {
      dispatch({ type: 'patch', patch: { isCompletionDismissed: true } })
      return
    }
    if (state.returnBrowse) {
      dispatch({ type: 'return_to_browse' })
      return
    }
    controller.close()
  }

  const runCommandAction = (action: string): boolean => {
    if (!isCommandUiActionId(action)) return false
    switch (action) {
      case 'command.cancel':
        cancelCommandLayer()
        return true
      case 'command.submit':
        void activateCommandSelection()
        return true
      case 'command.close_if_empty':
        if (state.query.length > 0) return false
        controller.close()
        return true
      case 'command.history.previous':
        if (state.commandHistory.length === 0) return false
        navigateHistoryPrevious()
        return true
      case 'command.history.next':
        if (state.historyIndex === -1) return false
        navigateHistoryNext()
        return true
      case 'command.completion.accept':
        if (!selectedItem) return false
        acceptCommandCompletion()
        return true
      case 'command.completion.dismiss':
        dispatch({ type: 'patch', patch: { isCompletionDismissed: true } })
        return true
      case 'command.completion.previous':
        navigate(-1)
        return true
      case 'command.completion.next':
        navigate(1)
        return true
      case 'command.open':
        return false
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (state.mode === 'command') {
      const matchedBinding = findKeymapBinding(
        keymapResource,
        getCommandKeymapContext(commandItems.length > 0),
        event.nativeEvent,
        currentInputMode
      )
      if (matchedBinding?.target.type === 'ui_action' && runCommandAction(matchedBinding.target.action)) {
        event.preventDefault()
        return
      }
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      if (state.mode === 'command') cancelCommandLayer()
      else controller.close()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      void activateSelection()
      return
    }
    if (event.key === 'Tab' && state.mode === 'command' && selectedItem) {
      event.preventDefault()
      acceptCommandCompletion()
      return
    }
    if (event.key === 'ArrowDown' || (event.ctrlKey && event.key.toLowerCase() === 'n')) {
      if (visibleItems.length > 0) {
        event.preventDefault()
        navigate(1)
      } else if (state.mode === 'command') {
        navigateHistoryNext()
      }
      return
    }
    if (event.key === 'ArrowUp' || (event.ctrlKey && event.key.toLowerCase() === 'p')) {
      if (visibleItems.length > 0) {
        event.preventDefault()
        navigate(-1)
      } else if (state.mode === 'command') {
        navigateHistoryPrevious()
      }
      return
    }
    if (event.key === 'Backspace' && state.mode === 'command' && state.query.length === 0) {
      event.preventDefault()
      if (state.returnBrowse) dispatch({ type: 'return_to_browse' })
      else controller.close()
    }
  }

  let optionIndex = 0
  const renderOption = (item: PaletteItem) => {
    const index = optionIndex
    optionIndex += 1
    const selected = item.id === selectedItem?.id
    return (
      <div
        id={optionId(index)}
        key={item.id}
        ref={selected ? activeOptionRef : null}
        className={`quickAccessOption${selected ? ' quickAccessOption-selected' : ''}`}
        role="option"
        aria-label={`${itemBadge(item)}: ${item.label}. ${item.detail}`}
        aria-selected={selected}
        onMouseDown={(event) => event.preventDefault()}
        onMouseMove={() => {
          if (!selected) dispatch({ type: 'patch', patch: { selectedId: item.id } })
        }}
        onClick={() => {
          void controller.activateItem(item)
        }}
      >
        <span className="quickAccessBadge mono">{itemBadge(item)}</span>
        <span className="quickAccessOptionText">
          <span className="quickAccessOptionLabel mono">{item.label}</span>
          <span className="quickAccessOptionDetail">{item.detail}</span>
        </span>
        {item.kind === 'command' ? (
          <span className="quickAccessSignature mono">
            {item.command.signature.slice(item.command.id.length).trim()}
          </span>
        ) : item.active ? (
          <span className="quickAccessActiveLabel">Active</span>
        ) : null}
      </div>
    )
  }

  return createPortal(
    <div
      className="quickAccessBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) controller.close()
      }}
    >
      <section
        ref={panelRef}
        className="quickAccessPanel"
        role="dialog"
        aria-modal="true"
        aria-label="Quick access"
        aria-busy={state.busy}
        tabIndex={-1}
      >
        <div className="quickAccessSearchField">
          <span className="quickAccessSearchIcon" aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            className="quickAccessInput mono"
            role="combobox"
            aria-label="Search files, tunings, scales, and commands"
            aria-controls="quick-access-results"
            aria-expanded={visibleItems.length > 0}
            aria-activedescendant={activeDescendant}
            value={state.query}
            readOnly={state.busy}
            onChange={(event) => controller.setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={state.mode === 'command' ? 'Type a command…' : 'Search or run…'}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
          />
          {state.busy ? <span className="quickAccessBusy">Running…</span> : null}
        </div>
        <div className="quickAccessScopes" role="group" aria-label="Quick access scope">
          {scopes.map((scope) => (
            <button
              type="button"
              key={scope.id}
              className={`quickAccessScope${state.scope === scope.id ? ' quickAccessScope-active' : ''}`}
              aria-pressed={state.scope === scope.id}
              onClick={() => controller.setScope(scope.id)}
              disabled={state.busy}
            >
              {scope.label}
            </button>
          ))}
        </div>
        {argumentAssistVisible ? (
          <div className="quickAccessArgumentAssist" aria-label="Command arguments">
            {completion.argumentPlaceholders.map((argument) => (
              <span className="quickAccessArgument mono" key={argument.displayName}>
                {argument.required ? '<' : '['}
                <strong>{argument.displayName}</strong>
                <span>:{argument.detail}</span>
                {argument.defaultValue === null ? null : <span>={argument.defaultValue}</span>}
                {argument.required ? '>' : ']'}
              </span>
            ))}
          </div>
        ) : null}
        {state.error ? <div className="quickAccessError" role="alert">{state.error}</div> : null}
        <div id="quick-access-results" className="quickAccessResults" role="listbox">
          {state.mode === 'command' ? (
            commandItems.length > 0 ? commandItems.map(renderOption) : (
              <p className="quickAccessEmpty">Press Enter to run the command.</p>
            )
          ) : browseSections.some((section) => section.items.length > 0) ? (
            browseSections.map((section) => section.items.length > 0 ? (
              <section className="quickAccessSection" key={section.id}>
                <h2 className="quickAccessSectionLabel">{section.label}</h2>
                {section.items.map(renderOption)}
              </section>
            ) : null)
          ) : (
            <p className="quickAccessEmpty">No matching items.</p>
          )}
        </div>
        <footer className="quickAccessFooter">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> select</span>
          <span><kbd>Esc</kbd> close</span>
        </footer>
      </section>
    </div>,
    document.body
  )
}
