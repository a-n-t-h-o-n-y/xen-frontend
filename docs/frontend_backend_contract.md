# Frontend/Backend Contract

This is the current bridge contract between the React frontend and the JUCE/C++
backend. Runtime schemas in `src/app/domain/contracts.ts` are the frontend source of
truth; backend bridge tests are authoritative if docs drift.

## Transport

JUCE exposes:

- `xenBridgeRequest`: native function that receives one JSON-string request and
  resolves to a parsed response envelope.
- `xenBridgeEvent`: native event used for backend-published updates.

All messages use:

```ts
type Envelope = {
  protocol: 'xen.bridge.v1'
  type: 'request' | 'response' | 'event'
  name: string
  request_id?: string
  payload: Record<string, unknown>
}
```

Requests use `type: 'request'`; responses echo `request_id`. Backend errors are
normal response envelopes with:

```ts
type ErrorPayload = {
  error: {
    code: string
    message: string
  }
}
```

## Session Startup

Start with `session.hello`:

```ts
type SessionHelloRequest = {
  protocol: 'xen.bridge.v1'
  frontend_app: string
  frontend_version: string
}

type SessionHello = {
  protocol: 'xen.bridge.v1'
  plugin_version: string
  project_schema_version: 1
  library_schema_version: 1
  catalog: Catalog
  keymap: KeymapResource
}
```

After hello, request `state.get` and `library.get`. Do not wait for initial change
events; the backend emits events only after revisions change.

## Project State

`state.get`, `state.changed`, and `command.execute` responses all use project schema
`1`:

```ts
type ProjectSnapshot = {
  schema_version: 1
  history_entry_id: number
  project_revision: number
  project: {
    measure: {
      cell: Cell
      time_signature: { numerator: number; denominator: number }
    }
    pitch: {
      tuning: {
        name: string
        definition: { intervals: number[]; octave: number }
      }
      scale: { source_id: string | null; definition: ScaleDefinition } | null
      transposition: number
      translation_direction: 'up' | 'down'
      base_frequency: number
    }
  }
}
```

The frontend owns selection, input mode, focus, panels, command text, zoom, and scroll
state. Snapshots must not overwrite that state.

Use `project_revision` for freshness. `history_entry_id` identifies the history entry
and can remain unchanged when `project_revision` advances. Ignore older project
revisions and treat equal revisions as duplicates.

Selection is submitted with commands and reconciled locally:

```ts
type Selection = {
  path: Array<
    | { kind: 'element'; index: number }
    | { kind: 'cell'; index: number }
  >
}
```

The root cell is `path: []`. Path steps alternate `element`, then `cell`, then repeat.

## Command Execution

All backend commands use `command.execute`:

```ts
type CommandExecuteRequest = {
  command: string
  context: {
    expected_project_revision: number
    selection: Selection
    active_measure_target: {
      row_index: number
      column_index: number
      measure_id: number
    } | null
  }
}

type CommandExecuteResponse = {
  status: {
    level: 'debug' | 'info' | 'warning' | 'error'
    message: string
  }
  suggested_selection: Selection | null
  snapshot: ProjectSnapshot
}
```

The frontend sends the current project revision and reconciled selection with every
command. Always ingest the response snapshot through the normal project-ingestion
path. If `suggested_selection` is non-null and resolves after the snapshot installs,
adopt it; otherwise keep the current selection if it still resolves.

The command catalog comes from `session.hello.payload.catalog`:

```ts
type Catalog = {
  schema_version: 2
  commands: Array<{
    path: string[]
    keywords: string[]
    accepts_pattern_prefix: boolean
    target_requirement: 'none' | 'cell' | 'element' | 'cell_or_element'
    arguments: Array<{
      kind: string
      display_name: string
      required: boolean
      default_value: string | null
      constraints: Array<{
        kind: string
        minimum: number | null
        maximum: number | null
        values: string[]
      }>
    }>
    description: string
  }>
}
```

Completion is frontend-local from the cached catalog. Final command text is submitted
to the backend parser.

## Library State

`library.get` and `library.changed` use library schema `1`:

```ts
type LibrarySnapshot = {
  schema_version: 1
  library_revision: number
  paths: {
    library: string
    sequences: string
    tunings: string
  }
  measures: LibraryCommandEntry[]
  tunings: Array<LibraryCommandEntry & {
    description: string
    intervals: number[]
    octave: number
    note_count: number
  }>
  scales: Array<
    | {
        id: 'chromatic'
        name: 'chromatic'
        definition: null
        intervals: []
        command: string
      }
    | {
        id: string
        definition: ScaleDefinition
        command: string
      }
  >
  chords: Array<{ name: string; intervals: number[]; command: string }>
  commands: {
    reload_scales: string
    reload_chords: string
    library_directory: string
  }
}

type LibraryCommandEntry = {
  name: string
  relative_path: string
  stem: string
  path: string
  command: string
}
```

Project and library revisions are independent. Active tuning and scale live in the
project snapshot, not the library snapshot.

The frontend aggregates measures, tunings, and scales into Quick Access. Measures
currently appear in its Files scope; chords remain cached as command-argument data
and are not standalone Quick Access actions. This is presentation behavior and does
not add a bridge endpoint.

## Keymap

The backend owns default bindings, persisted overrides, validation, revisioning, and
publication. The frontend owns browser event matching, context selection, UI-action
dispatch, and the shortcut settings UI. The frontend must not write the keymap file
directly.

Key triggers use `KeyboardEvent.key`, not `KeyboardEvent.code`. The `command`
modifier means `metaKey` on macOS and `ctrlKey` on Windows/Linux. Normalize single
ASCII letters to lowercase; preserve other key values exactly.

`session.hello.payload.keymap`, `keymap.get`, keymap mutation responses, and
`keymap.changed` all use:

```ts
type KeymapResource = {
  schema_version: 1
  revision: number
  key_semantics: 'KeyboardEvent.key'
  bindings: Record<string, KeymapBinding[]>
  overrides: KeymapOverride[]
}

type KeymapTrigger = {
  key: string
  modifiers: {
    shift: boolean
    command: boolean
    alt: boolean
  }
  when?: {
    input_mode: 'pitch' | 'velocity' | 'delay' | 'gate' | 'scale'
  }
}

type KeymapTarget =
  | { type: 'command'; command: string }
  | { type: 'ui_action'; action: UiActionId; arguments: Record<string, unknown> }

type KeymapBinding = {
  trigger: KeymapTrigger
  target: KeymapTarget
}

type KeymapOverride = {
  context: string
  trigger: KeymapTrigger
  target: KeymapTarget | null
}
```

Current frontend contexts:

- `sequence`: sequencer/default editing shortcuts.
- `command.input`: Quick Access command input focused without active completions.
- `command.completions`: Quick Access command input focused with completions active.

The `command.*` identifiers are retained for wire compatibility even though the
status-bar command surface has been replaced by Quick Access.

Current UI actions:

- `selection.move`
- `input_mode.set`
- `workspace.view.toggle`
- `modulator.mode.toggle`
- `modulator.slot.select`
- `modulator.target.toggle`
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

Command targets are sent to `command.execute`. UI actions are handled locally and
must not be sent to the backend command parser.

Keymap mutation requests:

```ts
type KeymapOverrideSetRequest = {
  expected_revision: number
  context: string
  trigger: KeymapTrigger
  target: KeymapTarget | null
}

type KeymapOverrideRemoveRequest = {
  expected_revision: number
  context: string
  trigger: KeymapTrigger
}

type KeymapResetRequest = {
  expected_revision: number
}
```

All mutation responses return the complete updated `KeymapResource`.

## Events

All events arrive through `xenBridgeEvent`:

```ts
type BridgeEvent =
  | Envelope & { name: 'state.changed'; payload: ProjectSnapshot }
  | Envelope & { name: 'library.changed'; payload: LibrarySnapshot }
  | Envelope & { name: 'keymap.changed'; payload: KeymapResource }
  | Envelope & {
      name: 'transport.phase.sync'
      payload: { bpm: number; phase: number }
    }
  | Envelope & { name: 'transport.stopped'; payload: {} }
```

Transport events are transient animation state and do not participate in project,
library, or keymap revisioning.
