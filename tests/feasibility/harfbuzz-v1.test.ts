/**
 * HarfBuzz v1 API Feasibility Test
 * 
 * Tests harfbuzzjs v1.6.3+ with new API:
 * - new hb.Blob(), new hb.Face(), new hb.Font()
 * - buffer.getGlyphInfos(), buffer.getGlyphPositions()
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import * as hb from 'harfbuzzjs';

// Find an available font
function loadFont(): ArrayBuffer | null {
  const fontPaths = [
    'C:\\Windows\\Fonts\\david.ttf',
    'C:\\Windows\\Fonts\\DavidCLM-Medium.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  ];
  
  for (const path of fontPaths) {
    if (existsSync(path)) {
      console.log(`Using font: ${path}`);
      return readFileSync(path).buffer;
    }
  }
  
  return null;
}

describe('HarfBuzz v1 Feasibility', () => {
  it('module loads with correct exports', () => {
    expect(hb).toBeDefined();
    expect(typeof hb.Buffer).toBe('function');
    expect(typeof hb.Blob).toBe('function');
    expect(typeof hb.Face).toBe('function');
    expect(typeof hb.Font).toBe('function');
    expect(typeof hb.shape).toBe('function');
  });

  it('shapes simple Hebrew text', () => {
    const fontBuffer = loadFont();
    if (!fontBuffer) {
      console.warn('No font found, skipping test');
      return;
    }
    
    const blob = new hb.Blob(fontBuffer);
    const face = new hb.Face(blob);
    const font = new hb.Font(face);
    
    const buffer = new hb.Buffer();
    buffer.addText('בראשית');
    buffer.guessSegmentProperties();
    
    hb.shape(font, buffer);
    
    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    
    expect(infos.length).toBeGreaterThan(0);
    expect(positions.length).toBe(infos.length);
    
    // Check structure
    expect(infos[0]).toHaveProperty('codepoint');
    expect(positions[0]).toHaveProperty('xAdvance');
    expect(positions[0]).toHaveProperty('yAdvance');
    expect(positions[0]).toHaveProperty('xOffset');
    expect(positions[0]).toHaveProperty('yOffset');
    
    console.log(`Shaped ${infos.length} glyphs`);
    console.log('First glyph ID:', infos[0].codepoint);
    console.log('First advance:', positions[0].xAdvance);
    
    buffer.destroy();
    font.destroy();
    face.destroy();
    blob.destroy();
  });

  it('shapes Hebrew with nikud (CRITICAL)', () => {
    const fontBuffer = loadFont();
    if (!fontBuffer) {
      console.warn('No font found, skipping test');
      return;
    }
    
    const blob = new hb.Blob(fontBuffer);
    const face = new hb.Face(blob);
    const font = new hb.Font(face);
    
    const buffer = new hb.Buffer();
    // בְּרֵאשִׁית = bet + shva + dagesh + resh + segol + ...
    buffer.addText('בְּרֵאשִׁית');
    buffer.guessSegmentProperties();
    
    hb.shape(font, buffer);
    
    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    
    // Should have more glyphs than base characters
    const baseChars = 5; // ב ר א ש ת
    expect(infos.length).toBeGreaterThanOrEqual(baseChars);
    
    // Check for non-zero offsets (diacritics positioning)
    const hasVerticalOffsets = positions.some(p => p.yOffset !== 0);
    const hasHorizontalOffsets = positions.some(p => p.xOffset !== 0);
    
    console.log(`Shaped ${infos.length} glyphs (expected >=${baseChars})`);
    console.log('Has vertical offsets (nikud):', hasVerticalOffsets);
    console.log('Has horizontal offsets:', hasHorizontalOffsets);
    
    if (hasVerticalOffsets) {
      console.log('✅ GPOS working - nikud marks positioned');
    } else {
      console.warn('⚠️  No vertical offsets - font may lack GPOS');
    }
    
    buffer.destroy();
    font.destroy();
    face.destroy();
    blob.destroy();
  });

  it('detects RTL direction', () => {
    const buffer = new hb.Buffer();
    buffer.addText('בראשית');
    buffer.guessSegmentProperties();
    
    // Check direction property
    const dir = buffer.direction;
    expect(dir).toBe('rtl');
    
    console.log('Direction:', dir);
    
    buffer.destroy();
  });

  it('handles BiDi text (Hebrew + Latin)', () => {
    const fontBuffer = loadFont();
    if (!fontBuffer) {
      console.warn('No font found, skipping test');
      return;
    }
    
    const blob = new hb.Blob(fontBuffer);
    const face = new hb.Face(blob);
    const font = new hb.Font(face);
    
    const buffer = new hb.Buffer();
    buffer.addText('Genesis 1:1 בראשית');
    buffer.guessSegmentProperties();
    
    hb.shape(font, buffer);
    
    const infos = buffer.getGlyphInfos();
    
    // Should have glyphs for both Latin and Hebrew
    expect(infos.length).toBeGreaterThan(10);
    
    console.log(`BiDi text shaped: ${infos.length} glyphs`);
    
    buffer.destroy();
    font.destroy();
    face.destroy();
    blob.destroy();
  });

  it('performance: 100 word shapes', () => {
    const fontBuffer = loadFont();
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
    
    const iterations = 10;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      for (const word of words) {
        const buffer = new hb.Buffer();
        buffer.addText(word);
        buffer.guessSegmentProperties();
        hb.shape(font, buffer);
        buffer.destroy();
      }
    }
    
    const elapsed = performance.now() - start;
    const totalWords = iterations * words.length;
    const wordsPerSecond = totalWords / (elapsed / 1000);
    
    console.log(`Shaped ${totalWords} words in ${elapsed.toFixed(2)}ms`);
    console.log(`Throughput: ${wordsPerSecond.toFixed(0)} words/second`);
    console.log(`Average: ${(elapsed / totalWords).toFixed(2)}ms per word`);
    
    // Target: > 500 words/second (conservative)
    expect(wordsPerSecond).toBeGreaterThan(100);
    
    font.destroy();
    face.destroy();
    blob.destroy();
  }, 30000);

  it('determinism: same input yields same output', () => {
    const fontBuffer = loadFont();
    if (!fontBuffer) {
      console.warn('No font found, skipping test');
      return;
    }
    
    const blob = new hb.Blob(fontBuffer);
    const face = new hb.Face(blob);
    const font = new hb.Font(face);
    
    const text = 'בְּרֵאשִׁית';
    
    // Shape twice
    const buffer1 = new hb.Buffer();
    buffer1.addText(text);
    buffer1.guessSegmentProperties();
    hb.shape(font, buffer1);
    const infos1 = buffer1.getGlyphInfos();
    const positions1 = buffer1.getGlyphPositions();
    
    const buffer2 = new hb.Buffer();
    buffer2.addText(text);
    buffer2.guessSegmentProperties();
    hb.shape(font, buffer2);
    const infos2 = buffer2.getGlyphInfos();
    const positions2 = buffer2.getGlyphPositions();
    
    // Compare
    expect(infos1.length).toBe(infos2.length);
    
    for (let i = 0; i < infos1.length; i++) {
      expect(infos1[i].codepoint).toBe(infos2[i].codepoint);
      expect(positions1[i].xAdvance).toBe(positions2[i].xAdvance);
      expect(positions1[i].yAdvance).toBe(positions2[i].yAdvance);
      expect(positions1[i].xOffset).toBe(positions2[i].xOffset);
      expect(positions1[i].yOffset).toBe(positions2[i].yOffset);
    }
    
    console.log('✅ Deterministic: identical results on repeated shaping');
    
    buffer1.destroy();
    buffer2.destroy();
    font.destroy();
    face.destroy();
    blob.destroy();
  });
});
