/**
 * Word-space fitting for one line.
 *
 * Justification works only through the gaps between words (no letter stretching,
 * no hyphenation). Each gap has a natural width and may stretch up to `max` or
 * shrink down to `min`. All gaps of a line get the same adjustment ratio, so
 * spacing inside a line is even.
 *
 * A word marked `joinNext` is followed by no gap at all (maqaf pieces): it adds
 * neither width nor elasticity.
 */

import type { ShapedWord } from '../line-breaking/greedy-breaker.js';

export interface SpaceRange {
  /** Natural gap in points */
  natural: number;
  /** Smallest gap in points (shrink limit) */
  min: number;
  /** Largest "good" gap in points (stretch limit of ratio 1) */
  max: number;
}

export interface LineFit {
  /** Gap after each word except the last, in points (0 after a joinNext word) */
  gaps: number[];
  /**
   * Adjustment ratio: 0 = natural, +1 = every gap at `max`, -1 = every gap at `min`.
   * Above 1 the gaps exceed `max` (only when not clamped); below -1 the line is overfull.
   */
  ratio: number;
  /** Total width of the line with these gaps */
  width: number;
}

/** Number of elastic gaps (those not following a joinNext word) in words[from..to) */
export function glueCount(words: ShapedWord[], from = 0, to = words.length): number {
  let n = 0;
  for (let i = from; i < to - 1; i++) {
    if (!words[i]?.joinNext) n++;
  }
  return n;
}

/**
 * Fit `words` to `targetWidth`.
 *
 * @param clamp  true: never stretch past `max` (the line then stays short);
 *               false: stretch as far as needed to fill the line.
 * Shrinking is never allowed below `min`; a line that still does not fit is overfull.
 */
export function fitLine(
  words: ShapedWord[],
  targetWidth: number,
  range: SpaceRange,
  clamp: boolean
): LineFit {
  const glue = glueCount(words);
  const wordsWidth = words.reduce((s, w) => s + w.width, 0);
  const natural = wordsWidth + glue * range.natural;
  const diff = targetWidth - natural;

  let ratio = 0;
  if (diff > 0) {
    const stretch = glue * (range.max - range.natural);
    ratio = stretch > 0 ? diff / stretch : 0;
    if (clamp) ratio = Math.min(ratio, 1);
  } else if (diff < 0) {
    const shrink = glue * (range.natural - range.min);
    ratio = shrink > 0 ? Math.max(diff / shrink, -1) : -1;
  }

  const adj = ratio >= 0 ? range.max - range.natural : range.natural - range.min;
  const gap = range.natural + ratio * adj;
  const gaps: number[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    gaps.push(words[i]?.joinNext ? 0 : gap);
  }
  return { gaps, ratio, width: wordsWidth + glue * gap };
}
