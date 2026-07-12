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
  protocol: 'xen.bridge.v4'
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
  protocol: 'xen.bridge.v4'
  frontend_app: string
  frontend_version: string
}

type SessionHello = {
  protocol: 'xen.bridge.v4'
  plugin_version: string
  project_schema_version: 4
  library_schema_version: 1
  catalog: Catalog
  keymap: KeymapResource
}
```

After hello, request `state.get` and `library.get`. Do not wait for initial change
events; the backend emits events only after revisions change.

## Project State

`state.get`, `state.changed`, and `command.execute` responses all use project schema
`4`:

```ts
type ProjectSnapshot = {
  schema_version: 4
  history_entry_id: number
  project_revision: number
  preview_active: boolean
  project: {
    sequence_bank: { next_id: number; sequences: SequenceEntry[] }
    composition: {
      columns: CompositionColumn[]
      rows: CompositionRow[]
      loop_region?: { start_column: number; end_column: number }
    }
  }
}
```

The frontend owns selection, input mode, focus, panels, command text, zoom, and scroll
state. Snapshots must not overwrite that state.

Use `project_revision` for freshness. `history_entry_id` identifies the history entry
and can remain unchanged when `project_revision` advances. Ignore older project
revisions. Equal revisions are duplicates unless `preview_active` changed; preview
begin/end can change that flag without changing project content.

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
    preview_id?: string
    selection: Selection
    cursor: {
      row_index: number
      column_index: number
      sequence_id: number | null
    }
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

## Preview Transactions

Continuous edits use a globally visible staged transaction:

```ts
preview.begin({ expected_project_revision })
// => { status, preview_id: string | null, snapshot }

command.execute({
  command,
  context: { expected_project_revision, preview_id, selection, cursor },
})

preview.commit({ preview_id, expected_project_revision })
preview.cancel({ preview_id, expected_project_revision })
// => { status, snapshot }
```

Ingest every response snapshot before forming the next request. Serialize updates and
queue commit/cancel behind them. Pending absolute commands may be replaced with their
latest value; relative commands remain ordered and accumulate. A failed begin has a
null `preview_id`. Error-level statuses are application failures even when the bridge
envelope itself is valid.

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
    content: string
    tunings: string
  }
  cells: LibraryCommandEntry[]
  compositions: LibraryCommandEntry[]
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

The frontend presents cell documents as reusable sequences and aggregates them with
composition documents, tunings, and scales in Quick Access. Sequence and composition
documents currently appear in its Files scope; chords remain cached as command-argument
data and are not standalone Quick Access actions. This is presentation behavior and
does not add a bridge endpoint.

## Keymap

The backend treats the keymap document as opaque JSON and owns filesystem access,
atomic persistence, content-derived revisions, concurrency checks, and publication.
The frontend owns default bindings, schema validation, browser event matching,
context selection, action dispatch, and editing. Invalid or unsupported documents
are ignored in favor of built-in defaults until the user resets or replaces them.

Key triggers may use logical `KeyboardEvent.key` or physical `KeyboardEvent.code`.
The `primary` modifier means `metaKey` on macOS and `ctrlKey` on Windows/Linux;
physical Control and Meta remain independently representable. Normalize single
ASCII logical letters to lowercase; preserve other values exactly.

`session.hello.payload.keymap`, keymap storage responses, and
`keymap.changed` all use:

```ts
type KeymapResource = {
  revision: string
  document: unknown | null
}

type KeymapDocument = {
  schema_version: 2
  bindings: Record<string, KeymapBinding[]>
}

type KeymapTrigger = {
  match: {
    kind: 'key' | 'code'
    value: string
  }
  modifiers: {
    shift: boolean
    alt: boolean
    primary: boolean
    control: boolean
    meta: boolean
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
  repeat?: 'allow' | 'ignore'
}
```

Current frontend contexts:

- `sequencer`: sequencer/default editing shortcuts.
- `composition`: composition editing shortcuts.
- `quick_access.browse`: Quick Access resource browsing.
- `quick_access.command`: Quick Access command input without active completions.
- `quick_access.completions`: Quick Access command input with completions active.

Keymap schema v1 is intentionally unsupported and is not migrated.

Current UI actions:

- `selection.move`
- `input_mode.set`
- `workspace.view.toggle`
- `edit.copy`
- `edit.cut`
- `edit.paste`
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

The storage API is:

```ts
keymap.read({})

keymap.write({
  expected_revision: string
  document: unknown
})

keymap.delete({
  expected_revision: string
})
```

All responses return the complete storage `KeymapResource`. A missing or deleted
file has `document: null`. Revisions are opaque decimal strings that may exceed
JavaScript's safe integer range. They are content identities, not ordered counters;
clients preserve them unchanged and install resources whose revision differs from the current one.
The frontend writes complete documents and preserves unknown document fields.

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
