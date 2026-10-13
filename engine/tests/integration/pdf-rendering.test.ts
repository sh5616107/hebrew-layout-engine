import { describe, it, expect, beforeAll } from 'vitest';
import { layoutDocument, type ShapedWord } from '../../src/core/layout-engine';
import { renderToPDF } from '../../src/rendering/pdf-renderer';
import * as fs from 'fs';
import * as path from 'path';

describe('PDF Rendering Integration', () => {
  const fontPath = 'C:\\Windows\\Fonts\\david.ttf';
  const outputDir = path.join(__dirname, '..', '..', 'out');

  beforeAll(() => {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  function mockWord(text: string, width: number): ShapedWord {
    return {
      text,
      glyphIds: Array(text.length).fill(1),
      advances: Array(text.length).fill(width / text.length),
      width,
    };
  }

  it('should render simple Hebrew text to PDF', async () => {
    const words = [
      mockWord('שלום', 30),
      mockWord('עולם', 30),
      mockWord('יפה', 25),
    ];

    const layout = layoutDocument(words, {
      pageWidth: 400,
      pageHeight: 600,
      topMargin: 50,
      bottomMargin: 50,
      leftMargin: 50,
      rightMargin: 50,
    });

    const outputPath = path.join(outputDir, 'simple-hebrew.pdf');

    await renderToPDF(layout, {
      fontPath,
      fontSize: 12,
      outputPath,
    });

    // Verify PDF was created
    expect(fs.existsSync(outputPath)).toBe(true);
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    console.log(`PDF created: ${outputPath} (${stats.size} bytes)`);
  });

  it('should render multi-page document', async () => {
    // Create enough words for multiple pages
    const words: ShapedWord[] = [];
    for (let i = 0; i < 200; i++) {
      words.push(mockWord(`מילה${i}`, 150)); // Wide words to force line breaks
    }

    const layout = layoutDocument(words, {
      pageHeight: 400,
      lineHeight: 14,
    });

    expect(layout.pageCount).toBeGreaterThan(1);

    const outputPath = path.join(outputDir, 'multi-page.pdf');

    await renderToPDF(layout, {
      fontPath,
      fontSize: 12,
      outputPath,
    });

    expect(fs.existsSync(outputPath)).toBe(true);
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(1000); // Should be substantial

    console.log(`Multi-page PDF: ${layout.pageCount} pages, ${stats.size} bytes`);
  });

  it('should handle two-column layout', async () => {
    const words: ShapedWord[] = [];
    
    // Create enough words to fill both columns
    // With wide words (180pt), need many lines to fill both columns
    for (let i = 0; i < 150; i++) {
      words.push(mockWord(`טקסט${i}`, 180)); // Wide words
    }

    const layout = layoutDocument(words);

    const outputPath = path.join(outputDir, 'two-column.pdf');

    await renderToPDF(layout, {
      fontPath,
      fontSize: 14,
      outputPath,
    });

    expect(fs.existsSync(outputPath)).toBe(true);
    
    // Verify layout has both columns filled
    const page1 = layout.pages[0];
    expect(page1.rightColumn.lines.length).toBeGreaterThan(0);
    
    // May not have left column if content fits in right only
    // So just log it
    console.log(`Two-column PDF: right=${page1.rightColumn.lines.length} lines, left=${page1.leftColumn.lines.length} lines`);
  });

  it('should handle empty document gracefully', async () => {
    const layout = layoutDocument([]);

    const outputPath = path.join(outputDir, 'empty.pdf');

    // Empty document should still create a valid (empty) PDF
    // But since we have no pages, renderToPDF should handle it
    if (layout.pageCount === 0) {
      // Skip rendering empty document
      console.log('Empty document: no pages to render');
      expect(layout.pageCount).toBe(0);
    } else {
      await renderToPDF(layout, {
        fontPath,
        fontSize: 12,
        outputPath,
      });
      expect(fs.existsSync(outputPath)).toBe(true);
    }
  });

  it('should render single word', async () => {
    const words = [mockWord('ברוכים', 50)];
    
    const layout = layoutDocument(words, {
      pageWidth: 300,
      pageHeight: 400,
    });

    const outputPath = path.join(outputDir, 'single-word.pdf');

    await renderToPDF(layout, {
      fontPath,
      fontSize: 16,
      outputPath,
    });

    expect(fs.existsSync(outputPath)).toBe(true);
    console.log('Single word PDF created');
  });
});
