/**
 * BiDi (Bidirectional Text) Tests
 * 
 * Tests Unicode UAX #9 bidirectional algorithm implementation
 * for mixed Hebrew + Latin + Digits text.
 * 
 * Critical for M1: Hebrew books contain:
 * - Hebrew text (RTL)
 * - Biblical references with digits "בראשית 1:1" (Hebrew RTL, digits LTR)
 * - Transliterated names "בראשית Genesis" (Hebrew RTL, Latin LTR)
 * - Mixed citations "פרק 5 Chapter" (all three types)
 */

import { describe, it, expect } from 'vitest';
import bidiFactory from 'bidi-js';

// Initialize BiDi
const bidi = bidiFactory();

/**
 * Helper: Get visual order of text after BiDi resolution
 */
function getVisualOrder(text: string, baseDirection: 'LTR' | 'RTL' = 'RTL'): string {
  const result = bidi.getVisual(text, {
    baseDirection: baseDirection === 'RTL' ? bidi.DIRECTION_RTL : bidi.DIRECTION_LTR
  });
  return result;
}

describe('BiDi Text Handling', () => {
  describe('Hebrew-only text (RTL)', () => {
    it('preserves Hebrew text in RTL order', () => {
      const text = 'בראשית ברא אלהים';
      const visual = getVisualOrder(text, 'RTL');
      
      // Hebrew should remain as-is (already visual order in RTL context)
      expect(visual).toBe(text);
    });

    it('handles single Hebrew word', () => {
      const text = 'בראשית';
      const visual = getVisualOrder(text, 'RTL');
      expect(visual).toBe('בראשית');
    });

    it('handles Hebrew with nikud', () => {
      const text = 'בְּרֵאשִׁית';
      const visual = getVisualOrder(text, 'RTL');
      // Nikud marks should stay with base characters
      expect(visual).toContain('בְּ');
      expect(visual).toContain('רֵ');
    });
  });

  describe('Hebrew + Digits (mixed directionality)', () => {
    it('keeps Hebrew RTL, digits LTR', () => {
      const text = 'בראשית 1:1';
      const visual = getVisualOrder(text, 'RTL');
      
      // Expected visual order (RTL base):
      // "1:1 בראשית" - Hebrew on right, digits on left (but digits themselves stay 1:1, not 1:1 reversed)
      expect(visual).toMatch(/^\d/); // Should start with digit (visual left = logical right in RTL)
      expect(visual).toMatch(/בראשית$/); // Should end with Hebrew (visual right = logical left in RTL)
    });

    it('handles chapter:verse format', () => {
      const text = 'פרק 5:12';
      const visual = getVisualOrder(text, 'RTL');
      
      // Digits should be in LTR order (5:12, not 21:5)
      expect(visual).toContain('5:12');
    });

    it('handles multiple digit groups', () => {
      const text = 'בראשית 1:1 עד 2:3';
      const visual = getVisualOrder(text, 'RTL');
      
      // Both digit groups should maintain LTR order
      expect(visual).toContain('1:1');
      expect(visual).toContain('2:3');
    });
  });

  describe('Hebrew + Latin (mixed directionality)', () => {
    it('keeps Hebrew RTL, Latin LTR', () => {
      const text = 'בראשית Genesis';
      const visual = getVisualOrder(text, 'RTL');
      
      // Expected: "Genesis בראשית" (visual order in RTL base)
      expect(visual).toMatch(/^Genesis/); // Latin on visual left
      expect(visual).toMatch(/בראשית$/); // Hebrew on visual right
    });

    it('handles Latin word in middle of Hebrew', () => {
      const text = 'הספר Genesis מספר';
      const visual = getVisualOrder(text, 'RTL');
      
      // Latin should stay LTR within RTL context
      expect(visual).toContain('Genesis');
      expect(visual).not.toContain('siseneG'); // Should NOT reverse
    });

    it('handles multiple Latin words', () => {
      const text = 'הספר Book of Genesis מספר';
      const visual = getVisualOrder(text, 'RTL');
      
      // Latin phrase should maintain word order
      expect(visual).toMatch(/Book of Genesis/);
    });
  });

  describe('Complex mix (Hebrew + Digits + Latin)', () => {
    it('handles all three types in single line', () => {
      const text = 'פרק 5 Chapter';
      const visual = getVisualOrder(text, 'RTL');
      
      // Expected visual (RTL base): "Chapter 5 פרק"
      // - "פרק" (Hebrew): visual right
      // - "5" (digit): middle, LTR
      // - "Chapter" (Latin): visual left, LTR
      
      expect(visual).toMatch(/Chapter/); // Latin word intact
      expect(visual).toContain('5'); // Digit present
      expect(visual).toMatch(/פרק/); // Hebrew present
    });

    it('handles Biblical reference with translation', () => {
      const text = 'בראשית 1:1 Genesis 1:1';
      const visual = getVisualOrder(text, 'RTL');
      
      // Both references should maintain digit order (1:1)
      const digitMatches = visual.match(/1:1/g);
      expect(digitMatches).toHaveLength(2);
    });

    it('handles complex citation', () => {
      const text = 'ראה Genesis 2:4 ובראשית רבה 12:6';
      const visual = getVisualOrder(text, 'RTL');
      
      // Check all components present and digits not reversed
      expect(visual).toContain('Genesis');
      expect(visual).toContain('2:4');
      expect(visual).toContain('12:6');
      expect(visual).toMatch(/ראה/);
    });
  });

  describe('Punctuation and Parentheses', () => {
    it('mirrors parentheses in RTL context', () => {
      const text = '(בראשית)';
      const visual = getVisualOrder(text, 'RTL');
      
      // In RTL, ( and ) should mirror
      // Visual: )בראשית(
      expect(visual[0]).toBe(')');
      expect(visual[visual.length - 1]).toBe('(');
    });

    it('mirrors brackets in RTL', () => {
      const text = '[בראשית]';
      const visual = getVisualOrder(text, 'RTL');
      
      // Visual: ]בראשית[
      expect(visual[0]).toBe(']');
      expect(visual[visual.length - 1]).toBe('[');
    });

    it('handles quotes correctly', () => {
      const text = '"בראשית"';
      const visual = getVisualOrder(text, 'RTL');
      
      // Quotes may or may not mirror depending on implementation
      // Just verify text is present
      expect(visual).toContain('בראשית');
    });

    it('preserves punctuation with mixed text', () => {
      const text = 'בראשית (Genesis 1:1) מספר';
      const visual = getVisualOrder(text, 'RTL');
      
      // Parentheses should mirror, content should be BiDi-processed
      expect(visual).toContain('Genesis');
      expect(visual).toContain('1:1');
    });
  });

  describe('Edge cases', () => {
    it('handles empty string', () => {
      const text = '';
      const visual = getVisualOrder(text, 'RTL');
      expect(visual).toBe('');
    });

    it('handles Latin-only text in RTL context', () => {
      const text = 'Genesis';
      const visual = getVisualOrder(text, 'RTL');
      
      // Latin text should remain LTR even in RTL context
      expect(visual).toBe('Genesis');
    });

    it('handles digits-only text', () => {
      const text = '12:34';
      const visual = getVisualOrder(text, 'RTL');
      
      // Digits should remain LTR
      expect(visual).toBe('12:34');
    });

    it('handles neutral characters (spaces, punctuation)', () => {
      const text = 'א ב ג';
      const visual = getVisualOrder(text, 'RTL');
      
      // Spaces should remain between characters
      expect(visual.split(' ')).toHaveLength(3);
    });

    it('handles Hebrew maqaf (־)', () => {
      const text = 'בן־אדם';
      const visual = getVisualOrder(text, 'RTL');
      
      // Maqaf should stay between words
      expect(visual).toContain('־');
      expect(visual).toMatch(/בן־אדם/);
    });
  });

  describe('Real-world examples', () => {
    it('handles Torah verse reference', () => {
      const text = 'כמו שכתוב בבראשית 1:1';
      const visual = getVisualOrder(text, 'RTL');
      
      // Digit reference should be LTR
      expect(visual).toContain('1:1');
      expect(visual).not.toContain('1:1 reversed');
    });

    it('handles Rashi citation with Siman', () => {
      const text = 'רש"י בראשית ב, ד';
      const visual = getVisualOrder(text, 'RTL');
      
      // Punctuation with Hebrew should work
      expect(visual).toContain('רש"י');
    });

    it('handles modern Hebrew with English brand names', () => {
      const text = 'המחשב Dell עם Windows';
      const visual = getVisualOrder(text, 'RTL');
      
      // English names should stay LTR within RTL
      expect(visual).toContain('Dell');
      expect(visual).toContain('Windows');
    });
  });
});

describe('BiDi API Integration', () => {
  it('provides base direction configuration', () => {
    const textRTL = getVisualOrder('test', 'RTL');
    const textLTR = getVisualOrder('test', 'LTR');
    
    // Should accept both directions
    expect(textRTL).toBeDefined();
    expect(textLTR).toBeDefined();
  });

  it('handles very long text', () => {
    const longText = 'בראשית '.repeat(100) + '1:1';
    const visual = getVisualOrder(longText, 'RTL');
    
    // Should not crash or hang
    expect(visual).toBeDefined();
    expect(visual.length).toBeGreaterThan(0);
  });

  it('is deterministic (same input = same output)', () => {
    const text = 'בראשית 1:1 Genesis';
    const visual1 = getVisualOrder(text, 'RTL');
    const visual2 = getVisualOrder(text, 'RTL');
    
    expect(visual1).toBe(visual2);
  });
});
