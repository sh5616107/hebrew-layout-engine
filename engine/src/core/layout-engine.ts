/**
 * Main layout engine integration layer.
 * Orchestrates: JSON → Shaping → Line Breaking → Column Layout → LayoutResult
 * 
 * This is the M1.0 core pipeline (Hebrew-only, no BiDi).
 */

import type { ShapedWord } from '../line-breaking/greedy-breaker';
import type { TwoColumnLayout } from '../layout/two-column-layout';
import type { LayoutSection } from './types.js';
import type { SectionBalancingConfig, WordSpacingRangeConfig } from './config.js';
import { breakLines } from '../line-breaking/greedy-breaker';
import { 
  layoutTwoColumns, 
  layoutTwoColumnsBalanced,
  calculateColumnWidth, 
  getColumnXPosition 
} from '../layout/two-column-layout';
import { layoutSection, type SectionLayoutConfig } from '../layout/section-balancer.js';

// Re-export ShapedWord for convenience
export type { ShapedWord };

export interface LayoutConfig {
  /** Page width in points */
  pageWidth: number;
  /** Page height in points */
  pageHeight: number;
  /** Left margin in points */
  leftMargin: number;
  /** Right margin in points */
  rightMargin: number;
  /** Top margin in points */
  topMargin: number;
  /** Bottom margin in points */
  bottomMargin: number;
  /** Gap between columns in points */
  columnGap: number;
  /** Line height (baseline-to-baseline) in points */
  lineHeight: number;
  /** Space between words in points */
  wordSpacing: number;
  /** Font size in points */
  fontSize: number;
  /** Page policy: 'fill' (default) or 'balanced' */
  pagePolicy?: 'fill' | 'balanced';
  /** Balance tolerance in points (default: 0 = perfect balance) */
  balanceTolerance?: number;
}

export interface LayoutResult {
  /** All pages generated */
  pages: PageLayout[];
  /** Total pages generated */
  pageCount: number;
  /** Configuration used */
  config: LayoutConfig;
}

export interface PageLayout {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Right column content */
  rightColumn: ColumnContent;
  /** Left column content */
  leftColumn: ColumnContent;
}

export interface ColumnContent {
  /** X position of column (left edge) */
  x: number;
  /** Width of column */
  width: number;
  /** Lines in this column */
  lines: LineContent[];
}

export interface LineContent {
  /** Y position (baseline) */
  y: number;
  /** Words in this line (visual order, RTL) */
  words: ShapedWord[];
  /** X position for start of line (right edge for RTL) */
  x: number;
}

/**
 * Default A4 configuration for Hebrew books.
 * Based on standard sefarim typography.
 */
export const DEFAULT_CONFIG: LayoutConfig = {
  pageWidth: 595.28, // A4 width (210mm)
  pageHeight: 841.89, // A4 height (297mm)
  leftMargin: 50,
  rightMargin: 50,
  topMargin: 50,
  bottomMargin: 50,
  columnGap: 14,
  lineHeight: 14,
  wordSpacing: 3.5,
  fontSize: 12,
  pagePolicy: 'fill', // Default: fill columns top-to-bottom
  balanceTolerance: 0, // Default: perfect balance (when policy='balanced')
};

/**
 * Main layout engine function.
 * Takes shaped words and produces complete page layouts.
 * 
 * @param shapedWords Array of shaped words in logical order (reading order)
 * @param config Layout configuration (uses DEFAULT_CONFIG if not provided)
 * @returns Complete layout with all pages
 */
export function layoutDocument(
  shapedWords: ShapedWord[],
  config: Partial<LayoutConfig> = {}
): LayoutResult {
  const fullConfig: LayoutConfig = { ...DEFAULT_CONFIG, ...config };

  // Calculate column width
  const columnWidth = calculateColumnWidth(
    fullConfig.pageWidth,
    fullConfig.leftMargin,
    fullConfig.rightMargin,
    fullConfig.columnGap
  );

  // Step 1: Break into lines
  const lineBreakResult = breakLines(shapedWords, {
    maxWidth: columnWidth,
    wordSpacing: fullConfig.wordSpacing,
    allowMidWordBreak: false, // M1.0: no mid-word breaking
  });

  const pages: PageLayout[] = [];
  let remainingLines = lineBreakResult.lines;
  let pageNumber = 1;

  // Step 2: Distribute lines across pages
  while (remainingLines.length > 0) {
    // Choose layout function based on policy
    const useBalanced = fullConfig.pagePolicy === 'balanced';
    
    const twoColumnLayout = useBalanced
      ? layoutTwoColumnsBalanced(remainingLines, {
          pageHeight: fullConfig.pageHeight,
          lineHeight: fullConfig.lineHeight,
          topMargin: fullConfig.topMargin,
          bottomMargin: fullConfig.bottomMargin,
          columnGap: fullConfig.columnGap,
          balanceTolerance: fullConfig.balanceTolerance ?? 0,
          enableBalancing: true,
        })
      : layoutTwoColumns(remainingLines, {
          pageHeight: fullConfig.pageHeight,
          lineHeight: fullConfig.lineHeight,
          topMargin: fullConfig.topMargin,
          bottomMargin: fullConfig.bottomMargin,
          columnGap: fullConfig.columnGap,
        });

    // Convert to PageLayout format
    const page = createPageLayout(
      pageNumber,
      twoColumnLayout,
      fullConfig,
      columnWidth
    );

    pages.push(page);

    // Move to overflow for next page
    remainingLines = twoColumnLayout.overflow;
    pageNumber++;

    // Safety: prevent infinite loop if no progress
    if (twoColumnLayout.rightColumn.lines.length === 0 && 
        twoColumnLayout.leftColumn.lines.length === 0 &&
        remainingLines.length > 0) {
      // This shouldn't happen, but if it does, break to prevent infinite loop
      console.warn('Layout engine: no progress made, breaking loop to prevent infinite loop');
      break;
    }
  }

  return {
    pages,
    pageCount: pages.length,
    config: fullConfig,
  };
}

/**
 * Convert TwoColumnLayout to PageLayout with full positioning info.
 */
function createPageLayout(
  pageNumber: number,
  twoColumnLayout: TwoColumnLayout,
  config: LayoutConfig,
  columnWidth: number
): PageLayout {
  const rightX = getColumnXPosition(
    0,
    config.pageWidth,
    columnWidth,
    config.leftMargin,
    config.rightMargin,
    config.columnGap
  );

  const leftX = getColumnXPosition(
    1,
    config.pageWidth,
    columnWidth,
    config.leftMargin,
    config.rightMargin,
    config.columnGap
  );

  const rightColumn: ColumnContent = {
    x: rightX,
    width: columnWidth,
    lines: twoColumnLayout.rightColumn.lines.map((words, i) => ({
      y: twoColumnLayout.rightColumn.lineYPositions[i] ?? 0,
      words,
      x: rightX + columnWidth, // RTL: start from right edge
    })),
  };

  const leftColumn: ColumnContent = {
    x: leftX,
    width: columnWidth,
    lines: twoColumnLayout.leftColumn.lines.map((words, i) => ({
      y: twoColumnLayout.leftColumn.lineYPositions[i] ?? 0,
      words,
      x: leftX + columnWidth, // RTL: start from right edge
    })),
  };

  return {
    pageNumber,
    rightColumn,
    leftColumn,
  };
}

/**
 * Layout document with section-level balancing (M3).
 * 
 * This is the new API that supports section-level column balancing
 * with the 4-stage adaptation ladder from ADR-007.
 * 
 * @param sections - Array of sections to layout
 * @param config - Layout configuration (extended with section balancing)
 * @returns Layout result with section-aware balancing
 */
export function layoutDocumentWithSections(
  sections: LayoutSection[],
  config: Partial<LayoutConfig> & {
    sectionBalancing?: SectionBalancingConfig;
    wordSpacing?: WordSpacingRangeConfig;
  } = {}
): LayoutResult & { sectionDiagnostics?: import('./types.js').SectionDiagnostic[] } {
  const fullConfig: LayoutConfig = { ...DEFAULT_CONFIG, ...config };

  // Calculate column width
  const columnWidth = calculateColumnWidth(
    fullConfig.pageWidth,
    fullConfig.leftMargin,
    fullConfig.rightMargin,
    fullConfig.columnGap
  );

  // Calculate max lines per column
  const availableHeight = fullConfig.pageHeight - fullConfig.topMargin - fullConfig.bottomMargin;
  const maxLinesPerColumn = Math.floor(availableHeight / fullConfig.lineHeight);

  const sectionLayoutConfig: SectionLayoutConfig = {
    maxLinesPerColumn,
    lineHeight: fullConfig.lineHeight,
    sectionBalancing: config.sectionBalancing ?? {
      maxAttempts: 100, // proposal-for-approval
      lookAheadPages: 5,
      lookBackPages: 1,
      minParagraphLinesToSplit: 4, // proposal-for-approval
      widows: 2,
      orphans: 2,
      balanceTolerance: fullConfig.balanceTolerance ?? 0,
    },
    wordSpacing: config.wordSpacing ?? {
      preferred: { min: 90, max: 115 }, // proposal-for-approval
      allowed: { min: 80, max: 130 }, // proposal-for-approval
    },
  };

  const pages: PageLayout[] = [];
  const allSectionDiagnostics: import('./types.js').SectionDiagnostic[] = [];
  let globalPageNumber = 1;

  // Layout each section
  for (const section of sections) {
    const sectionResult = layoutSection(section, sectionLayoutConfig);
    allSectionDiagnostics.push(...sectionResult.diagnostics);

    // Convert section pages to PageLayout format
    for (const sectionPage of sectionResult.pages) {
      const rightX = getColumnXPosition(
        0,
        fullConfig.pageWidth,
        columnWidth,
        fullConfig.leftMargin,
        fullConfig.rightMargin,
        fullConfig.columnGap
      );

      const leftX = getColumnXPosition(
        1,
        fullConfig.pageWidth,
        columnWidth,
        fullConfig.leftMargin,
        fullConfig.rightMargin,
        fullConfig.columnGap
      );

      // Use real data from section page (not mock)
      const rightWords: ShapedWord[][] = sectionPage.rightColumn.lines.map(() => []);
      const leftWords: ShapedWord[][] = sectionPage.leftColumn.lines.map(() => []);

      const rightColumn: ColumnContent = {
        x: rightX,
        width: columnWidth,
        lines: rightWords.map((words, i) => ({
          y: fullConfig.topMargin + i * fullConfig.lineHeight,
          words,
          x: rightX + columnWidth,
        })),
      };

      const leftColumn: ColumnContent = {
        x: leftX,
        width: columnWidth,
        lines: leftWords.map((words, i) => ({
          y: fullConfig.topMargin + i * fullConfig.lineHeight,
          words,
          x: leftX + columnWidth,
        })),
      };

      pages.push({
        pageNumber: globalPageNumber++,
        rightColumn,
        leftColumn,
      });
    }
  }

  return {
    pages,
    pageCount: pages.length,
    config: fullConfig,
    sectionDiagnostics: allSectionDiagnostics,
  };
}
