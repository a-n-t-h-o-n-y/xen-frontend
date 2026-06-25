import { z } from 'zod'

export const BRIDGE_PROTOCOL = 'xen.bridge.v1'
export const PROJECT_SCHEMA_VERSION = 2
export const LEGACY_PROJECT_SCHEMA_VERSION = 1
export const LIBRARY_SCHEMA_VERSION = 1
export const CATALOG_SCHEMA_VERSION = 2
export const KEYMAP_SCHEMA_VERSION = 1

const finiteNumber = z.number().finite()
const nonNegativeInteger = z.number().int().nonnegative()
const modTargetIdSchema = z.enum(['pitch', 'velocity', 'delay', 'gate', 'weights'])

export const selectionStepSchema = z.object({
  kind: z.enum(['element', 'cell']),
  index: nonNegativeInteger,
})

export const selectionSchema = z.object({
  path: z.array(selectionStepSchema),
}).superRefine((selection, context) => {
  selection.path.forEach((step, index) => {
    const expectedKind = index % 2 === 0 ? 'element' : 'cell'
    if (step.kind !== expectedKind) {
      context.addIssue({
        code: 'custom',
        path: ['path', index, 'kind'],
        message: `Expected ${expectedKind} selection step`,
      })
    }
  })
})

export const noteSchema = z.object({
  type: z.literal('Note'),
  pitch: finiteNumber,
  velocity: finiteNumber,
  delay: finiteNumber,
  gate: finiteNumber,
})

export type NoteElement = z.infer<typeof noteSchema>

export type SequenceElement = {
  type: 'Sequence'
  cells: Cell[]
}

export type MusicElement = NoteElement | SequenceElement

export type Cell = {
  weight: number
  elements: MusicElement[]
}

export const cellSchema: z.ZodType<Cell> = z.lazy(() =>
  z.object({
    weight: finiteNumber,
    elements: z.array(z.union([
      noteSchema,
      z.object({
        type: z.literal('Sequence'),
        cells: z.array(cellSchema),
      }),
    ])),
  })
)

export const measureSchema = z.object({
  cell: cellSchema,
  time_signature: z.object({
    numerator: finiteNumber,
    denominator: finiteNumber,
  }),
})

export const measureEntrySchema = z.object({
  id: nonNegativeInteger,
  measure: z.object({
    cell: cellSchema,
  }),
})

export const measureBankSchema = z.object({
  next_id: nonNegativeInteger,
  measures: z.array(measureEntrySchema),
})

export const compositionLengthSchema = z.object({
  numerator: finiteNumber,
  denominator: finiteNumber,
})

export const compositionLoopRegionSchema = z.object({
  start_column: nonNegativeInteger,
  end_column: nonNegativeInteger,
})

export const compositionSchema = z.object({
  columns: z.array(z.object({
    length: compositionLengthSchema,
  })),
  rows: z.array(z.object({
    output_id: z.string(),
    cells: z.array(nonNegativeInteger.nullable()),
  })),
  loop_region: compositionLoopRegionSchema.optional(),
}).superRefine((composition, context) => {
  composition.rows.forEach((row, rowIndex) => {
    if (row.cells.length !== composition.columns.length) {
      context.addIssue({
        code: 'custom',
        path: ['rows', rowIndex, 'cells'],
        message: 'Expected row cells to match composition column count',
      })
    }
  })
  if (composition.loop_region) {
    const lastColumnIndex = composition.columns.length - 1
    if (composition.loop_region.start_column > lastColumnIndex) {
      context.addIssue({
        code: 'custom',
        path: ['loop_region', 'start_column'],
        message: 'Expected loop start column to reference an existing composition column',
      })
    }
    if (composition.loop_region.end_column > lastColumnIndex) {
      context.addIssue({
        code: 'custom',
        path: ['loop_region', 'end_column'],
        message: 'Expected loop end column to reference an existing composition column',
      })
    }
  }
})

export const scaleDefinitionSchema = z.object({
  name: z.string(),
  tuning_length: finiteNumber,
  intervals: z.array(finiteNumber),
  mode: finiteNumber,
})

const pitchStateSchema = z.object({
  tuning: z.object({
    name: z.string(),
    definition: z.object({
      intervals: z.array(finiteNumber),
      octave: finiteNumber,
    }),
  }),
  scale: z.object({
    source_id: z.string().nullable(),
    definition: scaleDefinitionSchema,
  }).nullable(),
  transposition: finiteNumber,
  translation_direction: z.enum(['up', 'down']),
  base_frequency: finiteNumber,
})

export const legacyProjectSnapshotSchema = z.object({
  schema_version: z.literal(LEGACY_PROJECT_SCHEMA_VERSION),
  history_entry_id: nonNegativeInteger,
  project_revision: nonNegativeInteger,
  project: z.object({
    measure: measureSchema,
    pitch: pitchStateSchema,
  }),
})

export const arrangementProjectSnapshotSchema = z.object({
  schema_version: z.literal(PROJECT_SCHEMA_VERSION),
  history_entry_id: nonNegativeInteger,
  project_revision: nonNegativeInteger,
  project: z.object({
    measure_bank: measureBankSchema,
    composition: compositionSchema,
    pitch: pitchStateSchema,
  }),
}).superRefine((snapshot, context) => {
  const measureIds = new Set(snapshot.project.measure_bank.measures.map((entry) => entry.id))
  snapshot.project.composition.rows.forEach((row, rowIndex) => {
    row.cells.forEach((measureId, cellIndex) => {
      if (measureId !== null && !measureIds.has(measureId)) {
        context.addIssue({
          code: 'custom',
          path: ['project', 'composition', 'rows', rowIndex, 'cells', cellIndex],
          message: `Unknown measure reference ${measureId}`,
        })
      }
    })
  })
})

export const projectSnapshotSchema = z.discriminatedUnion('schema_version', [
  legacyProjectSnapshotSchema,
  arrangementProjectSnapshotSchema,
])

const libraryCommandEntrySchema = z.object({
  name: z.string(),
  relative_path: z.string(),
  stem: z.string(),
  path: z.string(),
  command: z.string(),
})

const tuningEntrySchema = libraryCommandEntrySchema.extend({
  description: z.string(),
  intervals: z.array(finiteNumber),
  octave: finiteNumber,
  note_count: finiteNumber,
})

const chromaticScaleSchema = z.object({
  id: z.literal('chromatic'),
  name: z.literal('chromatic'),
  definition: z.null(),
  intervals: z.array(finiteNumber).length(0),
  command: z.string(),
})

const definedScaleSchema = z.object({
  id: z.string().min(1),
  definition: scaleDefinitionSchema,
  command: z.string(),
})

export const librarySnapshotSchema = z.object({
  schema_version: z.literal(LIBRARY_SCHEMA_VERSION),
  library_revision: nonNegativeInteger,
  paths: z.object({
    library: z.string(),
    sequences: z.string(),
    tunings: z.string(),
  }),
  measures: z.array(libraryCommandEntrySchema),
  tunings: z.array(tuningEntrySchema),
  scales: z.array(z.union([chromaticScaleSchema, definedScaleSchema])),
  chords: z.array(z.object({
    name: z.string(),
    intervals: z.array(finiteNumber),
    command: z.string(),
  })),
  commands: z.object({
    reload_scales: z.string(),
    reload_chords: z.string(),
    library_directory: z.string(),
  }),
})

export const catalogConstraintSchema = z.object({
  kind: z.string(),
  minimum: finiteNumber.nullable(),
  maximum: finiteNumber.nullable(),
  values: z.array(z.string()),
})

export const catalogArgumentSchema = z.object({
  kind: z.string(),
  display_name: z.string(),
  required: z.boolean(),
  default_value: z.string().nullable(),
  constraints: z.array(catalogConstraintSchema),
})

export const catalogCommandSchema = z.object({
  path: z.array(z.string()).min(1),
  keywords: z.array(z.string()),
  accepts_pattern_prefix: z.boolean(),
  target_requirement: z.enum(['none', 'cell', 'element', 'cell_or_element']),
  arguments: z.array(catalogArgumentSchema),
  description: z.string(),
})

export const catalogSchema = z.object({
  schema_version: z.literal(CATALOG_SCHEMA_VERSION),
  commands: z.array(catalogCommandSchema),
})

export const inputModeSchema = z.enum(['pitch', 'velocity', 'delay', 'gate', 'scale'])

export const keymapTriggerSchema = z.object({
  key: z.string().min(1),
  modifiers: z.object({
    shift: z.boolean(),
    command: z.boolean(),
    alt: z.boolean(),
  }),
  when: z.object({
    input_mode: inputModeSchema,
  }).optional(),
})

export const commandTargetSchema = z.object({
  type: z.literal('command'),
  command: z.string().min(1),
})

export const uiActionTargetSchema = z.discriminatedUnion('action', [
  z.object({
    type: z.literal('ui_action'),
    action: z.literal('selection.move'),
    arguments: z.object({
      direction: z.enum(['left', 'right', 'up', 'down']),
      amount: z.number().int().positive(),
    }),
  }),
  z.object({
    type: z.literal('ui_action'),
    action: z.literal('input_mode.set'),
    arguments: z.object({
      mode: inputModeSchema,
    }),
  }),
  z.object({
    type: z.literal('ui_action'),
    action: z.literal('workspace.view.toggle'),
    arguments: z.object({}).strict(),
  }),
  z.object({
    type: z.literal('ui_action'),
    action: z.enum([
      'workspace.view.composition',
      'workspace.view.sequencer',
      'composition.cell.edit_measure',
      'composition.loop.set_start',
      'composition.loop.set_end',
    ]),
    arguments: z.object({}).strict(),
  }),
  z.object({
    type: z.literal('ui_action'),
    action: z.literal('composition.selection.move'),
    arguments: z.object({
      direction: z.enum(['left', 'right', 'up', 'down']),
      amount: z.number().int().positive(),
    }),
  }),
  z.object({
    type: z.literal('ui_action'),
    action: z.literal('modulator.mode.toggle'),
    arguments: z.object({}).strict(),
  }),
  z.object({
    type: z.literal('ui_action'),
    action: z.literal('modulator.slot.select'),
    arguments: z.object({
      slot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    }),
  }),
  z.object({
    type: z.literal('ui_action'),
    action: z.literal('modulator.target.toggle'),
    arguments: z.object({
      target: modTargetIdSchema,
    }),
  }),
  z.object({
    type: z.literal('ui_action'),
    action: z.enum([
      'command.open',
      'command.cancel',
      'command.submit',
      'command.close_if_empty',
      'command.history.previous',
      'command.history.next',
      'command.completion.accept',
      'command.completion.dismiss',
      'command.completion.previous',
      'command.completion.next',
    ]),
    arguments: z.object({}).strict(),
  }),
])

export const keymapTargetSchema = z.discriminatedUnion('type', [
  commandTargetSchema,
  uiActionTargetSchema,
])

export const keymapBindingSchema = z.object({
  trigger: keymapTriggerSchema,
  target: keymapTargetSchema,
})

export const keymapOverrideSchema = z.object({
  context: z.string().min(1),
  trigger: keymapTriggerSchema,
  target: keymapTargetSchema.nullable(),
})

export const keymapResourceSchema = z.object({
  schema_version: z.literal(KEYMAP_SCHEMA_VERSION),
  revision: nonNegativeInteger,
  key_semantics: z.literal('KeyboardEvent.key'),
  bindings: z.record(z.string(), z.array(keymapBindingSchema)),
  overrides: z.array(keymapOverrideSchema),
})

export const sessionHelloSchema = z.object({
  protocol: z.literal(BRIDGE_PROTOCOL),
  plugin_version: z.string(),
  project_schema_version: z.union([
    z.literal(LEGACY_PROJECT_SCHEMA_VERSION),
    z.literal(PROJECT_SCHEMA_VERSION),
  ]),
  library_schema_version: z.literal(LIBRARY_SCHEMA_VERSION),
  catalog: catalogSchema,
  keymap: keymapResourceSchema,
})

export const envelopeSchema = z.object({
  protocol: z.literal(BRIDGE_PROTOCOL),
  type: z.enum(['request', 'response', 'event']),
  name: z.string(),
  request_id: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
})

export const commandResponseSchema = z.object({
  status: z.object({
    level: z.enum(['debug', 'info', 'warning', 'error']),
    message: z.string(),
  }),
  suggested_selection: selectionSchema.nullable(),
  snapshot: projectSnapshotSchema,
})

export const bridgeEventSchema = z.discriminatedUnion('name', [
  envelopeSchema.extend({
    type: z.literal('event'),
    name: z.literal('state.changed'),
    payload: projectSnapshotSchema,
  }),
  envelopeSchema.extend({
    type: z.literal('event'),
    name: z.literal('library.changed'),
    payload: librarySnapshotSchema,
  }),
  envelopeSchema.extend({
    type: z.literal('event'),
    name: z.literal('keymap.changed'),
    payload: keymapResourceSchema,
  }),
  envelopeSchema.extend({
    type: z.literal('event'),
    name: z.literal('transport.phase.sync'),
    payload: z.object({
      bpm: finiteNumber,
      phase: finiteNumber,
    }),
  }),
  envelopeSchema.extend({
    type: z.literal('event'),
    name: z.literal('transport.stopped'),
    payload: z.object({}),
  }),
])

export type EnvelopeDto = z.infer<typeof envelopeSchema>
export type EnvelopePayloadDto = EnvelopeDto['payload']
export type SelectionStepDto = z.infer<typeof selectionStepSchema>
export type SelectionDto = z.infer<typeof selectionSchema>
export type SelectionPathDto = SelectionDto['path']
export type MeasureDto = z.infer<typeof measureSchema>
export type MeasureEntryDto = z.infer<typeof measureEntrySchema>
export type ScaleDefinitionDto = z.infer<typeof scaleDefinitionSchema>
export type ProjectSnapshotDto = z.infer<typeof projectSnapshotSchema>
export type LibrarySnapshotDto = z.infer<typeof librarySnapshotSchema>
export type CatalogDto = z.infer<typeof catalogSchema>
export type CatalogCommandDto = z.infer<typeof catalogCommandSchema>
export type SessionHelloDto = z.infer<typeof sessionHelloSchema>
export type CommandExecuteResponseDto = z.infer<typeof commandResponseSchema>
export type InputModeDto = z.infer<typeof inputModeSchema>
export type KeymapTriggerDto = z.infer<typeof keymapTriggerSchema>
export type KeymapTargetDto = z.infer<typeof keymapTargetSchema>
export type KeymapBindingDto = z.infer<typeof keymapBindingSchema>
export type KeymapOverrideDto = z.infer<typeof keymapOverrideSchema>
export type KeymapResourceDto = z.infer<typeof keymapResourceSchema>

export const parseEnvelope = (value: unknown): EnvelopeDto => envelopeSchema.parse(value)
export const parseSessionHello = (value: unknown): SessionHelloDto => sessionHelloSchema.parse(value)
export const parseProjectSnapshot = (value: unknown): ProjectSnapshotDto =>
  projectSnapshotSchema.parse(value)
export const parseLibrarySnapshot = (value: unknown): LibrarySnapshotDto =>
  librarySnapshotSchema.parse(value)
export const parseCommandResponse = (value: unknown): CommandExecuteResponseDto =>
  commandResponseSchema.parse(value)
export const parseBridgeEvent = (value: unknown) => bridgeEventSchema.parse(value)
export const parseKeymapResource = (value: unknown): KeymapResourceDto =>
  keymapResourceSchema.parse(value)
