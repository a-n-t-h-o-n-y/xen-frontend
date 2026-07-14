# Frontend/Backend Contract

This document describes the breaking document-service contract consumed by this
frontend. There are no compatibility aliases or mixed old/new payloads.

## Versions

- WebView bridge: `xen.bridge.v6`
- coordinator IPC: `xen.ipc.v3`
- project snapshot schema: `6`
- library schema: `2`
- command catalog schema: `4`

Revision and history values crossing the WebView boundary are decimal strings. Do
not coerce them to JavaScript numbers; they can exceed the safe integer range.

## User document formats

| Extension | Purpose | Serialized identity |
| --- | --- | --- |
| `.xencell` | Reusable recursive cell/sequence asset | `kind: "xen_cell"`, schema `1` |
| `.xenproj` | Complete authoritative project | `kind: "xen_project"`, schema `1` |

Processor state and autosave recovery are internal persistence payloads. The
frontend must not discover or accept `.xencomp`, `xen_composition`, or composition
serializer aliases.

All document paths are nested, content-directory-relative paths and include the
exact `.xenproj` or `.xencell` extension. Absolute paths are not exposed.

## Transport

JUCE exposes the `xenBridgeRequest` native function and the `xenBridgeEvent` native
event. Messages use this envelope:

```ts
type Envelope = {
  protocol: "xen.bridge.v6";
  type: "request" | "response" | "event";
  name: string;
  request_id?: string;
  payload: Record<string, unknown>;
};
```

Error responses are normal response envelopes:

```ts
type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
```

Document operations can return `stale_project`, `unsaved_changes`, `invalid_path`,
`not_found`, `file_exists`, `file_conflict`, `project_path_required`,
`file_too_large`, `invalid_document`, `preview_active`, `recovery_conflict`, and
`io_error`. Existing bridge, keymap, and preferences errors remain valid.

For `file_exists`, `details.file_revision` is the optimistic-concurrency token for a
confirmed retry.

## Session startup

`session.hello` validates bridge, project, library, and catalog versions and returns
the immutable command catalog plus revisioned keymap and preferences resources.
After hello succeeds, request `state.get` and `library.get` concurrently. Do not wait
for change events for the initial state.

```ts
type SessionHello = {
  protocol: "xen.bridge.v6";
  plugin_version: string;
  project_schema_version: 6;
  library_schema_version: 2;
  catalog: {
    schema_version: 4;
    commands: CatalogCommand[];
  };
  keymap: { revision: string; document: unknown | null };
  preferences: { revision: string; document: Record<string, unknown> | null };
};
```

## Project snapshot

`state.get`, `state.changed`, command responses, preview responses, and document
responses publish the same snapshot shape:

```ts
type FileRevision = string; // "sha256:<hex>", opaque to the frontend

type ProjectSnapshot = {
  schema_version: 6;
  state_revision: string;
  project_revision: string;
  history_entry_id: string;
  preview_active: boolean;
  document: {
    relative_path: string | null;
    display_name: string;
    dirty: boolean;
    file_revision: FileRevision | null;
  };
  recovery: null | {
    revision: string;
    saved_at_unix_ms: string;
    relative_path: string | null;
    project_revision: string;
  };
  project: Project;
};
```

`state_revision` determines snapshot freshness. It advances for saves, recovery
changes, preview transitions, and content changes. `project_revision` is the
optimistic-concurrency token for project content operations. `history_entry_id`
identifies the undo/redo entry.

The coordinator owns document path, clean baseline, dirty state, file revision,
recovery candidate, and all revisions. Frontends display this state and must not
maintain competing lifecycle state.

The nested `Project` retains the sequence bank, sparse composition arrangement,
timing, tuning, scales, channels, and loop contract from the previous project
resource. Selection and input mode remain frontend-owned.

## Library snapshot

```ts
type ContentFile = {
  name: string;
  relative_path: string;
  stem: string;
  file_revision: FileRevision;
};

type LibrarySnapshot = {
  schema_version: 2;
  library_revision: string;
  cells: ContentFile[];
  projects: ContentFile[];
  tunings: TuningEntry[];
  scales: ScaleEntry[];
  chords: ChordEntry[];
  commands: LibraryCommands;
};
```

The library discovers only `.xencell` cells and `.xenproj` projects. It exposes
`projects`, not `compositions`, publishes no absolute paths, and includes file
revision tokens. File palette activation uses the dedicated document requests below,
not stored command strings.

`library_revision` is an independent decimal-string freshness domain. Continue to
consume `library.changed` events.

## Dedicated document requests

Every success payload includes the newly published project snapshot.

| Request | Required payload | Success payload |
| --- | --- | --- |
| `project.new` | `expected_project_revision`, `discard_unsaved` | `{ snapshot }` |
| `project.open` | `relative_path`, `expected_project_revision`, `discard_unsaved` | `{ snapshot }` |
| `project.save` | `expected_project_revision` | `{ snapshot, file }` |
| `project.save_as` | `relative_path`, `expected_project_revision`, `expected_file_revision` | `{ snapshot, file }` |
| `project.recovery.restore` | `recovery_revision`, `expected_project_revision`, `discard_unsaved` | `{ snapshot }` |
| `project.recovery.discard` | `recovery_revision` | `{ snapshot }` |
| `cell.import` | `relative_path`, `expected_project_revision`, `cursor` | `{ snapshot, suggested_selection }` |
| `cell.save` | `relative_path`, `expected_project_revision`, `cursor`, `selection`, `expected_file_revision` | `{ snapshot, file }` |

`project.save` uses the coordinator-owned current path and tracked file revision. It
returns `project_path_required` for an unnamed project, after which the frontend can
collect a relative `.xenproj` path and call `project.save_as`.

For Save As and cell save, `expected_file_revision: null` means create only. If the
target exists, the backend returns `file_exists` with its current revision. After
explicit user confirmation, retry with that exact revision. If the file changes
between prompt and retry, the backend returns `file_conflict`.

New, open, and recovery restore first use `discard_unsaved: false`. On
`unsaved_changes`, an explicit confirmation may retry with `true`. The retry must
retain the project revision captured before the prompt so edits made while the prompt
was visible cannot be silently discarded.

Document requests are rejected while a preview is active. The frontend also disables
its document controls during preview as immediate feedback.

## Command and preview requests

`command.execute`, `preview.begin`, `preview.commit`, and `preview.cancel` send
`expected_project_revision` as a decimal string. Command cursor and selection remain:

```ts
type CommandContext = {
  expected_project_revision: string;
  preview_id?: string;
  selection: Selection;
  cursor: {
    row_coordinate: number;
    column_coordinate: number;
    sequence_id: number | null;
  };
};
```

The command-line surface still supports `project new`, `project open
<relative-path.xenproj>`, `project save`, `project save as
<relative-path.xenproj>`, `load cell <relative-path.xencell>`, and `save cell
<relative-path.xencell>`. Those commands route through the same document service and
never discard dirty work or overwrite a file without the frontend confirmation API.

## Events

Continue consuming:

- `state.changed` with a schema-6 project snapshot;
- `library.changed` with a schema-2 library snapshot;
- `keymap.changed` and `preferences.changed` resources;
- transport synchronization events.

The native host tracks `state_revision`, not only project content revision, so every
frontend instance receives save, recovery, and preview lifecycle changes.
