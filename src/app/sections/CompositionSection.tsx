import { useEffect, useMemo, useRef } from 'react'
import { formatTimeSignature } from '../presentation/viewModels'
import {
  getCompositionColumnOrDefault,
  getCompositionPlacement,
  getSequenceById,
  isColumnInLoopRegion,
} from '../domain/composition'
import { getMiniMapNotes } from './compositionMiniMap'
import { buildVirtualCoordinateRange } from './compositionViewport'
import type { CSSProperties, DragEvent, KeyboardEvent } from 'react'
import type { Composition, CompositionSelection, SequenceBank } from '../domain/models'

export type CompositionEditTarget =
  | { kind: 'cell'; rowCoordinate: number; columnCoordinate: number }
  | { kind: 'rowName'; rowCoordinate: number }
  | { kind: 'rowChannel'; rowCoordinate: number }
  | { kind: 'columnLength'; columnCoordinate: number }

type CompositionSectionProps = {
  composition: Composition
  sequenceBank: SequenceBank | null
  selection: CompositionSelection
  tuningLength: number
  editTarget: CompositionEditTarget | null
  onSelectCell: (selection: CompositionSelection) => void
  onBeginEdit: (target: CompositionEditTarget) => void
  onCancelEdit: () => void
  onCommitCellName: (rowCoordinate: number, columnCoordinate: number, name: string) => void
  onCommitRowName: (rowCoordinate: number, name: string) => void
  onCommitRowChannel: (rowCoordinate: number, channelId: string) => void
  onCommitColumnLength: (columnCoordinate: number, length: string) => void
  onUnassignCell: (rowCoordinate: number, columnCoordinate: number) => void
  onMoveCell: (
    fromRowCoordinate: number,
    fromColumnCoordinate: number,
    toRowCoordinate: number,
    toColumnCoordinate: number
  ) => void
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
  onSelectCell,
  onBeginEdit,
  onCancelEdit,
  onCommitCellName,
  onCommitRowName,
  onCommitRowChannel,
  onCommitColumnLength,
  onUnassignCell,
  onMoveCell,
}: CompositionSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  const rowCoordinates = buildVirtualCoordinateRange(selection.rowCoordinate, viewportRowRadius)
  const columnCoordinates = buildVirtualCoordinateRange(
    selection.columnCoordinate,
    viewportColumnRadius
  )
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
    if (editTarget.kind === 'rowChannel') {
      return composition.rows.get(editTarget.rowCoordinate)?.channelId ?? ''
    }
    const column = composition.columns.get(editTarget.columnCoordinate)
    return column ? formatTimeSignature(column.length) : ''
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
    } else if (editTarget.kind === 'rowChannel') {
      onCommitRowChannel(editTarget.rowCoordinate, value)
    } else {
      onCommitColumnLength(editTarget.columnCoordinate, value)
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

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    rowCoordinate: number,
    columnCoordinate: number
  ): void => {
    event.preventDefault()
    if (getCompositionPlacement(composition, rowCoordinate, columnCoordinate)) return
    const raw = event.dataTransfer.getData('application/x-xen-composition-coordinate')
    const [fromRow, fromColumn] = raw.split(',').map(Number)
    if (!Number.isInteger(fromRow) || !Number.isInteger(fromColumn)) return
    onMoveCell(fromRow!, fromColumn!, rowCoordinate, columnCoordinate)
    onSelectCell({ rowCoordinate, columnCoordinate })
  }

  return (
    <section className="composition" aria-label="Composition coordinate grid" ref={sectionRef}>
      <datalist id="composition-channel-options">
        {channelOptions.map((channelId) => <option value={channelId} key={channelId} />)}
      </datalist>
      <div className="compositionBackdrop" aria-hidden="true" />
      <div className="compositionViewport">
        <div
          className="compositionWorld"
          role="grid"
          aria-rowcount={rowCoordinates.length}
          aria-colcount={columnCoordinates.length}
          style={{
            '--composition-column-count': columnCoordinates.length,
            '--composition-row-count': rowCoordinates.length,
          } as CSSProperties}
        >
          <div className="compositionColumnHeaders" role="row">
            {columnCoordinates.map((columnCoordinate, index) => {
              if (columnCoordinate === null) return <span key={`column-edge-${index}`} />
              const column = composition.columns.get(columnCoordinate)
              const isSelected = columnCoordinate === selection.columnCoordinate
              return (
                <button
                  type="button"
                  className={`compositionAxisHeader compositionColumnHeader${isSelected ? ' compositionAxisHeader-selected' : ''}`}
                  onClick={() => onSelectCell({
                    rowCoordinate: selection.rowCoordinate,
                    columnCoordinate,
                  })}
                  key={`column-${columnCoordinate}`}
                  aria-label={`Column ${coordinateLabel(columnCoordinate)}${column ? `, ${formatTimeSignature(column.length)}` : ', virtual'}`}
                >
                  <span className="compositionCoordinate mono">{coordinateLabel(columnCoordinate)}</span>
                  {column ? (
                    editTarget?.kind === 'columnLength' &&
                    editTarget.columnCoordinate === columnCoordinate ? (
                      <input
                        key={editKey}
                        ref={editInputRef}
                        className="compositionInlineInput mono"
                        defaultValue={editValue}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={handleEditKeyDown}
                        onBlur={onCancelEdit}
                        aria-label={`Edit column ${coordinateLabel(columnCoordinate)} duration`}
                      />
                    ) : (
                      <span
                        className="compositionAxisMetadata mono"
                        onDoubleClick={(event) => {
                          event.stopPropagation()
                          onBeginEdit({ kind: 'columnLength', columnCoordinate })
                        }}
                      >
                        {formatTimeSignature(column.length)}
                      </span>
                    )
                  ) : <span className="compositionAxisMetadata">default</span>}
                </button>
              )
            })}
          </div>

          <div className="compositionRowHeaders">
            {rowCoordinates.map((rowCoordinate, index) => {
              if (rowCoordinate === null) return <span key={`row-edge-${index}`} />
              const row = composition.rows.get(rowCoordinate)
              const isSelected = rowCoordinate === selection.rowCoordinate
              return (
                <button
                  type="button"
                  className={`compositionAxisHeader compositionRowHeader${isSelected ? ' compositionAxisHeader-selected' : ''}`}
                  onClick={() => onSelectCell({
                    rowCoordinate,
                    columnCoordinate: selection.columnCoordinate,
                  })}
                  key={`row-${rowCoordinate}`}
                  aria-label={`Row ${coordinateLabel(rowCoordinate)}${row ? `, ${row.name}, channel ${row.channelId}` : ', virtual'}`}
                >
                  <span className="compositionCoordinate mono">{coordinateLabel(rowCoordinate)}</span>
                  {row ? (
                    <span className="compositionRowMetadata">
                      {editTarget?.kind === 'rowName' && editTarget.rowCoordinate === rowCoordinate ? (
                        <input
                          key={editKey}
                          ref={editInputRef}
                          className="compositionInlineInput"
                          defaultValue={editValue}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={handleEditKeyDown}
                          onBlur={onCancelEdit}
                          aria-label={`Rename row ${coordinateLabel(rowCoordinate)}`}
                        />
                      ) : (
                        <span onDoubleClick={(event) => {
                          event.stopPropagation()
                          onBeginEdit({ kind: 'rowName', rowCoordinate })
                        }}>{row.name}</span>
                      )}
                      {editTarget?.kind === 'rowChannel' && editTarget.rowCoordinate === rowCoordinate ? (
                        <input
                          key={editKey}
                          ref={editInputRef}
                          className="compositionInlineInput mono"
                          defaultValue={editValue}
                          list="composition-channel-options"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={handleEditKeyDown}
                          onBlur={onCancelEdit}
                          aria-label={`Edit row ${coordinateLabel(rowCoordinate)} channel`}
                        />
                      ) : (
                        <span className="compositionAxisMetadata mono" onDoubleClick={(event) => {
                          event.stopPropagation()
                          onBeginEdit({ kind: 'rowChannel', rowCoordinate })
                        }}>{row.channelId}</span>
                      )}
                    </span>
                  ) : <span className="compositionAxisMetadata">virtual</span>}
                </button>
              )
            })}
          </div>

          <div className="compositionCells">
            {rowCoordinates.flatMap((rowCoordinate, rowIndex) =>
              columnCoordinates.map((columnCoordinate, columnIndex) => {
                if (rowCoordinate === null || columnCoordinate === null) {
                  return <span className="compositionCellBoundary" key={`edge-${rowIndex}-${columnIndex}`} />
                }
                const placement = getCompositionPlacement(composition, rowCoordinate, columnCoordinate)
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
                const isInLoop = isColumnInLoopRegion(columnCoordinate, composition.loopRegion)
                const miniMapNotes = getMiniMapNotes(sequenceEntry, column.length, tuningLength)
                const distance = Math.hypot(
                  (columnIndex - viewportColumnRadius) * cellWidthPixels,
                  (rowIndex - viewportRowRadius) * cellHeightPixels
                )
                const wireOpacity = Math.max(0, 1 - distance / 430)
                const isEditing = editTarget?.kind === 'cell' &&
                  editTarget.rowCoordinate === rowCoordinate &&
                  editTarget.columnCoordinate === columnCoordinate
                const label = sequenceEntry?.name ?? (placement ? `S${placement.sequenceId}` : 'Empty')

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
                    draggable={Boolean(placement)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        'application/x-xen-composition-coordinate',
                        `${rowCoordinate},${columnCoordinate}`
                      )
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(event) => {
                      if (!placement) event.preventDefault()
                    }}
                    onDrop={(event) => handleDrop(event, rowCoordinate, columnCoordinate)}
                    onClick={() => onSelectCell({ rowCoordinate, columnCoordinate })}
                    onDoubleClick={() => onBeginEdit({ kind: 'cell', rowCoordinate, columnCoordinate })}
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
                          {placement ? (
                            <button
                              type="button"
                              className="compositionCellUnassign mono"
                              onClick={(event) => {
                                event.stopPropagation()
                                onUnassignCell(rowCoordinate, columnCoordinate)
                              }}
                              aria-label={`Unassign row ${coordinateLabel(rowCoordinate)}, column ${coordinateLabel(columnCoordinate)}`}
                            >×</button>
                          ) : null}
                        </>
                      )}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
      <div className="compositionHint mono" aria-hidden="true">
        arrows move · double-click assigns · drag moves
      </div>
    </section>
  )
}
