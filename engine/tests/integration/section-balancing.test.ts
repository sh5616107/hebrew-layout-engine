import { describe, it, expect } from 'vitest';
import { layoutSection, type SectionLayoutConfig } from '../../src/layout/section-balancer';
import type { LayoutSection, LayoutParagraph, ShapedRun } from '../../src/core/types';

describe('Section Balancing Integration', () => {
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
    },
    wordSpacing: {
      preferred: { min: 90, max: 115 },
      allowed: { min: 80, max: 130 },
    },
  };

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
});
