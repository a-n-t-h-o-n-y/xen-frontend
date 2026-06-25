import { formatTimeSignature } from '../presentation/viewModels'
import { getMeasureById, isColumnInLoopRegion } from '../domain/composition'
import { Fragment } from 'react'
import type { Composition, CompositionSelection, MeasureBank } from '../domain/models'

type CompositionSectionProps = {
  composition: Composition
  measureBank: MeasureBank | null
  selection: CompositionSelection
  onSelectCell: (selection: CompositionSelection) => void
}

const minColumnWidth = 5.5
const beatWidth = 3.25

const getColumnWidth = (length: { numerator: number; denominator: number }): string => {
  const beats = length.numerator * (4 / length.denominator)
  return `${Math.max(minColumnWidth, beats * beatWidth)}rem`
}

export function CompositionSection({
  composition,
  measureBank,
  selection,
  onSelectCell,
}: CompositionSectionProps) {
  const columnWidths = composition.columns.map((column) => getColumnWidth(column.length))
  const gridTemplateColumns = ['10rem', ...columnWidths].join(' ')

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
                {composition.columns.map((_, columnIndex) => {
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

                  return (
                    <button
                      key={`composition-cell-${rowIndex}-${columnIndex}`}
                      type="button"
                      className={[
                        'compositionCell',
                        isSelectedRow ? 'compositionCell-selectedRow' : '',
                        isSelectedColumn ? 'compositionCell-selectedColumn' : '',
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
