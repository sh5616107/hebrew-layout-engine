/**
 * Word spacing adjuster for alternative line breaks (Stage B).
 * Generates alternative paragraph breaks with different word spacing.
 * Implements ADR-007 Stage B.
 */

import type {
  LayoutParagraph,
  LineBreakAlternative,
  SectionDiagnostic,
} from '../core/types.js';
import type { WordSpacingRangeConfig } from '../core/config.js';

export interface SpacingAdjusterOptions {
  /** Current spacing configuration */
  spacingConfig: WordSpacingRangeConfig;
  /** Target line delta to achieve (negative = need fewer lines, positive = need more lines) */
  targetLineDelta: number;
  /** Section ID for diagnostics */
  sectionId: string;
  /** Paragraph ID for diagnostics */
  paragraphId: string;
}

/**
 * Generate alternative line breaks with different word spacing.
 * 
 * Strategy:
 * - If targetLineDelta < 0 (need fewer lines): try tighter spacing (90% down to 80%)
 * - If targetLineDelta > 0 (need more lines): try looser spacing (115% up to 130%)
 * - Generate alternatives in 5% increments within allowed range
 * 
 * Note: Current implementation generates mock alternatives since we need
 * actual line breaking with spacing control. This is a placeholder that
 * demonstrates the interface and diagnostic generation.
 * 
 * @param paragraph - Paragraph to generate alternatives for
 * @param options - Spacing adjuster options
 * @returns Array of alternatives with diagnostics
 */
export function generateAlternativeBreaks(
  paragraph: LayoutParagraph,
  options: SpacingAdjusterOptions
): { alternatives: LineBreakAlternative[]; diagnostics: SectionDiagnostic[] } {
  const { spacingConfig, targetLineDelta, sectionId, paragraphId } = options;
  const alternatives: LineBreakAlternative[] = [];
  const diagnostics: SectionDiagnostic[] = [];

  const currentLineCount = paragraph.lines.length;

  // Determine spacing range to try based on target delta
  const spacingsToTry: number[] = [];
  
  if (targetLineDelta < 0) {
    // Need fewer lines: try tighter spacing (preferred.min down to allowed.min)
    for (let pct = spacingConfig.preferred.min; pct >= spacingConfig.allowed.min; pct -= 5) {
      spacingsToTry.push(pct);
    }
  } else if (targetLineDelta > 0) {
    // Need more lines: try looser spacing (preferred.max up to allowed.max)
    for (let pct = spacingConfig.preferred.max; pct <= spacingConfig.allowed.max; pct += 5) {
      spacingsToTry.push(pct);
    }
  } else {
    // Delta is 0, try both directions slightly
    const midPreferredTight = Math.round((spacingConfig.preferred.min + 100) / 2);
    const midPreferredLoose = Math.round((100 + spacingConfig.preferred.max) / 2);
    spacingsToTry.push(midPreferredTight, midPreferredLoose);
  }

  // Generate alternatives (mock implementation)
  // In real implementation, this would call the line breaker with adjusted spacing
  for (const spacing of spacingsToTry) {
    // Skip if outside allowed range
    if (spacing < spacingConfig.allowed.min || spacing > spacingConfig.allowed.max) {
      continue;
    }

    // Mock: estimate line count change based on spacing
    // Tighter spacing (< 100%) tends to reduce lines
    // Looser spacing (> 100%) tends to increase lines
    const estimatedLineDelta = Math.round((spacing - 100) / 10);
    const newLineCount = Math.max(1, currentLineCount + estimatedLineDelta);

    // Create alternative (mock - reuses existing lines)
    const alternative: LineBreakAlternative = {
      lines: paragraph.lines.slice(0, newLineCount), // Mock: just truncate or repeat
      wordSpacingPercent: spacing,
      quality: calculateQuality(spacing, spacingConfig),
      penaltyInfo: {
        tightLines: spacing < spacingConfig.preferred.min ? 1 : 0,
        looseLines: spacing > spacingConfig.preferred.max ? 1 : 0,
        rivers: 0,
      },
    };

    alternatives.push(alternative);

    // Generate diagnostic if outside preferred range
    if (spacing < spacingConfig.preferred.min || spacing > spacingConfig.preferred.max) {
      diagnostics.push({
        code: 'WORD_SPACING_OUTSIDE_PREFERRED',
        severity: 'info',
        sectionId,
        paragraphId,
        stableKey: `${sectionId}:${paragraphId}:WORD_SPACING_OUTSIDE_PREFERRED`,
        message: `Word spacing ${spacing}% outside preferred range (${spacingConfig.preferred.min}-${spacingConfig.preferred.max}%)`,
        attemptedStrategies: [`spacing-${spacing}%`],
      });
    }
  }

  return { alternatives, diagnostics };
}

/**
 * Calculate quality score for a given spacing percentage.
 * 
 * Quality is highest (1.0) within preferred range, degrades outside it.
 */
function calculateQuality(spacing: number, config: WordSpacingRangeConfig): number {
  const { preferred, allowed } = config;

  // Within preferred range: quality = 1.0
  if (spacing >= preferred.min && spacing <= preferred.max) {
    return 1.0;
  }

  // Outside preferred but within allowed: degrade linearly
  if (spacing < preferred.min) {
    // Between allowed.min and preferred.min
    const range = preferred.min - allowed.min;
    const deviation = preferred.min - spacing;
    return Math.max(0, 1.0 - (deviation / range) * 0.5); // Max 0.5 penalty
  } else {
    // Between preferred.max and allowed.max
    const range = allowed.max - preferred.max;
    const deviation = spacing - preferred.max;
    return Math.max(0, 1.0 - (deviation / range) * 0.5); // Max 0.5 penalty
  }
}

/**
 * Select best alternative from generated alternatives.
 * 
 * Criteria:
 * 1. Closest to target line count
 * 2. Within allowed spacing range
 * 3. Highest quality score
 * 
 * @param alternatives - Available alternatives
 * @param currentLineCount - Current line count
 * @param targetLineDelta - Target line delta (negative = fewer, positive = more)
 * @returns Best alternative or null if none help
 */
export function selectBestAlternative(
  alternatives: LineBreakAlternative[],
  currentLineCount: number,
  targetLineDelta: number
): LineBreakAlternative | null {
  if (alternatives.length === 0) {
    return null;
  }

  const targetLineCount = currentLineCount + targetLineDelta;

  let best: LineBreakAlternative | null = null;
  let bestScore = -Infinity;

  for (const alt of alternatives) {
    const lineCount = alt.lines.length;
    const lineDelta = Math.abs(lineCount - targetLineCount);
    
    // Score: penalize line delta, reward quality
    // Lower delta is better, higher quality is better
    const score = alt.quality * 10 - lineDelta;

    if (score > bestScore) {
      bestScore = score;
      best = alt;
    }
  }

  return best;
}
