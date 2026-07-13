import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  getCompositionColumnOrDefault,
  getCompositionPlacement,
  getSequenceById,
  isColumnInLoopRegion,
} from '../domain/composition'
import { getMiniMapNotes } from './compositionMiniMap'
import { buildVirtualCoordinateRange, getCompositionColumnBeats } from './compositionViewport'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { Composition, CompositionSelection, SequenceBank } from '../domain/models'

export type CompositionEditTarget =
  | { kind: 'cell'; rowCoordinate: number; columnCoordinate: number }
  | { kind: 'rowName'; rowCoordinate: number }
  | { kind: 'rowChannel'; rowCoordinate: number }

type CompositionSectionProps = {
  composition: Composition
  sequenceBank: SequenceBank | null
  selection: CompositionSelection
  tuningLength: number
  editTarget: CompositionEditTarget | null
  onCancelEdit: () => void
  onCommitCellName: (rowCoordinate: number, columnCoordinate: number, name: string) => void
  onCommitRowName: (rowCoordinate: number, name: string) => void
  onCommitRowChannel: (rowCoordinate: number, channelId: string) => void
}

const viewportColumnRadius = 4
const viewportRowRadius = 3
const cellWidthPixels = 140
const cellHeightPixels = 84

const coordinateLabel = (coordinate: number): string =>
  coordinate > 0 ? `+${coordinate}` : `${coordinate}`

export function CompositionSection({
  composition,
  sequenceBank,
  selection,
  tuningLength,
  editTarget,
  onCancelEdit,
  onCommitCellName,
  onCommitRowName,
  onCommitRowChannel,
}: CompositionSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const worldRef = useRef<HTMLDivElement | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  const rowCoordinates = buildVirtualCoordinateRange(selection.rowCoordinate, viewportRowRadius)
  const columnCoordinates = buildVirtualCoordinateRange(
    selection.columnCoordinate,
    viewportColumnRadius
  )
  const columnTracks = columnCoordinates.map((columnCoordinate) => {
    const column = columnCoordinate === null
      ? composition.defaultColumn
      : getCompositionColumnOrDefault(composition, columnCoordinate)
    return `max(var(--composition-cell-min-width), calc(var(--composition-beat-width) * ${getCompositionColumnBeats(column.length)}))`
  }).join(' ')
  const selectedPlacement = getCompositionPlacement(
    composition,
    selection.rowCoordinate,
    selection.columnCoordinate
  )
  const selectedInstanceCount = selectedPlacement
    ? Array.from(composition.placements.values()).filter(
        (placement) => placement.sequenceId === selectedPlacement.sequenceId
      ).length
    : 0
  const channelOptions = useMemo(() => Array.from(new Set(
    Array.from(composition.rows.values()).map((row) => row.channelId).filter(Boolean)
  )), [composition.rows])
  const editKey = editTarget ? JSON.stringify(editTarget) : ''
  const editValue = useMemo(() => {
    if (!editTarget) return ''
    if (editTarget.kind === 'cell') {
      const placement = getCompositionPlacement(
        composition,
        editTarget.rowCoordinate,
        editTarget.columnCoordinate
      )
      return placement ? getSequenceById(sequenceBank, placement.sequenceId)?.name ?? '' : ''
    }
    if (editTarget.kind === 'rowName') {
      return composition.rows.get(editTarget.rowCoordinate)?.name ?? ''
    }
    return composition.rows.get(editTarget.rowCoordinate)?.channelId ?? ''
  }, [composition, editTarget, sequenceBank])

  useEffect(() => {
    const selected = sectionRef.current?.querySelector('[data-composition-selected="true"]')
    const activeElement = document.activeElement
    if (
      selected instanceof HTMLElement &&
      (activeElement === document.body || activeElement === null || sectionRef.current?.contains(activeElement))
    ) {
      selected.focus({ preventScroll: true })
    }
  }, [selection.columnCoordinate, selection.rowCoordinate])

  useLayoutEffect(() => {
    const world = worldRef.current
    if (!world) return

    const centerSelectedColumn = (): void => {
      const selected = world.querySelector('[data-composition-selected="true"]')
      if (!(selected instanceof HTMLElement)) return
      const center = selected.offsetLeft + selected.offsetWidth / 2
      world.style.setProperty('--composition-selected-column-center', `${center}px`)
    }

    centerSelectedColumn()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(centerSelectedColumn)
    observer.observe(world)
    return () => observer.disconnect()
  }, [columnTracks, selection.columnCoordinate, selection.rowCoordinate])

  useEffect(() => {
    if (!editTarget) return
    window.requestAnimationFrame(() => {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    })
  }, [editKey, editTarget])

  const commitEdit = (): void => {
    if (!editTarget) return
    const value = editInputRef.current?.value ?? editValue
    if (editTarget.kind === 'cell') {
      onCommitCellName(editTarget.rowCoordinate, editTarget.columnCoordinate, value)
    } else if (editTarget.kind === 'rowName') {
      onCommitRowName(editTarget.rowCoordinate, value)
    } else {
      onCommitRowChannel(editTarget.rowCoordinate, value)
    }
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    event.stopPropagation()
    if (event.key === 'Enter') {
      event.preventDefault()
      commitEdit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onCancelEdit()
    }
  }

  return (
    <section className="composition" aria-label="Composition coordinate grid" ref={sectionRef}>
      <datalist id="composition-channel-options">
        {channelOptions.map((channelId) => <option value={channelId} key={channelId} />)}
      </datalist>
      <div className="compositionBackdrop" aria-hidden="true" />
      <div
        className="compositionViewport"
        role="grid"
        aria-rowcount={rowCoordinates.length}
        aria-colcount={columnCoordinates.length}
        style={{ '--composition-row-count': rowCoordinates.length } as CSSProperties}
      >
        <div className="compositionRowRail" aria-label="Composition rows">
          <div className="compositionRowHeaders">
            {rowCoordinates.map((rowCoordinate, index) => {
              if (rowCoordinate === null) {
                return <span aria-hidden="true" key={`row-edge-${index}`} />
              }
              const row = composition.rows.get(rowCoordinate)
              const isSelected = rowCoordinate === selection.rowCoordinate
              return (
                <div
                  className={`compositionAxisHeader compositionRowHeader${isSelected ? ' compositionAxisHeader-selected' : ''}`}
                  role="rowheader"
                  aria-selected={isSelected}
                  key={`row-${rowCoordinate}`}
                  aria-label={`Row ${coordinateLabel(rowCoordinate)}${row ? `, ${row.name}, channel ${row.channelId}` : ', virtual'}`}
                >
                  {row ? (
                    <span className="compositionRowMetadata">
                      {editTarget?.kind === 'rowName' && editTarget.rowCoordinate === rowCoordinate ? (
                        <input
                          key={editKey}
                          ref={editInputRef}
                          className="compositionInlineInput"
                          defaultValue={editValue}
                          onKeyDown={handleEditKeyDown}
                          onBlur={onCancelEdit}
                          aria-label={`Rename row ${coordinateLabel(rowCoordinate)}`}
                        />
                      ) : <span>{row.name}</span>}
                      {editTarget?.kind === 'rowChannel' && editTarget.rowCoordinate === rowCoordinate ? (
                        <input
                          key={editKey}
                          ref={editInputRef}
                          className="compositionInlineInput mono"
                          defaultValue={editValue}
                          list="composition-channel-options"
                          onKeyDown={handleEditKeyDown}
                          onBlur={onCancelEdit}
                          aria-label={`Edit row ${coordinateLabel(rowCoordinate)} channel`}
                        />
                      ) : (
                        <span className="compositionAxisMetadata mono">{row.channelId}</span>
                      )}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        <div className="compositionGridViewport">
          <div
            className="compositionWorld"
            ref={worldRef}
            style={{
              '--composition-selected-column-center': '50%',
              '--composition-column-tracks': columnTracks,
            } as CSSProperties}
          >
            <div className="compositionCells">
              {rowCoordinates.flatMap((rowCoordinate, rowIndex) =>
                columnCoordinates.map((columnCoordinate, columnIndex) => {
                  if (rowCoordinate === null || columnCoordinate === null) {
                    return <span className="compositionCellBoundary" key={`edge-${rowIndex}-${columnIndex}`} />
                  }
                  const placement = getCompositionPlacement(
                    composition,
                    rowCoordinate,
                    columnCoordinate
                  )
                  const sequenceEntry = placement
                    ? getSequenceById(sequenceBank, placement.sequenceId)
                    : null
                  const column = getCompositionColumnOrDefault(composition, columnCoordinate)
                  const isSelected = rowCoordinate === selection.rowCoordinate &&
                    columnCoordinate === selection.columnCoordinate
                  const isReferenceMatch = Boolean(
                    placement &&
                    selectedPlacement &&
                    selectedInstanceCount > 1 &&
                    placement.sequenceId === selectedPlacement.sequenceId &&
                    !isSelected
                  )
                  const isInLoop = Boolean(
                    placement && isColumnInLoopRegion(columnCoordinate, composition.loopRegion)
                  )
                  const miniMapNotes = getMiniMapNotes(sequenceEntry, column.length, tuningLength)
                  const distance = Math.hypot(
                    (columnIndex - viewportColumnRadius) * cellWidthPixels,
                    (rowIndex - viewportRowRadius) * cellHeightPixels
                  )
                  const wireOpacity = Math.max(0, 1 - distance / 430)
                  const isEditing = editTarget?.kind === 'cell' &&
                    editTarget.rowCoordinate === rowCoordinate &&
                    editTarget.columnCoordinate === columnCoordinate
                  const label = sequenceEntry?.name ??
                    (placement ? `S${placement.sequenceId}` : 'Empty')

                  return (
                    <div
                      className={[
                        'compositionCell',
                        placement ? 'compositionCell-materialized' : 'compositionCell-empty',
                        isSelected ? 'compositionCell-selected' : '',
                        isReferenceMatch ? 'compositionCell-referenceMatch' : '',
                        isInLoop ? 'compositionCell-loop' : '',
                      ].filter(Boolean).join(' ')}
                      style={{ '--wire-opacity': wireOpacity } as CSSProperties}
                      role="gridcell"
                      aria-rowindex={rowIndex + 1}
                      aria-colindex={columnIndex + 1}
                      aria-selected={isSelected}
                      aria-label={`Row ${coordinateLabel(rowCoordinate)}, column ${coordinateLabel(columnCoordinate)}: ${label}`}
                      tabIndex={isSelected ? 0 : -1}
                      data-composition-selected={isSelected ? 'true' : undefined}
                      key={`${rowCoordinate},${columnCoordinate}`}
                    >
                      {miniMapNotes.length > 0 ? (
                        <span className="compositionMiniMap" aria-hidden="true">
                          {miniMapNotes.map((note, noteIndex) => (
                            <span
                              className="compositionMiniMapNote"
                              key={`note-${noteIndex}`}
                              style={{
                                left: `${note.x * 100}%`,
                                width: `${note.width * 100}%`,
                                bottom: `${note.pitchRatio * 100}%`,
                                opacity: 0.38 + note.velocity * 0.42,
                              }}
                            />
                          ))}
                        </span>
                      ) : null}
                      {isEditing || placement ? (
                        <span className="compositionCellOverlay">
                          {isEditing ? (
                            <input
                              key={editKey}
                              ref={editInputRef}
                              className="compositionInlineInput"
                              defaultValue={editValue}
                              onKeyDown={handleEditKeyDown}
                              onBlur={onCancelEdit}
                              aria-label={`Assign sequence at row ${coordinateLabel(rowCoordinate)}, column ${coordinateLabel(columnCoordinate)}`}
                            />
                          ) : (
                            <>
                              <span className="compositionCellCoordinates mono">
                                {coordinateLabel(rowCoordinate)}, {coordinateLabel(columnCoordinate)}
                              </span>
                              <span className="compositionCellLabel">{label}</span>
                            </>
                          )}
                        </span>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
