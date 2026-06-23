import { useEffect, useMemo, useState } from 'react'
import {
  formatKeymapTarget,
  formatKeymapTrigger,
  triggerFromKeyboardEvent,
  triggersEqual,
} from '../domain/keymap'
import type {
  InputMode,
  KeymapBinding,
  KeymapResource,
  KeymapTarget,
  KeymapTrigger,
} from '../domain/contracts'
import type { CommandReferenceEntry } from '../shared'

type SettingsOverlayProps = {
  open: boolean
  resource: KeymapResource | null
  commands: CommandReferenceEntry[]
  busy: boolean
  error: string | null
  onClose: () => void
  onSetOverride: (
    context: string,
    trigger: KeymapTrigger,
    target: KeymapTarget,
    originalTrigger?: KeymapTrigger
  ) => Promise<void>
  onDisable: (context: string, trigger: KeymapTrigger) => Promise<void>
  onRestore: (context: string, trigger: KeymapTrigger) => Promise<void>
  onReset: () => Promise<void>
}

type EditorState = {
  context: string
  originalTrigger?: KeymapTrigger
  trigger: KeymapTrigger | null
  targetType: 'command' | 'selection.move' | 'input_mode.set'
  command: string
  direction: 'left' | 'right' | 'up' | 'down'
  amount: number
  mode: InputMode
  whenMode: InputMode | ''
}

const inputModes: InputMode[] = ['pitch', 'velocity', 'delay', 'gate', 'scale']

const editorFromBinding = (context: string, binding?: KeymapBinding): EditorState => {
  const target = binding?.target
  return {
    context,
    originalTrigger: binding?.trigger,
    trigger: binding?.trigger ?? null,
    targetType: target?.type === 'command'
      ? 'command'
      : target?.action ?? 'command',
    command: target?.type === 'command' ? target.command : '',
    direction: target?.type === 'ui_action' && target.action === 'selection.move'
      ? target.arguments.direction
      : 'right',
    amount: target?.type === 'ui_action' && target.action === 'selection.move'
      ? target.arguments.amount
      : 1,
    mode: target?.type === 'ui_action' && target.action === 'input_mode.set'
      ? target.arguments.mode
      : 'pitch',
    whenMode: binding?.trigger.when?.input_mode ?? '',
  }
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
  return {
    type: 'ui_action',
    action: 'input_mode.set',
    arguments: { mode: editor.mode },
  }
}

export function SettingsOverlay({
  open,
  resource,
  commands,
  busy,
  error,
  onClose,
  onSetOverride,
  onDisable,
  onRestore,
  onReset,
}: SettingsOverlayProps) {
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [conflict, setConflict] = useState<KeymapBinding | null>(null)

  const contexts = useMemo(() => {
    if (!resource) return []
    return Array.from(new Set([
      ...Object.keys(resource.bindings),
      ...resource.overrides.map((override) => override.context),
    ])).sort()
  }, [resource])

  const closeOverlay = (): void => {
    setEditor(null)
    setCapturing(false)
    setConflict(null)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || capturing) return
      if (editor) {
        setEditor(null)
        setConflict(null)
      } else {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [capturing, editor, onClose, open])

  if (!open) return null

  const saveEditor = async (replaceConflict = false): Promise<void> => {
    if (!editor?.trigger) return
    const trigger: KeymapTrigger = {
      ...editor.trigger,
      when: editor.whenMode ? { input_mode: editor.whenMode } : undefined,
    }
    const context = editor.context.trim()
    const existing = resource?.bindings[context]?.find((binding) =>
      triggersEqual(binding.trigger, trigger) &&
      (!editor.originalTrigger || !triggersEqual(binding.trigger, editor.originalTrigger))
    )
    if (existing && !replaceConflict) {
      setConflict(existing)
      return
    }
    try {
      await onSetOverride(context, trigger, targetFromEditor(editor), editor.originalTrigger)
      setEditor(null)
      setConflict(null)
    } catch {
      // Mutation errors are rendered by the parent settings surface.
    }
  }

  return (
    <div className="settingsBackdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeOverlay()
    }}>
      <section className="settingsPanel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settingsHeader">
          <div>
            <p className="settingsEyebrow">Preferences</p>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button type="button" className="settingsClose" onClick={closeOverlay} aria-label="Close settings">
            ×
          </button>
        </header>
        <div className="settingsBody">
          <nav className="settingsNav" aria-label="Settings sections">
            <button type="button" className="settingsNavItem settingsNavItem-active">
              <span>Shortcuts</span>
              <small>{resource?.overrides.length ?? 0} custom</small>
            </button>
          </nav>
          <main className="settingsContent">
            <div className="settingsSectionIntro">
              <div>
                <h3>Keyboard shortcuts</h3>
                <p>Bindings are matched by character, modifiers, context, and optional input mode.</p>
              </div>
              <div className="settingsSectionActions">
                <button
                  type="button"
                  className="settingsButton"
                  disabled={!resource || busy}
                  onClick={() => setEditor(editorFromBinding(contexts[0] ?? 'sequence'))}
                >
                  Add shortcut
                </button>
                <button
                  type="button"
                  className="settingsButton settingsButton-danger"
                  disabled={!resource || resource.overrides.length === 0 || busy}
                  onClick={() => void onReset().catch(() => undefined)}
                >
                  Reset all
                </button>
              </div>
            </div>
            {error ? <p className="settingsError" role="alert">{error}</p> : null}
            {!resource ? (
              <p className="settingsEmpty">Waiting for keymap data…</p>
            ) : contexts.map((context) => {
              const bindings = resource.bindings[context] ?? []
              const disabled = resource.overrides.filter((override) =>
                override.context === context && override.target === null
              )
              return (
                <section className="shortcutGroup" key={context}>
                  <div className="shortcutGroupHeader">
                    <h4>{context}</h4>
                    <span>{bindings.length} active</span>
                  </div>
                  <div className="shortcutTable" role="table" aria-label={`${context} shortcuts`}>
                    {bindings.map((binding) => {
                      const override = resource.overrides.find((candidate) =>
                        candidate.context === context &&
                        triggersEqual(candidate.trigger, binding.trigger)
                      )
                      return (
                        <div className="shortcutRow" role="row" key={formatKeymapTrigger(binding.trigger)}>
                          <button
                            type="button"
                            className="shortcutMain"
                            onClick={() => setEditor(editorFromBinding(context, binding))}
                          >
                            <span className="shortcutTrigger mono">{formatKeymapTrigger(binding.trigger)}</span>
                            <span className="shortcutTarget mono">{formatKeymapTarget(binding.target)}</span>
                            <span className={`shortcutOrigin${override ? ' shortcutOrigin-custom' : ''}`}>
                              {override ? 'Custom' : 'Inherited'}
                            </span>
                          </button>
                          <div className="shortcutActions">
                            {override ? (
                              <button type="button" disabled={busy} onClick={() => void onRestore(context, binding.trigger).catch(() => undefined)}>
                                Restore
                              </button>
                            ) : null}
                            <button type="button" disabled={busy} onClick={() => void onDisable(context, binding.trigger).catch(() => undefined)}>
                              Disable
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    {disabled.map((override) => (
                      <div className="shortcutRow shortcutRow-disabled" role="row" key={`disabled-${formatKeymapTrigger(override.trigger)}`}>
                        <div className="shortcutMain">
                          <span className="shortcutTrigger mono">{formatKeymapTrigger(override.trigger)}</span>
                          <span className="shortcutTarget">Disabled</span>
                          <span className="shortcutOrigin">Explicitly disabled</span>
                        </div>
                        <div className="shortcutActions">
                          <button type="button" disabled={busy} onClick={() => void onRestore(context, override.trigger).catch(() => undefined)}>
                            Restore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </main>
        </div>
      </section>

      {editor ? (
        <div className="shortcutEditorBackdrop">
          <section className="shortcutEditor" role="dialog" aria-modal="true" aria-labelledby="shortcut-editor-title">
            <div className="shortcutEditorHeader">
              <div>
                <p className="settingsEyebrow">{editor.originalTrigger ? 'Edit binding' : 'New binding'}</p>
                <h3 id="shortcut-editor-title">Configure shortcut</h3>
              </div>
              <button type="button" className="settingsClose" onClick={() => setEditor(null)} aria-label="Close editor">×</button>
            </div>
            <label className="settingsField">
              <span>Context</span>
              <input
                value={editor.context}
                onChange={(event) => setEditor({ ...editor, context: event.target.value })}
                disabled={editor.originalTrigger !== undefined}
              />
            </label>
            <label className="settingsField">
              <span>Trigger</span>
              <button
                type="button"
                className={`shortcutCapture${capturing ? ' shortcutCapture-active' : ''}`}
                onClick={() => setCapturing(true)}
                onKeyDown={(event) => {
                  if (!capturing) return
                  event.preventDefault()
                  event.stopPropagation()
                  if (event.key === 'Escape') {
                    setCapturing(false)
                    return
                  }
                  const trigger = triggerFromKeyboardEvent(event.nativeEvent)
                  setEditor({ ...editor, trigger })
                  setCapturing(false)
                  setConflict(null)
                }}
              >
                {capturing ? 'Press a shortcut…' : editor.trigger ? formatKeymapTrigger({
                  ...editor.trigger,
                  when: editor.whenMode ? { input_mode: editor.whenMode } : undefined,
                }) : 'Click to record'}
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
            <label className="settingsField">
              <span>Action</span>
              <select value={editor.targetType} onChange={(event) => setEditor({
                ...editor,
                targetType: event.target.value as EditorState['targetType'],
              })}>
                <option value="command">Backend command</option>
                <option value="selection.move">Move selection</option>
                <option value="input_mode.set">Set input mode</option>
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
                    amount: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
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
              <button type="button" className="settingsButton" onClick={() => setEditor(null)}>Cancel</button>
              <button
                type="button"
                className="settingsButton settingsButton-primary"
                disabled={
                  busy ||
                  !editor.context.trim() ||
                  !editor.trigger ||
                  (editor.targetType === 'command' && !editor.command.trim())
                }
                onClick={() => void saveEditor()}
              >
                {busy ? 'Saving…' : 'Save shortcut'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
