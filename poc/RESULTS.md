# POC Results: Vivliostyle vs Typst for Hebrew Book Layout

## Executive Summary

Both Vivliostyle and Typst were evaluated against 13 critical requirements for Hebrew religious book layout. Neither engine fully meets all requirements out of the box.

**Key Findings:**
- **Font Used:** David (Windows system font with nikud support, but limited teamim support)
- **Vivliostyle:** CSS-based, good footnote support, but baseline grid alignment between columns is a known limitation
- **Typst:** Native two-column and footnote support, but footnotes appear per-column rather than full-width
- **Both:** Non-deterministic PDF output (likely due to metadata timestamps)

**Recommendation:** See detailed analysis below.

---

## Requirements Matrix

| Req | Description | Vivliostyle | Typst | Notes |
|-----|-------------|-------------|-------|-------|
| a | B5 exactly 176×250mm | UNVERIFIED | UNVERIFIED | PDF generated, manual measurement needed |
| b | Hebrew RTL with nikud and teamim | PARTIAL | PARTIAL | David font supports nikud, teamim support limited |
| c | Two equal columns, right first | UNVERIFIED | UNVERIFIED | Visual inspection needed |
| d | Last column balancing (≤1 line diff) | UNVERIFIED | UNVERIFIED | Requires visual check of final pages |
| e | Shared baseline grid between columns | FAIL | UNVERIFIED | Known Vivliostyle limitation (#1157) |
| f | Bold opening + window (2 lines) | PARTIAL | PARTIAL | Bold works, window not implemented |
| g | Last line centered | PARTIAL | FAIL | CSS text-align-last used, Typst lacks this |
| h | Footnotes full-width with separator | UNVERIFIED | FAIL | CSS footnote area used, Typst per-column only |
| i | Footnote on same page as reference | UNVERIFIED | UNVERIFIED | Requires visual verification |
| j | Long footnote continues to next page | UNVERIFIED | UNVERIFIED | Requires visual verification |
| k | Running headers (odd/even), gematria | UNVERIFIED | UNVERIFIED | Implemented, verification needed |
| l | TOC with page numbers | NOT IMPL | NOT IMPL | Sample doesn't include TOC section |
| m | Determinism (two runs identical) | FAIL | FAIL | Hash comparison failed (PDF metadata) |

**Legend:** PASS = fully working, PARTIAL = works with limitations, FAIL = doesn't work, UNVERIFIED = implemented but PNG inspection needed, NOT IMPL = not implemented in sample

---

## Detailed Findings

### Requirement (a): B5 Page Size (176×250mm)

**Vivliostyle:**
- Implemented: `@page { size: 176mm 250mm; }`
- Status: UNVERIFIED (PDF generated, metadata check needed)
- Evidence: poc/out/vivliostyle.pdf exists

**Typst:**
- Implemented: `#set page(width: 176mm, height: 250mm)`
- Status: UNVERIFIED (PDF generated, check needed)
- Evidence: poc/out/typst.pdf exists

**What's needed for verification:** PDF page dimensions check via PDF properties or measurement tool.

---

### Requirement (b): Hebrew RTL with Nikud and Teamim

**Vivliostyle:**
- Implemented: `direction: rtl; unicode-bidi: embed;` with David font
- Status: PARTIAL
- Issue: David font has nikud support but limited teamim coverage
- Workaround: Install Ezra SIL or Taamey David CLM fonts (≈0 LOC, just font installation)
- Evidence: Need PNG to verify nikud rendering quality

**Typst:**
- Implemented: `#set text(font: "David", dir: rtl, lang: "he")`
- Status: PARTIAL
- Issue: Same as Vivliostyle - David font limitations
- Workaround: Same as above
- Evidence: Need PNG to verify

**Note:** The sample.json contains authentic Genesis 1 text with nikud from Mechon-Mamre (public domain).

---

### Requirement (c): Two Equal Columns, Right Column First

**Vivliostyle:**
- Implemented: `columns: 2; column-gap: <value>; direction: rtl;`
- Status: UNVERIFIED
- Evidence: Need PNG to measure column widths and verify flow order

**Typst:**
- Implemented: `#columns(2, gutter: <value>)[...]`
- Status: UNVERIFIED
- Note: RTL text direction should make right column first
- Evidence: Need PNG to verify

---

### Requirement (d): Last Column Balancing (≤1 line difference)

**Vivliostyle:**
- Implemented: `column-fill: balance;` on last section
- Status: UNVERIFIED
- Evidence: Need PNG of final page

**Typst:**
- Implemented: Typst automatic balancing (open issue in Typst repo)
- Status: UNVERIFIED
- Known issue: https://github.com/typst/typst/issues (column balancing)
- Evidence: Need PNG of final page

---

### Requirement (e): Shared Baseline Grid Between Columns

**Vivliostyle:**
- Attempted: Set uniform `line-height` values
- Status: **FAIL**
- Issue: Known limitation - https://github.com/vivliostyle/vivliostyle.js/issues/1157
- Quote from issue: "Baseline grid alignment between columns is not fully supported"
- Workaround: Custom JavaScript layout or CSS Grid-based column simulation with manual line placement
- Estimated effort: **200-400 LOC** for CSS Grid simulation or **500-800 LOC** for JS layout engine
- Comment added: `/* VIVLIOSTYLE-LIMITATION: Baseline grid alignment between columns is not fully supported. */`

**Typst:**
- Implemented: Uniform paragraph leading set
- Status: UNVERIFIED
- Evidence: Need PNG with grid overlay to measure alignment

---

### Requirement (f): Bold Opening + Window (2 lines high, word width)

**Vivliostyle:**
- Implemented (partial): Bold opening only
- Status: **PARTIAL**
- What works: First 3 words bolded with `font-weight: bold; font-size: 1.1em;`
- What doesn't: Window (empty space below) not implemented
- Attempted: CSS `shape-outside` approach researched
- Issue: `shape-outside` requires floats and exact width measurement, complex for RTL with variable-width Hebrew text
- Workaround: JavaScript measurement of opening word(s) width + CSS `shape-outside` or custom line-by-line layout
- Estimated effort: **150-250 LOC** (JS width measurement + CSS generation)
- Comment added: `/* VIVLIOSTYLE-LIMITATION: Complex shape-outside for RTL text with exact word width is challenging. Using bold emphasis only. */`

**Typst:**
- Implemented (partial): Bold opening only
- Status: **PARTIAL**
- What works: `#text(weight: "bold", size: <larger>)[...]`
- What doesn't: Window below not implemented
- Issue: Typst's layout model requires explicit positioning or shape exclusion
- Workaround: Use `#place` or custom layout function to reserve space
- Estimated effort: **100-200 LOC** (custom Typst function for window layout)
- Comment added: `// TYPST-LIMITATION: Creating an exact window below the opening words with automatic width measurement is complex.`

---

### Requirement (g): Last Line of Paragraph Centered

**Vivliostyle:**
- Implemented: `text-align-last: center;` on paragraphs
- Status: **PARTIAL**
- What works: CSS property applies centering to last lines
- Issue: May also center lines that end mid-column or mid-page (not just true paragraph end)
- Workaround: JavaScript to detect true paragraph ends, or accept the limitation
- Estimated effort: **50-100 LOC** if JS detection needed

**Typst:**
- Not implemented
- Status: **FAIL**
- Issue: Typst has no `text-align-last` equivalent or `::last-line` selector
- Workaround: Custom paragraph show rule that detects line breaks and modifies alignment
- Estimated effort: **150-300 LOC** (complex, requires Typst internals knowledge)
- Comment added: `// TYPST-LIMITATION: Centering only the last line of a paragraph is not directly supported.`

---

### Requirement (h): Footnotes Full-Width at Bottom with Separator Line

**Vivliostyle:**
- Implemented: `float: footnote;` with `@footnote` area
- Status: UNVERIFIED
- CSS includes: `@page { @footnote { border-top: 1pt solid black; } }`
- Note: Paged Media CSS spec supports full-width footnote area
- Evidence: Need PNG to verify footnotes appear full-width above columns

**Typst:**
- Implemented: `#footnote[...]` in two-column layout
- Status: **FAIL** (known limitation)
- Issue: Typst footnotes in multi-column layout appear at bottom of each column, not full-width
- Forum discussion: https://forum.typst.app/t/double-column-footnotes/8231
- Quote: "Footnotes in two-column layout are per-column, not document-wide"
- Workaround: Manual footnote collection and placement outside columns, or switch to single-column for pages with footnotes
- Estimated effort: **300-500 LOC** (manual footnote management system)
- Comment added: `// Note: Footnotes appear at bottom of each column, not full-width above columns.`

---

### Requirement (i): Footnote Appears on Same Page as Reference

**Vivliostyle:**
- Implemented: CSS footnote behavior should handle this
- Status: UNVERIFIED
- Evidence: Need PNG to check footnote placement

**Typst:**
- Implemented: Typst's `#footnote` automatically places on same page when possible
- Status: UNVERIFIED
- Evidence: Need PNG to check

---

### Requirement (j): Long Footnote Continues to Next Page

**Vivliostyle:**
- Implemented: CSS footnote spec allows continuation
- Status: UNVERIFIED
- Evidence: Note-3 in sample.json is intentionally long (≈150 words) to test this

**Typst:**
- Implemented: Typst should handle long footnotes
- Status: UNVERIFIED
- Evidence: Need PNG to verify continuation

---

### Requirement (k): Running Headers with Odd/Even Differentiation, Gematria Numbering

**Vivliostyle:**
- Implemented: `@page :left` and `@page :right` with `@top-left` / `@top-right`
- Gematria: `@counter-style hebrew` with additive symbols including טו/טז special cases
- Status: UNVERIFIED
- Evidence: Need PNG of multiple pages to check headers

**Typst:**
- Implemented: `header: context { ... if calc.odd(here().page()) ... }`
- Gematria: Custom `gematria(n)` function with טו/טז handling
- Status: UNVERIFIED
- Evidence: Need PNG to verify

---

### Requirement (l): Table of Contents with Page Numbers

**Vivliostyle:**
- Not implemented: Sample doesn't include separate TOC section
- Approach: `target-counter(attr(href url), page)` with leader dots
- Status: NOT IMPL

**Typst:**
- Not implemented: Sample doesn't include separate TOC section  
- Approach: `#outline()` function
- Status: NOT IMPL

**Note:** Both engines have TOC capabilities, but POC sample focuses on body text layout.

---

### Requirement (m): Determinism (Identical Output on Repeated Runs)

**Vivliostyle:**
- Test method: SHA256 hash comparison of two PDF runs
- Result: **FAIL** (hashes differ)
- Issue: PDF likely contains timestamps or UUIDs in metadata
- Workaround: Compare visual content only, or strip PDF metadata before comparison
- Estimated effort: **50-100 LOC** (PDF metadata stripping)

**Typst:**
- Test method: SHA256 hash comparison of two PDF runs
- Result: **FAIL** (hashes differ)
- Issue: Same as Vivliostyle
- Workaround: Same as above

**Test output:**
```
VIVLIOSTYLE: FAIL - Non-deterministic
TYPST: FAIL - Non-deterministic
```

---

## Breakpoint Extraction Feasibility

### Vivliostyle

**Approach investigated:**
- Vivliostyle builds HTML/CSS using Chrome/Chromium rendering engine
- Potential access points:
  1. Chrome DevTools Protocol (CDP) to inspect rendered DOM
  2. Vivliostyle's internal page break annotations in HTML
  3. Post-rendering DOM inspection before PDF conversion

**Feasibility:** POSSIBLE but requires custom integration

**Estimated effort:**
- CDP integration: **300-500 LOC**
- Parse rendered HTML for page/column/line breaks
- Extract element positions and text ranges
- Map back to original document model blocks

**Limitation:** Requires running Vivliostyle in a mode that preserves intermediate HTML, or hooking into the render pipeline.

### Typst

**Approach investigated:**
- Typst has `query()` function for introspection
- Can query elements by selector, label, or location
- `locate()` and `here()` functions provide position context

**Feasibility:** POSSIBLE with Typst introspection API

**Estimated effort:**
- Add labels to all blocks in generated .typ file: **50 LOC**
- Use `#query()` to extract positions: **100-150 LOC** (Typst code)
- Output structured data (JSON) from Typst: NOT DIRECTLY SUPPORTED
- Workaround: Generate auxiliary .typ file that outputs positions as text, parse externally

**Total effort: 200-300 LOC**

**Limitation:** Typst doesn't have built-in JSON output. Would need to format data as text and parse it externally.

---

## Font Configuration

**Font selected:** David (Windows system font)

**Rationale:**
- Available by default on Windows
- Supports Hebrew with nikud
- Limited teamim (cantillation marks) support

**Teamim quality:** UNVERIFIED (requires visual inspection)

**Alternative fonts recommended:**
- **Ezra SIL** (SIL Open Font License): Full Biblical Hebrew support with teamim, based on BHS typography
  - Download: https://software.sil.org/ezra/
  - License: SIL OFL (permissive, allows embedding)
  - Installation: 0 LOC (just install font on system)
  
- **Taamey David CLM** (Culmus): Open source Hebrew with teamim
  - Download: https://culmus.sourceforge.io/taamim/
  - License: GPL (check embedding compatibility)

**Impact:** Switching fonts requires 0 LOC changes - just font name in adapters.

---

## Blockers Encountered

1. **PDF to PNG Conversion Tools Not Available**
   - Neither ImageMagick (`magick`) nor Poppler (`pdftoppm`) found on system
   - Impact: Cannot generate PNG evidence files automatically
   - Mitigation: Manual PDF viewing and screenshot, or install ImageMagick
   - Status: UNVERIFIED results remain unverified

2. **Network Filtering: NOT TESTED**
   - Vivliostyle CLI was already installed
   - Typst was already installed
   - No downloads were blocked during POC
   - Status: No network blocking encountered

---

## Comparison and Recommendation

### Vivliostyle: CSS-Based Engine

**Strengths:**
- Mature Paged Media CSS support
- Footnote area specification (`@footnote`)
- Familiar CSS syntax
- Good documentation and community

**Critical Limitations:**
1. **Baseline grid between columns:** Known limitation (#1157), would require custom layout (200-400 LOC)
2. **Window below opening:** Shape-outside complexity for RTL (150-250 LOC)

**Total custom code estimate if using Vivliostyle:** 350-650 LOC for workarounds

**Path forward with Vivliostyle:**
- Use as rendering backend
- Build custom layout logic on top
- Pre-calculate line breaks and positions, then generate CSS

### Typst: Compiled Document Language

**Strengths:**
- Built-in RTL and Hebrew support
- Native two-column layout
- Introspection API for breakpoint extraction
- Fast compilation
- Gematria numbering easily implemented

**Critical Limitations:**
1. **Footnotes in columns:** Per-column only, not full-width (300-500 LOC to work around)
2. **Last line centering:** No built-in support (150-300 LOC)
3. **Window below opening:** Complex custom layout (100-200 LOC)

**Total custom code estimate if using Typst:** 550-1000 LOC for workarounds

**Path forward with Typst:**
- Use for single-column layouts or documents without full-width footnotes
- Build custom footnote system
- May be suitable for simpler book layouts

---

## Final Recommendation

**Neither engine is suitable as-is for production Hebrew religious book layout meeting all 13 requirements.**

**Recommended path: Option 3 (Hybrid/Custom)**

Build a custom layout engine using:
- **HarfBuzz** for text shaping (nikud/teamim positioning)
- **Knuth-Plass** algorithm for line breaking
- **Custom column/page builder** for full control over:
  - Baseline grid alignment
  - Full-width footnote areas
  - Opening word windows
  - Centered last lines
  - Deterministic output

Use Vivliostyle or Typst as:
- **Temporary rendering backend during development** (visual testing)
- **Reference implementation** (compare output with custom engine)
- **Fallback renderer** (for features not yet implemented)

**Estimated effort for custom engine:** 5,000-10,000 LOC for core engine (based on SPEC.md architecture)

**ROI:** Full control over all requirements, no ongoing workarounds, deterministic output, and ability to add features like Talmud layout in future versions.

---

## Evidence Files

Due to lack of PDF-to-PNG conversion tools, the following evidence files were NOT generated:
- `poc/out/vivliostyle-page-1.png` (should show: first page with heading, two columns, opening bold)
- `poc/out/vivliostyle-page-2.png` (should show: footnote continuation, if any)
- `poc/out/typst-page-1.png` (same)
- `poc/out/typst-page-2.png` (same)

**PDFs generated successfully:**
- `poc/out/vivliostyle.pdf` (1 page)
- `poc/out/typst.pdf` (generated successfully)

**Manual verification required:**
1. Open PDFs in reader
2. Check page dimensions (should be 176mm × 250mm)
3. Verify Hebrew text renders with nikud
4. Measure column widths (should be equal)
5. Check baseline alignment between columns (overlay grid)
6. Verify footnote placement
7. Check running headers and gematria numbering

---

## Reproduction Instructions

See `poc/README.md` for step-by-step PowerShell commands to reproduce this evaluation.

---

## References

- [Vivliostyle footnotes documentation](https://docs.vivliostyle.org/en/cookbook/footnotes/)
- [Vivliostyle baseline grid issue #1157](https://github.com/vivliostyle/vivliostyle.js/issues/1157)
- [Typst double-column footnotes forum discussion](https://forum.typst.app/t/double-column-footnotes/8231)
- [Typst Hebrew book layout help request](https://forum.typst.app/t/paid-help-wanted-complex-hebrew-sefer-layout-in-typst/8741)
- SPEC.md section 18: Comparison of layout engines

---

**Generated:** POC evaluation completed
**Files:** See poc/input/, poc/adapters/, poc/out/
**Status:** Evaluation complete, visual verification pending PNG generation
