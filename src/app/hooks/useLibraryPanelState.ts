import { useMemo, useRef, useState } from 'react'
import { getHierarchyRows } from '../shared'
import type {
  SessionReference,
  LibrarySnapshot,
  TuningSortMode,
  LibraryHierarchyRow,
} from '../shared'

const createInitialLibrarySnapshot = (): LibrarySnapshot => ({
  paths: {
    library: '',
    sequences: '',
    tunings: '',
  },
  sequenceBanks: [],
  tunings: [],
  scales: [],
  chords: [],
  commands: {
    reloadScales: '',
    reloadChords: '',
    libraryDirectory: '',
  },
  active: {
    tuningName: '',
    scaleName: null,
  },
})

const createInitialSessionReference = (): SessionReference => ({
  commands: [],
  keybindings: [],
})

export function useLibraryPanelState() {
  const [activeReferenceTab, setActiveReferenceTab] = useState<'commands' | 'keybindings'>('commands')
  const [referenceCommandSearch, setReferenceCommandSearch] = useState('')
  const referenceSearchInputRef = useRef<HTMLInputElement>(null)

  const [tuningSearch, setTuningSearch] = useState('')
  const tuningSearchInputRef = useRef<HTMLInputElement>(null)
  const [sequenceSearch, setSequenceSearch] = useState('')
  const sequenceSearchInputRef = useRef<HTMLInputElement>(null)

  const [tuningSortMode, setTuningSortMode] = useState<TuningSortMode>('name')
  const [activeLibraryTab, setActiveLibraryTab] = useState<'tunings' | 'sequences' | 'scales' | 'chords'>(
    'tunings'
  )

  const [sessionReference, setSessionReference] = useState<SessionReference>(createInitialSessionReference)
  const [librarySnapshot, setLibrarySnapshot] = useState<LibrarySnapshot>(createInitialLibrarySnapshot)
  const [libraryLoading, setLibraryLoading] = useState(false)

  const sequenceViewReferenceBindings = useMemo(
    () =>
      sessionReference.keybindings
        .filter((group) => group.component === 'SequenceView')
        .flatMap((group) => group.bindings),
    [sessionReference.keybindings]
  )

  const filteredReferenceCommands = useMemo(() => {
    const query = referenceCommandSearch.trim().toLowerCase()
    if (!query) {
      return sessionReference.commands
    }

    return sessionReference.commands.filter((command) => command.id.toLowerCase().includes(query))
  }, [referenceCommandSearch, sessionReference.commands])

  const tuningHierarchyRows = useMemo<LibraryHierarchyRow[]>(() => {
    const query = tuningSearch.trim().toLowerCase()
    const tunings =
      query.length === 0
        ? librarySnapshot.tunings
        : librarySnapshot.tunings.filter((tuning) => tuning.stem.toLowerCase().includes(query))

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

  const sequenceHierarchyRows = useMemo<LibraryHierarchyRow[]>(() => {
    const query = sequenceSearch.trim().toLowerCase()
    const sequenceBanks =
      query.length === 0
        ? librarySnapshot.sequenceBanks
        : librarySnapshot.sequenceBanks.filter((sequenceBank) =>
            sequenceBank.stem.toLowerCase().includes(query)
          )
    return getHierarchyRows(sequenceBanks)
  }, [librarySnapshot.sequenceBanks, sequenceSearch])

  return {
    activeReferenceTab,
    setActiveReferenceTab,
    referenceCommandSearch,
    setReferenceCommandSearch,
    referenceSearchInputRef,
    tuningSearch,
    setTuningSearch,
    tuningSearchInputRef,
    sequenceSearch,
    setSequenceSearch,
    sequenceSearchInputRef,
    tuningSortMode,
    setTuningSortMode,
    activeLibraryTab,
    setActiveLibraryTab,
    sessionReference,
    setSessionReference,
    librarySnapshot,
    setLibrarySnapshot,
    libraryLoading,
    setLibraryLoading,
    sequenceViewReferenceBindings,
    filteredReferenceCommands,
    tuningHierarchyRows,
    sequenceHierarchyRows,
  }
}
