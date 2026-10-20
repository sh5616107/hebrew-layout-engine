/**
 * PDF rendering of a LayoutResult.
 *
 * Two ways to draw a word (see ADR-004):
 * - glyph: the word carries HarfBuzz glyph ids and GPOS offsets (ShapedWord.offsets);
 *   glyphs are drawn exactly where the layout measured them. This is the default
 *   for such words.
 * - text:  fallback for words without glyph data (e.g. test doubles). PDFKit shapes
 *   the string itself, so its width can differ from the measured width by a few
 *   percent on words with teamim, and it does not do bidi.
 */

import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import type { LayoutResult, LineContent } from '../core/layout-engine';
import type { ShapedWord } from '../line-breaking/greedy-breaker';
import {
  currentFontMetrics,
  drawGlyphs,
  hasGlyphData,
  placeWordGlyphs,
} from './glyph-renderer.js';

export interface PDFRenderOptions {
  /** Path to font file (relative to project root, e.g., 'fonts/SILEOT.ttf') */
  fontPath: string;
  /** Font size in points */
  fontSize: number;
  /** Output PDF file path */
  outputPath: string;
  /**
   * 'auto' (default): glyph rendering for words with glyph data, PDFKit text() otherwise.
   * 'glyph': require glyph data; throws on a word without it.
   * 'text': always use PDFKit text().
   */
  mode?: 'auto' | 'glyph' | 'text';
  /** Compress content streams (default true). Tests turn it off to inspect operators. */
  compress?: boolean;
  /**
   * Timestamp written to the PDF metadata. Fixed by default so that the same
   * layout always produces byte-identical output.
   */
  creationDate?: Date;
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
  const { fontPath, fontSize, outputPath, mode = 'auto' } = options;
  const date = options.creationDate ?? new Date(0);

  const doc = new PDFDocument({
    size: [layout.config.pageWidth, layout.config.pageHeight],
    margins: {
      top: layout.config.topMargin,
      bottom: layout.config.bottomMargin,
      left: layout.config.leftMargin,
      right: layout.config.rightMargin,
    },
    compress: options.compress ?? true,
    info: { CreationDate: date, ModDate: date },
  });

  doc.registerFont('Hebrew', fontPath);
  doc.font('Hebrew');
  doc.fontSize(fontSize);

  const ctx: RenderContext = { doc, layout, fontSize, mode };

  for (let i = 0; i < layout.pages.length; i++) {
    const page = layout.pages[i];
    if (!page) continue;
    if (i > 0) doc.addPage();
    renderColumn(ctx, page.rightColumn);
    renderColumn(ctx, page.leftColumn);
  }

  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(outputPath);
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.pipe(stream);
    doc.end();
  });
}

interface RenderContext {
  doc: PDFKit.PDFDocument;
  layout: LayoutResult;
  fontSize: number;
  mode: 'auto' | 'glyph' | 'text';
}

function renderColumn(ctx: RenderContext, column: { lines: LineContent[] }): void {
  for (const line of column.lines) {
    renderLine(ctx, line);
  }
}

/**
 * Baseline for a line whose box top is `lineTop`.
 *
 * The layout stages position lines by their box top (topMargin + i * lineHeight),
 * so the baseline is derived from the font: the glyph box (ascent + descent) is
 * centred inside the line box, as CSS does with half-leading.
 */
export function baselineForLine(
  lineTop: number,
  lineHeight: number,
  fontSize: number,
  ascent: number,
  descent: number
): number {
  const content = (ascent + descent) * fontSize;
  return lineTop + (lineHeight - content) / 2 + ascent * fontSize;
}

/**
 * Render a single line. Words are placed from the right edge leftwards (RTL).
 * Gaps come from line.wordSpaces when the layout computed them (justification),
 * otherwise from the configured natural word spacing.
 */
function renderLine(ctx: RenderContext, line: LineContent): void {
  const { doc, layout, fontSize } = ctx;
  const { ascent, descent } = currentFontMetrics(doc);
  const baseline = baselineForLine(line.y, layout.config.lineHeight, fontSize, ascent, descent);

  let currentX = line.x; // right edge of the next word
  for (let i = 0; i < line.words.length; i++) {
    const word = line.words[i];
    if (!word) continue;

    renderWord(ctx, word, currentX, baseline);
    currentX -= word.width;

    if (i < line.words.length - 1) {
      currentX -= line.wordSpaces?.[i] ?? layout.config.wordSpacing;
    }
  }
}

function renderWord(
  ctx: RenderContext,
  word: ShapedWord,
  rightEdge: number,
  baseline: number
): void {
  const { doc, fontSize, mode } = ctx;

  const useGlyphs = mode === 'glyph' || (mode === 'auto' && hasGlyphData(word));
  if (useGlyphs) {
    const placements = placeWordGlyphs(word, rightEdge, baseline); // throws if no glyph data
    drawGlyphs(doc, placements, word.fontSize ?? fontSize);
    return;
  }

  // Fallback: PDFKit shapes the text itself (double shaping, no bidi).
  // text() takes the top of the text box, PDFKit puts the baseline `ascent` below it.
  const x = rightEdge - word.width;
  const topY = baseline - currentFontMetrics(doc).ascent * fontSize;
  doc.text(word.text, x, topY, {
    lineBreak: false,
    width: word.width + 10, // small buffer to prevent wrapping
    align: 'left',
  });
}
