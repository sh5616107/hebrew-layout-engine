/**
 * Corrected bidi-js API test
 * getEmbeddingLevels returns {levels, paragraphs}
 * getReorderSegments(text, embeddingLevels) receives the object
 */

import { describe, it, expect, beforeAll } from 'vitest';

describe('bidi-js - Corrected API', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bidiFactory: any;

  beforeAll(async () => {
    bidiFactory = await import('bidi-js');
  });

  it('should return {levels, paragraphs} from getEmbeddingLevels', () => {
    const bidi = bidiFactory.default();
    const text = 'בראשית ברא אלהים';
    
    const result = bidi.getEmbeddingLevels(text);
    
    console.log('Result type:', typeof result);
    console.log('Result keys:', Object.keys(result));
    console.log('Result.levels type:', typeof result.levels);
    console.log('Full result:', result);
    
    expect(result).toHaveProperty('levels');
    expect(result).toHaveProperty('paragraphs');
    expect(typeof result.levels).toBe('object'); // Uint8Array
    expect(result.levels.length).toBe(text.length);
    
    // Hebrew text should have RTL levels (odd numbers, typically 1)
    expect(result.levels[0]).toBe(1);
  });

  it('should reorder mixed LTR-RTL text using getReorderSegments', () => {
    const bidi = bidiFactory.default();
    const text = 'Genesis בראשית';
    
    const embeddingLevels = bidi.getEmbeddingLevels(text);
    const segments = bidi.getReorderSegments(text, embeddingLevels);
    
    console.log('Text:', text);
    console.log('Embedding levels:', embeddingLevels);
    console.log('Segments:', segments);
    console.log('Segments length:', segments.length);
    
    // Note: segments gives runs that need reordering
    // For pure RTL, might be 1 segment covering whole text
    expect(Array.isArray(segments)).toBe(true);
    expect(segments.length).toBeGreaterThanOrEqual(1);
  });

  it('should reorder string using getReorderedString', () => {
    const bidi = bidiFactory.default();
    const text = 'Genesis בראשית';
    
    const embeddingLevels = bidi.getEmbeddingLevels(text);
    const reordered = bidi.getReorderedString(text, embeddingLevels);
    
    expect(typeof reordered).toBe('string');
    expect(reordered.length).toBe(text.length);
    
    console.log('Original:', text);
    console.log('Reordered:', reordered);
  });

  it('should handle pure Hebrew text', () => {
    const bidi = bidiFactory.default();
    const text = 'בראשית ברא אלהים את השמים';
    
    const embeddingLevels = bidi.getEmbeddingLevels(text);
    const segments = bidi.getReorderSegments(text, embeddingLevels);
    
    expect(embeddingLevels.levels.every((l: number) => l === 1)).toBe(true);
    console.log('Pure Hebrew segments:', segments);
  });

  it('should preserve nikud characters in reordering', () => {
    const bidi = bidiFactory.default();
    const text = 'בְּרֵאשִׁית בָּרָא';
    
    const embeddingLevels = bidi.getEmbeddingLevels(text);
    const reordered = bidi.getReorderedString(text, embeddingLevels);
    
    expect(reordered).toContain('ְ'); // Shva
    expect(reordered).toContain('ֵ'); // Tsere
    expect(reordered).toContain('ִ'); // Hiriq
    
    console.log('With nikud:', text);
    console.log('Reordered:', reordered);
  });

  it('should work with shaped runs reordering (design goal)', () => {
    const bidi = bidiFactory.default();
    
    // Simulate shaped runs (each run is a shaped word)
    const runs = [
      { text: 'Genesis', isRTL: false },
      { text: ' ', isRTL: false },
      { text: '1:1', isRTL: false },
      { text: ' ', isRTL: true },
      { text: 'בְּרֵאשִׁית', isRTL: true },
    ];
    
    const fullText = runs.map(r => r.text).join('');
    const embeddingLevels = bidi.getEmbeddingLevels(fullText);
    const segments = bidi.getReorderSegments(fullText, embeddingLevels);
    
    // Goal: map segments back to shaped runs without character reversal
    expect(segments.length).toBeGreaterThan(0);
    
    console.log('Runs:', runs);
    console.log('Segments:', segments);
  });
});
