import type { Dispatch, SetStateAction } from 'react'
import { formatKeymapTarget, formatKeymapTrigger } from '../../domain/keymap'
import type { KeymapResource } from '../../domain/contracts'
import type { SessionReference } from '../../shared'

type ReferencePanelProps = {
  activeReferenceTab: 'commands' | 'keybindings'
  setActiveReferenceTab: Dispatch<SetStateAction<'commands' | 'keybindings'>>
  sessionReference: SessionReference
  referenceSearchInputRef: { current: HTMLInputElement | null }
  referenceCommandSearch: string
  setReferenceCommandSearch: Dispatch<SetStateAction<string>>
  filteredReferenceCommands: SessionReference['commands']
  focusCommandBarWithText: (value: string) => void
  keymapResource: KeymapResource | null
}

export function ReferencePanel({
  activeReferenceTab,
  setActiveReferenceTab,
  sessionReference,
  referenceSearchInputRef,
  referenceCommandSearch,
  setReferenceCommandSearch,
  filteredReferenceCommands,
  focusCommandBarWithText,
  keymapResource,
}: ReferencePanelProps) {
  return (
    <article className="bottomModule bottomModule-rowItem bottomModule-reference">
      <div className="bottomModuleHeader">
        <p className="bottomModuleLabel">Reference</p>
        <div className="referenceTabs" role="tablist" aria-label="Reference tabs">
          <button
            type="button"
            className={`referenceTab${activeReferenceTab === 'commands' ? ' referenceTab-active' : ''}`}
            role="tab"
            aria-selected={activeReferenceTab === 'commands'}
            onClick={() => setActiveReferenceTab('commands')}
          >
            Commands
          </button>
          <button
            type="button"
            className={`referenceTab${activeReferenceTab === 'keybindings' ? ' referenceTab-active' : ''}`}
            role="tab"
            aria-selected={activeReferenceTab === 'keybindings'}
            onClick={() => setActiveReferenceTab('keybindings')}
          >
            Keybindings
          </button>
        </div>
      </div>
      <div className="referenceContent">
        {activeReferenceTab === 'commands' ? (
          sessionReference.commands.length > 0 ? (
            <div className="referenceCommands">
              <div className="referenceCommandSearchField">
                <input
                  ref={referenceSearchInputRef}
                  type="search"
                  className="referenceCommandSearchInput mono"
                  value={referenceCommandSearch}
                  onChange={(event) => setReferenceCommandSearch(event.target.value)}
                  placeholder="Search command name..."
                  aria-label="Search command name"
                />
                {referenceCommandSearch.length > 0 ? (
                  <button
                    type="button"
                    className="referenceCommandSearchClear"
                    aria-label="Clear command search"
                    onMouseDown={(event) => {
                      event.preventDefault()
                    }}
                    onClick={() => {
                      setReferenceCommandSearch('')
                      referenceSearchInputRef.current?.focus()
                    }}
                  >
                    x
                  </button>
                ) : null}
              </div>
              {filteredReferenceCommands.length > 0 ? (
                filteredReferenceCommands.map((command) => (
                  <button
                    key={`reference-command-${command.id}`}
                    type="button"
                    className="referenceCommandRow referenceCommandButton"
                    onClick={() => focusCommandBarWithText(command.signature || command.id)}
                  >
                    <p className="referenceCommandId mono">{command.id}</p>
                    <p className="referenceCommandSignature mono">{command.signature}</p>
                    <p className="referenceCommandDescription">{command.description}</p>
                  </button>
                ))
              ) : (
                <p className="referencePlaceholder">No commands match that search.</p>
              )}
            </div>
          ) : (
            <p className="referencePlaceholder">No command reference data received.</p>
          )
        ) : keymapResource && Object.keys(keymapResource.bindings).length > 0 ? (
          <div className="referenceKeybindings">
            {Object.entries(keymapResource.bindings).map(([context, bindings]) => (
              <div className="referenceKeybindingGroup" key={context}>
                <p className="referenceModeBadge mono">{context}</p>
                <table className="referenceKeybindingTable">
                  <thead>
                    <tr>
                      <th className="mono">Shortcut</th>
                      <th className="mono">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bindings.map((binding) => (
                      <tr key={`${context}-${formatKeymapTrigger(binding.trigger)}`}>
                        <td className="referenceKeybindingKey mono">
                          {formatKeymapTrigger(binding.trigger)}
                        </td>
                        <td className="referenceKeybindingCommand mono">
                          {formatKeymapTarget(binding.target)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <p className="referencePlaceholder">No keybindings received.</p>
        )}
      </div>
    </article>
  )
}
