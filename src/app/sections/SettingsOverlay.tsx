import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  findKeymapTriggerConflict,
  formatKeymapTarget,
  formatKeymapTrigger,
  triggerFromKeyboardEvent,
} from '../domain/keymap'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { CommandReferenceSection } from './settings/CommandReferenceSection'
import { AppearanceSection } from './settings/AppearanceSection'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { Button } from '../ui/Button'
import { FormField } from '../ui/FormField'
import {
  formatKeymapContext,
  isUiActionAllowedInContext,
  keymapContexts,
  uiActionRegistry,
  type FrontendUiActionId,
} from '../domain/uiActions'
import type {
  InputMode,
  KeymapBinding,
  KeymapResource,
  KeymapTarget,
  KeymapTrigger,
} from '../domain/models'
import type { CommandReferenceEntry } from '../domain/models'
import type { ModTarget } from '../domain/modulation'

type SettingsOverlayProps = {
  open: boolean
  resource: KeymapResource | null
  commands: CommandReferenceEntry[]
  busy: boolean
  error: string | null
  onClose: () => void
  onSetBinding: (
    context: string,
    trigger: KeymapTrigger,
    target: KeymapTarget,
    originalTrigger?: KeymapTrigger,
    repeat?: KeymapBinding['repeat']
  ) => Promise<void>
  onDelete: (context: string, trigger: KeymapTrigger) => Promise<void>
  onReset: () => Promise<void>
}

type EditorState = {
  context: string
  originalTrigger?: KeymapTrigger
  trigger: KeymapTrigger | null
  targetType: 'command' | FrontendUiActionId
  command: string
  direction: 'left' | 'right' | 'up' | 'down'
  amount: number
  mode: InputMode
  modulatorSlot: 1 | 2 | 3 | 4
  modTarget: ModTarget
  whenMode: InputMode | ''
  matchKind: 'key' | 'code'
  repeat: KeymapBinding['repeat']
}

const inputModes: InputMode[] = ['pitch', 'velocity', 'delay', 'gate', 'scale']
const modTargets: ModTarget[] = ['pitch', 'velocity', 'delay', 'gate', 'weights']
const uiActionOptions = Object.values(uiActionRegistry)

const editorFromBinding = (context: string, binding?: KeymapBinding): EditorState => {
  const target = binding?.target
  return {
    context,
    ...(binding ? { originalTrigger: binding.trigger } : {}),
    trigger: binding?.trigger ?? null,
    targetType: target?.type === 'command'
      ? 'command'
      : target?.action ?? 'command',
    command: target?.type === 'command' ? target.command : '',
    direction: target?.type === 'ui_action' &&
      (target.action === 'selection.move' || target.action === 'composition.selection.move')
      ? target.arguments.direction
      : 'right',
    amount: target?.type === 'ui_action' &&
      (target.action === 'selection.move' || target.action === 'composition.selection.move')
      ? target.arguments.amount
      : 1,
    mode: target?.type === 'ui_action' && target.action === 'input_mode.set'
      ? target.arguments.mode
      : 'pitch',
    modulatorSlot: target?.type === 'ui_action' && target.action === 'modulator.slot.select'
      ? target.arguments.slot
      : 1,
    modTarget: target?.type === 'ui_action' && target.action === 'modulator.target.toggle'
      ? target.arguments.target
      : 'pitch',
    whenMode: binding?.trigger.when?.inputMode ?? '',
    matchKind: binding?.trigger.match.kind ?? 'key',
    repeat: binding?.repeat ?? 'ignore',
  }
}

const withInputMode = (trigger: KeymapTrigger, inputMode: InputMode | ''): KeymapTrigger => {
  const baseTrigger = { match: trigger.match, modifiers: trigger.modifiers }
  return inputMode ? { ...baseTrigger, when: { inputMode } } : baseTrigger
}

const targetFromEditor = (editor: EditorState): KeymapTarget => {
  if (editor.targetType === 'command') {
    return { type: 'command', command: editor.command.trim() }
  }
  if (editor.targetType === 'selection.move') {
    return {
      type: 'ui_action',
      action: 'selection.move',
      arguments: { direction: editor.direction, amount: editor.amount },
    }
  }
  if (editor.targetType === 'composition.selection.move') {
    return {
      type: 'ui_action',
      action: 'composition.selection.move',
      arguments: { direction: editor.direction, amount: editor.amount },
    }
  }
  if (editor.targetType === 'input_mode.set') {
    return {
      type: 'ui_action',
      action: 'input_mode.set',
      arguments: { mode: editor.mode },
    }
  }
  if (editor.targetType === 'modulator.slot.select') {
    return {
      type: 'ui_action',
      action: 'modulator.slot.select',
      arguments: { slot: editor.modulatorSlot },
    }
  }
  if (editor.targetType === 'modulator.target.toggle') {
    return {
      type: 'ui_action',
      action: 'modulator.target.toggle',
      arguments: { target: editor.modTarget },
    }
  }
  const action = editor.targetType as Exclude<
    FrontendUiActionId,
    'selection.move' | 'composition.selection.move' | 'input_mode.set' |
    'modulator.slot.select' | 'modulator.target.toggle'
  >
  return {
    type: 'ui_action',
    action,
    arguments: {},
  } as KeymapTarget
}

export function SettingsOverlay({
  open,
  resource,
  commands,
  busy,
  error,
  onClose,
  onSetBinding,
  onDelete,
  onReset,
}: SettingsOverlayProps) {
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [conflict, setConflict] = useState<KeymapBinding | null>(null)
  const [activeSection, setActiveSection] = useState<'appearance' | 'shortcuts' | 'commands'>('shortcuts')
  const settingsPanelRef = useRef<HTMLElement | null>(null)
  const shortcutEditorRef = useRef<HTMLElement | null>(null)
  const shortcutEditorOpenerRef = useRef<HTMLElement | null>(null)
  const captureButtonRef = useRef<HTMLButtonElement | null>(null)

  const contexts = useMemo(() => {
    if (!resource) return []
    return Object.keys(resource.bindings).sort()
  }, [resource])
  const availableUiActionOptions = useMemo(() => editor
    ? uiActionOptions.filter((action) => isUiActionAllowedInContext(action.id, editor.context))
    : uiActionOptions,
  [editor])

  const closeEditor = useCallback((restoreFocus = true): void => {
    setEditor(null)
    setCapturing(false)
    setConflict(null)
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        const opener = shortcutEditorOpenerRef.current
        if (opener?.isConnected) opener.focus()
      })
    }
  }, [])

  const closeOverlay = useCallback((): void => {
    closeEditor(false)
    onClose()
  }, [closeEditor, onClose])

  const openEditor = useCallback((nextEditor: EditorState, opener: HTMLElement): void => {
    shortcutEditorOpenerRef.current = opener
    setConflict(null)
    setCapturing(false)
    setEditor(nextEditor)
  }, [])

  const startCapture = useCallback((): void => {
    setCapturing(true)
    window.requestAnimationFrame(() => captureButtonRef.current?.focus())
  }, [])

  useFocusTrap(open && !editor, settingsPanelRef)
  useFocusTrap(open && editor !== null, shortcutEditorRef)

  useEffect(() => {
    if (!open) return
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (capturing) {
        setCapturing(false)
        return
      }
      if (editor) {
        closeEditor()
      } else {
        closeOverlay()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [capturing, closeEditor, closeOverlay, editor, open])

  if (!open) return null

  const saveEditor = async (replaceConflict = false): Promise<void> => {
    if (!editor?.trigger) return
    const trigger = withInputMode(editor.trigger, editor.whenMode)
    const context = editor.context.trim()
    const existing = findKeymapTriggerConflict(resource, context, trigger, editor.originalTrigger)
    if (existing && !replaceConflict) {
      setConflict(existing)
      return
    }
    try {
      await onSetBinding(
        context,
        trigger,
        targetFromEditor(editor),
        editor.originalTrigger,
        editor.repeat
      )
      closeEditor()
    } catch {
      // Mutation errors are rendered by the parent settings surface.
    }
  }

  return (
    <div className="settingsBackdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeOverlay()
    }}>
      <section
        className="settingsPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        ref={settingsPanelRef}
        tabIndex={-1}
      >
        <header className="settingsHeader">
          <div>
            <p className="settingsEyebrow">Preferences</p>
            <h2 id="settings-title">Settings</h2>
          </div>
          <IconButton className="settingsClose" onClick={closeOverlay} label="Close settings">
            <Icon name="close" />
          </IconButton>
        </header>
        <div className="settingsBody">
          <nav className="settingsNav" aria-label="Settings sections">
            <button
              type="button"
              className={`settingsNavItem${activeSection === 'appearance' ? ' settingsNavItem-active' : ''}`}
              aria-current={activeSection === 'appearance' ? 'page' : undefined}
              onClick={() => setActiveSection('appearance')}
            >
              <span>Appearance</span>
              <small>Theme and layout</small>
            </button>
            <button
              type="button"
              className={`settingsNavItem${activeSection === 'shortcuts' ? ' settingsNavItem-active' : ''}`}
              aria-current={activeSection === 'shortcuts' ? 'page' : undefined}
              onClick={() => setActiveSection('shortcuts')}
            >
              <span>Shortcuts</span>
              <small>{resource?.source === 'stored' ? 'Stored' : 'Defaults'}</small>
            </button>
            <button
              type="button"
              className={`settingsNavItem${activeSection === 'commands' ? ' settingsNavItem-active' : ''}`}
              aria-current={activeSection === 'commands' ? 'page' : undefined}
              onClick={() => setActiveSection('commands')}
            >
              <span>Commands</span>
              <small>{commands.length} available</small>
            </button>
          </nav>
          <main className="settingsContent">
            {activeSection === 'appearance' ? (
              <AppearanceSection />
            ) : activeSection === 'shortcuts' ? (
              <>
                <div className="settingsSectionIntro">
                  <div>
                    <h3>Keyboard shortcuts</h3>
                    <p>Bindings are matched by logical or physical key, modifiers, context, and optional input mode.</p>
                  </div>
                  <div className="settingsSectionActions">
                    <Button
                      size="small"
                      disabled={!resource || busy}
                      onClick={(event) => openEditor(
                        editorFromBinding(contexts[0] ?? 'sequencer'),
                        event.currentTarget
                      )}
                    >
                      Add shortcut
                    </Button>
                    <Button
                      size="small"
                      variant="danger"
                      disabled={!resource || (resource.source === 'default' && !resource.loadError) || busy}
                      onClick={() => void onReset().catch(() => undefined)}
                    >
                      Reset all
                    </Button>
                  </div>
                </div>
                {error ? <p className="settingsError" role="alert">{error}</p> : null}
                {resource?.loadError ? (
                  <p className="settingsError" role="alert">{resource.loadError} Reset or save a shortcut to replace it.</p>
                ) : null}
                {!resource ? (
                  <p className="settingsEmpty">Waiting for keymap data…</p>
                ) : contexts.map((context) => {
                  const bindings = resource.bindings[context] ?? []
                  return (
                    <section className="shortcutGroup" key={context}>
                      <div className="shortcutGroupHeader">
                        <h4>{formatKeymapContext(context)}</h4>
                        <span>{bindings.length} active</span>
                      </div>
                      <div className="shortcutTable" role="table" aria-label={`${context} shortcuts`}>
                        {bindings.map((binding) => {
                          return (
                            <div className="shortcutRow" role="row" key={formatKeymapTrigger(binding.trigger)}>
                              <button
                                type="button"
                                className="shortcutMain"
                                onClick={(event) => openEditor(
                                  editorFromBinding(context, binding),
                                  event.currentTarget
                                )}
                              >
                                <span className="shortcutTrigger mono">{formatKeymapTrigger(binding.trigger)}</span>
                                <span className="shortcutTarget mono">{formatKeymapTarget(binding.target)}</span>
                                <span className="shortcutOrigin">
                                  {binding.repeat === 'allow' ? 'Repeats' : 'Single press'}
                                </span>
                              </button>
                              <div className="shortcutActions">
                                <button type="button" disabled={busy} onClick={() => void onDelete(context, binding.trigger).catch(() => undefined)}>
                                  Delete
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </>
            ) : (
              <CommandReferenceSection commands={commands} />
            )}
          </main>
        </div>
      </section>

      {editor ? (
        <div className="shortcutEditorBackdrop">
          <section
            className="shortcutEditor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcut-editor-title"
            ref={shortcutEditorRef}
            tabIndex={-1}
          >
            <div className="shortcutEditorHeader">
              <div>
                <p className="settingsEyebrow">{editor.originalTrigger ? 'Edit binding' : 'New binding'}</p>
                <h3 id="shortcut-editor-title">Configure shortcut</h3>
              </div>
              <IconButton className="settingsClose" onClick={() => closeEditor()} label="Close editor">
                <Icon name="close" />
              </IconButton>
            </div>
            <FormField className="settingsField" label="Context">
              <select
                value={editor.context}
                onChange={(event) => setEditor({ ...editor, context: event.target.value })}
                disabled={editor.originalTrigger !== undefined}
              >
                {keymapContexts.map((context) => (
                  <option value={context} key={context}>{formatKeymapContext(context)}</option>
                ))}
              </select>
            </FormField>
            <FormField className="settingsField" label="Key matching">
              <select value={editor.matchKind} onChange={(event) => setEditor({
                ...editor,
                matchKind: event.target.value as EditorState['matchKind'],
                trigger: null,
              })}>
                <option value="key">Logical key</option>
                <option value="code">Physical key</option>
              </select>
            </FormField>
            <label className="settingsField">
              <span>Trigger</span>
              <button
                type="button"
                className={`shortcutCapture${capturing ? ' shortcutCapture-active' : ''}`}
                ref={captureButtonRef}
                onClick={startCapture}
                onKeyDown={(event) => {
                  if (!capturing) return
                  event.preventDefault()
                  event.stopPropagation()
                  const trigger = triggerFromKeyboardEvent(event.nativeEvent, editor.matchKind)
                  setEditor({ ...editor, trigger })
                  setCapturing(false)
                  setConflict(null)
                }}
              >
                {capturing
                  ? 'Press a shortcut…'
                  : editor.trigger
                    ? formatKeymapTrigger(withInputMode(editor.trigger, editor.whenMode))
                    : 'Click to record'}
              </button>
            </label>
            <label className="settingsField">
              <span>Only in input mode</span>
              <select value={editor.whenMode} onChange={(event) => setEditor({
                ...editor,
                whenMode: event.target.value as InputMode | '',
              })}>
                <option value="">Any mode</option>
                {inputModes.map((mode) => <option value={mode} key={mode}>{mode}</option>)}
              </select>
            </label>
            <label className="settingsField settingsCheckboxField">
              <input
                type="checkbox"
                checked={editor.repeat === 'allow'}
                onChange={(event) => setEditor({
                  ...editor,
                  repeat: event.target.checked ? 'allow' : 'ignore',
                })}
              />
              <span>Repeat while held</span>
            </label>
            <label className="settingsField">
              <span>Action</span>
              <select value={editor.targetType} onChange={(event) => setEditor({
                ...editor,
                targetType: event.target.value as EditorState['targetType'],
              })}>
                <option value="command">Backend command</option>
                {availableUiActionOptions.map((action) => (
                  <option value={action.id} key={action.id}>{action.label}</option>
                ))}
              </select>
            </label>
            {editor.targetType === 'command' ? (
              <label className="settingsField">
                <span>Command</span>
                <input
                  list="keymap-command-catalog"
                  value={editor.command}
                  onChange={(event) => setEditor({ ...editor, command: event.target.value })}
                  placeholder="Choose or enter a command"
                />
                <datalist id="keymap-command-catalog">
                  {commands.map((command) => <option value={command.id} key={command.id}>{command.description}</option>)}
                </datalist>
              </label>
            ) : null}
            {editor.targetType === 'selection.move' ? (
              <div className="settingsFieldRow">
                <label className="settingsField">
                  <span>Direction</span>
                  <select value={editor.direction} onChange={(event) => setEditor({
                    ...editor,
                    direction: event.target.value as EditorState['direction'],
                  })}>
                    {['left', 'right', 'up', 'down'].map((direction) => (
                      <option value={direction} key={direction}>{direction}</option>
                    ))}
                  </select>
                </label>
                <label className="settingsField">
                  <span>Amount</span>
                  <input type="number" min="1" step="1" value={editor.amount} onChange={(event) => setEditor({
                    ...editor,
                    amount: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                  })} />
                </label>
              </div>
            ) : null}
            {editor.targetType === 'input_mode.set' ? (
              <label className="settingsField">
                <span>Input mode</span>
                <select value={editor.mode} onChange={(event) => setEditor({
                  ...editor,
                  mode: event.target.value as InputMode,
                })}>
                  {inputModes.map((mode) => <option value={mode} key={mode}>{mode}</option>)}
                </select>
              </label>
            ) : null}
            {editor.targetType === 'modulator.slot.select' ? (
              <label className="settingsField">
                <span>Modulator slot</span>
                <select value={editor.modulatorSlot} onChange={(event) => setEditor({
                  ...editor,
                  modulatorSlot: Number(event.target.value) as EditorState['modulatorSlot'],
                })}>
                  {[1, 2, 3, 4].map((slot) => <option value={slot} key={slot}>{slot}</option>)}
                </select>
              </label>
            ) : null}
            {editor.targetType === 'modulator.target.toggle' ? (
              <label className="settingsField">
                <span>Modulator target</span>
                <select value={editor.modTarget} onChange={(event) => setEditor({
                  ...editor,
                  modTarget: event.target.value as ModTarget,
                })}>
                  {modTargets.map((target) => <option value={target} key={target}>{target}</option>)}
                </select>
              </label>
            ) : null}
            {conflict ? (
              <div className="shortcutConflict" role="alert">
                <strong>Shortcut already in use</strong>
                <p>{formatKeymapTrigger(conflict.trigger)} currently runs {formatKeymapTarget(conflict.target)}.</p>
                <div>
                  <button type="button" onClick={() => setConflict(null)}>Cancel</button>
                  <button type="button" className="settingsButton-danger" onClick={() => void saveEditor(true)}>Replace it</button>
                </div>
              </div>
            ) : null}
            <div className="shortcutEditorFooter">
              <Button size="small" onClick={() => closeEditor()}>Cancel</Button>
              <Button
                size="small"
                variant="primary"
                disabled={
                  busy ||
                  !editor.context.trim() ||
                  !editor.trigger ||
                  (editor.targetType !== 'command' &&
                    !isUiActionAllowedInContext(editor.targetType, editor.context)) ||
                  ((editor.targetType === 'selection.move' ||
                    editor.targetType === 'composition.selection.move') && editor.amount < 1) ||
                  (editor.targetType === 'command' && !editor.command.trim())
                }
                onClick={() => void saveEditor()}
              >
                {busy ? 'Saving…' : 'Save shortcut'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
