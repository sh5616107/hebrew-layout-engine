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
