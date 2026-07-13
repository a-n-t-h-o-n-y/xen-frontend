import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ModulationHeader } from './ModulationHeader'

describe('ModulationHeader', () => {
  it('replaces normal chrome with modulation controls and a clear exit', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(<ModulationHeader controls={<div>Wave controls</div>} onDone={onDone} />)

    expect(screen.getByText('Modulation')).toBeInTheDocument()
    expect(screen.getByText('Wave controls')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledOnce()
  })
})
