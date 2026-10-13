/**
 * M1.1 BiDi End-to-End Test
 * 
 * Demonstrates complete pipeline with BiDi support:
 * JSON → BiDi Resolution → Shaping → Line Breaking → Layout → PDF
 */

import { describe, it, expect } from 'vitest';
import { layoutDocument, type ShapedWord } from '../../src/core/layout-engine';
import { renderToPDF } from '../../src/rendering/pdf-renderer';
import { applyBiDiToWords } from '../../src/bidi/bidi-integration';
import * as path from 'path';
import * as fs from 'fs';

function mockShapedWord(text: string, widthPt: number): ShapedWord {
  return {
    text,
    glyphIds: Array(text.length).fill(1),
    advances: Array(text.length).fill(widthPt / text.length),
    width: widthPt,
  };
}

describe('M1.1 BiDi E2E Pipeline', () => {
  const fontPath = 'C:\\Windows\\Fonts\\david.ttf';
  const outputDir = path.join(__dirname, '..', '..', 'out', 'e2e');

  it('should process mixed Hebrew + English document', async () => {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('\n=== M1.1 BiDi Pipeline ===');

    // Step 1: Input - Mixed Hebrew + English words (logical order)
    const logicalWords: ShapedWord[] = [
      mockShapedWord('בראשית', 42),
      mockShapedWord('ברא', 24),
      mockShapedWord('אלהים', 36),
      mockShapedWord('את', 14),
      mockShapedWord('השמים', 38),
      mockShapedWord('ואת', 20),
      mockShapedWord('הארץ', 32),
      mockShapedWord('(Genesis', 42),
      mockShapedWord('1:1)', 20),
    ];

    console.log('Step 1: Input - 9 words (7 Hebrew + 2 English)');

    // Step 2: BiDi Resolution
    const visualWords = applyBiDiToWords(logicalWords);

    console.log('Step 2: BiDi Resolution completed');
    expect(visualWords.length).toBe(9);

    // Step 3: Layout
    const layout = layoutDocument(visualWords);
    console.log(`Step 3: Layout - ${layout.pageCount} page(s)`);

    // Step 4: PDF Rendering
    const outputPath = path.join(outputDir, 'bidi-mixed.pdf');
    await renderToPDF(layout, { fontPath, fontSize: 14, outputPath });

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`✅ BiDi PDF: ${outputPath}`);
  });
});
