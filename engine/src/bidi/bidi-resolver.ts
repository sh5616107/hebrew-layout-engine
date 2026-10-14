/**
 * BiDi (Bidirectional Text) resolver implementing simplified UAX #9.
 * 
 * Handles mixed Hebrew + Latin + digits text.
 * Converts logical order (reading order) to visual order (display order).
 * 
 * M1.1 implementation - custom simplified algorithm.
 */

/**
 * BiDi character types (simplified from UAX #9)
 */
export enum BidiType {
  L = 'L',     // Left-to-Right (Latin, etc.)
  R = 'R',     // Right-to-Left (Hebrew, Arabic)
  EN = 'EN',   // European Number (0-9)
  AN = 'AN',   // Arabic Number
  WS = 'WS',   // Whitespace
  ON = 'ON',   // Other Neutral
}

/**
 * Base direction for paragraph
 */
export enum BaseDirection {
  LTR = 'LTR',
  RTL = 'RTL',
  Auto = 'Auto',
}

export interface BiDiResult {
  /** Original text */
  text: string;
  /** Visual order indices (maps visual position → logical position) */
  visualOrder: number[];
  /** Character types for each character */
  types: BidiType[];
  /** Resolved base direction */
  baseDirection: BaseDirection;
  /** Embedding levels for each character */
  levels: number[];
}

/**
 * Get BiDi type for a single character.
 * Uses Unicode character ranges.
 */
function getCharType(char: string): BidiType {
  const code = char.codePointAt(0) || 0;

  // Hebrew: U+0590 to U+05FF
  if (code >= 0x0590 && code <= 0x05FF) return BidiType.R;
  
  // Arabic: U+0600 to U+06FF, U+0750 to U+077F, U+08A0 to U+08FF
  if ((code >= 0x0600 && code <= 0x06FF) ||
      (code >= 0x0750 && code <= 0x077F) ||
      (code >= 0x08A0 && code <= 0x08FF)) {
    return BidiType.R;
  }

  // European Numbers: 0-9
  if (code >= 0x0030 && code <= 0x0039) return BidiType.EN;

  // Whitespace
  if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
    return BidiType.WS;
  }

  // Latin (ASCII letters + Latin Extended)
  if ((code >= 0x0041 && code <= 0x005A) || // A-Z
      (code >= 0x0061 && code <= 0x007A) || // a-z
      (code >= 0x00C0 && code <= 0x00FF) || // Latin Extended-A
      (code >= 0x0100 && code <= 0x017F)) { // Latin Extended-B
    return BidiType.L;
  }

  // Default: Other Neutral
  return BidiType.ON;
}

/**
 * Resolve BiDi text to visual order.
 * 
 * This is a simplified implementation for M1.1 that handles common cases:
 * - Pure Hebrew (RTL)
 * - Pure Latin (LTR)
 * - Hebrew with embedded English words
 * - Hebrew with embedded numbers
 * 
 * @param text Input text in logical order (reading order)
 * @param baseDir Base paragraph direction (default: Auto-detect)
 * @returns Visual ordering information
 */
export function resolveBiDi(
  text: string,
  baseDir: BaseDirection = BaseDirection.Auto
): BiDiResult {
  if (text.length === 0) {
    return {
      text: '',
      visualOrder: [],
      types: [],
      baseDirection: BaseDirection.LTR,
      levels: [],
    };
  }

  // Get character types
  const types: BidiType[] = text.split('').map(getCharType);

  // Detect base direction if Auto
  let resolvedBaseDir = baseDir;
  if (baseDir === BaseDirection.Auto) {
    resolvedBaseDir = detectBaseDirection(types);
  }

  // Compute embedding levels
  const levels = computeEmbeddingLevels(types, resolvedBaseDir);
  
  // Compute visual order
  const visualOrder = computeVisualOrder(levels);

  return {
    text,
    visualOrder,
    types,
    baseDirection: resolvedBaseDir,
    levels,
  };
}

/**
 * Detect base direction from character types.
 * First strong directional character determines direction.
 */
function detectBaseDirection(types: BidiType[]): BaseDirection {
  for (const type of types) {
    if (type === BidiType.R) return BaseDirection.RTL;
    if (type === BidiType.L) return BaseDirection.LTR;
  }
  return BaseDirection.LTR; // Default
}

/**
 * Compute embedding levels for each character.
 * Level 0 = LTR, Level 1 = RTL, higher levels = nested embeddings
 * 
 * Simplified implementation for M1.1:
 * - Base level 0 (LTR) or 1 (RTL)
 * - Runs of opposite direction get incremented level
 */
function computeEmbeddingLevels(
  types: BidiType[],
  _baseDir: BaseDirection
): number[] {
  const levels: number[] = [];

  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    
    if (_baseDir === BaseDirection.RTL) {
      // RTL base: Hebrew text at level 1, Latin at level 2
      if (type === BidiType.R) {
        levels.push(1);
      } else if (type === BidiType.L) {
        levels.push(2);
      } else if (type === BidiType.EN) {
        // Numbers in RTL context: level 2 (LTR within RTL)
        levels.push(2);
      } else {
        levels.push(1); // Neutral inherits base level
      }
    } else {
      // LTR base: Latin at level 0, Hebrew at level 1
      if (type === BidiType.L || type === BidiType.EN) {
        levels.push(0);
      } else if (type === BidiType.R) {
        levels.push(1);
      } else {
        levels.push(0);
      }
    }
  }

  return levels;
}

/**
 * Compute visual order from embedding levels.
 * 
 * Algorithm (simplified UAX #9 L2):
 * 1. Build initial index array [0, 1, 2, ...]
 * 2. For each level from max down to 1:
 *    - Find runs at this level
 *    - Reverse odd-level runs (RTL)
 * 3. Return reordered indices
 */
function computeVisualOrder(levels: number[]): number[] {
  const len = levels.length;
  if (len === 0) return [];

  // Start with logical order
  const indices = Array.from({ length: len }, (_, i) => i);

  // Find highest level
  const maxLevel = Math.max(...levels, 0);

  // Process each level from max down to 1
  // (Level 0 is LTR and doesn't need reversal)
  for (let level = maxLevel; level >= 1; level--) {
    let start = 0;
    
    while (start < len) {
      // Skip characters below this level
      while (start < len && (levels[start] ?? 0) < level) {
        start++;
      }
      
      if (start >= len) break;

      // Find end of run at this level
      let end = start;
      while (end < len && (levels[end] ?? 0) >= level) {
        end++;
      }

      // Reverse this run if level is odd
      if (level % 2 === 1) {
        const segment = indices.slice(start, end);
        segment.reverse();
        for (let i = 0; i < segment.length; i++) {
          const segmentValue = segment[i];
          if (segmentValue !== undefined) {
            indices[start + i] = segmentValue;
          }
        }
      }

      start = end;
    }
  }

  return indices;
}

/**
 * Apply visual reordering to an array of items.
 * 
 * @param items Array in logical order
 * @param visualOrder Visual ordering (from resolveBiDi)
 * @returns Array in visual order
 */
export function reorderToVisual<T>(items: T[], visualOrder: number[]): T[] {
  return visualOrder.map(i => items[i]).filter((item): item is T => item !== undefined);
}

/**
 * Reorder string to visual order.
 * 
 * @param text Text in logical order
 * @param bidiResult BiDi resolution result
 * @returns Text in visual order (ready for display)
 */
export function getVisualText(text: string, bidiResult: BiDiResult): string {
  const chars = text.split('');
  const visualChars = reorderToVisual(chars, bidiResult.visualOrder);
  return visualChars.join('');
}
