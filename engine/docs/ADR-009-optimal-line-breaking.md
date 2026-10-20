# ADR-009: Optimal line breaking (Knuth–Plass style) and word-space fitting

**Date:** 2026-10-20  
**Status:** Implemented (opt-in: `lineBreaking: { mode: 'optimal' }`; greedy stays the default)

## Context

The greedy breaker fills each line as far as it goes. When the next word is long the line
stays short, and `justifyLine` can only stretch gaps up to a maximum, so many lines were left
ragged at the column edge. Hebrew sefarim are set justified, without hyphenation and without
stretching letters (spec section 6: no hyphenation, no letter stretching). The only elastic
element is the gap between words, so quality depends almost entirely on *where* lines break.
InDesign's default composer (Adobe Paragraph Composer) does the same: it scores break points
over the whole paragraph instead of line by line.

## Decision

- `src/line-breaking/optimal-breaker.ts`: dynamic programming over the whole paragraph,
  minimising the sum of line demerits `(linePenalty + badness + breakPenalty)^2`,
  `badness = 100 * |ratio|^3`. Ratio = how far the gaps are stretched (`+1` = every gap at max)
  or shrunk (`-1` = at min). Cubic growth makes one very loose line worse than several slightly
  loose ones.
- Only word gaps are elastic. Range defaults to 85% to 140% of `wordSpacing`
  (`lineBreaking.minSpaceRatio` / `maxSpaceRatio`), as in the spec.
- `src/justification/fit-line.ts` computes the final gaps of a line with the same formulas, so
  the breaker and the justifier cannot disagree. All gaps of a line get the same ratio.
- Maqaf: `WordShaper.shapeText(..., { breakAtMaqaf: true })` cuts a word after each maqaf
  (U+05BE stays with the piece before it) and marks the piece `joinNext`: no gap after it, a
  break there is allowed but costs `joinBreakPenalty` (default 50), so a break at a space wins
  when equal.
- Paragraphs: a word with `endsParagraph` forces a break after it, and that last line keeps
  natural spacing (also in the greedy breaker and in `applyJustification`).
- A word wider than the line is allowed alone on its line and reported in `overfull`; the search
  never fails.
- `scoreBreaks()` scores any set of lines under the same model; used to compare with greedy.

## Verified on real text (Genesis, nikud and teamim, 12pt, 185.7pt column)

| | greedy, no maqaf break (before) | greedy + maqaf | optimal + maqaf |
|---|---|---|---|
| total demerits | 8.3e10 | 4.9e10 | 1.6e10 |
| loosest gap | 29.5pt | 21.3pt | 16.5pt |

Property tests: over 300 random texts the optimal result never scores worse than greedy.

## Not implemented

- **Fitness classes** (a tight line next to a loose one is not penalised).
- **Rivers**: gaps stacking over consecutive lines are not detected (spec section 6 asks for a warning).
- **Runts / widows at paragraph end**: a paragraph may end with a one-word last line.
- Page-level costs (spec 7a) are separate; breaking is per paragraph only.
- `layoutDocumentWithSections` (balancing path) still returns empty lines, so it does not use this yet.

## Finding that needs a decision

The spec range (85% to 140% of a 3.5pt space = 2.98pt to 4.9pt) is only about +/-1.2pt per gap.
In a column this narrow (about 6.5 cm) a line has 5 to 7 gaps, so most lines need far more than
that: 46 of 68 justified lines in the sample exceed the maximum even with optimal breaking. Options:
wider range, a larger natural space, a smaller font or wider columns, or accepting the warnings.
This is a typographic decision for the typesetter, not a bug.
