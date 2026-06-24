import { sessionReferenceFromCatalogDto } from './mappers'
import type { CatalogDto } from './contracts'
import type { CommandReferenceEntry, SessionReference } from './models'

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
  catalog: CatalogDto
): SessionReference => sessionReferenceFromCatalogDto(catalog)
