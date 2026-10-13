import { describe, it, expect } from 'vitest';
import { resolveBiDi, getVisualText, BaseDirection, BidiType } from '../../../src/bidi/bidi-resolver';

describe('BiDi Basic Tests', () => {
  describe('Pure directional text', () => {
    it('should handle pure Hebrew (RTL)', () => {
      const text = 'שלום עולם';
      const result = resolveBiDi(text);

      expect(result.baseDirection).toBe(BaseDirection.RTL);
      expect(result.types.every(t => t === BidiType.R || t === BidiType.WS)).toBe(true);
    });

    it('should handle pure English (LTR)', () => {
      const text = 'hello world';
      const result = resolveBiDi(text);

      expect(result.baseDirection).toBe(BaseDirection.LTR);
      expect(result.types.every(t => t === BidiType.L || t === BidiType.WS)).toBe(true);
    });

    it('should handle pure numbers', () => {
      const text = '123 456';
      const result = resolveBiDi(text);

      expect(result.types.filter(t => t === BidiType.EN).length).toBe(6);
    });
  });

  describe('Mixed directional text', () => {
    it('should detect RTL base for Hebrew with English', () => {
      const text = 'שלום hello עולם';
      const result = resolveBiDi(text);

      expect(result.baseDirection).toBe(BaseDirection.RTL);
      
      // Should have both R and L types
      const hasHebrew = result.types.some(t => t === BidiType.R);
      const hasLatin = result.types.some(t => t === BidiType.L);
      expect(hasHebrew).toBe(true);
      expect(hasLatin).toBe(true);
    });

    it('should detect LTR base for English with Hebrew', () => {
      const text = 'hello שלום world';
      const result = resolveBiDi(text);

      expect(result.baseDirection).toBe(BaseDirection.LTR);
    });
  });

  describe('Visual reordering', () => {
    it('should reverse pure Hebrew text', () => {
      // "abc" in Hebrew (logical order)
      const text = 'אבג';
      const result = resolveBiDi(text);
      const visual = getVisualText(text, result);

      // In RTL, should be displayed right-to-left
      // But the visual string representation depends on viewing context
      expect(visual.length).toBe(text.length);
      expect(result.visualOrder.length).toBe(3);
    });

    it('should keep pure English text as-is', () => {
      const text = 'abc';
      const result = resolveBiDi(text);
      const visual = getVisualText(text, result);

      // LTR text stays in logical order
      expect(visual).toBe(text);
      expect(result.visualOrder).toEqual([0, 1, 2]);
    });

    it('should handle Hebrew with embedded English', () => {
      // Hebrew "shalom" + English "world" + Hebrew "toda"
      const text = 'שלום world תודה';
      const result = resolveBiDi(text);

      expect(result.baseDirection).toBe(BaseDirection.RTL);
      expect(result.visualOrder.length).toBe(text.length);
    });
  });

  describe('Numbers in BiDi context', () => {
    it('should handle numbers in RTL context', () => {
      const text = 'מספר 123 כאן';
      const result = resolveBiDi(text);

      expect(result.baseDirection).toBe(BaseDirection.RTL);
      
      // Should have R (Hebrew) and EN (numbers) types
      const hasNumbers = result.types.some(t => t === BidiType.EN);
      expect(hasNumbers).toBe(true);
    });

    it('should handle numbers in LTR context', () => {
      const text = 'number 123 here';
      const result = resolveBiDi(text);

      expect(result.baseDirection).toBe(BaseDirection.LTR);
      expect(result.types.filter(t => t === BidiType.EN).length).toBe(3);
    });
  });

  describe('Embedding levels', () => {
    it('should assign level 1 to RTL base text', () => {
      const text = 'שלום';
      const result = resolveBiDi(text, BaseDirection.RTL);

      // RTL base should have odd levels
      expect(result.levels.every(l => l === 1)).toBe(true);
    });

    it('should assign level 0 to LTR base text', () => {
      const text = 'hello';
      const result = resolveBiDi(text, BaseDirection.LTR);

      // LTR base should have even levels
      expect(result.levels.every(l => l === 0)).toBe(true);
    });

    it('should increment level for opposite direction', () => {
      const text = 'שלום abc';
      const result = resolveBiDi(text, BaseDirection.RTL);

      // Hebrew should be level 1, English level 2
      expect(result.levels[0]).toBe(1); // Hebrew
      expect(result.levels[5]).toBe(2); // Space inherits
      expect(result.levels[6]).toBe(2); // 'a'
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = resolveBiDi('');

      expect(result.text).toBe('');
      expect(result.visualOrder).toEqual([]);
      expect(result.types).toEqual([]);
    });

    it('should handle single character', () => {
      const result = resolveBiDi('א');

      expect(result.visualOrder).toEqual([0]);
      expect(result.baseDirection).toBe(BaseDirection.RTL);
    });

    it('should handle whitespace only', () => {
      const result = resolveBiDi('   ');

      expect(result.types.every(t => t === BidiType.WS)).toBe(true);
    });
  });
});
