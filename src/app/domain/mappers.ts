import type {
  CatalogDto,
  CommandExecuteResponseDto,
  KeymapDocumentDto,
  KeymapStorageResourceDto,
  KeymapTargetDto,
  KeymapTriggerDto,
  LibrarySnapshotDto,
  ProjectSnapshotDto,
  ScaleDefinitionDto,
  SelectionDto,
} from './contracts'
import type {
  Composition,
  CommandContext,
  CommandExecuteResponse,
  KeymapResource,
  LibraryScaleEntry,
  LibrarySnapshot,
  Sequence,
  ProjectSnapshot,
  Scale,
  SessionReference,
} from './models'
import type { KeymapBinding, KeymapDocument, KeymapTarget, KeymapTrigger } from './keymap'
import { defaultKeymapDocument } from './defaultKeymap'
import { keymapDocumentSchema } from './contracts'
import { isUiActionAllowedInContext } from './uiActions'

export const scaleFromDto = (definition: ScaleDefinitionDto): Scale => ({
  name: definition.name,
  tuningLength: definition.tuning_length,
  intervals: definition.intervals,
  mode: definition.mode,
})

const emptySequenceEntry = {
  id: 0,
  cell: {
    weight: 1,
    elements: [],
  },
}

const sequenceName = (id: number): string => `S${id}`

const compositionFromDto = (
  composition: ProjectSnapshotDto['project']['composition']
): Composition => {
  const defaultColumn = {
    length: {
      numerator: composition.default_column.duration.numerator,
      denominator: composition.default_column.duration.denominator,
    },
    pitch: pitchFromDto(composition.default_column.pitch),
  }
  return {
    defaultColumn,
    columns: new Map(composition.columns.map((column) => [column.coordinate, {
      coordinate: column.coordinate,
      length: {
        numerator: column.duration.numerator,
        denominator: column.duration.denominator,
      },
      pitch: pitchFromDto(column.pitch),
    }])),
    rows: new Map(composition.rows.map((row) => [row.coordinate, {
      coordinate: row.coordinate,
      name: row.name || row.channel_id || `Row ${row.coordinate}`,
      channelId: row.channel_id,
    }])),
    placements: new Map(composition.placements.map((placement) => [
      `${placement.row},${placement.column}`,
      {
        rowCoordinate: placement.row,
        columnCoordinate: placement.column,
        sequenceId: placement.sequence_id,
      },
    ])),
    loopRegion: {
      startColumn: composition.loop_region.start_column,
      endColumn: composition.loop_region.end_column,
    },
  }
}

const arrangedSequenceFromDto = (snapshot: ProjectSnapshotDto): Sequence => {
  const composition = snapshot.project.composition
  const firstPlacement = composition.placements[0]
  const sequenceEntry = firstPlacement === undefined
    ? snapshot.project.sequence_bank.sequences[0]
    : snapshot.project.sequence_bank.sequences.find((entry) => entry.id === firstPlacement.sequence_id)
  const columnLength = firstPlacement === undefined
    ? composition.default_column.duration
    : composition.columns.find((column) => column.coordinate === firstPlacement.column)?.duration ??
      composition.default_column.duration

  return {
    cell: (sequenceEntry ?? emptySequenceEntry).cell,
    timeSignature: {
      numerator: columnLength.numerator,
      denominator: columnLength.denominator,
    },
  }
}

export const projectFromDto = (snapshot: ProjectSnapshotDto): ProjectSnapshot => {
  const pitchState = snapshot.project.composition.default_column.pitch
  return {
    stateRevision: snapshot.state_revision,
    projectRevision: snapshot.project_revision,
    historyEntryId: snapshot.history_entry_id,
    previewActive: snapshot.preview_active,
    document: {
      relativePath: snapshot.document.relative_path,
      displayName: snapshot.document.display_name,
      dirty: snapshot.document.dirty,
      fileRevision: snapshot.document.file_revision,
    },
    recovery: snapshot.recovery ? {
      revision: snapshot.recovery.revision,
      savedAtUnixMs: snapshot.recovery.saved_at_unix_ms,
      relativePath: snapshot.recovery.relative_path,
      projectRevision: snapshot.recovery.project_revision,
    } : null,
    sequence: arrangedSequenceFromDto(snapshot),
    sequenceBank: {
          nextId: snapshot.project.sequence_bank.next_id,
          sequences: snapshot.project.sequence_bank.sequences.map((entry) => ({
            id: entry.id,
            name: entry.name || sequenceName(entry.id),
            sequence: { cell: entry.cell },
          })),
        },
    composition: compositionFromDto(snapshot.project.composition),
    pitch: pitchFromDto(pitchState),
  }
}

const pitchFromDto = (pitchState: ProjectSnapshotDto['project']['composition']['columns'][number]['pitch']) => ({
      tuning: pitchState.tuning,
      scale: pitchState.scale
        ? {
            sourceId: pitchState.scale.source_id,
            definition: scaleFromDto(pitchState.scale.definition),
          }
        : null,
      transposition: pitchState.transposition,
      translationDirection: pitchState.translation_direction,
      baseFrequency: pitchState.base_frequency,
    })

export const libraryFromDto = (snapshot: LibrarySnapshotDto): LibrarySnapshot => ({
  revision: snapshot.library_revision,
  paths: snapshot.paths,
  cells: snapshot.cells.map((entry) => ({
    name: entry.name,
    relativePath: entry.relative_path,
    stem: entry.stem,
    fileRevision: entry.file_revision,
    command: entry.command,
  })),
  projects: snapshot.projects.map((entry) => ({
    name: entry.name,
    relativePath: entry.relative_path,
    stem: entry.stem,
    fileRevision: entry.file_revision,
    command: entry.command,
  })),
  tunings: snapshot.tunings.map((entry) => ({
    name: entry.name,
    relativePath: entry.relative_path,
    stem: entry.stem,
    command: entry.command,
    fileRevision: entry.file_revision,
    description: entry.description,
    intervals: entry.intervals,
    octave: entry.octave,
    noteCount: entry.note_count,
  })),
  scales: snapshot.scales.map((scale): LibraryScaleEntry => {
    if (scale.definition === null) {
      return {
        id: scale.id,
        name: 'chromatic',
        definition: null,
        intervals: [],
        command: scale.command,
      }
    }

    return {
      id: scale.id,
      definition: scaleFromDto(scale.definition),
      command: scale.command,
    }
  }),
  chords: snapshot.chords,
  commands: {
    reloadScales: snapshot.commands.reload_scales,
    reloadChords: snapshot.commands.reload_chords,
    libraryDirectory: snapshot.commands.library_directory,
  },
})

export const triggerFromDto = (trigger: KeymapTriggerDto): KeymapTrigger => ({
  match: trigger.match,
  modifiers: trigger.modifiers,
  ...(trigger.when ? { when: { inputMode: trigger.when.input_mode } } : {}),
})

export const triggerToDto = (trigger: KeymapTrigger): KeymapTriggerDto => ({
  match: trigger.match,
  modifiers: trigger.modifiers,
  when: trigger.when ? { input_mode: trigger.when.inputMode } : undefined,
})

export const targetFromDto = (target: KeymapTargetDto): KeymapTarget => target as KeymapTarget
export const targetToDto = (target: KeymapTarget): KeymapTargetDto => target as KeymapTargetDto

const bindingFromDto = (binding: KeymapDocumentDto['bindings'][string][number]): KeymapBinding => ({
  trigger: triggerFromDto(binding.trigger),
  target: targetFromDto(binding.target),
  ...(binding.repeat ? { repeat: binding.repeat } : {}),
})

const documentFromDto = (document: KeymapDocumentDto): KeymapDocument => ({
  schemaVersion: 2,
  bindings: Object.fromEntries(Object.entries(document.bindings).map(([context, bindings]) => [
    context,
    bindings.map(bindingFromDto),
  ])),
})

const cloneDocument = (document: KeymapDocument): KeymapDocument => ({
  schemaVersion: 2,
  bindings: Object.fromEntries(Object.entries(document.bindings).map(([context, bindings]) => [
    context,
    bindings.map((binding) => ({
      ...binding,
      trigger: {
        ...binding.trigger,
        match: { ...binding.trigger.match },
        modifiers: { ...binding.trigger.modifiers },
        ...(binding.trigger.when ? { when: { ...binding.trigger.when } } : {}),
      },
      target: structuredClone(binding.target),
    })),
  ])),
})

export const keymapFromDto = (resource: KeymapStorageResourceDto): KeymapResource => {
  const parsed = resource.document === null
    ? null
    : keymapDocumentSchema.safeParse(resource.document)
  const invalidAction = parsed?.success
    ? Object.entries(parsed.data.bindings).flatMap(([context, bindings]) =>
        bindings.filter((binding) =>
          binding.target.type === 'ui_action' &&
          !isUiActionAllowedInContext(binding.target.action, context)
        ).map((binding) => `${binding.target.type === 'ui_action' ? binding.target.action : ''} in ${context}`)
      )[0]
    : undefined
  const loadError = parsed && (!parsed.success || invalidAction)
    ? `Stored shortcuts were ignored: ${parsed.success
        ? `action ${invalidAction} is not allowed`
        : parsed.error.issues[0]?.message ?? 'invalid document'}`
    : null
  const document = parsed?.success && !invalidAction
    ? documentFromDto(parsed.data)
    : cloneDocument(defaultKeymapDocument)
  return {
    revision: resource.revision,
    keySemantics: 'KeyboardEvent.key-or-code',
    bindings: document.bindings,
    document,
    source: parsed?.success && !invalidAction ? 'stored' : 'default',
    loadError,
  }
}

export const sessionReferenceFromCatalogDto = (catalog: CatalogDto): SessionReference => ({
  commands: catalog.commands.map((command) => {
    const id = command.path.join(' ')
    const argumentsText = command.arguments.map((argument) => {
      const label = argument.default_value === null
        ? argument.display_name
        : `${argument.display_name}=${argument.default_value}`
      return argument.required ? `<${label}>` : `[${label}]`
    })
    return {
      id,
      signature: [id, ...argumentsText].join(' '),
      keywords: command.keywords,
      description: command.description,
      targetRequirement: command.target_requirement,
      acceptsPatternPrefix: command.accepts_pattern_prefix,
      arguments: command.arguments.map((argument) => ({
        kind: argument.kind,
        displayName: argument.display_name,
        required: argument.required,
        defaultValue: argument.default_value,
        constraints: argument.constraints.map((constraint) => ({
          kind: constraint.kind,
          minimum: constraint.minimum,
          maximum: constraint.maximum,
          values: constraint.values,
        })),
      })),
    }
  }),
})

export const commandResponseFromDto = (
  response: CommandExecuteResponseDto
): CommandExecuteResponse => ({
  status: response.status,
  suggestedSelection: response.suggested_selection,
  snapshot: projectFromDto(response.snapshot),
})

export const commandContextToDto = (context: CommandContext) => ({
  expected_project_revision: context.expectedProjectRevision,
  selection: context.selection as SelectionDto,
  cursor: {
    row_coordinate: context.cursor.rowCoordinate,
    column_coordinate: context.cursor.columnCoordinate,
    sequence_id: context.cursor.sequenceId,
  },
})

export const keymapDocumentToDto = (document: KeymapDocument): KeymapDocumentDto => ({
  schema_version: 2,
  bindings: Object.fromEntries(Object.entries(document.bindings).map(([context, bindings]) => [
    context,
    bindings.map((binding) => ({
      trigger: triggerToDto(binding.trigger),
      target: targetToDto(binding.target),
      ...(binding.repeat ? { repeat: binding.repeat } : {}),
    })),
  ])),
})
