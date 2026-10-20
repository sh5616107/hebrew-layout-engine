import { describe, it, expect } from 'vitest';
import { fitLine, glueCount } from '../../../src/justification/fit-line';
import type { ShapedWord } from '../../../src/line-breaking/greedy-breaker';

const w = (width: number, extra: Partial<ShapedWord> = {}): ShapedWord => ({
  text: 'x',
  glyphIds: [1],
  advances: [width],
  width,
  ...extra,
});
const range = { natural: 4, min: 3, max: 6 };

describe('fitLine', () => {
  it('keeps natural gaps when the line is exactly full', () => {
    const f = fitLine([w(40), w(40), w(40)], 128, range, true);
    expect(f.gaps).toEqual([4, 4]);
    expect(f.ratio).toBe(0);
    expect(f.width).toBe(128);
  });

  it('stretches all gaps equally; ratio 1 means every gap at max', () => {
    const f = fitLine([w(40), w(40), w(40)], 124 + 4, range, true); // natural 128
    expect(f.ratio).toBe(0);
    const g = fitLine([w(40), w(40), w(40)], 132, range, true); // +4 over 2 gaps, stretch 2*2
    expect(g.ratio).toBe(1);
    expect(g.gaps).toEqual([6, 6]);
    expect(g.width).toBe(132);
  });

  it('clamp stops at max and leaves the line short; no clamp fills it', () => {
    const clamped = fitLine([w(40), w(40), w(40)], 150, range, true);
    expect(clamped.gaps).toEqual([6, 6]);
    expect(clamped.width).toBe(132);
    const flush = fitLine([w(40), w(40), w(40)], 150, range, false);
    expect(flush.width).toBeCloseTo(150, 10);
    expect(flush.ratio).toBeGreaterThan(1);
  });

  it('shrinks down to min and no further (overfull stays overfull)', () => {
    const half = fitLine([w(40), w(40), w(40)], 127, range, true); // -1 over 2 gaps, shrink 2
    expect(half.ratio).toBeCloseTo(-0.5, 10);
    expect(half.gaps[0]).toBeCloseTo(3.5, 10);
    const over = fitLine([w(40), w(40), w(40)], 100, range, true);
    expect(over.ratio).toBe(-1);
    expect(over.gaps).toEqual([3, 3]);
    expect(over.width).toBeGreaterThan(100);
  });

  it('gives no gap, and no elasticity, after a joinNext word', () => {
    const words = [w(30, { joinNext: true }), w(30), w(30)];
    expect(glueCount(words)).toBe(1);
    const f = fitLine(words, 30 + 30 + 30 + 6, range, true);
    expect(f.gaps).toEqual([0, 6]);
    expect(f.width).toBe(96);
  });

  it('handles lines without any elastic gap', () => {
    expect(fitLine([w(50)], 100, range, false).gaps).toEqual([]);
    expect(fitLine([w(20, { joinNext: true }), w(20)], 100, range, false).gaps).toEqual([0]);
  });
});
