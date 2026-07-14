import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModulationHeader } from './ModulationHeader'

describe('ModulationHeader', () => {
  it('renders modulation controls in the secondary header row', () => {
    render(<ModulationHeader controls={<div>Wave controls</div>} />)

    expect(screen.getByRole('region', { name: 'Modulation mode' })).toBeInTheDocument()
    expect(screen.getByText('Wave controls')).toBeInTheDocument()
  })
})
