/**
 * Shrink a single line of text until it fits its box.
 *
 * A venue called "The Orangery at Hartwell House" has to sit on one line
 * beside the clock, and a wrapped line would push the board down the screen.
 *
 * The size to start from is read back from the stylesheet rather than passed
 * in. Carrying it in the code means the themes disagree with it: the classic
 * mastheads set the venue two points larger, and a hardcoded maximum wrote
 * that back down on every render.
 */
export function fitToWidth(element: HTMLElement, minFontSize: number): void {
  element.style.removeProperty('font-size')

  const maxFontSize = Number.parseFloat(
    window.getComputedStyle(element).fontSize,
  )
  const available = element.clientWidth
  if (!maxFontSize || !available || element.scrollWidth <= available) {
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
