import { formatTimeSignature } from '../presentation/viewModels'
import { getMeasureById, isColumnInLoopRegion } from '../domain/composition'
import { clampNumber, flattenMeasureToNoteIR, normalizePitch } from '../domain/music'
import { Fragment } from 'react'
import type { CSSProperties } from 'react'
import type { Composition, CompositionSelection, MeasureBank } from '../domain/models'

type CompositionSectionProps = {
  composition: Composition
  measureBank: MeasureBank | null
  selection: CompositionSelection
  tuningLength: number
  onSelectCell: (selection: CompositionSelection) => void
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
  onSelectCell,
}: CompositionSectionProps) {
  const columnWidths = composition.columns.map((column) => getColumnWidth(column.length))
  const gridTemplateColumns = ['10rem', ...columnWidths].join(' ')
  const selectedMeasureId = composition.rows[selection.rowIndex]?.cells[selection.columnIndex]
  const selectedMeasureInstanceCount = selectedMeasureId === null || selectedMeasureId === undefined
    ? 0
    : composition.rows.reduce((count, row) => (
        count + row.cells.filter((measureId) => measureId === selectedMeasureId).length
      ), 0)
  const shouldHighlightReferences = selectedMeasureInstanceCount > 1

  return (
    <section className="composition" aria-label="Composition matrix">
      <div className="compositionScroller">
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
              >
                <span className="compositionColumnIndex mono">{columnIndex + 1}</span>
                <span className="compositionColumnLength mono">
                  {formatTimeSignature(column.length)}
                </span>
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
                >
                  <span className="compositionRowName">{row.name}</span>
                  <span className="compositionRowOutput mono">{row.outputId || 'current'}</span>
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

                  return (
                    <button
                      key={`composition-cell-${rowIndex}-${columnIndex}`}
                      type="button"
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
                      aria-rowindex={rowIndex + 2}
                      aria-colindex={columnIndex + 2}
                      aria-selected={isSelectedCell}
                      onClick={() => onSelectCell({ rowIndex, columnIndex })}
                    >
                      <span className="compositionCellLabel">{label}</span>
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
                    </button>
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
