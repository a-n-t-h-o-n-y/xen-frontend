import type { ReactNode } from 'react'

type ModulationHeaderProps = {
  controls: ReactNode
  onDone: () => void
}

export function ModulationHeader({ controls, onDone }: ModulationHeaderProps) {
  return (
    <header className="header modulationHeader">
      <div className="modulationHeaderIdentity">
        <span className="modulationHeaderEyebrow">Mode</span>
        <strong>Modulation</strong>
      </div>
      <div className="modulationHeaderControls">{controls}</div>
      <button type="button" className="modulationDoneButton" onClick={onDone}>
        Done
      </button>
    </header>
  )
}
