import { useEffect, useRef, useState } from 'react'

export function useScaleMenu() {
  const [openScaleMenu, setOpenScaleMenu] = useState(false)
  const scaleMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!openScaleMenu) {
      return
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const host = scaleMenuRef.current
      if (!host) {
        return
      }
      if (event.target instanceof Node && !host.contains(event.target)) {
        setOpenScaleMenu(false)
      }
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpenScaleMenu(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [openScaleMenu])

  return {
    openScaleMenu,
    setOpenScaleMenu,
    scaleMenuRef,
  }
}
