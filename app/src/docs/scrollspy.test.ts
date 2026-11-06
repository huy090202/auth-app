import { describe, expect, it } from 'vitest';
import { activeIndex, landingY } from './scrollspy';

/** Viewport tops of headings placed at these page offsets, seen from scroll position y. */
const topsAt = (offsets: number[], y: number) => offsets.map((o) => o - y);

describe('activeIndex', () => {
  const VIEWPORT = 900;

  it('picks the first heading before any has reached the line', () => {
    expect(activeIndex(topsAt([500, 1500], 0), 0, 5000, VIEWPORT)).toBe(0);
  });

  it('picks the last heading above the line, away from the end of the page', () => {
    const offsets = [500, 1500, 2500, 5400];
    expect(activeIndex(topsAt(offsets, 1400), 1400, 5000, VIEWPORT)).toBe(1);
    expect(activeIndex(topsAt(offsets, 1379), 1379, 5000, VIEWPORT)).toBe(0);
    expect(activeIndex(topsAt(offsets, 2400), 2400, 5000, VIEWPORT)).toBe(2);
  });

  it('picks the last heading at the end of the page, even when it cannot reach the line', () => {
    const offsets = [100, 700, 1000];
    expect(activeIndex(topsAt(offsets, 500), 500, 500, VIEWPORT)).toBe(2);
  });

  it('gives every heading a turn on a page too short for them to reach the line', () => {
    const offsets = [100, 400, 700, 1000];
    const seen: number[] = [];
    for (let y = 0; y <= 500; y++) {
      const i = activeIndex(topsAt(offsets, y), y, 500, VIEWPORT);
      if (seen.at(-1) !== i) seen.push(i);
    }
    expect(seen).toEqual([0, 1, 2, 3]);
  });

  it('stays on the first heading when the page cannot scroll', () => {
    expect(activeIndex(topsAt([100, 400], 0), 0, 0, VIEWPORT)).toBe(0);
  });
});

describe('landingY', () => {
  it('leaves the heading just under the header', () => {
    expect(landingY(1000, 200, 76, 5000)).toBe(1124);
  });

  it('stops at the end of the page', () => {
    expect(landingY(1000, 200, 76, 508)).toBe(508);
  });

  it('stops at the top of the page', () => {
    expect(landingY(10, 0, 76, 508)).toBe(0);
  });
});
