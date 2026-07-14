import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BridgePayloadError } from '../bridge/BridgeClient'
import { projectFromDto } from '../domain/mappers'
import { projectFixture } from '../domain/testFixtures'
import { useBridgeSession } from './useBridgeSession'
import type { BridgeMethodMap, RequestOptions } from '../bridge/BridgeClient'

type Request = <K extends keyof BridgeMethodMap>(
  name: K,
  payload: BridgeMethodMap[K]['request'],
  options?: RequestOptions
) => Promise<BridgeMethodMap[K]['response']>

const createArgs = (request: Request) => ({
  request,
  projectRef: { current: projectFromDto({
    ...projectFixture('3'),
    document: { ...projectFixture('3').document, dirty: true },
  }) },
  editorStateRef: { current: { selection: { path: [] }, inputMode: 'pitch' as const } },
  activeSequenceTargetRef: { current: null },
  compositionSelectionRef: { current: { rowCoordinate: 0, columnCoordinate: 0 } },
  workspaceViewRef: { current: 'sequencer' as 'sequencer' | 'composition' },
  setProject: vi.fn(),
  setEditorState: vi.fn(),
  setStatusMessage: vi.fn(),
  setStatusLevel: vi.fn(),
  setLibrarySnapshot: vi.fn(),
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useBridgeSession document lifecycle', () => {
  it('retries unsaved project replacement with the original project revision', async () => {
    const requestMock = vi.fn(async (name: string) => {
      if (name === 'project.new' && requestMock.mock.calls.length === 1) {
        throw new BridgePayloadError('unsaved_changes', 'Unsaved changes')
      }
      return { snapshot: projectFixture('4') }
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { result } = renderHook(() => useBridgeSession(createArgs(requestMock as Request)))

    await act(async () => result.current.newProject())

    expect(requestMock).toHaveBeenNthCalledWith(1, 'project.new', {
      expected_project_revision: '3',
      discard_unsaved: false,
    })
    expect(requestMock).toHaveBeenNthCalledWith(2, 'project.new', {
      expected_project_revision: '3',
      discard_unsaved: true,
    })
  })

  it('uses the file_exists revision for a confirmed save-as retry', async () => {
    const requestMock = vi.fn(async (name: string) => {
      if (name === 'project.save_as' && requestMock.mock.calls.length === 1) {
        throw new BridgePayloadError('file_exists', 'Target exists', {
          file_revision: 'sha256:on-disk',
        })
      }
      return {
        snapshot: projectFixture('4'),
        file: {
          name: 'song.xenproj',
          relative_path: 'sets/song.xenproj',
          stem: 'song',
          file_revision: 'sha256:saved',
        },
      }
    })
    vi.spyOn(window, 'prompt').mockReturnValue('sets/song.xenproj')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { result } = renderHook(() => useBridgeSession(createArgs(requestMock as Request)))

    await act(async () => result.current.saveProjectAs())

    expect(requestMock).toHaveBeenNthCalledWith(1, 'project.save_as', {
      relative_path: 'sets/song.xenproj',
      expected_project_revision: '3',
      expected_file_revision: null,
    })
    expect(requestMock).toHaveBeenNthCalledWith(2, 'project.save_as', {
      relative_path: 'sets/song.xenproj',
      expected_project_revision: '3',
      expected_file_revision: 'sha256:on-disk',
    })
  })

  it('imports a library cell with the current cursor and decimal project revision', async () => {
    const requestMock = vi.fn(async () => ({
      snapshot: projectFixture('4'),
      suggested_selection: { path: [] },
    }))
    const args = createArgs(requestMock as Request)
    args.compositionSelectionRef.current = { rowCoordinate: -8, columnCoordinate: 13 }
    args.workspaceViewRef.current = 'composition'
    const { result } = renderHook(() => useBridgeSession(args))

    await act(async () => result.current.importCell({ relativePath: 'cells/bass.xencell' }))

    expect(requestMock).toHaveBeenCalledWith('cell.import', {
      relative_path: 'cells/bass.xencell',
      expected_project_revision: '3',
      cursor: { row_coordinate: -8, column_coordinate: 13, sequence_id: null },
    })
  })
})
