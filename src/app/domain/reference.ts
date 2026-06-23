import type { Catalog } from './contracts'
import type { SessionReference } from '../shared'

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
      description: command.description,
    }
  }),
})
