import { describe, it, expect } from 'vitest';
import {
  drawGlyphs,
  hasGlyphData,
  pdfNumber,
  placeWordGlyphs,
} from '../../../src/rendering/glyph-renderer';
import type { ShapedWord } from '../../../src/line-breaking/greedy-breaker';

// A word of three glyphs: a base (advance 10), a mark on it (advance 0, raised and shifted), a base (advance 6).
const word: ShapedWord = {
  text: 'אָב',
  glyphIds: [11, 22, 33],
  advances: [10, 0, 6],
  width: 16,
  offsets: [
    { x: 0, y: 0 },
    { x: 2.5, y: 4 },
    { x: 0, y: 0 },
  ],
  clusters: [1, 0, 0],
  fontSize: 12,
};

describe('placeWordGlyphs', () => {
  it('draws left to right from (rightEdge - width), adding GPOS offsets', () => {
    const p = placeWordGlyphs(word, 100, 50);
    expect(p.map((g) => g.glyphId)).toEqual([11, 22, 33]);
    expect(p[0]).toMatchObject({ x: 84, y: 50 });
    // mark: pen is at 84 + 10 = 94, then xOffset 2.5; raised 4pt (y grows down)
    expect(p[1]).toMatchObject({ x: 96.5, y: 46 });
    // zero-advance mark does not move the pen
    expect(p[2]).toMatchObject({ x: 94, y: 50 });
  });

  it('refuses words without glyph data', () => {
    const mock: ShapedWord = { text: 'x', glyphIds: [1], advances: [5], width: 5 };
    expect(hasGlyphData(mock)).toBe(false);
    expect(() => placeWordGlyphs(mock, 10, 10)).toThrow(/no glyph offsets/);
  });

  it('treats mismatched array lengths as no glyph data', () => {
    expect(hasGlyphData({ ...word, offsets: [{ x: 0, y: 0 }] })).toBe(false);
  });
});

describe('pdfNumber', () => {
  it('rounds to 3 decimals, drops trailing zeros and negative zero', () => {
    expect(pdfNumber(12)).toBe('12');
    expect(pdfNumber(1.23456)).toBe('1.235');
    expect(pdfNumber(-0.0001)).toBe('0');
    expect(pdfNumber(0.5)).toBe('0.5');
  });
});

describe('drawGlyphs', () => {
  it('fails with a clear message when no PDFKit font is selected', () => {
    expect(() => drawGlyphs({}, placeWordGlyphs(word, 100, 50), 12)).toThrow(/PDFKit internals/);
  });

  it('emits one Tm + Tj per glyph with flipped y and subset glyph ids', () => {
    const ops: string[] = [];
    const subset = new Map<number, number>();
    const fakeDoc = {
      _font: {
        id: 'F1',
        ref: (): string => 'ref',
        ascender: 1000,
        descender: -300,
        subset: {
          includeGlyph: (g: number): number => {
            if (!subset.has(g)) subset.set(g, subset.size + 1);
            return subset.get(g) as number;
          },
        },
        widths: [] as Array<number | undefined>,
        unicode: [] as Array<number[] | undefined>,
        font: { getGlyph: (): { codePoints: number[] } => ({ codePoints: [0x5d0] }) },
      },
      page: { height: 200, fonts: {} as Record<string, unknown> },
      save: (): void => void ops.push('q'),
      restore: (): void => void ops.push('Q'),
      transform: (...m: number[]): void => void ops.push(`${m.join(' ')} cm`),
      addContent: (s: string): void => void ops.push(s),
    };

    drawGlyphs(fakeDoc, placeWordGlyphs(word, 100, 50), 12);

    expect(fakeDoc.page.fonts['F1']).toBe('ref');
    expect(ops).toEqual([
      'q',
      '1 0 0 -1 0 200 cm',
      'BT',
      '/F1 12 Tf',
      '1 0 0 1 84 150 Tm',
      '<0001> Tj',
      '1 0 0 1 96.5 154 Tm',
      '<0002> Tj',
      '1 0 0 1 94 150 Tm',
      '<0003> Tj',
      'ET',
      'Q',
    ]);
    // widths in 1/1000 em for the PDF /W array
    expect(fakeDoc._font.widths[1]).toBeCloseTo((10 / 12) * 1000, 6);
    expect(fakeDoc._font.unicode[1]).toEqual([0x5d0]);
  });
});
