import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { InputMode, MessageLevel } from '../domain/models'
import type { StatusCellMetaItem } from '../presentation/viewModels'
import { WorkspaceControls, type WorkspaceView } from './status/WorkspaceControls'

type StatusSectionProps = {
  currentInputMode: InputMode
  currentInputModeLetter: string
  workspaceView: WorkspaceView
  setWorkspaceView: Dispatch<SetStateAction<WorkspaceView>>
  isModulatorMode: boolean
  setIsModulatorMode: Dispatch<SetStateAction<boolean>>
  statusLevel: MessageLevel
  statusMessage: string
  selectedCellMeta: StatusCellMetaItem[]
  workspaceDisabled: boolean
  modulatorDisabled: boolean
  onOpenSettings: () => void
  modulatorRail: ReactNode
}

export function StatusSection({
  currentInputMode,
  currentInputModeLetter,
  workspaceView,
  setWorkspaceView,
  isModulatorMode,
  setIsModulatorMode,
  statusLevel,
  statusMessage,
  selectedCellMeta,
  workspaceDisabled,
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
          workspaceView={workspaceView}
          setWorkspaceView={setWorkspaceView}
          isModulatorMode={isModulatorMode}
          setIsModulatorMode={setIsModulatorMode}
          workspaceDisabled={workspaceDisabled}
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
