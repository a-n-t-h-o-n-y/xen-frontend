# Composition UI Design

This document describes the intended composition workspace: a matrix for arranging
named measures across time and output rows, paired with the existing sequencer for
editing the selected measure. It expands the current arrangement handoff into a
usable UI model and calls out likely frontend/backend contract changes.

## Core Model

The app has two primary musical workspaces:

- `sequencer`: edits the contents of one measure.
- `composition`: arranges measure references across rows and columns.

Only one is active at a time. The composition matrix decides which measure the
sequencer edits. The sequencer does not show the measure bank as a separate panel;
the bank is inferred from the measure names used in the matrix.

The matrix starts with:

- one row,
- one column,
- one cell containing a default measure reference,
- one output assignment for the row.

Columns represent musical time. Rows represent routed lanes. Cells contain measure
references or rests.

## Workspace Switching

`Enter` on a populated or editable composition cell should switch to the sequencer
and make that cell's measure the active sequencer target. A dedicated key action
returns to the composition matrix.

Initial bindings can be conservative:

- `Enter`: edit selected matrix cell in sequencer.
- `Escape`: return from sequencer to composition when the sequencer was opened from
  the matrix.
- A visible segmented workspace control or two buttons: `Composition` and
  `Sequencer`.

These must be custom keymap actions, not hard-coded keyboard behavior. The current
keymap system already supports UI actions, but it only has sequence-oriented
selection and a binary workspace toggle. Composition needs its own keymap context
and action IDs.

Suggested UI actions:

```ts
type CompositionUiAction =
  | 'workspace.view.composition'
  | 'workspace.view.sequencer'
  | 'composition.selection.move'
  | 'composition.cell.edit_measure'
  | 'composition.cell.rename_or_create_measure'
  | 'composition.cell.clear'
  | 'composition.row.insert_before'
  | 'composition.row.insert_after'
  | 'composition.row.delete'
  | 'composition.column.insert_before'
  | 'composition.column.insert_after'
  | 'composition.column.delete'
```

`hjkl` and arrow keys should both be possible defaults for matrix navigation, but
they should be ordinary keymap bindings in a `composition` context.

## Matrix Layout

The composition matrix has a fixed metadata row at the top and one or more
arrangement rows below it.

Suggested columns:

- Row header: row name and output destination.
- Time columns: one visual column per composition column.

The top metadata row displays each column's length as a time signature, such as
`4/4`, `7/8`, or `5/16`. A column's visual width is proportional to its musical
length so longer spans read as longer time. Use a minimum width so short columns
remain selectable and labels fit.

Column width rule:

```ts
columnBeats = numerator * (4 / denominator)
columnWidth = max(minColumnWidth, columnBeats * beatWidth)
```

The row header should remain visible when horizontally scrolling. The metadata row
should remain visible when vertically scrolling. If both axes scroll, the top-left
corner cell remains pinned.

## Selection

The matrix owns its own selection state:

```ts
type CompositionSelection = {
  rowIndex: number
  columnIndex: number
}
```

Selection visuals:

- selected cell: strongest highlight,
- selected row: light horizontal highlight,
- selected column: light vertical highlight,
- selected metadata cell: active when editing column length,
- selected row header: active when editing row output or row name.

The row and column highlight should be quiet enough to preserve matrix readability.
The selected cell should be clearly visible without using a heavy border that shifts
layout.

## Cell Display

Each arrangement cell displays the measure name. If the backend only has numeric
measure IDs, the frontend can temporarily show a generated label like `M1`, but the
intended design needs stable measure names.

Suggested cell states:

- named measure reference: show the measure name.
- empty rest: show a muted placeholder or blank cell.
- unresolved reference: show the requested name in an error state.
- shared reference: optional small indicator if the same measure appears elsewhere.

The measure bank remains implicit:

- Typing a new measure name into an empty cell creates a measure bank entry and
  assigns it to the cell.
- Typing the name of an existing measure assigns that existing measure.
- Renaming a measure should update every cell that references it.
- Duplicating a measure should create a new measure with copied content and a new
  name, then assign that duplicate where requested.

This implies the matrix editor needs to distinguish "rename this measure" from
"assign a different measure by name". A practical first pass:

- inline editing an empty cell creates or assigns by name,
- inline editing a populated cell changes that cell assignment by name,
- a command handles global measure rename.

## Row Behavior

Rows represent arrangement lanes. Each row has:

- a display name,
- an output destination,
- one cell per column.

The current backend model stores `output_id` but does not appear to store row names.
Row names are useful for navigation, status display, and accessibility. Add row
metadata if the product should support user-visible track names.

Suggested default row names:

- `Row 1`, `Row 2`, etc. if names are persisted.
- output name as the fallback label if no row name exists.

Output selection should be available from the row header. The first implementation
can use a compact select/menu populated by backend-known output IDs. Until multiple
plugin instance IDs exist, show `current` as the only option.

Row operations:

- insert before selected row,
- insert after selected row,
- delete selected row,
- move row up/down,
- assign output,
- rename row.

Deleting a row removes only arrangement references. It must not delete measures from
the bank unless a later explicit cleanup command is added.

## Column Behavior

Columns represent shared time slots across all rows. Each column has:

- a length,
- one cell per row.

Column operations:

- insert before selected column,
- insert after selected column,
- delete selected column,
- move column left/right,
- edit length.

Insertion should be first-class, not append-only. When inserting a column, every row
gets a new empty cell at the inserted index. A default length of `4/4` is reasonable,
or copy the selected column's length for faster composition.

Deleting a column removes arrangement references in that time span. It should not
delete the referenced measures from the bank.

## Sequencer Targeting

The sequencer needs an explicit active measure target:

```ts
type ActiveMeasureTarget = {
  rowIndex: number
  columnIndex: number
  measureId: number
}
```

If a matrix cell is empty and the user presses `Enter`, there are two good options:

- create a new measure with a generated name and switch to the sequencer,
- open inline cell naming first, then switch after the name is committed.

Recommended behavior: inline naming first. It preserves the design rule that the
measure bank is created through matrix names and avoids hidden unnamed measures.

The sequencer header's time signature display should reflect the active composition
column length, not a property of the measure. The time signature edit input in
sequencer should be removed.

## Backend Contract Needs

The current schema `2` has the right structural separation:

```ts
type MeasureBank = {
  next_id: number
  measures: Array<{
    id: number
    measure: { cell: Cell }
  }>
}

type Composition = {
  columns: Array<{
    length: { numerator: number; denominator: number }
  }>
  rows: Array<{
    output_id: string
    cells: Array<number | null>
  }>
}
```

Likely additions:

```ts
type MeasureBankEntry = {
  id: number
  name: string
  measure: { cell: Cell }
}

type CompositionColumn = {
  id?: string
  length: { numerator: number; denominator: number }
}

type CompositionRow = {
  id?: string
  name?: string
  output_id: string
  cells: Array<number | null>
}
```

Stable row and column IDs are optional for rendering but useful for preserving
selection through insert/delete/move operations. Without IDs, frontend selection can
be index-based and reconciled after each command.

Required command coverage:

- `composition row insert before|after`
- `composition row delete`
- `composition row move up|down`
- `composition row rename <name>`
- `composition row output <output_id>`
- `composition column insert before|after`
- `composition column delete`
- `composition column move left|right`
- `composition column length <signature>`
- `composition cell assign <measure_name>`
- `composition cell clear`
- `measure create <name>`
- `measure rename <name>`
- `measure duplicate <name>`

The command names are placeholders. The important part is that the frontend can send
all mutations through `command.execute` and receive a fresh snapshot.

## Frontend Implementation Notes

Current frontend mapping still reduces arrangement snapshots to one active measure
for the sequencer. Composition UI needs richer domain models:

```ts
type ProjectSnapshot = {
  revision: number
  historyEntryId: number
  measureBank: MeasureBank
  composition: Composition
  activeMeasure: Measure
  pitch: PitchState
}
```

The compatibility path can keep `activeMeasure` for the existing sequencer while
adding full `measureBank` and `composition` fields for the matrix.

Suggested frontend state:

```ts
type WorkspaceView = 'composition' | 'sequencer' | 'library'

type CompositionEditorState = {
  selection: CompositionSelection
  editingCell: CompositionSelection | null
  activeMeasureTarget: ActiveMeasureTarget | null
}
```

The composition matrix should be a new section component, likely
`CompositionSection.tsx`, with a focused CSS file under `src/styles/app/`.

## Open Decisions

- Should measure names be globally unique? Recommended: yes.
- Is editing a populated cell an assignment change, a measure rename, or both through
  different commands? Recommended: assignment by inline edit, global rename by
  command.
- Should deleting the last row or column be allowed? Recommended: no; keep at least
  one row and one column.
- Should empty cells render as rests in all outputs? Recommended: yes.
- Should the matrix allow multiple rows with the same output? Current backend
  semantics allow it; keep that behavior.
- Should column length edits in the sequencer affect the selected composition column?
  Recommended: The sequencer will remove its time signature/length and it will
  no longer be editable from there.

## First Build Slice

1. Extend frontend project models and mappers to expose schema `2` composition data.
2. Add `composition` as a workspace view beside `sequencer` (the former Library
   workspace was later replaced by Quick Access).
3. Render a read-only matrix with proportional columns, row output labels, measure
   labels, and selection highlight.
4. Add keymapped matrix selection movement for arrows and `hjkl`.
5. Add `Enter` to switch from a matrix cell to the sequencer active measure.
6. Add backend commands for assigning cells, inserting/deleting rows, and
   inserting/deleting columns.
7. Add inline cell naming once measure names exist in the backend schema.
