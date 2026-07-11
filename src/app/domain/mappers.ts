import type {
  CatalogDto,
  CommandExecuteResponseDto,
  MeasureEntryDto,
  KeymapBindingDto,
  KeymapOverrideDto,
  KeymapResourceDto,
  KeymapTargetDto,
  KeymapTriggerDto,
  LibrarySnapshotDto,
  MeasureDto,
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
import type { KeymapBinding, KeymapOverride, KeymapTarget, KeymapTrigger } from './keymap'

export const scaleFromDto = (definition: ScaleDefinitionDto): Scale => ({
  name: definition.name,
  tuningLength: definition.tuning_length,
  intervals: definition.intervals,
  mode: definition.mode,
})

const measureFromDto = (measure: MeasureDto): Measure => ({
  cell: measure.cell,
  timeSignature: {
    numerator: measure.time_signature.numerator,
    denominator: measure.time_signature.denominator,
  },
})

const emptyMeasureEntry: MeasureEntryDto = {
  id: 0,
  measure: {
    cell: {
      weight: 1,
      elements: [],
    },
  },
}

const measureName = (id: number): string => `M${id}`

const compositionFromDto = (
  composition: Extract<ProjectSnapshotDto, { schema_version: 3 }>['project']['composition']
): Composition => {
  const lastColumnIndex = Math.max(0, composition.columns.length - 1)
  return {
    columns: composition.columns.map((column) => ({
      length: {
        numerator: column.length.numerator,
        denominator: column.length.denominator,
      },
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
  if (snapshot.schema_version === 1) {
    return measureFromDto(snapshot.project.measure)
  }

  const composition = snapshot.project.composition
  const firstRow = composition.rows[0]
  const measureId = firstRow?.cells[0] ?? null
  const measureEntry = measureId === null
    ? snapshot.project.measure_bank.measures[0]
    : snapshot.project.measure_bank.measures.find((entry) => entry.id === measureId)
  const columnLength = composition.columns[0]?.length ?? { numerator: 4, denominator: 4 }

  return {
    cell: (measureEntry ?? emptyMeasureEntry).measure.cell,
    timeSignature: {
      numerator: columnLength.numerator,
      denominator: columnLength.denominator,
    },
  }
}

export const projectFromDto = (snapshot: ProjectSnapshotDto): ProjectSnapshot => {
  const pitchState = snapshot.project.pitch
  const isArrangedProject = snapshot.schema_version === 3
  return {
    revision: snapshot.project_revision,
    historyEntryId: snapshot.history_entry_id,
    measure: arrangedMeasureFromDto(snapshot),
    measureBank: isArrangedProject
      ? {
          nextId: snapshot.project.measure_bank.next_id,
          measures: snapshot.project.measure_bank.measures.map((entry) => ({
            id: entry.id,
            name: entry.name || measureName(entry.id),
            measure: entry.measure,
          })),
        }
      : null,
    composition: isArrangedProject ? compositionFromDto(snapshot.project.composition) : null,
    pitch: {
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
    },
  }
}

export const libraryFromDto = (snapshot: LibrarySnapshotDto): LibrarySnapshot => ({
  revision: snapshot.library_revision,
  paths: snapshot.paths,
  measures: snapshot.measures.map((entry) => ({
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
  key: trigger.key,
  modifiers: trigger.modifiers,
  ...(trigger.when ? { when: { inputMode: trigger.when.input_mode } } : {}),
})

export const triggerToDto = (trigger: KeymapTrigger): KeymapTriggerDto => ({
  key: trigger.key,
  modifiers: trigger.modifiers,
  when: trigger.when ? { input_mode: trigger.when.inputMode } : undefined,
})

export const targetFromDto = (target: KeymapTargetDto): KeymapTarget => target
export const targetToDto = (target: KeymapTarget): KeymapTargetDto => target

const bindingFromDto = (binding: KeymapBindingDto): KeymapBinding => ({
  trigger: triggerFromDto(binding.trigger),
  target: targetFromDto(binding.target),
})

const overrideFromDto = (override: KeymapOverrideDto): KeymapOverride => ({
  context: override.context,
  trigger: triggerFromDto(override.trigger),
  target: override.target ? targetFromDto(override.target) : null,
})

export const keymapFromDto = (resource: KeymapResourceDto): KeymapResource => ({
  revision: resource.revision,
  keySemantics: resource.key_semantics,
  bindings: Object.fromEntries(
    Object.entries(resource.bindings).map(([context, bindings]) => [
      context,
      bindings.map(bindingFromDto),
    ])
  ),
  overrides: resource.overrides.map(overrideFromDto),
})

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
  active_measure_target: context.activeMeasureTarget
    ? {
        row_index: context.activeMeasureTarget.rowIndex,
        column_index: context.activeMeasureTarget.columnIndex,
        measure_id: context.activeMeasureTarget.measureId,
      }
    : null,
})

export const keymapOverrideSetRequestToDto = (
  expectedRevision: number,
  payload: {
    context: string
    trigger: KeymapTrigger
    target: KeymapTarget | null
  }
) => ({
  expected_revision: expectedRevision,
  context: payload.context,
  trigger: triggerToDto(payload.trigger),
  target: payload.target ? targetToDto(payload.target) : null,
})

export const keymapOverrideRemoveRequestToDto = (
  expectedRevision: number,
  payload: {
    context: string
    trigger: KeymapTrigger
  }
) => ({
  expected_revision: expectedRevision,
  context: payload.context,
  trigger: triggerToDto(payload.trigger),
})
