import type { Catalog } from './contracts'
import type { CommandReferenceEntry, SessionReference } from '../shared'

const commandSearchText = (command: CommandReferenceEntry): string => [
  command.id,
  command.signature,
  ...command.keywords,
  command.description,
  command.targetRequirement,
  command.acceptsPatternPrefix ? 'pattern prefix' : '',
  ...command.arguments.flatMap((argument) => [
    argument.kind,
    argument.displayName,
    argument.required ? 'required' : 'optional',
    argument.defaultValue ?? '',
    ...argument.constraints.flatMap((constraint) => [
      constraint.kind,
      constraint.minimum?.toString() ?? '',
      constraint.maximum?.toString() ?? '',
      ...constraint.values,
    ]),
  ]),
].join(' ').toLowerCase()

export const filterCommandReference = (
  commands: CommandReferenceEntry[],
  search: string
): CommandReferenceEntry[] => {
  const query = search.trim().toLowerCase()
  if (!query) return commands
  return commands.filter((command) => commandSearchText(command).includes(query))
}

export const buildSessionReference = (
  catalog: Catalog
): SessionReference => ({
  commands: catalog.commands.map((command) => {
    const argumentsText = command.arguments.map((argument) => {
      const label = argument.default_value === null
        ? argument.display_name
        : `${argument.display_name}=${argument.default_value}`
      return argument.required ? `<${label}>` : `[${label}]`
    })
    const id = command.path.join(' ')
    return {
      id,
      signature: [id, ...argumentsText].join(' '),
      keywords: command.keywords,
      description: command.description,
      targetRequirement: command.target_requirement,
      acceptsPatternPrefix: command.accepts_pattern_prefix,
      arguments: command.arguments.map((argument) => ({
        kind: argument.kind,
        displayName: argument.display_name,
        required: argument.required,
        defaultValue: argument.default_value,
        constraints: argument.constraints.map((constraint) => ({
          kind: constraint.kind,
          minimum: constraint.minimum,
          maximum: constraint.maximum,
          values: constraint.values,
        })),
      })),
    }
  }),
})
