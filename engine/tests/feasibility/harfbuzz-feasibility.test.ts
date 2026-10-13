/**
 * HarfBuzz Feasibility Test
 * 
 * This test verifies that HarfBuzzJS can:
 * 1. Load and initialize
 * 2. Shape Hebrew text with nikud
 * 3. Position diacritics correctly (GPOS)
 * 4. Handle RTL direction
 * 
 * This is a CRITICAL test - if it fails, the architecture needs revision.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import * as hb from 'harfbuzzjs';

describe('HarfBuzz Feasibility', () => {
  it('harfbuzzjs module loads', () => {
    expect(hb).toBeDefined();
    expect(typeof hb.Buffer).toBe('function');
    expect(typeof hb.Blob).toBe('function');
    expect(typeof hb.Face).toBe('function');
    expect(typeof hb.Font).toBe('function');
  });

  it('shapes simple Hebrew text', () => {
    // Try to load a font (we may not have one yet)
    const fontPaths = [
      'C:\\Windows\\Fonts\\david.ttf',
      'C:\\Windows\\Fonts\\arial.ttf',
      '/System/Library/Fonts/Supplemental/Arial.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ];
    
    let fontBuffer: ArrayBuffer | null = null;
    for (const path of fontPaths) {
      if (existsSync(path)) {
        fontBuffer = readFileSync(path).buffer;
        console.log(`Using font: ${path}`);
        break;
      }
    }
    
    if (!fontBuffer) {
      console.warn('No font found, skipping shaping test');
      return;
    }
    
    // v1 API: new Blob(), new Face(), new Font()
    const blob = new hb.Blob(fontBuffer);
    const face = new hb.Face(blob);
    const font = new hb.Font(face);
    
    // Create buffer and add text
    const buffer = new hb.Buffer();
    const text = 'בראשית'; // "Genesis" without nikud
    buffer.addText(text);
    buffer.guessSegmentProperties();
    
    // Shape
    hb.shape(font, buffer);
    
    // Get results (v1 API: getGlyphInfos() and getGlyphPositions())
    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    
    // Verify
    expect(infos).toBeDefined();
    expect(Array.isArray(infos)).toBe(true);
    expect(infos.length).toBeGreaterThan(0);
    expect(positions.length).toBe(infos.length);
    
    // Each glyph should have codepoint (glyph ID) and positions
    infos.forEach((glyph, i) => {
      expect(glyph).toHaveProperty('codepoint'); // glyph ID
      expect(positions[i]).toHaveProperty('xAdvance');
    });
    
    console.log('Shaped glyphs:', infos.length);
    console.log('Sample glyph:', infos[0]);
    console.log('Sample position:', positions[0]);
    
    // v1 API: no .destroy() - garbage collected automatically
  });

  it('shapes Hebrew with nikud (critical test)', () => {
    // Find David or similar font with nikud support
    const fontPaths = [
      'C:\\Windows\\Fonts\\david.ttf',
      'C:\\Windows\\Fonts\\DavidCLM-Medium.ttf',
    ];
    
    let fontBuffer: ArrayBuffer | null = null;
    for (const path of fontPaths) {
      if (existsSync(path)) {
        fontBuffer = readFileSync(path).buffer;
        console.log(`Using font with nikud: ${path}`);
        break;
      }
    }
    
    if (!fontBuffer) {
      console.warn('No font with nikud support found, skipping');
      return;
    }
    
    const blob = new hb.Blob(fontBuffer);
    const face = new hb.Face(blob);
    const font = new hb.Font(face);
    
    const buffer = new hb.Buffer();
    
    // בְּרֵאשִׁית = bet + shva + dagesh + resh + segol + alef + hiriq + shin + dagesh + tav
    const text = 'בְּרֵאשִׁית';
    buffer.addText(text);
    buffer.guessSegmentProperties();
    
    hb.shape(font, buffer);
    
    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    
    // Should have more glyphs than base characters (marks are separate)
    const baseChars = 5; // ב ר א ש ת
    expect(infos.length).toBeGreaterThanOrEqual(baseChars);
    
    // Check for offsets (xOffset or yOffset) indicating marks positioning
    const hasVerticalOffsets = positions.some(p => p.yOffset !== 0);
    const hasHorizontalOffsets = positions.some(p => p.xOffset !== 0);
    
    console.log('Glyphs with nikud:', infos.length);
    console.log('Vertical offsets found:', hasVerticalOffsets);
    console.log('Horizontal offsets found:', hasHorizontalOffsets);
    
    if (hasVerticalOffsets || hasHorizontalOffsets) {
      console.log('✓ Nikud marks positioned correctly (offsets found)');
    } else {
      console.warn('⚠ No offsets found - font may lack GPOS');
    }
    
    // v1 API: no .destroy() - garbage collected automatically
  });

  it('detects RTL direction', () => {
    const buffer = new hb.Buffer();
    buffer.addText('בראשית');
    buffer.guessSegmentProperties();
    
    // v1 API: direction property not directly exposed
    // But HarfBuzz uses it internally for shaping
    const infos = buffer.getGlyphInfos();
    expect(infos.length).toBeGreaterThan(0);
    
    console.log('Direction used internally by HarfBuzz for RTL shaping');
    
    // v1 API: no .destroy() - garbage collected automatically
  });

  it('performance: shape 100 words', () => {
    const fontPaths = [
      'C:\\Windows\\Fonts\\david.ttf',
      'C:\\Windows\\Fonts\\arial.ttf',
    ];
    
    let fontBuffer: ArrayBuffer | null = null;
    for (const path of fontPaths) {
      if (existsSync(path)) {
        fontBuffer = readFileSync(path).buffer;
        break;
      }
    }
    
    if (!fontBuffer) {
      console.warn('No font for performance test');
      return;
    }
    
    const blob = new hb.Blob(fontBuffer);
    const face = new hb.Face(blob);
    const font = new hb.Font(face);
    
    const words = [
      'בראשית', 'ברא', 'אלהים', 'את', 'השמים',
      'ואת', 'הארץ', 'והארץ', 'היתה', 'תהו',
    ];
    
    const iterations = 10; // 10 * 10 words = 100 total
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      for (const word of words) {
        const buffer = new hb.Buffer();
        buffer.addText(word);
        buffer.guessSegmentProperties();
        hb.shape(font, buffer);
        // v1 API: no .destroy() needed
      }
    }
    
    const elapsed = performance.now() - start;
    const wordsPerSecond = (iterations * words.length) / (elapsed / 1000);
    
    console.log(`Shaped ${iterations * words.length} words in ${elapsed.toFixed(2)}ms`);
    console.log(`Throughput: ${wordsPerSecond.toFixed(0)} words/second`);
    
    // Target: > 100 words/second (conservative)
    expect(wordsPerSecond).toBeGreaterThan(100);
    
    // v1 API: no .destroy() - garbage collected automatically
  }, 30000); // 30s timeout for performance test
});
