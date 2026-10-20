/**
 * Direct glyph rendering (ADR-004, Alternative B).
 *
 * Draws the glyphs HarfBuzz produced, at the positions HarfBuzz computed,
 * instead of letting PDFKit/fontkit shape the text a second time. This keeps
 * what is measured (line breaking, justification, balancing) identical to what
 * is drawn, including nikud/teamim placement from GPOS.
 *
 * Coordinates: callers use PDFKit space (origin top-left, y grows down).
 * HarfBuzz yOffset is "up", so it is subtracted.
 */

import type { ShapedWord } from '../line-breaking/greedy-breaker.js';

/** One glyph with its final drawing position (PDFKit space, points). */
export interface GlyphPlacement {
  glyphId: number;
  /** x of the glyph origin, including GPOS xOffset */
  x: number;
  /** y of the baseline, including GPOS yOffset (y grows down) */
  y: number;
  /** HarfBuzz advance of this glyph in points (0 for marks) */
  advance: number;
  /** Index of the glyph inside the word */
  index: number;
}

/** True if the word carries HarfBuzz glyph positions and can be drawn directly. */
export function hasGlyphData(word: ShapedWord): boolean {
  return (
    word.offsets !== undefined &&
    word.offsets.length === word.glyphIds.length &&
    word.advances.length === word.glyphIds.length &&
    word.glyphIds.length > 0
  );
}

/**
 * Compute where each glyph of `word` is drawn.
 *
 * @param word       Shaped word (glyphs in visual, left-to-right order)
 * @param rightEdge  x of the word's right edge (RTL lines place words from the right)
 * @param baselineY  y of the baseline, PDFKit space
 */
export function placeWordGlyphs(
  word: ShapedWord,
  rightEdge: number,
  baselineY: number
): GlyphPlacement[] {
  if (!hasGlyphData(word)) {
    throw new Error(`placeWordGlyphs: word "${word.text}" has no glyph offsets`);
  }
  const offsets = word.offsets as Array<{ x: number; y: number }>;
  const left = rightEdge - word.width;
  const out: GlyphPlacement[] = [];
  let pen = left;
  for (let i = 0; i < word.glyphIds.length; i++) {
    const off = offsets[i] as { x: number; y: number };
    const adv = word.advances[i] as number;
    out.push({
      glyphId: word.glyphIds[i] as number,
      x: pen + off.x,
      y: baselineY - off.y,
      advance: adv,
      index: i,
    });
    pen += adv;
  }
  return out;
}

/** Format a number for a PDF content stream: 3 decimals, no "-0", no trailing zeros. */
export function pdfNumber(n: number): string {
  const rounded = Number(n.toFixed(3));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

// --- PDFKit integration ----------------------------------------------------
//
// PDFKit has no public API for "draw this glyph id". We use addContent() for the
// operators and a few members of its embedded font object (id, subset, widths,
// unicode, ascender/descender, the fontkit font). These are internal to
// pdfkit 0.15.x; tests/integration/glyph-pdf.test.ts guards against them moving.

interface PdfKitEmbeddedFont {
  id: string;
  ref(): unknown;
  /** 1000-units-per-em ascender / descender (descender is negative) */
  ascender: number;
  descender: number;
  subset: { includeGlyph(glyphId: number): number };
  widths: Array<number | undefined>;
  unicode: Array<number[] | undefined>;
  font: { getGlyph(glyphId: number): { codePoints?: number[] } };
}

interface PdfKitInternals {
  _font: PdfKitEmbeddedFont;
  page: { height: number; fonts: Record<string, unknown> };
  save(): void;
  restore(): void;
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  addContent(s: string): void;
}

function internals(doc: unknown): PdfKitInternals {
  const d = doc as Partial<PdfKitInternals>;
  if (!d._font || typeof d._font.subset?.includeGlyph !== 'function' || !d.page) {
    throw new Error(
      'glyph-renderer: PDFKit internals not as expected (is a font selected via doc.font()? pdfkit version changed?)'
    );
  }
  return d as PdfKitInternals;
}

/** Ascender/descender of the currently selected PDFKit font, in em fractions. */
export function currentFontMetrics(doc: unknown): { ascent: number; descent: number } {
  const f = internals(doc)._font;
  return { ascent: f.ascender / 1000, descent: -f.descender / 1000 };
}

/**
 * Draw words' glyphs with the font currently selected via `doc.font(...)`.
 * All placements must belong to the same font size.
 */
export function drawGlyphs(
  doc: unknown,
  placements: GlyphPlacement[],
  fontSize: number
): void {
  if (placements.length === 0) return;
  const d = internals(doc);
  const font = d._font;
  const pageHeight = d.page.height;

  if (d.page.fonts[font.id] == null) {
    d.page.fonts[font.id] = font.ref();
  }

  d.save();
  // PDFKit's base space is y-down; flip to PDF-native y-up for text operators.
  d.transform(1, 0, 0, -1, 0, pageHeight);
  d.addContent('BT');
  d.addContent(`/${font.id} ${pdfNumber(fontSize)} Tf`);

  for (const g of placements) {
    const cid = font.subset.includeGlyph(g.glyphId);

    // Keep widths (for viewers/selection) and ToUnicode (for search/copy) in sync.
    if (font.widths[cid] == null) {
      font.widths[cid] = (g.advance / fontSize) * 1000;
    }
    if (font.unicode[cid] == null) {
      font.unicode[cid] = font.font.getGlyph(g.glyphId).codePoints ?? [];
    }

    const hex = cid.toString(16).padStart(4, '0');
    d.addContent(`1 0 0 1 ${pdfNumber(g.x)} ${pdfNumber(pageHeight - g.y)} Tm`);
    d.addContent(`<${hex}> Tj`);
  }

  d.addContent('ET');
  d.restore();
}
