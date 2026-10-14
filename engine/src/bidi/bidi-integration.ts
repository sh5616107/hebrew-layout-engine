/**
 * BiDi integration with layout pipeline.
 * 
 * Provides helper functions to apply BiDi reordering to shaped words.
 */

import type { ShapedWord } from '../line-breaking/greedy-breaker';
import { resolveBiDi, BaseDirection } from './bidi-resolver';

/**
 * Apply BiDi reordering to an array of shaped words.
 * 
 * This should be called BEFORE line breaking, to ensure words are in visual order.
 * 
 * Example usage:
 * ```typescript
 * const logicalWords = [hebrewWord1, englishWord, hebrewWord2];
 * const visualWords = applyBiDiToWords(logicalWords);
 * // Now visualWords are in display order
 * ```
 * 
 * @param words Shaped words in logical order (reading order)
 * @param baseDir Base paragraph direction (default: Auto-detect from first strong character)
 * @returns Shaped words in visual order (display order)
 */
export function applyBiDiToWords(
  words: ShapedWord[],
  baseDir: BaseDirection = BaseDirection.Auto
): ShapedWord[] {
  if (words.length === 0) return [];

  // Concatenate all word texts to get paragraph text
  const texts = words.map(w => w.text);
  const fullText = texts.join(' ');

  // Resolve BiDi for full paragraph
  const bidiResult = resolveBiDi(fullText, baseDir);

  // Map word boundaries to character indices
  const wordBoundaries: Array<{ start: number; end: number }> = [];
  let charIndex = 0;
  
  for (const text of texts) {
    const start = charIndex;
    const end = charIndex + text.length;
    wordBoundaries.push({ start, end });
    charIndex = end + 1; // +1 for space
  }

  // Reorder words based on BiDi resolution
  // For simplicity in M1.1, we'll reorder at word granularity
  // (Full UAX #9 would reorder at character level within words)
  
  // Find which words are RTL vs LTR based on their character types
  const wordDirections: Array<'LTR' | 'RTL'> = words.map((_, i) => {
    const boundary = wordBoundaries[i];
    if (boundary) {
      const { start, end } = boundary;
      const wordLevels = bidiResult.levels.slice(start, Math.min(end, bidiResult.levels.length));
      
      // Word direction is determined by majority of its characters
      const avgLevel = wordLevels.reduce((sum, l) => sum + l, 0) / wordLevels.length;
      return avgLevel >= 1 ? 'RTL' : 'LTR';
    }
    return 'LTR';
  });

  // In RTL base direction, reverse the word order
  if (bidiResult.baseDirection === BaseDirection.RTL) {
    return [...words].reverse();
  }

  // For future use: wordDirections could be returned as metadata
  void wordDirections;

  return words;
}

/**
 * Apply BiDi reordering to a single paragraph (array of words).
 * Returns both visual words and BiDi metadata.
 * 
 * @param words Shaped words in logical order
 * @param baseDir Base direction (default: Auto)
 * @returns Visual words and BiDi information
 */
export function applyBiDiWithMetadata(
  words: ShapedWord[],
  baseDir: BaseDirection = BaseDirection.Auto
): {
  visualWords: ShapedWord[];
  baseDirection: BaseDirection;
  wordDirections: Array<'LTR' | 'RTL'>;
} {
  if (words.length === 0) {
    return {
      visualWords: [],
      baseDirection: BaseDirection.LTR,
      wordDirections: [],
    };
  }

  const texts = words.map(w => w.text);
  const fullText = texts.join(' ');
  const bidiResult = resolveBiDi(fullText, baseDir);

  // Map word directions
  const wordBoundaries: Array<{ start: number; end: number }> = [];
  let charIndex = 0;
  
  for (const text of texts) {
    const start = charIndex;
    const end = charIndex + text.length;
    wordBoundaries.push({ start, end });
    charIndex = end + 1;
  }

  const wordDirections = words.map((_, i) => {
    const boundary = wordBoundaries[i];
    if (!boundary) return 'LTR' as const;
    
    const { start, end } = boundary;
    const wordLevels = bidiResult.levels.slice(start, Math.min(end, bidiResult.levels.length));
    
    // Determine direction by checking if all levels are even (LTR) or any odd (RTL)
    // Level 0, 2, 4... = LTR
    // Level 1, 3, 5... = RTL
    const hasOddLevel = wordLevels.some(l => l % 2 === 1);
    return hasOddLevel ? 'RTL' as const : 'LTR' as const;
  });

  // Reorder words
  let visualWords = words;
  if (bidiResult.baseDirection === BaseDirection.RTL) {
    visualWords = [...words].reverse();
  }

  return {
    visualWords,
    baseDirection: bidiResult.baseDirection,
    wordDirections,
  };
}
