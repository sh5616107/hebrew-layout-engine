/**
 * Optimal (Knuth–Plass style) line breaking on real Genesis text with nikud and teamim,
 * through the whole pipeline: shaping -> breaking -> two columns -> PDF.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { HbFont } from '../../src/typography/shaper';
import { WordShaper } from '../../src/typography/word-shaper';
import {
  layoutDocument,
  wordSpaceRange,
  type LayoutConfig,
  type LayoutResult,
  type LineContent,
} from '../../src/core/layout-engine';
import { breakLines, type ShapedWord } from '../../src/line-breaking/greedy-breaker';
import { breakLinesOptimal, scoreBreaks } from '../../src/line-breaking/optimal-breaker';
import { renderToPDF } from '../../src/rendering/pdf-renderer';

const fontPath = 'fonts/SILEOT.ttf';
const outDir = path.join(__dirname, '..', '..', 'out', 'e2e');
const samplePath = path.join(__dirname, '..', '..', '..', 'poc', 'input', 'sample.json');
const FS = 12;

const config: Partial<LayoutConfig> = {
  pageWidth: 498.9,
  pageHeight: 708.66,
  leftMargin: 42.52,
  rightMargin: 56.69,
  topMargin: 56.69,
  bottomMargin: 56.69,
  columnGap: 28.35,
  lineHeight: 18,
  fontSize: FS,
  wordSpacing: 3.5,
};
const columnWidth = (498.9 - 42.52 - 56.69 - 28.35) / 2;

function genesis(shaper: WordShaper, breakAtMaqaf: boolean): ShapedWord[] {
  const doc = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  const blocks = doc.sections
    .find((s: { kind: string }) => s.kind === 'body')
    .blocks.filter((b: { style: string }) => b.style === 'body');
  return blocks.flatMap((b: { runs: Array<{ text: string }> }) => {
    const ws = shaper.shapeText(b.runs.map((r) => r.text).join(''), 'rtl', { breakAtMaqaf });
    ws[ws.length - 1] = { ...(ws[ws.length - 1] as ShapedWord), endsParagraph: true };
    return ws;
  });
}

function allLines(layout: LayoutResult): LineContent[] {
  return layout.pages.flatMap((p) => [...p.rightColumn.lines, ...p.leftColumn.lines]);
}

describe('optimal line breaking on Genesis', () => {
  const optimalPdf = path.join(outDir, 'genesis-optimal.pdf');
  let words: ShapedWord[];
  let wordsNoMaqaf: ShapedWord[];
  let layout: LayoutResult;

  beforeAll(async () => {
    fs.mkdirSync(outDir, { recursive: true });
    const shaper = new WordShaper(new HbFont(fs.readFileSync(fontPath)), FS);
    words = genesis(shaper, true);
    wordsNoMaqaf = genesis(shaper, false);
    layout = layoutDocument(words, { ...config, lineBreaking: { mode: 'optimal' } });
    await renderToPDF(layout, { fontPath, fontSize: FS, outputPath: optimalPdf, compress: false });
  });

  it('splits maqaf words into joinNext pieces and keeps every character', () => {
    const joined = words.filter((x) => x.joinNext);
    expect(joined.length).toBeGreaterThan(30);
    expect(joined.every((x) => x.text.endsWith('־'))).toBe(true);
    // same text as the unsplit shaping
    const text = (ws: ShapedWord[]): string => ws.map((x) => x.text).join('').replace(/\s/g, '');
    expect(text(words)).toBe(text(wordsNoMaqaf));
  });

  it('scores much better than greedy breaking of the same words', () => {
    const o = { maxWidth: columnWidth, ...wordSpaceRange({ ...(config as LayoutConfig), lineBreaking: { mode: 'optimal' } }) };
    const optimal = breakLinesOptimal(words, o);
    const greedy = breakLines(words, { maxWidth: columnWidth, wordSpacing: 3.5 });
    const greedyScore = scoreBreaks(greedy.lines, o);
    expect(optimal.totalDemerits).toBeLessThan(greedyScore / 2);
    // and the loosest line is looser in greedy than in optimal
    const worst = (lines: ShapedWord[][]): number =>
      Math.max(
        ...lines
          .filter((l, i) => i < lines.length - 1 && !l[l.length - 1]?.endsParagraph && l.length > 1)
          .map((l) => {
            const glue = l.filter((x, i) => !x.joinNext && i < l.length - 1).length;
            return (columnWidth - l.reduce((s, x) => s + x.width, 0)) / glue;
          })
      );
    expect(worst(optimal.lines)).toBeLessThan(worst(greedy.lines));
  });

  it('fills every non-final line of a paragraph flush to the column width', () => {
    const lines = allLines(layout);
    let flush = 0;
    lines.forEach((line, i) => {
      const isFinalOfParagraph = i === lines.length - 1 || line.words[line.words.length - 1]?.endsParagraph;
      if (isFinalOfParagraph || line.words.length < 2) return;
      const total =
        line.words.reduce((s, x) => s + x.width, 0) + (line.wordSpaces ?? []).reduce((s, g) => s + g, 0);
      expect(line.wordSpaces).toHaveLength(line.words.length - 1);
      expect(total).toBeCloseTo(columnWidth, 6);
      flush++;
    });
    expect(flush).toBeGreaterThan(50);
  });

  it('adds no gap after maqaf pieces and never shrinks below the minimum', () => {
    const { min } = wordSpaceRange({ ...(config as LayoutConfig), lineBreaking: { mode: 'optimal' } });
    for (const line of allLines(layout)) {
      line.words.forEach((x, i) => {
        const gap = line.wordSpaces?.[i];
        if (gap === undefined) return;
        if (x.joinNext) expect(gap).toBe(0);
        else expect(gap).toBeGreaterThanOrEqual(min - 1e-9);
      });
    }
  });

  it('lays every word out once, in order', () => {
    const laidOut = allLines(layout).flatMap((l) => l.words.map((x) => x.text));
    expect(laidOut).toEqual(words.map((x) => x.text));
  });

  it('draws in the PDF exactly where the layout says, including gaps and maqaf joins', () => {
    const raw = fs.readFileSync(optimalPdf, 'latin1');
    const re = /1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm\s*<[0-9a-f]{4}> Tj/g;
    const xs: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) xs.push(Number(m[1]));

    let k = 0;
    let maxErr = 0;
    for (const line of allLines(layout)) {
      let rightEdge = line.x;
      line.words.forEach((word, wi) => {
        let pen = rightEdge - word.width;
        word.glyphIds.forEach((_, gi) => {
          const expected = pen + (word.offsets?.[gi]?.x ?? NaN);
          maxErr = Math.max(maxErr, Math.abs((xs[k] as number) - expected));
          pen += word.advances[gi] as number;
          k++;
        });
        const gap = line.wordSpaces?.[wi] ?? (word.joinNext ? 0 : 3.5);
        rightEdge -= word.width + (wi < line.words.length - 1 ? gap : 0);
      });
    }
    expect(k).toBe(xs.length);
    expect(maxErr).toBeLessThan(0.0006);
  });
});

describe('default behaviour is unchanged', () => {
  it('greedy mode stays the default and sets no word gaps', () => {
    const shaper = new WordShaper(new HbFont(fs.readFileSync(fontPath)), FS);
    const layout = layoutDocument(shaper.shapeText('בראשית ברא אלהים את השמים ואת הארץ', 'rtl'), config);
    expect(allLines(layout).every((l) => l.wordSpaces === undefined)).toBe(true);
  });
});
