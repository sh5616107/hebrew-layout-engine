/**
 * End-to-end test: JSON → HarfBuzz Shaping → Line Breaking → Layout → PDF
 * 
 * This demonstrates the complete M1.0 pipeline.
 */

import { describe, it, expect } from 'vitest';
import { layoutDocument, type ShapedWord } from '../../src/core/layout-engine';
import { renderToPDF } from '../../src/rendering/pdf-renderer';
import * as path from 'path';
import * as fs from 'fs';

// For M1.0, we simulate HarfBuzz shaping with mock shaped words
// M2 will integrate real HarfBuzz shaping
function mockShapedWord(text: string, widthPt: number): ShapedWord {
  return {
    text,
    glyphIds: Array(text.length).fill(1),
    advances: Array(text.length).fill(widthPt / text.length),
    width: widthPt,
  };
}

describe('M1.0 Full Pipeline E2E', () => {
  const fontPath = 'C:\\Windows\\Fonts\\david.ttf';
  const outputDir = path.join(__dirname, '..', '..', 'out', 'e2e');

  it('should process complete Hebrew document end-to-end', async () => {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Step 1: Input - Simulated shaped Hebrew words
    // In production, these would come from:
    // - JSON parsing (input format)
    // - HarfBuzz shaping with real font
    const hebrewWords: ShapedWord[] = [
      // Simulate a paragraph of Hebrew text
      mockShapedWord('בראשית', 42),
      mockShapedWord('ברא', 24),
      mockShapedWord('אלהים', 36),
      mockShapedWord('את', 14),
      mockShapedWord('השמים', 38),
      mockShapedWord('ואת', 20),
      mockShapedWord('הארץ', 32),
      // Add more to fill multiple lines
      mockShapedWord('והארץ', 34),
      mockShapedWord('היתה', 28),
      mockShapedWord('תהו', 22),
      mockShapedWord('ובהו', 26),
      mockShapedWord('וחשך', 30),
      mockShapedWord('על', 16),
      mockShapedWord('פני', 24),
      mockShapedWord('תהום', 28),
      mockShapedWord('ורוח', 28),
      mockShapedWord('אלהים', 36),
      mockShapedWord('מרחפת', 38),
      mockShapedWord('על', 16),
      mockShapedWord('פני', 24),
      mockShapedWord('המים', 32),
    ];

    // Step 2: Layout
    // This performs:
    // - Line breaking (greedy algorithm)
    // - Two-column layout
    // - Page distribution
    console.log('\n=== M1.0 Pipeline ===');
    console.log('Step 1: Input - 21 shaped Hebrew words');
    
    const layout = layoutDocument(hebrewWords, {
      pageWidth: 595.28, // A4
      pageHeight: 841.89,
      leftMargin: 50,
      rightMargin: 50,
      topMargin: 50,
      bottomMargin: 50,
      columnGap: 14,
      lineHeight: 16,
      wordSpacing: 3.5,
      fontSize: 14,
    });

    console.log(`Step 2: Layout - ${layout.pageCount} page(s) generated`);
    console.log(`  Page 1: right column = ${layout.pages[0].rightColumn.lines.length} lines, left column = ${layout.pages[0].leftColumn.lines.length} lines`);

    expect(layout.pageCount).toBeGreaterThan(0);
    expect(layout.pages[0].rightColumn.lines.length).toBeGreaterThan(0);

    // Step 3: PDF Rendering
    const outputPath = path.join(outputDir, 'full-pipeline-m1.pdf');
    
    await renderToPDF(layout, {
      fontPath,
      fontSize: 14,
      outputPath,
    });

    console.log(`Step 3: PDF rendered to ${outputPath}`);

    // Verify output
    expect(fs.existsSync(outputPath)).toBe(true);
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(1000);

    console.log(`✅ M1.0 Pipeline Complete: ${stats.size} bytes written`);
    console.log(`   Open: ${outputPath}`);
  });

  it('should handle multi-page Hebrew document', async () => {
    // Create enough content for multiple pages
    const words: ShapedWord[] = [];
    
    // Simulate 10 paragraphs of Hebrew text with wide words
    for (let para = 0; para < 10; para++) {
      // Each paragraph has ~30 words, wide enough to force line breaks
      for (let w = 0; w < 30; w++) {
        words.push(mockShapedWord(`מילה${para}_${w}`, 150)); // Wide words
      }
    }

    console.log(`\nMulti-page test: ${words.length} words`);

    const layout = layoutDocument(words, {
      pageHeight: 400, // Smaller page for demo
      lineHeight: 14,
      fontSize: 12,
      topMargin: 20,
      bottomMargin: 20,
    });

    expect(layout.pageCount).toBeGreaterThan(1);
    console.log(`Generated ${layout.pageCount} pages`);

    const outputPath = path.join(outputDir, 'multi-page-hebrew.pdf');
    await renderToPDF(layout, {
      fontPath,
      fontSize: 12,
      outputPath,
    });

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log(`✅ Multi-page PDF: ${layout.pageCount} pages`);
  });

  it('should demonstrate RTL column ordering', async () => {
    // Create exactly enough words to partially fill both columns
    // This will demonstrate RTL: right column fills first
    const words: ShapedWord[] = [];
    
    for (let i = 0; i < 100; i++) {
      words.push(mockShapedWord(`טקסט${i}`, 150)); // Wide words
    }

    const layout = layoutDocument(words);

    const page1 = layout.pages[0];
    
    // Right column should have more or equal lines (fills first)
    expect(page1.rightColumn.lines.length).toBeGreaterThanOrEqual(
      page1.leftColumn.lines.length
    );

    console.log(`\nRTL Demo: right=${page1.rightColumn.lines.length}, left=${page1.leftColumn.lines.length}`);
    console.log('✅ Right column fills first (RTL convention)');

    const outputPath = path.join(outputDir, 'rtl-demo.pdf');
    await renderToPDF(layout, {
      fontPath,
      fontSize: 14,
      outputPath,
    });

    expect(fs.existsSync(outputPath)).toBe(true);
  });
});
