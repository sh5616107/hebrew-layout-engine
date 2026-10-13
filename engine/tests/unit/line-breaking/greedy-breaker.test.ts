import { describe, it, expect } from 'vitest';
import { breakLines, type ShapedWord } from '../../../src/line-breaking/greedy-breaker';

describe('Greedy Line Breaking', () => {
  // Helper to create mock shaped words
  function mockWord(text: string, width: number): ShapedWord {
    return {
      text,
      glyphIds: Array(text.length).fill(1),
      advances: Array(text.length).fill(width / text.length),
      width,
    };
  }

  describe('Basic fitting', () => {
    it('should fit multiple words on one line', () => {
      const words = [
        mockWord('שלום', 20),
        mockWord('עולם', 20),
        mockWord('יפה', 15),
      ];

      const result = breakLines(words, { maxWidth: 100 });

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0]).toHaveLength(3);
      expect(result.lineWidths[0]).toBe(20 + 3.5 + 20 + 3.5 + 15); // words + spaces
      expect(result.cleanBreaks[0]).toBe(true);
    });

    it('should break when line exceeds maxWidth', () => {
      const words = [
        mockWord('שלום', 35),
        mockWord('עולם', 35),
        mockWord('יפה', 35),
      ];

      const result = breakLines(words, { maxWidth: 80 });

      // 35 + 3.5 + 35 = 73.5 fits
      // 73.5 + 3.5 + 35 = 112 doesn't fit
      expect(result.lines).toHaveLength(2);
      expect(result.lines[0]).toHaveLength(2); // שלום עולם
      expect(result.lines[1]).toHaveLength(1); // יפה
      expect(result.cleanBreaks).toEqual([true, true]);
    });

    it('should use custom word spacing', () => {
      const words = [
        mockWord('א', 10),
        mockWord('ב', 10),
      ];

      const result = breakLines(words, { maxWidth: 100, wordSpacing: 5 });

      expect(result.lineWidths[0]).toBe(10 + 5 + 10); // 25
    });
  });

  describe('Edge cases', () => {
    it('should handle empty word array', () => {
      const result = breakLines([], { maxWidth: 100 });

      expect(result.lines).toHaveLength(0);
      expect(result.lineWidths).toHaveLength(0);
      expect(result.cleanBreaks).toHaveLength(0);
    });

    it('should handle single word that fits', () => {
      const words = [mockWord('שלום', 50)];
      const result = breakLines(words, { maxWidth: 100 });

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0]).toHaveLength(1);
    });

    it('should allow single word to overflow when allowMidWordBreak=false', () => {
      const words = [mockWord('שלוםעולםיפה', 150)];
      const result = breakLines(words, { maxWidth: 100, allowMidWordBreak: false });

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0][0].width).toBe(150); // Overflow allowed
      expect(result.cleanBreaks[0]).toBe(true);
    });

    it('should break single word at glyphs when allowMidWordBreak=true', () => {
      // Create word with 20 glyphs, each 10pt = 200pt total
      const longWord: ShapedWord = {
        text: 'א'.repeat(20),
        glyphIds: Array(20).fill(1),
        advances: Array(20).fill(10),
        width: 200,
      };
      
      const result = breakLines([longWord], { maxWidth: 100, allowMidWordBreak: true });

      expect(result.lines.length).toBeGreaterThan(1);
      // Each line should be ≤ maxWidth (except possibly last if it has leftover glyphs)
      result.lineWidths.forEach((width, i) => {
        if (i < result.lines.length - 1) {
          expect(width).toBeLessThanOrEqual(100);
        }
      });
      // Only last break is clean
      expect(result.cleanBreaks[result.cleanBreaks.length - 1]).toBe(true);
    });
  });

  describe('Multi-line scenarios', () => {
    it('should break into three lines when needed', () => {
      const words = [
        mockWord('א', 30),
        mockWord('ב', 30),
        mockWord('ג', 30),
        mockWord('ד', 30),
        mockWord('ה', 30),
      ];

      const result = breakLines(words, { maxWidth: 80 });

      // Line 1: א ב (60 + 3.5 = 63.5)
      // Line 2: ג ד (60 + 3.5 = 63.5)
      // Line 3: ה (30)
      expect(result.lines).toHaveLength(3);
      expect(result.lines[0]).toHaveLength(2);
      expect(result.lines[1]).toHaveLength(2);
      expect(result.lines[2]).toHaveLength(1);
    });

    it('should handle mix of short and long words', () => {
      const words = [
        mockWord('קצר', 20),
        mockWord('ארוךמאודמאודמאוד', 120),
        mockWord('קצר', 20),
      ];

      const result = breakLines(words, { maxWidth: 100, allowMidWordBreak: false });

      // Line 1: קצר
      // Line 2: ארוךמאודמאודמאוד (overflow)
      // Line 3: קצר
      expect(result.lines).toHaveLength(3);
      expect(result.lines[0]).toHaveLength(1);
      expect(result.lines[1]).toHaveLength(1);
      expect(result.lines[2]).toHaveLength(1);
    });
  });

  describe('Real-world Hebrew text simulation', () => {
    it('should break paragraph of Hebrew words naturally', () => {
      // Simulate real widths from David font at 12pt
      const words = [
        mockWord('בראשית', 35),
        mockWord('ברא', 18),
        mockWord('אלהים', 28),
        mockWord('את', 10),
        mockWord('השמים', 32),
        mockWord('ואת', 15),
        mockWord('הארץ', 24),
      ];

      const result = breakLines(words, { maxWidth: 120 });

      // Should break naturally at word boundaries
      expect(result.cleanBreaks.every(clean => clean)).toBe(true);
      // No line should exceed maxWidth
      result.lineWidths.forEach(width => {
        expect(width).toBeLessThanOrEqual(120);
      });
    });
  });

  describe('Zero and negative widths', () => {
    it('should handle zero-width words', () => {
      const words = [
        mockWord('א', 0),
        mockWord('ב', 10),
      ];

      const result = breakLines(words, { maxWidth: 50 });

      expect(result.lines).toHaveLength(1);
      expect(result.lineWidths[0]).toBe(0 + 3.5 + 10);
    });

    it('should handle zero maxWidth gracefully', () => {
      const words = [mockWord('א', 10)];
      const result = breakLines(words, { maxWidth: 0, allowMidWordBreak: false });

      // First word always added, even if exceeds maxWidth
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0]).toHaveLength(1);
    });
  });
});
