import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  canShowDualEditorLayout,
  readWorkspaceLayoutPreference,
  writeWorkspaceLayoutPreference,
  type WorkspaceLayoutPreference,
} from '../workspace/workspaceLayout'

export function useWorkspaceLayout(compositionAvailable: boolean) {
  const workspaceRef = useRef<HTMLElement | null>(null)
  const [preference, setPreference] = useState<WorkspaceLayoutPreference>(
    readWorkspaceLayoutPreference
  )
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

  useEffect(() => {
    writeWorkspaceLayoutPreference(preference)
  }, [preference])

  return {
    workspaceRef,
    preference,
    setPreference,
    showDualEditors: canShowDualEditorLayout(
      preference,
      compositionAvailable,
      availableHeight
    ),
  }
}
