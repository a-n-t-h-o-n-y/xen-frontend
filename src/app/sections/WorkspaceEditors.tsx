import type { CSSProperties, ReactNode } from 'react'
import {
  COMPOSITION_PANE_MIN_HEIGHT_PX,
  SEQUENCER_PANE_MIN_HEIGHT_PX,
  WORKSPACE_PANE_GAP_PX,
  type WorkspaceView,
} from '../workspace/workspaceLayout'

type WorkspaceEditorsProps = {
  activeView: WorkspaceView
  dual: boolean
  sequencer: ReactNode
  composition: ReactNode
}

const layoutStyle = {
  '--workspace-sequencer-min-height': `${SEQUENCER_PANE_MIN_HEIGHT_PX}px`,
  '--workspace-composition-min-height': `${COMPOSITION_PANE_MIN_HEIGHT_PX}px`,
  '--workspace-pane-gap': `${WORKSPACE_PANE_GAP_PX}px`,
} as CSSProperties

export function WorkspaceEditors({
  activeView,
  dual,
  sequencer,
  composition,
}: WorkspaceEditorsProps) {
  const sequencerHidden = !dual && activeView !== 'sequencer'
  const compositionHidden = !dual && activeView !== 'composition'

  return (
    <div
      className={`workspacePanes${dual ? ' workspacePanes-dual' : ''}`}
      style={layoutStyle}
    >
      <div
        className={`workspacePane workspacePane-sequencer${
          activeView === 'sequencer' ? ' workspacePane-active' : ''
        }`}
        hidden={sequencerHidden}
        aria-hidden={sequencerHidden || undefined}
      >
        {sequencer}
      </div>
      <div
        className={`workspacePane workspacePane-composition${
          activeView === 'composition' ? ' workspacePane-active' : ''
        }`}
        hidden={compositionHidden}
        aria-hidden={compositionHidden || undefined}
      >
        {composition}
      </div>
    </div>
  )
}
