import { useMemo, useState } from 'react'
import { filterCommandReference } from '../../domain/reference'
import type { CommandReferenceEntry } from '../../domain/models'

type CommandReferenceSectionProps = {
  commands: CommandReferenceEntry[]
}

const formatTargetRequirement = (
  requirement: CommandReferenceEntry['targetRequirement']
): string => ({
  none: 'No target',
  cell: 'Cell',
  element: 'Element',
  cell_or_element: 'Cell or element',
})[requirement]

const formatConstraint = (
  constraint: CommandReferenceEntry['arguments'][number]['constraints'][number]
): string => {
  const parts = [constraint.kind]
  if (constraint.minimum !== null) parts.push(`min ${constraint.minimum}`)
  if (constraint.maximum !== null) parts.push(`max ${constraint.maximum}`)
  if (constraint.values.length > 0) parts.push(constraint.values.join(', '))
  return parts.join(' · ')
}

export function CommandReferenceSection({ commands }: CommandReferenceSectionProps) {
  const [search, setSearch] = useState('')
  const filteredCommands = useMemo(
    () => filterCommandReference(commands, search),
    [commands, search]
  )

  return (
    <section className="commandReference" aria-labelledby="commands-title">
      <div className="settingsSectionIntro">
        <div>
          <h3 id="commands-title">Commands</h3>
          <p>Browse the command catalog received when this session started.</p>
        </div>
      </div>
      {commands.length > 0 ? (
        <>
          <div className="referenceCommandSearchField commandReferenceSearch">
            <input
              type="search"
              className="referenceCommandSearchInput mono"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search commands and arguments…"
              aria-label="Search commands"
            />
            {search ? (
              <button
                type="button"
                className="referenceCommandSearchClear"
                aria-label="Clear command search"
                onClick={() => setSearch('')}
              >
                ×
              </button>
            ) : null}
          </div>
          <div className="commandReferenceList">
            {filteredCommands.length > 0 ? filteredCommands.map((command) => (
              <details className="commandReferenceRow" key={command.id}>
                <summary className="commandReferenceSummary">
                  <span className="commandReferenceSummaryText">
                    <span className="commandReferenceSignature mono">{command.signature}</span>
                    <span className="commandReferenceDescription">{command.description}</span>
                  </span>
                  <span className="commandReferenceChevron" aria-hidden="true">▸</span>
                </summary>
                <div className="commandReferenceDetails">
                  <dl className="commandReferenceMetadata">
                    <div>
                      <dt>Target</dt>
                      <dd>{formatTargetRequirement(command.targetRequirement)}</dd>
                    </div>
                    <div>
                      <dt>Pattern prefix</dt>
                      <dd>{command.acceptsPatternPrefix ? 'Supported' : 'Not supported'}</dd>
                    </div>
                  </dl>
                  <div className="commandArguments">
                    <h4>Arguments</h4>
                    {command.arguments.length > 0 ? command.arguments.map((argument) => (
                      <div className="commandArgument" key={`${command.id}-${argument.displayName}`}>
                        <div className="commandArgumentHeader">
                          <span className="mono">{argument.displayName}</span>
                          <span>{argument.required ? 'Required' : 'Optional'}</span>
                        </div>
                        <dl className="commandArgumentMetadata">
                          <div>
                            <dt>Kind</dt>
                            <dd>{argument.kind}</dd>
                          </div>
                          <div>
                            <dt>Default</dt>
                            <dd>{argument.defaultValue ?? 'None'}</dd>
                          </div>
                        </dl>
                        {argument.constraints.length > 0 ? (
                          <ul className="commandConstraints">
                            {argument.constraints.map((constraint, index) => (
                              <li key={`${constraint.kind}-${index}`}>
                                {formatConstraint(constraint)}
                              </li>
                            ))}
                          </ul>
                        ) : <p className="commandNoConstraints">No constraints</p>}
                      </div>
                    )) : <p className="commandNoArguments">This command has no arguments.</p>}
                  </div>
                </div>
              </details>
            )) : (
              <p className="settingsEmpty">No commands match that search.</p>
            )}
          </div>
        </>
      ) : (
        <p className="settingsEmpty">No command catalog data received.</p>
      )}
    </section>
  )
}
