import type { MidiCcValue } from './music'

export type MidiCcAutomationNote = {
  x: number
  width: number
  midiCc: MidiCcValue[]
  isSelected: boolean
}

export type MidiCcAutomationSegment = {
  controller: number
  x: number
  width: number
  value: number
  connectFromValue: number | null
  active: boolean
  selected: boolean
}

export const buildMidiCcAutomationSegments = (
  notes: MidiCcAutomationNote[],
  activeController: number
): MidiCcAutomationSegment[] => {
  const entries = notes.flatMap((note) => note.midiCc.map((entry) => ({
    controller: entry.controller,
    x: note.x,
    width: note.width,
    value: entry.value,
    active: entry.controller === activeController,
    selected: note.isSelected,
  }))).sort((left, right) => left.controller - right.controller || left.x - right.x)

  return entries.map((entry, index) => {
    const previous = entries[index - 1]
    const touchesPrevious = previous?.controller === entry.controller &&
      Math.abs(previous.x + previous.width - entry.x) < 0.000_001
    return {
      ...entry,
      connectFromValue: touchesPrevious ? previous.value : null,
    }
  })
}

export const summarizeSelectedMidiCc = (
  notes: MidiCcAutomationNote[],
  controller: number
): string => {
  const selectedNotes = notes.filter((note) => note.isSelected)
  if (selectedNotes.length === 0) return 'Unset'
  const values = selectedNotes.map((note) =>
    note.midiCc.find((entry) => entry.controller === controller)?.value)
  if (values.every((value) => value === undefined)) return 'Unset'
  const first = values[0]
  if (first === undefined || values.some((value) => value !== first)) return 'Mixed'
  return first.toFixed(3)
}
