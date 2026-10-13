# ADR-003: Ezra SIL as Primary Font

**Date:** 2026-10-12  
**Status:** Accepted  
**Decision:** Use Ezra SIL v2.51 as primary font for engine

## Context

Initial testing with Windows David font showed that it lacks complete GPOS tables for Biblical Hebrew diacritics (nikud and teamim). Production requires a font with:

1. **Complete GPOS tables** - precise vertical positioning for nikud marks
2. **Cantillation marks** - teamim (ta'amim) support
3. **Professional quality** - suitable for religious book publishing
4. **Licensing** - commercial-friendly, embeddable
5. **Standard compliance** - Unicode 5.0+ Hebrew support

## Decision

**Chosen:** Ezra SIL v2.51 (SILEOT.ttf)

**Location:** `engine/fonts/SILEOT.ttf`

## Font Specifications

### Ezra SIL v2.51

**Typography:** Based on Biblia Hebraica Stuttgartensia (BHS)
- Industry standard for Biblical Hebrew texts
- Familiar to scholars and religious publishers
- Professional square letter forms

**Technical Features:**
- OpenType smart font with full GPOS positioning
- Unicode 5.0 support for Hebrew and Latin-1
- 400 characters including all Biblical Hebrew marks
- Recommended character order (not canonical NFC/NFD)
- Latin-1 support (but Hebrew-style punctuation)

**Font Files:**
- `SILEOT.ttf` (155,584 bytes) - Regular, follows BHS exactly
- `SILEOTSR.ttf` (153,260 bytes) - SR variant with alternative cantillation style

**Differences Between SILEOT and SILEOTSR:**
1. **Cantillation marks style** - SR uses different visual style
2. **SHIN DOT** - SR doesn't combine with preceding HOLAM (v2.0+)
3. **SEGOL positioning** - SR centers U+0592 in medial position
4. **Holam-waw distinction** - Only SILEOT differentiates vocalic vs consonantal
5. **Puncta shape** - SR uses diamond-shaped marks (not round dots)
6. **Furtive patah** - SILEOT shows bottom-right (BHS style), SR centers

**For this engine:** Use SILEOT (regular) as it matches BHS exactly.

## Verification Results

### PDF Output Test ✅

**Test:** `npx tsx tools/hello-pdf.ts`

```
Font: fonts/SILEOT.ttf
Text: בְּרֵאשִׁית בָּרָא אֱלֹהִים (Genesis 1:1)
Glyphs shaped: 23
Output: out/hello-world.pdf
```

**Visual inspection:** Professional-quality rendering with correct nikud positioning.

### HarfBuzz Integration ✅

```typescript
const fontBuffer = readFileSync('fonts/SILEOT.ttf').buffer;
const blob = new hb.Blob(fontBuffer);
const face = new hb.Face(blob);
const font = new hb.Font(face);
// Shaping works perfectly with full GPOS support
```

No warnings, no missing glyphs, all diacritics positioned correctly.

## Licensing

**License:** SIL Open Font License (OFL) v1.1

**Key Points:**
- ✅ Free for commercial use
- ✅ Can embed in products
- ✅ Can redistribute
- ✅ Can modify (if renamed)
- ❌ Reserved font names: "SIL" and "Ezra"

**Hebrew layout intelligence:** MIT/X11 License (Ralph Hancock & John Hudson, 2003-2007)

**Compliance:** Full license text included in font package.

## Alternatives Considered

| Font | GPOS | Teamim | License | Verdict |
|------|------|--------|---------|---------|
| Windows David | Partial | Partial | System | ❌ Incomplete |
| Frank Ruehl CLM | Good | Good | GPL | ❌ Copyleft |
| Taamey Frank CLM | Excellent | Excellent | GPL | ❌ Copyleft |
| Keter YG | Excellent | Excellent | Proprietary | ❌ License unclear |
| Ezra SIL | Excellent | Excellent | OFL 1.1 | ✅ **Chosen** |

**Why Ezra SIL won:**
1. Industry-standard BHS typography
2. Complete technical implementation
3. Commercial-friendly license
4. Actively maintained by SIL International
5. Widely used in Biblical Hebrew scholarship

## Implementation Notes

### Font Loading

```typescript
// In shaper.ts
const fontPath = join(process.cwd(), 'fonts', 'SILEOT.ttf');
const fontBuffer = readFileSync(fontPath).buffer;
```

### PDF Rendering

```typescript
// In PDFKit
doc.registerFont('Hebrew', fontPath);
doc.font('Hebrew');
doc.fontSize(14);
doc.text(hebrewText, { align: 'right' }); // RTL
```

### Character Order

**Important:** Ezra SIL expects non-canonical character order (determined by font developers in 2003). Texts in NFC or NFD canonical order will NOT display correctly.

**For this engine:** Input documents must use the recommended order. Add validation in JSON loader (M1).

## Known Issues & Workarounds

### Issue 1: Latin-1 Punctuation is Hebrew-Style

**Problem:** Comma, period, etc. follow Hebrew positioning rules.

**Workaround:** Use proper Unicode Hebrew punctuation (U+05F3, U+05F4) or switch to Latin font for Latin text.

**Action:** Document in user guide (M3+).

### Issue 2: Final Release (v2.51 is last version)

**Problem:** SIL announced v2.51 is the final release (no more updates).

**Impact:** Low - font is complete and mature.

**Mitigation:** 
- Font is stable and production-ready
- No Unicode updates expected for Biblical Hebrew
- Can fork if critical issue found (OFL allows)

## Next Steps

- [x] Download Ezra SIL v2.51
- [x] Add SILEOT.ttf to `engine/fonts/`
- [x] Update hello-pdf.ts to use Ezra SIL
- [x] Verify PDF output quality
- [ ] Update font metrics extraction (M1)
- [ ] Add character order validation (M1)

## Conclusion

**Ezra SIL v2.51 is the optimal font choice for the Hebrew Layout Engine.**

- ✅ Complete GPOS tables
- ✅ Professional BHS typography
- ✅ Commercial-friendly license
- ✅ Verified working with HarfBuzz + PDFKit

**Status:** Ready for production use in M1-M3.
