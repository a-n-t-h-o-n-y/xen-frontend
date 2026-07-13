import {
  MAX_COMPOSITION_COORDINATE,
  MIN_COMPOSITION_COORDINATE,
} from '../domain/composition'
import type { CompositionLength } from '../domain/models'

export const buildVirtualCoordinateRange = (center: number, radius: number): Array<number | null> =>
  Array.from({ length: radius * 2 + 1 }, (_, index) => {
    const coordinate = center + index - radius
    return coordinate < MIN_COMPOSITION_COORDINATE || coordinate > MAX_COMPOSITION_COORDINATE
      ? null
      : coordinate
  })

export const getCompositionColumnBeats = (length: CompositionLength): number =>
  length.denominator > 0 ? length.numerator * (4 / length.denominator) : 1
