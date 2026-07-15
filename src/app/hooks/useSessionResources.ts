import { useState } from 'react'
import type { LibrarySnapshot, SessionReference } from '../domain/models'
import type { ModulationCatalog } from '../domain/modulation'

const createInitialLibrarySnapshot = (): LibrarySnapshot => ({
  revision: '0',
  paths: {
    library: '',
    content: '',
    tunings: '',
  },
  cells: [],
  projects: [],
  tunings: [],
  scales: [],
  chords: [],
  commands: {
    reloadScales: '',
    reloadChords: '',
    libraryDirectory: '',
  },
})

const createInitialSessionReference = (): SessionReference => ({ commands: [] })

export function useSessionResources() {
  const [sessionReference, setSessionReference] = useState<SessionReference>(
    createInitialSessionReference
  )
  const [librarySnapshot, setLibrarySnapshot] = useState<LibrarySnapshot>(
    createInitialLibrarySnapshot
  )
  const [modulationCatalog, setModulationCatalog] = useState<ModulationCatalog | null>(null)

  return {
    sessionReference,
    setSessionReference,
    librarySnapshot,
    setLibrarySnapshot,
    modulationCatalog,
    setModulationCatalog,
  }
}
