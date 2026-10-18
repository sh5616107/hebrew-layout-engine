/**
 * Check Y-offsets in HarfBuzz shaping
 * Utility types and constants for Y-offset verification tools.
 * 
 * NOTE: This file defines types but has no runtime code.
 * It serves as a reference for future Y-offset debugging tools.
 */

import path from 'path';

export const FONT_PATH = path.join(process.cwd(), 'fonts', 'SILEOT.ttf');

export interface ShapingResult {
  text: string;
  glyphs: {
    id: number;
    xAdvance: number;
    yAdvance: number;
    xOffset: number;
    yOffset: number;
  }[];
  features: string[];
}
