export type SequenceBankCell = {
  index: number
  row: number
  column: number
}

type SequenceBankPanelProps = {
  sequenceBankCells: SequenceBankCell[]
  selectedMeasureIndex: number
  activeSequenceFlags: boolean[]
  sequenceCount: number
  selectSequenceFromBank: (index: number) => void
}

export function SequenceBankPanel({
  sequenceBankCells,
  selectedMeasureIndex,
  activeSequenceFlags,
  sequenceCount,
  selectSequenceFromBank,
}: SequenceBankPanelProps) {
  return (
    <article className="bottomModule bottomModule-rowItem">
      <p className="bottomModuleLabel">Sequence Bank</p>
      <div className="sequenceBankGrid" role="grid" aria-label="Sequence bank">
        {sequenceBankCells.map(({ index, row, column }) => {
          const isSelected = index === selectedMeasureIndex
          const isActive = activeSequenceFlags[index] ?? false
          const isDisabled = index >= sequenceCount
          return (
            <button
              key={`sequence-bank-cell-${index}`}
              type="button"
              className={`sequenceBankCell${isSelected ? ' sequenceBankCell-selected' : ''}${isActive ? ' sequenceBankCell-active' : ''}`}
              style={{ gridRow: row, gridColumn: column }}
              onClick={() => selectSequenceFromBank(index)}
              disabled={isDisabled}
              aria-label={`Select sequence 0x${index.toString(16).toUpperCase()}`}
            >
              <span className="mono">{`0x${index.toString(16).toUpperCase()}`}</span>
            </button>
          )
        })}
      </div>
    </article>
  )
}
