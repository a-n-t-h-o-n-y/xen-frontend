import type { Dispatch, SetStateAction } from 'react'
import { Icon } from '../../ui/Icon'
import { IconButton } from '../../ui/IconButton'

type WorkspaceControlsProps = {
  currentInputMode: string
  currentInputModeLetter: string
  isModulatorMode: boolean
  setIsModulatorMode: Dispatch<SetStateAction<boolean>>
  modulatorDisabled: boolean
  onOpenSettings: () => void
}

export function WorkspaceControls({
  currentInputMode,
  currentInputModeLetter,
  isModulatorMode,
  setIsModulatorMode,
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
