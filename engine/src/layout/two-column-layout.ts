/**
 * Two-column layout algorithm for Hebrew text.
 * Distributes lines across two columns of equal width.
 * 
 * Hebrew books typically use two columns per page:
 * - Right column (עמודה ימנית) filled first
 * - Left column (עמודה שמאלית) filled second
 * - Gap between columns (מרווח בין עמודות)
 */

import type { ShapedWord } from '../line-breaking/greedy-breaker';

export interface Column {
  /** Lines in this column, in visual order (RTL) */
  lines: ShapedWord[][];
  /** Y-position of each line from top of column (in points) */
  lineYPositions: number[];
  /** Total height used by this column (in points) */
  usedHeight: number;
}

export interface TwoColumnLayout {
  /** Right column (filled first for Hebrew RTL) */
  rightColumn: Column;
  /** Left column (filled second) */
  leftColumn: Column;
  /** Total page height (in points) */
  pageHeight: number;
  /** Whether all lines fit on page */
  fitsOnPage: boolean;
  /** Lines that didn't fit (overflow) */
  overflow: ShapedWord[][];
}

export interface TwoColumnLayoutOptions {
  /** Page height in points */
  pageHeight: number;
  /** Line height (baseline-to-baseline) in points */
  lineHeight: number;
  /** Gap between columns in points (default: 14pt) */
  columnGap?: number;
  /** Top margin in points (default: 0) */
  topMargin?: number;
  /** Bottom margin in points (default: 0) */
  bottomMargin?: number;
}

/**
 * Layout lines into two columns.
 * 
 * Algorithm:
 * 1. Calculate available height (pageHeight - topMargin - bottomMargin)
 * 2. Calculate max lines per column (availableHeight / lineHeight)
 * 3. Fill right column first, then left column
 * 4. Track overflow if lines exceed both columns
 * 
 * @param lines Array of lines (each line is array of shaped words)
 * @param options Layout configuration
 * @returns Two-column layout with positions
 */
export function layoutTwoColumns(
  lines: ShapedWord[][],
  options: TwoColumnLayoutOptions
): TwoColumnLayout {
  const {
    pageHeight,
    lineHeight,
    columnGap = 14, // Used indirectly via external callers (getColumnXPosition, calculateColumnWidth)
    topMargin = 0,
    bottomMargin = 0,
  } = options;

  // Note: columnGap is stored but not used directly in this function
  // because layoutTwoColumns only handles vertical distribution.
  // Horizontal positioning (which needs columnGap) is done by callers
  // using getColumnXPosition and calculateColumnWidth.
  void columnGap; // Mark as intentionally unused in this scope

  const availableHeight = pageHeight - topMargin - bottomMargin;
  const maxLinesPerColumn = Math.floor(availableHeight / lineHeight);

  // Split lines into right and left columns
  const rightColumnLines = lines.slice(0, maxLinesPerColumn);
  const leftColumnLines = lines.slice(maxLinesPerColumn, maxLinesPerColumn * 2);
  const overflowLines = lines.slice(maxLinesPerColumn * 2);

  // Calculate Y positions for right column
  const rightYPositions: number[] = [];
  for (let i = 0; i < rightColumnLines.length; i++) {
    rightYPositions.push(topMargin + i * lineHeight);
  }

  // Calculate Y positions for left column
  const leftYPositions: number[] = [];
  for (let i = 0; i < leftColumnLines.length; i++) {
    leftYPositions.push(topMargin + i * lineHeight);
  }

  const rightColumn: Column = {
    lines: rightColumnLines,
    lineYPositions: rightYPositions,
    usedHeight: rightColumnLines.length * lineHeight,
  };

  const leftColumn: Column = {
    lines: leftColumnLines,
    lineYPositions: leftYPositions,
    usedHeight: leftColumnLines.length * lineHeight,
  };

  const fitsOnPage = overflowLines.length === 0;

  return {
    rightColumn,
    leftColumn,
    pageHeight,
    fitsOnPage,
    overflow: overflowLines,
  };
}

/**
 * Calculate X position for a column.
 * 
 * For RTL Hebrew layout:
 * - Right column starts at pageWidth - rightMargin - columnWidth
 * - Left column starts at leftMargin
 * 
 * @param columnIndex 0 = right column, 1 = left column
 * @param pageWidth Total page width in points
 * @param columnWidth Width of each column in points
 * @param leftMargin Left page margin in points
 * @param rightMargin Right page margin in points
 * @param columnGap Gap between columns in points
 * @returns X position for column start (left edge)
 */
export function getColumnXPosition(
  columnIndex: 0 | 1,
  pageWidth: number,
  columnWidth: number,
  leftMargin: number,
  rightMargin: number,
  _columnGap: number
): number {
  if (columnIndex === 0) {
    // Right column: starts from right side
    return pageWidth - rightMargin - columnWidth;
  } else {
    // Left column: starts from left side
    return leftMargin;
  }
}

/**
 * Calculate column width given page width and margins.
 * 
 * Formula: (pageWidth - leftMargin - rightMargin - columnGap) / 2
 */
export function calculateColumnWidth(
  pageWidth: number,
  leftMargin: number,
  rightMargin: number,
  columnGap: number
): number {
  const availableWidth = pageWidth - leftMargin - rightMargin - columnGap;
  return availableWidth / 2;
}
