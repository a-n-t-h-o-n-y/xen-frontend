type CompositionScrollRect = Pick<DOMRectReadOnly, 'top' | 'right' | 'bottom' | 'left'>

export const getCompositionSelectionScrollDelta = (
  scrollerRect: CompositionScrollRect,
  selectedRect: CompositionScrollRect,
  stickySize: { width: number; height: number }
): { topDelta: number; leftDelta: number } => {
  const visibleTop = scrollerRect.top + stickySize.height
  const visibleLeft = scrollerRect.left + stickySize.width
  let topDelta = 0
  let leftDelta = 0

  if (selectedRect.top < visibleTop) {
    topDelta = selectedRect.top - visibleTop
  } else if (selectedRect.bottom > scrollerRect.bottom) {
    topDelta = selectedRect.bottom - scrollerRect.bottom
  }

  if (selectedRect.left < visibleLeft) {
    leftDelta = selectedRect.left - visibleLeft
  } else if (selectedRect.right > scrollerRect.right) {
    leftDelta = selectedRect.right - scrollerRect.right
  }

  return { topDelta, leftDelta }
}
