/**
 * Paragraph splitting logic for section-level balancing.
 * Implements ADR-007 paragraph split rules.
 */

import type {
  LayoutParagraph,
  FootnoteRef,
} from '../core/types.js';
import type { SectionBalancingConfig } from '../core/config.js';

/**
 * Check if a paragraph can be split at all.
 * 
 * Rule: Paragraph must have at least 4 lines to allow splitting.
 * 
 * @param paragraph - Paragraph to check
 * @returns true if paragraph can be split
 */
export function canSplitParagraph(paragraph: LayoutParagraph): boolean {
  return paragraph.lines.length >= 4;
}

/**
 * Get valid split points for a paragraph.
 * 
 * Applies ADR-007 rules:
 * 1. Minimum 4 total lines to split
 * 2. At least `widows` lines at start of next page
 * 3. At least `orphans` lines at end of current page
 * 4. No split within opening window area (lines 0..windowLines-1)
 * 5. Centered last line stays with paragraph (not alone)
 * 
 * Split point N means: lines [0..N) stay on current page, lines [N..end) move to next page.
 * 
 * @param paragraph - Paragraph to get split points for
 * @param config - Section balancing configuration
 * @returns Array of valid split line indices (0-indexed)
 */
export function getSplitPoints(
  paragraph: LayoutParagraph,
  config: SectionBalancingConfig
): number[] {
  // Rule 1: Must have at least 4 lines
  if (!canSplitParagraph(paragraph)) {
    return [];
  }

  const totalLines = paragraph.lines.length;
  const { widows, orphans } = config;
  const splitPoints: number[] = [];

  // Calculate constraints
  const windowLines = paragraph.opening?.windowLines ?? 0;
  const hasCenteredLastLine = paragraph.style.lastLine === 'center';
  
  // Minimum split point: max(orphans, windowLines + 1)
  // - Must leave at least `orphans` lines on current page
  // - Must not split within window area (lines 0..windowLines-1)
  const minSplit = Math.max(orphans, windowLines > 0 ? windowLines + 1 : 1);
  
  // Maximum split point: totalLines - widows
  // - Must leave at least `widows` lines on next page
  // - If centered last line, must keep it with at least one other line
  let maxSplit = totalLines - widows;
  if (hasCenteredLastLine) {
    // Don't strand the centered last line alone on next page
    maxSplit = Math.min(maxSplit, totalLines - 2);
  }

  // Generate valid split points
  for (let i = minSplit; i <= maxSplit; i++) {
    // Check footnote constraint (Rule 5)
    if (paragraph.footnoteRefs && !canSplitAtWithFootnotes(i, paragraph.footnoteRefs, totalLines)) {
      continue;
    }
    
    splitPoints.push(i);
  }

  return splitPoints;
}

/**
 * Check if split at given line is valid considering footnote references.
 * 
 * Constraint: Footnote must stay on same page as its reference line.
 * Since we're moving lines [splitLine..end) to next page,
 * any footnote with lineIndex >= splitLine would move to next page.
 * This is allowed (the footnote moves with its reference).
 * 
 * @param splitLine - Split point to check
 * @param footnoteRefs - Footnote references in paragraph
 * @param totalLines - Total lines in paragraph
 * @returns true if split is valid
 */
function canSplitAtWithFootnotes(
  splitLine: number,
  footnoteRefs: FootnoteRef[],
  _totalLines: number
): boolean {
  // Footnotes are allowed to move with their reference lines
  // No additional constraint needed here
  // (footnotes will be moved in splitParagraph function)
  void _totalLines; // Mark as intentionally unused
  void splitLine;
  void footnoteRefs;
  return true;
}

/**
 * Split a paragraph at the given line index.
 * 
 * Creates two new paragraphs:
 * - `before`: lines [0..splitLine), stays on current page
 * - `after`: lines [splitLine..end), moves to next page
 * 
 * Footnote references are distributed:
 * - References in lines [0..splitLine) stay in `before`
 * - References in lines [splitLine..end) move to `after` (with adjusted lineIndex)
 * 
 * @param paragraph - Paragraph to split
 * @param splitLine - Line index to split at (0-indexed)
 * @returns Two paragraphs: before and after split
 */
export function splitParagraph(
  paragraph: LayoutParagraph,
  splitLine: number
): { before: LayoutParagraph; after: LayoutParagraph } {
  const beforeLines = paragraph.lines.slice(0, splitLine);
  const afterLines = paragraph.lines.slice(splitLine);

  // Distribute footnote references
  const beforeFootnotes: FootnoteRef[] = [];
  const afterFootnotes: FootnoteRef[] = [];

  if (paragraph.footnoteRefs) {
    for (const ref of paragraph.footnoteRefs) {
      if (ref.lineIndex < splitLine) {
        beforeFootnotes.push(ref);
      } else {
        // Adjust line index for after paragraph (now relative to start of after)
        afterFootnotes.push({
          footnoteId: ref.footnoteId,
          lineIndex: ref.lineIndex - splitLine,
        });
      }
    }
  }

  // Create before paragraph (inherits opening if it exists, since it's at the start)
  const before: LayoutParagraph = {
    id: `${paragraph.id}-before`,
    lines: beforeLines,
    style: {
      ...paragraph.style,
      // Before paragraph loses 'center' on last line (it's no longer the last line)
      lastLine: paragraph.style.lastLine === 'center' ? 'justify' : paragraph.style.lastLine,
    },
    opening: paragraph.opening, // Opening stays with first part
    alternativeBreaks: undefined, // Alternatives don't apply to split paragraphs
    footnoteRefs: beforeFootnotes.length > 0 ? beforeFootnotes : undefined,
  };

  // Create after paragraph (no opening, since it's a continuation)
  const after: LayoutParagraph = {
    id: `${paragraph.id}-after`,
    lines: afterLines,
    style: paragraph.style, // After paragraph keeps original style (including lastLine)
    opening: undefined, // No opening in continuation
    alternativeBreaks: undefined, // Alternatives don't apply to split paragraphs
    footnoteRefs: afterFootnotes.length > 0 ? afterFootnotes : undefined,
  };

  return { before, after };
}
