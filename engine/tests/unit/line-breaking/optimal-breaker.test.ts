import { describe, it, expect } from 'vitest';
import { breakLines, type ShapedWord } from '../../../src/line-breaking/greedy-breaker';
import {
  breakLinesOptimal,
  scoreBreaks,
  type OptimalBreakerOptions,
} from '../../../src/line-breaking/optimal-breaker';

const w = (width: number, extra: Partial<ShapedWord> = {}): ShapedWord => ({
  text: `w${width}`,
  glyphIds: [1],
  advances: [width],
  width,
  ...extra,
});
const opts = (maxWidth: number): OptimalBreakerOptions => ({
  maxWidth,
  natural: 4,
  min: 3.4,
  max: 5.6,
});

// small deterministic PRNG so failures are reproducible
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomText(rand: () => number, n: number): ShapedWord[] {
  const words: ShapedWord[] = [];
  for (let i = 0; i < n; i++) {
    const width = 12 + Math.floor(rand() * 40);
    words.push(
      w(width, {
        text: `t${i}`,
        ...(rand() < 0.2 ? { joinNext: true } : {}),
        ...(rand() < 0.06 ? { endsParagraph: true } : {}),
      })
    );
  }
  return words;
}

describe('breakLinesOptimal', () => {
  it('returns nothing for no words', () => {
    expect(breakLinesOptimal([], opts(100)).lines).toEqual([]);
  });

  it('puts every word on exactly one line, in order', () => {
    const rand = mulberry32(1);
    for (let t = 0; t < 50; t++) {
      const words = randomText(rand, 60);
      const r = breakLinesOptimal(words, opts(180));
      expect(r.lines.flat().map((x) => x.text)).toEqual(words.map((x) => x.text));
    }
  });

  it('never makes a multi-word line that cannot fit even at minimum spacing', () => {
    const rand = mulberry32(2);
    for (let t = 0; t < 50; t++) {
      const r = breakLinesOptimal(randomText(rand, 60), opts(180));
      r.lines.forEach((line) => {
        if (line.length < 2) return;
        let glue = 0;
        for (let i = 0; i < line.length - 1; i++) if (!line[i]?.joinNext) glue++;
        const minWidth = line.reduce((s, x) => s + x.width, 0) + glue * 3.4;
        expect(minWidth).toBeLessThanOrEqual(180 + 1e-9);
      });
    }
  });

  it('is never worse than the greedy breaker under the same scoring (300 random texts)', () => {
    const rand = mulberry32(3);
    for (let t = 0; t < 300; t++) {
      const words = randomText(rand, 10 + Math.floor(rand() * 80));
      const width = 100 + Math.floor(rand() * 120);
      const o = opts(width);
      const optimal = breakLinesOptimal(words, o);
      const greedy = breakLines(words, { maxWidth: width, wordSpacing: o.natural });
      expect(optimal.totalDemerits).toBeLessThanOrEqual(scoreBreaks(greedy.lines, o) + 1e-6);
    }
  });

  it('reports the same total as scoreBreaks() on its own result', () => {
    const rand = mulberry32(4);
    const words = randomText(rand, 80);
    const r = breakLinesOptimal(words, opts(170));
    expect(scoreBreaks(r.lines, opts(170))).toBeCloseTo(r.totalDemerits, 3);
  });

  it('penalizes a one-word final line, and allows disabling the penalty', () => {
    const lines = [[w(30), w(30)], [w(30)]];
    const base = { ...opts(100), runtPenalty: 0 };
    const penalized = { ...opts(100), runtPenalty: 500 };
    expect(scoreBreaks(lines, penalized)).toBeGreaterThan(scoreBreaks(lines, base));
    expect(scoreBreaks(lines, { ...opts(100), runtPenalty: 0 })).toBeCloseTo(
      scoreBreaks(lines, base),
      10,
    );
  });


it('avoids a one-word final line when a better alternative exists', () => {
  const words = [35, 15, 15, 15, 15, 45].map((x) => w(x));
  const free = breakLinesOptimal(words, {
    ...opts(80),
    runtPenalty: 0,
  });
  const penalized = breakLinesOptimal(words, {
    ...opts(80),
    runtPenalty: 1000,
  });

  expect(free.lines.at(-1)).toHaveLength(1);
  expect(penalized.lines.at(-1)!.length).toBeGreaterThan(1);
  expect(penalized.totalDemerits).toBeCloseTo(
    scoreBreaks(penalized.lines, { ...opts(80), runtPenalty: 1000 }),
    3,
  );
});

  it('beats the greedy breaker on a case where greedy strands a word', () => {
    // width 100: greedy gives [20 40 | 50 | 60 20 ...]-style lines with a lone, unstretchable word;
    // the optimum avoids it. (Found by exhaustive search over small cases.)
    const words = [20, 40, 50, 60, 20].map((x) => w(x));
    const o = opts(100);
    const optimal = breakLinesOptimal(words, o);
    const greedy = breakLines(words, { maxWidth: 100, wordSpacing: 4 });
    expect(optimal.totalDemerits).toBeLessThan(scoreBreaks(greedy.lines, o) / 1.5);
  });

  it('forces a break after endsParagraph and leaves that last line at natural spacing', () => {
    const words = [w(30), w(30, { endsParagraph: true }), w(30), w(30)];
    const r = breakLinesOptimal(words, opts(200));
    expect(r.lines.map((l) => l.length)).toEqual([2, 2]);
    expect(r.ratios).toEqual([0, 0]);
  });

  it('breaks after a joinNext piece (maqaf) with no gap when that is the only way to fit', () => {
    // a b-  c : 'a' 'b-' fit on the first line, 'c' (the rest of the maqaf word) wraps
    const words = [w(60), w(60, { joinNext: true }), w(60), w(20)];
    const r = breakLinesOptimal(words, opts(140));
    expect(r.lines.length).toBeGreaterThan(1);
    const ends = r.lines.slice(0, -1).map((l) => l[l.length - 1]);
    expect(ends.some((x) => x?.joinNext)).toBe(true);
    // the join adds no gap: a line holding 'b-' then 'c' has natural width without a gap between
    const joined = r.lines.find((l) => l.some((x, i) => x.joinNext && i < l.length - 1));
    if (joined) {
      const sum = joined.reduce((s, x) => s + x.width, 0);
      const glue = joined.filter((x, i) => !x.joinNext && i < joined.length - 1).length;
      expect(r.lineWidths[r.lines.indexOf(joined)]).toBeCloseTo(sum + glue * 4, 10);
    }
  });

  it('joinBreakPenalty decides whether a maqaf break is used when a space break also works', () => {
    // widths and joinNext flags found by search: with no penalty the best layout ends a line
    // after a maqaf piece, with a huge penalty an equally feasible layout at a space is chosen
    const words = [
      [60, false], [30, false], [30, false], [20, true], [60, false], [30, true], [30, false],
    ].map(([x, j]) => w(x as number, j ? { joinNext: true } : {}));
    const endsAtMaqaf = (r: ReturnType<typeof breakLinesOptimal>): number =>
      r.lines.slice(0, -1).filter((l) => l[l.length - 1]?.joinNext).length;

    const free = breakLinesOptimal(words, { ...opts(100), joinBreakPenalty: 0 });
    const costly = breakLinesOptimal(words, { ...opts(100), joinBreakPenalty: 1e6 });
    expect(endsAtMaqaf(free)).toBeGreaterThan(0);
    expect(endsAtMaqaf(costly)).toBe(0);
    expect(costly.overfull.every((x) => !x)).toBe(true);
  });

  it('flags a word wider than the line as overfull instead of failing', () => {
    const r = breakLinesOptimal([w(20), w(300), w(20)], opts(100));
    expect(r.lines.flat()).toHaveLength(3);
    expect(r.overfull).toContain(true);
    expect(r.overfull.filter(Boolean)).toHaveLength(1);
  });

  it('is deterministic', () => {
    const rand = mulberry32(5);
    const words = randomText(rand, 100);
    const a = breakLinesOptimal(words, opts(150));
    const b = breakLinesOptimal(words, opts(150));
    expect(b.lines.map((l) => l.map((x) => x.text))).toEqual(a.lines.map((l) => l.map((x) => x.text)));
  });
});

describe('greedy breaker with paragraph and maqaf data', () => {
  it('adds no space after a joinNext word', () => {
    const r = breakLines([w(40, { joinNext: true }), w(40)], { maxWidth: 83, wordSpacing: 4 });
    expect(r.lines).toHaveLength(1); // 40 + 0 + 40 = 80 fits; with a gap it would be 84
  });

  it('never lets a paragraph share a line with the next one', () => {
    const r = breakLines([w(10, { endsParagraph: true }), w(10)], { maxWidth: 200, wordSpacing: 4 });
    expect(r.lines.map((l) => l.length)).toEqual([1, 1]);
  });
});
