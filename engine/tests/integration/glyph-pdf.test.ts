/**
 * Regression guard for the gap that let 223 tests pass while the PDFs were wrong:
 * these tests read the glyph operators back out of the written PDF and compare
 * them with the LayoutResult, using their own arithmetic (not the renderer's).
 *
 * Also runs real Genesis text (nikud + teamim) from the POC sample through the
 * whole pipeline and leaves the PDF in out/e2e/ for visual inspection.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { HbFont } from '../../src/typography/shaper';
import { WordShaper } from '../../src/typography/word-shaper';
import { layoutDocument, type LayoutResult, type LineContent } from '../../src/core/layout-engine';
import { renderToPDF } from '../../src/rendering/pdf-renderer';
import type { ShapedWord } from '../../src/line-breaking/greedy-breaker';

const fontPath = 'fonts/SILEOT.ttf';
const outDir = path.join(__dirname, '..', '..', 'out', 'e2e');
const samplePath = path.join(__dirname, '..', '..', '..', 'poc', 'input', 'sample.json');
const FS = 12;
const LINE_HEIGHT = 18;

interface PdfGlyph {
  x: number;
  y: number; // PDF-native, y up
  cid: string;
}

/** Read `1 0 0 1 X Y Tm <cid> Tj` pairs from an uncompressed PDF, in file order. */
function readGlyphOps(file: string): PdfGlyph[] {
  const raw = fs.readFileSync(file, 'latin1');
  const re = /1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm\s*<([0-9a-f]{4})> Tj/g;
  const out: PdfGlyph[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    out.push({ x: Number(m[1]), y: Number(m[2]), cid: m[3] as string });
  }
  return out;
}

function genesisWords(shaper: WordShaper): ShapedWord[] {
  const doc = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  const body = doc.sections
    .find((s: { kind: string }) => s.kind === 'body')
    .blocks.filter((b: { style: string }) => b.style === 'body');
  const text = body
    .map((b: { runs: Array<{ text: string }> }) => b.runs.map((r) => r.text).join(''))
    .join(' ');
  return shaper.shapeText(text, 'rtl');
}

function layoutFor(words: ShapedWord[], justify: boolean): LayoutResult {
  return layoutDocument(words, {
    pageWidth: 498.9,
    pageHeight: 708.66,
    leftMargin: 42.52,
    rightMargin: 56.69,
    topMargin: 56.69,
    bottomMargin: 56.69,
    columnGap: 28.35,
    lineHeight: LINE_HEIGHT,
    fontSize: FS,
    wordSpacing: 3.5,
    ...(justify ? { justify: { maxWordSpace: 12 } } : {}),
  });
}

function allLines(layout: LayoutResult): LineContent[] {
  return layout.pages.flatMap((p) => [...p.rightColumn.lines, ...p.leftColumn.lines]);
}

describe('glyph rendering: PDF operators vs LayoutResult', () => {
  const natural = path.join(outDir, 'genesis-natural.pdf');
  const justified = path.join(outDir, 'genesis-justified.pdf');
  let layoutNat: LayoutResult;
  let layoutJust: LayoutResult;

  beforeAll(async () => {
    fs.mkdirSync(outDir, { recursive: true });
    const shaper = new WordShaper(new HbFont(fs.readFileSync(fontPath)), FS);
    const words = genesisWords(shaper);
    layoutNat = layoutFor(words, false);
    layoutJust = layoutFor(words, true);
    await renderToPDF(layoutNat, { fontPath, fontSize: FS, outputPath: natural, compress: false });
    await renderToPDF(layoutJust, { fontPath, fontSize: FS, outputPath: justified, compress: false });
  });

  it('draws exactly one glyph operator per laid-out glyph', () => {
    const expected = allLines(layoutNat)
      .flatMap((l) => l.words)
      .reduce((n, w) => n + w.glyphIds.length, 0);
    expect(expected).toBeGreaterThan(1000);
    expect(readGlyphOps(natural)).toHaveLength(expected);
  });

  it('puts every glyph at the x that HarfBuzz measured (independent arithmetic)', () => {
    const ops = readGlyphOps(natural);
    let k = 0;
    let maxErr = 0;
    for (const page of layoutNat.pages) {
      for (const column of [page.rightColumn, page.leftColumn]) {
        for (const line of column.lines) {
          let rightEdge = line.x;
          line.words.forEach((word, wi) => {
            let pen = rightEdge - word.width;
            word.glyphIds.forEach((_, gi) => {
              const expectedX = pen + (word.offsets?.[gi]?.x ?? NaN);
              maxErr = Math.max(maxErr, Math.abs((ops[k] as PdfGlyph).x - expectedX));
              pen += word.advances[gi] as number;
              k++;
            });
            rightEdge -= word.width + (wi < line.words.length - 1 ? layoutNat.config.wordSpacing : 0);
          });
        }
      }
    }
    expect(k).toBe(ops.length);
    expect(maxErr).toBeLessThan(0.0006); // 3-decimal rounding in the content stream
  });

  // Note: Ezra SIL (SILEOT/SILEOTSR) never emits a GPOS yOffset - vertical placement of
  // nikud/teamim is part of the mark glyph shapes, only xOffset is used (1391 of 3722
  // glyphs in the sample). The yOffset path is therefore covered by the unit tests in
  // tests/unit/rendering/glyph-renderer.test.ts, not here.
  it('keeps one baseline per line, spaced by lineHeight, with marks raised above it', () => {
    const ops = readGlyphOps(natural);
    let k = 0;
    const baselines: number[] = [];
    for (const line of layoutNat.pages[0]!.rightColumn.lines) {
      const lineYs: number[] = [];
      for (const word of line.words) {
        word.glyphIds.forEach((_, gi) => {
          const off = word.offsets?.[gi]?.y ?? 0;
          lineYs.push((ops[k] as PdfGlyph).y - off); // undo GPOS lift -> baseline
          k++;
        });
      }
      const base = lineYs[0] as number;
      expect(Math.max(...lineYs) - Math.min(...lineYs)).toBeLessThan(0.0006);
      baselines.push(base);
    }
    for (let i = 1; i < baselines.length; i++) {
      expect((baselines[i - 1] as number) - (baselines[i] as number)).toBeCloseTo(LINE_HEIGHT, 2);
    }
  });

  it('keeps the left column on the same baselines as the right column', () => {
    const ops = readGlyphOps(natural);
    const firstPage = layoutNat.pages[0]!;
    const rightGlyphs = firstPage.rightColumn.lines.flatMap((l) => l.words).reduce((n, w) => n + w.glyphIds.length, 0);
    const leftLines = firstPage.leftColumn.lines;
    let k = rightGlyphs;
    const leftBaselines: number[] = [];
    for (const line of leftLines) {
      leftBaselines.push((ops[k] as PdfGlyph).y - (line.words[0]?.offsets?.[0]?.y ?? 0));
      k += line.words.reduce((n, w) => n + w.glyphIds.length, 0);
    }
    // Right column line i and left column line i share a baseline
    let j = 0;
    const rightBaselines: number[] = [];
    for (const line of firstPage.rightColumn.lines) {
      rightBaselines.push((ops[j] as PdfGlyph).y - (line.words[0]?.offsets?.[0]?.y ?? 0));
      j += line.words.reduce((n, w) => n + w.glyphIds.length, 0);
    }
    leftBaselines.forEach((b, i) => expect(b).toBeCloseTo(rightBaselines[i] as number, 3));
  });

  it('maps each glyph id to exactly one subset id', () => {
    const ops = readGlyphOps(natural);
    const flatIds = allLines(layoutNat).flatMap((l) => l.words.flatMap((w) => w.glyphIds));
    const byGid = new Map<number, string>();
    const byCid = new Map<string, number>();
    flatIds.forEach((gid, i) => {
      const cid = (ops[i] as PdfGlyph).cid;
      expect(byGid.get(gid) ?? cid).toBe(cid);
      expect(byCid.get(cid) ?? gid).toBe(gid);
      byGid.set(gid, cid);
      byCid.set(cid, gid);
    });
  });

  it('justified lines fill the column exactly when gaps are within limits', () => {
    const columnWidth = layoutJust.pages[0]!.rightColumn.width;
    const lines = allLines(layoutJust);
    lines.pop(); // last line of the text stays natural
    let filled = 0;
    for (const line of lines) {
      if (!line.wordSpaces || line.words.length < 2) continue;
      expect(line.wordSpaces).toHaveLength(line.words.length - 1);
      const total =
        line.words.reduce((s, w) => s + w.width, 0) + line.wordSpaces.reduce((s, g) => s + g, 0);
      const inRange = line.wordSpaces.every((g) => g >= 2 && g <= 12);
      const tight = Math.abs(total - columnWidth) < 1e-6;
      if (tight) filled++;
      else expect(inRange).toBe(true); // otherwise gaps were clamped at a limit
    }
    expect(filled).toBeGreaterThan(lines.length * 0.5);
    // and the renderer used those gaps: output differs from the natural layout
    expect(readGlyphOps(justified)).not.toEqual(readGlyphOps(natural));
  });

  it('is deterministic: same layout, byte-identical PDF (default compressed output)', async () => {
    const a = path.join(outDir, 'determinism-a.pdf');
    const b = path.join(outDir, 'determinism-b.pdf');
    await renderToPDF(layoutNat, { fontPath, fontSize: FS, outputPath: a });
    await renderToPDF(layoutNat, { fontPath, fontSize: FS, outputPath: b });
    const hash = (f: string): string => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    expect(hash(a)).toBe(hash(b));
    fs.rmSync(a);
    fs.rmSync(b);
  });
});

describe('renderer modes', () => {
  const mock = { text: 'x', glyphIds: [1], advances: [5], width: 5 };

  it("mode 'glyph' rejects words that carry no glyph data", async () => {
    fs.mkdirSync(outDir, { recursive: true });
    const layout = layoutDocument([mock], { fontSize: FS });
    await expect(
      renderToPDF(layout, {
        fontPath,
        fontSize: FS,
        outputPath: path.join(outDir, 'mode-glyph.pdf'),
        mode: 'glyph',
      })
    ).rejects.toThrow(/no glyph offsets/);
  });

  it("mode 'auto' falls back to PDFKit text() for words without glyph data", async () => {
    const layout = layoutDocument([mock], { fontSize: FS });
    const out = path.join(outDir, 'mode-auto.pdf');
    await renderToPDF(layout, { fontPath, fontSize: FS, outputPath: out, compress: false });
    expect(fs.statSync(out).size).toBeGreaterThan(500);
    expect(readGlyphOps(out)).toHaveLength(0);
  });
});
