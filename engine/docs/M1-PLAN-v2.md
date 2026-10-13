# M1 Implementation Plan v2 (Per Spec Section 25)

**Date:** 2026-10-13  
**Based on:** Specification v0.5, Section 25  
**Architecture:** JSON → Shaping → Lines → 2 Columns → **LayoutResult** → PDF

---

## Overview

M1 implements greedy line breaking and two-column layout per specification section 18. The critical architectural requirement (section 25) is that **PDF rendering operates FROM LayoutResult**, not from original text.

---

## Phase 0: Baseline Measurement

**Before M1 work begins**, establish M0 baseline:

- Shaping performance: **28,725 words/sec** (Intel i5-1240P, 12 cores)
- Test coverage: 76%
- All feasibility tests passing (38/38)

**After M1 completion**, compare:
- Line breaking throughput (words/sec)
- PDF generation time
- Memory usage

---

## Phase 1: BiDi Support (New Requirement)

### Objective
Handle mixed Hebrew + Digits + Latin text per UAX #9 (Unicode Bidirectional Algorithm).

### Tasks

**1.1 Install BiDi Library**
```bash
npm install --save bidi-js
```

**Alternatives:**
- `fribidi-js` (if bidi-js insufficient)
- Custom UAX #9 implementation (if needed for control)

**1.2 BiDi Integration Point**

Insert BiDi processing **after** text extraction, **before** shaping:

```typescript
// Input: logical order text (Unicode)
const text = "בראשית 1:1 Genesis";

// BiDi resolution
const bidiResult = resolveBidi(text, { baseDirection: 'RTL' });
// -> visual runs: [
//   { text: "Genesis", dir: LTR, start: 13, end: 20 },
//   { text: " 1:1", dir: LTR, start: 9, end: 13 },
//   { text: "בראשית", dir: RTL, start: 0, end: 7 }
// ]

// Shape each run with correct direction
for (const run of bidiResult.runs) {
  const shaped = shapeText(run.text, font, size, run.dir);
  // ...
}
```

**1.3 Create BiDi Tests**

**File:** `tests/unit/bidi/bidi.test.ts`

```typescript
describe('BiDi Text Handling', () => {
  it('handles Hebrew-only text (RTL)', () => {
    const text = 'בראשית ברא אלהים';
    const result = resolveBidi(text, { baseDirection: 'RTL' });
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].dir).toBe('RTL');
  });

  it('handles Hebrew + digits (mixed)', () => {
    const text = 'בראשית 1:1';
    const result = resolveBidi(text, { baseDirection: 'RTL' });
    // Digits should be LTR run
    expect(result.runs).toHaveLength(2);
    expect(result.runs.find(r => r.text.includes('1'))).toBeDefined();
    expect(result.runs.find(r => r.text.includes('1')).dir).toBe('LTR');
  });

  it('handles Hebrew + Latin (mixed)', () => {
    const text = 'בראשית Genesis';
    const result = resolveBidi(text, { baseDirection: 'RTL' });
    // Latin should be LTR run
    expect(result.runs).toHaveLength(2);
    expect(result.runs.find(r => r.text === 'Genesis')).toBeDefined();
    expect(result.runs.find(r => r.text === 'Genesis').dir).toBe('LTR');
  });

  it('handles complex mix (Hebrew + digits + Latin)', () => {
    const text = 'פרק 5 Chapter';
    const result = resolveBidi(text, { baseDirection: 'RTL' });
    expect(result.runs.length).toBeGreaterThan(1);
    // Verify visual order after reordering
    const visualText = result.runs.map(r => r.text).join('');
    // Visual: "Chapter 5 פרק"
  });

  it('preserves parentheses mirroring in RTL', () => {
    const text = '(בראשית)';
    const result = resolveBidi(text, { baseDirection: 'RTL' });
    // Parentheses should mirror: ) at start, ( at end
    const visual = result.runs.map(r => r.text).join('');
    expect(visual[0]).toBe(')');
    expect(visual[visual.length - 1]).toBe('(');
  });
});
```

**1.4 Update ADR-002 (HarfBuzz)**

Add note that BiDi resolution happens **before** shaping, and each visual run is shaped independently with its direction.

---

## Phase 2: JSON Input Parsing

### Objective
Parse JSON document structure into internal `Document` model (spec section 4).

### Tasks

**2.1 Define JSON Schema**

**File:** `src/input/document-schema.ts`

```typescript
export interface JsonDocument {
  meta: DocumentMeta;
  styles: Record<string, StyleDef>;
  pageSpec: PageSpec;
  sections: JsonSection[];
}

export interface JsonSection {
  kind: 'front' | 'body' | 'back';
  wordSection: 'nextPage' | 'continuous' | 'oddPage' | 'evenPage';
  numbering?: NumberingDef;
  blocks: JsonBlock[];
}

export interface JsonBlock {
  id: string;
  style: string; // Style ID reference
  runs: JsonRun[];
  anchors?: Anchor[];
  flags?: BlockFlags;
}

export interface JsonRun {
  text: string;
  style?: string; // Inline style overrides
}
```

**2.2 JSON Parser**

**File:** `src/input/json-parser.ts`

```typescript
export function parseJsonDocument(json: string): Document {
  const parsed: JsonDocument = JSON.parse(json);
  
  // Validate schema
  validateDocumentSchema(parsed);
  
  // Convert to internal Document model
  return {
    meta: convertMeta(parsed.meta),
    styles: resolveStyles(parsed.styles),
    pageSpec: convertPageSpec(parsed.pageSpec),
    sections: parsed.sections.map(convertSection),
  };
}
```

**2.3 Sample JSON Input**

**File:** `input/sample-document.json`

```json
{
  "meta": {
    "title": "בראשית",
    "author": "מחבר",
    "language": "he",
    "direction": "rtl"
  },
  "styles": {
    "body": {
      "font": "Ezra SIL",
      "size": 12,
      "lineHeight": 18,
      "align": "justify"
    },
    "heading": {
      "font": "Ezra SIL",
      "size": 16,
      "bold": true,
      "keepWithNext": true
    }
  },
  "pageSpec": {
    "size": "B5",
    "margins": { "inner": 72, "outer": 54, "top": 54, "bottom": 54 },
    "columns": 2,
    "columnGap": 18
  },
  "sections": [
    {
      "kind": "body",
      "wordSection": "nextPage",
      "blocks": [
        {
          "id": "p1",
          "style": "heading",
          "runs": [{ "text": "פרק א" }]
        },
        {
          "id": "p2",
          "style": "body",
          "runs": [{ "text": "בראשית ברא אלהים את השמים ואת הארץ" }]
        }
      ]
    }
  ]
}
```

**2.4 Tests**

**File:** `tests/unit/input/json-parser.test.ts`

- Parse valid JSON
- Reject invalid schema
- Handle missing optional fields
- Resolve style inheritance

---

## Phase 3: Text Shaping (HarfBuzz)

### Objective
Shape each text run with HarfBuzz, producing glyphs and positions.

### Tasks

**3.1 Shaping API**

Already implemented in M0. Enhance with BiDi:

**File:** `src/core/shaping.ts`

```typescript
export interface ShapedRun {
  text: string; // Original text (logical order)
  direction: 'ltr' | 'rtl';
  glyphs: GlyphInfo[];
  positions: GlyphPosition[];
  width: Distance; // mpt
}

export async function shapeText(
  text: string,
  fontBuffer: ArrayBuffer,
  fontSize: number,
  direction: 'ltr' | 'rtl' = 'rtl'
): Promise<ShapedRun> {
  // Apply BiDi resolution
  const bidiRuns = resolveBidi(text, { baseDirection: direction });
  
  // Shape each visual run
  const shapedRuns: ShapedRun[] = [];
  for (const run of bidiRuns.runs) {
    const shaped = await shapeRun(run.text, fontBuffer, fontSize, run.dir);
    shapedRuns.push(shaped);
  }
  
  // Combine runs in visual order
  return combineShapedRuns(shapedRuns);
}
```

**3.2 Tests**

- Shape Hebrew-only text
- Shape Hebrew + digits
- Shape Hebrew + Latin
- Verify glyph counts match expected (base + nikud)
- Verify width calculation (sum of xAdvance)

---

## Phase 4: Greedy Line Breaking (Spec Section 18)

### Objective
Break paragraphs into lines using greedy algorithm with word spacing flexibility.

### Tasks

**4.1 LineBreaker Interface**

**File:** `src/core/line-breaker.ts`

```typescript
export interface LineBreakResult {
  lines: Line[];
  warnings: string[];
}

export interface Line {
  words: ShapedWord[];
  width: Distance; // mpt
  tightness: number; // 0-1, quality metric
  break: 'space' | 'hyphen' | 'forced';
}

export interface LineBreakOptions {
  targetWidth: Distance; // mpt
  wordSpaceMin: number; // % of natural space (e.g., 0.85 = 85%)
  wordSpaceMax: number; // % of natural space (e.g., 1.40 = 140%)
  looseness?: -1 | 0 | 1; // Allow +/- one line
}

export function breakLinesGreedy(
  shapedRuns: ShapedRun[],
  options: LineBreakOptions
): LineBreakResult {
  // Greedy algorithm:
  // 1. Accumulate words until line width exceeded
  // 2. Back up to last break point
  // 3. Adjust word spacing within allowed range
  // 4. Repeat for next line
}
```

**4.2 Greedy Algorithm**

```typescript
function breakLinesGreedy(runs: ShapedRun[], opts: LineBreakOptions): LineBreakResult {
  const lines: Line[] = [];
  let currentLine: ShapedWord[] = [];
  let currentWidth = 0;
  
  for (const word of extractWords(runs)) {
    const testWidth = currentWidth + word.width + estimateSpace();
    
    if (testWidth > opts.targetWidth && currentLine.length > 0) {
      // Line full - finalize
      const spaceAdjustment = computeSpacing(currentLine, opts);
      lines.push({
        words: currentLine,
        width: computeActualWidth(currentLine, spaceAdjustment),
        tightness: spaceAdjustment.quality,
        break: 'space'
      });
      
      currentLine = [word];
      currentWidth = word.width;
    } else {
      currentLine.push(word);
      currentWidth = testWidth;
    }
  }
  
  // Last line
  if (currentLine.length > 0) {
    lines.push({ words: currentLine, ... });
  }
  
  return { lines, warnings: [] };
}
```

**4.3 Word Spacing Adjustment**

```typescript
function computeSpacing(
  words: ShapedWord[],
  opts: LineBreakOptions
): SpaceAdjustment {
  const naturalWidth = words.reduce((sum, w) => sum + w.width, 0);
  const spaceCount = words.length - 1;
  const naturalSpaceWidth = 250; // mpt (example)
  
  const targetGap = (opts.targetWidth - naturalWidth) / spaceCount;
  const ratio = targetGap / naturalSpaceWidth;
  
  if (ratio < opts.wordSpaceMin || ratio > opts.wordSpaceMax) {
    // Out of range - warning
    return { ratio: clamp(ratio, opts.wordSpaceMin, opts.wordSpaceMax), quality: 0.5 };
  }
  
  return { ratio, quality: 1.0 - Math.abs(ratio - 1.0) };
}
```

**4.4 Tests**

**File:** `tests/unit/line-breaking/greedy.test.ts`

- Break simple paragraph (Hebrew-only)
- Break with word spacing adjustment
- Handle looseness (+/- 1 line)
- Detect "rivers" (consecutive large spaces)
- Handle mixed Hebrew + Latin lines

---

## Phase 5: Two-Column Layout (Spec Section 7.1-7.5)

### Objective
Distribute lines across two columns with balance (bottom delta = 0).

### Tasks

**5.1 Column Filler**

**File:** `src/core/column-filler.ts`

```typescript
export interface ColumnLayout {
  leftColumn: Line[];
  rightColumn: Line[];
  bottomDelta: Distance; // mpt
  balanced: boolean;
  balanceInfo: BalanceInfo; // per spec section 8
}

export function fillTwoColumns(
  lines: Line[],
  columnHeight: Distance, // mpt
  policy: PagePolicyId
): ColumnLayout {
  // Greedy M1: try all split points
  let bestLayout: ColumnLayout | null = null;
  let bestDelta = Infinity;
  
  for (let split = 1; split < lines.length; split++) {
    const left = lines.slice(0, split);
    const right = lines.slice(split);
    
    const leftHeight = computeColumnHeight(left);
    const rightHeight = computeColumnHeight(right);
    
    if (leftHeight > columnHeight || rightHeight > columnHeight) {
      continue; // Overflow - skip
    }
    
    const delta = Math.abs(leftHeight - rightHeight);
    
    if (delta < bestDelta) {
      bestDelta = delta;
      bestLayout = { left, right, bottomDelta: delta, ... };
    }
  }
  
  return bestLayout || { balanced: false, ... };
}
```

**5.2 Balance Calculation**

Per spec section 8:

```typescript
function computeBalanceInfo(layout: ColumnLayout, policy: PagePolicy): BalanceInfo {
  const minBottom = Math.min(layout.leftBottom, layout.rightBottom);
  const maxBottom = Math.max(layout.leftBottom, layout.rightBottom);
  const bottomDelta = maxBottom - minBottom;
  const bottomDeltaLines = bottomDelta / bodyBaselineStep;
  
  return {
    applicable: policy.balanceApplies,
    targetDelta: policy.targetDelta, // 0 for body_full
    actualDelta: bottomDelta,
    actualDeltaLines: bottomDeltaLines,
    balanced: bottomDelta === policy.targetDelta,
    policyId: policy.id
  };
}
```

**5.3 Tests**

**File:** `tests/unit/layout/two-column.test.ts`

- Balance simple two-column page
- Detect balance failure (BALANCE_UNSATISFIABLE)
- Handle widows/orphans
- Apply page policy (body_full, last_page, etc.)

---

## Phase 6: LayoutResult Structure (Spec Section 12)

### Objective
Produce `LayoutResult` with positioned words/glyphs for PDF rendering.

### Tasks

**6.1 LayoutResult Schema**

Already defined in `src/core/types.ts`. Ensure complete:

```typescript
export interface LayoutResult {
  engineVersion: string;
  configHash: string;
  documentHash: string;
  status: 'valid' | 'valid_with_warnings' | 'invalid';
  pages: PageLayout[];
  diagnostics: Diagnostic[];
  metrics: LayoutMetrics;
  trace?: DecisionTrace[];
  waivers?: WaiverRecord[];
}

export interface PageLayout {
  pageIndex: number;
  masterId: string;
  columns: ColumnContent[];
  notes?: NoteLayout[];
  balance: BalanceInfo;
}

export interface ColumnContent {
  columnIndex: number;
  lines: LineLayout[];
  bottomY: Distance; // mpt (baseline of last line)
}

export interface LineLayout {
  lineIndex: number;
  baselineY: Distance; // mpt
  words: WordLayout[];
}

export interface WordLayout {
  text: string; // Original text (logical)
  x: Distance; // mpt (left edge, for RTL this is right edge in visual)
  baselineY: Distance; // mpt
  width: Distance; // mpt
  glyphs: GlyphLayout[]; // For glyph-level rendering (future)
}

export interface GlyphLayout {
  glyphId: number; // HarfBuzz codepoint
  x: Distance; // mpt
  y: Distance; // mpt (baseline-relative)
  xAdvance: Distance; // mpt
  xOffset: Distance; // mpt
  yOffset: Distance; // mpt
}
```

**6.2 Layout Builder**

**File:** `src/core/layout-builder.ts`

```typescript
export function buildLayout(
  document: Document,
  config: EngineConfig
): LayoutResult {
  const pages: PageLayout[] = [];
  
  for (const section of document.sections) {
    const sectionPages = layoutSection(section, config);
    pages.push(...sectionPages);
  }
  
  return {
    engineVersion: '0.1.0',
    configHash: hashConfig(config),
    documentHash: hashDocument(document),
    status: determineStatus(pages),
    pages,
    diagnostics: collectDiagnostics(pages),
    metrics: computeMetrics(pages)
  };
}
```

**6.3 Tests**

- Build LayoutResult from simple document
- Verify all coordinates are integers (mpt)
- Verify word positions match column boundaries
- Verify glyph data preserved (for future use)

---

## Phase 7: PDF Rendering FROM LayoutResult

### Objective
Render PDF using **Alternative A** (word-level with PDFKit) **FROM LayoutResult ONLY**.

**CRITICAL:** Do NOT re-shape or re-measure text during PDF rendering. All coordinates come from LayoutResult.

### Tasks

**7.1 PDF Renderer**

**File:** `src/output/pdf-renderer.ts`

```typescript
export function renderPDF(
  layout: LayoutResult,
  fontPath: string,
  outputPath: string
): void {
  const doc = new PDFDocument({ size: 'B5' });
  const stream = createWriteStream(outputPath);
  doc.pipe(stream);
  
  doc.font(fontPath);
  
  for (const page of layout.pages) {
    if (page.pageIndex > 0) doc.addPage();
    
    for (const column of page.columns) {
      for (const line of column.lines) {
        for (const word of line.words) {
          // Render word at EXACT coordinates from LayoutResult
          doc.fontSize(12); // From resolved style
          doc.text(word.text, word.x / 1000, word.baselineY / 1000, {
            lineBreak: false,
            width: undefined
          });
        }
      }
    }
  }
  
  doc.end();
}
```

**7.2 Tests**

**File:** `tests/integration/pdf-rendering.test.ts`

- Render simple two-page document
- Verify PDF file created
- Verify visual output (manual inspection for M1)
- NO width re-measurement during rendering

---

## Phase 8: Integration Tests

### Objective
End-to-end validation: JSON → PDF.

### Tasks

**8.1 Full Pipeline Test**

**File:** `tests/integration/e2e.test.ts`

```typescript
it('renders two-page Hebrew document with BiDi', async () => {
  // 1. Load JSON
  const json = readFileSync('input/sample-document.json', 'utf-8');
  const document = parseJsonDocument(json);
  
  // 2. Build layout
  const layout = await buildLayout(document, DEFAULT_CONFIG);
  
  // 3. Verify LayoutResult
  expect(layout.status).toBe('valid');
  expect(layout.pages).toHaveLength(2);
  expect(layout.pages[0].balance.balanced).toBe(true);
  
  // 4. Render PDF
  renderPDF(layout, FONT_PATH, 'out/e2e-test.pdf');
  
  // 5. Verify PDF exists
  expect(existsSync('out/e2e-test.pdf')).toBe(true);
});
```

**8.2 BiDi Integration Test**

```typescript
it('handles mixed Hebrew + Latin + digits', async () => {
  const json = {
    sections: [{
      blocks: [{
        id: 'p1',
        style: 'body',
        runs: [{ text: 'בראשית 1:1 Genesis' }]
      }]
    }]
  };
  
  const layout = await buildLayout(parseJsonDocument(json), DEFAULT_CONFIG);
  
  // Verify BiDi runs shaped correctly
  const words = layout.pages[0].columns[0].lines[0].words;
  expect(words).toHaveLength(3); // Hebrew, digits, Latin
  expect(words[0].text).toBe('Genesis'); // Visual order (RTL base)
  expect(words[1].text).toBe('1:1');
  expect(words[2].text).toBe('בראשית');
});
```

---

## Acceptance Criteria

### Functional
- ✅ Parses JSON document structure
- ✅ Shapes Hebrew + nikud + te'amim (M0 baseline: 28k words/sec)
- ✅ Handles BiDi: Hebrew + digits + Latin in single line
- ✅ Breaks lines greedily with word spacing (85%-140%)
- ✅ Fills two columns with balance (bottomDelta = 0)
- ✅ Produces LayoutResult per spec section 12
- ✅ Renders PDF from LayoutResult (word-level, Alternative A)
- ✅ No re-shaping/re-measurement during PDF rendering

### Quality
- ✅ Test coverage ≥ 76% (M0 baseline)
- ✅ All tests passing
- ✅ No lint errors
- ✅ BiDi tests: Hebrew-only, mixed, parentheses mirroring
- ✅ Visual output: PDF matches expected layout (manual inspection)

### Performance
- ✅ Shaping throughput ≥ M0 baseline (28k words/sec)
- ✅ Line breaking: <100ms for 1000-word paragraph
- ✅ PDF rendering: <5sec for 100-page book

### Compliance
- ✅ spec section 18: greedy line breaking
- ✅ Spec section 7.1: two-column layout
- ✅ Spec section 8: balance measurement (bottomDelta)
- ✅ Spec section 12: LayoutResult structure
- ✅ Spec section 25: PDF FROM LayoutResult

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| BiDi library insufficient | Medium | High | Budget fallback to custom UAX #9 |
| Balance unsatisfiable for real content | High | Medium | Implement BALANCE_UNSATISFIABLE diagnostic (spec 12.1) |
| PDFKit width deviation >5.91% | Low | Low | Accept for M1, defer glyph-level to M2 |
| Line breaking too slow | Medium | Medium | Profile and optimize; defer Knuth-Plass to M2 |

---

## Dependencies

### External
- `bidi-js` or `fribidi-js` (BiDi resolution)
- `harfbuzzjs` v1.6.3+ (already in M0)
- `pdfkit` (already in M0)

### Internal
- M0 infrastructure (complete)
- ADR-002 (HarfBuzz) - update with BiDi note
- ADR-004 (rendering) - Alternative A confirmed

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| 0. Baseline | 1 hour | M0 metrics |
| 1. BiDi | 2-3 days | bidi-js install, tests |
| 2. JSON parsing | 2 days | Schema, validation |
| 3. Shaping (BiDi-aware) | 1 day | M0 + BiDi |
| 4. Line breaking | 3-4 days | Greedy algorithm, spacing |
| 5. Two-column layout | 3-4 days | Balance, policies |
| 6. LayoutResult | 2 days | Schema compliance |
| 7. PDF rendering | 2 days | Alternative A |
| 8. Integration tests | 2 days | E2E validation |

**Total:** 17-21 days (3-4 weeks)

---

## Next Steps After M1

**M2: Knuth-Plass Optimal Line Breaking**
- Replace greedy with optimal algorithm (spec section 20)
- Re-measure width deviation impact
- Consider glyph-level rendering (Alternative B) if precision matters

**M3: Production Features**
- Footnotes/endnotes (spec section 16-17)
- Table of contents with convergence (spec section 15)
- Headers, footers, page numbering (spec section 5)
- Opening emphasis with window (spec section 6.4)
- Manual fixes and waivers (spec section 7.9)

---

**References:**
- Spec v0.5: `docs/SPEC.md`
- ADR-002: HarfBuzz WASM
- ADR-004: Rendering Strategy (Alternative A)
- M0-COMPLETION-SUMMARY.md: Baseline metrics
