import { z } from 'zod'

export const BRIDGE_PROTOCOL = 'xen.bridge.v7'
export const IPC_PROTOCOL = 'xen.ipc.v3'
export const PROJECT_SCHEMA_VERSION = 6
export const LIBRARY_SCHEMA_VERSION = 2
export const CATALOG_SCHEMA_VERSION = 5
export const KEYMAP_SCHEMA_VERSION = 2

const finiteNumber = z.number().finite()
const nonNegativeInteger = z.number().int().nonnegative()
export const compositionCoordinateSchema = z.number().int()
  .min(-2_147_483_648)
  .max(2_147_483_647)
export const decimalRevisionSchema = z.string().regex(/^\d+$/, 'Expected a decimal revision string')
export const keymapRevisionSchema = decimalRevisionSchema
export const preferencesRevisionSchema = decimalRevisionSchema
export const fileRevisionSchema = z.string().min(1)
export const recoveryRevisionSchema = z.string().min(1)
const contentRelativePathSchema = z.string().min(1).refine(
  (path) => {
    if (path.startsWith('/') || path.includes('\\') || /^[a-zA-Z]:/.test(path)) return false
    return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  },
  'Expected a content-relative path'
)
export const projectRelativePathSchema = contentRelativePathSchema.refine(
  (path) => path.endsWith('.xenproj'),
  'Expected a .xenproj path'
)
export const cellRelativePathSchema = contentRelativePathSchema.refine(
  (path) => path.endsWith('.xencell'),
  'Expected a .xencell path'
)
export const modulationShapeSchema = z.enum([
  'sine',
  'triangle',
  'sawtooth_up',
  'sawtooth_down',
  'square',
])
export const modulationOperationIdSchema = z.enum([
  'average',
  'sum',
  'product',
  'am',
  'ring',
  'fm',
  'pm',
])
export const modulationDestinationSchema = z.enum([
  'pitch',
  'velocity',
  'delay',
  'gate',
  'weight',
])

const unitParameterRangeSchema = z.object({
  minimum: z.literal(0),
  maximum: z.literal(1),
}).strict()
const bipolarParameterRangeSchema = z.object({
  minimum: z.literal(-1),
  maximum: z.literal(1),
}).strict()

export const modulationCatalogSchema = z.object({
  schema_version: z.literal(1),
  maximum_waveforms: z.literal(64),
  waveform_shapes: z.array(modulationShapeSchema).min(1),
  waveform_parameters: z.object({
    frequency: unitParameterRangeSchema,
    phase: unitParameterRangeSchema,
    amplitude: bipolarParameterRangeSchema,
    amplitude_offset: bipolarParameterRangeSchema,
  }).strict(),
  operations: z.array(z.object({
    id: modulationOperationIdSchema,
    minimum_enabled_waveforms: z.literal(1).optional(),
    enabled_waveforms: z.literal(2).optional(),
    roles: z.tuple([z.literal('carrier'), z.literal('modulator')]).optional(),
  }).strict()).min(1),
  destinations: z.array(z.discriminatedUnion('id', [
    z.object({
      id: z.literal('pitch'),
      range: z.literal('integer'),
      quantization: z.literal('nearest'),
    }).strict(),
    z.object({ id: z.literal('velocity'), range: z.literal('unit') }).strict(),
    z.object({ id: z.literal('delay'), range: z.literal('unit') }).strict(),
    z.object({ id: z.literal('gate'), range: z.literal('unit') }).strict(),
    z.object({ id: z.literal('weight'), range: z.literal('positive') }).strict(),
  ])).min(1),
  normalization: z.literal('clamp((raw + 1) / 2, 0, 1)'),
}).strict()

export const modulationWaveformSchema = z.object({
  enabled: z.boolean(),
  shape: modulationShapeSchema,
  frequency: finiteNumber,
  phase: finiteNumber,
  amplitude: finiteNumber,
  amplitude_offset: finiteNumber,
}).strict()

export const modulationDefinitionSchema = z.object({
  operation: modulationOperationIdSchema,
  waveforms: z.array(modulationWaveformSchema).min(1).max(64),
}).strict()

export const modulationOutputRangeSchema = z.object({
  minimum: finiteNumber,
  maximum: finiteNumber,
}).strict()

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

export const modulationTargetSchema = z.object({
  cursor: z.object({
    row_coordinate: compositionCoordinateSchema,
    column_coordinate: compositionCoordinateSchema,
    sequence_id: nonNegativeInteger.nullable(),
  }).strict(),
  selection: selectionSchema,
  pattern: z.object({
    offset: nonNegativeInteger,
    intervals: z.array(z.number().int().positive()).min(1),
  }).strict(),
}).strict()

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

export const sequenceEntrySchema = z.object({
  id: nonNegativeInteger,
  name: z.string().optional(),
  cell: cellSchema,
})

export const sequenceBankSchema = z.object({
  next_id: nonNegativeInteger,
  sequences: z.array(sequenceEntrySchema),
})

export const compositionLengthSchema = z.object({
  numerator: finiteNumber,
  denominator: finiteNumber,
})

export const compositionLoopRegionSchema = z.object({
  start_column: compositionCoordinateSchema,
  end_column: compositionCoordinateSchema,
})

const compositionColumnSchema = z.object({
    duration: compositionLengthSchema,
    pitch: z.lazy(() => pitchStateSchema),
})

export const compositionSchema = z.object({
  default_column: compositionColumnSchema,
  columns: z.array(compositionColumnSchema.extend({
    coordinate: compositionCoordinateSchema,
  })),
  rows: z.array(z.object({
    coordinate: compositionCoordinateSchema,
    name: z.string().optional(),
    channel_id: z.string(),
  })),
  placements: z.array(z.object({
    row: compositionCoordinateSchema,
    column: compositionCoordinateSchema,
    sequence_id: nonNegativeInteger,
  })),
  loop_region: compositionLoopRegionSchema,
}).superRefine((composition, context) => {
  const rowCoordinates = new Set<number>()
  composition.rows.forEach((row, rowIndex) => {
    if (rowCoordinates.has(row.coordinate)) {
      context.addIssue({
        code: 'custom',
        path: ['rows', rowIndex, 'coordinate'],
        message: `Duplicate composition row coordinate ${row.coordinate}`,
      })
    }
    rowCoordinates.add(row.coordinate)
  })

  const columnCoordinates = new Set<number>()
  composition.columns.forEach((column, columnIndex) => {
    if (columnCoordinates.has(column.coordinate)) {
      context.addIssue({
        code: 'custom',
        path: ['columns', columnIndex, 'coordinate'],
        message: `Duplicate composition column coordinate ${column.coordinate}`,
      })
    }
    columnCoordinates.add(column.coordinate)
  })

  const placementCoordinates = new Set<string>()
  composition.placements.forEach((placement, placementIndex) => {
    const key = `${placement.row},${placement.column}`
    if (placementCoordinates.has(key)) {
      context.addIssue({
        code: 'custom',
        path: ['placements', placementIndex],
        message: `Duplicate composition placement at ${key}`,
      })
    }
    placementCoordinates.add(key)
    if (!rowCoordinates.has(placement.row)) {
      context.addIssue({
        code: 'custom',
        path: ['placements', placementIndex, 'row'],
        message: `Placement references missing row ${placement.row}`,
      })
    }
    if (!columnCoordinates.has(placement.column)) {
      context.addIssue({
        code: 'custom',
        path: ['placements', placementIndex, 'column'],
        message: `Placement references missing column ${placement.column}`,
      })
    }
  })

  if (composition.loop_region.start_column > composition.loop_region.end_column) {
    context.addIssue({
      code: 'custom',
      path: ['loop_region'],
      message: 'Expected loop start column to be less than or equal to loop end column',
    })
  }
})

export const scaleDefinitionSchema = z.object({
  name: z.string(),
  tuning_length: finiteNumber,
  intervals: z.array(finiteNumber),
  mode: finiteNumber,
})

export const pitchStateSchema = z.object({
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

export const arrangementProjectSnapshotSchema = z.object({
  schema_version: z.literal(PROJECT_SCHEMA_VERSION),
  state_revision: decimalRevisionSchema,
  project_revision: decimalRevisionSchema,
  history_entry_id: decimalRevisionSchema,
  preview_active: z.boolean(),
  document: z.object({
    relative_path: projectRelativePathSchema.nullable(),
    display_name: z.string(),
    dirty: z.boolean(),
    file_revision: fileRevisionSchema.nullable(),
  }).strict(),
  recovery: z.object({
    revision: recoveryRevisionSchema,
    saved_at_unix_ms: decimalRevisionSchema,
    relative_path: projectRelativePathSchema.nullable(),
    project_revision: decimalRevisionSchema,
  }).strict().nullable(),
  project: z.object({
    sequence_bank: sequenceBankSchema,
    composition: compositionSchema,
  }).strict(),
}).strict().superRefine((snapshot, context) => {
  const sequenceIds = new Set(snapshot.project.sequence_bank.sequences.map((entry) => entry.id))
  snapshot.project.composition.placements.forEach((placement, placementIndex) => {
    if (!sequenceIds.has(placement.sequence_id)) {
      context.addIssue({
        code: 'custom',
        path: ['project', 'composition', 'placements', placementIndex, 'sequence_id'],
        message: `Unknown sequence reference ${placement.sequence_id}`,
      })
    }
  })
})

export const projectSnapshotSchema = arrangementProjectSnapshotSchema

export const documentFileSchema = z.object({
  name: z.string(),
  relative_path: contentRelativePathSchema,
  stem: z.string(),
  file_revision: fileRevisionSchema,
}).strict()
export const contentFileSchema = documentFileSchema.extend({
  command: z.string(),
})
export const cellContentFileSchema = contentFileSchema.extend({
  relative_path: cellRelativePathSchema,
})
export const projectContentFileSchema = contentFileSchema.extend({
  relative_path: projectRelativePathSchema,
})

const tuningEntrySchema = contentFileSchema.extend({
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
  library_revision: decimalRevisionSchema,
  paths: z.object({
    library: z.string(),
    content: z.string(),
    tunings: z.string(),
  }).strict(),
  cells: z.array(cellContentFileSchema),
  projects: z.array(projectContentFileSchema),
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
}).strict()

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

export const inputModeSchema = z.enum(['pitch', 'velocity', 'delay', 'gate', 'weight', 'scale'])

export const keymapTriggerSchema = z.object({
  match: z.object({
    kind: z.enum(['key', 'code']),
    value: z.string().min(1).max(64).refine(
      (value) => !/^[A-Z]$/.test(value),
      'Single ASCII letter keymap triggers must be lowercase'
    ),
  }).strict(),
  modifiers: z.object({
    shift: z.boolean(),
    alt: z.boolean(),
    primary: z.boolean(),
    control: z.boolean(),
    meta: z.boolean(),
  }).strict(),
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
      amount: z.number().int().positive().max(1_000),
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
      'composition.cell.edit_sequence',
      'composition.cell.duplicate_right',
      'composition.cell.rename_or_create_sequence',
      'composition.cell.unassign',
      'composition.row.rename',
      'composition.row.channel',
      'composition.column.length',
      'composition.loop.set_start',
      'composition.loop.set_end',
      'edit.copy',
      'edit.cut',
      'edit.paste',
    ]),
    arguments: z.object({}).strict(),
  }),
  z.object({
    type: z.literal('ui_action'),
    action: z.literal('composition.selection.move'),
    arguments: z.object({
      direction: z.enum(['left', 'right', 'up', 'down']),
      amount: z.number().int().positive().max(1_000),
    }),
  }),
  z.object({
    type: z.literal('ui_action'),
    action: z.literal('modulator.mode.toggle'),
    arguments: z.object({}).strict(),
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
  repeat: z.enum(['allow', 'ignore']).optional(),
}).strict()

const keymapContexts = [
  'sequencer',
  'composition',
  'quick_access.browse',
  'quick_access.command',
  'quick_access.completions',
] as const

export const keymapDocumentSchema = z.object({
  schema_version: z.literal(KEYMAP_SCHEMA_VERSION),
  bindings: z.record(
    z.string().min(1).max(64).regex(/^[a-z0-9_.-]+$/),
    z.array(keymapBindingSchema)
  ),
}).strict().superRefine((document, context) => {
  Object.entries(document.bindings).forEach(([keymapContext, bindings]) => {
    if (!keymapContexts.includes(keymapContext as typeof keymapContexts[number])) {
      context.addIssue({
        code: 'custom',
        path: ['bindings', keymapContext],
        message: 'Unknown keymap context',
      })
    }
    const identities = new Set<string>()
    bindings.forEach((binding, index) => {
      const identity = JSON.stringify(binding.trigger)
      if (identities.has(identity)) {
        context.addIssue({
          code: 'custom',
          path: ['bindings', keymapContext, index],
          message: 'Duplicate keymap binding',
        })
      }
      identities.add(identity)
    })
  })
})

export const keymapStorageResourceSchema = z.object({
  revision: keymapRevisionSchema,
  document: z.unknown().nullable(),
})

export const preferencesResourceSchema = z.object({
  revision: preferencesRevisionSchema,
  document: z.record(z.string(), z.unknown()).nullable(),
})

export const instanceBindingSchema = z.object({
  session_id: z.string(),
  instance_id: z.string(),
  channel_id: z.string(),
}).strict()

export const sessionHelloSchema = z.object({
  protocol: z.literal(BRIDGE_PROTOCOL),
  plugin_version: z.string(),
  project_schema_version: z.literal(PROJECT_SCHEMA_VERSION),
  library_schema_version: z.literal(LIBRARY_SCHEMA_VERSION),
  catalog: catalogSchema,
  modulation: modulationCatalogSchema,
  binding: instanceBindingSchema,
  keymap: keymapStorageResourceSchema,
  preferences: preferencesResourceSchema,
})

export const envelopeSchema = z.object({
  protocol: z.literal(BRIDGE_PROTOCOL),
  type: z.enum(['request', 'response', 'event']),
  name: z.string(),
  request_id: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
})

export const commandStatusSchema = z.object({
  level: z.enum(['debug', 'info', 'warning', 'error']),
  message: z.string(),
})

export const commandResponseSchema = z.object({
  status: commandStatusSchema,
  suggested_selection: selectionSchema.nullable(),
  snapshot: projectSnapshotSchema,
})

export const documentOperationResultSchema = z.object({
  snapshot: projectSnapshotSchema,
  file: documentFileSchema.nullable(),
  suggested_selection: selectionSchema.nullable(),
}).strict()

export const previewBeginResponseSchema = z.object({
  status: commandStatusSchema,
  preview_id: z.string().min(1).nullable(),
  snapshot: projectSnapshotSchema,
})

export const previewEndResponseSchema = z.object({
  status: commandStatusSchema,
  snapshot: projectSnapshotSchema,
})

export const modulationPreviewUpdateResponseSchema = z.object({
  status: commandStatusSchema,
  preview_id: z.string().min(1),
  accepted_update_sequence: decimalRevisionSchema,
  accepted: z.boolean(),
  project_changed: z.boolean(),
  project_revision: decimalRevisionSchema,
  state_revision: decimalRevisionSchema,
}).strict()

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
    payload: keymapStorageResourceSchema,
  }),
  envelopeSchema.extend({
    type: z.literal('event'),
    name: z.literal('preferences.changed'),
    payload: preferencesResourceSchema,
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
    name: z.literal('phase.sync'),
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
export type SequenceEntryDto = z.infer<typeof sequenceEntrySchema>
export type ScaleDefinitionDto = z.infer<typeof scaleDefinitionSchema>
export type ProjectSnapshotDto = z.infer<typeof projectSnapshotSchema>
export type DocumentFileDto = z.infer<typeof documentFileSchema>
export type ContentFileDto = z.infer<typeof contentFileSchema>
export type LibrarySnapshotDto = z.infer<typeof librarySnapshotSchema>
export type CatalogDto = z.infer<typeof catalogSchema>
export type CatalogCommandDto = z.infer<typeof catalogCommandSchema>
export type SessionHelloDto = z.infer<typeof sessionHelloSchema>
export type ModulationCatalogDto = z.infer<typeof modulationCatalogSchema>
export type ModulationDefinitionDto = z.infer<typeof modulationDefinitionSchema>
export type ModulationDestinationDto = z.infer<typeof modulationDestinationSchema>
export type ModulationShapeDto = z.infer<typeof modulationShapeSchema>
export type ModulationOutputRangeDto = z.infer<typeof modulationOutputRangeSchema>
export type ModulationTargetDto = z.infer<typeof modulationTargetSchema>
export type InstanceBindingDto = SessionHelloDto['binding']
export type CommandExecuteResponseDto = z.infer<typeof commandResponseSchema>
export type DocumentOperationResultDto = z.infer<typeof documentOperationResultSchema>
export type InputModeDto = z.infer<typeof inputModeSchema>
export type KeymapTriggerDto = z.infer<typeof keymapTriggerSchema>
export type KeymapTargetDto = z.infer<typeof keymapTargetSchema>
export type KeymapBindingDto = z.infer<typeof keymapBindingSchema>
export type KeymapDocumentDto = z.infer<typeof keymapDocumentSchema>
export type KeymapStorageResourceDto = z.infer<typeof keymapStorageResourceSchema>
export type PreferencesResourceDto = z.infer<typeof preferencesResourceSchema>

export const parseEnvelope = (value: unknown): EnvelopeDto => envelopeSchema.parse(value)
export const parseSessionHello = (value: unknown): SessionHelloDto => sessionHelloSchema.parse(value)
export const parseProjectSnapshot = (value: unknown): ProjectSnapshotDto =>
  projectSnapshotSchema.parse(value)
export const parseLibrarySnapshot = (value: unknown): LibrarySnapshotDto =>
  librarySnapshotSchema.parse(value)
export const parseCommandResponse = (value: unknown): CommandExecuteResponseDto =>
  commandResponseSchema.parse(value)
export const parseBridgeEvent = (value: unknown) => bridgeEventSchema.parse(value)

export type PreviewBeginResponseDto = z.infer<typeof previewBeginResponseSchema>
export type PreviewEndResponseDto = z.infer<typeof previewEndResponseSchema>
export type ModulationPreviewUpdateResponseDto = z.infer<
  typeof modulationPreviewUpdateResponseSchema
>
export const parseKeymapDocument = (value: unknown): KeymapDocumentDto =>
  keymapDocumentSchema.parse(value)
export const parseKeymapStorageResource = (value: unknown): KeymapStorageResourceDto =>
  keymapStorageResourceSchema.parse(value)
export const parsePreferencesResource = (value: unknown): PreferencesResourceDto =>
  preferencesResourceSchema.parse(value)
