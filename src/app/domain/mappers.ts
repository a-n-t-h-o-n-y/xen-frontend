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
  Measure,
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

const emptyMeasureEntry = {
  id: 0,
  cell: {
    weight: 1,
    elements: [],
  },
}

const measureName = (id: number): string => `M${id}`

const compositionFromDto = (
  composition: ProjectSnapshotDto['project']['composition']
): Composition => {
  const lastColumnIndex = Math.max(0, composition.columns.length - 1)
  return {
    columns: composition.columns.map((column) => ({
      length: {
        numerator: column.duration.numerator,
        denominator: column.duration.denominator,
      },
      pitch: pitchFromDto(column.pitch),
    })),
    rows: composition.rows.map((row, index) => ({
      name: row.name || row.channel_id || `Row ${index + 1}`,
      channelId: row.channel_id,
      cells: row.cells,
    })),
    loopRegion: {
      startColumn: composition.loop_region?.start_column ?? 0,
      endColumn: composition.loop_region?.end_column ?? lastColumnIndex,
    },
  }
}

const arrangedMeasureFromDto = (snapshot: ProjectSnapshotDto): Measure => {
  const composition = snapshot.project.composition
  const firstRow = composition.rows[0]
  const measureId = firstRow?.cells[0] ?? null
  const measureEntry = measureId === null
    ? snapshot.project.sequence_bank.sequences[0]
    : snapshot.project.sequence_bank.sequences.find((entry) => entry.id === measureId)
  const columnLength = composition.columns[0]?.duration ?? { numerator: 4, denominator: 4 }

  return {
    cell: (measureEntry ?? emptyMeasureEntry).cell,
    timeSignature: {
      numerator: columnLength.numerator,
      denominator: columnLength.denominator,
    },
  }
}

export const projectFromDto = (snapshot: ProjectSnapshotDto): ProjectSnapshot => {
  const pitchState = snapshot.project.composition.columns[0]?.pitch
  const fallbackPitch = { tuning: { name: '', definition: { intervals: [], octave: 1200 } }, scale: null, transposition: 0, translation_direction: 'up' as const, base_frequency: 440 }
  return {
    revision: snapshot.project_revision,
    historyEntryId: snapshot.history_entry_id,
    measure: arrangedMeasureFromDto(snapshot),
    measureBank: {
          nextId: snapshot.project.sequence_bank.next_id,
          measures: snapshot.project.sequence_bank.sequences.map((entry) => ({
            id: entry.id,
            name: entry.name || measureName(entry.id),
            measure: { cell: entry.cell },
          })),
        },
    composition: compositionFromDto(snapshot.project.composition),
    pitch: pitchFromDto(pitchState ?? fallbackPitch),
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
    path: entry.path,
    command: entry.command,
    description: '',
    intervals: [],
    octave: null,
    noteCount: null,
  })),
  compositions: snapshot.compositions.map((entry) => ({
    name: entry.name,
    relativePath: entry.relative_path,
    stem: entry.stem,
    path: entry.path,
    command: entry.command,
    description: '',
    intervals: [],
    octave: null,
    noteCount: null,
  })),
  tunings: snapshot.tunings.map((entry) => ({
    name: entry.name,
    relativePath: entry.relative_path,
    stem: entry.stem,
    path: entry.path,
    command: entry.command,
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
    row_index: context.activeMeasureTarget?.rowIndex ?? 0,
    column_index: context.activeMeasureTarget?.columnIndex ?? 0,
    sequence_id: context.activeMeasureTarget?.measureId ?? null,
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
