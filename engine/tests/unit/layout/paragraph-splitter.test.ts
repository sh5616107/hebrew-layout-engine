import { describe, it, expect } from 'vitest';
import {
  canSplitParagraph,
  getSplitPoints,
  splitParagraph,
} from '../../../src/layout/paragraph-splitter';
import type { LayoutParagraph, ShapedRun } from '../../../src/core/types';
import type { SectionBalancingConfig } from '../../../src/core/config';

describe('Paragraph Splitter', () => {
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
  function mockParagraph(lineCount: number, options?: {
    id?: string;
    lastLine?: 'justify' | 'start' | 'center';
    windowLines?: number;
    windowWidth?: number;
    footnoteRefs?: Array<{ footnoteId: string; lineIndex: number }>;
  }): LayoutParagraph {
    const lines: ShapedRun[][] = [];
    for (let i = 0; i < lineCount; i++) {
      lines.push([mockRun(`line${i}`)]);
    }

    return {
      id: options?.id ?? 'para-1',
      lines,
      style: {
        lastLine: options?.lastLine ?? 'justify',
        widows: 2,
        orphans: 2,
      },
      opening: options?.windowLines ? {
        wordCount: 1,
        windowLines: options.windowLines,
        windowWidth: options.windowWidth ?? 5000,
      } : undefined,
      footnoteRefs: options?.footnoteRefs,
    };
  }

  // Default config
  const defaultConfig: SectionBalancingConfig = {
    maxAttempts: 100,
    lookAheadPages: 5,
    lookBackPages: 1,
    minParagraphLinesToSplit: 4,
    widows: 2,
    orphans: 2,
    balanceTolerance: 0,
  };

  describe('canSplitParagraph', () => {
    it('should reject paragraphs shorter than 4 lines', () => {
      const para1 = mockParagraph(1);
      const para2 = mockParagraph(2);
      const para3 = mockParagraph(3);

      expect(canSplitParagraph(para1)).toBe(false);
      expect(canSplitParagraph(para2)).toBe(false);
      expect(canSplitParagraph(para3)).toBe(false);
    });

    it('should accept paragraphs with 4 or more lines', () => {
      const para4 = mockParagraph(4);
      const para10 = mockParagraph(10);

      expect(canSplitParagraph(para4)).toBe(true);
      expect(canSplitParagraph(para10)).toBe(true);
    });
  });

  describe('getSplitPoints', () => {
    it('should return empty array for paragraphs shorter than 4 lines', () => {
      const para = mockParagraph(3);
      const splitPoints = getSplitPoints(para, defaultConfig);

      expect(splitPoints).toEqual([]);
    });

    it('should respect widows/orphans constraints', () => {
      // 10 lines, widows=2, orphans=2
      // Valid splits: 2, 3, 4, 5, 6, 7, 8 (leave 2+ at end, 2+ at start)
      const para = mockParagraph(10);
      const splitPoints = getSplitPoints(para, defaultConfig);

      expect(splitPoints).toEqual([2, 3, 4, 5, 6, 7, 8]);
    });

    it('should not split within window area', () => {
      // 10 lines with 3-line window
      // Window occupies lines 0, 1, 2
      // Cannot split at 0, 1, 2, 3 (would split within or immediately after window)
      // Valid splits start at 4 (after window)
      const para = mockParagraph(10, { windowLines: 3 });
      const splitPoints = getSplitPoints(para, defaultConfig);

      // With widows=2, orphans=2, windowLines=3
      // Min split: max(2, 3+1) = 4
      // Max split: 10 - 2 = 8
      expect(splitPoints).toEqual([4, 5, 6, 7, 8]);
    });

    it('should keep centered last line with paragraph', () => {
      // 10 lines with centered last line
      // Must keep at least 2 lines on next page, and last line can't be alone
      // So max split is at 8 (leaving 2 lines on next page)
      const para = mockParagraph(10, { lastLine: 'center' });
      const splitPoints = getSplitPoints(para, defaultConfig);

      // Min: orphans=2
      // Max: min(10-2, 10-2) = 8 (can't strand centered last line)
      expect(splitPoints).toEqual([2, 3, 4, 5, 6, 7, 8]);
    });

    it('should handle footnote references', () => {
      // 10 lines with footnote on line 5
      const para = mockParagraph(10, {
        footnoteRefs: [{ footnoteId: 'note-1', lineIndex: 5 }],
      });
      const splitPoints = getSplitPoints(para, defaultConfig);

      // Footnotes move with their reference lines, so no additional constraint
      expect(splitPoints).toEqual([2, 3, 4, 5, 6, 7, 8]);
    });

    it('should return valid split points for 10-line paragraph', () => {
      const para = mockParagraph(10);
      const splitPoints = getSplitPoints(para, defaultConfig);

      expect(splitPoints).toEqual([2, 3, 4, 5, 6, 7, 8]);
    });

    it('should return empty for 4-line paragraph at limit', () => {
      // 4 lines with widows=2, orphans=2
      // Min split: 2, Max split: 4-2=2
      // So valid splits: [2]
      const para = mockParagraph(4);
      const splitPoints = getSplitPoints(para, defaultConfig);

      expect(splitPoints).toEqual([2]);
    });
  });

  describe('splitParagraph', () => {
    it('should split paragraph at given line', () => {
      const para = mockParagraph(10);
      const { before, after } = splitParagraph(para, 5);

      expect(before.lines).toHaveLength(5);
      expect(after.lines).toHaveLength(5);
    });

    it('should distribute footnote references correctly', () => {
      const para = mockParagraph(10, {
        footnoteRefs: [
          { footnoteId: 'note-1', lineIndex: 2 },
          { footnoteId: 'note-2', lineIndex: 7 },
        ],
      });

      const { before, after } = splitParagraph(para, 5);

      // note-1 (line 2) stays in before
      expect(before.footnoteRefs).toEqual([
        { footnoteId: 'note-1', lineIndex: 2 },
      ]);

      // note-2 (line 7) moves to after with adjusted index (7-5=2)
      expect(after.footnoteRefs).toEqual([
        { footnoteId: 'note-2', lineIndex: 2 },
      ]);
    });

    it('should keep opening with before paragraph', () => {
      const para = mockParagraph(10, { windowLines: 2, windowWidth: 5000 });
      const { before, after } = splitParagraph(para, 5);

      expect(before.opening).toBeDefined();
      expect(before.opening?.windowLines).toBe(2);
      expect(after.opening).toBeUndefined();
    });

    it('should adjust last line style for before paragraph', () => {
      // Before paragraph with centered last line should change to justify
      const para = mockParagraph(10, { lastLine: 'center' });
      const { before, after } = splitParagraph(para, 5);

      expect(before.style.lastLine).toBe('justify'); // Changed from center
      expect(after.style.lastLine).toBe('center'); // Kept original
    });

    it('should create unique IDs for split paragraphs', () => {
      const para = mockParagraph(10, { id: 'para-42' });
      const { before, after } = splitParagraph(para, 5);

      expect(before.id).toBe('para-42-before');
      expect(after.id).toBe('para-42-after');
    });

    it('should not include alternatives in split paragraphs', () => {
      const para = mockParagraph(10);
      const { before, after } = splitParagraph(para, 5);

      expect(before.alternativeBreaks).toBeUndefined();
      expect(after.alternativeBreaks).toBeUndefined();
    });
  });
});
