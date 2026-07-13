import type { Dispatch, SetStateAction } from 'react'
import { Icon } from '../../ui/Icon'
import { IconButton } from '../../ui/IconButton'
import { SegmentedControl } from '../../ui/SegmentedControl'

export type WorkspaceView = 'composition' | 'sequencer'

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
      <IconButton
        className="statusSettingsButton"
        onClick={onOpenSettings}
        label="Open settings"
        title="Settings"
      >
        <Icon name="settings" size={14} />
      </IconButton>
      <SegmentedControl
        className="workspaceSwitch"
        label="Workspace view"
        value={workspaceView}
        options={[
          { value: 'composition', label: 'Comp', description: 'Composition workspace' },
          { value: 'sequencer', label: 'Seq', description: 'Sequencer workspace' },
        ]}
        onChange={setWorkspaceView}
        disabled={workspaceDisabled}
      />
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
