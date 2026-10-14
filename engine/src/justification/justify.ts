/**
 * Text justification algorithms.
 * 
 * Adjusts word spacing to fill line width exactly.
 * M2 implementation - inter-word spacing adjustment.
 */

import type { ShapedWord } from '../line-breaking/greedy-breaker';

export interface JustificationResult {
  /** Original words */
  words: ShapedWord[];
  /** Adjusted spacing between words (in points) */
  wordSpaces: number[];
  /** Total line width after justification (should equal targetWidth) */
  actualWidth: number;
  /** Whether justification was applied */
  isJustified: boolean;
  /** Justification quality (0-1, where 1 is perfect) */
  quality: number;
}

export interface JustificationOptions {
  /** Target line width in points */
  targetWidth: number;
  /** Minimum word spacing (default: 2pt) */
  minWordSpace?: number;
  /** Maximum word spacing (default: 6pt) */
  maxWordSpace?: number;
  /** Ideal word spacing (default: 3.5pt) */
  idealWordSpace?: number;
  /** Enable Kashida insertion for Arabic/Hebrew (M2.1 feature) */
  enableKashida?: boolean;
}

/**
 * Justify a line of text by adjusting word spacing.
 * 
 * Algorithm:
 * 1. Calculate natural width (sum of word widths + ideal spacing)
 * 2. If natural width ≈ target width, no adjustment needed
 * 3. If too narrow, increase word spacing uniformly
 * 4. If too wide, this shouldn't happen (line breaking should prevent)
 * 5. Check if adjusted spacing is within acceptable range
 * 
 * @param words Array of shaped words in visual order
 * @param options Justification configuration
 * @returns Justification result with adjusted spacing
 */
export function justifyLine(
  words: ShapedWord[],
  options: JustificationOptions
): JustificationResult {
  const {
    targetWidth,
    minWordSpace = 2,
    maxWordSpace = 6,
    idealWordSpace = 3.5,
  } = options;

  // Edge cases
  if (words.length === 0) {
    return {
      words: [],
      wordSpaces: [],
      actualWidth: 0,
      isJustified: false,
      quality: 1,
    };
  }

  if (words.length === 0) {
    // Empty line
    return {
      words: [],
      wordSpaces: [],
      actualWidth: 0,
      isJustified: false,
      quality: 1,
    };
  }

  if (words.length === 1) {
    // Single word - cannot justify
    const firstWord = words[0];
    if (!firstWord) {
      return {
        words: [],
        wordSpaces: [],
        actualWidth: 0,
        isJustified: false,
        quality: 1,
      };
    }
    return {
      words,
      wordSpaces: [],
      actualWidth: firstWord.width,
      isJustified: false,
      quality: 1,
    };
  }

  // Calculate natural width
  const totalWordWidth = words.reduce((sum, w) => sum + w.width, 0);
  const numGaps = words.length - 1;
  const naturalWidth = totalWordWidth + numGaps * idealWordSpace;

  // If natural width is close enough to target, don't justify
  const tolerance = 0.5; // 0.5pt tolerance
  if (Math.abs(naturalWidth - targetWidth) < tolerance) {
    return {
      words,
      wordSpaces: Array(numGaps).fill(idealWordSpace),
      actualWidth: naturalWidth,
      isJustified: false,
      quality: 1,
    };
  }

  // Calculate required adjustment
  const availableSpace = targetWidth - totalWordWidth;
  const requiredSpacing = availableSpace / numGaps;

  // Check if within acceptable range
  if (requiredSpacing < minWordSpace) {
    // Too tight - use minimum spacing (line is overfull)
    const wordSpaces = Array(numGaps).fill(minWordSpace);
    const actualWidth = totalWordWidth + numGaps * minWordSpace;
    return {
      words,
      wordSpaces,
      actualWidth,
      isJustified: false,
      quality: 0.3, // Poor quality
    };
  }

  if (requiredSpacing > maxWordSpace) {
    // Too loose - distribute evenly up to max, but still mark as justified
    // (Better than leaving big gaps)
    const wordSpaces = Array(numGaps).fill(maxWordSpace);
    const actualWidth = totalWordWidth + numGaps * maxWordSpace;
    
    // Quality is reduced because we hit the limit
    const quality = 0.7; // Good but not perfect
    
    return {
      words,
      wordSpaces,
      actualWidth,
      isJustified: true, // We did adjust spacing
      quality,
    };
  }

  // Perfect justification possible
  const wordSpaces = Array(numGaps).fill(requiredSpacing);
  const actualWidth = targetWidth; // Should be exact

  // Calculate quality metric
  // Quality is best when spacing is close to ideal
  const spacingDeviation = Math.abs(requiredSpacing - idealWordSpace);
  const maxDeviation = Math.max(idealWordSpace - minWordSpace, maxWordSpace - idealWordSpace);
  const quality = Math.max(0, 1 - (spacingDeviation / maxDeviation));

  return {
    words,
    wordSpaces,
    actualWidth,
    isJustified: true,
    quality,
  };
}

/**
 * Justify multiple lines with consistent spacing preferences.
 * Last line is typically left unjustified.
 * 
 * @param lines Array of line word arrays
 * @param targetWidth Target width for each line
 * @param options Justification options
 * @returns Array of justification results
 */
export function justifyLines(
  lines: ShapedWord[][],
  targetWidth: number,
  options?: Partial<JustificationOptions>
): JustificationResult[] {
  if (lines.length === 0) return [];

  const fullOptions: JustificationOptions = {
    targetWidth,
    minWordSpace: 2,
    maxWordSpace: 6,
    idealWordSpace: 3.5,
    enableKashida: false,
    ...options,
  };

  // Justify all lines except the last one
  const results: JustificationResult[] = [];

  for (let i = 0; i < lines.length; i++) {
    const isLastLine = i === lines.length - 1;
    
    if (isLastLine) {
      // Last line: use natural spacing (no justification)
      const words = lines[i];
      if (!words) continue;
      
      const numGaps = Math.max(0, words.length - 1);
      const wordSpaces = Array(numGaps).fill(fullOptions.idealWordSpace);
      const totalWordWidth = words.reduce((sum, w) => sum + w.width, 0);
      const actualWidth = totalWordWidth + numGaps * (fullOptions.idealWordSpace ?? 3.5);

      results.push({
        words,
        wordSpaces,
        actualWidth,
        isJustified: false,
        quality: 1,
      });
    } else {
      // Regular line: apply justification
      const line = lines[i];
      if (line) {
        results.push(justifyLine(line, fullOptions));
      }
    }
  }

  return results;
}

/**
 * Calculate justification quality score for a set of lines.
 * 
 * @param results Array of justification results
 * @returns Average quality score (0-1)
 */
export function calculateOverallQuality(results: JustificationResult[]): number {
  if (results.length === 0) return 1;
  
  const totalQuality = results.reduce((sum, r) => sum + r.quality, 0);
  return totalQuality / results.length;
}
