import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  analyzeCommandCompletion,
  applyArgumentCompletion,
  applyCommandCompletion,
  getArgumentCompletionCandidates,
  formatArgumentDefault,
  getArgumentDetail,
  recognizeCommandIds,
  type ArgumentCompletionCandidate,
} from '../domain/commandCompletion'
import { findKeymapBinding } from '../domain/keymap'
import {
  buildCommandInvocationItems,
  buildPaletteItems,
  commandFromInvocationItemId,
  getPaletteSections,
  type CommandPaletteItem,
  type PaletteItem,
  type PaletteScope,
} from '../domain/palette'
import {
  getCommandKeymapContext,
  isCommandUiActionId,
  runCommandUiAction,
} from '../domain/uiActions'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { QuickAccessController } from '../hooks/useQuickAccessPalette'
import type {
  CommandReferenceEntry,
  InputMode,
  KeymapResource,
  LibrarySnapshot,
  SequenceBank,
} from '../domain/models'

type QuickAccessPaletteProps = {
  controller: QuickAccessController
  commands: CommandReferenceEntry[]
  librarySnapshot: LibrarySnapshot
  activeTuningName: string
  activeScaleId: string | null
  sequenceBank: SequenceBank | null
  keymapResource: KeymapResource | null
  currentInputMode: InputMode
  midiCcLabels?: ReadonlyMap<number, string>
  activeMidiCcController?: number
}

const scopes: Array<{ id: PaletteScope; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'commands', label: 'Commands' },
  { id: 'files', label: 'Files' },
  { id: 'tunings', label: 'Tunings' },
  { id: 'scales', label: 'Scales' },
]

const itemBadge = (item: PaletteItem): string => {
  if (item.kind === 'command' || item.kind === 'commandInvocation') return 'Command'
  if (item.kind === 'file') return item.fileKind === 'project' ? 'Project' : 'Cell'
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
  sequenceBank,
  keymapResource,
  currentInputMode,
  midiCcLabels,
  activeMidiCcController,
}: QuickAccessPaletteProps) {
  const { state, dispatch } = controller
  const panelRef = useRef<HTMLElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const activeOptionRef = useRef<HTMLDivElement | null>(null)
  const pendingCaretRef = useRef<number | null>(null)
  const [caretOffset, setCaretOffset] = useState(0)
  const [inputScrollLeft, setInputScrollLeft] = useState(0)
  const [completionNotice, setCompletionNotice] = useState('')
  useFocusTrap(state.open, panelRef)

  const items = useMemo(() => buildPaletteItems({
    commands,
    library: librarySnapshot,
    activeTuningName,
    activeScaleId,
  }).concat(buildCommandInvocationItems(state.recentItemIds)), [
    activeScaleId,
    activeTuningName,
    commands,
    librarySnapshot,
    state.recentItemIds,
  ])

  const recentCommandIds = useMemo(() => {
    const ids = state.recentItemIds.flatMap((id) => {
      if (id.startsWith('command:')) return [id.slice('command:'.length)]
      const command = commandFromInvocationItemId(id)
      return command ? recognizeCommandIds(command, commands) : []
    })
    return ids.filter((id, index) => ids.indexOf(id) === index)
  }, [commands, state.recentItemIds])

  const completion = useMemo(
    () => analyzeCommandCompletion(
      state.query,
      commands,
      recentCommandIds,
      caretOffset
    ),
    [caretOffset, commands, recentCommandIds, state.query]
  )
  const argumentCandidates = useMemo(() =>
    state.mode === 'command' && !state.isCompletionDismissed &&
      !state.isHistoryNavigationFrozen && completion.mode === 'argumentAssist'
      ? getArgumentCompletionCandidates(completion.activeArgument, {
          library: librarySnapshot,
          sequenceBank,
          activeTuningName,
          activeScaleId,
          ...(midiCcLabels ? { midiCcLabels } : {}),
          ...(activeMidiCcController === undefined ? {} : { activeMidiCcController }),
        })
      : [], [
    activeScaleId,
    activeTuningName,
    completion.activeArgument,
    completion.mode,
    librarySnapshot,
    midiCcLabels,
    activeMidiCcController,
    sequenceBank,
    state.isCompletionDismissed,
    state.isHistoryNavigationFrozen,
    state.mode,
  ])
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
  const commandHomeVisible = state.mode === 'command' && !state.query.trim() &&
    !state.isHistoryNavigationFrozen
  const commandHomeSections = commandHomeVisible
    ? (() => {
        const recentItems = state.recentItemIds
          .map((id) => items.find((item) => item.id === id))
          .filter((item): item is PaletteItem =>
            item !== undefined &&
            (item.kind === 'command' || item.kind === 'commandInvocation')
          )
          .slice(0, 6)
        const recentSet = new Set(recentItems.map((item) => item.id))
        const suggestedItems = commandItems
          .filter((item) => !recentSet.has(item.id))
          .slice(0, Math.max(0, 6 - recentItems.length))
        return [
          ...(recentItems.length > 0
            ? [{ id: 'recent-commands', label: 'Recent', items: recentItems }]
            : []),
          ...(suggestedItems.length > 0
            ? [{ id: 'suggested-commands', label: 'Suggested', items: suggestedItems }]
            : []),
        ]
      })()
    : []
  const browseSections = state.mode === 'browse'
    ? getPaletteSections(items, state.scope as Exclude<PaletteScope, 'commands'>, state.query, state.recentItemIds)
    : []
  const visibleItems = state.mode === 'command'
    ? commandHomeVisible
      ? commandHomeSections.flatMap((section) => section.items)
      : commandItems
    : browseSections.flatMap((section) => section.items)
  const visibleOptionIds = argumentCandidates.length > 0
    ? argumentCandidates.map((candidate) => candidate.id)
    : visibleItems.map((item) => item.id)
  const selectedIndex = Math.max(0, visibleOptionIds.indexOf(state.selectedId ?? ''))
  const selectedItem = argumentCandidates.length > 0
    ? null
    : visibleItems[selectedIndex] ?? null
  const selectedArgumentCandidate = argumentCandidates[selectedIndex] ?? null
  const activeDescendant = visibleOptionIds.length > 0 ? optionId(selectedIndex) : undefined
  const activeArgument = completion.activeArgument
  const futureArguments = completion.recognizedCommand && activeArgument
    ? completion.recognizedCommand.arguments.slice(activeArgument.argumentIndex + 1)
    : []
  const selectedCandidateSuffix = (() => {
    if (!activeArgument?.rawValue || !selectedArgumentCandidate) return ''
    const raw = activeArgument.rawValue.toLowerCase()
    const insertion = selectedArgumentCandidate.insertionText
    return insertion.toLowerCase().startsWith(raw) ? insertion.slice(raw.length) : ''
  })()
  const formatInlineArgument = (argument: CommandReferenceEntry['arguments'][number]): string => {
    const detail = getArgumentDetail(argument)
    const defaultValue = formatArgumentDefault(argument.defaultValue)
    const defaultText = defaultValue === null ? '' : ` = ${defaultValue}`
    const label = `${argument.displayName}: ${detail}${defaultText}`
    return argument.required ? `<${label}>` : `[${label}]`
  }
  const activeArgumentGhost = activeArgument && !activeArgument.hasValue
    ? formatInlineArgument(activeArgument.argument)
    : selectedCandidateSuffix
  const futureArgumentGhost = futureArguments.map(formatInlineArgument).join(' ')
  const ghostText = [activeArgumentGhost, futureArgumentGhost].filter(Boolean).join(' ')
  const completionAnnouncement = completionNotice || (completion.mode === 'argumentAssist'
    ? argumentCandidates.length > 0
      ? `${argumentCandidates.length} ${activeArgument?.argument.displayName ?? 'argument'} options available.`
      : `Enter ${activeArgument?.argument.displayName ?? 'argument'}.`
    : '')

  useEffect(() => {
    if (!state.open) return
    inputRef.current?.focus()
    const nextCaret = inputRef.current?.value.length ?? 0
    inputRef.current?.setSelectionRange(nextCaret, nextCaret)
  }, [state.open])

  useLayoutEffect(() => {
    const nextCaret = pendingCaretRef.current
    if (nextCaret === null) return
    pendingCaretRef.current = null
    inputRef.current?.focus()
    inputRef.current?.setSelectionRange(nextCaret, nextCaret)
  }, [state.query])

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView({ block: 'nearest' })
  }, [state.selectedId])

  if (!state.open) return null

  const navigate = (direction: 1 | -1): void => {
    if (visibleOptionIds.length === 0) return
    const current = visibleOptionIds.indexOf(state.selectedId ?? '')
    const nextIndex = current === -1
      ? 0
      : (current + direction + visibleOptionIds.length) % visibleOptionIds.length
    dispatch({ type: 'patch', patch: { selectedId: visibleOptionIds[nextIndex] ?? null } })
  }

  const setComposerInput = (value: string, nextCaret: number): void => {
    pendingCaretRef.current = nextCaret
    setCaretOffset(nextCaret)
    setCompletionNotice('')
    controller.setInput(value)
  }

  const acceptArgumentCompletion = (candidate = selectedArgumentCandidate): void => {
    if (!candidate || !activeArgument) return
    const applied = applyArgumentCompletion(state.query, activeArgument, candidate.insertionText)
    setComposerInput(applied.text, applied.caretOffset)
  }

  const acceptCommandCompletion = (item = selectedItem): void => {
    if (selectedArgumentCandidate) {
      acceptArgumentCompletion(selectedArgumentCandidate)
      return
    }
    if (item?.kind === 'commandInvocation') {
      controller.setInput(item.backendCommand)
      return
    }
    if (!item || item.kind !== 'command') return
    const nextText = applyCommandCompletion(state.query, completion.segment, item.command)
    setComposerInput(nextText, completion.segment.commandTextStart + item.command.id.length + 1)
  }

  const acceptOrAdvanceCompletion = (): void => {
    if (selectedArgumentCandidate) {
      acceptArgumentCompletion(selectedArgumentCandidate)
      return
    }
    if (completion.mode !== 'argumentAssist' || !activeArgument) {
      acceptCommandCompletion()
      return
    }
    if (activeArgument.hasValue) {
      const applied = applyArgumentCompletion(
        state.query,
        activeArgument,
        state.query.slice(activeArgument.replaceStart, activeArgument.replaceEnd)
      )
      setComposerInput(applied.text, applied.caretOffset)
      return
    }
    if (!activeArgument.argument.required && activeArgument.argument.defaultValue !== null) {
      const applied = applyArgumentCompletion(
        state.query,
        activeArgument,
        activeArgument.argument.defaultValue
      )
      setComposerInput(applied.text, applied.caretOffset)
      return
    }
    setCompletionNotice(`A ${activeArgument.argument.displayName} value is required.`)
  }

  const activateCommandSelection = async (): Promise<void> => {
    if (selectedArgumentCandidate) {
      acceptArgumentCompletion(selectedArgumentCandidate)
      return
    }
    if (selectedItem?.kind === 'commandInvocation') {
      await controller.activateItem(selectedItem)
      return
    }
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
      const nextQuery = state.commandHistory[0] ?? ''
      setCaretOffset(nextQuery.length)
      dispatch({
        type: 'patch',
        patch: {
          historyIndex: 0,
          query: nextQuery,
          liveCommandBuffer: state.query,
          isHistoryNavigationFrozen: true,
          isCompletionDismissed: true,
        },
      })
      return
    }
    const nextIndex = Math.min(state.historyIndex + 1, state.commandHistory.length - 1)
    setCaretOffset((state.commandHistory[nextIndex] ?? '').length)
    dispatch({
      type: 'patch',
      patch: { historyIndex: nextIndex, query: state.commandHistory[nextIndex] ?? '' },
    })
  }

  const navigateHistoryNext = (): void => {
    if (state.historyIndex === -1) return
    if (state.historyIndex === 0) {
      setCaretOffset(state.liveCommandBuffer.length)
      dispatch({
        type: 'patch',
        patch: { historyIndex: -1, query: state.liveCommandBuffer },
      })
      return
    }
    const nextIndex = state.historyIndex - 1
    setCaretOffset((state.commandHistory[nextIndex] ?? '').length)
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
    return runCommandUiAction(action, {
      commandText: state.query,
      historyIndex: state.historyIndex,
      commandHistory: state.commandHistory,
      isCompletionVisible: selectedItem !== null || selectedArgumentCandidate !== null ||
        completion.mode === 'argumentAssist',
      isCompletionDismissed: state.isCompletionDismissed,
      isExactCommandInput: completion.isExactCommandInput,
      completionMode: completion.mode,
    }, {
      cancel: cancelCommandLayer,
      submit: () => void activateSelection(),
      closeIfEmpty: () => {
        if (state.returnBrowse) dispatch({ type: 'return_to_browse' })
        else controller.close()
      },
      historyPrevious: navigateHistoryPrevious,
      historyNext: navigateHistoryNext,
      completionAccept: acceptOrAdvanceCompletion,
      completionDismiss: () => dispatch({
        type: 'patch',
        patch: { isCompletionDismissed: true },
      }),
      completionPrevious: () => navigate(-1),
      completionNext: () => navigate(1),
    })
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    const context = state.mode === 'browse'
      ? 'quick_access.browse'
      : getCommandKeymapContext(commandItems.length > 0 || argumentCandidates.length > 0)
    const matchedBinding = findKeymapBinding(
      keymapResource,
      context,
      event.nativeEvent,
      currentInputMode
    )
    if (
      matchedBinding?.target.type === 'command' &&
      (!event.repeat || matchedBinding.repeat === 'allow')
    ) {
      event.preventDefault()
      event.stopPropagation()
      void controller.submitCommand(matchedBinding.target.command)
      return
    }
    if (
      matchedBinding?.target.type === 'ui_action' &&
      (!event.repeat || matchedBinding.repeat === 'allow') &&
      runCommandAction(matchedBinding.target.action)
    ) {
      event.preventDefault()
      event.stopPropagation()
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
          if (item.kind === 'command' && item.command.arguments.length > 0) {
            const nextCaret = item.command.id.length + 1
            pendingCaretRef.current = nextCaret
            setCaretOffset(nextCaret)
          }
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

  const renderArgumentOption = (candidate: ArgumentCompletionCandidate, index: number) => {
    const selected = candidate.id === selectedArgumentCandidate?.id
    const markers = [candidate.isDefault ? 'Default' : '', candidate.isActive ? 'Active' : '']
      .filter(Boolean)
      .join(' · ')
    return (
      <div
        id={optionId(index)}
        key={candidate.id}
        ref={selected ? activeOptionRef : null}
        className={`quickAccessArgumentOption${selected ? ' quickAccessOption-selected' : ''}`}
        role="option"
        aria-label={`${candidate.label}${candidate.detail ? `. ${candidate.detail}` : ''}${markers ? `. ${markers}` : ''}`}
        aria-selected={selected}
        onMouseDown={(event) => event.preventDefault()}
        onMouseMove={() => {
          if (!selected) dispatch({ type: 'patch', patch: { selectedId: candidate.id } })
        }}
        onClick={() => acceptArgumentCompletion(candidate)}
      >
        <span className="quickAccessArgumentValue mono">{candidate.label}</span>
        {candidate.detail ? <span className="quickAccessArgumentDetail mono">{candidate.detail}</span> : null}
        {markers ? <span className="quickAccessArgumentMarkers">{markers}</span> : null}
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
          <div className="quickAccessComposer">
            {state.mode === 'command' && completion.mode === 'argumentAssist' &&
              caretOffset === state.query.length && ghostText ? (
                <div
                  className="quickAccessGhost mono"
                  aria-hidden="true"
                  style={{ transform: `translateX(${-inputScrollLeft}px)` }}
                >
                  <span className="quickAccessGhostPrefix">{state.query}</span>
                  {activeArgumentGhost ? (
                    <span className="quickAccessGhostActive">{activeArgumentGhost}</span>
                  ) : null}
                  {activeArgumentGhost && futureArgumentGhost ? ' ' : null}
                  {futureArgumentGhost ? (
                    <span className="quickAccessGhostFuture">{futureArgumentGhost}</span>
                  ) : null}
                </div>
              ) : null}
            <input
              ref={inputRef}
              className="quickAccessInput mono"
              role="combobox"
              aria-label="Search files, tunings, scales, and commands"
              aria-controls="quick-access-results"
              aria-describedby="quick-access-argument-description"
              aria-expanded={visibleOptionIds.length > 0}
              aria-activedescendant={activeDescendant}
              value={state.query}
              readOnly={state.busy}
              onChange={(event) => {
                const nextCaret = event.currentTarget.selectionStart ?? event.currentTarget.value.length
                setCaretOffset(nextCaret)
                setCompletionNotice('')
                controller.setInput(event.currentTarget.value)
              }}
              onSelect={(event) => setCaretOffset(
                event.currentTarget.selectionStart ?? event.currentTarget.value.length
              )}
              onScroll={(event) => setInputScrollLeft(event.currentTarget.scrollLeft)}
              onKeyDown={handleKeyDown}
              placeholder={state.mode === 'command' ? 'Type a command…' : 'Search or run…'}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
            />
          </div>
          {state.busy ? <span className="quickAccessBusy">Running…</span> : null}
        </div>
        {completion.mode !== 'argumentAssist' ? (
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
        ) : null}
        <span
          id="quick-access-argument-description"
          className="visuallyHidden"
          aria-label="Command arguments"
        >
          {completion.mode === 'argumentAssist' ? ghostText : ''}
        </span>
        <span className="visuallyHidden" aria-live="polite">{completionAnnouncement}</span>
        {state.error ? <div className="quickAccessError" role="alert">{state.error}</div> : null}
        <div id="quick-access-results" className="quickAccessResults" role="listbox">
          {argumentCandidates.length > 0 ? (
            <section className="quickAccessSection">
              <h2 className="quickAccessSectionLabel">
                {activeArgument?.argument.displayName ?? 'Options'}
              </h2>
              {argumentCandidates.map(renderArgumentOption)}
            </section>
          ) : state.mode === 'command' ? (
            commandHomeVisible && commandHomeSections.length > 0 ? (
              commandHomeSections.map((section) => (
                <section className="quickAccessSection" key={section.id}>
                  <h2 className="quickAccessSectionLabel">{section.label}</h2>
                  {section.items.map(renderOption)}
                </section>
              ))
            ) : commandItems.length > 0 ? commandItems.map(renderOption) : (
              <p className="quickAccessEmpty">
                {completion.mode === 'argumentAssist' && activeArgument &&
                !activeArgument.hasValue && activeArgument.argument.required
                  ? `Enter ${activeArgument.argument.displayName}.`
                  : 'Press Enter to run the command.'}
              </p>
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
          {argumentCandidates.length > 0 ? <span><kbd>↑</kbd><kbd>↓</kbd> choose</span> : null}
          <span>
            {argumentCandidates.length > 0
              ? <><kbd>Tab</kbd><kbd>Enter</kbd> complete</>
              : <><kbd>Enter</kbd> run</>}
          </span>
          <span><kbd>Esc</kbd>{state.isCompletionDismissed ? ' close' : ' dismiss'}</span>
        </footer>
      </section>
    </div>,
    document.body
  )
}
