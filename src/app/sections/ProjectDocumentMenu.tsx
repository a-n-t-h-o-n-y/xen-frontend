import type { ProjectSnapshot } from '../domain/models'

type ProjectDocumentMenuProps = {
  project: ProjectSnapshot | null
  busy: boolean
  disabledReason: string | null
  onNewProject: () => Promise<void>
  onSaveProject: () => Promise<void>
  onSaveProjectAs: () => Promise<void>
  onSaveCell: () => Promise<void>
  onRestoreRecovery: () => Promise<void>
  onDiscardRecovery: () => Promise<void>
}

export function ProjectDocumentMenu({
  project,
  busy,
  disabledReason,
  onNewProject,
  onSaveProject,
  onSaveProjectAs,
  onSaveCell,
  onRestoreRecovery,
  onDiscardRecovery,
}: ProjectDocumentMenuProps) {
  const unavailable = disabledReason !== null || project === null
  const documentOperationsDisabled = unavailable || busy || project?.previewActive === true
  const recoveryTimestamp = Number(project?.recovery?.savedAtUnixMs)
  const recoveryDescription = project?.recovery
    ? `${project.recovery.relativePath ?? 'Untitled'} · ${
        Number.isSafeInteger(recoveryTimestamp)
          ? new Date(recoveryTimestamp).toLocaleString()
          : `saved at ${project.recovery.savedAtUnixMs} ms`
      }`
    : ''
  const invoke = (operation: () => Promise<void>): void => {
    void operation().catch(() => undefined)
  }

  return (
    <details className="projectDocumentMenu">
      <summary
        className="headerUtilityButton projectDocumentTrigger"
        role="button"
        aria-label={`Project actions for ${project?.document.displayName ?? 'loading project'}`}
      >
        <span className="projectDocumentTriggerLabel">
          {project?.document.displayName ?? 'Project'}
        </span>
        {project?.document.dirty ? (
          <span className="projectDocumentDirty" aria-label="Unsaved changes">●</span>
        ) : null}
        {project?.recovery ? (
          <span className="projectDocumentRecovery" aria-label="Recovery available">!</span>
        ) : null}
      </summary>
      <div className="projectDocumentPopover" role="group" aria-label="Project document actions">
        <div className="projectDocumentIdentity">
          <strong>{project?.document.displayName ?? 'Project unavailable'}</strong>
          <span title={project?.document.relativePath ?? undefined}>
            {project?.document.relativePath ?? 'Not saved yet'}
          </span>
        </div>
        {project?.recovery ? (
          <div className="projectRecoveryNotice" role="status">
            <span>A recovery copy is available.</span>
            <span className="projectRecoveryMetadata" title={recoveryDescription}>
              {recoveryDescription}
            </span>
            <div className="projectDocumentActionRow">
              <button
                type="button"
                className="projectDocumentAction"
                disabled={documentOperationsDisabled}
                onClick={() => invoke(onRestoreRecovery)}
              >
                Restore
              </button>
              <button
                type="button"
                className="projectDocumentAction projectDocumentAction-danger"
                disabled={documentOperationsDisabled}
                onClick={() => invoke(onDiscardRecovery)}
              >
                Discard
              </button>
            </div>
          </div>
        ) : null}
        <div className="projectDocumentActionGrid">
          <button
            type="button"
            className="projectDocumentAction"
            disabled={documentOperationsDisabled}
            onClick={() => invoke(onNewProject)}
          >
            New project
          </button>
          <button
            type="button"
            className="projectDocumentAction"
            disabled={documentOperationsDisabled || !project?.document.dirty}
            onClick={() => invoke(onSaveProject)}
          >
            Save
          </button>
          <button
            type="button"
            className="projectDocumentAction"
            disabled={documentOperationsDisabled}
            onClick={() => invoke(onSaveProjectAs)}
          >
            Save as…
          </button>
          <button
            type="button"
            className="projectDocumentAction"
            disabled={documentOperationsDisabled}
            onClick={() => invoke(onSaveCell)}
          >
            Save selected cell…
          </button>
        </div>
        {project?.previewActive ? (
          <p className="projectDocumentHint">Finish the active preview to use document actions.</p>
        ) : disabledReason ? (
          <p className="projectDocumentHint">{disabledReason}</p>
        ) : null}
      </div>
    </details>
  )
}
