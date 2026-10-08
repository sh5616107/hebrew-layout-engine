# POC: Hebrew Book Layout Engine Evaluation

## Overview

This POC evaluates Vivliostyle (HTML+CSS) and Typst as potential base engines for a Hebrew religious book layout system. The goal is to determine whether either engine can meet the requirements specified in `../docs/SPEC.md`, or whether a custom engine is needed.

## Prerequisites

### Required

1. **Node.js and npm** (tested with Node.js v22.16.0, npm 11.4.2)
   - Download: https://nodejs.org/

2. **Vivliostyle CLI** (tested with v11.3.3)
   ```powershell
   npm install -g @vivliostyle/cli
   ```

3. **Typst** (tested with v0.15.1)
   - Download: https://github.com/typst/typst/releases
   - Extract typst.exe to a directory in your PATH, or use full path

4. **Hebrew Font with Nikud Support**
   - Tested with: **David** (Windows system font)
   - Recommended: **Ezra SIL** (https://software.sil.org/ezra/)
   - Alternative: **Taamey David CLM** (https://culmus.sourceforge.io/taamim/)

### Optional (for PNG generation)

5. **ImageMagick** or **Poppler utils** (for PDF to PNG conversion)
   - ImageMagick: https://imagemagick.org/
   - Poppler: https://github.com/oschwartz10612/poppler-windows/releases

## Directory Structure

```
poc/
├── input/
│   └── sample.json          # Document model (Genesis 1 with nikud)
├── adapters/
│   ├── to-html-css.js       # Generates HTML+CSS for Vivliostyle
│   └── to-typst.js          # Generates .typ file for Typst
├── vivliostyle/
│   ├── index.html           # Generated HTML
│   └── style.css            # Generated CSS
├── typst/
│   └── main.typ             # Generated Typst source
├── out/
│   ├── vivliostyle.pdf      # Vivliostyle output
│   ├── typst.pdf            # Typst output
│   └── *.png                # PNG evidence files (if generated)
├── tools/
│   └── pdf-to-png.js        # Helper script for PNG generation
├── RESULTS.md               # Evaluation findings
└── README.md                # This file
```

## Quick Start

### 1. Generate Layout Files

Run the adapters to create HTML+CSS and Typst source from the document model:

```powershell
cd "c:\proyecys\layout engine\poc"
node adapters\to-html-css.js
node adapters\to-typst.js
```

**Expected output:**
```
✓ Generated HTML and CSS for Vivliostyle
  HTML: C:\proyecys\layout engine\poc\vivliostyle\index.html
  CSS: C:\proyecys\layout engine\poc\vivliostyle\style.css
✓ Generated Typst source
  File: C:\proyecys\layout engine\poc\typst\main.typ
```

### 2. Build PDFs

**Vivliostyle:**
```powershell
vivliostyle build vivliostyle\index.html -o out\vivliostyle.pdf --size 176mm,250mm
```

**Typst:**
```powershell
typst compile typst\main.typ out\typst.pdf
```

### 3. View Results

Open the PDFs:
```powershell
Start-Process out\vivliostyle.pdf
Start-Process out\typst.pdf
```

### 4. (Optional) Generate PNG Evidence Files

If you have ImageMagick installed:

```powershell
# Vivliostyle
magick convert -density 150 out\vivliostyle.pdf out\vivliostyle-page-%d.png

# Typst
magick convert -density 150 out\typst.pdf out\typst-page-%d.png
```

If you have Poppler utils:

```powershell
# Vivliostyle
pdftoppm -r 150 -png out\vivliostyle.pdf out\vivliostyle-page

# Typst
pdftoppm -r 150 -png out\typst.pdf out\typst-page
```

### 5. Test Determinism

Run each engine twice and compare hashes:

```powershell
# Vivliostyle
Copy-Item out\vivliostyle.pdf out\vivliostyle-run1.pdf
vivliostyle build vivliostyle\index.html -o out\vivliostyle-run2.pdf --size 176mm,250mm
$hash1 = (Get-FileHash out\vivliostyle-run1.pdf).Hash
$hash2 = (Get-FileHash out\vivliostyle-run2.pdf).Hash
if ($hash1 -eq $hash2) { Write-Output "PASS: Deterministic" } else { Write-Output "FAIL: Non-deterministic" }

# Typst
Copy-Item out\typst.pdf out\typst-run1.pdf
typst compile typst\main.typ out\typst-run2.pdf
$hash3 = (Get-FileHash out\typst-run1.pdf).Hash
$hash4 = (Get-FileHash out\typst-run2.pdf).Hash
if ($hash3 -eq $hash4) { Write-Output "PASS: Deterministic" } else { Write-Output "FAIL: Non-deterministic" }
```

## Evaluation Checklist

Use the generated PDFs (or PNGs if available) to verify each requirement:

### a. Page Size: B5 (176×250mm)

**Check:** PDF properties or ruler measurement

**Pass criteria:** Exactly 176mm wide × 250mm tall

### b. Hebrew RTL with Nikud and Teamim

**Check:** Zoom into text and inspect character placement

**Pass criteria:** 
- Text flows right-to-left
- Nikud marks appear above/below correct letters
- Teamim marks positioned correctly
- No overlapping characters

### c. Two Equal Columns, Right Column First

**Check:** Measure column widths, trace text flow

**Pass criteria:**
- Exactly 2 columns of equal width
- Text starts in right column, continues to left column
- Column gap visible between them

### d. Last Column Balancing (≤1 Line Difference)

**Check:** Final page of document

**Pass criteria:**
- On the last page, both columns end within 1 line of each other
- No large white space at bottom of one column

### e. Shared Baseline Grid Between Columns

**Check:** Overlay a grid at line-height intervals (14pt for body text)

**Pass criteria:**
- Lines in left and right columns align horizontally
- Baselines sit on same horizontal position across columns

**Known issue:** Vivliostyle limitation #1157

### f. Bold Opening + Window (2 Lines)

**Check:** First content paragraph (block-2 in sample.json)

**Pass criteria:**
- First 3 words are bold and slightly larger
- Empty rectangular space below the bold words
- Space is exactly width of bold words, 2 lines tall
- Text wraps around the space

**Known issue:** Window not implemented in either engine (bold only)

### g. Last Line of Paragraph Centered

**Check:** End of each paragraph

**Pass criteria:**
- Only the final line of each paragraph is centered
- Other lines are justified
- Works correctly even if paragraph ends mid-column

**Known issue:** Typst lacks this feature

### h. Footnotes Full-Width with Separator

**Check:** Bottom of pages with footnotes

**Pass criteria:**
- Footnotes appear below both columns (not at bottom of each column individually)
- Horizontal line separates footnotes from body text
- Footnotes span full page width

**Known issue:** Typst places footnotes per-column, not full-width

### i. Footnote on Same Page as Reference

**Check:** Pages with superscript footnote markers

**Pass criteria:**
- Footnote marker (superscript number) appears in body text
- Corresponding footnote text appears on same page (at least first 2 lines)

### j. Long Footnote Continues to Next Page

**Check:** Note-3 (longest footnote in sample)

**Pass criteria:**
- If footnote doesn't fit on one page, it continues to next
- Continuation is clearly visible
- No footnote text is lost

### k. Running Headers with Odd/Even, Gematria Numbering

**Check:** Top of each page

**Pass criteria:**
- Odd pages (right side): `<gematria> | בראשית`
- Even pages (left side): `בראשית | <gematria>`
- Page numbers in Hebrew letters (א, ב, ג...)
- Special cases: 15 = טו (not יה), 16 = טז (not יו)

### l. Table of Contents with Page Numbers

**Check:** Not implemented in sample

**Note:** Both engines support TOC, but sample focuses on body layout

### m. Determinism

**Check:** SHA256 hash of two PDF runs (see test script above)

**Pass criteria:** Hashes are identical

**Known issue:** Both engines embed timestamps, causing hash mismatch

## Interpreting Results

After visual inspection, update `RESULTS.md` with:
- PASS, PARTIAL, or FAIL for each requirement
- Screenshot or PNG reference showing evidence
- Description of any issues observed

## Document Model Structure

The `sample.json` file follows the schema from SPEC.md section 4:

```json
{
  "meta": { "title", "subtitle", "author", ... },
  "styles": { "body", "heading1", "heading2", "footnote" },
  "pageSpec": { "width", "height", "margins", "columns", "baselineGrid" },
  "sections": [
    {
      "kind": "body",
      "blocks": [
        {
          "id": "block-1",
          "style": "heading1",
          "runs": [ { "text": "..." } ],
          "noteRefs": [ { "noteId", "offset" } ],
          "flags": { "opening": { "words": 3, "bold": true, "windowLines": 2 } }
        },
        ...
      ]
    }
  ],
  "notes": [
    { "id": "note-1", "kind": "foot", "blocks": [...] },
    ...
  ]
}
```

**Text content:** Authentic Genesis 1:1-10 with nikud from Mechon-Mamre (public domain). No fabricated Torah text.

## Adapter Architecture

Both adapters follow the same pattern:

1. **Read** `input/sample.json`
2. **Transform** document model to engine-specific format:
   - `to-html-css.js` → HTML with CSS Paged Media features
   - `to-typst.js` → Typst markup language
3. **Write** output files to `vivliostyle/` or `typst/`
4. **Document** limitations in code comments

**Engine-agnostic:** All layout logic is in the document model. Adapters only translate syntax.

## Limitations and Known Issues

### Vivliostyle

1. **Baseline grid alignment between columns** - Known limitation (#1157)
   - CSS sets uniform line-height but cross-column alignment not guaranteed
   - Workaround: Custom CSS Grid layout (200-400 LOC)

2. **Window below opening words** - Complex shape-outside for RTL
   - Requires JavaScript measurement + CSS shape generation
   - Workaround: 150-250 LOC

### Typst

1. **Footnotes in two-column layout** - Per-column only, not full-width
   - Forum discussion: https://forum.typst.app/t/double-column-footnotes/8231
   - Workaround: Manual footnote system (300-500 LOC)

2. **Last line centering** - No `text-align-last` equivalent
   - Workaround: Custom paragraph show rule (150-300 LOC)

3. **Column balancing** - Open issue in Typst
   - May not balance final columns to ≤1 line difference

### Both Engines

1. **Non-deterministic output** - PDFs contain timestamps
   - Binary comparison fails even with identical layout
   - Workaround: Strip PDF metadata or compare visual content only

2. **Font availability** - David font lacks full teamim support
   - Recommendation: Install Ezra SIL or Taamey David CLM

## Troubleshooting

### "vivliostyle: command not found"

Install Vivliostyle CLI globally:
```powershell
npm install -g @vivliostyle/cli
```

### "typst: command not found"

Download Typst binary and add to PATH, or use full path:
```powershell
& "C:\path\to\typst.exe" compile typst\main.typ out\typst.pdf
```

### "unknown font family: Ezra SIL"

The font is not installed. Either:
1. Install Ezra SIL from https://software.sil.org/ezra/
2. Adapters fall back to "David" (Windows system font)
3. Edit adapters to use a different installed Hebrew font

### Nikud or teamim not rendering correctly

Check font support:
1. Open font in Windows Font Viewer
2. Search for Unicode range U+0591–U+05C7
3. If missing, install Ezra SIL or Taamey David CLM

### PDF is blank or has errors

Check adapter output for error messages:
```powershell
node adapters\to-html-css.js
# Look for errors
```

Validate JSON:
```powershell
node -e "JSON.parse(require('fs').readFileSync('input/sample.json', 'utf8'))"
```

### Network download blocked

Per project requirements, STOP and report:
- Do not bypass network filtering
- Document which downloads were blocked in RESULTS.md
- Mark affected engine evaluations as "Cannot test - network blocked"

## Next Steps

After completing this POC evaluation:

1. **Review `RESULTS.md`** for detailed findings
2. **Make decision:** Use Vivliostyle, use Typst, or build custom engine
3. **If custom engine:** Proceed to SPEC.md sections 16-17 (milestones and implementation)
4. **If using existing engine:** Implement workarounds for failed requirements

## References

- **Project spec:** `../docs/SPEC.md`
- **Vivliostyle docs:** https://docs.vivliostyle.org/
- **Typst docs:** https://typst.app/docs/
- **HarfBuzz (for custom engine):** https://harfbuzz.github.io/
- **Knuth-Plass algorithm:** DEK's "Breaking Paragraphs into Lines" paper

## License and Attribution

- **Genesis text:** Public domain (Mechon-Mamre)
- **David font:** Microsoft Windows system font
- **Ezra SIL:** SIL Open Font License
- **Vivliostyle:** AGPL v3
- **Typst:** Apache 2.0

---

**POC Version:** 1.0  
**Date:** October 2026  
**Status:** Evaluation complete, visual verification pending
