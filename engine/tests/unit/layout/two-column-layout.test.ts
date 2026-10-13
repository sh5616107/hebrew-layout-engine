import { describe, it, expect } from 'vitest';
import { layoutTwoColumns, getColumnXPosition, calculateColumnWidth, type ShapedWord } from '../../../src/layout/two-column-layout';

describe('Two-Column Layout', () => {
  // Helper to create mock line
  function mockLine(wordCount: number): ShapedWord[] {
    return Array(wordCount).fill(null).map((_, i) => ({
      text: `word${i}`,
      glyphIds: [1],
      advances: [10],
      width: 10,
    }));
  }

  describe('Basic layout', () => {
    it('should split lines evenly into two columns', () => {
      const lines = Array(40).fill(null).map((_, i) => mockLine(2));
      
      const result = layoutTwoColumns(lines, {
        pageHeight: 200,
        lineHeight: 10,
        topMargin: 0,
        bottomMargin: 0,
      });

      // 200pt height / 10pt line = 20 lines per column
      // Total capacity: 20 × 2 = 40 lines
      expect(result.rightColumn.lines).toHaveLength(20);
      expect(result.leftColumn.lines).toHaveLength(20);
      expect(result.overflow).toHaveLength(0);
      expect(result.fitsOnPage).toBe(true);
    });

    it('should handle overflow when too many lines', () => {
      const lines = Array(50).fill(null).map(() => mockLine(2));
      
      const result = layoutTwoColumns(lines, {
        pageHeight: 200,
        lineHeight: 10,
      });

      // 200 / 10 = 20 lines per column, 40 lines total capacity
      // 50 - 40 = 10 overflow
      expect(result.rightColumn.lines).toHaveLength(20);
      expect(result.leftColumn.lines).toHaveLength(20);
      expect(result.overflow).toHaveLength(10);
      expect(result.fitsOnPage).toBe(false);
    });

    it('should respect top and bottom margins', () => {
      const lines = Array(32).fill(null).map(() => mockLine(2));
      
      const result = layoutTwoColumns(lines, {
        pageHeight: 200,
        lineHeight: 10,
        topMargin: 20,
        bottomMargin: 20,
      });

      // 200 - 20 - 20 = 160pt available / 10pt line = 16 lines per column
      // Total capacity: 16 × 2 = 32 lines
      expect(result.rightColumn.lines).toHaveLength(16);
      expect(result.leftColumn.lines).toHaveLength(16);
      expect(result.overflow).toHaveLength(0);
      
      // First line should start at topMargin
      expect(result.rightColumn.lineYPositions[0]).toBe(20);
      expect(result.leftColumn.lineYPositions[0]).toBe(20);
    });

    it('should calculate correct Y positions', () => {
      const lines = Array(26).fill(null).map(() => mockLine(1));
      
      const result = layoutTwoColumns(lines, {
        pageHeight: 200,
        lineHeight: 15,
        topMargin: 10,
      });

      // 200 - 10 = 190pt / 15pt = 12 lines per column (with 10pt leftover)
      // Right column: 12 lines
      expect(result.rightColumn.lines).toHaveLength(12);
      expect(result.rightColumn.lineYPositions[0]).toBe(10);
      expect(result.rightColumn.lineYPositions[1]).toBe(25);
      expect(result.rightColumn.lineYPositions[2]).toBe(40);
      
      // Left column: 12 lines
      expect(result.leftColumn.lines).toHaveLength(12);
      expect(result.leftColumn.lineYPositions[0]).toBe(10);
    });

    it('should calculate used height correctly', () => {
      const lines = Array(20).fill(null).map(() => mockLine(1));
      
      const result = layoutTwoColumns(lines, {
        pageHeight: 200,
        lineHeight: 12,
      });

      // 200 / 12 = 16 lines per column (with 8pt leftover)
      // Right column: 16 lines × 12pt = 192pt
      // Left column: 4 lines × 12pt = 48pt
      expect(result.rightColumn.usedHeight).toBe(192);
      expect(result.leftColumn.usedHeight).toBe(48);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty lines array', () => {
      const result = layoutTwoColumns([], {
        pageHeight: 200,
        lineHeight: 10,
      });

      expect(result.rightColumn.lines).toHaveLength(0);
      expect(result.leftColumn.lines).toHaveLength(0);
      expect(result.overflow).toHaveLength(0);
      expect(result.fitsOnPage).toBe(true);
    });

    it('should handle single line', () => {
      const lines = [mockLine(3)];
      
      const result = layoutTwoColumns(lines, {
        pageHeight: 100,
        lineHeight: 10,
      });

      expect(result.rightColumn.lines).toHaveLength(1);
      expect(result.leftColumn.lines).toHaveLength(0);
      expect(result.fitsOnPage).toBe(true);
    });

    it('should handle pageHeight smaller than lineHeight', () => {
      const lines = Array(5).fill(null).map(() => mockLine(1));
      
      const result = layoutTwoColumns(lines, {
        pageHeight: 8,
        lineHeight: 10,
      });

      // 8pt / 10pt = 0 lines per column
      expect(result.rightColumn.lines).toHaveLength(0);
      expect(result.leftColumn.lines).toHaveLength(0);
      expect(result.overflow).toHaveLength(5);
      expect(result.fitsOnPage).toBe(false);
    });

    it('should handle exactly filling both columns', () => {
      const lines = Array(20).fill(null).map(() => mockLine(1));
      
      const result = layoutTwoColumns(lines, {
        pageHeight: 100,
        lineHeight: 10,
      });

      // Exactly 10 lines per column
      expect(result.rightColumn.lines).toHaveLength(10);
      expect(result.leftColumn.lines).toHaveLength(10);
      expect(result.overflow).toHaveLength(0);
      expect(result.fitsOnPage).toBe(true);
    });
  });

  describe('Column positioning (RTL Hebrew)', () => {
    it('should calculate right column X position', () => {
      const x = getColumnXPosition(
        0, // right column
        595, // A4 width
        270, // column width
        20, // left margin
        20, // right margin
        14 // column gap
      );

      // Right column: 595 - 20 (right margin) - 270 (column width) = 305
      expect(x).toBe(305);
    });

    it('should calculate left column X position', () => {
      const x = getColumnXPosition(
        1, // left column
        595,
        270,
        20,
        20,
        14
      );

      // Left column starts at left margin
      expect(x).toBe(20);
    });

    it('should calculate column width correctly', () => {
      const width = calculateColumnWidth(
        595, // page width
        20, // left margin
        20, // right margin
        14 // column gap
      );

      // (595 - 20 - 20 - 14) / 2 = 541 / 2 = 270.5
      expect(width).toBe(270.5);
    });

    it('should handle zero margins', () => {
      const width = calculateColumnWidth(600, 0, 0, 20);
      
      // (600 - 0 - 0 - 20) / 2 = 290
      expect(width).toBe(290);
    });
  });

  describe('Real-world scenarios', () => {
    it('should layout standard Hebrew book page (A4)', () => {
      // A4 dimensions: 595×842pt
      // Typical: 50pt margins, 14pt column gap, 14pt line height
      const lines = Array(100).fill(null).map(() => mockLine(5));
      
      const result = layoutTwoColumns(lines, {
        pageHeight: 842,
        lineHeight: 14,
        topMargin: 50,
        bottomMargin: 50,
        columnGap: 14,
      });

      // Available: 842 - 50 - 50 = 742pt
      // Lines per column: 742 / 14 = 53 lines
      // Total capacity: 53 × 2 = 106 lines
      expect(result.rightColumn.lines.length + result.leftColumn.lines.length).toBe(100);
      expect(result.fitsOnPage).toBe(true);
    });

    it('should calculate positions for dense Hebrew text', () => {
      const lines = Array(120).fill(null).map(() => mockLine(8));
      
      const result = layoutTwoColumns(lines, {
        pageHeight: 842,
        lineHeight: 12, // denser
        topMargin: 36,
        bottomMargin: 36,
      });

      // Available: 842 - 36 - 36 = 770pt
      // Lines per column: 770 / 12 = 64 lines
      // Total: 128 lines capacity
      expect(result.rightColumn.lines).toHaveLength(64);
      expect(result.leftColumn.lines).toHaveLength(56); // only 56 left
      expect(result.overflow).toHaveLength(0);
      expect(result.fitsOnPage).toBe(true);
    });
  });
});
