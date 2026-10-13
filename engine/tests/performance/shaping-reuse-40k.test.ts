/**
 * Shaping Performance Test with Object Reuse
 * 
 * Measures real-world shaping performance with:
 * - Reused Blob, Face, Font (loaded once)
 * - Reused Buffer (cleared between uses)
 * - 40,000 word corpus
 * - 5 runs for median calculation
 */

import { describe, it } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import * as hb from 'harfbuzzjs';

describe('Shaping Performance with Reuse (40k words)', () => {
  it('measures median time over 5 runs', () => {
    // Load font once
    const fontPaths = [
      'fonts/SILEOT.ttf', // Ezra SIL
      'C:\\Windows\\Fonts\\david.ttf',
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
      console.warn('No font found, skipping performance test');
      return;
    }
    
    // Create HarfBuzz objects ONCE (reuse across all words)
    const blob = new hb.Blob(fontBuffer);
    const face = new hb.Face(blob);
    const font = new hb.Font(face);
    const buffer = new hb.Buffer();
    
    // Sample Hebrew words (realistic corpus)
    const words = [
      'בְּרֵאשִׁית', 'בָּרָא', 'אֱלֹהִים', 'אֵת', 'הַשָּׁמַיִם',
      'וְאֵת', 'הָאָרֶץ', 'וְהָאָרֶץ', 'הָיְתָה', 'תֹהוּ',
      'וָבֹהוּ', 'וְחֹשֶׁךְ', 'עַל', 'פְּנֵי', 'תְהוֹם',
      'וְרוּחַ', 'מְרַחֶפֶת', 'פְּנֵי', 'הַמָּיִם', 'וַיֹּאמֶר',
    ];
    
    const targetWords = 40000;
    const runs = 5;
    const times: number[] = [];
    
    console.log(`\nShaping ${targetWords} words with object reuse...`);
    console.log(`Font objects created once, buffer reused\n`);
    
    for (let run = 0; run < runs; run++) {
      const start = performance.now();
      
      let wordsProcessed = 0;
      while (wordsProcessed < targetWords) {
        for (const word of words) {
          if (wordsProcessed >= targetWords) break;
          
          // Reuse buffer - clear and add new text
          buffer.clearContents();
          buffer.addText(word);
          buffer.guessSegmentProperties();
          
          // Shape
          hb.shape(font, buffer);
          
          // Get results (to simulate real usage)
          buffer.getGlyphInfos();
          buffer.getGlyphPositions();
          
          wordsProcessed++;
        }
      }
      
      const elapsed = performance.now() - start;
      times.push(elapsed);
      
      const wps = targetWords / (elapsed / 1000);
      console.log(`Run ${run + 1}: ${elapsed.toFixed(2)}ms (${wps.toFixed(0)} words/sec)`);
    }
    
    // Calculate median
    const sorted = times.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const medianWps = targetWords / (median / 1000);
    
    console.log(`\n=== MEDIAN (5 runs) ===`);
    console.log(`Time: ${median.toFixed(2)}ms`);
    console.log(`Throughput: ${medianWps.toFixed(0)} words/second`);
    console.log(`Average: ${(median / targetWords).toFixed(3)}ms per word`);
    
    // Cleanup
    console.log(`\nFont objects reused throughout, no .destroy() needed (v1 API)`);
  }, 300000); // 5 minute timeout for 40k words × 5 runs
});
