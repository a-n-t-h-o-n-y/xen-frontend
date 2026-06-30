const interpolateColor = (
  left: [number, number, number],
  right: [number, number, number],
  ratio: number
): [number, number, number] => [
  Math.round(left[0] + (right[0] - left[0]) * ratio),
  Math.round(left[1] + (right[1] - left[1]) * ratio),
  Math.round(left[2] + (right[2] - left[2]) * ratio),
]

export const isNoteOffVelocity = (velocity: number): boolean =>
  Math.max(0, Math.min(velocity, 1)) === 0

export function getNoteFillColor(velocity: number): string {
  const normalizedVelocity = Math.max(0, Math.min(velocity, 1))

  if (isNoteOffVelocity(normalizedVelocity)) {
    return 'transparent'
  }

  const low: [number, number, number] = [51, 75, 116]
  const mid: [number, number, number] = [45, 181, 197]
  const high: [number, number, number] = [245, 196, 90]
  const [red, green, blue] = normalizedVelocity < 0.55
    ? interpolateColor(low, mid, normalizedVelocity / 0.55)
    : interpolateColor(mid, high, (normalizedVelocity - 0.55) / 0.45)

  return `rgb(${red} ${green} ${blue} / 1)`
}
