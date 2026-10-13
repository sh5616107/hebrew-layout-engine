# Y-Offset Visual Verification - Manual Conversion Required

**Issue:** Automated PDF-to-PNG conversion failed (missing dependencies)  
**Required:** Manual conversion of `out/y-offset-check.pdf` to PNG at 150 DPI  
**Target:** `docs/evidence/y-offset-check.png`

---

## Option 1: ImageMagick (Recommended)

### Install
```powershell
# Via Chocolatey
choco install imagemagick

# Or download: https://imagemagick.org/script/download.php#windows
```

### Convert
```powershell
cd "c:\proyecys\layout engine\engine"
magick convert -density 150 out/y-offset-check.pdf docs/evidence/y-offset-check.png
```

---

## Option 2: Poppler (PDF utilities)

### Install
Download from: https://github.com/oschwartz10612/poppler-windows/releases

Extract to `C:\Program Files\poppler\` and add to PATH.

### Convert
```powershell
cd "c:\proyecys\layout engine\engine"
pdftoppm -png -r 150 out/y-offset-check.pdf docs/evidence/y-offset-check
```

---

## Option 3: Manual (Browser)

1. Open `out/y-offset-check.pdf` in browser
2. Zoom to 150% (approximately 150 DPI)
3. Screenshot → Save as `docs/evidence/y-offset-check.png`

---

## Option 4: Acrobat/Edge

1. Open `out/y-offset-check.pdf` in Adobe Acrobat or Edge
2. File → Export → Image → PNG
3. Set resolution: 150 DPI
4. Save to `docs/evidence/y-offset-check.png`

---

## Verification Checklist

After conversion, verify:
- [ ] File exists: `docs/evidence/y-offset-check.png`
- [ ] Resolution: ~150 DPI (check image properties)
- [ ] Visual clarity: Nikud and te'amim marks visible
- [ ] File size: Reasonable (<500KB for single page)

---

## Why This File Matters

**Purpose:** Visual evidence that Ezra SIL font uses X-offsets only (no Y-offsets) for nikud/te'amim positioning.

**Referenced in:**
- ADR-003: Ezra SIL font selection
- ADR-004: Rendering strategy
- M0-SPEC-COMPLIANCE.md: Section 12 validation

**Approval needed:** User must visually confirm that positioning is correct before M0 closure.
