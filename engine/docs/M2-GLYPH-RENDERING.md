# M2 Task: Direct Glyph Rendering (Alternative B)

**Priority:** Medium (after column balancing)  
**Effort:** 2-3 days  
**Status:** Done (2026-10-20) - see "Update 2026-10-20" in ADR-004. Implemented in `src/rendering/glyph-renderer.ts`; the plan below was changed: no font-resolver or CID mapping module was needed.

## Goal

Implement direct glyph-level PDF rendering to eliminate width deviations between HarfBuzz measurement and PDFKit rendering.

## Context

Current M1 implementation uses PDFKit's `text()` method (Alternative A from ADR-004), which:
- ✅ Works correctly for visual output
- ❌ Has 13% of words with >1% width deviation
- ❌ Maximum deviation: 5.91% (words with te'amim)

See ADR-004 for full analysis and width deviation measurements.

## Requirements

### 1. Glyph-Level Positioning

Write PDF operators directly for each glyph from HarfBuzz output:

```typescript
// For each glyph in shaped result
doc.addContent('BT');
doc.addContent(`/F1 ${fontSize} Tf`);
doc.addContent(`${x} ${y} Td`);

for (const glyph of glyphs) {
  const cidHex = glyph.glyphId.toString(16).padStart(4, '0');
  const offsetX = glyph.xOffset / 64;
  const advanceX = glyph.xAdvance / 64;
  
  doc.addContent(`${offsetX} 0 Td <${cidHex}> Tj ${advanceX - offsetX} 0 Td`);
}

doc.addContent('ET');
```

### 2. Font Reference Resolution

Determine PDFKit's internal font reference (`/F1`, `/F2`, etc.):
- Option A: Inspect `doc._fontFamilies` or `doc.page.fonts` (private API)
- Option B: Trial-and-error with known fonts
- Option C: Patch PDFKit to expose font reference

### 3. GID→CID Mapping

Handle glyph ID to character ID conversion:
- For TrueType fonts: Often GID == CID (verify per font)
- For Type 0 (CID) fonts: May need mapping table
- With font subsetting: Build custom CID→GID map

### 4. RTL Handling

Reverse glyph order for RTL text before rendering.

## Acceptance Criteria

### Width Precision
```bash
npm run test:glyph-rendering
# Expected: 100% of words with <0.01pt deviation
```

### Visual Comparison

Create comparison image showing:
- Left column: Current PDFKit rendering (Alternative A)
- Right column: Direct glyph rendering (Alternative B)
- Highlighted differences on words with te'amim

Save to: `docs/images/rendering-comparison.png`

### Performance

Measure rendering time for 100-word document:
- Alternative A (current): ~X ms
- Alternative B (glyph-level): ~Y ms
- Expected: Y <= X (single shaping pass)

## Implementation Plan

### Phase 1: Font Reference (Day 1)
1. Create `src/rendering/pdf-font-resolver.ts`
2. Implement font reference detection
3. Test with SILEOT.ttf and Ezra SIL

### Phase 2: Glyph Rendering (Day 2)
1. Create `src/rendering/pdf-glyph-renderer.ts`
2. Implement `renderGlyphDirect(doc, glyph, x, y)`
3. Handle coordinate conversion (HarfBuzz units → PDF points)
4. Handle RTL glyph reversal

### Phase 3: Testing & Comparison (Day 3)
1. Create `tests/integration/glyph-rendering.test.ts`
2. Generate side-by-side comparison PDF
3. Create comparison screenshot tool
4. Measure width deviation (should be 0%)

## Files to Create/Modify

### New Files
- `src/rendering/pdf-font-resolver.ts`
- `src/rendering/pdf-glyph-renderer.ts`
- `tests/integration/glyph-rendering.test.ts`
- `tools/create-rendering-comparison.ts`
- `docs/images/rendering-comparison.png`

### Modified Files
- `src/rendering/pdf-renderer.ts` (add glyph-level option)
- `package.json` (add `test:glyph-rendering` script)

## Success Metrics

- [ ] 100% width precision (<0.01pt deviation)
- [ ] Comparison image shows identical output
- [ ] Tests pass: `npm run test:glyph-rendering`
- [ ] Performance equal or better than Alternative A
- [ ] Code review approved
- [ ] Documentation updated in ADR-004

## References

- **ADR-004:** Full analysis of alternatives and width measurements
- **Feasibility:** `tools/render-glyphs-directly.ts` (proof-of-concept)
- **Width Data:** `out/rendering-alternatives.json` (100-word measurements)
- **Spec:** Section 25 (PDF Rendering)

## Notes

This task is OPTIONAL for M2. Prioritize column balancing first.

Only implement if:
1. Column balancing reveals width precision issues
2. User reports visual positioning problems
3. Performance optimization is needed (avoid double shaping)

Otherwise, defer to M3+.
