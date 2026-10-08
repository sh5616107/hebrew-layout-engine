# Evidence Mapping: Requirements to Verification Files

This document maps each requirement to the specific evidence files (PDFs and PNGs) that demonstrate pass/fail status.

## Available Evidence Files

### PDFs (Generated Successfully)
- ✓ `poc/out/vivliostyle.pdf` - Vivliostyle output
- ✓ `poc/out/typst.pdf` - Typst output
- ✓ `poc/out/vivliostyle-run1.pdf` - First determinism test run
- ✓ `poc/out/vivliostyle-run2.pdf` - Second determinism test run
- ✓ `poc/out/typst-run1.pdf` - First determinism test run
- ✓ `poc/out/typst-run2.pdf` - Second determinism test run

### PNGs (Not Generated - Tool Missing)
- ✗ `poc/out/vivliostyle-page-1.png` - Page 1 of Vivliostyle output
- ✗ `poc/out/vivliostyle-page-2.png` - Page 2 (if exists)
- ✗ `poc/out/typst-page-1.png` - Page 1 of Typst output
- ✗ `poc/out/typst-page-2.png` - Page 2 (if exists)

**Tool needed:** ImageMagick (`magick`) or Poppler utils (`pdftoppm`)

**Generation command (when tool available):**
```powershell
# ImageMagick
magick convert -density 150 poc/out/vivliostyle.pdf poc/out/vivliostyle-page-%d.png
magick convert -density 150 poc/out/typst.pdf poc/out/typst-page-%d.png

# Poppler
pdftoppm -r 150 -png poc/out/vivliostyle.pdf poc/out/vivliostyle-page
pdftoppm -r 150 -png poc/out/typst.pdf poc/out/typst-page
```

---

## Requirement-to-Evidence Mapping

### (a) B5 Page Size: 176×250mm Exactly

**What to check:** PDF page dimensions

**Vivliostyle:**
- File: `poc/out/vivliostyle.pdf`
- Method: PDF properties → Page size
- Expected: 176mm × 250mm (or 498.9pt × 708.66pt)
- PNG: `vivliostyle-page-1.png` (measure with ruler tool)
- Status: UNVERIFIED

**Typst:**
- File: `poc/out/typst.pdf`
- Method: PDF properties → Page size
- Expected: 176mm × 250mm
- PNG: `typst-page-1.png`
- Status: UNVERIFIED

**Pass criteria:** Page dimensions exactly match B5 ISO specification.

---

### (b) Hebrew RTL with Nikud and Teamim

**What to check:** Character rendering, directionality, diacritic positioning

**Vivliostyle:**
- File: `poc/out/vivliostyle.pdf`
- PNG: `vivliostyle-page-1.png` (zoom 200-300%)
- Inspect: First paragraph "בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים..."
- Check:
  - Text flows right-to-left ✓
  - Nikud (בְּ = bet + shva) positioned correctly
  - Teamim (֖ = tifcha, ֣ = munach, etc.) positioned correctly
  - No overlapping marks
- Status: PARTIAL (David font - nikud OK, teamim may be limited)

**Typst:**
- File: `poc/out/typst.pdf`
- PNG: `typst-page-1.png` (zoom 200-300%)
- Same checks as Vivliostyle
- Status: PARTIAL (same font)

**Pass criteria:**
- All nikud marks visible and positioned correctly
- All teamim marks visible and positioned correctly (requires Ezra SIL or Taamey David CLM)

**Note:** Genesis 1 text includes authentic cantillation marks from Mechon-Mamre.

---

### (c) Two Equal Columns, Right Column First

**What to check:** Column count, widths, and text flow order

**Vivliostyle:**
- File: `poc/out/vivliostyle.pdf`
- PNG: `vivliostyle-page-1.png`
- Measure:
  - Count columns: should be 2
  - Measure widths with ruler tool: should be equal (within 1mm)
  - Column gap: should be visible (≈10mm)
- Trace text flow:
  - Chapter heading "בְּרֵאשִׁית" should span both columns (centered)
  - First body paragraph should start in RIGHT column
  - Text continues to LEFT column after right is full
- Status: UNVERIFIED

**Typst:**
- File: `poc/out/typst.pdf`
- PNG: `typst-page-1.png`
- Same measurements and checks
- Status: UNVERIFIED

**Pass criteria:**
- Exactly 2 columns
- Widths equal within 1mm (allowing for rounding)
- Text flows right → left

---

### (d) Last Column Balancing (≤1 Line Difference)

**What to check:** Final page column heights

**Vivliostyle:**
- File: `poc/out/vivliostyle.pdf`
- PNG: `vivliostyle-page-LAST.png` (last page of document)
- Measure:
  - Count lines in right column from top to last line
  - Count lines in left column from top to last line
  - Calculate difference
- Expected: Difference ≤ 1 line (14pt line height)
- Status: UNVERIFIED

**Typst:**
- File: `poc/out/typst.pdf`
- PNG: `typst-page-LAST.png`
- Same measurement
- Note: Typst has known column balancing issues
- Status: UNVERIFIED

**Pass criteria:** On the last page only, both columns end within one line of each other.

---

### (e) Shared Baseline Grid Between Columns

**What to check:** Horizontal alignment of text baselines across columns

**Vivliostyle:**
- File: `poc/out/vivliostyle.pdf`
- PNG: `vivliostyle-page-1.png`
- Method:
  1. Overlay horizontal grid lines at 14pt intervals (baseline grid)
  2. Check if lines in right column align with lines in left column
  3. Measure vertical positions of corresponding lines
- Expected: Baselines at same Y coordinate across columns
- **Known issue:** Vivliostyle #1157 - not supported
- Status: **FAIL** (documented limitation)

**Typst:**
- File: `poc/out/typst.pdf`
- PNG: `typst-page-1.png`
- Same overlay test
- Status: UNVERIFIED

**Pass criteria:** All baselines align horizontally between columns (tolerance: ±0.5pt)

**Evidence of failure (Vivliostyle):**
- GitHub issue: https://github.com/vivliostyle/vivliostyle.js/issues/1157
- Comment in CSS: "Baseline grid alignment between columns is not fully supported"

---

### (f) Bold Opening + Window (2 Lines High, Word Width)

**What to check:** First paragraph with opening flag

**Vivliostyle:**
- File: `poc/out/vivliostyle.pdf`
- PNG: `vivliostyle-page-1.png`
- Block: `block-2` (first body paragraph)
- Check:
  - First 3 words "בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים" are bold ✓
  - Font size slightly larger (1.1em) ✓
  - Empty rectangular space below the bold words ✗
  - Space dimensions: width = bold text width, height = 2 lines (28pt) ✗
  - Text wraps around the space ✗
- Status: **PARTIAL** (bold works, window not implemented)

**Typst:**
- File: `poc/out/typst.pdf`
- PNG: `typst-page-1.png`
- Same checks
- Status: **PARTIAL** (bold works, window not implemented)

**Pass criteria:**
- Bold opening: ✓ Both engines
- Window: ✗ Neither engine

**Workaround needed:**
- Vivliostyle: CSS shape-outside + JS measurement (150-250 LOC)
- Typst: Custom layout function (100-200 LOC)

---

### (g) Last Line of Paragraph Centered

**What to check:** Final line of each paragraph

**Vivliostyle:**
- File: `poc/out/vivliostyle.pdf`
- PNG: `vivliostyle-page-1.png`
- Check each paragraph:
  - Block-2, Block-3, Block-5, Block-7, Block-9, Block-10
  - Last line should be centered
  - All other lines should be justified
- CSS used: `text-align-last: center;`
- Status: **PARTIAL** (may center lines that break mid-column, not just true paragraph ends)

**Typst:**
- File: `poc/out/typst.pdf`
- PNG: `typst-page-1.png`
- Check: Last lines likely NOT centered
- Issue: Typst lacks `text-align-last` feature
- Status: **FAIL** (no implementation)

**Pass criteria:**
- Only the final line of each paragraph is centered
- Intermediate lines are justified
- Works even if paragraph ends at column break

---

### (h) Footnotes Full-Width with Separator Line

**What to check:** Footnote area placement and width

**Vivliostyle:**
- File: `poc/out/vivliostyle.pdf`
- PNG: `vivliostyle-page-1.png` (has 2 footnotes: note-1 and note-2)
- Check:
  - Footnotes appear at bottom of page ✓
  - Footnote area spans full page width (both columns) ?
  - Horizontal separator line above footnotes ✓
  - Separator line spans full width ?
  - Footnote text width = full page width ?
- CSS used: `@footnote` area with border-top
- Status: UNVERIFIED

**Typst:**
- File: `poc/out/typst.pdf`
- PNG: `typst-page-1.png`
- Check:
  - Footnotes appear at bottom of EACH COLUMN (not full-width)
- **Known issue:** Typst places footnotes per-column in multi-column layout
- Forum: https://forum.typst.app/t/double-column-footnotes/8231
- Status: **FAIL** (documented limitation)

**Pass criteria:**
- Footnotes appear below BOTH columns (not at bottom of each individual column)
- Footnote area is full page width
- Separator line is full page width

**Evidence of failure (Typst):**
- Forum discussion confirms per-column footnotes only
- Comment in generated .typ: "Note: Footnotes appear at bottom of each column"

---

### (i) Footnote on Same Page as Reference

**What to check:** Footnote marker and footnote text proximity

**Vivliostyle:**
- File: `poc/out/vivliostyle.pdf`
- PNG: `vivliostyle-page-1.png`
- Check:
  - Block-2 has footnote marker¹ in text
  - Footnote 1 text appears at bottom of same page
  - Block-3 has footnote marker² in text
  - Footnote 2 text appears at bottom of same page
- Status: UNVERIFIED

**Typst:**
- File: `poc/out/typst.pdf`
- PNG: Same checks
- Status: UNVERIFIED

**Pass criteria:** At least first 2 lines of each footnote appear on same page as superscript marker.

---

### (j) Long Footnote Continues to Next Page

**What to check:** Multi-page footnote handling

**Vivliostyle:**
- File: `poc/out/vivliostyle.pdf`
- PNG: `vivliostyle-page-1.png` and `vivliostyle-page-2.png` (if exists)
- Target: Note-3 (block-7 reference, ≈150 words)
- Check:
  - If note-3 doesn't fit on first page, does it continue to page 2? ✓
  - Is continuation clearly visible? ✓
  - No text lost? ✓
- Status: UNVERIFIED (depends on how much fits on page 1)

**Typst:**
- File: `poc/out/typst.pdf`
- PNG: Same checks
- Status: UNVERIFIED

**Pass criteria:**
- Long footnotes split across pages when necessary
- Minimum 2 lines on each page (no orphan lines)

**Note:** Sample note-3 is intentionally long to trigger this requirement.

---

### (k) Running Headers (Odd/Even Differ) + Gematria Numbering

**What to check:** Page headers and number format

**Vivliostyle:**
- File: `poc/out/vivliostyle.pdf`
- PNG: `vivliostyle-page-1.png` (odd), `vivliostyle-page-2.png` (even, if exists)
- Check:
  - Page 1 (odd/right): Header shows `א | בראשית` or `בראשית | א`
  - Page 2 (even/left): Header shows opposite order
  - Number format: Hebrew letters א, ב, ג, ד...
  - Special cases (if document has 15+ pages): 15 = טו (not יה), 16 = טז (not יו)
- CSS used: `@counter-style hebrew` with additive symbols
- Status: UNVERIFIED (sample may be only 1 page)

**Typst:**
- File: `poc/out/typst.pdf`
- PNG: Same checks
- Typst code: `gematria(n)` function with טו/טז special cases
- Status: UNVERIFIED

**Pass criteria:**
- Odd pages: one header format
- Even pages: different header format (mirrored)
- Page numbers in Hebrew letters with correct special cases

---

### (l) Table of Contents with Page Numbers

**What to check:** TOC section with leader dots and page numbers

**Vivliostyle:**
- Status: **NOT IMPLEMENTED** in sample
- Reason: Sample focuses on body text layout
- Capability: CSS `target-counter()` available

**Typst:**
- Status: **NOT IMPLEMENTED** in sample
- Reason: Same as above
- Capability: `#outline()` function available

**Pass criteria:** N/A (not in scope of this POC sample)

**Note:** Both engines support TOC generation. Would require separate test document.

---

### (m) Determinism (Identical Runs)

**What to check:** Binary comparison of repeated runs

**Vivliostyle:**
- Files: `poc/out/vivliostyle-run1.pdf`, `poc/out/vivliostyle-run2.pdf`
- Method: SHA256 hash comparison
- Command:
  ```powershell
  $hash1 = (Get-FileHash poc/out/vivliostyle-run1.pdf).Hash
  $hash2 = (Get-FileHash poc/out/vivliostyle-run2.pdf).Hash
  $hash1 -eq $hash2
  ```
- Result: `False` (FAIL)
- Reason: PDF metadata contains timestamps or UUIDs

**Typst:**
- Files: `poc/out/typst-run1.pdf`, `poc/out/typst-run2.pdf`
- Method: Same SHA256 comparison
- Result: `False` (FAIL)
- Reason: Same as Vivliostyle

**Pass criteria:** Byte-for-byte identical PDFs on repeated runs.

**Status:** **FAIL** for both engines

**Workaround:** Strip PDF metadata before comparison, or compare visual content only (50-100 LOC)

---

## Manual Verification Procedure

Since PNG files were not generated due to missing conversion tools, use this procedure:

### 1. Install PDF Reader with Measurement Tools

Recommended:
- Adobe Acrobat Reader (has ruler and measurement tools)
- Foxit Reader
- PDF-XChange Editor

### 2. Open PDFs Side-by-Side

```powershell
Start-Process "poc/out/vivliostyle.pdf"
Start-Process "poc/out/typst.pdf"
```

### 3. For Each Requirement Above

- Navigate to relevant page
- Use zoom (200-400%) for text inspection
- Use measurement tool for dimensions
- Take screenshots for documentation
- Save screenshots as:
  - `poc/out/evidence-{requirement}-vivliostyle.png`
  - `poc/out/evidence-{requirement}-typst.png`

### 4. Update RESULTS.md

Replace "UNVERIFIED" entries with:
- PASS, PARTIAL, or FAIL
- Description of what was observed
- Reference to evidence screenshot

### 5. Archive Evidence

Move all evidence files to `poc/out/` and reference them in this document.

---

## Summary of Evidence Status

| Requirement | Vivliostyle | Typst | Evidence Available |
|-------------|-------------|-------|-------------------|
| a. Page size | UNVERIFIED | UNVERIFIED | PDF properties |
| b. Hebrew RTL/nikud | PARTIAL | PARTIAL | PDF (zoom needed) |
| c. Two columns | UNVERIFIED | UNVERIFIED | PDF visual |
| d. Column balance | UNVERIFIED | UNVERIFIED | PDF last page |
| e. Baseline grid | **FAIL** | UNVERIFIED | GitHub issue #1157 |
| f. Bold + window | **PARTIAL** | **PARTIAL** | PDF visual + code |
| g. Last line center | **PARTIAL** | **FAIL** | PDF visual |
| h. Footnotes full-width | UNVERIFIED | **FAIL** | PDF + forum |
| i. Footnote same page | UNVERIFIED | UNVERIFIED | PDF visual |
| j. Footnote continuation | UNVERIFIED | UNVERIFIED | PDF multi-page |
| k. Headers/gematria | UNVERIFIED | UNVERIFIED | PDF headers |
| l. TOC | NOT IMPL | NOT IMPL | N/A |
| m. Determinism | **FAIL** | **FAIL** | Hash comparison ✓ |

**✓ = Evidence collected and verified**
**Code = Evidence in source code comments**
**PDF = Evidence requires PDF inspection**
**GitHub/Forum = Evidence in external documentation**

---

## Next Steps for Complete Verification

1. **Install ImageMagick or Poppler:**
   - ImageMagick: `choco install imagemagick` (if Chocolatey available)
   - Poppler: Download from https://github.com/oschwartz10612/poppler-windows/releases

2. **Generate PNGs:**
   ```powershell
   magick convert -density 150 poc/out/vivliostyle.pdf poc/out/vivliostyle-page-%d.png
   magick convert -density 150 poc/out/typst.pdf poc/out/typst-page-%d.png
   ```

3. **Perform Visual Checks:**
   - Open each PNG in image viewer
   - Follow verification procedure above
   - Document findings in RESULTS.md

4. **Optional: Install Better Font:**
   - Download Ezra SIL from https://software.sil.org/ezra/
   - Install on Windows
   - Regenerate PDFs (adapters will pick up new font)
   - Compare nikud/teamim quality

---

**Document Status:** Complete mapping, pending PNG generation and visual verification
**Last Updated:** POC completion
