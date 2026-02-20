import type { Dispatch, SetStateAction } from 'react'
import type { LibraryHierarchyRow, LibrarySnapshot, TuningSortMode } from '../../shared'

type LibraryPanelProps = {
  activeLibraryTab: 'tunings' | 'sequences' | 'scales' | 'chords'
  setActiveLibraryTab: Dispatch<SetStateAction<'tunings' | 'sequences' | 'scales' | 'chords'>>
  librarySnapshot: LibrarySnapshot
  runLibraryCommand: (command: string) => Promise<unknown>
  quoteCommandArg: (value: string) => string
  tuningSearchInputRef: { current: HTMLInputElement | null }
  tuningSearch: string
  setTuningSearch: Dispatch<SetStateAction<string>>
  tuningSortMode: TuningSortMode
  setTuningSortMode: Dispatch<SetStateAction<TuningSortMode>>
  tuningHierarchyRows: LibraryHierarchyRow[]
  formatOctaveForDisplay: (value: number) => string
  sequenceSearchInputRef: { current: HTMLInputElement | null }
  sequenceSearch: string
  setSequenceSearch: Dispatch<SetStateAction<string>>
  sequenceHierarchyRows: LibraryHierarchyRow[]
}

export function LibraryPanel({
  activeLibraryTab,
  setActiveLibraryTab,
  librarySnapshot,
  runLibraryCommand,
  quoteCommandArg,
  tuningSearchInputRef,
  tuningSearch,
  setTuningSearch,
  tuningSortMode,
  setTuningSortMode,
  tuningHierarchyRows,
  formatOctaveForDisplay,
  sequenceSearchInputRef,
  sequenceSearch,
  setSequenceSearch,
  sequenceHierarchyRows,
}: LibraryPanelProps) {
  return (
    <article className="bottomModule bottomModule-rowItem bottomModule-library">
      <div className="bottomModuleHeader">
        <p className="bottomModuleLabel">Library View</p>
        <div className="libraryTabs" role="tablist" aria-label="Library tabs">
          <button
            type="button"
            className={`libraryTab${activeLibraryTab === 'tunings' ? ' libraryTab-active' : ''}`}
            role="tab"
            aria-selected={activeLibraryTab === 'tunings'}
            onClick={() => setActiveLibraryTab('tunings')}
          >
            Tunings
          </button>
          <button
            type="button"
            className={`libraryTab${activeLibraryTab === 'sequences' ? ' libraryTab-active' : ''}`}
            role="tab"
            aria-selected={activeLibraryTab === 'sequences'}
            onClick={() => setActiveLibraryTab('sequences')}
          >
            Sequences
          </button>
          <button
            type="button"
            className={`libraryTab${activeLibraryTab === 'scales' ? ' libraryTab-active' : ''}`}
            role="tab"
            aria-selected={activeLibraryTab === 'scales'}
            onClick={() => setActiveLibraryTab('scales')}
          >
            Scales
          </button>
          <button
            type="button"
            className={`libraryTab${activeLibraryTab === 'chords' ? ' libraryTab-active' : ''}`}
            role="tab"
            aria-selected={activeLibraryTab === 'chords'}
            onClick={() => setActiveLibraryTab('chords')}
          >
            Chords
          </button>
        </div>
      </div>
      <div className="libraryList" role="list">
        {activeLibraryTab === 'scales' ? (
          librarySnapshot.scales.length > 0 ? (
            librarySnapshot.scales.map((scale, index) => (
              <button
                key={`library-scale-${index}-${scale.name}`}
                type="button"
                className="libraryItem"
                onClick={() => {
                  void runLibraryCommand(scale.command || `set scale ${quoteCommandArg(scale.name)}`)
                }}
              >
                <span className="libraryItemName mono">{scale.name}</span>
                <span className="libraryItemMeta mono">
                  {scale.intervals.length > 0 ? `[${scale.intervals.join(', ')}]` : 'Intervals unavailable'}
                </span>
              </button>
            ))
          ) : (
            <p className="libraryPlaceholder">No scales loaded.</p>
          )
        ) : null}

        {activeLibraryTab === 'tunings' ? (
          <>
            <div className="referenceCommandSearchField">
              <input
                ref={tuningSearchInputRef}
                type="search"
                className="referenceCommandSearchInput mono"
                value={tuningSearch}
                onChange={(event) => setTuningSearch(event.target.value)}
                placeholder="Search tuning stem..."
                aria-label="Search tunings by stem"
              />
              {tuningSearch.length > 0 ? (
                <button
                  type="button"
                  className="referenceCommandSearchClear"
                  aria-label="Clear tuning search"
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                  onClick={() => {
                    setTuningSearch('')
                    tuningSearchInputRef.current?.focus()
                  }}
                >
                  x
                </button>
              ) : null}
            </div>
            <div className="librarySortChips" role="group" aria-label="Tune sort">
              <button
                type="button"
                className={`librarySortChip${tuningSortMode === 'name' ? ' librarySortChip-active' : ''}`}
                onClick={() => setTuningSortMode('name')}
              >
                Name
              </button>
              <button
                type="button"
                className={`librarySortChip${tuningSortMode === 'noteCount' ? ' librarySortChip-active' : ''}`}
                onClick={() => setTuningSortMode('noteCount')}
              >
                Notes
              </button>
              <button
                type="button"
                className={`librarySortChip${tuningSortMode === 'octave' ? ' librarySortChip-active' : ''}`}
                onClick={() => setTuningSortMode('octave')}
              >
                Oct
              </button>
            </div>
            {tuningHierarchyRows.length > 0 ? (
              tuningHierarchyRows.map((row) => {
                if (row.kind === 'directory') {
                  return (
                    <div
                      key={row.key}
                      className="libraryDirectoryRow mono"
                      style={{ paddingLeft: `${row.depth * 0.9 + 0.4}rem` }}
                    >
                      <span className="libraryDirectoryCaret" aria-hidden="true">
                        ▸
                      </span>
                      <span className="libraryDirectoryName">{row.label}</span>
                    </div>
                  )
                }

                const tuning = row.entry
                if (!tuning) {
                  return null
                }
                const isActive =
                  tuning.name.toLowerCase() === librarySnapshot.active.tuningName.toLowerCase() ||
                  tuning.stem.toLowerCase() === librarySnapshot.active.tuningName.toLowerCase()
                const stemParts = tuning.stem.split('/').filter((part) => part.length > 0)
                const tuningNameLeaf = stemParts[stemParts.length - 1] || row.label
                const tuningFolderPath = stemParts.slice(0, -1).join('/')

                return (
                  <button
                    key={row.key}
                    type="button"
                    className={`libraryItem${isActive ? ' libraryItem-active' : ''}`}
                    style={{ paddingLeft: `${row.depth * 0.9 + 0.5}rem` }}
                    onClick={() => {
                      void runLibraryCommand(tuning.command || `load tuning ${quoteCommandArg(tuning.name)}`)
                    }}
                  >
                    <span className="libraryItemName mono">
                      {tuningFolderPath ? (
                        <span className="libraryItemPathPrefix">{`${tuningFolderPath}/`}</span>
                      ) : null}
                      <span className="libraryItemPathLeaf">{tuningNameLeaf}</span>
                    </span>
                    <span className="libraryItemMeta libraryItemMeta-multiline mono">
                      {[
                        tuning.description || tuning.stem || tuning.relativePath || tuning.path,
                        tuning.noteCount !== null ? `${tuning.noteCount} notes` : '',
                        tuning.octave !== null ? `octave ${formatOctaveForDisplay(tuning.octave)}` : '',
                      ]
                        .filter((value) => value.length > 0)
                        .join(' · ')}
                    </span>
                  </button>
                )
              })
            ) : (
              <p className="libraryPlaceholder">
                {tuningSearch.trim() ? 'No tunings match that search.' : 'No tuning files found.'}
              </p>
            )}
          </>
        ) : null}

        {activeLibraryTab === 'sequences' ? (
          <>
            <div className="referenceCommandSearchField">
              <input
                ref={sequenceSearchInputRef}
                type="search"
                className="referenceCommandSearchInput mono"
                value={sequenceSearch}
                onChange={(event) => setSequenceSearch(event.target.value)}
                placeholder="Search sequence stem..."
                aria-label="Search sequences by stem"
              />
              {sequenceSearch.length > 0 ? (
                <button
                  type="button"
                  className="referenceCommandSearchClear"
                  aria-label="Clear sequence search"
                  onMouseDown={(event) => {
                    event.preventDefault()
                  }}
                  onClick={() => {
                    setSequenceSearch('')
                    sequenceSearchInputRef.current?.focus()
                  }}
                >
                  x
                </button>
              ) : null}
            </div>
            {sequenceHierarchyRows.length > 0 ? (
              sequenceHierarchyRows.map((row) => {
                if (row.kind === 'directory') {
                  return (
                    <div
                      key={row.key}
                      className="libraryDirectoryRow mono"
                      style={{ paddingLeft: `${row.depth * 0.9 + 0.4}rem` }}
                    >
                      <span className="libraryDirectoryCaret" aria-hidden="true">
                        ▸
                      </span>
                      <span className="libraryDirectoryName">{row.label}</span>
                    </div>
                  )
                }

                const sequenceBank = row.entry
                if (!sequenceBank) {
                  return null
                }
                const stemParts = sequenceBank.stem.split('/').filter((part) => part.length > 0)
                const sequenceNameLeaf = stemParts[stemParts.length - 1] || row.label
                const sequenceFolderPath = stemParts.slice(0, -1).join('/')
                return (
                  <button
                    key={row.key}
                    type="button"
                    className="libraryItem"
                    style={{ paddingLeft: `${row.depth * 0.9 + 0.5}rem` }}
                    onClick={() => {
                      void runLibraryCommand(
                        sequenceBank.command || `load sequenceBank ${quoteCommandArg(sequenceBank.name)}`
                      )
                    }}
                  >
                    <span className="libraryItemName mono">
                      {sequenceFolderPath ? (
                        <span className="libraryItemPathPrefix">{`${sequenceFolderPath}/`}</span>
                      ) : null}
                      <span className="libraryItemPathLeaf">{sequenceNameLeaf}</span>
                    </span>
                    <span className="libraryItemMeta mono">{sequenceBank.relativePath || sequenceBank.path}</span>
                  </button>
                )
              })
            ) : (
              <p className="libraryPlaceholder">
                {sequenceSearch.trim() ? 'No sequences match that search.' : 'No saved sequences found.'}
              </p>
            )}
          </>
        ) : null}

        {activeLibraryTab === 'chords' ? (
          librarySnapshot.chords.length > 0 ? (
            librarySnapshot.chords.map((chord, index) => (
              <button
                key={`library-chord-${index}-${chord.name}`}
                type="button"
                className="libraryItem"
                onClick={() => {
                  void runLibraryCommand(chord.command || `arp ${quoteCommandArg(chord.name)}`)
                }}
              >
                <span className="libraryItemName mono">{chord.name}</span>
                <span className="libraryItemMeta mono">
                  {chord.intervals.length > 0 ? `[${chord.intervals.join(', ')}]` : 'Intervals unavailable'}
                </span>
              </button>
            ))
          ) : (
            <p className="libraryPlaceholder">No chords loaded.</p>
          )
        ) : null}
      </div>
    </article>
  )
}
