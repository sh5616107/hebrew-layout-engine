# ADR-004: PDF Rendering Strategy

**Date:** 2026-10-13  
**Status:** Proposed (POC completed, pending M1 validation)  
**Decision:** Use PDFKit doc.text() for M0-M1, evaluate direct glyph rendering for M2+

---

## Context

After shaping text with HarfBuzz, we need to render glyphs to PDF with precise positioning for nikud and teamim. POC investigation reveals:

### HarfBuzz Output (Ezra SIL)

**Glyph structure:**
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

**Key findings:**
- ✅ Nikud marks are **separate glyphs** with `xAdvance=0`
- ✅ Horizontal positioning via **xOffset** (not yOffset)
- ✅ Vertical positioning **assumed from glyph metrics** (baseline-relative)
- ✅ This is **valid GPOS behavior** - Ezra SIL strategy
- ✅ HarfBuzz provides all necessary positioning data

### PDFKit Rendering Options

**Option A: PDFKit `doc.text()` (current)**
```typescript
doc.font('Hebrew').fontSize(16);
doc.text('בְּרֵאשִׁית', x, y);
```

**Pros:**
- ✅ Works out-of-box (PDFKit calls HarfBuzz internally)
- ✅ Correct nikud rendering (verified in POC)
- ✅ RTL support built-in
- ✅ No low-level PDF knowledge needed

**Cons:**
- ❌ No control over line breaking (PDFKit decides)
- ❌ Can't implement custom algorithms (Knuth-Plass)
- ❌ Can't measure exact line widths before rendering
- ❌ Black-box: can't debug positioning issues

**Option B: Direct glyph drawing**
```typescript
// IDEAL (not available in PDFKit v0.15.0):
for (const glyph of glyphs) {
  doc._writeGlyph(glyph.id, x + glyph.xOffset, y - glyph.yOffset);
  x += glyph.xAdvance;
}
```

**Pros:**
- ✅ Full control over positioning
- ✅ Can implement custom line breaking
- ✅ Can measure before rendering
- ✅ Debug every glyph placement

**Cons:**
- ❌ **PDFKit doesn't expose `_writeGlyph()`** in public API
- ❌ Requires forking PDFKit or writing raw PDF operators
- ❌ More complex code
- ❌ Need to handle RTL direction manually

---

## Investigation: PDFKit Internals

### What PDFKit does internally:
1. Receives text string
2. Calls HarfBuzz for shaping
3. Gets glyph IDs and positions
4. Writes PDF operators: `Tf` (font), `Tj` (show text), `TJ` (show with positioning)
5. Handles RTL by reversing glyph order

### Why `_writeGlyph()` isn't exposed:
- PDFKit designed for **high-level text APIs**
- Low-level glyph access considered internal
- Most users want `doc.text()`, not glyph-by-glyph control

### Accessing low-level rendering:
```typescript
// Option 1: Fork PDFKit and expose _writeGlyph()
// Option 2: Write PDF operators directly via doc.addContent()
doc.addContent('BT');
doc.addContent('/F1 16 Tf');
doc.addContent(`${x} ${y} Td`);
doc.addContent(`<${glyphHex}> Tj`);
doc.addContent('ET');
```

**Problem:** Still need to convert HarfBuzz glyph IDs to PDF CID values (non-trivial).

---

## Decision

### For M0-M1: Use PDFKit `doc.text()`

**Rationale:**
1. **Fast to implement** - works now
2. **Proven to work** - nikud renders correctly
3. **Focus on core layout** - don't get blocked on rendering details
4. **Good enough for POC** - demonstrates feasibility

**Limitations accepted:**
- Can't implement Knuth-Plass line breaking (M1 uses greedy anyway)
- Can't measure exact line widths pre-render (estimate from HarfBuzz)
- Can't debug glyph-level issues (trust PDFKit + HarfBuzz)

### For M2+: Re-evaluate

**When to revisit:**
- When implementing Knuth-Plass (needs exact measurements)
- When debugging positioning issues
- When performance becomes critical
- When PDF/X or CMYK color required

**Options to evaluate:**
1. **Fork PDFKit** - expose `_writeGlyph()`, contribute back upstream
2. **Switch to pdf-lib** - more low-level control, but less mature
3. **Write raw PDF** - maximum control, maximum complexity
4. **Hybrid approach** - PDFKit for structure, manual operators for text

---

## POC Results

**Test:** `tools/render-comparison.ts`

**Rendered:**
- Text: "בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים" (with nikud + teamim)
- Font: Ezra SIL 16pt
- Methods: PDFKit automatic vs HarfBuzz manual positioning

**Findings:**
- ✅ PDFKit renders nikud correctly
- ✅ HarfBuzz provides all positioning data (xOffset, xAdvance)
- ✅ Ezra SIL uses X-only offsets (valid GPOS)
- ✅ Zero-advance marks positioned correctly
- ⚠️ Manual positioning **blocked** by PDFKit API limitations

**Recommendation:** PDFKit `doc.text()` is sufficient for M0-M2.

---

## Alternatives Considered

### pdf-lib
- **Pros:** Lower-level API, direct glyph access
- **Cons:** No RTL support, no HarfBuzz integration, immature

### pdfmake
- **Pros:** High-level, popular
- **Cons:** Same limitations as PDFKit, less flexible

### Raw PDF with pdfkit-lowlevel
- **Pros:** Full control
- **Cons:** Need to implement font subsetting, CID mapping, PDF/A compliance

### Conclusion: PDFKit is the best choice for now.

---

## Implementation Notes

### For M1 (using PDFKit):
```typescript
// Shape with HarfBuzz
const shaped = await shape(text, fontBuffer, fontSize);

// Measure width
const width = shaped.glyphs.reduce((sum, g) => sum + g.advance, 0);

// Render with PDFKit
doc.font('Hebrew').fontSize(fontSize);
doc.text(text, x, y, { lineBreak: false, width: Infinity });
```

### For M2+ (if switching to direct):
```typescript
// Shape with HarfBuzz
const shaped = await shape(text, fontBuffer, fontSize);

// Render each glyph manually
let cursorX = x;
for (const glyph of shaped.glyphs) {
  const glyphX = cursorX + glyph.x / 1000; // mpt to pt
  const glyphY = y - glyph.y / 1000;
  doc._writeGlyph(glyph.glyphId, glyphX, glyphY, fontSize);
  cursorX += glyph.advance / 1000;
}
```

---

## Risks

### Risk: PDFKit limitations block M2 features
**Likelihood:** Medium  
**Impact:** High (can't implement advanced layout)

**Mitigation:**
- Prototype Knuth-Plass with PDFKit (M1)
- If blocked, fork PDFKit or switch libraries (M2)
- Budget 2-3 weeks for library migration if needed

### Risk: Forking PDFKit creates maintenance burden
**Likelihood:** Low (only if we fork)  
**Impact:** Medium (need to merge upstream updates)

**Mitigation:**
- Minimize fork diff (only expose `_writeGlyph()`)
- Contribute changes upstream
- Document fork rationale and patch

---

## Conclusion

**For M0-M1:** PDFKit `doc.text()` is the right choice.

- ✅ Works with HarfBuzz
- ✅ Renders nikud correctly
- ✅ Fast to implement
- ✅ Proven in POC

**For M2+:** Re-evaluate when implementing advanced features.

**Status:** Proposed - ready for M1 implementation.

---

**Evidence:** `out/render-comparison.pdf`, `tools/check-gpos.ts`  
**Test:** `tools/render-comparison.ts`  
**Date:** 2026-10-13
