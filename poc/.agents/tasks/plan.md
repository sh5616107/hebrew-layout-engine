# Implementation Plan: POC for Hebrew Layout Engine Evaluation

## Overview

This plan guides the implementation of a proof-of-concept to evaluate Vivliostyle and Typst layout engines against the requirements for a Hebrew religious book layout engine. The POC will produce concrete pass/partial/fail evidence for each requirement listed in SPEC.md section 18.

**Important constraints:**
- Windows + PowerShell environment
- Network filtering may block downloads — STOP and report if blocked, never bypass
- NEVER modify sample.json to make tests pass
- Tests pass only with visual PNG confirmation
- Use open-source Hebrew font with nikud and teamim support (Ezra SIL or Taamey David CLM)
- All file paths are absolute using `c:\proyecys\layout engine` prefix

---

## Implementation Steps

### Phase 1: Environment Setup

- [ ] 1. **Install Node.js dependencies and create project structure**
      
      Create the poc directory structure and initialize a Node.js project with the dependencies needed for the adapters.
      
      Files:
      - `c:\proyecys\layout engine\poc\package.json` (new)
      - `c:\proyecys\layout engine\poc\input\` (directory)
      - `c:\proyecys\layout engine\poc\adapters\` (directory)
      - `c:\proyecys\layout engine\poc\out\` (directory)
      
      Commands:
      ```powershell
      New-Item -Path "c:\proyecys\layout engine\poc\input" -ItemType Directory -Force
      New-Item -Path "c:\proyecys\layout engine\poc\adapters" -ItemType Directory -Force
      New-Item -Path "c:\proyecys\layout engine\poc\out" -ItemType Directory -Force
      cd "c:\proyecys\layout engine\poc"
      npm init -y
      ```
      
      Verify: Directory structure exists and package.json is created

- [ ] 2. **Install Vivliostyle CLI globally**
      
      Install the Vivliostyle CLI tool for HTML+CSS to PDF conversion. This will be used to test Paged Media CSS features.
      
      Command:
      ```powershell
      npm install -g @vivliostyle/cli
      ```
      
      Verify: Run `vivliostyle --version` and confirm it outputs a version number. If the download is blocked by network filtering, document this as a blocker in poc/RESULTS.md and mark Vivliostyle evaluation as "Cannot test - network blocked".

- [ ] 3. **Download and verify Typst binary**
      
      Download the Typst Windows binary from https://github.com/typst/typst/releases. Find the latest release and download the file ending in `-x86_64-pc-windows-msvc.zip`.
      
      Commands:
      ```powershell
      # Manual download required - visit https://github.com/typst/typst/releases
      # Download typst-x86_64-pc-windows-msvc.zip to c:\proyecys\layout engine\poc\tools\
      New-Item -Path "c:\proyecys\layout engine\poc\tools" -ItemType Directory -Force
      # After download, extract:
      Expand-Archive -Path "c:\proyecys\layout engine\poc\tools\typst-*.zip" -DestinationPath "c:\proyecys\layout engine\poc\tools\typst" -Force
      # Test:
      & "c:\proyecys\layout engine\poc\tools\typst\typst.exe" --version
      ```
      
      Verify: `typst.exe --version` outputs a version number. If the download is blocked, document this as a blocker in poc/RESULTS.md and mark Typst evaluation as "Cannot test - network blocked".

- [ ] 4. **Obtain Hebrew font with nikud and teamim support**
      
      Download Ezra SIL font (open source, SIL Open Font License) from https://software.sil.org/ezra/ or obtain Taamey David CLM from https://culmus.sourceforge.io/taamim/. Install the font locally on Windows.
      
      Commands:
      ```powershell
      # Manual download of Ezra SIL from https://software.sil.org/ezra/
      # Download the .zip file to c:\proyecys\layout engine\poc\tools\fonts\
      New-Item -Path "c:\proyecys\layout engine\poc\tools\fonts" -ItemType Directory -Force
      # After download, right-click .ttf files and select "Install" or "Install for all users"
      # Copy font files to poc/tools/fonts/ for reference in CSS/Typst:
      # Copy-Item "path\to\extracted\*.ttf" -Destination "c:\proyecys\layout engine\poc\tools\fonts\"
      ```
      
      Document in poc/RESULTS.md which font was chosen (Ezra SIL or Taamey David CLM) and the version.
      
      Verify: Font appears in Windows font list (Settings > Fonts). If download is blocked, document as blocker and continue with system default Hebrew font (note: nikud/teamim may not render correctly).

- [ ] 5. **Install PDF to PNG conversion tool**
      
      On Windows, we need a tool to convert PDF pages to PNG images for visual inspection. Options:
      - Poppler's pdftopng (from xpdf-tools)
      - ImageMagick with Ghostscript
      - Manual: Use a Node.js library like `pdf-to-img` or `pdfjs-dist`
      
      Recommended approach: Use the `pdf-to-img` npm package for programmatic conversion.
      
      Commands:
      ```powershell
      cd "c:\proyecys\layout engine\poc"
      npm install --save-dev pdf-to-img
      ```
      
      Create a helper script `c:\proyecys\layout engine\poc\tools\pdf-to-png.js` that uses this library to convert PDFs to PNG.
      
      Verify: Test with any sample PDF if available, or verify after generating the first POC PDF.

---

### Phase 2: Document Model and Sample Data

- [ ] 6. **Create sample.json with document model**
      
      Create the document model JSON file containing Genesis 1 verses with nikud (from Mechon-Mamre, public domain), formatted according to the spec in SPEC.md section 4. The model should include:
      - Document metadata (title, author, etc.)
      - Page specification (B5: 176×250mm, 2 columns, margins, line grid)
      - Style definitions (body text, headings, footnotes, etc.)
      - One section with blocks containing:
        * Chapter heading ("בראשית" / Genesis)
        * Several paragraphs from Genesis 1 with nikud (verses 1-10 minimum)
        * One paragraph with bold opening (first 2-3 words) and window specification (2 lines height)
        * Subheadings for different creation days
        * At least 3 footnotes, including one long footnote (100+ words) that will span pages
      - Table of contents entries
      
      The model is engine-agnostic. Engine-specific logic goes in adapters only.
      
      File: `c:\proyecys\layout engine\poc\input\sample.json`
      
      Key decisions:
      - Use Unicode Hebrew text with combining nikud characters (U+0591-U+05C7)
      - Footnote references as NoteRef with noteId and text offset
      - Bold opening specified via opening: { words: 3, bold: true, windowLines: 2 }
      - lastLine: "center" for last-line centering
      
      Verify: `node -e "JSON.parse(require('fs').readFileSync('c:\\proyecys\\layout engine\\poc\\input\\sample.json', 'utf8'))"` succeeds (valid JSON).

---

### Phase 3: Vivliostyle Adapter and Evaluation

- [ ] 7. **Implement to-html-css.js adapter for Vivliostyle**
      
      Create a Node.js script that reads sample.json and generates HTML + CSS suitable for Vivliostyle CLI. The adapter must translate the document model into Paged Media CSS features.
      
      Key CSS features to implement:
      - `@page { size: 176mm 250mm; }` for B5
      - `column-count: 2; column-gap: <value>; direction: rtl;` for two RTL columns
      - `@font-face` referencing the installed Hebrew font
      - Footnotes using `float: footnote` or `footnote` display type
      - Running headers with `@page :left/:right` and `string-set`
      - Centered last line: `p::last-line { text-align: center; }` (may need workaround)
      - Bold opening + window: Use `::first-line` and shape-outside or float with negative margin
      - Gematria page numbers via CSS counter with custom counter-style
      - TOC with leaders using `content: leader(dotted)`
      - Baseline grid via `line-height` (shared grid between columns is a known limitation)
      
      Files:
      - `c:\proyecys\layout engine\poc\adapters\to-html-css.js` (new)
      - `c:\proyecys\layout engine\poc\out\vivliostyle.html` (generated)
      - `c:\proyecys\layout engine\poc\out\vivliostyle.css` (generated)
      
      Command to run adapter:
      ```powershell
      cd "c:\proyecys\layout engine\poc"
      node adapters\to-html-css.js
      ```
      
      Verify: HTML and CSS files are created and HTML references CSS correctly. Open HTML in browser to check basic rendering.

- [ ] 8. **Generate PDF with Vivliostyle**
      
      Use Vivliostyle CLI to convert the HTML+CSS to PDF.
      
      Command:
      ```powershell
      cd "c:\proyecys\layout engine\poc\out"
      vivliostyle build vivliostyle.html -o vivliostyle.pdf --size 176mm,250mm
      ```
      
      File: `c:\proyecys\layout engine\poc\out\vivliostyle.pdf`
      
      Verify: PDF file is created and is approximately B5 size. Open in PDF reader to check it's not blank.

- [ ] 9. **Convert Vivliostyle PDF pages to PNG images**
      
      Convert each page of the PDF to PNG for visual inspection and evidence collection.
      
      Command (using the helper script from step 5):
      ```powershell
      cd "c:\proyecys\layout engine\poc"
      node tools\pdf-to-png.js out\vivliostyle.pdf out\vivliostyle-page
      ```
      
      Files: `c:\proyecys\layout engine\poc\out\vivliostyle-page1.png`, `vivliostyle-page2.png`, etc.
      
      Verify: PNG files exist and display page content correctly.

- [ ] 10. **Test determinism: Run Vivliostyle twice and compare**
      
      Generate PDF a second time and binary-compare with the first to verify determinism (requirement m).
      
      Commands:
      ```powershell
      cd "c:\proyecys\layout engine\poc\out"
      Copy-Item vivliostyle.pdf vivliostyle-run1.pdf
      vivliostyle build vivliostyle.html -o vivliostyle-run2.pdf --size 176mm,250mm
      # Compare:
      $hash1 = (Get-FileHash vivliostyle-run1.pdf).Hash
      $hash2 = (Get-FileHash vivliostyle-run2.pdf).Hash
      if ($hash1 -eq $hash2) { Write-Output "PASS: Deterministic" } else { Write-Output "FAIL: Non-deterministic" }
      ```
      
      Document result in poc/RESULTS.md under requirement (m).
      
      Verify: Compare command output shows pass or fail.

- [ ] 11. **Evaluate Vivliostyle against all requirements (a-m)**
      
      Manually inspect the PNG images and measure/verify each requirement. For each requirement, record pass/partial/fail with evidence (PNG filename and description).
      
      Requirements to check:
      a. B5 exactly 176×250mm: Check PDF properties or measure in image
      b. Hebrew RTL with nikud and teamim: Visual inspection of text rendering
      c. Two equal columns, right first: Measure column widths, check text flow
      d. Last column balancing (≤1 line diff): Check final page
      e. Shared baseline grid between columns: Overlay grid, check alignment
      f. Bold opening + window (2 lines): Check first paragraph
      g. Last line centered: Check paragraph endings
      h. Footnotes full-width with separator: Check footnote area
      i. Footnote on same page as reference: Check superscript and footnote location
      j. Long footnote continues to next page: Check multi-page footnote
      k. Running headers (odd/even differ), gematria (טו/טז): Check page headers
      l. TOC with page numbers: Check TOC section
      m. Determinism: (done in step 10)
      
      For each failure, document what was tried and what workaround would be needed (with estimated lines of code).
      
      Update `c:\proyecys\layout engine\poc\RESULTS.md` with Vivliostyle column.
      
      Verify: RESULTS.md contains complete Vivliostyle evaluation.

- [ ] 12. **Attempt to extract breakpoints from Vivliostyle**
      
      Investigate if line and page breakpoints can be extracted from Vivliostyle's rendering. Vivliostyle renders via Chrome/Chromium, so DOM inspection might be possible using the Chrome DevTools Protocol or by examining the intermediate HTML.
      
      Approach:
      - Check if Vivliostyle CLI has a debug/inspect mode
      - Try generating HTML with `--verbose` or `--debug` flags
      - Check if DOM structure preserves line break information
      - Document findings: feasible or not, how much code would be required
      
      Document findings in poc/RESULTS.md in a "Breakpoint Extraction" section.
      
      Verify: RESULTS.md documents breakpoint extraction feasibility for Vivliostyle.

---

### Phase 4: Typst Adapter and Evaluation

- [ ] 13. **Implement to-typst.js adapter**
      
      Create a Node.js script that reads sample.json and generates a .typ file for Typst. Typst has built-in support for columns, footnotes, RTL, and many layout features.
      
      Key Typst features to implement:
      - `#set page(width: 176mm, height: 250mm, margin: ...)` for B5
      - `#set text(font: "Ezra SIL", dir: rtl, lang: "he")` for Hebrew with nikud
      - `#columns(2)[...]` for two-column layout
      - `#footnote[...]` for footnotes
      - Headers/footers with `header: [...]` and page numbering
      - Custom numbering function for gematria (including טו/טז special cases)
      - Bold text with `*...*` and paragraph styling
      - Centered last line: May need custom show rule for paragraphs
      - Window below bold opening: Shape exclusion or spacer (investigate Typst's capabilities)
      - TOC via `#outline()`
      
      Files:
      - `c:\proyecys\layout engine\poc\adapters\to-typst.js` (new)
      - `c:\proyecys\layout engine\poc\out\typst-input.typ` (generated)
      
      Command to run adapter:
      ```powershell
      cd "c:\proyecys\layout engine\poc"
      node adapters\to-typst.js
      ```
      
      Verify: .typ file is created and is valid Typst syntax (no obvious syntax errors when opened in text editor).

- [ ] 14. **Generate PDF with Typst**
      
      Use Typst compiler to generate PDF from the .typ file.
      
      Command:
      ```powershell
      cd "c:\proyecys\layout engine\poc\out"
      & "..\tools\typst\typst.exe" compile typst-input.typ typst.pdf
      ```
      
      File: `c:\proyecys\layout engine\poc\out\typst.pdf`
      
      Verify: PDF file is created without errors. Open in PDF reader to check it's not blank.

- [ ] 15. **Convert Typst PDF pages to PNG images**
      
      Convert each page of the Typst PDF to PNG for visual inspection.
      
      Command:
      ```powershell
      cd "c:\proyecys\layout engine\poc"
      node tools\pdf-to-png.js out\typst.pdf out\typst-page
      ```
      
      Files: `c:\proyecys\layout engine\poc\out\typst-page1.png`, `typst-page2.png`, etc.
      
      Verify: PNG files exist and display page content correctly.

- [ ] 16. **Test determinism: Run Typst twice and compare**
      
      Generate PDF a second time and binary-compare with the first to verify determinism.
      
      Commands:
      ```powershell
      cd "c:\proyecys\layout engine\poc\out"
      Copy-Item typst.pdf typst-run1.pdf
      & "..\tools\typst\typst.exe" compile typst-input.typ typst-run2.pdf
      $hash1 = (Get-FileHash typst-run1.pdf).Hash
      $hash2 = (Get-FileHash typst-run2.pdf).Hash
      if ($hash1 -eq $hash2) { Write-Output "PASS: Deterministic" } else { Write-Output "FAIL: Non-deterministic" }
      ```
      
      Document result in poc/RESULTS.md under requirement (m).
      
      Verify: Compare command output shows pass or fail.

- [ ] 17. **Evaluate Typst against all requirements (a-m)**
      
      Manually inspect the PNG images and measure/verify each requirement. For each requirement, record pass/partial/fail with evidence.
      
      Requirements to check: (same as step 11)
      a. B5 exactly 176×250mm
      b. Hebrew RTL with nikud and teamim
      c. Two equal columns, right first
      d. Last column balancing (≤1 line diff)
      e. Shared baseline grid between columns
      f. Bold opening + window (2 lines)
      g. Last line centered
      h. Footnotes full-width with separator
      i. Footnote on same page as reference
      j. Long footnote continues to next page
      k. Running headers (odd/even differ), gematria
      l. TOC with page numbers
      m. Determinism
      
      Known issues from SPEC.md section 18:
      - Footnotes in two columns above single-column text: Not supported per Typst forum
      - Column balancing: Open issue in Typst
      
      Document each finding in poc/RESULTS.md with Typst column, including workarounds attempted and effort estimate.
      
      Verify: RESULTS.md contains complete Typst evaluation.

- [ ] 18. **Attempt to extract breakpoints from Typst**
      
      Investigate Typst's introspection API for extracting line and page break information.
      
      Approach:
      - Check Typst documentation for introspection functions: `locate()`, `query()`, metadata
      - Try querying layout information from within the .typ file
      - Investigate if Typst can output structured layout data (JSON, XML)
      - Document findings: feasible or not, API details, code estimate
      
      Document findings in poc/RESULTS.md in "Breakpoint Extraction" section.
      
      Verify: RESULTS.md documents breakpoint extraction feasibility for Typst.

---

### Phase 5: Documentation and Results

- [ ] 19. **Create comprehensive RESULTS.md**
      
      Compile all evaluation results into a structured markdown document with:
      - Executive summary: Can either engine serve as a base? Which is closer?
      - Requirements matrix (table): Requirement × Engine with Pass/Partial/Fail
      - For each failed/partial requirement:
        * What was tried (specific CSS/Typst code)
        * Why it failed (engine limitation, CSS support, etc.)
        * Workaround needed (description and estimated LOC for custom code)
        * Evidence: reference to PNG files showing the issue
      - Breakpoint extraction section: feasibility for each engine
      - Font used: Ezra SIL or Taamey David CLM, version, nikud quality assessment
      - Blockers encountered (network filtering, missing tools, etc.)
      - Recommendation: Which path forward (CSS engine, Typst, custom, or hybrid)
      
      File: `c:\proyecys\layout engine\poc\RESULTS.md`
      
      Verify: RESULTS.md exists and contains the complete evaluation matrix and analysis.

- [ ] 20. **Create POC README.md with reproduction instructions**
      
      Write clear documentation for reproducing the POC evaluation, including all PowerShell commands, prerequisites, and expected outputs.
      
      Sections:
      - Prerequisites: Node.js, npm, fonts, tools
      - Directory structure
      - Step-by-step reproduction commands (PowerShell)
      - How to interpret results
      - Troubleshooting common issues
      
      File: `c:\proyecys\layout engine\poc\README.md`
      
      Verify: README.md exists and someone else could reproduce the evaluation by following it.

- [ ] 21. **Archive evidence files and create comparison sheet**
      
      Organize all output files (PDFs, PNGs) and create a visual comparison document or spreadsheet linking each requirement to its evidence files.
      
      Create `c:\proyecys\layout engine\poc\EVIDENCE.md` listing:
      - Requirement (a) → vivliostyle-page1.png, typst-page1.png, notes
      - Requirement (b) → vivliostyle-page1.png (zoom), typst-page1.png (zoom), nikud quality notes
      - ... (for all requirements)
      
      Verify: EVIDENCE.md provides clear mapping from requirements to visual proof.

---

## Key Decisions and Rationale

### Font Choice
**Decision:** Use Ezra SIL as primary choice, Taamey David CLM as fallback.
**Rationale:** Both are open source with SIL OFL license, both support Biblical Hebrew with nikud and teamim. Ezra SIL is based on BHS typography which is the scholarly standard. Will document actual choice made during implementation.

### PDF to PNG Conversion
**Decision:** Use Node.js `pdf-to-img` package rather than external tools.
**Rationale:** Windows environment makes native tools harder (pdftoppm requires poppler installation). Node.js solution is self-contained and already have Node.js installed. Network filtering may block external tool downloads.

### Document Model Structure
**Decision:** Engine-agnostic JSON matching SPEC.md section 4 structure.
**Rationale:** Keeps adapters focused on translation, not data modeling. Allows fair comparison since both engines work from same source. Models the future architecture where document model is separate from layout engine.

### Sample Content
**Decision:** Genesis 1 verses 1-10 from Mechon-Mamre with nikud.
**Rationale:** Public domain, authentic Biblical Hebrew with nikud (not fabricated), sufficient length to test multi-page and footnote continuation, familiar text for verification.

### Window Implementation Approach
**Decision:** Try CSS shape-outside for Vivliostyle, custom spacer or shape for Typst.
**Rationale:** Window (empty box below bold word) is unusual feature. CSS shape-outside or float with negative margin most likely approach. Typst may need positioned content or custom layout. This requirement likely to be "partial" or "fail" for both engines - document workaround complexity.

### Baseline Grid Testing
**Decision:** Overlay measurement grid on PNG, measure vertical positions.
**Rationale:** Baseline grid alignment (requirement e) is a known Vivliostyle limitation per SPEC.md. Visual measurement with grid overlay is most reliable test method. Use image editor or script to overlay grid at specified line-height intervals.

### Gematria Numbering
**Decision:** Implement custom counter style for CSS, custom function for Typst.
**Rationale:** Hebrew numbering with special cases for 15 (ט״ו not י״ה) and 16 (ט״ז not י״ו) requires custom logic. CSS `@counter-style` allows this. Typst uses custom numbering function. Both should be able to handle this.

---

## Verification Strategy

Each step includes a verification command or criterion. The overall POC is verified by:

1. **Completeness:** All files in poc/ structure exist
2. **Executability:** README.md commands successfully reproduce the PDFs
3. **Evidence:** PNG files exist for all pages of both PDFs
4. **Evaluation:** RESULTS.md contains Pass/Partial/Fail for all 13 requirements (a-m) for both engines
5. **Traceability:** Each evaluation judgment is backed by PNG reference and explanation

The final deliverable is poc/RESULTS.md with the requirements matrix showing which engine (if any) meets the Hebrew book layout requirements, and what custom development would be needed for failed requirements.

---

## Risks and Mitigation

**Risk: Network filtering blocks downloads**
- Mitigation: Document blockers immediately. For fonts, test with system Hebrew font. For tools, note limitation in RESULTS.md and mark engine as "Cannot evaluate".

**Risk: Neither engine supports critical requirements**
- Mitigation: This is expected per SPEC.md. Goal is to document gaps with evidence, not to declare success. Workaround estimates guide the build-vs-buy decision.

**Risk: Hebrew nikud renders incorrectly**
- Mitigation: Font choice is critical. Visual inspection in step 11b/17b specifically checks nikud quality. If poor, try alternate font or document font limitation.

**Risk: Time-consuming manual PNG inspection**
- Mitigation: Requirements are specific and visual. Inspection is one-time. Document findings clearly so they inform the final architecture decision.

---

## Expected Outcome

At completion, poc/RESULTS.md will show:
- Which requirements each engine passes/fails
- Estimated LOC for custom code needed to fill gaps
- Breakpoint extraction feasibility
- Clear recommendation: Use Vivliostyle, use Typst, or build custom layout engine

This evidence-based evaluation directly informs the decision in SPEC.md section 17 (implementation language and architecture) and section 18 (whether to base on existing engines).
