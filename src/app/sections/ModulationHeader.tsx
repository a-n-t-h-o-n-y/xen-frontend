import type { ReactNode } from 'react'

type ModulationHeaderProps = {
  controls: ReactNode
}

export function ModulationHeader({ controls }: ModulationHeaderProps) {
  return (
    <section className="headerControlRow modulationHeader" aria-label="Modulation mode">
      {controls}
    </section>
  )
}
