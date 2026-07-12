# Frontend Composition Arrangement Handoff

Backend project schema `4` separates musical content from arrangement.

## Project Shape

```ts
type SequenceId = number;
type OutputId = string;

type SequenceBank = {
  next_id: SequenceId;
  sequences: Array<{
    id: SequenceId;
    name?: string;
    cell: Cell;
  }>;
};

type Composition = {
  columns: Array<{
    duration: { numerator: number; denominator: number };
  }>;
  rows: Array<{
    name?: string;
    channel_id: OutputId;
    cells: Array<SequenceId | null>;
  }>;
};
```

Defaults imitate the previous app behavior:

- one sequence in the bank with ID `1`;
- one composition column with length `4/4`;
- one composition row assigned to output ID `"current"`;
- the only composition cell references sequence ID `1`.

## Semantics

- Sequences contain only musical cell data. They no longer carry length or time
  signature.
- Column metadata owns musical length. Every row shares the same columns.
- Rows are tracks. `row.channel_id` decides which plugin instance should render that
  row.
- `cells[column] === null` is an empty arrangement slot/rest.
- Multiple cells may reference the same sequence ID. Editing a sequence changes every
  arrangement cell that references it.
- Multiple rows may use the same output ID.

## Backend API Surface

The C++ domain API is in `include/xen/composition.hpp`:

- sequence bank: `create_sequence`, `remove_sequence`, `duplicate_sequence`,
  `find_sequence`, `update_sequence`, `all_sequences`;
- composition rows: `insert_row`, `remove_row`, `move_row`, `assign_row_channel`;
- composition columns: `insert_column`, `remove_column`, `move_column`,
  `set_column_duration`;
- matrix cells: `assign_sequence_reference`, `clear_sequence_reference`,
  `sequence_reference_at`.

Composition commands address arrangement rows, columns, loop boundaries, and sequence
assignment. Sequencer commands edit the sequence selected by the submitted composition
cursor.

## Rendering Contract

The MIDI renderer walks the composition left to right. For the current output ID it:

- skips rows assigned to other output IDs;
- resolves non-null sequence IDs through the sequence bank;
- renders each referenced sequence using that column's length;
- sums all column lengths for the loop duration.

Until IPC instance IDs exist, the default/current backend output ID is `"current"`.
