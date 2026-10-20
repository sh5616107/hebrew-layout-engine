# ADR-004: PDF Rendering Strategy

**Date:** 2026-10-13 (Updated: 2026-10-13 with glyph-level rendering investigation)  
**Status:** Proposed - awaiting decision  
**Decision:** NOT RECOMMENDED for M1 - glyph-level complexity outweighs benefits at this stage

---

## Update 2026-10-20: Alternative B implemented

Direct glyph rendering is now the default for words that carry HarfBuzz glyph data
(`ShapedWord.offsets`): `src/rendering/glyph-renderer.ts`, used by `renderToPDF` (mode `auto`).
PDFKit `text()` remains only as a fallback for words without glyph data (test doubles).

Why it was needed: with `text()`, PDFKit/fontkit shapes the word again, so what is drawn
differs from what was measured (up to 5.9% on words with teamim) and bidi is not applied.
The demo PDFs produced by the e2e tests with mock words showed stacked/overlapping letters.

Findings from the implementation (verified, harfbuzzjs 1.6.3 / pdfkit 0.15.2):
- harfbuzzjs 1.x: `font.setScale(upem, upem)` is mandatory; the default scale 0 returns all-zero advances/offsets.
- `buffer.setDirection()` takes the numeric enum (`Direction.RTL` = 5). A string is silently ignored (shaped LTR).
- For RTL, HarfBuzz already returns glyphs in visual (left-to-right) order: **no glyph reversal** is needed
  (the "RTL glyph reversal" con above does not apply).
- No CID mapping table is needed: `font.subset.includeGlyph(gid)` of PDFKit's embedded font returns the CID.
- Marks come back with xAdvance 0 and an xOffset; Ezra SIL never emits yOffset.
- `LineContent.y` is the top of the line box (`topMargin + i * lineHeight`); the renderer derives the baseline
  from the font ascent/descent (half-leading, as in CSS).
- Uses PDFKit internals (`_font`, `subset`, `widths`, `unicode`): guarded by `tests/integration/glyph-pdf.test.ts`.

Known limitations: ToUnicode maps glyphs through the font's reverse cmap, so substituted glyph variants and
marks may have no text mapping (text search of nikud'd words is not reliable yet).


## Context

After shaping text with HarfBuzz (ADR-002), we must render the shaped glyphs to PDF. The specification (section 25) requires:
1. JSON input → Shaping (HarfBuzz) → Line breaking → Layout to two columns
2. **LayoutResult** structure (section 14) with positioned words/glyphs
3. PDF rendering **from LayoutResult** (not from original text)

This ADR evaluates two rendering alternatives: word-level positioning with PDFKit, and glyph-level positioning with raw PDF operators.

---

## HarfBuzz Shaping Output

For context, HarfBuzz returns positioned glyphs with the following structure (Ezra SIL):

```typescript
glyphInfos: [
  { codepoint: 288, cluster: 29 },  // Base character
  { codepoint: 224, cluster: 25 },  // Nikud mark (xAdv=0, xOff=200)
  { codepoint: 258, cluster: 25 },  // Another mark (xAdv=0, xOff=850)
]
glyphPositions: [
  { xAdvance: 1350, yAdvance: 0, xOffset: 0, yOffset: 0 },
  { xAdvance: 0, yAdvance: 0, xOffset: 200, yOffset: 0 },
  { xAdvance: 0, yAdvance: 0, xOffset: 850, yOffset: 0 },
]
```

**Key observations:**
- Nikud marks have `xAdvance=0` (zero-width)
- Positioning via `xOffset` (horizontal), not `yOffset`
- Vertical positioning handled by font metrics (baseline-relative)
- Valid GPOS strategy per OpenType specification

---

## Alternative A: Word/Cluster-Level Positioning with PDFKit

### Approach
Use HarfBuzz for shaping and measurement, PDFKit `doc.text()` for rendering at the **word/cluster** level:

```typescript
// Shape and measure each word
const shapedWord = await shapeText(word, fontBuffer, fontSize);
const width = shapedWord.glyphs.reduce((sum, g) => sum + g.xAdvance, 0);

// Position word at exact coordinates from LayoutResult
doc.font('Ezra SIL').fontSize(fontSize);
doc.text(word, x, y, { lineBreak: false, width: Infinity });
```

### Architecture
1. **Input:** LayoutResult with positioned Words
2. **Loop:** For each word in LayoutResult
3. **Render:** Call `doc.text(word.text, word.x, word.y)` at **engine-calculated coordinates**
4. **Output:** PDF with words positioned by layout engine

### Pros
- ✅ Simple implementation - single PDFKit API call per word
- ✅ Works out-of-box - PDFKit handles RTL, font subsetting, ligatures internally
- ✅ Correct visual output - nikud and te'amim render correctly
- ✅ Maintainable - no low-level PDF operators or font handling
- ✅ No forking required - uses public PDFKit API

### Cons
- ❌ Width deviation: 70% perfect, 13% >1%, max 5.91% on te'amim (see measurement below)
- ❌ Black-box internal shaping - can't debug if PDFKit's internal HarfBuzz differs from ours
- ❌ Performance overhead - PDFKit re-shapes each word (duplicate work)
- ⚠️ Risk: Internal PDFKit shaping may differ from our HarfBuzz shaping, causing visual mismatch

### Use Cases
- M0-M1: Prototyping and baseline implementation
- Greedy line breaking (section 18) - 1% deviation acceptable
- When simplicity and speed-to-implementation matter more than sub-pixel precision

---

## Alternative B: Glyph-Level Positioning with Low-Level Streams

### Approach
Write PDF operators directly using PDFKit's `addContent()` to position **each glyph individually** from HarfBuzz output:

```typescript
// Shape once with HarfBuzz
const shaped = await shapeText(text, fontBuffer, fontSize);

// Write glyphs at exact HarfBuzz coordinates
doc.addContent('BT');  // Begin text
doc.addContent(`/F1 ${fontSize} Tf`);  // Set font
doc.addContent(`${startX} ${startY} Td`);  // Move to baseline

for (const glyph of shaped.glyphs) {
  const cidHex = glyphIdToCID(glyph.glyphId).toString(16).padStart(4, '0');
  const offsetX = glyph.xOffset / 1000 * fontSize;
  const advanceX = glyph.xAdvance / 1000 * fontSize;
  
  doc.addContent(`${offsetX} 0 Td <${cidHex}> Tj ${advanceX - offsetX} 0 Td`);
}

doc.addContent('ET');  // End text
```

### Architecture
1. **Input:** LayoutResult with positioned Words, each containing Glyphs
2. **Font subsetting:** Build CID-to-GID map for used glyphs only
3. **Loop:** For each glyph in LayoutResult
4. **Render:** Write PDF `Tj` operator with exact coordinates
5. **Output:** PDF with glyph-level precision

### Pros
- ✅ Zero width deviation - **100% perfect match** with HarfBuzz measurements (see below)
- ✅ Full debugging control - every glyph placement is explicit
- ✅ Single shaping pass - no duplicate work (performance benefit)
- ✅ Sub-pixel precision - necessary for Knuth-Plass (M2+)
- ✅ Predictable output - what you measure is exactly what renders

### Cons
- ❌ Complex implementation - requires understanding PDF text operators (BT/ET, Tf, Td, Tj, TJ)
- ❌ Font subsetting - need to build CID font with used glyphs only (or embed full font ~1.5MB)
- ❌ RTL handling - must reverse glyph order manually
- ❌ Ligature handling - must track cluster-to-glyph mapping
- ❌ Maintenance burden - more code surface area for bugs

### Use Cases
- M2+: Knuth-Plass line breaking (section 20) requiring exact width measurement
- Column balancing (section 19) with precision cost functions
- When width deviation >1% is unacceptable
- When debugging positioning issues in production

---

## Feasibility Investigation: Glyph-Level Rendering

### Question
Can PDFKit render glyphs at exact HarfBuzz coordinates without forking?

### Method
**Tool:** `tools/render-glyphs-directly.ts` - **הכלי הוסר בקומיט 378c4ec**  
**Test:** Attempt to write PDF operators directly using PDFKit's API  
**Text:** "בְּרֵאשִׁית בָּרָא" (15 glyphs with nikud)

### Findings

#### ✓ addContent() Method Exists
PDFKit exposes `doc.addContent(string)` for writing raw PDF content stream operators:

```typescript
doc.addContent('BT');                       // Begin text object
doc.addContent('/F1 16 Tf');                // Set font
doc.addContent(`${x} ${y} Td`);             // Move text position
doc.addContent(`<${glyphHex}> Tj`);         // Show glyph
doc.addContent('ET');                       // End text object
```

**Result:** Commands execute without error - glyph-level rendering **IS POSSIBLE**.

#### ⚠ Font Reference Resolution Required
**Problem:** PDFKit internally assigns font names (`/F1`, `/F2`, etc.). When using `addContent()`, we must determine the correct reference.

**Attempted solution:** After `doc.font(path)`, inspect `doc._fontFamilies` or `doc.page.fonts` (private API).

**Impact:** Requires PDFKit internals knowledge or trial-and-error.

#### ⚠ GID→CID Mapping Needed
**Problem:** HarfBuzz returns Glyph IDs (font-specific indices), but PDF requires CID (Character ID) for Type 0 fonts.

**Complexity:**
- Type 0 (CID) fonts: May require CID→GID mapping table
- TrueType embedding: Often GID == CID (but not guaranteed)
- Font subsetting: CID remapping required

**Impact:** Visual output may be incorrect if mapping is wrong.

#### ⚠ Coordinate Conversion Required
HarfBuzz uses font units (1/64 pt), PDF uses points:

```typescript
const xPt = (xAdvance / 64) * (fontSize / 1000);
```

#### ⚠ RTL Direction Handling
HarfBuzz shapes correctly, but PDF text operators are LTR by default. Solution: reverse glyph order before rendering.

###Verdict

**Glyph-level rendering is TECHNICALLY FEASIBLE** but adds significant complexity:
- Font reference resolution (trial-and-error or private API)
- GID→CID mapping (font-specific, error-prone)
- Coordinate system conversion (straightforward)
- RTL glyph reversal (straightforward)

**Estimated effort:** 200-300 LOC + 2-3 days debugging font/CID issues.

---

## Width Deviation Measurement (CORRECTED)

**Previous measurement ERROR:** Compared HarfBuzz to itself (Alternative B), resulting in false "0% deviation".

**Correct comparison:** HarfBuzz measurement vs PDFKit rendering width (Alternative A).

### Results (from tools/compare-rendering-alternatives.ts)

| Metric | Value |
|--------|-------|
| Perfect matches (Δ < 0.01pt) | 70 (70.0%) |
| Large deltas (Δ > 1%) | 13 (13.0%) |
| **Average delta** | **0.103pt (0.34%)** |
| **Maximum delta** | **1.465pt (5.91%)** |

**Worst cases (words with te'amim):**

| Word | HarfBuzz | PDFKit | Delta | Delta% |
|------|----------|--------|-------|--------|
| וַיַּ֧רְא | 24.803pt | 23.338pt | 1.465pt | **5.91%** |
| וַיַּ֥רְא | 24.217pt | 23.338pt | 0.879pt | 3.63% |
| וַֽיְהִי־אֽוֹר׃ | 50.443pt | 49.857pt | 0.586pt | 1.16% |

**Interpretation:**
- 70% of words match perfectly (PDFKit and HarfBuzz agree)
- 13% show >1% deviation (mostly words with te'amim)
- **Visual appearance is correct** despite width differences (PDFKit still positions glyphs correctly)

**Note:** Glyph-level rendering (Alternative B) would eliminate this deviation by using HarfBuzz coordinates directly, but adds implementation complexity.

---

## Decision: NOT RECOMMENDED for M1

### Rationale

**Alternative A (Word-Level) is SUFFICIENT for M1:**
1. **Implementation speed:** 50 LOC vs 200-300 LOC
2. **Visual correctness:** PDFKit renders nikud/te'amim correctly despite width differences
3. **Greedy line breaking tolerance:** M1's algorithm (section 18) doesn't require sub-pixel precision
4. **Risk:** Defer complexity until Knuth-Plass (M2) proves need

**Alternative B (Glyph-Level) adds UNNECESSARY complexity:**
1. **Font reference resolution:** Requires PDFKit internals or trial-and-error
2. **GID→CID mapping:** Error-prone, font-specific
3. **Debugging burden:** More surface area for bugs
4. **Unclear benefit:** Width deviation doesn't affect M1 deliverable

### When to Revisit (M2+)

Glyph-level rendering should be considered when:
1. **Knuth-Plass cost function** requires exact widths (section 20)
2. **Production quality** demands <0.1% deviation
3. **Debugging** reveals positioning issues PDFKit cannot explain
4. **Performance** matters (single shaping pass vs double)

---

## References

**Evidence files:**
- `out/glyph-render-test.pdf` - glyph-level rendering feasibility test
- `out/rendering-alternatives.json` - width deviation measurement (100 words)
- `tools/render-glyphs-directly.ts` - **הכלי הוסר בקומיט 378c4ec**
- `tools/compare-rendering-alternatives.ts` - width measurement tool
- `docs/M0-ADR-004-GLYPH-RENDERING-FINDINGS.md` - detailed investigation report

**Tests:**
- `tools/compare-rendering-alternatives.ts` - quantitative width comparison

**Related ADRs:**
- ADR-002: HarfBuzz WASM for text shaping
- ADR-003: Ezra SIL font selection

**Updated:** 2026-10-13
