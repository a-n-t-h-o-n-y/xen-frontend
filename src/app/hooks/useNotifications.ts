import { useCallback, useEffect, useRef, useState } from 'react'

export type AppNotification = {
  id: number
  level: 'warning' | 'error'
  message: string
}

const WARNING_DURATION_MS = 5_000
const MAX_NOTIFICATIONS = 3

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const nextIdRef = useRef(1)
  const timersRef = useRef(new Map<number, number>())

  const dismissNotification = useCallback((id: number): void => {
    const timer = timersRef.current.get(id)
    if (timer !== undefined) window.clearTimeout(timer)
    timersRef.current.delete(id)
    setNotifications((current) => current.filter((notification) => notification.id !== id))
  }, [])

  const notify = useCallback((level: 'warning' | 'error', message: string): void => {
    const trimmed = message.trim()
    if (!trimmed) return

    setNotifications((current) => {
      const duplicate = current.find((notification) =>
        notification.level === level && notification.message === trimmed
      )
      const id = duplicate?.id ?? nextIdRef.current++
      const next = [
        ...current.filter((notification) => notification.id !== id),
        { id, level, message: trimmed },
      ].slice(-MAX_NOTIFICATIONS)

      for (const timerId of Array.from(timersRef.current.keys())) {
        if (!next.some((notification) => notification.id === timerId)) {
          const timer = timersRef.current.get(timerId)
          if (timer !== undefined) window.clearTimeout(timer)
          timersRef.current.delete(timerId)
        }
      }

      const previousTimer = timersRef.current.get(id)
      if (previousTimer !== undefined) window.clearTimeout(previousTimer)
      timersRef.current.delete(id)
      if (level === 'warning') {
        const timer = window.setTimeout(() => dismissNotification(id), WARNING_DURATION_MS)
        timersRef.current.set(id, timer)
      }
      return next
    })
  }, [dismissNotification])

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) window.clearTimeout(timer)
    timersRef.current.clear()
  }, [])

  return { notifications, notify, dismissNotification }
}
