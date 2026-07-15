import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildCommandContext } from '../domain/commands'
import {
  createInitialModulationEditorState,
  createModulationPlotPaths,
  editorStateToDefinition,
  validateModulationDefinition,
  validateOutputRange,
} from '../domain/modulation'
import { getErrorMessage } from '../utils/errors'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ModulationPreviewHandle } from '../bridge/ModulationPreview'
import type { ModulationTargetDto } from '../domain/contracts'
import type {
  ActiveSequenceTarget,
  CompositionSelection,
  EditorState,
  MessageLevel,
  ProjectSnapshot,
} from '../domain/models'
import type {
  ModulationCatalog,
  ModulationDestination,
  ModulationEditorState,
} from '../domain/modulation'

type UseModulationEditorArgs = {
  catalog: ModulationCatalog | null
  tuningLength: number
  destination: ModulationDestination | null
  projectRef: MutableRefObject<ProjectSnapshot | null>
  editorStateRef: MutableRefObject<EditorState>
  activeSequenceTargetRef: MutableRefObject<ActiveSequenceTarget | null>
  compositionSelectionRef: MutableRefObject<CompositionSelection>
  workspaceViewRef: MutableRefObject<'composition' | 'sequencer'>
  beginPreview: (target: ModulationTargetDto) => ModulationPreviewHandle
  setStatusMessage: Dispatch<SetStateAction<string>>
  setStatusLevel: Dispatch<SetStateAction<MessageLevel>>
}

type Gesture = {
  preview: ModulationPreviewHandle | null
  baseline: ModulationEditorState
  finishing: boolean
}

const cloneState = (state: ModulationEditorState): ModulationEditorState => structuredClone(state)

export function useModulationEditor({
  catalog,
  tuningLength,
  destination,
  projectRef,
  editorStateRef,
  activeSequenceTargetRef,
  compositionSelectionRef,
  workspaceViewRef,
  beginPreview,
  setStatusMessage,
  setStatusLevel,
}: UseModulationEditorArgs) {
  const [state, setState] = useState<ModulationEditorState | null>(null)
  const [waveformManagerOpen, setWaveformManagerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const stateRef = useRef<ModulationEditorState | null>(state)
  const gestureRef = useRef<Gesture | null>(null)

  const installState = useCallback((next: ModulationEditorState): void => {
    stateRef.current = next
    setState(next)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!catalog) {
        stateRef.current = null
        setState(null)
        return
      }
      const next = createInitialModulationEditorState(catalog, tuningLength)
      stateRef.current = next
      setState(next)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [catalog, tuningLength])

  const reportFailure = useCallback((prefix: string, error: unknown): void => {
    setStatusMessage(`${prefix}: ${getErrorMessage(error)}`)
    setStatusLevel('error')
  }, [setStatusLevel, setStatusMessage])

  const createTarget = useCallback((): ModulationTargetDto => {
    const project = projectRef.current
    if (!project) throw new Error('Project state is not loaded')
    const context = buildCommandContext(
      project,
      editorStateRef.current.selection,
      activeSequenceTargetRef.current,
      workspaceViewRef.current === 'composition' ? compositionSelectionRef.current : null
    )
    return {
      cursor: {
        row_coordinate: context.cursor.rowCoordinate,
        column_coordinate: context.cursor.columnCoordinate,
        sequence_id: context.cursor.sequenceId,
      },
      selection: context.selection,
      pattern: { offset: 0, intervals: [1] },
    }
  }, [activeSequenceTargetRef, compositionSelectionRef, editorStateRef, projectRef, workspaceViewRef])

  const ensureGesture = useCallback((): Gesture => {
    const currentState = stateRef.current
    if (!currentState) throw new Error('Modulation editor is not ready')
    const existing = gestureRef.current
    if (existing) return existing
    const gesture: Gesture = {
      preview: null,
      baseline: cloneState(currentState),
      finishing: false,
    }
    gestureRef.current = gesture
    return gesture
  }, [])

  const emitState = useCallback(async (
    next: ModulationEditorState
  ): Promise<boolean> => {
    if (!catalog || !destination) return false
    const modulation = editorStateToDefinition(next)
    const definitionError = validateModulationDefinition(catalog, modulation)
    const range = next.outputRanges[destination.id]
    const rangeError = validateOutputRange(destination, range)
    if (definitionError || rangeError) {
      setStatusMessage(definitionError ?? rangeError ?? 'Invalid modulation definition')
      setStatusLevel('warning')
      return false
    }
    const gesture = ensureGesture()
    gesture.preview ??= beginPreview(createTarget())
    const response = await gesture.preview.update({
      destination,
      outputRange: range,
      modulation,
    })
    if (response.status.level === 'error') return false
    return response.accepted || !response.project_changed
  }, [beginPreview, catalog, createTarget, destination, ensureGesture, setStatusLevel, setStatusMessage])

  const applyAtomicState = useCallback((
    createNext: (current: ModulationEditorState) => ModulationEditorState
  ): void => {
    const current = stateRef.current
    if (!current || busy) return
    const next = createNext(current)
    installState(next)
    setBusy(true)
    void emitState(next).then(async (accepted) => {
      const gesture = gestureRef.current
      if (!gesture?.preview || !accepted || gesture.finishing) return
      gesture.finishing = true
      await gesture.preview.commit()
      gestureRef.current = null
    }).catch(async (error: unknown) => {
      const gesture = gestureRef.current
      installState(gesture?.baseline ?? current)
      if (gesture?.preview) await gesture.preview.cancel().catch(() => undefined)
      gestureRef.current = null
      reportFailure('Modulation edit failed', error)
    }).finally(() => setBusy(false))
  }, [busy, emitState, installState, reportFailure])

  const beginContinuousEdit = useCallback((): boolean => {
    if (busy || !stateRef.current) return false
    if (gestureRef.current) return !gestureRef.current.finishing
    ensureGesture()
    return true
  }, [busy, ensureGesture])

  const updateContinuousState = useCallback((
    createNext: (current: ModulationEditorState) => ModulationEditorState
  ): void => {
    const current = stateRef.current
    if (!current) return
    ensureGesture()
    const next = createNext(current)
    installState(next)
    void emitState(next).catch((error: unknown) => reportFailure('Modulation preview failed', error))
  }, [emitState, ensureGesture, installState, reportFailure])

  const finishContinuousEdit = useCallback((action: 'commit' | 'cancel'): void => {
    const gesture = gestureRef.current
    if (!gesture || gesture.finishing) return
    gesture.finishing = true
    if (action === 'cancel') installState(gesture.baseline)
    if (!gesture.preview) {
      gestureRef.current = null
      return
    }
    setBusy(true)
    void gesture.preview[action]().catch((error: unknown) => {
      installState(gesture.baseline)
      reportFailure('Modulation preview failed', error)
    }).finally(() => {
      if (gestureRef.current === gesture) gestureRef.current = null
      setBusy(false)
    })
  }, [installState, reportFailure])

  const commitContinuousEdit = useCallback((): void => {
    finishContinuousEdit('commit')
  }, [finishContinuousEdit])
  const cancelContinuousEdit = useCallback((): void => {
    finishContinuousEdit('cancel')
  }, [finishContinuousEdit])

  useEffect(() => {
    const cancelOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !gestureRef.current) return
      event.preventDefault()
      cancelContinuousEdit()
    }
    const cancelOnBlur = (): void => cancelContinuousEdit()
    window.addEventListener('keydown', cancelOnEscape, true)
    window.addEventListener('blur', cancelOnBlur)
    return () => {
      window.removeEventListener('keydown', cancelOnEscape, true)
      window.removeEventListener('blur', cancelOnBlur)
      cancelContinuousEdit()
    }
  }, [cancelContinuousEdit])

  const plotPaths = useMemo(() => state ? createModulationPlotPaths(state) : {
    waveforms: [],
    combined: '',
  }, [state])

  const updateLocalState = useCallback((
    createNext: (current: ModulationEditorState) => ModulationEditorState
  ): void => {
    const current = stateRef.current
    if (current) installState(createNext(current))
  }, [installState])

  return {
    state,
    busy,
    waveformManagerOpen,
    setWaveformManagerOpen,
    plotPaths,
    updateLocalState,
    applyAtomicState,
    beginContinuousEdit,
    updateContinuousState,
    commitContinuousEdit,
    cancelContinuousEdit,
  }
}
