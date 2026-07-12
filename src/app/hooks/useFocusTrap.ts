import { useEffect } from 'react'
import type { RefObject } from 'react'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const isVisible = (element: HTMLElement): boolean =>
  element.offsetParent !== null || element.getClientRects().length > 0

const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(isVisible)

export function useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const focusables = getFocusableElements(container)
    if (!container.contains(document.activeElement)) {
      const initialFocus = focusables[0] ?? container
      initialFocus.focus()
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab' || event.defaultPrevented) return

      const currentFocusables = getFocusableElements(container)
      if (currentFocusables.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }

      const first = currentFocusables[0]!
      const last = currentFocusables[currentFocusables.length - 1]!
      const activeElement = document.activeElement

      if (event.shiftKey) {
        if (activeElement === first || !container.contains(activeElement)) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (activeElement === last || !container.contains(activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, containerRef])
}
