/**
 * PDF rendering with word-level text placement.
 * Implements Alternative A (word-level) from ADR-004.
 * 
 * Current limitation: Uses PDFKit's text() method for words.
 * This does NOT draw glyphs directly - PDFKit handles glyph rendering internally.
 * 
 * For direct glyph drawing (Alternative B), see:
 * - tools/render-glyphs-directly.ts (feasibility study)
 * - Future M2+ task: Implement direct glyph positioning
 */

import PDFDocument from 'pdfkit';
import type { LayoutResult, LineContent } from '../core/layout-engine';
import type { ShapedWord } from '../line-breaking/greedy-breaker';

export interface PDFRenderOptions {
  /** Path to font file (relative to project root, e.g., 'fonts/SILEOT.ttf') */
  fontPath: string;
  /** Font size in points */
  fontSize: number;
  /** Output PDF file path */
  outputPath: string;
}

/**
 * Render LayoutResult to PDF file.
 * 
 * @param layout Complete layout with positioned content
 * @param options Rendering configuration
 */
export async function renderToPDF(
  layout: LayoutResult,
  options: PDFRenderOptions
): Promise<void> {
  const { fontPath, fontSize, outputPath } = options;

  // Create PDF document
  const doc = new PDFDocument({
    size: [layout.config.pageWidth, layout.config.pageHeight],
    margins: {
      top: layout.config.topMargin,
      bottom: layout.config.bottomMargin,
      left: layout.config.leftMargin,
      right: layout.config.rightMargin,
    },
  });

  // Register font
  doc.registerFont('Hebrew', fontPath);
  doc.font('Hebrew');
  doc.fontSize(fontSize);

  // Render each page
  for (let i = 0; i < layout.pages.length; i++) {
    const page = layout.pages[i];
    if (!page) continue;

    if (i > 0) {
      doc.addPage();
    }

    // Render right column
    renderColumn(doc, page.rightColumn, fontSize);

    // Render left column
    renderColumn(doc, page.leftColumn, fontSize);
  }

  // Finalize and save
  return new Promise((resolve, reject) => {
    import('fs').then((fsModule) => {
      const stream = fsModule.createWriteStream(outputPath);
      doc.pipe(stream);
      doc.end();

      stream.on('finish', resolve);
      stream.on('error', reject);
    }).catch(reject);
  });
}

/**
 * Render a single column's content.
 */
function renderColumn(
  doc: PDFKit.PDFDocument,
  column: { lines: LineContent[] },
  fontSize: number
): void {
  for (const line of column.lines) {
    renderLine(doc, line, fontSize);
  }
}

/**
 * Render a single line of text.
 * Words are positioned from right to left (RTL).
 */
function renderLine(
  doc: PDFKit.PDFDocument,
  line: LineContent,
  fontSize: number
): void {
  let currentX = line.x; // Start from right edge

  // RTL: render words from right to left
  for (let i = 0; i < line.words.length; i++) {
    const word = line.words[i];
    if (!word) continue;

    // Move left by word width (RTL)
    currentX -= word.width;

    // Render word at this position
    renderWord(doc, word, currentX, line.y, fontSize);

    // Add word spacing (move left for next word)
    if (i < line.words.length - 1) {
      currentX -= 3.5; // Word spacing from layout config
    }
  }
}

/**
 * Render a single shaped word.
 * 
 * M1.0 Approach (Pragmatic):
 * Use PDFKit's text() method with the original text.
 * PDFKit will re-shape internally, which is not ideal (double shaping),
 * but works for M1.0 MVP.
 * 
 * M2 will use direct glyph rendering (doc.addContent) for pixel-perfect output.
 */
function renderWord(
  doc: PDFKit.PDFDocument,
  word: ShapedWord,
  x: number,
  y: number,
  fontSize: number
): void {
  // PDFKit's text() expects top-left Y, but our Y is baseline
  // We need to adjust by the font's ascent
  // For Hebrew fonts, ascent is typically ~0.75 of fontSize
  const estimatedAscent = fontSize * 0.75;
  const topY = y - estimatedAscent;

  doc.text(word.text, x, topY, {
    lineBreak: false,
    width: word.width + 10, // Small buffer to prevent wrapping
    align: 'left',
  });
}

