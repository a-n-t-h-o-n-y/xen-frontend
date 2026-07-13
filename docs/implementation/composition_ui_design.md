# Composition UI Design

This document describes the intended composition workspace: a matrix for arranging
named sequences across time and output rows, paired with the existing sequencer for
editing the selected sequence. It expands the current arrangement handoff into a
usable UI model and calls out likely frontend/backend contract changes.

## Core Model

The app has two primary musical workspaces:

- `sequencer`: edits the contents of one sequence.
- `composition`: arranges sequence references across rows and columns.

Only one is active at a time. The composition matrix decides which sequence the
sequencer edits. The sequencer does not show the sequence bank as a separate panel;
the bank is inferred from the sequence names used in the matrix.

The matrix starts with:

- one row,
- one column,
- one cell containing a default sequence reference,
- one output assignment for the row.

Columns represent musical time. Rows represent routed lanes. Cells contain sequence
references or rests.

## Workspace Switching

Composition and sequence navigation form one vertical hierarchy:

- `Shift+Down` on a composition cell enters its sequence at the root.
- If the cell is empty, entry first creates and assigns the next available generated
  `S<number>` sequence name.
- `Shift+Up` in the sequencer moves toward its root. The root remains a selectable
  whole-sequence state; one additional `Shift+Up` returns to the composition matrix.
- `Shift+Down` retains its recursive descent behavior inside the sequencer.

There is no dedicated workspace toggle in the status bar and the default keymap does
not use `Tab` or composition `Enter` for workspace crossing. Legacy workspace and
cell-entry action IDs remain valid so stored custom keymaps continue to load.

These remain custom keymap actions rather than hard-coded keyboard behavior. The
composition context uses `selection.move` for hierarchical entry and its own
`composition.selection.move` action for movement across matrix coordinates.

Suggested UI actions:

```ts
type CompositionUiAction =
  | 'workspace.view.composition'
  | 'workspace.view.sequencer'
  | 'composition.selection.move'
  | 'composition.cell.edit_sequence'
  | 'composition.cell.rename_or_create_sequence'
  | 'composition.cell.unassign'
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

The composition matrix has a locked row-metadata rail at the left and one or more
arrangement rows beside it. The rail reserves horizontal space and stays visible at
all supported window sizes while the virtual cell grid recenters around selection.
A small left inset separates the rail from the composition canvas border.

Suggested columns:

- Locked row header: row name and output destination for materialized rows. Virtual
  row headers remain visually blank, and no row header displays its coordinate.
- Time columns: one duration-scaled visual column per virtual composition coordinate.

The matrix does not render column headers. In every workspace, the global app header
displays and edits the selected composition column's duration, key, scale, tuning,
and related pitch metadata. Materialized columns use their stored metadata. A virtual
selected column displays disabled `--` placeholders because it has no stored
metadata; `default_column` remains a layout/playback fallback, not a header value.

Column width represents quarter-note duration, with a responsive minimum width so
short columns remain legible:

```ts
columnBeats = numerator * (4 / denominator)
columnWidth = max(minColumnWidth, columnBeats * beatWidth)
```

## Selection

The matrix owns its own selection state:

```ts
type CompositionSelection = {
  rowCoordinate: number
  columnCoordinate: number
}
```

Selection visuals:

- selected cell: strongest highlight,
- selected row: light horizontal highlight,
- selected column: light vertical highlight,
- selected row header: active when editing row output or row name.

The row and column highlight should be quiet enough to preserve matrix readability.
The selected cell should be clearly visible without using a heavy border that shifts
layout.

## Cell Display

Each arrangement cell displays the sequence name. If the backend only has numeric
sequence IDs, the frontend can temporarily show a generated label like `S1`, but the
intended design needs stable sequence names.

Cell states:

- named sequence reference: show the sequence name.
- empty rest: show only a faint, transparent wireframe with no visible label or
  coordinate; selection and active inline editing may strengthen its outline.
- unresolved reference: show the requested name in an error state.
- shared reference: optional small indicator if the same sequence appears elsewhere.
- loop membership: show the green lower boundary only on populated placements, never
  on virtual or otherwise empty cells.

## Interaction

The composition canvas and row rail are keyboard-only. They expose no click,
double-click, drag/drop, hover action, or per-cell unassign control. Keymapped actions
own navigation, assignment, row metadata editing, unassignment, and loop bounds.
The global header remains pointer-editable, and the `composition.column.length`
action opens its Time editor.

The sequence bank remains implicit:

- Typing a new sequence name into an empty cell creates a sequence bank entry and
  assigns it to the cell.
- Typing the name of an existing sequence assigns that existing sequence.
- Renaming a sequence should update every cell that references it.
- Duplicating a sequence should create a new sequence with copied content and a new
  name, then assign that duplicate where requested.

This implies the matrix editor needs to distinguish "rename this sequence" from
"assign a different sequence by name". A practical first pass:

- inline editing an empty cell creates or assigns by name,
- inline editing a populated cell changes that cell assignment by name,
- a command handles global sequence rename.

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

Deleting a row removes only arrangement references. It must not delete sequences from
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
delete the referenced sequences from the bank.

## Sequencer Targeting

The sequencer needs an explicit active sequence target:

```ts
type ActiveSequenceTarget = {
  rowIndex: number
  columnIndex: number
  sequenceId: number
}
```

If a matrix cell is empty and the user presses `Enter`, there are two good options:

- create a new sequence with a generated name and switch to the sequencer,
- open inline cell naming first, then switch after the name is committed.

Recommended behavior: inline naming first. It preserves the design rule that the
sequence bank is created through matrix names and avoids hidden unnamed sequences.

The sequencer header's time signature display should reflect the active composition
column length, not a property of the sequence. The time signature edit input in
sequencer should be removed.

## Backend Contract Needs

The current schema `4` has the right structural separation:

```ts
type SequenceBank = {
  next_id: number
  sequences: Array<{
    id: number
    name?: string
    cell: Cell
  }>
}

type Composition = {
  columns: Array<{
    duration: { numerator: number; denominator: number }
  }>
  rows: Array<{
    name?: string
    channel_id: string
    cells: Array<number | null>
  }>
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
- `composition cell assign <sequence_name>`
- `composition cell unassign`
- `sequence create <name>`
- `sequence rename <name>`
- `sequence duplicate <name>`

The command names are placeholders. The important part is that the frontend can send
all mutations through `command.execute` and receive a fresh snapshot.

## Frontend Implementation Notes

The frontend exposes the complete sequence bank and derives the sequence currently
shown in the sequencer from the active composition target:

```ts
type ProjectSnapshot = {
  revision: number
  historyEntryId: number
  sequenceBank: SequenceBank
  composition: Composition
  sequence: Sequence
  pitch: PitchState
}
```

Suggested frontend state:

```ts
type WorkspaceView = 'composition' | 'sequencer' | 'library'

type CompositionEditorState = {
  selection: CompositionSelection
  editingCell: CompositionSelection | null
  activeSequenceTarget: ActiveSequenceTarget | null
}
```

The composition matrix should be a new section component, likely
`CompositionSection.tsx`, with a focused CSS file under `src/styles/app/`.

## Open Decisions

- Should sequence names be globally unique? Recommended: yes.
- Is editing a populated cell an assignment change, a sequence rename, or both through
  different commands? Recommended: assignment by inline edit, global rename by
  command.
- Should deleting the last row or column be allowed? Recommended: no; keep at least
  one row and one column.
- Should empty cells render as rests in all outputs? Recommended: yes.
- Should the matrix allow multiple rows with the same output? Current backend
  semantics allow it; keep that behavior.
- Column metadata is edited through the global header for the selected composition
  column in every workspace; there is no in-grid column editor. Virtual selections
  expose disabled placeholders until the column is materialized.

## First Build Slice

1. Extend frontend project models and mappers to expose schema `2` composition data.
2. Add `composition` as a workspace view beside `sequencer` (the former Library
   workspace was later replaced by Quick Access).
3. Render a keyboard-only matrix with duration-scaled columns, a locked row rail,
   sequence labels, sparse empty wireframes, and selection highlight.
4. Add keymapped matrix selection movement for arrows and `hjkl`.
5. Add `Enter` to switch from a matrix cell to the sequencer active sequence.
6. Add backend commands for assigning cells, inserting/deleting rows, and
   inserting/deleting columns.
7. Add inline cell naming once sequence names exist in the backend schema.
