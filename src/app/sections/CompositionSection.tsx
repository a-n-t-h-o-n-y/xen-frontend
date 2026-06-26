import { formatTimeSignature } from '../presentation/viewModels'
import { getMeasureById, isColumnInLoopRegion } from '../domain/composition'
import { clampNumber, flattenMeasureToNoteIR, normalizePitch } from '../domain/music'
import { getCompositionSelectionScrollDelta } from './compositionScroll'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { Composition, CompositionSelection, MeasureBank } from '../domain/models'

export type CompositionEditTarget =
  | { kind: 'cell'; rowIndex: number; columnIndex: number }
  | { kind: 'rowName'; rowIndex: number }
  | { kind: 'rowChannel'; rowIndex: number }
  | { kind: 'columnLength'; columnIndex: number }

type CompositionSectionProps = {
  composition: Composition
  measureBank: MeasureBank | null
  selection: CompositionSelection
  tuningLength: number
  editTarget: CompositionEditTarget | null
  onSelectCell: (selection: CompositionSelection) => void
  onBeginEdit: (target: CompositionEditTarget) => void
  onCancelEdit: () => void
  onCommitCellName: (rowIndex: number, columnIndex: number, name: string) => void
  onCommitRowName: (rowIndex: number, name: string) => void
  onCommitRowChannel: (rowIndex: number, channelId: string) => void
  onCommitColumnLength: (columnIndex: number, length: string) => void
  onInsertRow: (placement: 'before' | 'after', rowIndex: number) => void
  onDeleteRow: (rowIndex: number) => void
  onInsertColumn: (placement: 'before' | 'after', columnIndex: number) => void
  onDeleteColumn: (columnIndex: number) => void
  onClearCell: (rowIndex: number, columnIndex: number) => void
}

const minColumnWidth = 5.5
const beatWidth = 3.25
const maxMiniMapNotes = 28

type MiniMapNote = {
  x: number
  width: number
  pitchRatio: number
  velocity: number
}

const getColumnWidth = (length: { numerator: number; denominator: number }): string => {
  const beats = length.numerator * (4 / length.denominator)
  return `${Math.max(minColumnWidth, beats * beatWidth)}rem`
}

const getMiniMapNotes = (
  measureEntry: MeasureBank['measures'][number] | null,
  length: { numerator: number; denominator: number },
  tuningLength: number
): MiniMapNote[] => {
  if (!measureEntry || tuningLength <= 0) {
    return []
  }

  return flattenMeasureToNoteIR(
    {
      cell: measureEntry.measure.cell,
      timeSignature: length,
    },
    0
  ).slice(0, maxMiniMapNotes).map((note) => ({
    x: clampNumber(note.x, 0, 1),
    width: clampNumber(note.width, 0.018, 1),
    pitchRatio: normalizePitch(note.pitch, tuningLength) / Math.max(1, tuningLength - 1),
    velocity: clampNumber(note.velocity, 0, 1),
  }))
}

export function CompositionSection({
  composition,
  measureBank,
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
  onInsertRow,
  onDeleteRow,
  onInsertColumn,
  onDeleteColumn,
  onClearCell,
}: CompositionSectionProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const editInputRef = useRef<HTMLInputElement | null>(null)
  const columnWidths = composition.columns.map((column) => getColumnWidth(column.length))
  const gridTemplateColumns = ['10rem', ...columnWidths].join(' ')
  const selectedMeasureId = composition.rows[selection.rowIndex]?.cells[selection.columnIndex]
  const selectedMeasureInstanceCount = selectedMeasureId === null || selectedMeasureId === undefined
    ? 0
    : composition.rows.reduce((count, row) => (
        count + row.cells.filter((measureId) => measureId === selectedMeasureId).length
      ), 0)
  const shouldHighlightReferences = selectedMeasureInstanceCount > 1
  const channelOptions = useMemo(() => Array.from(new Set(
    composition.rows.map((row) => row.channelId).filter(Boolean)
  )), [composition.rows])
  const editKey = editTarget
    ? editTarget.kind === 'cell'
      ? `cell-${editTarget.rowIndex}-${editTarget.columnIndex}`
      : editTarget.kind === 'rowName' || editTarget.kind === 'rowChannel'
        ? `${editTarget.kind}-${editTarget.rowIndex}`
        : `${editTarget.kind}-${editTarget.columnIndex}`
    : ''
  const editValue = useMemo(() => {
    if (!editTarget) {
      return ''
    }

    if (editTarget.kind === 'cell') {
      const measureId = composition.rows[editTarget.rowIndex]?.cells[editTarget.columnIndex]
      const measureEntry = measureId === null || measureId === undefined
        ? null
        : getMeasureById(measureBank, measureId)
      return measureEntry?.name ?? ''
    }

    if (editTarget.kind === 'rowName') {
      return composition.rows[editTarget.rowIndex]?.name ?? ''
    }

    if (editTarget.kind === 'rowChannel') {
      return composition.rows[editTarget.rowIndex]?.channelId ?? 'channel-1'
    }

    const length = composition.columns[editTarget.columnIndex]?.length
    return length ? formatTimeSignature(length) : '4/4'
  }, [composition.columns, composition.rows, editTarget, measureBank])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const selected = scroller?.querySelector('[data-composition-selected="true"]')
    if (!scroller || !(selected instanceof HTMLElement)) {
      return
    }

    const corner = scroller.querySelector('.compositionCorner')
    const scrollerRect = scroller.getBoundingClientRect()
    const selectedRect = selected.getBoundingClientRect()
    const cornerRect = corner instanceof HTMLElement ? corner.getBoundingClientRect() : null
    const { topDelta, leftDelta } = getCompositionSelectionScrollDelta(
      scrollerRect,
      selectedRect,
      {
        width: cornerRect?.width ?? 0,
        height: cornerRect?.height ?? 0,
      }
    )

    if (topDelta !== 0) {
      scroller.scrollTop += topDelta
    }
    if (leftDelta !== 0) {
      scroller.scrollLeft += leftDelta
    }

    const activeElement = document.activeElement
    const shouldMoveFocus =
      activeElement === document.body ||
      activeElement === null ||
      (activeElement instanceof HTMLElement && scroller.contains(activeElement))

    if (shouldMoveFocus && document.activeElement !== selected) {
      selected.focus({ preventScroll: true })
    }
  }, [selection.columnIndex, selection.rowIndex])

  useEffect(() => {
    if (!editTarget) {
      return
    }

    window.requestAnimationFrame(() => {
      const editInput = editInputRef.current
      if (!editInput) {
        return
      }

      editInput.focus()
      if (editInput instanceof HTMLInputElement) {
        editInput.select()
      }
    })
  }, [editKey, editTarget])

  const commitEdit = (): void => {
    if (!editTarget) {
      return
    }
    const value = editInputRef.current?.value ?? editValue

    if (editTarget.kind === 'cell') {
      onCommitCellName(editTarget.rowIndex, editTarget.columnIndex, value)
    } else if (editTarget.kind === 'rowName') {
      onCommitRowName(editTarget.rowIndex, value)
    } else if (editTarget.kind === 'rowChannel') {
      onCommitRowChannel(editTarget.rowIndex, value)
    } else {
      onCommitColumnLength(editTarget.columnIndex, value)
    }
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    event.stopPropagation()
    if (event.key === 'Enter') {
      event.preventDefault()
      commitEdit()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancelEdit()
    }
  }

  return (
    <section className="composition" aria-label="Composition matrix">
      <datalist id="composition-channel-options">
        {channelOptions.map((channelId) => (
          <option value={channelId} key={channelId} />
        ))}
      </datalist>
      <div className="compositionScroller" ref={scrollerRef}>
        <div
          className="compositionGrid"
          style={{ gridTemplateColumns }}
          role="grid"
          aria-rowcount={composition.rows.length + 1}
          aria-colcount={composition.columns.length + 1}
        >
          <div className="compositionCorner compositionSticky" aria-hidden="true" />
          {composition.columns.map((column, columnIndex) => {
            const isSelectedColumn = columnIndex === selection.columnIndex
            const isLoopStart = columnIndex === composition.loopRegion.startColumn
            const isLoopEnd = columnIndex === composition.loopRegion.endColumn
            const isInLoop = isColumnInLoopRegion(columnIndex, composition.loopRegion)

            return (
              <div
                key={`composition-column-${columnIndex}`}
                className={[
                  'compositionHeaderCell',
                  isSelectedColumn ? 'compositionHeaderCell-selected' : '',
                  isInLoop ? 'compositionCell-loop' : '',
                  isLoopStart ? 'compositionCell-loopStart' : '',
                  isLoopEnd ? 'compositionCell-loopEnd' : '',
                ].filter(Boolean).join(' ')}
                role="columnheader"
                aria-colindex={columnIndex + 2}
                onClick={() => onSelectCell({ rowIndex: selection.rowIndex, columnIndex })}
              >
                <span className="compositionHeaderTopLine">
                  <span className="compositionColumnIndex mono">{columnIndex + 1}</span>
                  <span className="compositionHeaderActions">
                    <button
                      type="button"
                      className="compositionHeaderAction mono"
                      onClick={(event) => {
                        event.stopPropagation()
                        onInsertColumn('before', columnIndex)
                      }}
                      aria-label={`Insert column before ${columnIndex + 1}`}
                    >
                      +L
                    </button>
                    <button
                      type="button"
                      className="compositionHeaderAction mono"
                      onClick={(event) => {
                        event.stopPropagation()
                        onInsertColumn('after', columnIndex)
                      }}
                      aria-label={`Insert column after ${columnIndex + 1}`}
                    >
                      +R
                    </button>
                    <button
                      type="button"
                      className="compositionHeaderAction mono"
                      disabled={composition.columns.length <= 1}
                      onClick={(event) => {
                        event.stopPropagation()
                        onDeleteColumn(columnIndex)
                      }}
                      aria-label={`Delete column ${columnIndex + 1}`}
                    >
                      -
                    </button>
                  </span>
                </span>
                {editTarget?.kind === 'columnLength' && editTarget.columnIndex === columnIndex ? (
                  <input
                    key={editKey}
                    ref={editInputRef}
                    className="compositionInlineInput compositionInlineInput-compact mono"
                    defaultValue={editValue}
                    onKeyDown={handleEditKeyDown}
                    onBlur={onCancelEdit}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    aria-label={`Edit column ${columnIndex + 1} length`}
                  />
                ) : (
                  <button
                    type="button"
                    className="compositionColumnLength mono"
                    onClick={(event) => {
                      event.stopPropagation()
                      onBeginEdit({ kind: 'columnLength', columnIndex })
                    }}
                    aria-label={`Edit column ${columnIndex + 1} length`}
                  >
                    {formatTimeSignature(column.length)}
                  </button>
                )}
              </div>
            )
          })}

          {composition.rows.map((row, rowIndex) => {
            const isSelectedRow = rowIndex === selection.rowIndex
            return (
              <Fragment key={`composition-row-${rowIndex}`}>
                <div
                  className={[
                    'compositionRowHeader',
                    'compositionSticky',
                    isSelectedRow ? 'compositionRowHeader-selected' : '',
                  ].filter(Boolean).join(' ')}
                  role="rowheader"
                  aria-rowindex={rowIndex + 2}
                  onClick={() => onSelectCell({ rowIndex, columnIndex: selection.columnIndex })}
                >
                  <span className="compositionRowTopLine">
                    {editTarget?.kind === 'rowName' && editTarget.rowIndex === rowIndex ? (
                      <input
                        key={editKey}
                        ref={editInputRef}
                        className="compositionInlineInput"
                        defaultValue={editValue}
                        onKeyDown={handleEditKeyDown}
                        onBlur={onCancelEdit}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        aria-label={`Rename row ${rowIndex + 1}`}
                      />
                    ) : (
                      <button
                        type="button"
                        className="compositionRowName"
                        onClick={(event) => {
                          event.stopPropagation()
                          onBeginEdit({ kind: 'rowName', rowIndex })
                        }}
                        aria-label={`Rename row ${rowIndex + 1}`}
                      >
                        {row.name}
                      </button>
                    )}
                    <span className="compositionHeaderActions">
                      <button
                        type="button"
                        className="compositionHeaderAction mono"
                        onClick={(event) => {
                          event.stopPropagation()
                          onInsertRow('before', rowIndex)
                        }}
                        aria-label={`Insert row before ${rowIndex + 1}`}
                      >
                        +U
                      </button>
                      <button
                        type="button"
                        className="compositionHeaderAction mono"
                        onClick={(event) => {
                          event.stopPropagation()
                          onInsertRow('after', rowIndex)
                        }}
                        aria-label={`Insert row after ${rowIndex + 1}`}
                      >
                        +D
                      </button>
                      <button
                        type="button"
                        className="compositionHeaderAction mono"
                        disabled={composition.rows.length <= 1}
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteRow(rowIndex)
                        }}
                        aria-label={`Delete row ${rowIndex + 1}`}
                      >
                        -
                      </button>
                    </span>
                  </span>
                  {editTarget?.kind === 'rowChannel' && editTarget.rowIndex === rowIndex ? (
                    <input
                      key={editKey}
                      ref={editInputRef}
                      className="compositionInlineInput compositionInlineInput-compact mono"
                      defaultValue={editValue}
                      onKeyDown={handleEditKeyDown}
                      onBlur={onCancelEdit}
                      list="composition-channel-options"
                      spellCheck={false}
                      autoCapitalize="off"
                      autoComplete="off"
                      autoCorrect="off"
                      aria-label={`Edit row ${rowIndex + 1} channel`}
                    />
                  ) : (
                    <button
                      type="button"
                      className="compositionRowChannel mono"
                      onClick={(event) => {
                        event.stopPropagation()
                        onBeginEdit({ kind: 'rowChannel', rowIndex })
                      }}
                      aria-label={`Edit row ${rowIndex + 1} channel`}
                    >
                      {row.channelId || 'channel-1'}
                    </button>
                  )}
                </div>
                {composition.columns.map((column, columnIndex) => {
                  const measureId = row.cells[columnIndex]
                  const measureEntry = measureId === null || measureId === undefined
                    ? null
                    : getMeasureById(measureBank, measureId)
                  const isSelectedCell =
                    rowIndex === selection.rowIndex && columnIndex === selection.columnIndex
                  const isSelectedColumn = columnIndex === selection.columnIndex
                  const isLoopStart = columnIndex === composition.loopRegion.startColumn
                  const isLoopEnd = columnIndex === composition.loopRegion.endColumn
                  const isInLoop = isColumnInLoopRegion(columnIndex, composition.loopRegion)
                  const label = measureId === null || measureId === undefined
                    ? 'Rest'
                    : measureEntry?.name ?? `M${measureId}`
                  const isReferenceMatch =
                    shouldHighlightReferences && measureId === selectedMeasureId && !isSelectedCell
                  const miniMapNotes = getMiniMapNotes(measureEntry, column.length, tuningLength)
                  const isEditingCell = editTarget?.kind === 'cell' &&
                    editTarget.rowIndex === rowIndex &&
                    editTarget.columnIndex === columnIndex

                  return (
                    <div
                      key={`composition-cell-${rowIndex}-${columnIndex}`}
                      className={[
                        'compositionCell',
                        isSelectedRow ? 'compositionCell-selectedRow' : '',
                        isSelectedColumn ? 'compositionCell-selectedColumn' : '',
                        isReferenceMatch ? 'compositionCell-referenceMatch' : '',
                        isSelectedCell ? 'compositionCell-selected' : '',
                        isInLoop ? 'compositionCell-loop' : '',
                        isLoopStart ? 'compositionCell-loopStart' : '',
                        isLoopEnd ? 'compositionCell-loopEnd' : '',
                        measureEntry ? '' : 'compositionCell-empty',
                      ].filter(Boolean).join(' ')}
                      role="gridcell"
                      tabIndex={0}
                      aria-rowindex={rowIndex + 2}
                      aria-colindex={columnIndex + 2}
                      aria-selected={isSelectedCell}
                      data-composition-selected={isSelectedCell ? 'true' : undefined}
                      onClick={() => onSelectCell({ rowIndex, columnIndex })}
                      onDoubleClick={() => onBeginEdit({ kind: 'cell', rowIndex, columnIndex })}
                    >
                      {miniMapNotes.length > 0 ? (
                        <span className="compositionMiniMap" aria-hidden="true">
                          {miniMapNotes.map((note, noteIndex) => (
                            <span
                              key={`mini-note-${rowIndex}-${columnIndex}-${noteIndex}`}
                              className="compositionMiniMapNote"
                              style={
                                {
                                  left: `${note.x * 100}%`,
                                  width: `${note.width * 100}%`,
                                  bottom: `${note.pitchRatio * 100}%`,
                                  opacity: 0.38 + note.velocity * 0.42,
                                } as CSSProperties
                              }
                            />
                          ))}
                        </span>
                      ) : null}
                      <span className="compositionCellOverlay">
                        {isEditingCell ? (
                          <input
                            key={editKey}
                            ref={editInputRef}
                            className="compositionInlineInput"
                            defaultValue={editValue}
                            onKeyDown={handleEditKeyDown}
                            onBlur={onCancelEdit}
                            spellCheck={false}
                            autoCapitalize="off"
                            autoComplete="off"
                            autoCorrect="off"
                            aria-label={`Assign measure at row ${rowIndex + 1}, column ${columnIndex + 1}`}
                          />
                        ) : (
                          <>
                            <button
                              type="button"
                              className="compositionCellLabel"
                              onClick={(event) => {
                                event.stopPropagation()
                                onBeginEdit({ kind: 'cell', rowIndex, columnIndex })
                              }}
                              aria-label={`Assign measure at row ${rowIndex + 1}, column ${columnIndex + 1}`}
                            >
                              {label}
                            </button>
                            {measureEntry ? (
                              <button
                                type="button"
                                className="compositionCellClear mono"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onClearCell(rowIndex, columnIndex)
                                }}
                                aria-label={`Clear row ${rowIndex + 1}, column ${columnIndex + 1}`}
                              >
                                x
                              </button>
                            ) : null}
                          </>
                        )}
                      </span>
                    </div>
                  )
                })}
              </Fragment>
            )
          })}
        </div>
      </div>
    </section>
  )
}
