/**
 * Section balancer unit tests
 * Tests for ADR-007 section-level column balancing
 */

import { describe, it, expect } from 'vitest';
import { layoutSection } from '../../../src/layout/section-balancer';
import type { LayoutSection, ShapedRun } from '../../../src/core/types';
import type { SectionLayoutConfig } from '../../../src/layout/section-balancer';

describe('Section Balancer - Diagnostic Accuracy (Section 1)', () => {
  const mockRun: ShapedRun = {
    font: 'Ezra SIL',
    size: 12000, // 12pt in mpt
    glyphs: [],
    direction: 'rtl',
    width: 50000, // 50pt in mpt
  };

  const createLine = (): ShapedRun[] => [mockRun];

  const defaultConfig: SectionLayoutConfig = {
    maxLinesPerColumn: 50,
    lineHeight: 14000, // 14pt in mpt
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

  it('should NOT create ALTERNATIVE_BREAK_USED when no alternative was applied', () => {
    // Create a section with one paragraph that has no alternatives
    const section: LayoutSection = {
      id: 'test-section',
      kind: 'body',
      balancePolicy: 'balanced',
      paragraphs: [
        {
          id: 'para-1',
          lines: Array.from({ length: 10 }, () => createLine()),
          style: {
            lastLine: 'justify',
            widows: 2,
            orphans: 2,
          },
          // No alternativeBreaks provided
        },
      ],
    };

    const result = layoutSection(section, defaultConfig);

    // Check that ALTERNATIVE_BREAK_USED diagnostic was NOT created
    const alternativeUsedDiag = result.diagnostics.find(
      (d) => d.code === 'ALTERNATIVE_BREAK_USED'
    );

    expect(alternativeUsedDiag).toBeUndefined();
  });

  it('should NOT create LINES_MOVED_BETWEEN_PAGES when no lines were moved', () => {
    // Create a perfectly balanced section that doesn't need line movement
    const section: LayoutSection = {
      id: 'test-section-2',
      kind: 'body',
      balancePolicy: 'balanced',
      paragraphs: [
        {
          id: 'para-1',
          lines: Array.from({ length: 50 }, () => createLine()), // Exactly one page, 25+25
          style: {
            lastLine: 'justify',
            widows: 2,
            orphans: 2,
          },
        },
      ],
    };

    const result = layoutSection(section, defaultConfig);

    // Check that LINES_MOVED_BETWEEN_PAGES diagnostic was NOT created
    const linesMovedDiag = result.diagnostics.find(
      (d) => d.code === 'LINES_MOVED_BETWEEN_PAGES'
    );

    expect(linesMovedDiag).toBeUndefined();
  });

  it('should create LINES_MOVED_BETWEEN_PAGES only when lines were actually moved', () => {
    // This test will pass once stage D is fully implemented
    // For now, we verify it's not created in the stub
    const section: LayoutSection = {
      id: 'test-section-3',
      kind: 'body',
      balancePolicy: 'balanced',
      paragraphs: [
        {
          id: 'para-1',
          lines: Array.from({ length: 101 }, () => createLine()), // Needs balancing
          style: {
            lastLine: 'justify',
            widows: 2,
            orphans: 2,
          },
        },
      ],
    };

    const result = layoutSection(section, defaultConfig);

    // Since stage D is still a stub, no lines are moved
    const linesMovedDiag = result.diagnostics.find(
      (d) => d.code === 'LINES_MOVED_BETWEEN_PAGES'
    );

    expect(linesMovedDiag).toBeUndefined();
  });
});


describe('Section Balancer - Real Page Model (Section 2)', () => {
  const mockRun: ShapedRun = {
    font: 'Ezra SIL',
    size: 12000,
    glyphs: [],
    direction: 'rtl',
    width: 50000,
  };

  const createLine = (): ShapedRun[] => [mockRun];

  const defaultConfig: SectionLayoutConfig = {
    maxLinesPerColumn: 50,
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

  it('should track paragraph segments in columns', () => {
    const section: LayoutSection = {
      id: 'test-section',
      kind: 'body',
      balancePolicy: 'fill',
      paragraphs: [
        {
          id: 'para-1',
          lines: Array.from({ length: 30 }, () => createLine()),
          style: { lastLine: 'justify', widows: 2, orphans: 2 },
        },
        {
          id: 'para-2',
          lines: Array.from({ length: 40 }, () => createLine()),
          style: { lastLine: 'justify', widows: 2, orphans: 2 },
        },
      ],
    };

    const result = layoutSection(section, defaultConfig);

    expect(result.pages.length).toBeGreaterThan(0);
    const firstPage = result.pages[0];
    
    // Check that columns have segments
    expect(firstPage?.rightColumn.segments).toBeDefined();
    expect(firstPage?.leftColumn.segments).toBeDefined();
    
    // Check that segments reference paragraphs
    const allSegments = [
      ...(firstPage?.rightColumn.segments ?? []),
      ...(firstPage?.leftColumn.segments ?? []),
    ];
    
    expect(allSegments.length).toBeGreaterThan(0);
    expect(allSegments.every(s => s.paragraphId && s.lines.length > 0)).toBe(true);
  });

  it('should preserve all lines through the layout process', () => {
    const totalInputLines = 120;
    const section: LayoutSection = {
      id: 'test-section',
      kind: 'body',
      balancePolicy: 'fill',
      paragraphs: [
        {
          id: 'para-1',
          lines: Array.from({ length: totalInputLines }, () => createLine()),
          style: { lastLine: 'justify', widows: 2, orphans: 2 },
        },
      ],
    };

    const result = layoutSection(section, defaultConfig);

    // Count all lines in all pages
    let totalOutputLines = 0;
    for (const page of result.pages) {
      totalOutputLines += page.rightColumn.lines.length;
      totalOutputLines += page.leftColumn.lines.length;
    }

    expect(totalOutputLines).toBe(totalInputLines);
  });

  it('should not have empty arrays in columns', () => {
    const section: LayoutSection = {
      id: 'test-section',
      kind: 'body',
      balancePolicy: 'fill',
      paragraphs: [
        {
          id: 'para-1',
          lines: Array.from({ length: 50 }, () => createLine()),
          style: { lastLine: 'justify', widows: 2, orphans: 2 },
        },
      ],
    };

    const result = layoutSection(section, defaultConfig);

    for (const page of result.pages) {
      // Each line should be a non-empty array
      for (const line of page.rightColumn.lines) {
        expect(line.length).toBeGreaterThan(0);
      }
      for (const line of page.leftColumn.lines) {
        expect(line.length).toBeGreaterThan(0);
      }
    }
  });
});


describe('Section Balancer - Stage A: Different Split (Section 3)', () => {
  const mockRun: ShapedRun = {
    font: 'Ezra SIL',
    size: 12000,
    glyphs: [],
    direction: 'rtl',
    width: 50000,
  };

  const createLine = (): ShapedRun[] => [mockRun];

  const defaultConfig: SectionLayoutConfig = {
    maxLinesPerColumn: 50,
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

  it('should balance page using different split point in stage A', () => {
    // Create a section with content that can be balanced by splitting differently
    // 51 lines total: initially 26+25 (delta=1*14000=14000 mpt)
    // Best split: 25+26 or 26+25 (delta minimized)
    const section: LayoutSection = {
      id: 'test-section',
      kind: 'body',
      balancePolicy: 'balanced',
      paragraphs: [
        {
          id: 'para-1',
          lines: Array.from({ length: 51 }, () => createLine()),
          style: { lastLine: 'justify', widows: 2, orphans: 2 },
        },
      ],
    };

    const result = layoutSection(section, defaultConfig);

    // Should have one page (51 lines fit in one page with maxLinesPerColumn=50)
    expect(result.pages.length).toBe(1);
    
    const page = result.pages[0];
    if (!page) {
      throw new Error('Page is undefined');
    }

    // Check that split was attempted
    expect(page.rightColumn.lines.length + page.leftColumn.lines.length).toBe(51);
    
    // In last page of section, all splits are tried, so perfect balance should be achieved
    // With 51 lines, best split is 26+25 or 25+26 (delta = 1 line = 14000 mpt)
    expect(page.bottomDelta).toBeLessThanOrEqual(14000);
  });

  it('should search all splits for last page of section', () => {
    // Last page must try all possible splits
    const section: LayoutSection = {
      id: 'test-section',
      kind: 'body',
      balancePolicy: 'balanced',
      paragraphs: [
        {
          id: 'para-1',
          lines: Array.from({ length: 20 }, () => createLine()),
          style: { lastLine: 'justify', widows: 2, orphans: 2 },
        },
      ],
    };

    const result = layoutSection(section, defaultConfig);

    const page = result.pages[0];
    if (!page) {
      throw new Error('Page is undefined');
    }

    // With 20 lines, perfect balance is 10+10 (delta = 0)
    expect(page.isBalanced).toBe(true);
    expect(page.bottomDelta).toBe(0);
  });

  it('should respect paragraph boundaries when splitting', () => {
    const section: LayoutSection = {
      id: 'test-section',
      kind: 'body',
      balancePolicy: 'balanced',
      paragraphs: [
        {
          id: 'para-1',
          lines: Array.from({ length: 10 }, () => createLine()),
          style: { lastLine: 'justify', widows: 2, orphans: 2 },
        },
        {
          id: 'para-2',
          lines: Array.from({ length: 10 }, () => createLine()),
          style: { lastLine: 'justify', widows: 2, orphans: 2 },
        },
      ],
    };

    const result = layoutSection(section, defaultConfig);

    const page = result.pages[0];
    if (!page) {
      throw new Error('Page is undefined');
    }

    // Segments should reference correct paragraphs
    const allSegments = [
      ...page.rightColumn.segments,
      ...page.leftColumn.segments,
    ];

    // Should have segments from both paragraphs
    const para1Segments = allSegments.filter(s => s.paragraphId === 'para-1');
    const para2Segments = allSegments.filter(s => s.paragraphId === 'para-2');

    expect(para1Segments.length).toBeGreaterThan(0);
    expect(para2Segments.length).toBeGreaterThan(0);
  });
});


describe('Section Balancer - Stage B: Alternative Breaks (Section 4)', () => {
  const mockRun: ShapedRun = {
    font: 'Ezra SIL',
    size: 12000,
    glyphs: [],
    direction: 'rtl',
    width: 50000,
  };

  const createLine = (): ShapedRun[] => [mockRun];

  const defaultConfig: SectionLayoutConfig = {
    maxLinesPerColumn: 50,
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

  it('should attempt alternative breaks when stage A fails', () => {
    // Note: Now that implementation is real, alternatives ARE applied
    const section: LayoutSection = {
      id: 'test-section',
      kind: 'body',
      balancePolicy: 'balanced',
      paragraphs: [
        {
          id: 'para-1',
          lines: Array.from({ length: 51 }, () => createLine()),
          style: { lastLine: 'justify', widows: 2, orphans: 2 },
          // Provide mock alternatives
          alternativeBreaks: [
            {
              lines: Array.from({ length: 50 }, () => createLine()),
              wordSpacingPercent: 95,
              quality: 0.9,
            },
          ],
        },
      ],
    };

    const result = layoutSection(section, defaultConfig);

    // Alternative was applied
    expect(result.pages.length).toBeGreaterThan(0);
    
    // Should HAVE ALTERNATIVE_BREAK_USED since alternative was applied
    const altUsedDiag = result.diagnostics.find(
      d => d.code === 'ALTERNATIVE_BREAK_USED'
    );
    expect(altUsedDiag).toBeDefined();
  });

  it('should not create ALTERNATIVE_BREAK_USED diagnostic when no alternative applied', () => {
    // Paragraph without alternatives
    const section: LayoutSection = {
      id: 'test-section',
      kind: 'body',
      balancePolicy: 'balanced',
      paragraphs: [
        {
          id: 'para-1',
          lines: Array.from({ length: 51 }, () => createLine()),
          style: { lastLine: 'justify', widows: 2, orphans: 2 },
        },
      ],
    };

    const result = layoutSection(section, defaultConfig);

    // Should NOT create diagnostic for alternatives that weren't used
    const altUsedDiag = result.diagnostics.find(
      d => d.code === 'ALTERNATIVE_BREAK_USED'
    );
    expect(altUsedDiag).toBeUndefined();
  });

  it('should create ALTERNATIVE_BREAK_USED diagnostic when alternative is applied', () => {
    // Create a scenario where alternative helps balance
    // 51 lines with alternative that reduces to 50
    const section: LayoutSection = {
      id: 'test-section',
      kind: 'body',
      balancePolicy: 'balanced',
      paragraphs: [
        {
          id: 'para-1',
          lines: Array.from({ length: 51 }, () => createLine()),
          style: { lastLine: 'justify', widows: 2, orphans: 2 },
          alternativeBreaks: [
            {
              lines: Array.from({ length: 50 }, () => createLine()),
              wordSpacingPercent: 85,
              quality: 0.9,
            },
          ],
        },
      ],
    };

    const result = layoutSection(section, defaultConfig);

    // Alternative was applied, so diagnostic should exist
    const altUsedDiag = result.diagnostics.find(
      d => d.code === 'ALTERNATIVE_BREAK_USED'
    );
    
    expect(altUsedDiag).toBeDefined();
    expect(altUsedDiag?.paragraphId).toBe('para-1');
  });
});
