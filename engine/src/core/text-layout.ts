/**
 * High-level Node entry point for the working layout pipeline.
 *
 * This deliberately accepts plain text rather than the unfinished `Document`
 * orchestration model. It provides a complete, usable path today: text is
 * shaped with HarfBuzz, broken into RTL lines, and placed into two columns.
 */

import { readFileSync } from 'node:fs';
import { layoutDocument, type LayoutConfig, type LayoutResult } from './layout-engine.js';
import { HbFont, type TextDirection } from '../typography/shaper.js';
import { WordShaper } from '../typography/word-shaper.js';
import type { ShapedWord } from '../line-breaking/greedy-breaker.js';

export interface TextLayoutOptions {
  /** Path to the OpenType font used for shaping and later PDF rendering. */
  fontPath: string;
  /** Font size in points. Defaults to the layout configuration's 12pt. */
  fontSize?: number;
  /** Direction passed to HarfBuzz. `auto` is the default. */
  direction?: TextDirection;
  /** Page and line-breaking options, expressed in points. */
  layout?: Partial<LayoutConfig>;
  /** Permit a line break after a Hebrew maqaf (U+05BE). */
  breakAtMaqaf?: boolean;
}

/**
 * Lay out Hebrew text directly from a font file.
 *
 * Blank lines separate paragraphs; each paragraph's final line remains
 * un-justified, matching conventional book typesetting.
 */
export function layoutText(text: string, options: TextLayoutOptions): LayoutResult {
  const fontSize = options.fontSize ?? options.layout?.fontSize ?? 12;
  const font = new HbFont(new Uint8Array(readFileSync(options.fontPath)));
  const shaper = new WordShaper(font, fontSize);
  const words = shapeParagraphs(text, shaper, options.direction ?? 'auto', options.breakAtMaqaf ?? true);

  return layoutDocument(words, {
    ...options.layout,
    fontSize,
  });
}

function shapeParagraphs(
  text: string,
  shaper: WordShaper,
  direction: TextDirection,
  breakAtMaqaf: boolean,
): ShapedWord[] {
  const words: ShapedWord[] = [];
  const paragraphs = text.split(/\r?\n\s*\r?\n/);

  for (const paragraph of paragraphs) {
    const shaped = shaper.shapeText(paragraph, direction, { breakAtMaqaf });
    if (shaped.length === 0) continue;

    const lastIndex = shaped.length - 1;
    const last = shaped[lastIndex];
    if (last) shaped[lastIndex] = { ...last, endsParagraph: true };
    words.push(...shaped);
  }

  return words;
}
