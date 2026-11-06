/** A heading is active once its top passes this line, in px from the top of the viewport. */
const LINE = 120;

/**
 * Index of the active heading: the last one above the line.
 *
 * Headings near the end of a page may never reach the line, because the page runs out of
 * scroll first. So over the last viewport of scroll the line moves down, and it reaches the
 * last heading exactly at the end of the page. Every heading gets a turn, in order.
 *
 * @param tops each heading's top, relative to the viewport
 * @param y current scroll position
 * @param maxY largest scroll position
 * @param viewport viewport height
 */
export function activeIndex(tops: number[], y: number, maxY: number, viewport: number): number {
  const start = Math.max(0, maxY - viewport);
  let line = LINE;
  const lastTop = tops.at(-1);
  if (lastTop !== undefined && y > start) {
    const lastTopAtEnd = lastTop + y - maxY;
    line += Math.max(0, lastTopAtEnd + 1 - LINE) * ((y - start) / (maxY - start));
  }
  let current = 0;
  tops.forEach((top, i) => {
    if (top < line) current = i;
  });
  return current;
}

/**
 * The scroll position a jump to a heading ends at: just under the header, or as far as the
 * page can scroll.
 *
 * @param top the heading's top, relative to the viewport
 * @param y current scroll position
 * @param padding the page's scroll-padding-top
 * @param maxY largest scroll position
 */
export function landingY(top: number, y: number, padding: number, maxY: number): number {
  return Math.max(0, Math.min(maxY, top + y - padding));
}
