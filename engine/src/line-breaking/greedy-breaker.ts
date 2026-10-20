/**
 * Greedy line breaking algorithm for Hebrew text.
 * Implements the simplest viable approach: fill lines until overflow, then break.
 * 
 * This is M1.0 baseline - optimizations (Knuth-Plass) deferred to M2+.
 */

export interface ShapedWord {
  /** Original text */
  text: string;
  /** Glyph IDs from HarfBuzz */
  glyphIds: number[];
  /** Glyph advances (widths) in points */
  advances: number[];
  /** Total width in points */
  width: number;
  /**
   * Glyph offsets in points (x to the right, y up) from GPOS, one per glyph.
   * Present only for words shaped by HarfBuzz (see typography/word-shaper.ts).
   * Without it the renderer cannot place glyphs itself and falls back to
   * PDFKit's own text layout, which does not match the measured width.
   * Glyphs are in visual (left-to-right drawing) order.
   */
  offsets?: Array<{ x: number; y: number }>;
  /** UTF-16 index into `text` of each glyph's cluster (same length as glyphIds) */
  clusters?: number[];
  /** Font size in points the word was shaped at */
  fontSize?: number;
}

export interface LineBreakResult {
  /** Lines of words, in visual order (RTL = right-to-left within line) */
  lines: ShapedWord[][];
  /** Width of each line in points */
  lineWidths: number[];
  /** Whether each line was broken at word boundary (true) or mid-word (false) */
  cleanBreaks: boolean[];
}

export interface GreedyBreakerOptions {
  /** Maximum line width in points */
  maxWidth: number;
  /** Space between words in points (default: 3.5pt) */
  wordSpacing?: number;
  /** Allow breaking mid-word if word exceeds maxWidth (default: false) */
  allowMidWordBreak?: boolean;
}

/**
 * Break shaped words into lines using greedy algorithm.
 * 
 * Algorithm:
 * 1. Start with empty line
 * 2. Try adding next word + space
 * 3. If fits, add it
 * 4. If doesn't fit, start new line
 * 5. If single word exceeds maxWidth:
 *    - If allowMidWordBreak=true: break at glyph boundaries
 *    - If allowMidWordBreak=false: overflow (let it exceed maxWidth)
 * 
 * @param words Array of shaped words in logical order (reading order)
 * @param options Line breaking configuration
 * @returns Lines with words in visual order (RTL)
 */
export function breakLines(
  words: ShapedWord[],
  options: GreedyBreakerOptions
): LineBreakResult {
  const { maxWidth, wordSpacing = 3.5, allowMidWordBreak = false } = options;

  const lines: ShapedWord[][] = [];
  const lineWidths: number[] = [];
  const cleanBreaks: boolean[] = [];

  let currentLine: ShapedWord[] = [];
  let currentWidth = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    
    const isFirstWordInLine = currentLine.length === 0;
    const spaceWidth = isFirstWordInLine ? 0 : wordSpacing;
    const widthWithWord = currentWidth + spaceWidth + word.width;

    // Special case: if this is first word in line and it exceeds maxWidth, try breaking it
    if (isFirstWordInLine && word.width > maxWidth && allowMidWordBreak) {
      // Flush current line if any (shouldn't happen when isFirstWordInLine, but defensive)
      if (currentLine.length > 0) {
        lines.push(currentLine);
        lineWidths.push(currentWidth);
        cleanBreaks.push(true);
      }
      
      // Break word at glyph boundaries
      const broken = breakWordAtGlyphBoundaries(word, maxWidth);
      for (let j = 0; j < broken.length; j++) {
        const fragment = broken[j];
        if (fragment) {
          lines.push([fragment]);
          lineWidths.push(fragment.width);
          cleanBreaks.push(j === broken.length - 1); // Only last fragment is clean
        }
      }
      currentLine = [];
      currentWidth = 0;
      continue;
    }

    if (widthWithWord <= maxWidth || isFirstWordInLine) {
      // Word fits, or it's first word (always add first word)
      currentLine.push(word);
      currentWidth = widthWithWord;
    } else {
      // Word doesn't fit, start new line
      if (currentLine.length > 0) {
        lines.push(currentLine);
        lineWidths.push(currentWidth);
        cleanBreaks.push(true);
      }

      // Check if single word exceeds maxWidth
      if (word.width > maxWidth && allowMidWordBreak) {
        // Break word at glyph boundaries
        const broken = breakWordAtGlyphBoundaries(word, maxWidth);
        for (let j = 0; j < broken.length; j++) {
          const fragment = broken[j];
          if (fragment) {
            lines.push([fragment]);
            lineWidths.push(fragment.width);
            cleanBreaks.push(j === broken.length - 1); // Only last fragment is clean
          }
        }
        currentLine = [];
        currentWidth = 0;
      } else {
        // Start new line with this word (may overflow if too long)
        currentLine = [word];
        currentWidth = word.width;
      }
    }
  }

  // Add final line if non-empty
  if (currentLine.length > 0) {
    lines.push(currentLine);
    lineWidths.push(currentWidth);
    cleanBreaks.push(true);
  }

  return { lines, lineWidths, cleanBreaks };
}

/**
 * Break a single word at glyph boundaries when it exceeds maxWidth.
 * Used when allowMidWordBreak=true.
 */
function breakWordAtGlyphBoundaries(
  word: ShapedWord,
  maxWidth: number
): ShapedWord[] {
  // Handle edge case: maxWidth too small to fit even one glyph
  if (maxWidth <= 0 || word.glyphIds.length === 0) {
    return [word];
  }

  // Splitting a HarfBuzz-shaped word between glyphs can separate a base letter
  // from its nikud/teamim and breaks the glyph<->text mapping, so such words
  // are never split (they overflow instead).
  if (word.offsets) {
    return [word];
  }

  const fragments: ShapedWord[] = [];
  let currentGlyphIds: number[] = [];
  let currentAdvances: number[] = [];
  let currentWidth = 0;
  let startGlyphIndex = 0;

  for (let i = 0; i < word.glyphIds.length; i++) {
    const glyphId = word.glyphIds[i];
    const glyphAdvance = word.advances[i];
    if (glyphId === undefined || glyphAdvance === undefined) continue;
    
    const glyphWidth = glyphAdvance;
    const wouldExceed = currentWidth + glyphWidth > maxWidth;
    
    // If adding this glyph would exceed maxWidth AND we have glyphs accumulated, flush first
    if (wouldExceed && currentGlyphIds.length > 0) {
      // Flush current fragment before adding this glyph
      const glyphCount = currentGlyphIds.length;
      const charsPerGlyph = word.text.length / word.glyphIds.length;
      const startCharIndex = Math.floor(startGlyphIndex * charsPerGlyph);
      const endCharIndex = Math.floor((startGlyphIndex + glyphCount) * charsPerGlyph);
      
      fragments.push({
        text: word.text.substring(startCharIndex, endCharIndex),
        glyphIds: [...currentGlyphIds],
        advances: [...currentAdvances],
        width: currentWidth,
      });
      
      startGlyphIndex += glyphCount;
      currentGlyphIds = [];
      currentAdvances = [];
      currentWidth = 0;
    }

    // Now add current glyph (to new fragment if we just flushed)
    currentGlyphIds.push(glyphId);
    currentAdvances.push(glyphAdvance);
    currentWidth += glyphWidth;
  }

  // Add final fragment
  if (currentGlyphIds.length > 0) {
    const charsPerGlyph = word.text.length / word.glyphIds.length;
    const startCharIndex = Math.floor(startGlyphIndex * charsPerGlyph);
    
    fragments.push({
      text: word.text.substring(startCharIndex),
      glyphIds: currentGlyphIds,
      advances: currentAdvances,
      width: currentWidth,
    });
  }

  return fragments.length > 0 ? fragments : [word];
}
