import { useEffect, useState } from 'react'
import type { UiStateSnapshot } from '../../shared'

type SnapshotDebugPanelProps = {
  snapshot: UiStateSnapshot | null
  rawSnapshotText: string
  lastSnapshotSource: string
  snapshotParseError: string | null
  bridgeUnavailableMessage: string | null
}

export function SnapshotDebugPanel({
  snapshot,
  rawSnapshotText,
  lastSnapshotSource,
  snapshotParseError,
  bridgeUnavailableMessage,
}: SnapshotDebugPanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const selectionPath = snapshot?.editor.selected.cell.join(' > ') ?? ''
  const selectedMeasure = snapshot
    ? snapshot.engine.sequence_bank[snapshot.editor.selected.measure] ?? null
    : null
  const selectedCellElements = selectedMeasure?.cell.elements.length ?? 0
  const displayedSnapshotText = rawSnapshotText || '{\n  "status": "Waiting for backend snapshot..."\n}'

  useEffect(() => {
    if (copyState === 'idle') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState('idle')
    }, 1800)

    return () => window.clearTimeout(timeoutId)
  }, [copyState])

  const copySnapshotJson = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(displayedSnapshotText)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <details className="bottomModule bottomModule-debug" aria-label="Snapshot debug inspector">
      <summary className="bottomModuleHeader snapshotDebugSummaryToggle">
        <p className="bottomModuleLabel">Snapshot Debug</p>
        <div className="snapshotDebugSummaryRight">
          <div className="snapshotDebugBadges">
            <span className="snapshotDebugBadge mono">{lastSnapshotSource || 'no snapshot yet'}</span>
            {snapshotParseError ? (
              <span className="snapshotDebugBadge snapshotDebugBadge-error mono">parse error</span>
            ) : snapshot ? (
              <span className="snapshotDebugBadge snapshotDebugBadge-ok mono">parsed</span>
            ) : null}
          </div>
          <span className="snapshotDebugToggleIcon mono" aria-hidden="true">
            ▸
          </span>
        </div>
      </summary>

      <div className="snapshotDebugContent">
        <div className="snapshotDebugHeaderActions">
          <div className="snapshotDebugSummary">
            {bridgeUnavailableMessage ? (
              <p className="snapshotDebugMessage">{bridgeUnavailableMessage}</p>
            ) : snapshot ? (
              <>
                <p className="snapshotDebugMessage">
                  {`schema ${snapshot.schema_version} | snapshot ${snapshot.snapshot_version} | measure ${snapshot.editor.selected.measure} | selection ${selectionPath || '(root)'} | element_index ${snapshot.editor.selected.element_index ?? 'null'}`}
                </p>
                <p className="snapshotDebugMessage">
                  {`sequence_bank ${snapshot.engine.sequence_bank.length} | sequence_names ${snapshot.engine.sequence_names.length} | selected_root_elements ${selectedCellElements}`}
                </p>
              </>
            ) : (
              <p className="snapshotDebugMessage">No parsed snapshot received yet.</p>
            )}
            {snapshotParseError ? (
              <p className="snapshotDebugMessage snapshotDebugMessage-error">{snapshotParseError}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="snapshotDebugCopyButton mono"
            onClick={() => {
              void copySnapshotJson()
            }}
          >
            {copyState === 'copied'
              ? 'Copied'
              : copyState === 'error'
                ? 'Copy Failed'
                : 'Copy JSON'}
          </button>
        </div>

        <div className="snapshotDebugPreWrap">
          <pre className="snapshotDebugPre mono">{displayedSnapshotText}</pre>
        </div>
      </div>
    </details>
  )
}
