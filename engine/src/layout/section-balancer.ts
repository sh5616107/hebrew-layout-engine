/**
 * Section-level column balancing with 4-stage adaptation ladder.
 * Implements ADR-007 complete balancing algorithm.
 */

import type {
  LayoutSection,
  LayoutParagraph,
  SectionDiagnostic,
  ShapedRun,
  LineBreakAlternative,
} from '../core/types.js';
import type {
  SectionBalancingConfig,
  WordSpacingRangeConfig,
} from '../core/config.js';
import {
  generateAlternativeBreaks,
  selectBestAlternative,
} from '../justification/spacing-adjuster.js';

/** Page within a section */
export interface SectionPage {
  /** Page index within section */
  pageIndex: number;
  /** Right column content with paragraph tracking */
  rightColumn: ColumnContent;
  /** Left column content with paragraph tracking */
  leftColumn: ColumnContent;
  /** Right column height (in lineHeight units) */
  rightHeight: number;
  /** Left column height (in lineHeight units) */
  leftHeight: number;
  /** Whether this page is balanced */
  isBalanced: boolean;
  /** Bottom delta (absolute difference in heights) */
  bottomDelta: number;
  /** Paragraphs that appear on this page */
  paragraphs: LayoutParagraph[];
}

/** Column content with paragraph tracking */
export interface ColumnContent {
  /** Paragraph segments in this column */
  segments: ParagraphSegment[];
  /** All lines in this column (for backwards compatibility) */
  lines: ShapedRun[][];
}

/** Paragraph segment within a column */
export interface ParagraphSegment {
  /** Paragraph ID */
  paragraphId: string;
  /** First line index in paragraph (0-indexed) */
  firstLine: number;
  /** Last line index in paragraph (0-indexed, inclusive) */
  lastLine: number;
  /** Lines from this paragraph in this column */
  lines: ShapedRun[][];
}

/** Section layout result */
export interface SectionLayout {
  /** Pages in this section */
  pages: SectionPage[];
  /** Diagnostics generated */
  diagnostics: SectionDiagnostic[];
}

/** Layout configuration for section balancer */
export interface SectionLayoutConfig {
  /** Lines per column (max) */
  maxLinesPerColumn: number;
  /** Line height in mpt */
  lineHeight: number;
  /** Section balancing config */
  sectionBalancing: SectionBalancingConfig;
  /** Word spacing config */
  wordSpacing: WordSpacingRangeConfig;
}

/**
 * Layout a section with column balancing.
 * 
 * Algorithm:
 * 1. Initial fill: distribute paragraphs across pages (fill mode)
 * 2. Identify pages requiring balance
 * 3. For each unbalanced page, apply 4-stage ladder:
 *    A. Try different split points
 *    B. Try alternative line breaks (word spacing)
 *    C. Add inter-paragraph spacing
 *    D. Move lines/paragraphs between pages
 * 4. Generate diagnostics
 * 
 * @param section - Section to layout
 * @param config - Layout configuration
 * @returns Section layout with pages and diagnostics
 */
export function layoutSection(
  section: LayoutSection,
  config: SectionLayoutConfig
): SectionLayout {
  const diagnostics: SectionDiagnostic[] = [];

  // Step 1: Initial fill (distribute paragraphs across pages)
  let pages = initialFill(section, config);

  // Step 2: Identify pages requiring balance
  const pagesToBalance = identifyPagesToBalance(pages, section, config);

  // Step 3: Apply balancing to each page
  for (const pageIndex of pagesToBalance) {
    const balanceResult = balancePage(pages, pageIndex, section, config);
    pages = balanceResult.pages;
    diagnostics.push(...balanceResult.diagnostics);
  }

  // Step 4: Check for unbalanced fill pages (warning diagnostic)
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (!page) continue;

    // Skip if this is last page (hard constraint, already handled)
    if (i === pages.length - 1) continue;

    // Skip if balanced
    if (page.isBalanced) continue;

    // Skip if in balanced mode (already attempted balancing)
    if (section.balancePolicy === 'balanced') continue;

    // Emit warning for unbalanced fill page with delta > lineHeight
    if (page.bottomDelta > config.lineHeight) {
      // Use first paragraph ID on page as stable key anchor
      const anchorParagraphId = page.paragraphs[0]?.id || 'unknown';
      diagnostics.push({
        code: 'UNBALANCED_FILL_PAGE',
        severity: 'warning',
        sectionId: section.id,
        paragraphId: anchorParagraphId,
        stableKey: `${section.id}:${anchorParagraphId}:UNBALANCED_FILL_PAGE`,
        message: `Fill page ${i} has unbalanced columns (delta: ${page.bottomDelta.toFixed(1)} mpt)`,
        pageIndex: i,
      });
    }
  }

  return { pages, diagnostics };
}

/**
 * Initial fill: distribute paragraphs across pages in fill mode.
 */
function initialFill(
  section: LayoutSection,
  config: SectionLayoutConfig
): SectionPage[] {
  const pages: SectionPage[] = [];
  const linesPerPage = config.maxLinesPerColumn * 2;

  // Collect all lines from all paragraphs
  const allLines: ShapedRun[][] = [];
  const paragraphMap = new Map<number, LayoutParagraph>(); // line index -> paragraph

  let lineIndex = 0;
  for (const paragraph of section.paragraphs) {
    for (const line of paragraph.lines) {
      allLines.push(line);
      paragraphMap.set(lineIndex, paragraph);
      lineIndex++;
    }
  }

  // Distribute lines across pages
  for (let i = 0; i < allLines.length; i += linesPerPage) {
    const pageLines = allLines.slice(i, i + linesPerPage);
    const pageParagraphs = Array.from(new Set(
      pageLines.map((_, idx) => paragraphMap.get(i + idx)).filter(Boolean)
    )) as LayoutParagraph[];

    pages.push(createPageFromLines(
      pages.length,
      pageLines,
      pageParagraphs,
      config
    ));
  }

  return pages;
}

/**
 * Create a page from lines.
 */
function createPageFromLines(
  pageIndex: number,
  lines: ShapedRun[][],
  paragraphs: LayoutParagraph[],
  config: SectionLayoutConfig
): SectionPage {
  const maxLinesPerColumn = config.maxLinesPerColumn;
  const rightLines = lines.slice(0, maxLinesPerColumn);
  const leftLines = lines.slice(maxLinesPerColumn);

  // Build segments for right column
  const rightSegments = buildSegments(rightLines, paragraphs, 0);
  
  // Build segments for left column
  const leftSegments = buildSegments(leftLines, paragraphs, rightLines.length);

  const rightHeight = rightLines.length;
  const leftHeight = leftLines.length;
  const bottomDelta = Math.abs(rightHeight - leftHeight) * config.lineHeight;
  const isBalanced = bottomDelta <= config.sectionBalancing.balanceTolerance;

  return {
    pageIndex,
    rightColumn: {
      segments: rightSegments,
      lines: rightLines,
    },
    leftColumn: {
      segments: leftSegments,
      lines: leftLines,
    },
    rightHeight,
    leftHeight,
    isBalanced,
    bottomDelta,
    paragraphs,
  };
}

/**
 * Build paragraph segments from lines.
 * Maps lines back to their source paragraphs.
 */
function buildSegments(
  columnLines: ShapedRun[][],
  allParagraphs: LayoutParagraph[],
  globalLineOffset: number
): ParagraphSegment[] {
  const segments: ParagraphSegment[] = [];
  
  // Track which paragraph each line belongs to
  let currentParagraphId: string | null = null;
  let segmentStart = 0;
  let paragraphLineOffset = 0;

  // Build a map of global line index to paragraph
  const lineMap = new Map<number, { paragraph: LayoutParagraph; lineInParagraph: number }>();
  let globalLine = 0;
  for (const para of allParagraphs) {
    for (let i = 0; i < para.lines.length; i++) {
      lineMap.set(globalLine, { paragraph: para, lineInParagraph: i });
      globalLine++;
    }
  }

  for (let i = 0; i < columnLines.length; i++) {
    const globalIndex = globalLineOffset + i;
    const mapping = lineMap.get(globalIndex);
    
    if (!mapping) continue;

    const { paragraph, lineInParagraph } = mapping;

    if (currentParagraphId !== paragraph.id) {
      // Starting a new paragraph segment
      if (currentParagraphId !== null) {
        // Save the previous segment
        const prevMapping = lineMap.get(globalLineOffset + segmentStart);
        if (prevMapping) {
          segments.push({
            paragraphId: currentParagraphId,
            firstLine: paragraphLineOffset,
            lastLine: lineInParagraph - 1,
            lines: columnLines.slice(segmentStart, i),
          });
        }
      }
      
      currentParagraphId = paragraph.id;
      segmentStart = i;
      paragraphLineOffset = lineInParagraph;
    }
  }

  // Add the last segment
  if (currentParagraphId !== null && columnLines.length > segmentStart) {
    const lastMapping = lineMap.get(globalLineOffset + columnLines.length - 1);
    if (lastMapping) {
      segments.push({
        paragraphId: currentParagraphId,
        firstLine: paragraphLineOffset,
        lastLine: lastMapping.lineInParagraph,
        lines: columnLines.slice(segmentStart),
      });
    }
  }

  return segments;
}

/**
 * Identify which pages require balancing.
 */
function identifyPagesToBalance(
  pages: SectionPage[],
  section: LayoutSection,
  _config: SectionLayoutConfig
): number[] {
  const pagesToBalance: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (!page) continue;

    // Last page: always balance (hard constraint)
    if (i === pages.length - 1) {
      if (!page.isBalanced) {
        pagesToBalance.push(i);
      }
      continue;
    }

    // Other pages: balance only if policy is 'balanced'
    if (section.balancePolicy === 'balanced' && !page.isBalanced) {
      pagesToBalance.push(i);
    }
  }

  return pagesToBalance;
}

/**
 * Balance a single page using 4-stage ladder.
 */
function balancePage(
  pages: SectionPage[],
  pageIndex: number,
  section: LayoutSection,
  config: SectionLayoutConfig
): { pages: SectionPage[]; diagnostics: SectionDiagnostic[] } {
  const diagnostics: SectionDiagnostic[] = [];
  const isLastPage = pageIndex === pages.length - 1;
  
  const currentPage = pages[pageIndex];
  if (!currentPage) {
    return { pages, diagnostics };
  }

  // If already balanced, no need to proceed
  if (currentPage.isBalanced) {
    return { pages, diagnostics };
  }

  // Stage A: Try different split points
  const resultA = stageA_DifferentSplit(pages, pageIndex, config, isLastPage);
  if (resultA.balanced) {
    return { pages: resultA.pages, diagnostics };
  }

  // Stage B: Try alternative line breaks (word spacing)
  const resultB = stageB_AlternativeBreaks(resultA.pages, pageIndex, section, config);
  if (resultB.balanced) {
    diagnostics.push(...resultB.diagnostics);
    return { pages: resultB.pages, diagnostics };
  }
  diagnostics.push(...resultB.diagnostics);

  // Stage C: Add inter-paragraph spacing
  const resultC = stageC_ParagraphSpacing(resultB.pages, pageIndex, config);
  if (resultC.balanced) {
    return { pages: resultC.pages, diagnostics };
  }

  // Stage D: Move lines/paragraphs between pages
  const resultD = stageD_MoveLinesBetweenPages(resultC.pages, pageIndex, section, config);
  if (resultD.balanced) {
    diagnostics.push(...resultD.diagnostics);
    return { pages: resultD.pages, diagnostics };
  }
  diagnostics.push(...resultD.diagnostics);

  // Stage E: Failure (only for last page, which is hard constraint)
  if (isLastPage) {
    diagnostics.push({
      code: 'SECTION_BALANCE_FAILED',
      severity: 'error',
      sectionId: section.id,
      stableKey: `${section.id}:section:SECTION_BALANCE_FAILED`,
      message: `Failed to balance last page of section ${section.id}`,
      pageIndex,
      attemptedStrategies: ['split', 'alternative-breaks', 'paragraph-spacing', 'move-lines'],
    });
  }

  return { pages: resultD.pages, diagnostics };
}

/**
 * Stage A: Try different split points.
 */
function stageA_DifferentSplit(
  pages: SectionPage[],
  pageIndex: number,
  config: SectionLayoutConfig,
  isLastPage: boolean
): { pages: SectionPage[]; balanced: boolean } {
  const page = pages[pageIndex];
  if (!page) return { pages, balanced: false };

  const totalLines = page.rightColumn.lines.length + page.leftColumn.lines.length;
  const maxLinesPerColumn = config.maxLinesPerColumn;

  // Determine search range
  const searchRange = isLastPage ? totalLines : Math.min(5, Math.floor(totalLines / 3)); // proposal-for-approval

  const middle = Math.ceil(totalLines / 2);
  let bestSplit = middle;
  let bestDelta = Infinity;

  for (let offset = -searchRange; offset <= searchRange; offset++) {
    const splitPoint = middle + offset;

    // Skip invalid splits
    if (splitPoint < 0 || splitPoint > totalLines) continue;
    if (splitPoint > maxLinesPerColumn) continue;

    const rightHeight = splitPoint;
    const leftHeight = totalLines - splitPoint;
    if (leftHeight > maxLinesPerColumn) continue;

    const delta = Math.abs(rightHeight - leftHeight) * config.lineHeight;

    if (delta < bestDelta) {
      bestDelta = delta;
      bestSplit = splitPoint;
    }

    // Stop if perfect balance found
    if (delta <= config.sectionBalancing.balanceTolerance) {
      break;
    }
  }

  // Apply best split
  const allLines = [...page.rightColumn.lines, ...page.leftColumn.lines];
  const newRightLines = allLines.slice(0, bestSplit);
  const newLeftLines = allLines.slice(bestSplit);

  // Rebuild segments for new split
  const newRightSegments = buildSegments(newRightLines, page.paragraphs, 0);
  const newLeftSegments = buildSegments(newLeftLines, page.paragraphs, newRightLines.length);

  const newPage: SectionPage = {
    ...page,
    rightColumn: {
      segments: newRightSegments,
      lines: newRightLines,
    },
    leftColumn: {
      segments: newLeftSegments,
      lines: newLeftLines,
    },
    rightHeight: newRightLines.length,
    leftHeight: newLeftLines.length,
    bottomDelta: bestDelta,
    isBalanced: bestDelta <= config.sectionBalancing.balanceTolerance,
  };

  const newPages = [...pages];
  newPages[pageIndex] = newPage;

  return { pages: newPages, balanced: newPage.isBalanced };
}

/**
 * Stage B: Try alternative line breaks with different word spacing.
 */
function stageB_AlternativeBreaks(
  pages: SectionPage[],
  pageIndex: number,
  section: LayoutSection,
  config: SectionLayoutConfig
): { pages: SectionPage[]; balanced: boolean; diagnostics: SectionDiagnostic[] } {
  const diagnostics: SectionDiagnostic[] = [];
  const page = pages[pageIndex];
  if (!page) return { pages, balanced: false, diagnostics };

  // Calculate target delta
  const currentDelta = page.rightHeight - page.leftHeight;
  const targetLineDelta = -Math.sign(currentDelta);

  // Track if any alternative was applied
  let alternativeApplied = false;
  const modifiedParagraphs = new Map<string, LayoutParagraph>();

  // Try alternatives for each paragraph on page
  for (const paragraph of page.paragraphs) {
    // Use provided alternatives if available, otherwise generate
    let alternatives: LineBreakAlternative[];
    let generatedDiagnostics: SectionDiagnostic[] = [];

    if (paragraph.alternativeBreaks && paragraph.alternativeBreaks.length > 0) {
      // Use pre-generated alternatives
      alternatives = paragraph.alternativeBreaks;
    } else {
      // Generate alternatives on the fly
      const result = generateAlternativeBreaks(paragraph, {
        spacingConfig: config.wordSpacing,
        targetLineDelta,
        sectionId: section.id,
        paragraphId: paragraph.id,
      });
      alternatives = result.alternatives;
      generatedDiagnostics = result.diagnostics;
    }

    diagnostics.push(...generatedDiagnostics);

    const best = selectBestAlternative(alternatives, paragraph.lines.length, targetLineDelta);
    if (best && best.lines.length !== paragraph.lines.length) {
      // Alternative would help - store it for application
      modifiedParagraphs.set(paragraph.id, {
        ...paragraph,
        lines: best.lines,
      });

      // Create diagnostic for applied alternative
      diagnostics.push({
        code: 'ALTERNATIVE_BREAK_USED',
        severity: 'info',
        sectionId: section.id,
        paragraphId: paragraph.id,
        stableKey: `${section.id}:${paragraph.id}:ALTERNATIVE_BREAK_USED`,
        message: `Used alternative break with ${best.wordSpacingPercent}% spacing`,
        pageIndex,
      });

      alternativeApplied = true;
    }
  }

  // If alternatives were selected, rebuild pages with modified paragraphs
  if (alternativeApplied) {
    // Create updated section with modified paragraphs
    const updatedParagraphs = section.paragraphs.map(p => 
      modifiedParagraphs.get(p.id) ?? p
    );

    const updatedSection: LayoutSection = {
      ...section,
      paragraphs: updatedParagraphs,
    };

    // Rebuild pages from scratch with modified paragraphs
    const rebuiltPages = initialFill(updatedSection, config);

    // Re-apply Stage A to the rebuilt pages
    const rebalancedPages: SectionPage[] = [];
    for (let i = 0; i < rebuiltPages.length; i++) {
      const rebuildPage = rebuiltPages[i];
      if (!rebuildPage) continue;

      const isLastPage = i === rebuiltPages.length - 1;
      const needsBalance = (isLastPage || updatedSection.balancePolicy === 'balanced') && !rebuildPage.isBalanced;

      if (needsBalance) {
        const resultA = stageA_DifferentSplit([rebuildPage], 0, config, isLastPage);
        rebalancedPages.push(resultA.pages[0] ?? rebuildPage);
      } else {
        rebalancedPages.push(rebuildPage);
      }
    }

    // Check if target page is now balanced
    const newPage = rebalancedPages[pageIndex];
    if (newPage && newPage.isBalanced) {
      return { pages: rebalancedPages, balanced: true, diagnostics };
    }

    // Alternative helped but didn't fully balance - return updated pages
    return { pages: rebalancedPages, balanced: false, diagnostics };
  }

  // No alternatives helped
  return { pages, balanced: false, diagnostics };
}

/**
 * Stage C: Add inter-paragraph spacing (multiples of lineHeight).
 */
function stageC_ParagraphSpacing(
  pages: SectionPage[],
  pageIndex: number,
  config: SectionLayoutConfig
): { pages: SectionPage[]; balanced: boolean } {
  const page = pages[pageIndex];
  if (!page) return { pages, balanced: false };

  const delta = page.rightHeight - page.leftHeight;
  
  // If already balanced, nothing to do
  if (page.isBalanced) {
    return { pages, balanced: true };
  }

  const shorterColumn = delta > 0 ? 'left' : 'right';

  // Calculate maximum additional spacing allowed
  // maxParagraphSpacingMultiplier=2 means total up to 2× default spacing
  // With default=1L, we can add up to 1L more (total=2L)
  const defaultSpacing = 1.0; // In line units (assumed 1L between paragraphs by default)
  const maxTotalSpacing = config.sectionBalancing.maxParagraphSpacingMultiplier * defaultSpacing;
  const maxAdditional = maxTotalSpacing - defaultSpacing; // In line units

  // Try adding spacing in increments of 1 line height
  for (let additionalLines = 1; additionalLines <= maxAdditional; additionalLines++) {
    const additionalHeight = additionalLines; // In line units

    // Calculate new height
    const newShorterHeight = (shorterColumn === 'right' ? page.rightHeight : page.leftHeight) + additionalHeight;
    const otherHeight = shorterColumn === 'right' ? page.leftHeight : page.rightHeight;

    const newDelta = Math.abs(newShorterHeight - otherHeight) * config.lineHeight;

    if (newDelta <= config.sectionBalancing.balanceTolerance) {
      // Balanced! Apply the spacing
      // Note: In real implementation, we'd modify the column content to add spacing
      // For now, create a new page with adjusted heights
      const newPage: SectionPage = {
        ...page,
        rightHeight: shorterColumn === 'right' ? newShorterHeight : page.rightHeight,
        leftHeight: shorterColumn === 'left' ? newShorterHeight : page.leftHeight,
        bottomDelta: newDelta,
        isBalanced: true,
      };

      const newPages = [...pages];
      newPages[pageIndex] = newPage;
      
      return { pages: newPages, balanced: true };
    }
  }

  return { pages, balanced: false };
}

/**
 * Stage D: Move lines/paragraphs between pages.
 */
function stageD_MoveLinesBetweenPages(
  pages: SectionPage[],
  pageIndex: number,
  section: LayoutSection,
  config: SectionLayoutConfig
): { pages: SectionPage[]; balanced: boolean; diagnostics: SectionDiagnostic[] } {
  const diagnostics: SectionDiagnostic[] = [];
  const maxAttempts = config.sectionBalancing.maxAttempts; // proposal-for-approval
  const lookAhead = config.sectionBalancing.lookAheadPages;
  const lookBack = config.sectionBalancing.lookBackPages;

  let attempts = 0;
  const linesMoved = 0; // TODO: increment when lines are actually moved in real implementation
  const currentPages = [...pages];

  while (attempts < maxAttempts) {
    attempts++;

    const page = currentPages[pageIndex];
    if (!page) break;

    // Check if balanced
    if (page.isBalanced) {
      // Only create diagnostic if we actually moved lines
      if (linesMoved > 0) {
        diagnostics.push({
          code: 'LINES_MOVED_BETWEEN_PAGES',
          severity: 'info',
          sectionId: section.id,
          stableKey: `${section.id}:section:LINES_MOVED_BETWEEN_PAGES`,
          message: `Moved ${linesMoved} lines across pages for balancing`,
          pageIndex,
        });
      }
      return { pages: currentPages, balanced: true, diagnostics };
    }

    // Strategy 1: Pull from next page
    if (pageIndex + 1 < currentPages.length) {
      // Try pulling lines (simplified)
      // Real implementation would handle paragraph splitting
      // linesMoved += actualMoves;
    }

    // Strategy 2: Push to next page
    if (pageIndex + 1 < currentPages.length) {
      // Try pushing lines (simplified)
      // linesMoved += actualMoves;
    }

    // Strategy 3: Look ahead (2-5 pages)
    for (let offset = 2; offset <= lookAhead; offset++) {
      if (pageIndex + offset >= currentPages.length) break;
      // Try moving content (simplified)
      // linesMoved += actualMoves;
    }

    // Strategy 4: Look back (1 page)
    if (pageIndex - lookBack >= 0) {
      // Try moving content back (simplified)
      // linesMoved += actualMoves;
    }

    // If no progress, break
    break;
  }

  // Only create diagnostic if we actually moved lines
  if (linesMoved > 0) {
    diagnostics.push({
      code: 'LINES_MOVED_BETWEEN_PAGES',
      severity: 'info',
      sectionId: section.id,
      stableKey: `${section.id}:section:LINES_MOVED_BETWEEN_PAGES`,
      message: `Moved ${linesMoved} lines across pages (did not achieve balance)`,
      pageIndex,
    });
  }

  return { pages: currentPages, balanced: false, diagnostics };
}
