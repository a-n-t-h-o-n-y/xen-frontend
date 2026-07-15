# Modulation Frontend Specification

This is the implementation contract for the redesigned backend modulation system. It
targets `xen.bridge.v7`, command catalog schema 5, and modulation schema 1. The old
command-string JSON modulator format is removed; there is no compatibility path.

## Design boundary

Modulation is an edit gesture, not persisted project state. The frontend sends a full
modulation definition during a preview, and the backend materializes ordinary scalar
pitch, velocity, delay, gate, or weight values into the project. Commit creates at most
one undo entry. Cancel restores the exact baseline. DAW persistence and recovery never
store transient preview state.

Changing the destination or enabling modulation starts no edit by itself. The frontend
should begin and update a preview only when waveform parameters, enabled waveforms, the
combination operation, or the output range are edited.

## Discovery

`session.hello.payload.modulation` is authoritative:

```ts
type ModulationCatalog = {
  schema_version: 1;
  maximum_waveforms: 64;
  waveform_shapes: Array<
    "sine" | "triangle" | "sawtooth_up" | "sawtooth_down" | "square"
  >;
  waveform_parameters: {
    frequency: { minimum: 0; maximum: 1 };
    phase: { minimum: 0; maximum: 1 };
    amplitude: { minimum: -1; maximum: 1 };
    amplitude_offset: { minimum: -1; maximum: 1 };
  };
  operations: Array<{
    id: "average" | "sum" | "product" | "am" | "ring" | "fm" | "pm";
    minimum_enabled_waveforms?: 1;
    enabled_waveforms?: 2;
    roles?: ["carrier", "modulator"];
  }>;
  destinations: Array<{
    id: "pitch" | "velocity" | "delay" | "gate" | "weight";
    range: "integer" | "unit" | "positive";
    quantization?: "nearest";
  }>;
  normalization: "clamp((raw + 1) / 2, 0, 1)";
};
```

Do not hard-code future operation or shape availability when the catalog can drive the
UI. Schema 1 nevertheless has the exact validation and math below.

## Frontend interaction requirements

Use one destination control and one modulation editor; do not create a separate
modulator control for each destination. Only one destination is active at a time.
Changing the active input mode or destination must not apply modulation. A waveform or
combination edit is what begins/updates the gesture.

The editor should support these behaviors:

- Add and remove waveform rows and choose each row's shape from a dropdown populated by
  the catalog. Exactly one waveform is selected for direct editing at a time.
- Enable/disable rows without deleting their parameters. Show an explicit combination
  operation control populated by the catalog.
- Draw every enabled waveform and the combined result in the same plot. Make the
  selected waveform and combined result more prominent than unselected waveforms.
- Replace the old on-canvas handle with plot-wide mouse editing. A normal left drag
  edits frequency on x and amplitude on y; y maps bottom/middle/top to `-1/0/+1`.
  Treat x as a grab-relative frequency change so the waveform does not jump on pointer
  down. Shift+left drag edits phase on x and amplitude offset on y, with the same
  bipolar y mapping.
- Show selected-waveform values for frequency, phase, amplitude, and amplitude offset.
  Display ranges are `0..1`, `0..1`, `-1..1`, and `-1..1` respectively.
- Add Weight as an input mode. Use `W` as its default key only when that key is not
  already assigned. Up/down issue additive `shift weight` changes of `+0.1/-0.1` unless
  the user's keymap supplies a different command. Weight edits follow the selected
  Cell/immediate-parent semantics described below.

## Data model

```ts
type Waveform = {
  enabled: boolean;
  shape: "sine" | "triangle" | "sawtooth_up" | "sawtooth_down" | "square";
  frequency: number;        // inclusive [0, 1]
  phase: number;            // inclusive [0, 1]
  amplitude: number;        // inclusive [-1, 1]
  amplitude_offset: number; // inclusive [-1, 1]
};

type Modulation = {
  operation: "average" | "sum" | "product" | "am" | "ring" | "fm" | "pm";
  waveforms: Waveform[]; // 1..64 total entries
};

type Destination = "pitch" | "velocity" | "delay" | "gate" | "weight";

type OutputRange = { minimum: number; maximum: number };

type Pattern = {
  offset: number;      // non-negative integer
  intervals: number[]; // non-empty positive integers
};

type ModulationTarget = {
  cursor: {
    row_coordinate: number;
    column_coordinate: number;
    sequence_id: number | null;
  };
  selection: {
    path: Array<
      | { kind: "element"; index: number }
      | { kind: "cell"; index: number }
    >;
  };
  pattern: Pattern;
};
```

All numbers must be finite. Reducers (`average`, `sum`, `product`) require at least one
enabled waveform. Binary operations (`am`, `ring`, `fm`, `pm`) require exactly two
enabled waveforms. Disabled entries are retained in the array but ignored. For binary
operations, the first enabled waveform is the carrier and the second is the modulator.

Output ranges are inclusive and require `minimum <= maximum`:

- `pitch`: integer endpoints representable by a C++ `int`; each output is rounded to
  the nearest integer, with exact half-way values rounded away from zero.
- `velocity`, `delay`, `gate`: both endpoints must be in `[0, 1]`.
- `weight`: both endpoints must fit in a positive 32-bit float.

Recommended initial ranges are `[0, tuning.intervals.length - 1]` for pitch,
`[0.1, 2]` for weight, and `[0, 1]` for velocity, delay, and gate.

## Target semantics

The target is captured by `begin` and is fixed for the whole gesture.

- If selection resolves to a `Sequence` element, modulation applies to that Sequence's
  child cells.
- If selection resolves to a Cell, modulation applies independently to every Sequence
  directly contained by that Cell. It does not search arbitrary descendants.
- The pattern filters child-cell indexes. A request selecting no child cells is rejected.
- Each Sequence is sampled independently across its own child-cell count.
- Pitch, velocity, delay, and gate update musical content in each selected child Cell.
  Weight updates the selected child Cell's weight.

The ordinary scalar commands are separate from this API. `set weight` and
`shift weight` affect a selected Cell, or the immediate parent Cell when a musical
element is selected. `shift weight` is additive, defaults to `0.1`, and rejects results
that are not strictly positive.

## Preview requests

All revision and sequence counters crossing the WebView boundary are decimal strings.
Treat them as `BigInt`; never round-trip them through JavaScript `number`.

### Begin

Request name: `modulation.preview.begin`

```ts
type BeginRequest = {
  expected_project_revision: string;
  target: ModulationTarget;
};

type BeginResponse = {
  status: { level: string; message: string };
  preview_id: string | null;
  snapshot: ProjectSnapshot;
};
```

Only one project preview exists across all plugin instances. A begin fails when another
preview is active, recovery is pending, the revision is stale, or the target is invalid.
Keep the returned non-null `preview_id`, and ingest the returned snapshot.

### Update

Request name: `modulation.preview.update`

```ts
type UpdateRequest = {
  preview_id: string;
  update_sequence: string;
  expected_project_revision: string;
  destination: Destination;
  output_range: OutputRange;
  modulation: Modulation;
};

type UpdateResponse = {
  status: { level: string; message: string };
  preview_id: string;
  accepted_update_sequence: string;
  accepted: boolean;
  project_changed: boolean;
  project_revision: string;
  state_revision: string;
  // No snapshot field.
};
```

Start `update_sequence` at `1` and increment it for every attempted new definition.
Updates are evaluated against the preview's original baseline, so a newer definition
replaces the preceding staged result instead of accumulating on it. An update sequence
less than or equal to the last accepted value is an idempotent, non-error superseded
acknowledgement with `accepted: false`.

Use `project_revision` from an accepted acknowledgement as the
`expected_project_revision` for the next update. A new update with a stale revision is
rejected. The backend serializes IPC requests, but the frontend should still keep at
most one update in flight. While one is in flight, overwrite a single pending slot with
the newest full definition. Send that pending definition immediately after the ack.
This bounds queue growth during mouse drags and makes intermediate states disposable.

An accepted update does not include a project snapshot. The shared coordinator retains
only its latest resulting snapshot and emits `state.changed` on its maintenance pass,
approximately every 40 ms. Continue to order those snapshots by `state_revision`.
`project_changed: false` means the accepted definition produced the already-staged
project; no event is required.

### Commit and cancel

Request names: `modulation.preview.commit` and `modulation.preview.cancel`.

```ts
type EndRequest = {
  preview_id: string;
  expected_project_revision: string;
};

type EndResponse = {
  status: { level: string; message: string };
  snapshot: ProjectSnapshot;
};
```

Wait until the last update acknowledgement before ending the gesture. Use its
`project_revision`, or the latest snapshot revision if there was no accepted update.
Commit materializes the staged values and creates at most one history entry. Cancel
restores the baseline. Both return and immediately publish the final full snapshot.
If the owning plugin instance disconnects, the backend cancels its preview.

## Evaluation rules

For child-cell index `i` in a Sequence of `N` cells, `x = i / N`. Shapes are periodic
over phase `[0, 1)`. A waveform's raw value is:

```text
amplitude_offset + amplitude * shape(frequency * x + phase)
```

The shape range is bipolar `[-1, 1]`. Average, sum, and product combine every enabled
raw waveform. AM is `carrier * clamp((modulator + 1) / 2, 0, 1)`. Ring is
`carrier * modulator`. PM adds the modulator raw value to the carrier phase. FM samples
the modulator at each child and integrates instantaneous carrier frequency across the
Sequence; unlike PM, it carries phase forward from one sample to the next.

After combination, the backend converts bipolar output to an amount:

```text
amount = clamp((raw + 1) / 2, 0, 1)
value = minimum + amount * (maximum - minimum)
```

The backend uses fixed 1024-sample shape tables with linear interpolation (square is
sampled directly). The frontend visualization should mirror the formulas for responsive
display, but the materialized backend result is authoritative.

## Error and gesture handling

- On a validation error, keep the preview active and retain the last accepted staged
  project. Show the backend status message and allow a corrected update.
- On stale revision or ownership failure, stop sending updates and resynchronize from
  `state.get`; cancel only if this client still owns the preview.
- On component unmount, modal dismissal, Escape, or abandoned pointer interaction,
  cancel after any in-flight update finishes.
- Do not use generic `preview.*` or `command.execute` to send modulation. Generic
  preview commands are explicitly rejected during a modulation preview.
