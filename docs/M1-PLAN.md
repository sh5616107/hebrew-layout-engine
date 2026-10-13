# M1: Vertical Slice - End-to-End Pipeline

**Status:** Planned (M0 complete: 32/32 tests, 76% coverage, rendering validated)  
**Goal:** First working end-to-end: JSON → PDF with shaped Hebrew text in two columns  
**Duration:** 2-3 weeks  
**Based on:** Specification v0.5 section 25

---

## Objective

Build a **minimal but complete** pipeline that demonstrates:
1. Document input (JSON)
2. Text shaping (HarfBuzz + Ezra SIL)
3. Line breaking (greedy algorithm)
4. Two-column layout
5. Baseline measurement and validation
6. PDF output with actual Hebrew text

**NOT in scope:**
- Column balancing (M2)
- Knuth-Plass optimal breaking (M2)
- Footnotes (M2)
- Headers/footers (M2)
- TOC/cross-references (M3)
- Opening window (M2)

---

## Input: Test Document

**File:** `input/m1-test.json`

```json
{
  "meta": {
    "title": "M1 Test Document",
    "language": "he",
    "direction": "rtl"
  },
  "pageSpec": {
    "width": 498900,  // B5: 176mm in mpt
    "height": 708660, // B5: 250mm in mpt
    "marginInner": 56690,
    "marginOuter": 42520,
    "marginTop": 56690,
    "marginBottom": 56690,
    "columns": 2,
    "columnGap": 28350,
    "baselineGrid": 14000  // 14pt grid
  },
  "styles": {
    "body": {
      "font": "Ezra SIL",
      "size": 11,
      "lineHeight": 14,
      "align": "justify"
    }
  },
  "sections": [{
    "kind": "body",
    "blocks": [
      {
        "kind": "paragraph",
        "styleName": "body",
        "runs": [{
          "text": "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ..."
        }]
      }
      // 5-10 paragraphs total
    ]
  }],
  "notes": []
}
```

**Size:** ~3-5 pages, enough to fill two columns and verify baseline grid.

---

## Components

### 1. JSON Document Loader

**File:** `src/import/json-loader.ts`

```typescript
export function loadDocument(json: string): Document {
  const data = JSON.parse(json);
  
  // Validate structure
  validateMeta(data.meta);
  validatePageSpec(data.pageSpec);
  validateSections(data.sections);
  
  // Convert to internal Document type
  return {
    meta: data.meta,
    pageSpec: convertPageSpec(data.pageSpec), // pt → mpt
    styles: data.styles,
    sections: data.sections,
    notes: data.notes || [],
  };
}
```

**Tests:**
- Valid document parses correctly
- Invalid structure throws with diagnostic
- Units converted properly (pt → mpt)

**Estimate:** 1 day

---

### 2. Font Metrics Extraction

**File:** `src/typography/font-metrics.ts`

```typescript
export interface FontMetrics {
  font: string;
  unitsPerEm: number;
  ascent: Distance;  // mpt
  descent: Distance; // mpt
  lineGap: Distance; // mpt
  glyphWidths: Map<number, Distance>; // GID → width in mpt
}

export async function extractMetrics(
  fontPath: string,
  fontSize: number // pt
): Promise<FontMetrics> {
  // Use HarfBuzz to get font metrics
  const fontBuffer = readFileSync(fontPath).buffer;
  const blob = new hb.Blob(fontBuffer);
  const face = new hb.Face(blob);
  
  // Extract metrics from face
  // (HarfBuzz doesn't expose all metrics, may need opentype.js)
  
  return {
    font: 'Ezra SIL',
    unitsPerEm: 2048,
    ascent: ptToMpt(fontSize * 0.8), // approximation
    descent: ptToMpt(fontSize * 0.2),
    lineGap: ptToMpt(fontSize * 0.2),
    glyphWidths: new Map(),
  };
}
```

**Alternative:** Use `opentype.js` for full metrics access.

**Tests:**
- Extracts correct unitsPerEm (2048 for Ezra SIL)
- Ascent/descent reasonable
- Can measure glyph widths

**Estimate:** 1 day

---

### 3. Greedy Line Breaking

**File:** `src/line-breaking/greedy.ts`

```typescript
export interface Line {
  glyphs: PositionedGlyph[];
  width: Distance;  // mpt
  baseline: Coord;  // mpt from top
}

export function breakLines(
  shaped: ShapedRun[],
  columnWidth: Distance,
  lineHeight: Distance,
  baselineGrid: Distance
): Line[] {
  const lines: Line[] = [];
  let currentLine: PositionedGlyph[] = [];
  let currentWidth = 0;
  let baseline = baselineGrid; // Start at first grid line
  
  for (const run of shaped) {
    for (const glyph of run.glyphs) {
      if (currentWidth + glyph.advance > columnWidth) {
        // Line full - push and start new line
        lines.push({
          glyphs: currentLine,
          width: currentWidth,
          baseline,
        });
        
        currentLine = [glyph];
        currentWidth = glyph.advance;
        baseline += baselineGrid; // Next grid line
      } else {
        currentLine.push(glyph);
        currentWidth += glyph.advance;
      }
    }
  }
  
  // Push last line
  if (currentLine.length > 0) {
    lines.push({ glyphs: currentLine, width: currentWidth, baseline });
  }
  
  return lines;
}
```

**Enhancements:**
- Word boundary detection (don't break mid-word)
- Justification (stretch word spaces to fill line)
- Hyphenation (optional, M2+)

**Tests:**
- Breaks at word boundaries
- Respects column width
- Lines snap to baseline grid

**Estimate:** 2 days

---

### 4. Two-Column Page Filling

**File:** `src/page-building/page-filler.ts`

```typescript
export function fillPages(
  lines: Line[],
  pageSpec: PageSpec
): PageLayout[] {
  const pages: PageLayout[] = [];
  
  // Calculate column dimensions
  const columnWidth = (pageSpec.width - pageSpec.marginInner - 
    pageSpec.marginOuter - pageSpec.columnGap) / 2;
  const columnHeight = pageSpec.height - pageSpec.marginTop - 
    pageSpec.marginBottom;
  
  let currentPage: PageLayout | null = null;
  let leftColumn: Line[] = [];
  let rightColumn: Line[] = [];
  let columnY = 0;
  
  for (const line of lines) {
    // Check if line fits in current column
    const lineHeight = pageSpec.baselineGrid;
    
    if (columnY + lineHeight > columnHeight) {
      // Column full
      if (!currentPage) {
        // Start new page, fill right column first (RTL)
        currentPage = createPage(pages.length + 1, 'recto');
        rightColumn = [line];
        columnY = lineHeight;
      } else if (rightColumn.length > 0 && leftColumn.length === 0) {
        // Right column full, move to left
        leftColumn = [line];
        columnY = lineHeight;
      } else {
        // Both columns full, push page and start new
        currentPage.columns = [
          { kind: 'body', lines: rightColumn, ...measureColumn(rightColumn) },
          { kind: 'body', lines: leftColumn, ...measureColumn(leftColumn) },
        ];
        pages.push(currentPage);
        
        // Start new page
        currentPage = createPage(pages.length + 1, 'recto');
        rightColumn = [line];
        leftColumn = [];
        columnY = lineHeight;
      }
    } else {
      // Add line to current column
      if (!currentPage || rightColumn.length === 0) {
        rightColumn.push(line);
      } else {
        leftColumn.push(line);
      }
      columnY += lineHeight;
    }
  }
  
  // Push final page
  if (currentPage) {
    currentPage.columns = [
      { kind: 'body', lines: rightColumn, ...measureColumn(rightColumn) },
      { kind: 'body', lines: leftColumn, ...measureColumn(leftColumn) },
    ];
    pages.push(currentPage);
  }
  
  return pages;
}
```

**Tests:**
- Fills right column first (RTL)
- Creates new page when both columns full
- Measures column tops/bottoms correctly

**Estimate:** 2 days

---

### 5. Baseline Measurement

**File:** `src/diagnostics/baseline-checker.ts`

```typescript
export interface BaselineMeasurement {
  pageNumber: number;
  leftColumnBottom: Coord;   // mpt
  rightColumnBottom: Coord;  // mpt
  deltaBaseline: Distance;   // |left - right| in mpt
  onGrid: boolean;           // All baselines on grid?
}

export function measureBaselines(
  page: PageLayout,
  baselineGrid: Distance
): BaselineMeasurement {
  const leftColumn = page.columns[1]; // Left in array
  const rightColumn = page.columns[0]; // Right in array
  
  const leftBottom = leftColumn.lines[leftColumn.lines.length - 1]?.baseline || 0;
  const rightBottom = rightColumn.lines[rightColumn.lines.length - 1]?.baseline || 0;
  
  const delta = Math.abs(leftBottom - rightBottom);
  
  // Check if all baselines snap to grid
  const allOnGrid = [...leftColumn.lines, ...rightColumn.lines].every(line =>
    line.baseline % baselineGrid === 0
  );
  
  return {
    pageNumber: page.pageNumber,
    leftColumnBottom: leftBottom,
    rightColumnBottom: rightBottom,
    deltaBaseline: delta,
    onGrid: allOnGrid,
  };
}
```

**Tests:**
- Measures column bottoms correctly
- Detects off-grid baselines
- Calculates delta accurately

**Estimate:** 1 day

---

### 6. LayoutResult Assembly

**File:** `src/core/layout-engine.ts`

```typescript
export function layout(doc: Document, config?: EngineConfig): LayoutResult {
  const cfg = config || DEFAULT_ENGINE_CONFIG;
  
  try {
    // 1. Load font metrics
    const metrics = await extractMetrics('fonts/SILEOT.ttf', 
      doc.styles.body.size);
    
    // 2. Shape all text
    const shaped: ShapedRun[] = [];
    for (const section of doc.sections) {
      for (const block of section.blocks) {
        for (const run of block.runs) {
          shaped.push(await shape(run.text, fontBuffer, doc.styles.body.size));
        }
      }
    }
    
    // 3. Break into lines
    const columnWidth = calculateColumnWidth(doc.pageSpec);
    const lines = breakLines(shaped, columnWidth, 
      ptToMpt(doc.styles.body.lineHeight), doc.pageSpec.baselineGrid);
    
    // 4. Fill pages
    const pages = fillPages(lines, doc.pageSpec);
    
    // 5. Measure baselines
    const measurements = pages.map(p => 
      measureBaselines(p, doc.pageSpec.baselineGrid));
    
    // 6. Generate diagnostics
    const diagnostics: Diagnostic[] = [];
    for (const m of measurements) {
      if (m.deltaBaseline > cfg.balanceTolerance) {
        diagnostics.push({
          code: 'COLUMN_IMBALANCE',
          severity: 'warning',
          message: `Page ${m.pageNumber}: columns differ by ${m.deltaBaseline}mpt`,
          location: { page: m.pageNumber },
        });
      }
      if (!m.onGrid) {
        diagnostics.push({
          code: 'BASELINE_OFF_GRID',
          severity: 'warning',
          message: `Page ${m.pageNumber}: baselines not on grid`,
          location: { page: m.pageNumber },
        });
      }
    }
    
    return {
      status: diagnostics.some(d => d.severity === 'error') ? 
        'invalid' : 'valid_with_warnings',
      pages,
      diagnostics,
      metrics: {
        totalPages: pages.length,
        // ... more metrics
      },
      configHash: hashConfig(cfg),
      documentHash: hashDocument(doc),
    };
  } catch (error) {
    return {
      status: 'invalid',
      pages: [],
      diagnostics: [{
        code: 'LAYOUT_FAILED',
        severity: 'error',
        message: `Layout failed: ${error.message}`,
      }],
      metrics: { totalPages: 0 },
      configHash: hashConfig(cfg),
      documentHash: '',
    };
  }
}
```

**Estimate:** 1 day

---

### 7. PDF Rendering

**File:** `src/output/pdf-renderer.ts`

```typescript
export function renderPDF(
  result: LayoutResult,
  outputPath: string
): void {
  const doc = new PDFDocument({
    size: [result.pages[0].width / 1000, result.pages[0].height / 1000], // mpt → pt
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  
  doc.pipe(createWriteStream(outputPath));
  doc.registerFont('Hebrew', 'fonts/SILEOT.ttf');
  
  for (const page of result.pages) {
    if (page.pageNumber > 1) {
      doc.addPage();
    }
    
    for (const column of page.columns) {
      for (const line of column.lines) {
        // Get text from glyphs (reverse-map cluster → text)
        const text = reconstructText(line.glyphs);
        
        // Calculate position
        const x = column.left / 1000; // mpt → pt
        const y = line.baseline / 1000;
        
        // Render with PDFKit
        doc.font('Hebrew').fontSize(11);
        doc.text(text, x, y, { lineBreak: false });
      }
    }
  }
  
  doc.end();
}
```

**Tests:**
- PDF created successfully
- Text appears in correct positions
- Nikud visible
- Multiple pages work

**Estimate:** 1 day

---

### 8. Integration Test

**File:** `tests/integration/m1-end-to-end.test.ts`

```typescript
it('M1: JSON → PDF end-to-end', async () => {
  // Load test document
  const json = readFileSync('input/m1-test.json', 'utf8');
  const doc = loadDocument(json);
  
  // Layout
  const result = layout(doc);
  
  // Verify
  expect(result.status).toBe('valid_with_warnings');
  expect(result.pages.length).toBeGreaterThan(0);
  expect(result.pages[0].columns.length).toBe(2);
  
  // Render PDF
  renderPDF(result, 'out/m1-test.pdf');
  
  // Verify PDF exists
  expect(existsSync('out/m1-test.pdf')).toBe(true);
  
  console.log(`✅ Generated ${result.pages.length} pages`);
  console.log(`   Diagnostics: ${result.diagnostics.length}`);
});
```

**Estimate:** 1 day

---

## Timeline

| Task | Duration | Dependencies |
|------|----------|--------------|
| 1. JSON Loader | 1 day | - |
| 2. Font Metrics | 1 day | - |
| 3. Greedy Line Breaking | 2 days | 1, 2 |
| 4. Page Filling | 2 days | 3 |
| 5. Baseline Measurement | 1 day | 4 |
| 6. LayoutResult Assembly | 1 day | 5 |
| 7. PDF Rendering | 1 day | 6 |
| 8. Integration Test | 1 day | 7 |
| **Total** | **10 days** (2 weeks) | |

**Buffer:** +3 days for debugging, edge cases, documentation  
**Total estimate:** **2-3 weeks**

---

## Success Criteria

✅ **M1 is complete when:**

1. Test document (`m1-test.json`) loads successfully
2. Text shaped with HarfBuzz (nikud visible)
3. Lines broken at word boundaries
4. Two columns filled (right first, then left)
5. Baselines measured and reported
6. `LayoutResult` generated with diagnostics
7. PDF created with actual Hebrew text
8. Integration test passes
9. Code coverage > 70%
10. All lint and type checks pass

---

## Non-Goals (deferred to M2)

- ❌ Column balancing (`bottomDelta = 0`)
- ❌ Knuth-Plass optimal breaking
- ❌ Footnotes
- ❌ Headers/footers
- ❌ Opening window
- ❌ Last-line centering
- ❌ Justification (beyond word spacing)
- ❌ Hyphenation

**Rationale:** Focus on end-to-end pipeline first, optimize later.

---

## Risks

### Risk: opentype.js needed for font metrics
**Mitigation:** Install and integrate if HarfBuzz insufficient (1 day buffer)

### Risk: Text reconstruction from glyphs is complex
**Mitigation:** Use cluster mapping from HarfBuzz (already available)

### Risk: Greedy breaking produces bad layouts
**Mitigation:** Accept for M1, improve in M2 with Knuth-Plass

---

## Status: Ready to Start

- ✅ M0 complete (32/32 tests, rendering validated)
- ✅ All dependencies verified (HarfBuzz, Ezra SIL, PDFKit)
- ✅ Architecture decisions made (ADR-001 to ADR-004)
- ✅ Performance measured (28,725 words/sec)

**Next action:** Create `input/m1-test.json` and start with JSON loader.

---

**Document version:** 1.0  
**Date:** 2026-10-13  
**Status:** Proposed (pending approval to start M1)
