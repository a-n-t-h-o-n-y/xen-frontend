import type { Dispatch, SetStateAction } from 'react'

export type WorkspaceView = 'composition' | 'sequencer' | 'library'

type WorkspaceControlsProps = {
  currentInputMode: string
  currentInputModeLetter: string
  workspaceView: WorkspaceView
  setWorkspaceView: Dispatch<SetStateAction<WorkspaceView>>
  isModulatorMode: boolean
  setIsModulatorMode: Dispatch<SetStateAction<boolean>>
  workspaceDisabled: boolean
  modulatorDisabled: boolean
  onOpenSettings: () => void
}

export function WorkspaceControls({
  currentInputMode,
  currentInputModeLetter,
  workspaceView,
  setWorkspaceView,
  isModulatorMode,
  setIsModulatorMode,
  workspaceDisabled,
  modulatorDisabled,
  onOpenSettings,
}: WorkspaceControlsProps) {
  return (
    <div className="statusLeft">
      <span className="modeBadge mono" aria-label={`Input mode ${currentInputMode}`}>
        {currentInputModeLetter}
      </span>
      <button
        type="button"
        className="statusSettingsButton"
        onClick={onOpenSettings}
        aria-label="Open settings"
        title="Settings"
      >
        <span aria-hidden="true">⚙</span>
      </button>
      <div className="workspaceSwitch" role="group" aria-label="Workspace view">
        {([
          ['composition', 'Comp'],
          ['sequencer', 'Seq'],
          ['library', 'Lib'],
        ] as const).map(([view, label]) => (
          <button
            type="button"
            key={view}
            className={`workspaceSwitchButton${workspaceView === view ? ' workspaceSwitchButton-active' : ''}`}
            aria-pressed={workspaceView === view}
            onClick={() => setWorkspaceView(view)}
            disabled={workspaceDisabled}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`statusModeButton${isModulatorMode ? ' statusModeButton-active' : ''}`}
        aria-pressed={isModulatorMode}
        onClick={() => setIsModulatorMode((previous) => !previous)}
        disabled={modulatorDisabled}
      >
        Mod
      </button>
    </div>
  )
}
