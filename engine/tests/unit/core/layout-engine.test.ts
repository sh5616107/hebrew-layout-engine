import { describe, it, expect } from 'vitest';
import { layoutDocument, DEFAULT_CONFIG, type ShapedWord } from '../../../src/core/layout-engine';

describe('Layout Engine Integration', () => {
  function mockWord(text: string, width: number): ShapedWord {
    return {
      text,
      glyphIds: Array(text.length).fill(1),
      advances: Array(text.length).fill(width / text.length),
      width,
    };
  }

  describe('Single page layout', () => {
    it('should layout few words on single page', () => {
      const words = [
        mockWord('שלום', 30),
        mockWord('עולם', 30),
        mockWord('יפה', 25),
      ];

      const result = layoutDocument(words);

      expect(result.pageCount).toBe(1);
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.pages[0].rightColumn.lines.length).toBeGreaterThan(0);
    });

    it('should use default A4 configuration', () => {
      const words = [mockWord('א', 10)];
      const result = layoutDocument(words);

      expect(result.config.pageWidth).toBe(DEFAULT_CONFIG.pageWidth);
      expect(result.config.pageHeight).toBe(DEFAULT_CONFIG.pageHeight);
    });

    it('should allow custom configuration', () => {
      const words = [mockWord('א', 10)];
      
      const result = layoutDocument(words, {
        pageWidth: 400,
        pageHeight: 600,
        leftMargin: 30,
      });

      expect(result.config.pageWidth).toBe(400);
      expect(result.config.pageHeight).toBe(600);
      expect(result.config.leftMargin).toBe(30);
      // Other fields use defaults
      expect(result.config.rightMargin).toBe(DEFAULT_CONFIG.rightMargin);
    });
  });

  describe('Multi-page layout', () => {
    it('should create multiple pages when content overflows', () => {
      // Create enough words to fill multiple pages
      // Each word is 200pt wide, column width ~240pt, so ~1 word per line
      // With default config: ~53 lines per column on A4 = 106 lines per page
      const words: ShapedWord[] = [];
      for (let i = 0; i < 250; i++) {
        words.push(mockWord(`word${i}`, 200)); // Wide words to force line breaks
      }

      const result = layoutDocument(words);

      // 250 words, ~1 per line, ~106 lines per page → need 3 pages
      expect(result.pageCount).toBeGreaterThan(1);
      expect(result.pages.length).toBe(result.pageCount);
      
      // Each page should have a page number
      result.pages.forEach((page, i) => {
        expect(page.pageNumber).toBe(i + 1);
      });
    });

    it('should distribute content across pages', () => {
      const words: ShapedWord[] = [];
      for (let i = 0; i < 300; i++) {
        words.push(mockWord(`w${i}`, 25));
      }

      const result = layoutDocument(words);

      // All pages except possibly last should have both columns filled
      for (let i = 0; i < result.pages.length - 1; i++) {
        const page = result.pages[i];
        expect(page.rightColumn.lines.length).toBeGreaterThan(0);
        expect(page.leftColumn.lines.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Column positioning', () => {
    it('should position columns correctly for RTL', () => {
      const words = [mockWord('test', 20)];
      const result = layoutDocument(words, {
        pageWidth: 500,
        leftMargin: 20,
        rightMargin: 20,
        columnGap: 14,
      });

      const page = result.pages[0];
      
      // Right column should be on the right side
      // Left column should be on the left side
      expect(page.rightColumn.x).toBeGreaterThan(page.leftColumn.x);
      
      // Column X + width for right column should be close to pageWidth - rightMargin
      const rightColumnRightEdge = page.rightColumn.x + page.rightColumn.width;
      expect(rightColumnRightEdge).toBeCloseTo(500 - 20, 1);
      
      // Left column should start at leftMargin
      expect(page.leftColumn.x).toBeCloseTo(20, 1);
    });

    it('should set line X positions for RTL rendering', () => {
      const words = [
        mockWord('א', 10),
        mockWord('ב', 10),
        mockWord('ג', 10),
      ];

      const result = layoutDocument(words);
      const page = result.pages[0];

      // Each line should have X position at right edge of column (RTL)
      page.rightColumn.lines.forEach(line => {
        expect(line.x).toBe(page.rightColumn.x + page.rightColumn.width);
      });
    });
  });

  describe('Line breaking integration', () => {
    it('should break words into lines based on column width', () => {
      // Create words that will need multiple lines
      const words: ShapedWord[] = [];
      for (let i = 0; i < 50; i++) {
        words.push(mockWord('word', 40));
      }

      const result = layoutDocument(words, {
        leftMargin: 50,
        rightMargin: 50,
        columnGap: 14,
      });

      // Should have created multiple lines
      const totalLines = result.pages.reduce((sum, page) => 
        sum + page.rightColumn.lines.length + page.leftColumn.lines.length, 0);
      
      expect(totalLines).toBeGreaterThan(1);
    });

    it('should respect word spacing in line breaks', () => {
      const words = [
        mockWord('a', 50),
        mockWord('b', 50),
        mockWord('c', 50),
      ];

      const result = layoutDocument(words, {
        pageWidth: 200,
        leftMargin: 10,
        rightMargin: 10,
        columnGap: 10,
        wordSpacing: 5,
      });

      // With tight spacing, words might fit differently
      // Just verify it completes without error
      expect(result.pages.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty word array', () => {
      const result = layoutDocument([]);

      expect(result.pageCount).toBe(0);
      expect(result.pages).toHaveLength(0);
    });

    it('should handle single word', () => {
      const words = [mockWord('שלום', 50)];
      const result = layoutDocument(words);

      expect(result.pageCount).toBe(1);
      expect(result.pages[0].rightColumn.lines).toHaveLength(1);
      expect(result.pages[0].rightColumn.lines[0].words).toHaveLength(1);
    });

    it('should handle very small page height', () => {
      // Create words that take full column width to force 1 word per line
      const words = Array(20).fill(null).map(() => mockWord('x', 200));
      
      const result = layoutDocument(words, {
        pageHeight: 100,
        lineHeight: 20,
        topMargin: 0,
        bottomMargin: 0,
      });

      // pageHeight=100, lineHeight=20 → 5 lines per column, 10 lines per page
      // 20 words (1 per line) → 2 pages needed
      expect(result.pageCount).toBe(2);
    });

    it('should handle very wide words (no mid-word breaking in M1.0)', () => {
      const words = [mockWord('x'.repeat(100), 500)]; // Very wide word
      
      const result = layoutDocument(words, {
        pageWidth: 400,
      });

      // Word should overflow column width but still be placed
      expect(result.pageCount).toBe(1);
      expect(result.pages[0].rightColumn.lines).toHaveLength(1);
    });
  });

  describe('Y positioning', () => {
    it('should calculate correct baseline Y positions', () => {
      const words = Array(5).fill(null).map(() => mockWord('x', 10));
      
      const result = layoutDocument(words, {
        topMargin: 50,
        lineHeight: 20,
      });

      const page = result.pages[0];
      const firstLine = page.rightColumn.lines[0];
      
      // First line should start at topMargin
      expect(firstLine.y).toBe(50);
      
      // If there's a second line, it should be lineHeight below
      if (page.rightColumn.lines.length > 1) {
        expect(page.rightColumn.lines[1].y).toBe(70);
      }
    });

    it('should respect bottom margin (implicit via layout)', () => {
      const words = Array(200).fill(null).map(() => mockWord('x', 10));
      
      const result = layoutDocument(words, {
        pageHeight: 400,
        topMargin: 50,
        bottomMargin: 50,
        lineHeight: 10,
      });

      // Available height: 400 - 50 - 50 = 300
      // Max lines per column: 300 / 10 = 30
      // Max lines per page: 30 × 2 = 60
      
      const linesOnFirstPage = 
        result.pages[0].rightColumn.lines.length +
        result.pages[0].leftColumn.lines.length;
      
      expect(linesOnFirstPage).toBeLessThanOrEqual(60);
    });
  });
});
