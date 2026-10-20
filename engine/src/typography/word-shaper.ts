/**
 * Builds ShapedWord objects (the unit the line breaker and renderer work with)
 * from real HarfBuzz output.
 */

import type { ShapedWord } from '../line-breaking/greedy-breaker.js';
import { HbFont, type TextDirection } from './shaper.js';

export class WordShaper {
  private readonly cache = new Map<string, ShapedWord>();

  constructor(
    readonly font: HbFont,
    private readonly fontSize: number
  ) {}

  /** Shape one word. Results are cached per (text, direction). */
  shapeWord(text: string, direction: TextDirection = 'auto'): ShapedWord {
    const key = `${direction}|${text}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const k = this.fontSize / this.font.upem;
    const { glyphs } = this.font.shapeRaw(text, direction);

    const advances = glyphs.map((g) => g.xAdvance * k);
    const word: ShapedWord = {
      text,
      glyphIds: glyphs.map((g) => g.glyphId),
      advances,
      width: advances.reduce((sum, a) => sum + a, 0),
      offsets: glyphs.map((g) => ({ x: g.xOffset * k, y: g.yOffset * k })),
      clusters: glyphs.map((g) => g.cluster),
      fontSize: this.fontSize,
    };
    this.cache.set(key, word);
    return word;
  }

  /** Split on whitespace (maqaf U+05BE stays inside a word) and shape each word. */
  shapeText(text: string, direction: TextDirection = 'auto'): ShapedWord[] {
    return text
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => this.shapeWord(w, direction));
  }
}
