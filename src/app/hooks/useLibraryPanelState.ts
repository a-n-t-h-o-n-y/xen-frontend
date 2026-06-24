import { useMemo, useRef, useState } from 'react'
import { getHierarchyRows } from '../shared'
import type {
  SessionReference,
  TuningSortMode,
  LibraryHierarchyRow,
  LibraryCommandEntry,
} from '../shared'
import type { LibrarySnapshot } from '../domain/contracts'

const createInitialLibrarySnapshot = (): LibrarySnapshot => ({
  schema_version: 1,
  library_revision: 0,
  paths: {
    library: '',
    sequences: '',
    tunings: '',
  },
  measures: [],
  tunings: [],
  scales: [],
  chords: [],
  commands: {
    reload_scales: '',
    reload_chords: '',
    library_directory: '',
  },
})

const createInitialSessionReference = (): SessionReference => ({
  commands: [],
})

export function useLibraryPanelState() {
  const [tuningSearch, setTuningSearch] = useState('')
  const tuningSearchInputRef = useRef<HTMLInputElement>(null)
  const [measureSearch, setMeasureSearch] = useState('')
  const measureSearchInputRef = useRef<HTMLInputElement>(null)

  const [tuningSortMode, setTuningSortMode] = useState<TuningSortMode>('name')
  const [sessionReference, setSessionReference] = useState<SessionReference>(createInitialSessionReference)
  const [librarySnapshot, setLibrarySnapshot] = useState<LibrarySnapshot>(createInitialLibrarySnapshot)
  const [libraryLoading, setLibraryLoading] = useState(false)

  const tuningHierarchyRows = useMemo<LibraryHierarchyRow[]>(() => {
    const query = tuningSearch.trim().toLowerCase()
    const tunings: LibraryCommandEntry[] =
      query.length === 0
        ? librarySnapshot.tunings.map((tuning) => ({
            name: tuning.name,
            stem: tuning.stem,
            path: tuning.path,
            command: tuning.command,
            relativePath: tuning.relative_path,
            description: tuning.description,
            intervals: tuning.intervals,
            octave: tuning.octave,
            noteCount: tuning.note_count,
          }))
        : librarySnapshot.tunings
            .filter((tuning) => tuning.stem.toLowerCase().includes(query))
            .map((tuning) => ({
              name: tuning.name,
              stem: tuning.stem,
              path: tuning.path,
              command: tuning.command,
              relativePath: tuning.relative_path,
              description: tuning.description,
              intervals: tuning.intervals,
              octave: tuning.octave,
              noteCount: tuning.note_count,
            }))

    const sortedTunings = [...tunings].sort((a, b) => {
      if (tuningSortMode === 'name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      }

      if (tuningSortMode === 'noteCount') {
        const aCount = a.noteCount
        const bCount = b.noteCount
        if (aCount !== null && bCount !== null && aCount !== bCount) {
          return aCount - bCount
        }
        if (aCount === null && bCount !== null) {
          return 1
        }
        if (aCount !== null && bCount === null) {
          return -1
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      }

      const aOctave = a.octave
      const bOctave = b.octave
      if (aOctave !== null && bOctave !== null && aOctave !== bOctave) {
        return aOctave - bOctave
      }
      if (aOctave === null && bOctave !== null) {
        return 1
      }
      if (aOctave !== null && bOctave === null) {
        return -1
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })

    return getHierarchyRows(sortedTunings, { sortByName: false })
  }, [librarySnapshot.tunings, tuningSearch, tuningSortMode])

  const measureHierarchyRows = useMemo<LibraryHierarchyRow[]>(() => {
    const query = measureSearch.trim().toLowerCase()
    const measures: LibraryCommandEntry[] =
      query.length === 0
        ? librarySnapshot.measures.map((measure) => ({
            name: measure.name,
            stem: measure.stem,
            path: measure.path,
            command: measure.command,
            relativePath: measure.relative_path,
            description: '',
            intervals: [],
            octave: null,
            noteCount: null,
          }))
        : librarySnapshot.measures
            .filter((measure) => measure.stem.toLowerCase().includes(query))
            .map((measure) => ({
              name: measure.name,
              stem: measure.stem,
              path: measure.path,
              command: measure.command,
              relativePath: measure.relative_path,
              description: '',
              intervals: [],
              octave: null,
              noteCount: null,
            }))
    return getHierarchyRows(measures)
  }, [librarySnapshot.measures, measureSearch])

  return {
    tuningSearch,
    setTuningSearch,
    tuningSearchInputRef,
    measureSearch,
    setMeasureSearch,
    measureSearchInputRef,
    tuningSortMode,
    setTuningSortMode,
    sessionReference,
    setSessionReference,
    librarySnapshot,
    setLibrarySnapshot,
    libraryLoading,
    setLibraryLoading,
    tuningHierarchyRows,
    measureHierarchyRows,
  }
}
