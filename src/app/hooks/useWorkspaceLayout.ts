import { useLayoutEffect, useRef, useState } from 'react'
import {
  canShowDualEditorLayout,
  type WorkspaceLayoutPreference,
} from '../workspace/workspaceLayout'

export function useWorkspaceLayout(
  compositionAvailable: boolean,
  preference: WorkspaceLayoutPreference
) {
  const workspaceRef = useRef<HTMLElement | null>(null)
  const [availableHeight, setAvailableHeight] = useState(0)

  useLayoutEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return

    const measureWorkspace = (): void => {
      const nextHeight = workspace.getBoundingClientRect().height
      setAvailableHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight
      )
    }

    measureWorkspace()
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(measureWorkspace)
    observer?.observe(workspace)
    window.addEventListener('resize', measureWorkspace)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measureWorkspace)
    }
  }, [])

  return {
    workspaceRef,
    showDualEditors: canShowDualEditorLayout(
      preference,
      compositionAvailable,
      availableHeight
    ),
  }
}
