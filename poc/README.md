# POC: Hebrew Layout Engine Evaluation

This POC evaluates Vivliostyle and Typst layout engines against requirements for professional Hebrew religious book typesetting.

## Prerequisites

### Required Software

1. **Node.js** (v22.16.0 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **npm** (comes with Node.js)
   - Verify: `npm --version`

3. **Vivliostyle CLI**
   - Install: `npm install -g @vivliostyle/cli`
   - Verify: `vivliostyle --version`

4. **Typst**
   - Install via winget: `winget install --id Typst.Typst --source winget`
   - Or download from: https://github.com/typst/typst/releases
   - Verify: `typst --version`

### Required Fonts

**Ezra SIL** (recommended) or **Taamey David CLM**

- Ezra SIL download: https://software.sil.org/ezra/
- Taamey David CLM: https://culmus.sourceforge.io/taamim/
- After download, install system-wide (right-click .ttf → Install for all users)

**Alternative:** David Libre or any Hebrew font with nikud (vowel point) support

## Project Structure

```
poc/
├── input/
│   └── sample.json          # Document model (engine-agnostic)
├── adapters/
│   ├── to-html-css.js       # Vivliostyle adapter
│   └── to-typst.js          # Typst adapter
├── out/
│   ├── vivliostyle/
│   │   ├── index.html       # Generated HTML
│   │   └── style.css        # Generated CSS
│   ├── typst/
│   │   └── main.typ         # Generated Typst file
│   ├── vivliostyle.pdf      # Output PDF
│   └── typst.pdf            # Output PDF
├── tools/
│   ├── pdf-to-png.js        # PNG converter (has issues, see notes)
│   └── verify-pdfs.ps1      # Basic PDF verification
├── RESULTS.md               # Detailed evaluation results
└── README.md                # This file
```

## Reproduction Instructions

### Step 1: Install Dependencies

```powershell
cd "c:\proyecys\layout engine\poc"
npm install
```

This installs the dev dependencies for PDF conversion (though the conversion has known issues - see Troubleshooting).

### Step 2: Generate Adapter Outputs

```powershell
# Generate HTML + CSS for Vivliostyle
node adapters\to-html-css.js

# Generate .typ file for Typst
node adapters\to-typst.js
```

**Expected output:**
- `poc/out/vivliostyle/index.html`
- `poc/out/vivliostyle/style.css`
- `poc/out/typst/main.typ`

### Step 3: Generate PDFs

```powershell
# Vivliostyle PDF
cd "c:\proyecys\layout engine\poc\out\vivliostyle"
vivliostyle build index.html -o ../vivliostyle.pdf --size B5

# Typst PDF
cd "c:\proyecys\layout engine\poc\out\typst"
typst compile main.typ ../typst.pdf
```

**Expected output:**
- `poc/out/vivliostyle.pdf`
- `poc/out/typst.pdf`

**Note:** Typst may show warning "unknown font family: ezra sil" if font is not installed or not recognized.

### Step 4: Verify PDF Generation

```powershell
cd "c:\proyecys\layout engine\poc"
.\tools\verify-pdfs.ps1
```

This checks that PDF files exist and shows their sizes.

### Step 5: Visual Inspection

Open PDFs in a viewer to check requirements:

```powershell
# Open in default PDF viewer
Start-Process "c:\proyecys\layout engine\poc\out\vivliostyle.pdf"
Start-Process "c:\proyecys\layout engine\poc\out\typst.pdf"
```

**Or use:**
- Adobe Acrobat Reader
- SumatraPDF (lightweight, Windows)
- PDF-XChange Viewer

### Step 6: Convert to PNG for Evidence (Manual)

Due to Node.js PDF conversion issues, use external tools:

#### Option A: ImageMagick

```powershell
# Install ImageMagick if needed
winget install ImageMagick.ImageMagick

# Convert PDFs
cd "c:\proyecys\layout engine\poc\out"
magick convert -density 150 vivliostyle.pdf vivliostyle-page-%d.png
magick convert -density 150 typst.pdf typst-page-%d.png
```

#### Option B: Poppler pdftoppm

```powershell
# Download poppler-utils for Windows
# From: https://github.com/oschwartz10612/poppler-windows/releases

# Convert PDFs
pdftoppm -png -r 150 vivliostyle.pdf vivliostyle-page
pdftoppm -png -r 150 typst.pdf typst-page
```

### Step 7: Determinism Test

Run each engine twice and compare outputs:

```powershell
cd "c:\proyecys\layout engine\poc\out"

# Vivliostyle
Copy-Item vivliostyle.pdf vivliostyle-run1.pdf
cd vivliostyle
vivliostyle build index.html -o ../vivliostyle-run2.pdf --size B5
cd ..

$hash1 = (Get-FileHash vivliostyle-run1.pdf).Hash
$hash2 = (Get-FileHash vivliostyle-run2.pdf).Hash
if ($hash1 -eq $hash2) {
    Write-Host "Vivliostyle: DETERMINISTIC" -ForegroundColor Green
} else {
    Write-Host "Vivliostyle: NON-DETERMINISTIC" -ForegroundColor Red
}

# Typst
Copy-Item typst.pdf typst-run1.pdf
cd typst
typst compile main.typ ../typst-run2.pdf
cd ..

$hash1 = (Get-FileHash typst-run1.pdf).Hash
$hash2 = (Get-FileHash typst-run2.pdf).Hash
if ($hash1 -eq $hash2) {
    Write-Host "Typst: DETERMINISTIC" -ForegroundColor Green
} else {
    Write-Host "Typst: NON-DETERMINISTIC" -ForegroundColor Red
}
```

## Viewing Results

**Evaluation Matrix:** See `RESULTS.md` for the complete requirements evaluation table.

**Key Files to Review:**
1. `poc/RESULTS.md` - Detailed findings and recommendation
2. `poc/out/vivliostyle.pdf` - Vivliostyle output
3. `poc/out/typst.pdf` - Typst output
4. `poc/out/vivliostyle/index.html` + `style.css` - Generated CSS
5. `poc/out/typst/main.typ` - Generated Typst source

## Requirements Checklist

Manually verify each requirement from `SPEC.md` section 18:

- [ ] (a) B5 exactly 176×250mm
- [ ] (b) Hebrew RTL with nikud and teamim
- [ ] (c) Two equal columns, right column first
- [ ] (d) Last column balancing (≤1 line difference)
- [ ] (e) Shared baseline grid between columns
- [ ] (f) Bold opening + window (2 lines height)
- [ ] (g) Last line of paragraph centered
- [ ] (h) Footnotes full-width with separator line
- [ ] (i) Footnote on same page as reference
- [ ] (j) Long footnote continues to next page
- [ ] (k) Running headers (odd/even different), gematria page numbers (טו/טז)
- [ ] (l) Table of contents with page numbers
- [ ] (m) Determinism (same input → same output)

## Troubleshooting

### Font Not Found

**Symptom:** Typst warning "unknown font family: ezra sil" or incorrect rendering

**Solution:**
1. Download Ezra SIL from https://software.sil.org/ezra/
2. Extract the .zip file
3. Right-click on `EzraSIL.ttf` → Install for all users
4. Restart terminal and try again

**Alternative:** Edit adapters to use a different font that's already installed:
- Change `font: "Ezra SIL"` to `font: "David Libre"` or other Hebrew font
- In `to-html-css.js`: line with `font-family:`
- In `to-typst.js`: line with `font: "Ezra SIL"`

### Vivliostyle Takes Long Time

**Symptom:** First run downloads Chromium (200+ MB)

**Solution:** This is normal. Vivliostyle uses Chromium for rendering. Subsequent runs will be faster.

### PDF to PNG Conversion Fails

**Symptom:** `pdf-to-img` Node.js package throws errors

**Status:** Known issue in this POC. The package API changed or has compatibility issues.

**Solution:** Use external tools (ImageMagick or Poppler pdftoppm) as documented in Step 6.

### Network Filtering Blocks Downloads

**Symptom:** npm install or winget install fails with network errors

**Solution:** This is a documented blocker per the requirements. Report the specific URLs that are blocked:
- npm registry: https://registry.npmjs.org/
- Vivliostyle CLI packages
- Typst GitHub releases: https://github.com/typst/typst/releases
- Font downloads

Do NOT bypass network filtering. Document the blocker in findings.

### PowerShell Execution Policy

**Symptom:** Cannot run `.ps1` scripts

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### PDFs Look Wrong

**Checklist:**
1. Is the Hebrew font installed system-wide?
2. Does the PDF viewer support RTL text? (Try SumatraPDF or Adobe Reader)
3. Check for warnings in the console output when generating PDFs
4. Open the intermediate files (HTML/CSS or .typ) to verify text appears correct

## Test Data Notes

**Hebrew Text Source:** Genesis 1:1-10 from the Hebrew Bible with nikud (vowel points). This is public domain text.

**Teamim (Cantillation Marks):** Not included in test data. Full evaluation would require authentic Biblical text with teamim (U+0591-U+05AF).

**Footnotes:**
- Three footnotes included
- One is intentionally long (8+ lines) to test multi-page continuation
- Content is sample commentary text

**Limitations:** The test is text-only. Real books would include:
- Chapter numbers in text
- More complex footnote scenarios
- Section dividers
- Multiple levels of headings

## Maintenance

### Updating the Document Model

Edit `poc/input/sample.json` to change test content. Follow the schema in `SPEC.md` section 4:

```json
{
  "meta": { "title": "...", "author": "...", ... },
  "styles": { "body": {...}, "chapter": {...}, ... },
  "pageSpec": { "width": 498.9, "height": 708.66, ... },
  "sections": [ {...} ],
  "notes": [ {...} ]
}
```

After editing, re-run adapters (Step 2) and regenerate PDFs (Step 3).

### Modifying Adapters

**Vivliostyle:** Edit `poc/adapters/to-html-css.js`
- HTML structure is in the `html` string
- CSS is in the `css` string
- Outputs to `poc/out/vivliostyle/`

**Typst:** Edit `poc/adapters/to-typst.js`
- Typst syntax is in the `typ` string
- Gematria function is near the top
- Outputs to `poc/out/typst/`

### Adding More Engines

To evaluate additional engines (WeasyPrint, Prince, PDFreactor, LuaLaTeX):

1. Create `poc/adapters/to-<engine-name>.js`
2. Read `poc/input/sample.json`
3. Generate engine-specific input format
4. Run engine to produce `poc/out/<engine-name>.pdf`
5. Follow Steps 4-7 above for verification
6. Add column to `poc/RESULTS.md` table

## References

- Vivliostyle: https://vivliostyle.org/
- Typst: https://typst.app/
- Ezra SIL Font: https://software.sil.org/ezra/
- SPEC.md section 18: Engine comparison and requirements
- GitHub issue for Vivliostyle baseline grid: https://github.com/vivliostyle/vivliostyle.js/issues/1157
- Typst forum on two-column footnotes: https://forum.typst.app/t/double-column-footnotes/8231

## License

This POC is part of the layout engine project. See main project LICENSE for details.

Hebrew text (Genesis) is public domain.
