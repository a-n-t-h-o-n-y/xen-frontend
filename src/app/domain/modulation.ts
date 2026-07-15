import { clampNumber } from './music'
import type {
  ModulationCatalogDto,
  ModulationDefinitionDto,
  ModulationDestinationDto,
  ModulationOutputRangeDto,
  ModulationShapeDto,
} from './contracts'

export type ModulationCatalog = ModulationCatalogDto
export type ModulationDestination = ModulationDestinationDto
export type ModulationDestinationId = ModulationDestination['id']
export type ModulationOutputRange = ModulationOutputRangeDto
export type ModulationDefinition = ModulationDefinitionDto
export type ModulationShape = ModulationShapeDto
export type ModulationOperation = ModulationDefinition['operation']
export type ModulationWaveform = ModulationDefinition['waveforms'][number]

export type EditorWaveform = ModulationWaveform & { id: string }

export type ModulationEditorState = {
  operation: ModulationOperation
  waveforms: EditorWaveform[]
  selectedWaveformId: string
  outputRanges: Record<ModulationDestinationId, ModulationOutputRange>
}

export const MODULATION_DESTINATION_LABELS: Record<ModulationDestinationId, string> = {
  pitch: 'Pitch',
  velocity: 'Velocity',
  delay: 'Delay',
  gate: 'Gate',
  weight: 'Weight',
  midi_cc: 'MIDI CC',
}

export const MODULATION_SHAPE_LABELS: Record<ModulationShape, string> = {
  sine: 'Sine',
  triangle: 'Triangle',
  sawtooth_up: 'Saw Up',
  sawtooth_down: 'Saw Down',
  square: 'Square',
}

export const MODULATION_OPERATION_LABELS: Record<ModulationOperation, string> = {
  average: 'Average',
  sum: 'Sum',
  product: 'Product',
  am: 'AM',
  ring: 'Ring',
  fm: 'FM',
  pm: 'PM',
}

let waveformId = 0

export const createEditorWaveform = (
  shape: ModulationShape = 'sine',
  enabled = true
): EditorWaveform => ({
  id: `waveform-${waveformId += 1}`,
  enabled,
  shape,
  frequency: 1,
  phase: 0,
  amplitude: 1,
  amplitude_offset: 0,
})

export const createDefaultOutputRanges = (
  tuningLength: number
): Record<ModulationDestinationId, ModulationOutputRange> => ({
  pitch: {
    minimum: -2 * Math.max(1, Math.trunc(tuningLength)),
    maximum: 2 * Math.max(1, Math.trunc(tuningLength)),
  },
  velocity: { minimum: 0, maximum: 1 },
  delay: { minimum: 0, maximum: 1 },
  gate: { minimum: 0, maximum: 1 },
  weight: { minimum: 0.1, maximum: 2 },
  midi_cc: { minimum: 0, maximum: 1 },
})

export const createInitialModulationEditorState = (
  catalog: ModulationCatalog,
  tuningLength: number
): ModulationEditorState => {
  const shape = catalog.waveform_shapes.includes('sine')
    ? 'sine'
    : catalog.waveform_shapes[0] ?? 'sine'
  const waveform = createEditorWaveform(shape)
  const operation = catalog.operations.find((entry) => entry.id === 'average')?.id
    ?? catalog.operations[0]?.id
    ?? 'average'
  return {
    operation,
    waveforms: [waveform],
    selectedWaveformId: waveform.id,
    outputRanges: createDefaultOutputRanges(tuningLength),
  }
}

export const editorStateToDefinition = (
  state: ModulationEditorState
): ModulationDefinition => ({
  operation: state.operation,
  waveforms: state.waveforms.map((waveform) => ({
    enabled: waveform.enabled,
    shape: waveform.shape,
    frequency: waveform.frequency,
    phase: waveform.phase,
    amplitude: waveform.amplitude,
    amplitude_offset: waveform.amplitude_offset,
  })),
})

export const getSelectedWaveform = (
  state: ModulationEditorState
): EditorWaveform => state.waveforms.find((waveform) => waveform.id === state.selectedWaveformId)
  ?? state.waveforms[0]
  ?? createEditorWaveform()

export const getEnabledWaveforms = (
  definition: ModulationDefinition
): ModulationWaveform[] => definition.waveforms.filter((waveform) => waveform.enabled)

export const operationAcceptsEnabledCount = (
  catalog: ModulationCatalog,
  operation: ModulationOperation,
  count: number
): boolean => {
  const definition = catalog.operations.find((entry) => entry.id === operation)
  if (!definition) return false
  if (operation === 'am' || operation === 'ring' || operation === 'fm' || operation === 'pm') {
    return count === 2
  }
  if (definition.enabled_waveforms !== undefined) return count === definition.enabled_waveforms
  return count >= (definition.minimum_enabled_waveforms ?? 1)
}

export const isBinaryOperation = (
  catalog: ModulationCatalog,
  operation: ModulationOperation
): boolean => {
  const definition = catalog.operations.find((entry) => entry.id === operation)
  return definition?.enabled_waveforms === 2 ||
    operation === 'am' || operation === 'ring' || operation === 'fm' || operation === 'pm'
}

export const normalizeWaveformsForOperation = (
  catalog: ModulationCatalog,
  operation: ModulationOperation,
  waveforms: EditorWaveform[]
): EditorWaveform[] => {
  if (!isBinaryOperation(catalog, operation)) return waveforms
  const next = [...waveforms]
  while (next.length < 2) {
    next.push(createEditorWaveform(catalog.waveform_shapes[0] ?? 'sine'))
  }
  return next.map((waveform, index) => ({ ...waveform, enabled: index < 2 }))
}

const isPositiveFloat32 = (value: number): boolean => {
  const converted = Math.fround(value)
  return Number.isFinite(value) && Number.isFinite(converted) && converted > 0
}

export const validateOutputRange = (
  destination: ModulationDestination,
  range: ModulationOutputRange
): string | null => {
  if (!Number.isFinite(range.minimum) || !Number.isFinite(range.maximum)) {
    return 'Range endpoints must be finite numbers.'
  }
  if (range.minimum > range.maximum) return 'Minimum must not exceed maximum.'
  if (destination.id === 'pitch') {
    if (!Number.isInteger(range.minimum) || !Number.isInteger(range.maximum)) {
      return 'Pitch range endpoints must be integers.'
    }
    if (
      range.minimum < -2_147_483_648 || range.minimum > 2_147_483_647 ||
      range.maximum < -2_147_483_648 || range.maximum > 2_147_483_647
    ) return 'Pitch range endpoints must fit a 32-bit integer.'
    return null
  }
  if (destination.id === 'weight') {
    return isPositiveFloat32(range.minimum) && isPositiveFloat32(range.maximum)
      ? null
      : 'Weight range endpoints must be positive 32-bit floats.'
  }
  return range.minimum >= 0 && range.maximum <= 1
    ? null
    : 'This destination range must stay between 0 and 1.'
}

export const validateModulationDefinition = (
  catalog: ModulationCatalog,
  definition: ModulationDefinition
): string | null => {
  if (definition.waveforms.length < 1 || definition.waveforms.length > catalog.maximum_waveforms) {
    return `Use between 1 and ${catalog.maximum_waveforms} waveforms.`
  }
  const enabledCount = getEnabledWaveforms(definition).length
  if (!operationAcceptsEnabledCount(catalog, definition.operation, enabledCount)) {
    return 'The enabled waveform count does not satisfy the selected operation.'
  }
  for (const waveform of definition.waveforms) {
    if (!catalog.waveform_shapes.includes(waveform.shape)) return 'Unsupported waveform shape.'
    for (const [key, value] of Object.entries({
      frequency: waveform.frequency,
      phase: waveform.phase,
      amplitude: waveform.amplitude,
      amplitude_offset: waveform.amplitude_offset,
    })) {
      const range = catalog.waveform_parameters[key as keyof typeof catalog.waveform_parameters]
      if (!Number.isFinite(value) || value < range.minimum || value > range.maximum) {
        return `${key.replace('_', ' ')} must be between ${range.minimum} and ${range.maximum}.`
      }
    }
  }
  return null
}

const TABLE_SIZE = 1024
const shapeTables = new Map<ModulationShape, Float64Array>()

const directShape = (shape: ModulationShape, phase: number): number => {
  const wrapped = ((phase % 1) + 1) % 1
  if (shape === 'sine') return Math.sin(wrapped * Math.PI * 2)
  if (shape === 'triangle') return 1 - 4 * Math.abs(wrapped - 0.5)
  if (shape === 'sawtooth_up') return wrapped * 2 - 1
  if (shape === 'sawtooth_down') return 1 - wrapped * 2
  return wrapped < 0.5 ? 1 : -1
}

export const sampleModulationShape = (shape: ModulationShape, phase: number): number => {
  if (shape === 'square') return directShape(shape, phase)
  let table = shapeTables.get(shape)
  if (!table) {
    table = new Float64Array(TABLE_SIZE)
    for (let index = 0; index < TABLE_SIZE; index += 1) {
      table[index] = directShape(shape, index / TABLE_SIZE)
    }
    shapeTables.set(shape, table)
  }
  const position = (((phase % 1) + 1) % 1) * TABLE_SIZE
  const lowerIndex = Math.floor(position) % TABLE_SIZE
  const upperIndex = (lowerIndex + 1) % TABLE_SIZE
  const fraction = position - Math.floor(position)
  return (table[lowerIndex] ?? 0) * (1 - fraction) + (table[upperIndex] ?? 0) * fraction
}

export const sampleWaveform = (waveform: ModulationWaveform, x: number): number =>
  waveform.amplitude_offset + waveform.amplitude * sampleModulationShape(
    waveform.shape,
    waveform.frequency * x + waveform.phase
  )

export const frequencyFromWavelengthPointer = (
  pointerDistance: number,
  sequenceWidth: number,
  range: { minimum: number; maximum: number }
): number => {
  if (pointerDistance <= 0) return range.maximum
  const frequency = Math.max(sequenceWidth, 1) / pointerDistance
  return clampNumber(frequency, range.minimum, range.maximum)
}

export const phaseFromWavelengthDrag = (
  startPhase: number,
  pointerDelta: number,
  sequenceWidth: number,
  frequency: number,
  range: { minimum: number; maximum: number }
): number => {
  const rangeWidth = range.maximum - range.minimum
  if (rangeWidth <= 0) return range.minimum
  const phaseDelta = pointerDelta / Math.max(sequenceWidth, 1) * frequency
  const value = startPhase - phaseDelta
  return ((value - range.minimum) % rangeWidth + rangeWidth) % rangeWidth + range.minimum
}

export const sampleCombinedModulation = (
  definition: ModulationDefinition,
  x: number,
  previousFmPhase = 0,
  step = 1 / 256
): { value: number; fmPhase: number } => {
  const enabled = getEnabledWaveforms(definition)
  const values = enabled.map((waveform) => sampleWaveform(waveform, x))
  if (definition.operation === 'average') {
    return { value: values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1), fmPhase: previousFmPhase }
  }
  if (definition.operation === 'sum') {
    return { value: values.reduce((sum, value) => sum + value, 0), fmPhase: previousFmPhase }
  }
  if (definition.operation === 'product') {
    return { value: values.reduce((product, value) => product * value, 1), fmPhase: previousFmPhase }
  }
  const carrier = enabled[0]
  const modulator = enabled[1]
  if (!carrier || !modulator) return { value: 0, fmPhase: previousFmPhase }
  const carrierRaw = values[0] ?? 0
  const modulatorRaw = values[1] ?? 0
  if (definition.operation === 'am') {
    return { value: carrierRaw * clampNumber((modulatorRaw + 1) / 2, 0, 1), fmPhase: previousFmPhase }
  }
  if (definition.operation === 'ring') {
    return { value: carrierRaw * modulatorRaw, fmPhase: previousFmPhase }
  }
  if (definition.operation === 'pm') {
    return {
      value: carrier.amplitude_offset + carrier.amplitude * sampleModulationShape(
        carrier.shape,
        carrier.frequency * x + carrier.phase + modulatorRaw
      ),
      fmPhase: previousFmPhase,
    }
  }
  const nextFmPhase = previousFmPhase + (carrier.frequency + modulatorRaw) * step
  return {
    value: carrier.amplitude_offset + carrier.amplitude * sampleModulationShape(
      carrier.shape,
      nextFmPhase + carrier.phase
    ),
    fmPhase: nextFmPhase,
  }
}

export const createModulationPlotPaths = (
  state: ModulationEditorState,
  samples = 256
): { waveforms: Array<{ id: string; points: string }>; combined: string } => {
  const definition = editorStateToDefinition(state)
  const waveforms = state.waveforms.filter((waveform) => waveform.enabled).map((waveform) => {
    const points: string[] = []
    for (let index = 0; index <= samples; index += 1) {
      const x = index / samples
      const value = sampleWaveform(waveform, x)
      points.push(`${(x * 100).toFixed(2)},${((1 - (value + 1) / 2) * 100).toFixed(2)}`)
    }
    return { id: waveform.id, points: points.join(' ') }
  })
  const combined: string[] = []
  let fmPhase = 0
  for (let index = 0; index <= samples; index += 1) {
    const x = index / samples
    const sampled = sampleCombinedModulation(definition, x, fmPhase, 1 / samples)
    fmPhase = sampled.fmPhase
    const y = (1 - (clampNumber(sampled.value, -1, 1) + 1) / 2) * 100
    combined.push(`${(x * 100).toFixed(2)},${y.toFixed(2)}`)
  }
  return { waveforms, combined: combined.join(' ') }
}
