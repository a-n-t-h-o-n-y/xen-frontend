import { useState } from 'react'
import type { LibrarySnapshot, SessionReference } from '../domain/models'

const createInitialLibrarySnapshot = (): LibrarySnapshot => ({
  revision: 0,
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

  return {
    sessionReference,
    setSessionReference,
    librarySnapshot,
    setLibrarySnapshot,
  }
}
