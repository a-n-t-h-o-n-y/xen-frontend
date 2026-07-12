import { clampNumber, flattenSequenceToNoteIR, normalizePitch } from '../domain/music'
import type { SequenceBank } from '../domain/models'
import type { NoteSpanIR } from '../domain/music'

export const maxMiniMapNotes = 128

export type MiniMapNote = {
  x: number
  width: number
  pitchRatio: number
  velocity: number
}

type IndexedNoteSpan = {
  note: NoteSpanIR
  index: number
}

const getMiniMapBucketIndex = (note: NoteSpanIR): number => {
  const x = clampNumber(note.x, 0, 1)
  return Math.min(maxMiniMapNotes - 1, Math.floor(x * maxMiniMapNotes))
}

const isBetterMiniMapRepresentative = (
  candidate: IndexedNoteSpan,
  current: IndexedNoteSpan
): boolean => {
  if (candidate.note.velocity !== current.note.velocity) {
    return candidate.note.velocity > current.note.velocity
  }

  if (candidate.note.width !== current.note.width) {
    return candidate.note.width > current.note.width
  }

  return candidate.index < current.index
}

export const selectMiniMapNotePreview = (notes: NoteSpanIR[]): NoteSpanIR[] => {
  if (notes.length <= maxMiniMapNotes) {
    return notes
  }

  const buckets = new Map<number, IndexedNoteSpan>()
  notes.forEach((note, index) => {
    const bucketIndex = getMiniMapBucketIndex(note)
    const current = buckets.get(bucketIndex)
    const candidate = { note, index }

    if (!current || isBetterMiniMapRepresentative(candidate, current)) {
      buckets.set(bucketIndex, candidate)
    }
  })

  return Array.from(buckets.entries())
    .sort(([leftBucket], [rightBucket]) => leftBucket - rightBucket)
    .map(([, bucket]) => bucket.note)
}

export const getMiniMapNotes = (
  sequenceEntry: SequenceBank['sequences'][number] | null,
  length: { numerator: number; denominator: number },
  tuningLength: number
): MiniMapNote[] => {
  if (!sequenceEntry || tuningLength <= 0) {
    return []
  }

  return selectMiniMapNotePreview(flattenSequenceToNoteIR(
    {
      cell: sequenceEntry.sequence.cell,
      timeSignature: length,
    },
    0
  )).map((note) => ({
    x: clampNumber(note.x, 0, 1),
    width: clampNumber(note.width, 0.018, 1),
    pitchRatio: normalizePitch(note.pitch, tuningLength) / Math.max(1, tuningLength - 1),
    velocity: clampNumber(note.velocity, 0, 1),
  }))
}
