/**
 * Optimal line breaking (Knuth–Plass style, whole-paragraph).
 *
 * Instead of filling each line as far as possible, choose the set of breaks that
 * minimises the total "demerits" of all lines. A line's badness grows with the
 * cube of how far its word gaps are stretched or shrunk, so one very loose line
 * is worse than several slightly loose ones - which is what removes the gaps the
 * greedy breaker leaves when the next word is long.
 *
 * Model (same restrictions as the spec): only word gaps are elastic - no
 * hyphenation, no letter stretching. Break opportunities: after every word.
 * After a `joinNext` word (maqaf piece) the break adds no gap; it is allowed but
 * carries `joinBreakPenalty` so a break at a real space is preferred when equal.
 * A word with `endsParagraph` forces a break after it, and that last line stays
 * at natural spacing.
 *
 * Not implemented (documented in ADR-009): fitness classes (tight line next to a
 * loose one), river detection, looseness, forced widow/orphan handling.
 */

import type { ShapedWord, LineBreakResult } from './greedy-breaker.js';
import type { SpaceRange } from '../justification/fit-line.js';

export interface OptimalBreakerOptions extends SpaceRange {
  /** Line (column) width in points */
  maxWidth: number;
  /** Constant added to every line before squaring; favours fewer lines (default 10) */
  linePenalty?: number;
  /** Penalty for breaking after a maqaf piece, with no space (default 50) */
  joinBreakPenalty?: number;
  /** Extra penalty for a one-word final line of a paragraph (default 100). Set to 0 to disable. */
  runtPenalty?: number;
}

export interface OptimalBreakResult extends LineBreakResult {
  /** Adjustment ratio per line (see LineFit.ratio); 0 for last lines of paragraphs */
  ratios: number[];
  /** True for a line that does not fit even at minimum spacing */
  overfull: boolean[];
  /** Sum of the demerits of the chosen breaks */
  totalDemerits: number;
}

// Badness keeps growing with the cube of the stretch ratio so that looseness is spread
// over several lines instead of sacrificed in one. TeX caps at 10000 and avoids absurd
// lines with a tolerance pre-pass; we never reject a paragraph, so the cap is only a
// ceiling for lines that cannot be stretched at all (a lone word) or are absurdly loose.
const BADNESS_CAP = 1e5;
// Must dominate any sum of ordinary demerits (a line is at most (BADNESS_CAP + penalties)^2 = 1e10)
const OVERFULL_DEMERITS = 1e15;

interface Params {
  linePenalty: number;
  joinBreakPenalty: number;
  runtPenalty: number;
}

/**
 * Demerits of one candidate line. Shared by the search and by scoreBreaks()
 * so both always agree.
 *
 * @param width   natural width (words + natural gaps)
 * @param stretch total stretch available (points)
 * @param shrink  total shrink available (points)
 */
function lineDemerits(
  width: number,
  stretch: number,
  shrink: number,
  maxWidth: number,
  isLast: boolean,
  breakPenalty: number,
  singleWord: boolean,
  linePenalty: number,
  runtPenalty: number
): { demerits: number; ratio: number; overfull: boolean } {
  const diff = maxWidth - width;
  let ratio = 0;
  let badness = 0;
  let overfull = false;

  if (diff >= 0) {
    if (!isLast) {
      if (diff > 1e-9) {
        if (stretch > 0) {
          ratio = diff / stretch;
          badness = Math.min(BADNESS_CAP, 100 * ratio ** 3);
        } else {
          ratio = Infinity;
          badness = BADNESS_CAP; // a lone word cannot be stretched
        }
      }
    }
    // last line of a paragraph: natural spacing, no badness
  } else {
    ratio = shrink > 0 ? diff / shrink : -Infinity;
    if (ratio < -1) {
      if (!singleWord) {
        return { demerits: Infinity, ratio, overfull: true };
      }
      overfull = true;
      badness = BADNESS_CAP;
    } else {
      badness = Math.min(BADNESS_CAP, 100 * Math.abs(ratio) ** 3);
    }
  }

  // A one-word paragraph-ending line is undesirable, but not forbidden: a
  // sufficiently constrained paragraph may have no better legal alternative.
  const base = linePenalty + badness + breakPenalty + (isLast && singleWord ? runtPenalty : 0);
  return {
    demerits: base * base + (overfull ? OVERFULL_DEMERITS : 0),
    ratio,
    overfull,
  };
}

/** Break `words` into lines of `maxWidth` with minimum total demerits. */
export function breakLinesOptimal(
  words: ShapedWord[],
  options: OptimalBreakerOptions
): OptimalBreakResult {
  const p: Params = {
    linePenalty: options.linePenalty ?? 10,
    joinBreakPenalty: options.joinBreakPenalty ?? 50,
    runtPenalty: options.runtPenalty ?? 100,
  };
  const { maxWidth, natural, min, max } = options;
  const n = words.length;

  const empty: OptimalBreakResult = {
    lines: [],
    lineWidths: [],
    cleanBreaks: [],
    ratios: [],
    overfull: [],
    totalDemerits: 0,
  };
  if (n === 0) return empty;

  // Prefix sums: width of words, and number of elastic gaps before word i.
  const pw: number[] = [0];
  const pg: number[] = [0];
  for (let i = 0; i < n; i++) {
    const w = words[i] as ShapedWord;
    pw.push((pw[i] as number) + w.width);
    // gap i sits between word i and i+1
    pg.push((pg[i] as number) + (w.joinNext ? 0 : 1));
  }

  const best: number[] = new Array<number>(n + 1).fill(Infinity);
  const prev: number[] = new Array<number>(n + 1).fill(-1);
  best[0] = 0;

  for (let i = 0; i < n; i++) {
    const start = best[i] as number;
    if (start === Infinity) continue;

    for (let k = i + 1; k <= n; k++) {
      const last = words[k - 1] as ShapedWord;
      const isLast = k === n || last.endsParagraph === true;

      // elastic gaps strictly inside words[i..k)
      const glue = (pg[k - 1] as number) - (pg[i] as number);
      const width = (pw[k] as number) - (pw[i] as number) + glue * natural;
      const stretch = glue * (max - natural);
      const shrink = glue * (natural - min);
      const singleWord = k === i + 1;

      if (!singleWord && width - shrink > maxWidth) break; // too long even when shrunk

      const breakPenalty = !isLast && last.joinNext ? p.joinBreakPenalty : 0;
      const r = lineDemerits(
        width, stretch, shrink, maxWidth, isLast, breakPenalty, singleWord, p.linePenalty,
        p.runtPenalty
      );

      if (r.demerits !== Infinity) {
        const total = start + r.demerits;
        if (total < (best[k] as number)) {
          best[k] = total;
          prev[k] = i;
        }
      }
      if (last.endsParagraph) break; // a line cannot run past the end of a paragraph
    }
  }

  // Walk back from the end
  const cuts: number[] = [];
  for (let k = n; k > 0; k = prev[k] as number) cuts.push(k);
  cuts.reverse();

  const result: OptimalBreakResult = { ...empty, totalDemerits: best[n] as number };
  let from = 0;
  for (const k of cuts) {
    const line = words.slice(from, k);
    const glue = (pg[k - 1] as number) - (pg[from] as number);
    const width = (pw[k] as number) - (pw[from] as number) + glue * natural;
    const isLast = k === n || (words[k - 1] as ShapedWord).endsParagraph === true;
    const d = lineDemerits(
      width,
      glue * (max - natural),
      glue * (natural - min),
      maxWidth,
      isLast,
      0,
      k - from === 1,
      p.linePenalty,
      p.runtPenalty
    );
    result.lines.push(line);
    result.lineWidths.push(width);
    result.cleanBreaks.push(true);
    result.ratios.push(isLast && !d.overfull && d.ratio >= 0 ? 0 : d.ratio);
    result.overfull.push(d.overfull);
    from = k;
  }
  return result;
}

/**
 * Total demerits of an existing set of lines under the same model, so any
 * breaking (e.g. the greedy one) can be compared with the optimal one.
 * Lines that cannot fit even when shrunk (and have more than one word) count as infinite.
 */
export function scoreBreaks(
  lines: ShapedWord[][],
  options: OptimalBreakerOptions
): number {
  const linePenalty = options.linePenalty ?? 10;
  const joinBreakPenalty = options.joinBreakPenalty ?? 50;
  const runtPenalty = options.runtPenalty ?? 100;
  const { maxWidth, natural, min, max } = options;
  let total = 0;
  lines.forEach((line, li) => {
    const lastWord = line[line.length - 1];
    if (!lastWord) return;
    const isLast = li === lines.length - 1 || lastWord.endsParagraph === true;
    let glue = 0;
    for (let i = 0; i < line.length - 1; i++) if (!line[i]?.joinNext) glue++;
    const width = line.reduce((s, w) => s + w.width, 0) + glue * natural;
    const breakPenalty = !isLast && lastWord.joinNext ? joinBreakPenalty : 0;
    total += lineDemerits(
      width,
      glue * (max - natural),
      glue * (natural - min),
      maxWidth,
      isLast,
      breakPenalty,
      line.length === 1,
      linePenalty,
      runtPenalty
    ).demerits;
  });
  return total;
}
