/**
 * Text shaping using HarfBuzz
 * Converts text + font into positioned glyphs with proper diacritics
 */

import type { Distance, Coord } from '../core/units.js';
import type { PositionedGlyph, ShapedRun } from '../core/types.js';
import { ptToMpt } from '../core/units.js';

// Import harfbuzzjs
// Note: May need to adjust import based on package structure
let hb: any;

/**
 * Initialize HarfBuzz (lazy load)
 */
async function initHarfBuzz(): Promise<any> {
  if (hb) return hb;
  
  try {
    // Try dynamic import
    const module = await import('harfbuzzjs');
    hb = module.default || module;
    return hb;
  } catch (error) {
    throw new Error(`Failed to load HarfBuzz: ${error}`);
  }
}

/**
 * Shape text with HarfBuzz
 * 
 * @param text - Text to shape (Hebrew with nikud/teamim)
 * @param fontBuffer - Font file as ArrayBuffer
 * @param fontSize - Font size in points
 * @param features - OpenType features (optional)
 * @returns ShapedRun with positioned glyphs
 */
export async function shape(
  text: string,
  fontBuffer: ArrayBuffer,
  fontSize: number,
  features?: Record<string, boolean>
): Promise<ShapedRun> {
  const hbInstance = await initHarfBuzz();
  
  // Create blob from font data
  const blob = hbInstance.createBlob(fontBuffer);
  const face = hbInstance.createFace(blob, 0);
  const font = hbInstance.createFont(face);
  
  // Set font size (HarfBuzz uses 26.6 fixed-point, we use points)
  const scale = fontSize * 64; // Convert to 26.6 format
  font.setScale(scale, scale);
  
  // Create buffer
  const buffer = hbInstance.createBuffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  
  // Apply features if provided
  const featureList = features
    ? Object.entries(features).map(([tag, value]) => ({ tag, value: value ? 1 : 0 }))
    : [];
  
  // Shape!
  hbInstance.shape(font, buffer, featureList);
  
  // Get results
  const result = buffer.json(font);
  
  // Convert to our format
  const glyphs: PositionedGlyph[] = result.map((item: any) => ({
    glyphId: item.g,
    x: ptToMpt((item.dx || 0) / 64), // Convert from 26.6 to mpt
    y: ptToMpt((item.dy || 0) / 64),
    advance: ptToMpt((item.ax || 0) / 64),
  }));
  
  // Calculate total width
  const width = glyphs.reduce((sum, g) => sum + g.advance, 0);
  
  // Detect direction from buffer
  const direction = buffer.direction === 'rtl' ? 'rtl' : 'ltr';
  
  // Cleanup
  buffer.destroy();
  font.destroy();
  face.destroy();
  blob.destroy();
  
  return {
    font: 'unknown', // TODO: Extract from font metadata
    size: ptToMpt(fontSize),
    glyphs,
    direction: direction as 'rtl' | 'ltr',
    width,
  };
}

/**
 * Simple synchronous wrapper for testing
 * In production, use async shape() function
 */
export async function shapeSync(
  text: string,
  fontBuffer: ArrayBuffer,
  fontSize: number
): Promise<ShapedRun> {
  return shape(text, fontBuffer, fontSize);
}

/**
 * Get HarfBuzz version info
 */
export async function getVersion(): Promise<string> {
  const hbInstance = await initHarfBuzz();
  // HarfBuzzJS may not expose version, return package version
  return 'harfbuzzjs-1.6.3';
}
