# Backend Keymap Context Handoff

This note describes the backend work needed for context-aware frontend shortcut
routing. The keymap resource shape remains unchanged:

```ts
bindings: Record<string, KeymapBinding[]>
overrides: KeymapOverride[]
```

No schema-version bump is required unless backend target validation becomes
versioned.

## UI Action Validation

Accept and validate these `ui_action` IDs:

- `selection.move`
- `input_mode.set`
- `command.open`
- `command.cancel`
- `command.submit`
- `command.close_if_empty`
- `command.history.previous`
- `command.history.next`
- `command.completion.accept`
- `command.completion.dismiss`
- `command.completion.previous`
- `command.completion.next`

Command UI actions take no arguments and should be serialized as:

```json
{
  "type": "ui_action",
  "action": "command.submit",
  "arguments": {}
}
```

Keep the existing argument validation for `selection.move` and `input_mode.set`.

## Contexts And Defaults

Compile effective bindings for these contexts:

- `sequence`: existing sequencer defaults, plus `:` bound to `command.open`.
- `command.input`: `Escape`, `Enter`, `ArrowUp`, `ArrowDown`, `Backspace`, and any
  retained command-bar defaults.
- `command.completions`: `Escape`, `Enter`, `Tab`, `ArrowUp`, `ArrowDown`,
  `Ctrl+N`, and `Ctrl+P`.

Suggested command bindings:

- `command.input`
  - `Escape` -> `command.cancel`
  - `Enter` -> `command.submit`
  - `Backspace` -> `command.close_if_empty`
  - `ArrowUp` -> `command.history.previous`
  - `ArrowDown` -> `command.history.next`
- `command.completions`
  - `Escape` -> `command.completion.dismiss`
  - `Enter` -> `command.completion.accept`
  - `Tab` -> `command.completion.accept`
  - `ArrowUp` -> `command.completion.previous`
  - `ArrowDown` -> `command.completion.next`
  - `Ctrl+P` -> `command.completion.previous`
  - `Ctrl+N` -> `command.completion.next`

## Backend Responsibility Boundary

The backend still does not decide the active context and does not execute UI
actions. It only:

- persists user overrides;
- applies compiled defaults;
- validates targets;
- revisions resources;
- publishes effective bindings through `session.hello`, keymap mutation responses,
  and `keymap.changed`.

The frontend chooses `sequence`, `command.input`, or `command.completions` at
keyboard-event time and dispatches UI actions locally.
