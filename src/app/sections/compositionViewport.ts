import {
  MAX_COMPOSITION_COORDINATE,
  MIN_COMPOSITION_COORDINATE,
} from '../domain/composition'

export const buildVirtualCoordinateRange = (center: number, radius: number): Array<number | null> =>
  Array.from({ length: radius * 2 + 1 }, (_, index) => {
    const coordinate = center + index - radius
    return coordinate < MIN_COMPOSITION_COORDINATE || coordinate > MAX_COMPOSITION_COORDINATE
      ? null
      : coordinate
  })
