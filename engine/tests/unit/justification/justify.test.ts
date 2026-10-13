import { describe, it, expect } from 'vitest';
import { justifyLine, justifyLines, calculateOverallQuality } from '../../../src/justification/justify';
import type { ShapedWord } from '../../../src/line-breaking/greedy-breaker';

describe('Text Justification', () => {
  function mockWord(text: string, width: number): ShapedWord {
    return {
      text,
      glyphIds: Array(text.length).fill(1),
      advances: Array(text.length).fill(width / text.length),
      width,
    };
  }

  describe('justifyLine', () => {
    it('should justify line with uniform spacing', () => {
      const words = [
        mockWord('hello', 30),
        mockWord('world', 30),
        mockWord('test', 24),
      ];

      // Total word width: 84
      // Target width: 100
      // Available space: 100 - 84 = 16
      // Gaps: 2
      // Spacing per gap: 16 / 2 = 8pt
      // But default maxWordSpace = 6, so clamped to 6

      const result = justifyLine(words, {
        targetWidth: 100,
        maxWordSpace: 10, // Allow 8pt spacing
      });

      expect(result.isJustified).toBe(true);
      expect(result.wordSpaces).toEqual([8, 8]);
      expect(result.actualWidth).toBe(100);
      expect(result.quality).toBeGreaterThan(0);
    });

    it('should not justify single word', () => {
      const words = [mockWord('hello', 50)];
      const result = justifyLine(words, { targetWidth: 100 });

      expect(result.isJustified).toBe(false);
      expect(result.wordSpaces).toEqual([]);
      expect(result.actualWidth).toBe(50);
    });

    it('should handle empty array', () => {
      const result = justifyLine([], { targetWidth: 100 });

      expect(result.isJustified).toBe(false);
      expect(result.words).toEqual([]);
      expect(result.wordSpaces).toEqual([]);
    });

    it('should not justify when natural width ≈ target', () => {
      const words = [
        mockWord('a', 10),
        mockWord('b', 10),
        mockWord('c', 10),
      ];

      // Natural: 10 + 3.5 + 10 + 3.5 + 10 = 37
      const result = justifyLine(words, {
        targetWidth: 37,
        idealWordSpace: 3.5,
      });

      expect(result.isJustified).toBe(false);
      expect(result.quality).toBe(1);
    });

    it('should respect minimum word spacing', () => {
      const words = [
        mockWord('very', 40),
        mockWord('tight', 40),
      ];

      // If target is too small, use minWordSpace
      const result = justifyLine(words, {
        targetWidth: 81, // 40 + 1 + 40 (requires 1pt spacing)
        minWordSpace: 2,
      });

      expect(result.wordSpaces[0]).toBeGreaterThanOrEqual(2);
      expect(result.isJustified).toBe(false); // Too tight
      expect(result.quality).toBeLessThan(1);
    });

    it('should respect maximum word spacing', () => {
      const words = [
        mockWord('wide', 20),
        mockWord('gap', 20),
      ];

      // If target is too large, use maxWordSpace but still mark as justified
      const result = justifyLine(words, {
        targetWidth: 100, // 20 + 60 + 20 (requires 60pt spacing!)
        maxWordSpace: 6,
      });

      expect(result.wordSpaces[0]).toBeLessThanOrEqual(6);
      expect(result.isJustified).toBe(true); // Did adjust (to max)
      expect(result.quality).toBeLessThan(1); // Not perfect
    });

    it('should calculate quality metric', () => {
      const words = [
        mockWord('good', 25),
        mockWord('spacing', 40),
        mockWord('here', 25),
      ];

      const result = justifyLine(words, {
        targetWidth: 100,
        idealWordSpace: 3.5,
        maxWordSpace: 8, // Allow calculated spacing
      });

      // Total words: 90, gaps: 2, required: 5pt
      // Deviation from ideal (3.5): 1.5pt
      // Quality should be good
      expect(result.quality).toBeGreaterThan(0.5);
      expect(result.quality).toBeLessThanOrEqual(1);
    });

    it('should distribute spacing evenly', () => {
      const words = [
        mockWord('a', 20),
        mockWord('b', 20),
        mockWord('c', 20),
        mockWord('d', 20),
      ];

      const result = justifyLine(words, { targetWidth: 100 });

      // All gaps should have equal spacing
      const uniqueSpacings = new Set(result.wordSpaces);
      expect(uniqueSpacings.size).toBe(1);
    });
  });

  describe('justifyLines', () => {
    it('should justify multiple lines', () => {
      const lines = [
        [mockWord('line', 30), mockWord('one', 20)],
        [mockWord('line', 30), mockWord('two', 20)],
        [mockWord('line', 30), mockWord('three', 30)],
      ];

      const results = justifyLines(lines, 100);

      expect(results).toHaveLength(3);
      // First two lines should be justified
      expect(results[0].isJustified).toBe(true);
      expect(results[1].isJustified).toBe(true);
      // Last line should NOT be justified
      expect(results[2].isJustified).toBe(false);
    });

    it('should not justify last line', () => {
      const lines = [
        [mockWord('first', 40), mockWord('line', 30)],
        [mockWord('last', 30), mockWord('line', 30)],
      ];

      const results = justifyLines(lines, 100);

      // First line: justified
      expect(results[0].isJustified).toBe(true);
      
      // Last line: use natural spacing
      expect(results[1].isJustified).toBe(false);
      expect(results[1].wordSpaces[0]).toBe(3.5); // ideal spacing
    });

    it('should handle empty lines array', () => {
      const results = justifyLines([], 100);
      expect(results).toEqual([]);
    });

    it('should handle single line', () => {
      const lines = [[mockWord('only', 30), mockWord('line', 30)]];
      const results = justifyLines(lines, 100);

      expect(results).toHaveLength(1);
      // Single line is treated as last line (not justified)
      expect(results[0].isJustified).toBe(false);
    });

    it('should use custom options', () => {
      const lines = [
        [mockWord('custom', 40), mockWord('opts', 30)],
      ];

      const results = justifyLines(lines, 100, {
        minWordSpace: 3,
        maxWordSpace: 8,
        idealWordSpace: 4,
      });

      // Last line uses custom ideal spacing
      expect(results[0].wordSpaces[0]).toBe(4);
    });
  });

  describe('calculateOverallQuality', () => {
    it('should calculate average quality', () => {
      const results = [
        { words: [], wordSpaces: [], actualWidth: 100, isJustified: true, quality: 0.8 },
        { words: [], wordSpaces: [], actualWidth: 100, isJustified: true, quality: 0.6 },
        { words: [], wordSpaces: [], actualWidth: 100, isJustified: false, quality: 1.0 },
      ];

      const overall = calculateOverallQuality(results);

      // (0.8 + 0.6 + 1.0) / 3 = 0.8
      expect(overall).toBeCloseTo(0.8, 2);
    });

    it('should return 1 for empty array', () => {
      const overall = calculateOverallQuality([]);
      expect(overall).toBe(1);
    });

    it('should handle perfect justification', () => {
      const results = [
        { words: [], wordSpaces: [], actualWidth: 100, isJustified: true, quality: 1.0 },
        { words: [], wordSpaces: [], actualWidth: 100, isJustified: true, quality: 1.0 },
      ];

      const overall = calculateOverallQuality(results);
      expect(overall).toBe(1);
    });
  });

  describe('Real-world scenarios', () => {
    it('should justify Hebrew text line', () => {
      const words = [
        mockWord('בראשית', 42),
        mockWord('ברא', 24),
        mockWord('אלהים', 36),
      ];

      const result = justifyLine(words, {
        targetWidth: 120,
        maxWordSpace: 10, // Allow 9pt spacing
      });

      // Total words: 102
      // Gaps: 2
      // Required spacing: (120 - 102) / 2 = 9pt
      expect(result.isJustified).toBe(true);
      expect(result.actualWidth).toBeCloseTo(120, 1);
    });

    it('should handle varying word widths', () => {
      const words = [
        mockWord('short', 20),
        mockWord('medium', 35),
        mockWord('longer', 45),
        mockWord('x', 8),
      ];

      const result = justifyLine(words, { targetWidth: 150 });

      expect(result.isJustified).toBe(true);
      // All spacings should be equal
      const uniqueSpacings = new Set(result.wordSpaces);
      expect(uniqueSpacings.size).toBe(1);
    });

    it('should produce high quality for reasonable spacing', () => {
      const words = [
        mockWord('good', 25),
        mockWord('word', 25),
        mockWord('spacing', 40),
      ];

      const result = justifyLine(words, {
        targetWidth: 98, // Close to natural width
        idealWordSpace: 3.5,
      });

      // Total words: 90, gaps: 2
      // Required: (98 - 90) / 2 = 4pt
      // Very close to ideal (3.5pt)
      // Quality should be very high
      expect(result.quality).toBeGreaterThanOrEqual(0.8);
    });
  });
});
