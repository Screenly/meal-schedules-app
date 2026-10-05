/**
 * Shrink a single line of text until it fits its box.
 *
 * A venue called "The Orangery at Hartwell House" has to sit on one line
 * beside the clock, and a wrapped line would push the board down the screen.
 */
export function fitToWidth(
  element: HTMLElement,
  maxFontSize: number,
  minFontSize: number,
): void {
  element.style.fontSize = `${maxFontSize}px`

  const available = element.clientWidth
  if (!available || element.scrollWidth <= available) {
    return
  }

  let size = Math.max(
    minFontSize,
    Math.floor((maxFontSize * available) / element.scrollWidth),
  )
  element.style.fontSize = `${size}px`

  while (size > minFontSize && element.scrollWidth > available) {
    size -= 1
    element.style.fontSize = `${size}px`
  }
}
