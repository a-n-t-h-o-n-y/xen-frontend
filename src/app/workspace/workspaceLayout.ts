import { getActiveSequenceTarget } from '../domain/composition'
import type {
  ActiveSequenceTarget,
  Composition,
  CompositionSelection,
  Selection,
} from '../domain/models'

export type WorkspaceView = 'composition' | 'sequencer'
export type WorkspaceLayoutPreference = 'single' | 'dual'

export type SequenceEditorPresentation = {
  target: ActiveSequenceTarget | null
  selection: Selection
  previewingComposition: boolean
  emptyCompositionCell: boolean
}

export const WORKSPACE_LAYOUT_STORAGE_KEY = 'xen.workspaceLayout'
export const SEQUENCER_PANE_MIN_HEIGHT_PX = 352
export const COMPOSITION_PANE_MIN_HEIGHT_PX = 224
export const WORKSPACE_PANE_GAP_PX = 12
export const DUAL_EDITOR_MIN_HEIGHT_PX =
  SEQUENCER_PANE_MIN_HEIGHT_PX +
  COMPOSITION_PANE_MIN_HEIGHT_PX +
  WORKSPACE_PANE_GAP_PX

export const isWorkspaceLayoutPreference = (
  value: unknown
): value is WorkspaceLayoutPreference => value === 'single' || value === 'dual'

export const readWorkspaceLayoutPreference = (
  storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined'
    ? null
    : window.localStorage
): WorkspaceLayoutPreference => {
  if (!storage) return 'single'

  try {
    const value = storage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY)
    return isWorkspaceLayoutPreference(value) ? value : 'single'
  } catch {
    return 'single'
  }
}

export const writeWorkspaceLayoutPreference = (
  preference: WorkspaceLayoutPreference,
  storage: Pick<Storage, 'setItem'> | null = typeof window === 'undefined'
    ? null
    : window.localStorage
): void => {
  if (!storage) return

  try {
    storage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, preference)
  } catch {
    // Embedded web views may expose storage while denying access to it.
  }
}

export const canShowDualEditorLayout = (
  preference: WorkspaceLayoutPreference,
  compositionAvailable: boolean,
  availableHeight: number
): boolean => preference === 'dual' &&
  compositionAvailable &&
  availableHeight >= DUAL_EDITOR_MIN_HEIGHT_PX

export const resolveSequenceEditorPresentation = (
  dual: boolean,
  activeView: WorkspaceView,
  composition: Composition | null,
  compositionSelection: CompositionSelection,
  activeSequenceTarget: ActiveSequenceTarget | null,
  editorSelection: Selection
): SequenceEditorPresentation => {
  const previewingComposition = dual && activeView === 'composition'
  if (!previewingComposition) {
    return {
      target: activeSequenceTarget,
      selection: editorSelection,
      previewingComposition: false,
      emptyCompositionCell: false,
    }
  }

  const target = getActiveSequenceTarget(composition, compositionSelection)
  return {
    target,
    selection: { path: [] },
    previewingComposition: true,
    emptyCompositionCell: target === null,
  }
}
