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
  /** Balance quality metrics */
  balanceInfo?: {
    /** Difference in bottom position (mpt) - 0 is perfect */
    bottomDelta: number;
    /** Whether columns are balanced within tolerance */
    isBalanced: boolean;
    /** Balance quality score (0-1, higher is better) */
    quality: number;
  };
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
  /** Enable column balancing (default: false) */
  enableBalancing?: boolean;
  /** Balance tolerance in points (default: 0 for exact balance) */
  balanceTolerance?: number;
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

/**
 * Balance two columns to end at approximately the same height.
 * 
 * Simple M2 algorithm:
 * - Try different split points near the middle
 * - Choose the split that minimizes height difference
 * - Within tolerance threshold (default: 1 line height)
 * 
 * @param lines All lines to distribute
 * @param options Layout configuration with balancing enabled
 * @returns Balanced two-column layout
 */
export function layoutTwoColumnsBalanced(
  lines: ShapedWord[][],
  options: TwoColumnLayoutOptions & { enableBalancing: true }
): TwoColumnLayout {
  const {
    pageHeight,
    lineHeight,
    columnGap = 14,
    topMargin = 0,
    bottomMargin = 0,
    balanceTolerance = 0, // Default: perfect balance (changed from lineHeight)
  } = options;

  void columnGap; // Horizontal positioning done by callers
  
  // Calculate available height considering bottom margin
  const availableHeight = pageHeight - topMargin - bottomMargin;
  const maxLinesPerColumn = Math.floor(availableHeight / lineHeight);

  
  const totalLines = lines.length;
  
  // Check if content fits within page capacity
  const maxTotalLines = maxLinesPerColumn * 2;
  const overflow = totalLines > maxTotalLines ? lines.slice(maxTotalLines) : [];
  const linesToLayout = totalLines > maxTotalLines ? lines.slice(0, maxTotalLines) : lines;
  
  // If too few lines, use balanced split
  if (linesToLayout.length === 0) {
    return {
      rightColumn: { lines: [], lineYPositions: [], usedHeight: 0 },
      leftColumn: { lines: [], lineYPositions: [], usedHeight: 0 },
      pageHeight,
      fitsOnPage: overflow.length === 0,
      overflow,
      balanceInfo: {
        bottomDelta: 0,
        isBalanced: true,
        quality: 1,
      },
    };
  }
  
  if (linesToLayout.length === 1) {
    const line = linesToLayout[0];
    if (!line) {
      return {
        rightColumn: { lines: [], lineYPositions: [], usedHeight: 0 },
        leftColumn: { lines: [], lineYPositions: [], usedHeight: 0 },
        pageHeight,
        fitsOnPage: overflow.length === 0,
        overflow,
        balanceInfo: {
          bottomDelta: 0,
          isBalanced: true,
          quality: 1,
        },
      };
    }
    
    const rightColumn: Column = {
      lines: [line],
      lineYPositions: [topMargin],
      usedHeight: lineHeight,
    };
    
    // Calculate quality: single line means one column is empty
    // Quality degrades based on tolerance
    const bottomDelta = lineHeight;
    const quality = balanceTolerance === 0 
      ? 0 // Perfect balance required but not achieved
      : Math.max(0, 1 - bottomDelta / balanceTolerance);
    
    return {
      rightColumn,
      leftColumn: { lines: [], lineYPositions: [], usedHeight: 0 },
      pageHeight,
      fitsOnPage: overflow.length === 0,
      overflow,
      balanceInfo: {
        bottomDelta,
        isBalanced: bottomDelta <= balanceTolerance,
        quality,
      },
    };
  }
  
  if (linesToLayout.length === 2) {
    // Perfect 1+1 split
    const line0 = linesToLayout[0];
    const line1 = linesToLayout[1];
    if (!line0 || !line1) {
      return {
        rightColumn: { lines: [], lineYPositions: [], usedHeight: 0 },
        leftColumn: { lines: [], lineYPositions: [], usedHeight: 0 },
        pageHeight,
        fitsOnPage: overflow.length === 0,
        overflow,
        balanceInfo: {
          bottomDelta: 0,
          isBalanced: true,
          quality: 1,
        },
      };
    }
    
    const rightColumn: Column = {
      lines: [line0],
      lineYPositions: [topMargin],
      usedHeight: lineHeight,
    };
    const leftColumn: Column = {
      lines: [line1],
      lineYPositions: [topMargin],
      usedHeight: lineHeight,
    };
    return {
      rightColumn,
      leftColumn,
      pageHeight,
      fitsOnPage: overflow.length === 0,
      overflow,
      balanceInfo: {
        bottomDelta: 0,
        isBalanced: true,
        quality: 1,
      },
    };
  }

  // Try different split points around the middle
  // For Hebrew RTL, prefer MORE lines in right column when uneven
  const middle = Math.ceil(linesToLayout.length / 2); // Use ceil for RTL preference
  const searchRange = Math.min(3, Math.floor(linesToLayout.length / 3)); // Search ±3 lines from middle
  
  let bestSplit = middle;
  let bestDelta = Infinity;
  
  for (let offset = -searchRange; offset <= searchRange; offset++) {
    const splitPoint = middle + offset;
    
    // Skip invalid splits
    if (splitPoint < 0 || splitPoint > linesToLayout.length) continue;
    
    // Handle edge case: if splitPoint = linesToLayout.length, all lines go to right
    if (splitPoint === linesToLayout.length) {
      const rightHeight = linesToLayout.length * lineHeight;
      const leftHeight = 0;
      const delta = Math.abs(rightHeight - leftHeight);
      
      if (delta < bestDelta) {
        bestDelta = delta;
        bestSplit = splitPoint;
      }
      continue;
    }
    
    const rightHeight = splitPoint * lineHeight;
    const leftHeight = (linesToLayout.length - splitPoint) * lineHeight;
    const delta = Math.abs(rightHeight - leftHeight);
    
    // Prefer larger right column when deltas are equal (RTL convention)
    if (delta < bestDelta || (delta === bestDelta && splitPoint > bestSplit)) {
      bestDelta = delta;
      bestSplit = splitPoint;
    }
    
    // Stop if we found perfect balance
    if (delta === 0) break;
  }
  
  // Create layout with best split
  const rightColumnLines = linesToLayout.slice(0, bestSplit);
  const leftColumnLines = linesToLayout.slice(bestSplit);
  
  const rightYPositions: number[] = [];
  for (let i = 0; i < rightColumnLines.length; i++) {
    rightYPositions.push(topMargin + i * lineHeight);
  }
  
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
  
  const bottomDelta = Math.abs(rightColumn.usedHeight - leftColumn.usedHeight);
  const isBalanced = bottomDelta <= balanceTolerance;
  
  // Calculate quality based on balanceTolerance
  // If tolerance is 0, quality is 1 only for perfect balance, otherwise 0
  // If tolerance > 0, quality degrades linearly from 1 (perfect) to 0 (at tolerance)
  const quality = balanceTolerance === 0
    ? (bottomDelta === 0 ? 1 : 0)
    : Math.max(0, 1 - bottomDelta / balanceTolerance);
  
  return {
    rightColumn,
    leftColumn,
    pageHeight,
    fitsOnPage: overflow.length === 0,
    overflow,
    balanceInfo: {
      bottomDelta,
      isBalanced,
      quality,
    },
  };
}
