import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationToasts } from '../sections/NotificationToasts'
import { useNotifications } from './useNotifications'

afterEach(() => vi.useRealTimers())

describe('application notifications', () => {
  it('expires warnings while keeping errors until dismissal', () => {
    vi.useFakeTimers()
    const rendered = renderHook(() => useNotifications())

    act(() => {
      rendered.result.current.notify('warning', 'Check this value')
      rendered.result.current.notify('error', 'Backend failed')
    })
    expect(rendered.result.current.notifications).toHaveLength(2)

    act(() => vi.advanceTimersByTime(5_000))
    expect(rendered.result.current.notifications).toEqual([
      expect.objectContaining({ level: 'error', message: 'Backend failed' }),
    ])
  })

  it('deduplicates notifications and keeps only the newest three', () => {
    const rendered = renderHook(() => useNotifications())

    act(() => {
      rendered.result.current.notify('error', 'Repeated')
      rendered.result.current.notify('error', 'Repeated')
      rendered.result.current.notify('error', 'Second')
      rendered.result.current.notify('error', 'Third')
      rendered.result.current.notify('error', 'Fourth')
    })

    expect(rendered.result.current.notifications.map((item) => item.message))
      .toEqual(['Second', 'Third', 'Fourth'])
  })

  it('uses accessible roles and supports manual dismissal', async () => {
    const user = userEvent.setup()
    const dismissNotification = vi.fn()
    render(
      <NotificationToasts
        notifications={[
          { id: 1, level: 'warning', message: 'Warning message' },
          { id: 2, level: 'error', message: 'Error message' },
        ]}
        dismissNotification={dismissNotification}
      />
    )

    expect(screen.getByRole('status')).toHaveTextContent('Warning message')
    expect(screen.getByRole('alert')).toHaveTextContent('Error message')
    await user.click(screen.getAllByRole('button', { name: 'Dismiss notification' })[1]!)
    expect(dismissNotification).toHaveBeenCalledWith(2)
  })
})
