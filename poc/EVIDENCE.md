# Evidence Documentation

This document maps each requirement to verification evidence and findings.

## Test Artifacts

**PDFs Generated:**
- `poc/out/vivliostyle.pdf` (111 KB)
- `poc/out/typst.pdf` (size varies)
- `poc/out/vivliostyle-run1.pdf` (determinism test)
- `poc/out/vivliostyle-run2.pdf` (determinism test)
- `poc/out/typst-run1.pdf` (determinism test)
- `poc/out/typst-run2.pdf` (determinism test)

**Generated Source Files:**
- `poc/out/vivliostyle/index.html` - HTML structure with Hebrew text and footnotes
- `poc/out/vivliostyle/style.css` - Paged Media CSS with layout rules
- `poc/out/typst/main.typ` - Typst document with custom gematria function

**PNG Images:**
- ⚠️ NOT GENERATED - PDF to PNG conversion failed due to Node.js package issues
- Manual conversion required using ImageMagick or Poppler pdftoppm
- See README.md Step 6 for instructions

## Requirement Evidence Map

### (a) B5 exactly 176×250mm

**Vivliostyle:**
- Evidence: CSS specification
  ```css
  @page {
    size: 176mm 250mm;
  }
  ```
- File: `poc/out/vivliostyle/style.css` line ~15
- Visual verification: NOT PERFORMED (no PNG)
- PDF metadata check: NOT PERFORMED
- Rating: ⚠️ PARTIAL - specified correctly, needs PDF metadata verification

**Typst:**
- Evidence: Typst page setup
  ```typst
  #set page(
    width: 498.9pt,
    height: 708.66pt,
  )
  ```
- File: `poc/out/typst/main.typ` line ~28
- Calculation: 176mm = 498.9pt, 250mm = 708.66pt (correct)
- Visual verification: NOT PERFORMED (no PNG)
- Rating: ✓ PASS - dimensions specified correctly in points

**Next Step:** Use PDF metadata tool to verify actual page size:
```powershell
# Example with PDFtk or similar
pdftk vivliostyle.pdf dump_data | Select-String "PageMediaRect"
```

---

### (b) Hebrew RTL with nikud and teamim

**Vivliostyle:**
- Evidence: CSS rules
  ```css
  body {
    font-family: "Ezra SIL", "Taamey David CLM", "David Libre", "Times New Roman", serif;
    direction: rtl;
    unicode-bidi: embed;
  }
  ```
- File: `poc/out/vivliostyle/style.css` lines ~3-7
- Hebrew text includes nikud: בְּרֵאשִׁית (U+05B0, U+05B5, U+05B4 etc.)
- Teamim: NOT INCLUDED in test data
- Font fallback chain specified
- Visual verification: NOT PERFORMED (no PNG)
- Rating: ⚠️ UNVERIFIED - nikud present in source, rendering quality unknown

**Typst:**
- Evidence: Typst settings
  ```typst
  #set text(
    font: "Ezra SIL",
    lang: "he",
    dir: rtl,
  )
  ```
- File: `poc/out/typst/main.typ` lines ~71-75
- Warning during compilation: "unknown font family: ezra sil"
- Fallback font used (system default), unknown which font
- Visual verification: NOT PERFORMED (no PNG)
- Rating: ⚠️ PARTIAL - RTL specified, font not found, nikud quality unknown

**Next Step:**
1. Install Ezra SIL font system-wide
2. Verify font name in Typst: `typst fonts` command
3. Generate PNGs and zoom to inspect nikud placement

---

### (c) Two equal columns, right first

**Vivliostyle:**
- Evidence: CSS columns
  ```css
  .section-body {
    column-count: 2;
    column-gap: 28.35pt;
    column-fill: auto;
    text-align: justify;
  }
  ```
- File: `poc/out/vivliostyle/style.css` lines ~71-76
- RTL direction should make right column first
- Column widths: calculated as (textWidth - gap) / 2
- Visual verification: NOT PERFORMED
- Rating: ⚠️ PARTIAL - specified, RTL column order not guaranteed in all browsers

**Typst:**
- Evidence: Typst columns
  ```typst
  #columns(2, gutter: 28.35pt)[
    ...content...
  ]
  ```
- File: `poc/out/typst/main.typ` line ~107
- RTL text direction set at document level
- Column width: automatically equal
- Visual verification: NOT PERFORMED
- Rating: ✓ PASS - Typst handles RTL columns correctly (per documentation)

**Next Step:** Generate PNG and verify:
1. Two columns of equal width
2. Right column contains earlier text than left column
3. Measure column widths in pixels

---

### (d) Last column balancing (≤1 line diff)

**Vivliostyle:**
- Evidence: CSS attempted
  ```css
  column-fill: auto;  /* for normal pages */
  /* No mechanism for "balance only last page" */
  ```
- Problem: CSS `column-fill: balance` applies to all pages, not just the last
- No selective balancing mechanism
- Visual verification: NOT PERFORMED
- Rating: ❌ FAIL - no mechanism for conditional balancing

**Typst:**
- Evidence: Standard `#columns(2)` used
- Documentation: Column balancing is a known open issue in Typst
- Reference: SPEC.md section 18, Typst GitHub issues
- Visual verification: NOT PERFORMED
- Rating: ❌ FAIL - known limitation

**Next Step:**
1. Check last page of each PDF
2. Count lines in left and right columns
3. Calculate difference

---

### (e) Shared baseline grid between columns

**Vivliostyle:**
- Evidence: Line height set consistently
  ```css
  body {
    line-height: 18pt;
  }
  /* All styles use multiples of 18pt */
  ```
- Problem: Vivliostyle.js issue #1157 - baseline not synced between columns
- URL: https://github.com/vivliostyle/vivliostyle.js/issues/1157
- Visual verification: NOT PERFORMED
- Rating: ❌ FAIL - known limitation with open GitHub issue

**Typst:**
- Evidence: Leading (line spacing) set
  ```typst
  #set par(
    justify: true,
    leading: 6pt,  /* 18pt line height - 12pt font size */
  )
  ```
- Problem: No automatic baseline grid across columns
- Workaround possible: custom layout functions with grid positioning
- Visual verification: NOT PERFORMED
- Rating: ⚠️ PARTIAL - possible with custom code, not automatic

**Next Step:**
1. Generate PNG at high resolution
2. Overlay grid lines at 18pt intervals
3. Check if text baselines in both columns align to grid

---

### (f) Bold opening + window (2 lines)

**Vivliostyle:**
- Evidence: CSS attempted
  ```css
  .opening-words {
    font-weight: bold;
    float: right;
  }
  
  .has-opening::before {
    content: "";
    float: right;
    width: 80pt; /* APPROXIMATE - should match word width */
    height: calc(2 * 18pt);
    shape-outside: inset(0);
    clear: right;
  }
  ```
- File: `poc/out/vivliostyle/style.css` lines ~124-145
- Problem: Width hardcoded to 80pt, should measure actual rendered word width
- Limitation note: `/* VIVLIOSTYLE-LIMITATION: Exact window width matching bold word requires JavaScript measurement */`
- Visual verification: NOT PERFORMED
- Rating: ❌ FAIL - requires JavaScript measurement (50-100 lines)

**Typst:**
- Evidence: Function defined but incomplete
  ```typst
  #let opening-para(opening-text, rest-text, window-lines: 2) = {
    text(weight: "bold")[#opening-text]
    rest-text
    // Window effect approximation using spacing
    // Exact implementation would require measuring word width
  }
  ```
- File: `poc/out/typst/main.typ` lines ~93-98
- Problem: No word width measurement implemented
- Limitation note: `// TYPST-LIMITATION: Creating exact word-width window is complex`
- Visual verification: NOT PERFORMED
- Rating: ❌ FAIL - requires custom measurement code (80-120 lines)

**Next Step:**
1. Find paragraph with opening in PNG (first body paragraph after chapter)
2. Check if first 3 words are bold
3. Check if there's empty space below bold words
4. Measure if window width matches word width

---

### (g) Last line centered

**Vivliostyle:**
- Evidence: CSS rule
  ```css
  .body {
    text-align: justify;
    text-align-last: center;
  }
  ```
- File: `poc/out/vivliostyle/style.css` lines ~119-122
- Problem: `text-align-last: center` centers every paragraph-ending line, including those broken by column/page boundaries
- Only true paragraph ends should be centered
- Visual verification: NOT PERFORMED
- Rating: ⚠️ PARTIAL - centers all last lines, not just true paragraph ends

**Typst:**
- Evidence: No implementation
- Comment: `// TYPST-LIMITATION: Centering only the last line of a paragraph requires complex show rule`
- File: `poc/out/typst/main.typ` line ~85
- Problem: No built-in `text-align-last` equivalent
- Workaround: Custom `#show par` rule needed
- Visual verification: NOT PERFORMED
- Rating: ❌ FAIL - not implemented, requires 40-60 lines

**Next Step:**
1. Find a paragraph that ends mid-page (not at column/page break)
2. Check if last line is centered
3. Find a paragraph broken by column - check if that line is also centered (should not be)

---

### (h) Footnotes full-width with separator

**Vivliostyle:**
- Evidence: CSS footnote area
  ```css
  @page {
    @footnote {
      border-top: 1pt solid black;
      padding-top: 6pt;
      margin-top: 12pt;
      column-span: all;
    }
  }
  
  .footnote {
    float: footnote;
    font-size: 10pt;
    line-height: 14pt;
  }
  ```
- File: `poc/out/vivliostyle/style.css` lines ~19-24, ~155-160
- Attempted: `column-span: all` for full-width footnotes
- Problem: Support varies by browser, may not work in all Vivliostyle versions
- Visual verification: NOT PERFORMED
- Rating: ⚠️ PARTIAL - specified, uncertain if implemented correctly

**Typst:**
- Evidence: Standard footnote syntax
  ```typst
  #show footnote: set text(size: 10pt)
  #set footnote.entry(
    separator: line(length: 30%, stroke: 0.5pt),
    clearance: 6pt,
    gap: 4pt,
  )
  ```
- File: `poc/out/typst/main.typ` lines ~78-82
- Limitation note: `// TYPST-LIMITATION: Full-width footnotes above two-column text not supported`
- Problem: Typst places footnotes at column bottom, not spanning both columns
- Reference: Typst forum discussion cited in SPEC.md section 18
- Visual verification: NOT PERFORMED
- Rating: ❌ FAIL - architectural limitation, footnotes per column only

**Next Step:**
1. Find page with footnote
2. Check if footnote area spans full width of both columns or just one column
3. Check if there's a separator line above footnotes

---

### (i) Footnote on same page as reference

**Vivliostyle:**
- Evidence: CSS float footnote
  ```css
  .footnote {
    float: footnote;
  }
  ```
- Behavior: `float: footnote` should place footnote on same page as reference
- Standard: CSS Paged Media Module Level 3 spec
- Visual verification: NOT PERFORMED
- Rating: ⚠️ PARTIAL - should work per spec, needs verification

**Typst:**
- Evidence: Standard footnote
  ```typst
  #footnote[footnote text here]
  ```
- Behavior: Typst footnotes attempt to stay on same page
- No guarantee if space runs out
- Visual verification: NOT PERFORMED
- Rating: ⚠️ PARTIAL - best effort, no guarantee

**Next Step:**
1. Find footnote reference marker in text (superscript number)
2. Check if corresponding footnote appears at bottom of same page
3. Note page number for reference and footnote

**Test Data:**
- Footnote 1: After "אֱלֹהִים" in first paragraph (offset 17)
- Footnote 2: In second paragraph (offset 25)
- Footnote 3: At end of fifth paragraph (offset 45)

---

### (j) Long footnote continues to next page

**Vivliostyle:**
- Evidence: Footnote 2 in sample.json is long (300+ characters)
  ```json
  "fn2": {
    "text": "תהו ובהו - פירוש: תוהה ובוהה... [very long text] ...בין עמודים."
  }
  ```
- Expected: Should split across pages if doesn't fit
- CSS behavior: `float: footnote` should support continuation
- Visual verification: NOT PERFORMED
- Rating: ⚠️ UNVERIFIED - long footnote present, continuation unknown

**Typst:**
- Evidence: Same long footnote in generated .typ file
- Typst behavior: Should support multi-page footnotes
- Visual verification: NOT PERFORMED
- Rating: ⚠️ UNVERIFIED - implementation exists, continuation unknown

**Next Step:**
1. Find the long footnote (footnote 2)
2. Check if it spans multiple pages
3. Verify at least 2 lines on each page if split

---

### (k) Running headers (odd/even), gematria

**Vivliostyle:**
- Evidence: CSS page headers
  ```css
  @page :left {
    @top-left {
      content: string(chapter-title);
      font-size: 10pt;
      text-align: left;
    }
    @bottom-left {
      content: counter(page, hebrew);
      font-size: 10pt;
    }
  }
  
  @page :right {
    @top-right {
      content: "בְּרֵאשִׁית";
      font-size: 10pt;
      text-align: right;
    }
    @bottom-right {
      content: counter(page, hebrew);
      font-size: 10pt;
    }
  }
  ```
- File: `poc/out/vivliostyle/style.css` lines ~38-65
- Headers: Different for left/right pages ✓
- Page numbers: `counter(page, hebrew)` uses built-in Hebrew numbering
- Limitation: Built-in doesn't handle טו/טז special cases
- Note: `/* VIVLIOSTYLE-LIMITATION: Custom gematria (טו/טז) requires JavaScript counter-style */`
- Visual verification: NOT PERFORMED
- Rating: ⚠️ PARTIAL - headers work, gematria needs custom counter-style

**Typst:**
- Evidence: Custom gematria function + headers
  ```typst
  #let gematria(num) = {
    if num == 15 { return "ט\u{05f4}ו" }
    if num == 16 { return "ט\u{05f4}ז" }
    // ... full implementation
  }
  
  #set page(
    header: context {
      let page-num = here().page()
      if calc.even(page-num) {
        align(left)[#text("בְּרֵאשִׁית")]
      } else {
        align(right)[#text(style: "italic")[בְּרֵאשִׁית]]
      }
    },
    footer: context {
      let page-num = here().page()
      if calc.even(page-num) {
        align(left)[#gematria(page-num)]
      } else {
        align(right)[#gematria(page-num)]
      }
    },
  )
  ```
- File: `poc/out/typst/main.typ` lines ~21-63
- Headers: Different for odd/even ✓
- Gematria: Full implementation with טו/טז ✓
- Visual verification: NOT PERFORMED
- Rating: ✓ PASS - complete implementation

**Next Step:**
1. Check page 15 (if PDF is long enough, otherwise check page 1, 2)
2. Verify odd page (right) has header on right, even page (left) has header on left
3. Check if page 15 shows "טו" not "יה" (if PDF reaches 15 pages)

---

### (l) TOC with page numbers

**Vivliostyle:**
- Evidence: HTML TOC with CSS
  ```html
  <section class="toc">
    <div class="toc-entry toc-level-1">
      <a href="#ch1">בְּרֵאשִׁית</a>
      <span class="toc-leader"></span>
      <span class="toc-page"><a href="#ch1"></a></span>
    </div>
    ...
  </section>
  ```
  ```css
  .toc-page a::after {
    content: target-counter(attr(href url), page, hebrew);
  }
  ```
- File: `poc/out/vivliostyle/index.html` lines ~15-35, `style.css` lines ~102-104
- Mechanism: `target-counter()` looks up page of target element
- Visual verification: NOT PERFORMED
- Rating: ✓ PASS - standard CSS Paged Media feature, should work

**Typst:**
- Evidence: Built-in outline
  ```typst
  #outline(
    title: none,
    indent: auto,
  )
  ```
- File: `poc/out/typst/main.typ` lines ~103-106
- Mechanism: Typst automatically generates TOC from headings
- Visual verification: NOT PERFORMED
- Rating: ✓ PASS - built-in feature

**Next Step:**
1. Check first page(s) for table of contents
2. Verify entries: "בְּרֵאשִׁית" (chapter), subheadings
3. Check if page numbers appear and match actual page locations

---

### (m) Determinism

**Vivliostyle:**
- Evidence: Binary comparison test
  ```
  Run 1 SHA256: 178D0A38338CFD5A3EEB165B93B66AE254A5D6089072D9E3ED9C73347BB5F208
  Run 2 SHA256: E2B31DBB51680C05E5D25527ED0046F7A955391CA03CB5238121CFBDD0417244
  ```
- Result: Hashes DIFFER
- Files: `poc/out/vivliostyle-run1.pdf` and `poc/out/vivliostyle-run2.pdf`
- Likely cause: PDF metadata (creation timestamp) or Chromium rendering variations
- Rating: ❌ FAIL - not deterministic by default

**Typst:**
- Evidence: Binary comparison test
  ```
  Run 1 SHA256: 2E34F6C7687C80053384730060E5D7B5CBFB9D2593D0927469DE181160555150
  Run 2 SHA256: B94D498D84BF41872285F326AE3A5DB6E496A0B3869FC4BFA20C1EC803CD700D
  ```
- Result: Hashes DIFFER
- Files: `poc/out/typst-run1.pdf` and `poc/out/typst-run2.pdf`
- Unexpected: Typst claims deterministic compilation
- Possible causes: Font fallback, PDF metadata, or unknown factors
- Rating: ❌ FAIL - not deterministic in this test

**Next Step:**
1. Strip PDF metadata and retry:
   ```powershell
   # Use exiftool or similar
   exiftool -all= vivliostyle.pdf -o vivliostyle-stripped.pdf
   ```
2. Check if content streams are identical (use qpdf or similar)
3. Investigate Typst compilation flags for reproducible builds

---

## Summary Statistics

### Evidence Collected
- ✓ Generated PDFs: 6 files (2 primary + 4 determinism tests)
- ✓ Generated source: HTML, CSS, Typst files
- ✓ Determinism tests: Completed for both engines
- ❌ PNG images: 0 (conversion failed)
- ❌ Visual verification: 0 requirements fully verified
- ⚠️ Code inspection: 13 requirements verified via source code

### Verification Status
- **PASS:** 3 requirements (l, k-Typst only, c-Typst only)
- **PARTIAL:** 7 requirements (a, b, c-Viv, e-Typst, g-Viv, h-Viv, i)
- **FAIL:** 6 requirements (d, e-Viv, f, g-Typst, h-Typst, m)
- **UNVERIFIED:** 2 requirements (j - both engines)

### Limitation: Missing Visual Evidence

Due to PDF to PNG conversion failure, most requirements could only be evaluated based on:
1. Generated source code inspection (HTML/CSS, Typst)
2. Engine documentation and known limitations
3. Compilation warnings and errors
4. Binary determinism tests

**For production evaluation, visual inspection is mandatory.** The ratings above should be considered preliminary until PNG evidence is collected and each requirement is verified visually.

## Reproduction Notes

**Date:** 2025-01-XX
**Environment:** Windows 11, PowerShell, Node.js v22.16.0
**Vivliostyle CLI:** v11.3.3 (core: 2.45.1)
**Typst:** v0.15.1
**Font:** Ezra SIL specified, not confirmed installed
**Time to generate:** ~20 minutes total

**Blockers:**
1. PDF to PNG conversion via Node.js package failed
2. Font warning in Typst suggests Ezra SIL not installed or recognized
3. Manual visual inspection not completed

**Workarounds applied:**
1. Used external tool recommendations in README.md
2. Documented limitations in generated code comments
3. Performed determinism tests programmatically

---

## Recommendations for Complete Verification

1. **Install font properly:**
   ```powershell
   # Download Ezra SIL
   # Install system-wide
   # Verify: typst fonts | Select-String "Ezra"
   ```

2. **Generate PNG images:**
   ```powershell
   magick convert -density 150 out/vivliostyle.pdf out/vivliostyle-page-%d.png
   magick convert -density 150 out/typst.pdf out/typst-page-%d.png
   ```

3. **Verify each requirement manually with PNG:**
   - Open PNGs side-by-side
   - Use ruler tool to measure dimensions
   - Zoom to check nikud quality
   - Count lines in columns
   - Verify footnote placement

4. **Document findings with screenshots:**
   - Save cropped sections showing each requirement
   - Annotate with measurements
   - Update EVIDENCE.md with PNG references

5. **Check PDF metadata:**
   ```powershell
   # Using PDFtk, exiftool, or similar
   pdftk out/vivliostyle.pdf dump_data
   exiftool out/typst.pdf
   ```

6. **Test with authentic Hebrew text:**
   - Include teamim (cantillation marks)
   - Use longer document (20+ pages) to test:
     - Long footnote continuation
     - Column balancing on section ends
     - TOC page numbers accuracy
