# ADR-008: Line Content Model - ShapedWord vs ShapedRun Unification

## Status
**Approved** - Migration plan ready for implementation

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
src/core/layout-engine.ts:8:    import type { ShapedWord }
src/core/layout-engine.ts:82:   words: ShapedWord[];
src/core/layout-engine.ts:115:  layoutDocument(shapedWords: ShapedWord[], ...)
src/bidi/bidi-integration.ts:27: applyBiDiToWords(words: ShapedWord[], ...)
src/justification/justify.ts:51: justifyLine(words: ShapedWord[], ...)
src/layout/two-column-layout.ts:15: lines: ShapedWord[][];
src/line-breaking/greedy-breaker.ts:8: export interface ShapedWord { ... }
```

**ShapedRun usage:**
```
src/core/types.ts:192:      export interface ShapedRun { ... }
src/core/types.ts:302:      lines: ShapedRun[][];  // LineBreakAlternative
src/core/types.ts:343:      lines: ShapedRun[][];  // LayoutParagraph
src/typography/shaper.ts:83: ): Promise<ShapedRun> { ... }
src/layout/section-balancer.ts:47: lines: ShapedRun[][];
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

**Migrate everything to a unified ShapedRun model with explicit text/space distinction.**

### Unified ShapedRun Model

```typescript
/**
 * Shaped text run - unified representation for all pipeline stages.
 * A run can be text content or whitespace.
 */
export interface ShapedRun {
  // Run type
  kind: 'text' | 'space';    // Text content or spacing
  
  // Content
  text: string;              // Original text
  font: string;
  direction: 'ltr' | 'rtl';
  
  // Shaping output (from HarfBuzz)
  glyphs: PositionedGlyph[];
  
  // Measurements (all in mpt)
  width: Distance;           // Total width in millipoints
  naturalWidth?: Distance;   // For 'space': natural width before justification
  
  // Optional
  features?: Record<string, boolean>; // OpenType features
}

/**
 * Positioned glyph with offsets.
 */
export interface PositionedGlyph {
  id: number;                // Glyph ID
  xAdvance: number;          // Advance width (mpt)
  yAdvance: number;          // Advance height (mpt)
  xOffset: number;           // X offset (mpt)
  yOffset: number;           // Y offset (mpt)
}
```

### Key Design Decisions

1. **Text vs Space Runs**
   - `kind: 'text'` - Actual word or text content
   - `kind: 'space'` - Whitespace between words
   - Justification stretches only `'space'` runs within allowed range

2. **All Measurements in mpt**
   - No fontSize in points - derive from `size` field or context
   - Consistent unit system throughout pipeline
   - Conversion to points only at rendering boundary

3. **Natural Width for Spaces**
   - `'space'` runs store `naturalWidth` before justification
   - Justification multiplies by percentage (80%-130%)
   - Preserves original spacing information

## Migration Plan

### Step 0: Create Golden Snapshots (Before Any Changes)

**Test inputs:**
1. 100 Hebrew words with nikud
2. 100 mixed Hebrew + Latin words
3. Complex scenario: Hebrew with nikud + Latin + punctuation

**Snapshot data (JSON):**
```typescript
interface LayoutSnapshot {
  input: string;              // Original text
  totalWords: number;         // Word count
  lines: {
    lineIndex: number;
    words: {
      text: string;
      xPosition: number;      // mpt
      width: number;          // mpt
    }[];
    spacing: number[];        // mpt between words
    totalWidth: number;       // mpt
  }[];
  pages: {
    pageIndex: number;
    rightColumnLines: number;
    leftColumnLines: number;
  }[];
}
```

**Golden snapshot script:**
```bash
npm run test:snapshot -- --create
# Creates: tests/golden/snapshot-hebrew-nikud.json
#          tests/golden/snapshot-mixed.json
#          tests/golden/snapshot-complex.json
```

### Step 1: greedy-breaker.ts

**Changes:**
- Change `breakLines()` to accept `ShapedRun[]` instead of `ShapedWord[]`
- Change return type to `lines: ShapedRun[][]`
- Internal logic unchanged (still breaks at `kind: 'space'` boundaries)

**Commit:** `refactor(line-breaking): migrate to ShapedRun`

**Tests:**
- All existing tests updated to use ShapedRun
- Golden snapshot test: verify word count matches
- Golden snapshot test: verify line breaks match

### Step 2: justify.ts

**Changes:**
- Change `justifyLine()` to accept `ShapedRun[]` instead of `ShapedWord[]`
- Stretch only runs with `kind: 'space'`
- Use `naturalWidth` as base, multiply by justification percentage
- Return adjusted runs (with modified widths)

**Commit:** `refactor(justification): migrate to ShapedRun with space stretching`

**Tests:**
- Update all justification tests to use ShapedRun
- Golden snapshot test: verify spacing values within tolerance (±1 mpt)
- Golden snapshot test: verify total line widths match

### Step 3: bidi-integration.ts

**Changes:**
- Rename `applyBiDiToWords()` → `applyBiDiToRuns()`
- Accept `ShapedRun[]` instead of `ShapedWord[]`
- Return `ShapedRun[]` (reordered)
- Logic unchanged (reorder based on embedding levels)

**Commit:** `refactor(bidi): migrate to ShapedRun`

**Tests:**
- Update all BiDi tests to use ShapedRun
- Golden snapshot test: verify mixed text layout matches

### Step 4: two-column-layout.ts

**Changes:**
- Change `layoutTwoColumns()` to accept `lines: ShapedRun[][]`
- Update `Column` interface: `lines: ShapedRun[][]`
- Update `TwoColumnLayout` interface
- Internal logic unchanged

**Commit:** `refactor(two-column): migrate to ShapedRun`

**Tests:**
- Update all two-column tests to use ShapedRun
- Golden snapshot test: verify page breaks match
- Golden snapshot test: verify column line counts match

### Step 5: layout-engine.ts

**Changes:**
- Change `layoutDocument()` signature: `shapedRuns: ShapedRun[]` (rename param)
- Update `RenderedLine` interface: `runs: ShapedRun[]` (rename from `words`)
- **Remove empty array bridge:** Delete lines 332-333:
  ```typescript
  // DELETE THESE:
  const rightWords: ShapedWord[][] = sectionPage.rightColumn.lines.map(() => []);
  const leftWords: ShapedWord[][] = sectionPage.leftColumn.lines.map(() => []);
  ```
- Update type exports: remove `export type { ShapedWord };`

**Commit:** `refactor(layout-engine): migrate to ShapedRun, remove empty array bridge`

**Tests:**
- Update all layout-engine tests to use ShapedRun
- Golden snapshot test: full pipeline verification
- **Word count verification:** Count `kind: 'text'` runs in output, verify equals input count

### Step 6: Delete ShapedWord

**Changes:**
- Delete `ShapedWord` interface from `line-breaking/greedy-breaker.ts`
- Update all remaining imports
- Run `grep -r "ShapedWord" src/` → verify 0 results

**Commit:** `refactor: delete ShapedWord, complete migration to ShapedRun`

**Verification:**
```bash
# Zero references to ShapedWord
$ grep -r "ShapedWord" src/ tests/
# No results

# All golden snapshots pass
$ npm run test:snapshot -- --verify
# ✅ All snapshots match
```

## Testing Strategy

### Golden Snapshot Tests

**File:** `tests/golden/layout-snapshot.test.ts`

```typescript
describe('Layout Golden Snapshots', () => {
  it('should match snapshot for Hebrew with nikud', async () => {
    const snapshot = await loadSnapshot('snapshot-hebrew-nikud.json');
    const result = layoutDocument(snapshot.input, config);
    
    // Word count check
    const outputWordCount = countTextRuns(result);
    expect(outputWordCount).toBe(snapshot.totalWords);
    
    // Line breaks check
    expect(result.pages.length).toBe(snapshot.pages.length);
    
    // Positioning check (±1 mpt tolerance for rounding)
    for (let pageIdx = 0; pageIdx < snapshot.pages.length; pageIdx++) {
      const expectedPage = snapshot.pages[pageIdx];
      const actualPage = result.pages[pageIdx];
      expect(actualPage.rightColumn.lines.length).toBe(expectedPage.rightColumnLines);
      expect(actualPage.leftColumn.lines.length).toBe(expectedPage.leftColumnLines);
    }
  });
  
  it('should match snapshot for mixed Hebrew + Latin', async () => {
    // Same structure as above
  });
});
```

### Per-Step Verification

Each commit must pass:
1. `npm run typecheck` - no TypeScript errors
2. `npm test` - all existing tests pass (updated for ShapedRun)
3. `npm run test:snapshot` - golden snapshots match within tolerance
4. Word count verification: output run count equals input

## Consequences

### Benefits
- ✅ Single unified model throughout pipeline
- ✅ Consistent unit system (all mpt)
- ✅ Explicit text/space distinction for justification
- ✅ No data loss at conversion boundaries
- ✅ Aligns with section balancer (M2+)
- ✅ Removes empty array bridge hack (lines 332-333)

### Migration Risks
- ⚠️ Large refactor across 6 files
- ⚠️ All tests require updates
- ⚠️ Potential for subtle positioning bugs

### Mitigation
- ✅ Golden snapshot tests catch any layout changes
- ✅ Incremental migration (one file per commit)
- ✅ Word count verification ensures no data loss
- ✅ Each step independently verified before proceeding

## Timeline

**Current:** ADR approved, ready to proceed  
**Step 0:** Create golden snapshots (1 commit)  
**Steps 1-5:** Migrate modules (5 commits, 1 per module)  
**Step 6:** Delete ShapedWord (1 commit)  
**Total:** 7 commits, each independently verified

## References

- M0-M1.0 pipeline uses `ShapedWord` exclusively
- M1.1 added BiDi support, still using `ShapedWord`
- M2 introduced `ShapedRun` for section balancing
- ADR-007: Section Balancing (introduced `ShapedRun` in `LayoutParagraph`)
- Issue: layoutDocument() bridge at line 332-333 creates empty word arrays

## Acceptance Criteria

- ✅ Zero references to `ShapedWord` in src/ and tests/
- ✅ All 223 tests passing with ShapedRun
- ✅ Golden snapshot tests pass (±1 mpt tolerance)
- ✅ Word count verification: output equals input
- ✅ tsc clean, ESLint clean
- ✅ No data loss at any conversion boundary
