/**
 * Column width and gap calculations test.
 * Ensures columnGap parameter is properly used in layout calculations.
 */

import { describe, it, expect } from 'vitest';
import { calculateColumnWidth, getColumnXPosition } from '../../../src/layout/two-column-layout';

describe('Column Width and Gap Calculations', () => {
  it('should calculate correct column width with standard gap', () => {
    // Page: 432pt wide (B5), margins: 36pt each, gap: 14pt
    // Available: 432 - 36 - 36 - 14 = 346pt
    // Column width: 346 / 2 = 173pt
    const width = calculateColumnWidth(432, 36, 36, 14);
    expect(width).toBe(173);
  });

  it('should calculate correct column width with larger gap', () => {
    // Page: 432pt, margins: 36pt, gap: 28pt (double standard)
    // Available: 432 - 36 - 36 - 28 = 332pt
    // Column width: 332 / 2 = 166pt
    const width = calculateColumnWidth(432, 36, 36, 28);
    expect(width).toBe(166);
  });

  it('should calculate correct column width with no gap', () => {
    // Page: 432pt, margins: 36pt, gap: 0pt
    // Available: 432 - 36 - 36 - 0 = 360pt
    // Column width: 360 / 2 = 180pt
    const width = calculateColumnWidth(432, 36, 36, 0);
    expect(width).toBe(180);
  });

  it('should position right column correctly (RTL)', () => {
    // Right column (index 0) starts from right side
    // Page: 432pt, column width: 173pt, right margin: 36pt
    // X = 432 - 36 - 173 = 223pt
    const x = getColumnXPosition(0, 432, 173, 36, 36, 14);
    expect(x).toBe(223);
  });

  it('should position left column correctly (RTL)', () => {
    // Left column (index 1) starts from left side
    // X = left margin = 36pt
    const x = getColumnXPosition(1, 432, 173, 36, 36, 14);
    expect(x).toBe(36);
  });

  it('should respect gap in column positioning', () => {
    const pageWidth = 432;
    const columnWidth = 166; // With 28pt gap
    const leftMargin = 36;
    const rightMargin = 36;
    const gap = 28;

    const rightX = getColumnXPosition(0, pageWidth, columnWidth, leftMargin, rightMargin, gap);
    const leftX = getColumnXPosition(1, pageWidth, columnWidth, leftMargin, rightMargin, gap);

    // Right column ends at: rightX + columnWidth
    // Left column starts at: leftX
    // Gap between them: leftX - (rightX + columnWidth)
    // Note: In RTL, right column is at x=230, left at x=36
    // Gap is implicitly: 230 - (36 + 166) = 28pt

    // Verify right column position
    expect(rightX).toBe(230); // 432 - 36 - 166 = 230

    // Verify left column position  
    expect(leftX).toBe(36);

    // Verify gap (right column's left edge minus left column's right edge)
    const gapActual = rightX - (leftX + columnWidth);
    expect(gapActual).toBe(gap);
  });

  it('should have symmetric margins when gap changes', () => {
    const pageWidth = 432;
    const leftMargin = 36;
    const rightMargin = 36;

    // Test with different gaps
    const gaps = [0, 14, 28, 42];

    gaps.forEach(gap => {
      const columnWidth = calculateColumnWidth(pageWidth, leftMargin, rightMargin, gap);
      const rightX = getColumnXPosition(0, pageWidth, columnWidth, leftMargin, rightMargin, gap);
      const leftX = getColumnXPosition(1, pageWidth, columnWidth, leftMargin, rightMargin, gap);

      // Total width should match: leftMargin + columnWidth + gap + columnWidth + rightMargin
      const totalCalc = leftMargin + columnWidth + gap + columnWidth + rightMargin;
      expect(totalCalc).toBe(pageWidth);

      // Left column should start at left margin
      expect(leftX).toBe(leftMargin);

      // Right column should leave right margin
      const rightColumnRight = rightX + columnWidth;
      expect(pageWidth - rightColumnRight).toBe(rightMargin);
    });
  });
});
