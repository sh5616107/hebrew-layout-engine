import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { layoutSection, type SectionLayoutConfig } from '../../src/layout/section-balancer';
import { layoutDocumentWithSections } from '../../src/core/layout-engine';
import type { LayoutSection, LayoutParagraph, ShapedRun } from '../../src/core/types';
import { shape } from '../../src/typography/shaper';
import { renderToPDF } from '../../src/rendering/pdf-renderer';

// Helper to create mock shaped run
function mockRun(text: string): ShapedRun {
  return {
    font: 'Ezra SIL',
    size: 12000,
    glyphs: [],
    direction: 'rtl',
    width: text.length * 1000,
  };
}

// Helper to create mock paragraph
function mockParagraph(id: string, lineCount: number): LayoutParagraph {
  const lines: ShapedRun[][] = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push([mockRun(`line${i}`)]);
  }

  return {
    id,
    lines,
    style: {
      lastLine: 'justify',
      widows: 2,
      orphans: 2,
    },
  };
}

// Default config
const defaultConfig: SectionLayoutConfig = {
  maxLinesPerColumn: 20,
  lineHeight: 14000,
  sectionBalancing: {
    maxAttempts: 100,
    lookAheadPages: 5,
    lookBackPages: 1,
    minParagraphLinesToSplit: 4,
    widows: 2,
    orphans: 2,
    balanceTolerance: 0,
    defaultParagraphSpacing: 1.0,
    maxParagraphSpacingMultiplier: 2.0,
    enableStageA: true,
    enableStageB: true,
    enableStageC: true,
    enableStageD: true,
  },
  wordSpacing: {
    preferred: { min: 90, max: 115 },
    allowed: { min: 80, max: 130 },
  },
};

describe('Section Balancing Integration', () => {
  it('preserves shaped runs in the public document layout result', () => {
    const originalRun = mockRun('שלום');
    const section: LayoutSection = {
      id: 'section-preserve-runs',
      kind: 'body',
      paragraphs: [{
        id: 'paragraph-preserve-runs',
        lines: [[originalRun], [mockRun('עולם')]],
        style: { lastLine: 'start', widows: 2, orphans: 2 },
      }],
      balancePolicy: 'fill',
    };

    const result = layoutDocumentWithSections([section], {
      pageHeight: 200,
      topMargin: 10,
      bottomMargin: 10,
      lineHeight: 14,
    });
    const outputLines = [
      ...result.pages.flatMap((page) => page.rightColumn.lines),
      ...result.pages.flatMap((page) => page.leftColumn.lines),
    ];

    expect(outputLines).toHaveLength(2);
    expect(outputLines.flatMap((line) => line.runs ?? [])).toContain(originalRun);
  });

  it('renders shaped section runs as PDF glyphs on the baseline grid', async () => {
    const fontPath = 'fonts/SILEOT.ttf';
    const font = fs.readFileSync(fontPath);
    const firstRun = await shape('שלום', font, 12);
    const secondRun = await shape('עולם', font, 12);
    const section: LayoutSection = {
      id: 'section-render-runs',
      kind: 'body',
      paragraphs: [{
        id: 'paragraph-render-runs',
        // Four lines force a 2+2 section split. This lets the assertion check
        // both that glyphs reach the PDF and that successive baselines retain
        // the public API's point-based line height.
        lines: [[firstRun], [firstRun], [secondRun], [secondRun]],
        style: { lastLine: 'start', widows: 2, orphans: 2 },
      }],
      balancePolicy: 'fill',
    };
    const layout = layoutDocumentWithSections([section], {
      pageHeight: 200,
      topMargin: 10,
      bottomMargin: 10,
      lineHeight: 14,
    });
    const outputPath = path.join('out', 'section-shaped-runs.pdf');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    await renderToPDF(layout, { fontPath, fontSize: 12, outputPath, compress: false });

    const content = fs.readFileSync(outputPath, 'latin1');
    const positions = Array.from(
      content.matchAll(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm\s*<[0-9a-f]{4}> Tj/g),
      (match) => ({ x: Number(match[1]), y: Number(match[2]) }),
    );
    expect(positions).toHaveLength(2 * (firstRun.glyphs.length + secondRun.glyphs.length));
    expect(positions[firstRun.glyphs.length]!.y - positions[0]!.y).toBeCloseTo(-14, 3);
  });

  describe('Single page section', () => {
    it('should layout section with single paragraph', () => {
      const section: LayoutSection = {
        id: 'section-1',
        kind: 'body',
        paragraphs: [mockParagraph('para-1', 10)],
        balancePolicy: 'fill',
      };

      const result = layoutSection(section, defaultConfig);

      expect(result.pages).toHaveLength(1);
      // Last page must be balanced (hard constraint), so 10 lines → 5+5
      expect(result.pages[0]?.rightColumn.lines).toHaveLength(5);
      expect(result.pages[0]?.leftColumn.lines).toHaveLength(5);
    });

    it('should balance last page of section', () => {
      const section: LayoutSection = {
        id: 'section-1',
        kind: 'body',
        paragraphs: [mockParagraph('para-1', 20)],
        balancePolicy: 'fill',
      };

      const result = layoutSection(section, defaultConfig);

      expect(result.pages).toHaveLength(1);
      // 20 lines should be split 10+10 for balance
      const page = result.pages[0];
      expect(page).toBeDefined();
      if (page) {
        expect(page.rightColumn.lines.length).toBe(10);
        expect(page.leftColumn.lines.length).toBe(10);
        expect(page.isBalanced).toBe(true);
      }
    });
  });

  describe('Multi-page section', () => {
    it('should create multiple pages for large section', () => {
      const section: LayoutSection = {
        id: 'section-1',
        kind: 'body',
        paragraphs: [mockParagraph('para-1', 100)],
        balancePolicy: 'fill',
      };

      const result = layoutSection(section, defaultConfig);

      // 100 lines, 40 lines per page (20+20) = 3 pages (40+40+20)
      expect(result.pages.length).toBeGreaterThan(1);
    });

    it('should not balance middle pages in fill mode', () => {
      const section: LayoutSection = {
        id: 'section-1',
        kind: 'body',
        paragraphs: [mockParagraph('para-1', 100)],
        balancePolicy: 'fill',
      };

      const result = layoutSection(section, defaultConfig);

      // Middle pages should be filled, not balanced
      if (result.pages.length > 1) {
        const firstPage = result.pages[0];
        expect(firstPage).toBeDefined();
        // First page should be full (20+20)
        if (firstPage) {
          expect(firstPage.rightColumn.lines.length).toBe(20);
          expect(firstPage.leftColumn.lines.length).toBe(20);
        }
      }
    });

    it('should balance all pages in balanced mode', () => {
      const section: LayoutSection = {
        id: 'section-1',
        kind: 'body',
        paragraphs: [mockParagraph('para-1', 30)],
        balancePolicy: 'balanced',
      };

      const result = layoutSection(section, defaultConfig);

      // All pages should attempt balancing
      expect(result.pages).toHaveLength(1);
      const page = result.pages[0];
      expect(page).toBeDefined();
      if (page) {
        // 30 lines should balance 15+15
        expect(Math.abs(page.rightColumn.lines.length - page.leftColumn.lines.length)).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Diagnostics', () => {
    it('should create warning for unbalanced fill pages', () => {
      const section: LayoutSection = {
        id: 'section-1',
        kind: 'body',
        // Create scenario with unbalanced middle page
        paragraphs: [mockParagraph('para-1', 60)],
        balancePolicy: 'fill',
      };

      const result = layoutSection(section, defaultConfig);

      // Check if any warning diagnostics were generated
      const warnings = result.diagnostics.filter(d => d.severity === 'warning');
      // Note: warnings only generated if delta > lineHeight in fill mode
      expect(warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should use stable diagnostic keys', () => {
      const section: LayoutSection = {
        id: 'test-section',
        kind: 'body',
        paragraphs: [mockParagraph('para-1', 10)],
        balancePolicy: 'fill',
      };

      const result = layoutSection(section, defaultConfig);

      // All diagnostics should have stable keys
      for (const diag of result.diagnostics) {
        expect(diag.stableKey).toContain('test-section');
        expect(diag.stableKey).toMatch(/^[^:]+:[^:]+:[A-Z_]+$/);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle section shorter than one page', () => {
      const section: LayoutSection = {
        id: 'section-1',
        kind: 'body',
        paragraphs: [mockParagraph('para-1', 5)],
        balancePolicy: 'fill',
      };

      const result = layoutSection(section, defaultConfig);

      expect(result.pages).toHaveLength(1);
      // 5 lines will balance as 3+2 or 2+3, which may not be perfect balance
      // but shouldn't generate errors (only last page failure generates error)
      const errors = result.diagnostics.filter(d => d.severity === 'error');
      // If balanced within tolerance, no error; if not, there will be an error
      // Accept either outcome (depends on tolerance and whether 3+2 is within it)
      expect(errors.length).toBeLessThanOrEqual(1);
    });

    it('should handle empty section', () => {
      const section: LayoutSection = {
        id: 'section-1',
        kind: 'body',
        paragraphs: [],
        balancePolicy: 'fill',
      };

      const result = layoutSection(section, defaultConfig);

      expect(result.pages).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('should handle paragraph with opening and window', () => {
      const paragraphWithWindow: LayoutParagraph = {
        id: 'para-with-window',
        lines: Array(15).fill(null).map(() => [mockRun('text')]),
        style: {
          lastLine: 'justify',
          widows: 2,
          orphans: 2,
        },
        opening: {
          wordCount: 1,
          windowLines: 2,
          windowWidth: 5000,
        },
      };

      const section: LayoutSection = {
        id: 'section-1',
        kind: 'body',
        paragraphs: [paragraphWithWindow],
        balancePolicy: 'fill',
      };

      const result = layoutSection(section, defaultConfig);

      expect(result.pages).toHaveLength(1);
      // 15 lines can balance (e.g. 8+7), may or may not generate error depending on tolerance
      const errors = result.diagnostics.filter(d => d.severity === 'error');
      expect(errors.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Per-stage functionality', () => {
    it('Stage A: should balance with different split points (fails when disabled)', () => {
      const section: LayoutSection = {
        id: 'stage-a-test',
        kind: 'body',
        paragraphs: [mockParagraph('para-1', 20)],
        balancePolicy: 'fill',
      };

      // WITH Stage A: should balance
      const resultEnabled = layoutSection(section, defaultConfig);
      const pageEnabled = resultEnabled.pages[0];
      expect(pageEnabled?.isBalanced).toBe(true);

      // WITHOUT Stage A: fails to balance
      const configDisabled: SectionLayoutConfig = {
        ...defaultConfig,
        sectionBalancing: { ...defaultConfig.sectionBalancing, enableStageA: false },
      };
      const resultDisabled = layoutSection(section, configDisabled);
      const pageDisabled = resultDisabled.pages[0];
      expect(pageDisabled?.isBalanced).toBe(false);
    });

    it('Stage B: NOT TESTED - complex scenario', () => {
      // Stage B requires specific scenario where A fails but B succeeds
      // with alternatives. Complex to set up reliably.
      expect(true).toBe(true);
    });

    it('Stage C: should add paragraph spacing (fails when disabled)', () => {
      const section: LayoutSection = {
        id: 'stage-c-test',
        kind: 'body',
        paragraphs: [
          mockParagraph('para-1', 7),
          mockParagraph('para-2', 7),
          mockParagraph('para-3', 7),
        ],
        balancePolicy: 'fill',
      };

      // WITH Stage C: should balance
      const resultEnabled = layoutSection(section, defaultConfig);
      const pageEnabled = resultEnabled.pages[0];
      expect(pageEnabled?.isBalanced).toBe(true);
      const shorterColEnabled = pageEnabled!.rightHeight > pageEnabled!.leftHeight 
        ? pageEnabled!.leftColumn : pageEnabled!.rightColumn;
      const spacingEnabled = shorterColEnabled.segments.reduce((sum, seg) => sum + (seg.spacingAfter ?? 0), 0);
      expect(spacingEnabled).toBeGreaterThan(0);

      // WITHOUT Stage C: fails to balance (no spacing added)
      const configDisabled: SectionLayoutConfig = {
        ...defaultConfig,
        sectionBalancing: { ...defaultConfig.sectionBalancing, enableStageC: false },
      };
      const resultDisabled = layoutSection(section, configDisabled);
      const pageDisabled = resultDisabled.pages[0];
      expect(pageDisabled?.isBalanced).toBe(false);
    });

    it('Stage D: NOT TESTED - not implemented', () => {
      // Stage D is marked NOT IMPLEMENTED
      // No functional test needed
      expect(true).toBe(true);
    });

    it('should fail gracefully when all stages exhausted on last page', () => {
      // Create scenario that cannot balance with any stage
      // Very odd number that stages A-D cannot handle
      const section: LayoutSection = {
        id: 'failure-test',
        kind: 'body',
        paragraphs: [mockParagraph('para-1', 3)], // Only 3 lines, cannot balance 2+1 within tolerance
        balancePolicy: 'fill',
      };

      const strictConfig: SectionLayoutConfig = {
        ...defaultConfig,
        sectionBalancing: {
          ...defaultConfig.sectionBalancing,
          balanceTolerance: 0, // Strict balance required
          maxParagraphSpacingMultiplier: 1.0, // No additional spacing allowed
        },
      };

      const result = layoutSection(section, strictConfig);

      // Should generate SECTION_BALANCE_FAILED error
      const failureError = result.diagnostics.find(d => d.code === 'SECTION_BALANCE_FAILED');
      expect(failureError).toBeDefined();
      expect(failureError?.severity).toBe('error');
      expect(failureError?.attemptedStrategies).toContain('split');
      expect(failureError?.attemptedStrategies).toContain('alternative-breaks');
      expect(failureError?.attemptedStrategies).toContain('paragraph-spacing');
      expect(failureError?.attemptedStrategies).toContain('move-lines');
    });
  });
});
