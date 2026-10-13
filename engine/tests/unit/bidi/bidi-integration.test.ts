import { describe, it, expect } from 'vitest';
import { applyBiDiToWords, applyBiDiWithMetadata } from '../../../src/bidi/bidi-integration';
import { BaseDirection } from '../../../src/bidi/bidi-resolver';
import type { ShapedWord } from '../../../src/line-breaking/greedy-breaker';

describe('BiDi Integration with Layout Pipeline', () => {
  function mockWord(text: string): ShapedWord {
    return {
      text,
      glyphIds: Array(text.length).fill(1),
      advances: Array(text.length).fill(10),
      width: text.length * 10,
    };
  }

  describe('applyBiDiToWords', () => {
    it('should keep LTR words in original order', () => {
      const words = [
        mockWord('hello'),
        mockWord('world'),
      ];

      const result = applyBiDiToWords(words);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('hello');
      expect(result[1].text).toBe('world');
    });

    it('should reverse RTL words', () => {
      const words = [
        mockWord('שלום'),
        mockWord('עולם'),
      ];

      const result = applyBiDiToWords(words);

      // In RTL base, words are reversed
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('עולם');
      expect(result[1].text).toBe('שלום');
    });

    it('should handle mixed Hebrew + English', () => {
      const words = [
        mockWord('שלום'),
        mockWord('world'),
        mockWord('תודה'),
      ];

      const result = applyBiDiToWords(words);

      // RTL base: entire sequence reversed
      expect(result).toHaveLength(3);
      // In visual order for RTL: תודה world שלום
      expect(result[0].text).toBe('תודה');
      expect(result[1].text).toBe('world');
      expect(result[2].text).toBe('שלום');
    });

    it('should handle empty array', () => {
      const result = applyBiDiToWords([]);
      expect(result).toEqual([]);
    });

    it('should respect explicit LTR base direction', () => {
      const words = [
        mockWord('hello'),
        mockWord('שלום'),
        mockWord('world'),
      ];

      const result = applyBiDiToWords(words, BaseDirection.LTR);

      // LTR base: keep original order
      expect(result[0].text).toBe('hello');
      expect(result[1].text).toBe('שלום');
      expect(result[2].text).toBe('world');
    });

    it('should respect explicit RTL base direction', () => {
      const words = [
        mockWord('hello'),
        mockWord('שלום'),
        mockWord('world'),
      ];

      const result = applyBiDiToWords(words, BaseDirection.RTL);

      // RTL base: reverse all
      expect(result[0].text).toBe('world');
      expect(result[1].text).toBe('שלום');
      expect(result[2].text).toBe('hello');
    });
  });

  describe('applyBiDiWithMetadata', () => {
    it('should provide base direction metadata', () => {
      const words = [mockWord('שלום'), mockWord('עולם')];
      const result = applyBiDiWithMetadata(words);

      expect(result.baseDirection).toBe(BaseDirection.RTL);
    });

    it('should provide word direction metadata', () => {
      const words = [
        mockWord('שלום'),
        mockWord('hello'),
        mockWord('עולם'),
      ];

      const result = applyBiDiWithMetadata(words);

      expect(result.wordDirections).toHaveLength(3);
      expect(result.wordDirections[0]).toBe('RTL'); // שלום
      expect(result.wordDirections[1]).toBe('LTR'); // hello
      expect(result.wordDirections[2]).toBe('RTL'); // עולם
    });

    it('should handle pure English', () => {
      const words = [mockWord('hello'), mockWord('world')];
      const result = applyBiDiWithMetadata(words);

      expect(result.baseDirection).toBe(BaseDirection.LTR);
      expect(result.wordDirections.every(d => d === 'LTR')).toBe(true);
    });

    it('should handle pure Hebrew', () => {
      const words = [mockWord('שלום'), mockWord('עולם')];
      const result = applyBiDiWithMetadata(words);

      expect(result.baseDirection).toBe(BaseDirection.RTL);
      expect(result.wordDirections.every(d => d === 'RTL')).toBe(true);
    });

    it('should handle empty array', () => {
      const result = applyBiDiWithMetadata([]);

      expect(result.visualWords).toEqual([]);
      expect(result.baseDirection).toBe(BaseDirection.LTR);
      expect(result.wordDirections).toEqual([]);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle Torah verse with English reference', () => {
      const words = [
        mockWord('בראשית'),
        mockWord('ברא'),
        mockWord('אלהים'),
        mockWord('(Genesis'),
        mockWord('1:1)'),
      ];

      const result = applyBiDiWithMetadata(words);

      // Base should be RTL (Hebrew is first strong character)
      expect(result.baseDirection).toBe(BaseDirection.RTL);
      
      // Visual order: (1:1) (Genesis אלהים ברא בראשית
      expect(result.visualWords[0].text).toBe('1:1)');
      expect(result.visualWords[result.visualWords.length - 1].text).toBe('בראשית');
    });

    it('should handle Hebrew with year number', () => {
      const words = [
        mockWord('שנת'),
        mockWord('תשפ"ד'),
        mockWord('2024'),
      ];

      const result = applyBiDiWithMetadata(words);

      expect(result.baseDirection).toBe(BaseDirection.RTL);
      // Numbers and Hebrew both in RTL context
    });

    it('should handle bilingual title', () => {
      const words = [
        mockWord('ספר'),
        mockWord('התורה'),
        mockWord('-'),
        mockWord('The'),
        mockWord('Torah'),
      ];

      const result = applyBiDiWithMetadata(words);

      expect(result.baseDirection).toBe(BaseDirection.RTL);
      // Should reverse: Torah The - התורה ספר
    });
  });
});
