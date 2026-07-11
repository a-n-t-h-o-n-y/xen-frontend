import { useCallback, useRef, useState } from 'react'

export function useSettingsOverlayState(onOpen: () => void) {
  const [open, setOpen] = useState(false)
  const openerRef = useRef<HTMLElement | null>(null)

  const openOverlay = useCallback((): void => {
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    onOpen()
    setOpen(true)
  }, [onOpen])

  const closeOverlay = useCallback((): void => {
    setOpen(false)
    window.requestAnimationFrame(() => {
      const opener = openerRef.current
      if (opener?.isConnected) opener.focus()
    })
  }, [])

  return { open, openOverlay, closeOverlay }
}
