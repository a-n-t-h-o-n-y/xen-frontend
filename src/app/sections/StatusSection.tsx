import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { InputMode, MessageLevel } from '../domain/models'
import type { StatusCellMetaItem } from '../presentation/viewModels'
import { WorkspaceControls } from './status/WorkspaceControls'

type StatusSectionProps = {
  currentInputMode: InputMode
  currentInputModeLetter: string
  isModulatorMode: boolean
  setIsModulatorMode: Dispatch<SetStateAction<boolean>>
  statusLevel: MessageLevel
  statusMessage: string
  selectedCellMeta: StatusCellMetaItem[]
  modulatorDisabled: boolean
  onOpenSettings: () => void
  modulatorRail: ReactNode
}

export function StatusSection({
  currentInputMode,
  currentInputModeLetter,
  isModulatorMode,
  setIsModulatorMode,
  statusLevel,
  statusMessage,
  selectedCellMeta,
  modulatorDisabled,
  onOpenSettings,
  modulatorRail,
}: StatusSectionProps) {
  return (
    <footer className="statusBarShell">
      <div className={`statusBar${modulatorRail ? ' statusBar-modulatorDocked' : ''}`}>
        <WorkspaceControls
          currentInputMode={currentInputMode}
          currentInputModeLetter={currentInputModeLetter}
          isModulatorMode={isModulatorMode}
          setIsModulatorMode={setIsModulatorMode}
          modulatorDisabled={modulatorDisabled}
          onOpenSettings={onOpenSettings}
        />
        <span className={`statusText status-${statusLevel}`}>{statusMessage}</span>
        {selectedCellMeta.length > 0 ? (
          <div className="statusMeta mono" aria-label="Selected cell metadata">
            {selectedCellMeta.map((item) => (
              <span key={`cell-meta-${item.label}`} className="statusMetaItem">
                <span className="statusMetaKey">{item.label}</span>
                <span className="statusMetaValue">{item.value}</span>
              </span>
            ))}
          </div>
        ) : null}
        {modulatorRail ? (
          <div className="statusModulatorDock">{modulatorRail}</div>
        ) : null}
      </div>
    </footer>
  )
}
