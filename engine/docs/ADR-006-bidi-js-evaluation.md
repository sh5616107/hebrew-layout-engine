# ADR-006: bidi-js Library Evaluation

**Date:** 2026-10-12 (Updated: 2026-10-14)  
**Status:** ✅ PROPOSED  
**Decision:** Consider bidi-js for run-level reordering (NOT character reversal)

## Context

User requested evaluation of bidi-js library with correct API usage:
- `getEmbeddingLevels(text)` returns `{levels: Uint8Array, paragraphs: Array}`
- `getReorderSegments(text, embeddingLevels)` returns run boundaries
- Design goal: **reorder shaped runs, not reverse characters**

## Investigation (Corrected)

### API Discovery ✅

```javascript
const bidiFactory = require('bidi-js');
const bidi = bidiFactory(); // Factory pattern

// Correct API
const text = 'Genesis בראשית';
const embeddingLevels = bidi.getEmbeddingLevels(text);
// Returns: {
//   levels: Uint8Array(14) [0,0,0,0,0,0,0,0,1,1,1,1,1,1],
//   paragraphs: [{start: 0, end: 13, level: 0}]
// }

const segments = bidi.getReorderSegments(text, embeddingLevels);
// Returns: [[8, 13]] - RTL segment indices

const reordered = bidi.getReorderedString(text, embeddingLevels);
// Returns: "Genesis תישארב" - characters reversed
```

### Test Results ✅

**All 6 tests passing:**
1. ✅ `getEmbeddingLevels` returns `{levels, paragraphs}`
2. ✅ Levels are `Uint8Array` (not plain array)
3. ✅ `getReorderSegments` returns segment boundaries
4. ✅ Pure Hebrew text: single segment `[[0, 24]]`
5. ✅ Mixed text: segments identify RTL runs
6. ✅ Preserves nikud characters structurally

### Critical Finding ❌

**bidi-js reverses CHARACTERS, not shaped runs:**

```javascript
Input:  'בְּרֵאשִׁית בָּרָא'
Output: 'אָרָּב תיִׁשאֵרְּב'  // ❌ NIKUD REVERSED!
```

This breaks shaped text because:
- Nikud (ְּ, ֵ, ִ) gets separated from base letters
- HarfBuzz shaped runs become invalid
- Glyph positions lose meaning

## Design Consideration: Run-Level Reordering

Our shaping pipeline requires **run-level reordering**, not character reversal:

```
1. Shape each word/run with HarfBuzz → positioned glyphs
2. Determine embedding levels per run
3. Reorder RUNS (not characters) for visual display
4. Render glyphs in reordered run order
```

**Current M1.1 approach:**
- Words are shaped individually (preserving nikud with base letters)
- `applyBiDiToWords()` reorders word array
- Character-level BiDi happens BEFORE shaping

**Potential bidi-js integration:**
- Use `getEmbeddingLevels()` for run-level information
- Use `getReorderSegments()` to identify run boundaries
- **DO NOT use `getReorderedString()`** (character reversal)
- Reorder shaped runs, not raw characters

## Decision

**✅ PROPOSED:** Consider bidi-js for M3+ run-level reordering

**Advantages:**
- UAX #9 compliant (full spec)
- Handles complex cases (nested embeddings, brackets)
- Well-tested library

**Requirements for integration:**
1. Shape text FIRST with HarfBuzz
2. Map shaped runs to embedding levels
3. Reorder runs (not characters) based on segments
4. Never call `getReorderedString()` on shaped text

**Current M1.1 status:**
- ✅ Custom implementation working (14/14 tests)
- ✅ Sufficient for M0/M1.1 requirements
- ✅ Word-level reordering (74,107 words/sec)
- ⚠️ Simplified UAX #9 (may miss edge cases)

**Recommendation:**
- **M0/M1.1:** Keep custom implementation (working, tested)
- **M2:** Add integration tests for complex BiDi cases
- **M3+:** Evaluate bidi-js for run-level reordering if edge cases found

## Files

Created/Updated:
- `tests/feasibility/bidi-js.test.ts` (initial attempt, API errors)
- `tests/feasibility/bidi-js-correct.test.ts` (corrected API, 6/6 passing)
- `docs/ADR-006-bidi-js-evaluation.md` (this file)

## References

- [bidi-js documentation](https://github.com/lojjic/bidi-js)
- [UAX #9: Unicode Bidirectional Algorithm](https://unicode.org/reports/tr9/)
- HarfBuzz shaping must precede BiDi reordering for complex scripts
