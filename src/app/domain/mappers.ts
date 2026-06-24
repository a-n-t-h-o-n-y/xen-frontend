import type {
  CatalogDto,
  CommandExecuteResponseDto,
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

export const projectFromDto = (snapshot: ProjectSnapshotDto): ProjectSnapshot => ({
  revision: snapshot.project_revision,
  historyEntryId: snapshot.history_entry_id,
  measure: measureFromDto(snapshot.project.measure),
  pitch: {
    tuning: snapshot.project.pitch.tuning,
    scale: snapshot.project.pitch.scale
      ? {
          sourceId: snapshot.project.pitch.scale.source_id,
          definition: scaleFromDto(snapshot.project.pitch.scale.definition),
        }
      : null,
    transposition: snapshot.project.pitch.transposition,
    translationDirection: snapshot.project.pitch.translation_direction,
    baseFrequency: snapshot.project.pitch.base_frequency,
  },
})

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
  when: trigger.when ? { inputMode: trigger.when.input_mode } : undefined,
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
