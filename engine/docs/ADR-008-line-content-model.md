# ADR-008: Line Content Model - ShapedWord vs ShapedRun Unification

## Status
**Proposed** - Documented for future implementation

## Context

The engine currently uses **two different models** for representing shaped text content:

### 1. ShapedWord (`line-breaking/greedy-breaker.ts`)
Used throughout the **word-level pipeline** (M1.0-M1.1):
- `layoutDocument()` entry point
- `breakLines()` - line breaking
- `justifyLine()` / `justifyLines()` - justification
- `layoutTwoColumns()` / `layoutTwoColumnsBalanced()` - column layout
- `applyBiDiToWords()` - BiDi reordering

**Structure:**
```typescript
export interface ShapedWord {
  text: string;              // Original text
  glyphIds: number[];        // HarfBuzz glyph IDs
  advances: number[];        // Advance widths (pts)
  offsets?: Array<{ x: number; y: number }>;  // Glyph offsets
  width: number;             // Total width (pts)
  font?: string;             // Font name
  fontSize?: number;         // Font size (pts)
}
```

**Characteristics:**
- Represents a **single word** (space-delimited unit)
- Contains glyph-level shaping output from HarfBuzz
- Width in **points**
- Used for line breaking and justification logic

### 2. ShapedRun (`core/types.ts`)
Used in the **section-level pipeline** (M2+):
- `layoutSection()` - section-level balancing
- `section-balancer.ts` - 4-stage balancing
- `paragraph-splitter.ts` - widow/orphan control
- Future: paragraph-level justification

**Structure:**
```typescript
export interface ShapedRun {
  font: string;
  size: Distance;            // mpt (millipoints)
  glyphs: PositionedGlyph[];
  direction: 'ltr' | 'rtl';
  width: Distance;           // mpt
}
```

**Characteristics:**
- Represents a **run of text** (can be word, phrase, or line segment)
- Contains positioned glyphs
- Width in **millipoints (mpt)**
- Designed for **section-level operations** requiring precise measurements

## Problem

### Current State Grep Results

**ShapedWord usage:**
```
src/core/layout-engine.ts:8:    import type { ShapedWord } from '../line-breaking/greedy-breaker';
src/core/layout-engine.ts:22:   export type { ShapedWord };
src/core/layout-engine.ts:82:   words: ShapedWord[];
src/core/layout-engine.ts:115:  layoutDocument(shapedWords: ShapedWord[], ...)
src/core/layout-engine.ts:129:  const lineBreakResult = breakLines(shapedWords, { ... });
src/bidi/bidi-integration.ts:7: import type { ShapedWord } from '../line-breaking/greedy-breaker';
src/bidi/bidi-integration.ts:27: applyBiDiToWords(words: ShapedWord[], ...)
src/justification/justify.ts:8: import type { ShapedWord } from '../line-breaking/greedy-breaker';
src/justification/justify.ts:51: justifyLine(words: ShapedWord[], ...)
src/layout/two-column-layout.ts:11: import type { ShapedWord } from '../line-breaking/greedy-breaker';
src/layout/two-column-layout.ts:15: lines: ShapedWord[][];
src/line-breaking/greedy-breaker.ts:8: export interface ShapedWord { ... }
```

**ShapedRun usage:**
```
src/core/types.ts:192:      export interface ShapedRun { ... }
src/core/types.ts:206:      runs: ShapedRun[];
src/core/types.ts:302:      lines: ShapedRun[][];  // LineBreakAlternative
src/core/types.ts:343:      lines: ShapedRun[][];  // LayoutParagraph
src/typography/shaper.ts:6:  import type { PositionedGlyph, ShapedRun } from '../core/types.js';
src/typography/shaper.ts:83: ): Promise<ShapedRun> { ... }
src/layout/section-balancer.ts:10: import { ShapedRun } from '../core/types.js';
src/layout/section-balancer.ts:47: lines: ShapedRun[][];  // ColumnContent
src/layout/section-balancer.ts:59: lines: ShapedRun[][];  // ParagraphSegment
```

### The Mismatch

1. **`layoutDocument()` expects `ShapedWord[]`** as input
2. **Section balancer expects `LayoutSection` with `LayoutParagraph[]` where each paragraph has `lines: ShapedRun[][]`**
3. **Current bridge:** Line 332-333 in `layout-engine.ts`:
   ```typescript
   const rightWords: ShapedWord[][] = sectionPage.rightColumn.lines.map(() => []);
   const leftWords: ShapedWord[][] = sectionPage.leftColumn.lines.map(() => []);
   ```
   **These are empty arrays!** The actual `ShapedRun[][]` data is discarded.

### Why This Works Today
Section balancing (M2) is **NOT YET USED** in `layoutDocument()`. The section balancer code exists but `layoutDocument()` still uses the old `layoutTwoColumns()` path, which works entirely with `ShapedWord`.

### Why This Will Break
When we integrate section balancing into `layoutDocument()`:
1. We'll need to convert `ShapedWord[]` → `LayoutSection` with `ShapedRun[][]`
2. Section balancer will produce pages with `ShapedRun[][]`
3. We'll need to convert back `ShapedRun[][]` → `ShapedWord[][]` for rendering
4. **Data loss:** unit information (mpt ↔ pt), glyph positioning details

## Decision

**Defer unification until section balancing is integrated into layoutDocument().**

When that integration happens, choose ONE of these paths:

### Option A: Migrate Everything to ShapedRun
**Pros:**
- ShapedRun has precise unit system (mpt)
- Already used in section balancer, paragraph splitter
- Better for fine-grained layout control
- Matches spec terminology

**Cons:**
- Large refactor: update line-breaking, justification, two-column-layout, BiDi
- Update all tests and e2e pipelines
- Requires conversion at shaping boundary (HarfBuzz outputs pts)

**Migration steps:**
1. Add conversion utilities: `shapedWordToRun()`, `shapedRunToWord()`
2. Update `breakLines()` to work with `ShapedRun[]`
3. Update `justifyLine()` to work with `ShapedRun[]`
4. Update `layoutTwoColumns()` to work with `ShapedRun[][]`
5. Update `applyBiDiToWords()` to `applyBiDiToRuns()`
6. Update `layoutDocument()` entry point
7. Update all tests

### Option B: Extend ShapedWord
**Pros:**
- Minimal changes to existing pipeline
- Word-level abstraction matches line-breaking domain
- Tests remain valid

**Cons:**
- Need to add unit precision (mpt support)
- Need to reconcile with `PositionedGlyph` model
- Doesn't align with spec terminology

**Migration steps:**
1. Add `mptWidth` field to `ShapedWord`
2. Add `direction: 'ltr' | 'rtl'` field
3. Update section balancer to use `ShapedWord[][]`
4. Update `LayoutParagraph.lines` type
5. Update paragraph splitter

### Option C: Unified Model (Recommended Path Forward)
Create a **single canonical type** that serves both pipelines:

```typescript
/**
 * Shaped text content - canonical representation.
 * Used for line breaking, justification, and layout.
 */
export interface ShapedContent {
  // Identity
  text: string;              // Original text
  font: string;
  fontSize: number;          // Source font size (pts)
  direction: 'ltr' | 'rtl';
  
  // Shaping output (from HarfBuzz)
  glyphs: PositionedGlyph[]; // Glyph IDs + positions
  
  // Measurements
  width: number;             // Width in points
  widthMpt: Distance;        // Width in millipoints (computed)
  
  // Optional features
  features?: Record<string, boolean>; // OpenType features
}
```

**Deprecation path:**
1. Introduce `ShapedContent` alongside existing types
2. Add conversion helpers: `wordToContent()`, `runToContent()`
3. Migrate one module at a time (line-breaking → justification → layout → section-balancer)
4. Mark `ShapedWord` and `ShapedRun` as deprecated
5. Remove deprecated types in next major version

## Open Questions

1. **When to trigger unification?**
   - Wait until section balancing integration into `layoutDocument()`
   - Do it proactively before integration?

2. **Unit system:**
   - Store both pts and mpt? (memory overhead)
   - Store only mpt and convert on demand? (CPU overhead)
   - Use pts everywhere and convert only at section-balancer boundary?

3. **Granularity:**
   - Keep "word" as the atomic unit? (aligns with line-breaking)
   - Switch to "run" as atomic unit? (aligns with HarfBuzz and BiDi)
   - Support both with explicit naming? (`ShapedWord` for words, `ShapedRun` for arbitrary runs)

4. **Backwards compatibility:**
   - Maintain both types during transition?
   - Version bump to signal breaking change?
   - Gradual migration with adapters?

5. **Testing strategy:**
   - How to validate conversion helpers don't lose data?
   - How to ensure pixel-perfect rendering after migration?

## Consequences

### If we choose Option A (ShapedRun everywhere):
- ✅ Consistent with section balancer implementation
- ✅ Precise unit system throughout pipeline
- ❌ Large refactor with high risk
- ❌ All existing tests need update

### If we choose Option B (Extend ShapedWord):
- ✅ Minimal disruption to current pipeline
- ✅ Quick to implement
- ❌ Doesn't align with spec terminology
- ❌ Potential confusion between "word" and "run"

### If we choose Option C (Unified model):
- ✅ Clean long-term solution
- ✅ Gradual migration path
- ✅ Clear deprecation timeline
- ❌ Temporary code duplication
- ❌ Requires discipline to complete migration

## References

- M0-M1.0 pipeline uses `ShapedWord` exclusively
- M1.1 added BiDi support, still using `ShapedWord`
- M2 introduced `ShapedRun` for section balancing
- ADR-007: Section Balancing (introduced `ShapedRun` in `LayoutParagraph`)
- Issue: layoutDocument() bridge at line 332-333 creates empty word arrays

## Recommendation

**Implement Option C (Unified Model) when section balancing is integrated into `layoutDocument()`.**

**Timeline:**
1. **Now:** Document this ADR (this file)
2. **M2 completion:** Continue using separate types
3. **M3 planning:** Design `ShapedContent` interface
4. **M3 implementation:** Gradual migration with adapters
5. **M4:** Remove deprecated types

**Acceptance criteria for migration:**
- ✅ Zero visual regression (pixel-perfect rendering maintained)
- ✅ All tests passing with new type
- ✅ Performance neutral or improved
- ✅ No data loss in conversions
- ✅ Clear migration guide for future contributors
