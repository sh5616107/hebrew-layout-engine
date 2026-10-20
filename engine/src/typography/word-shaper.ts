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

  /**
   * Split on whitespace and shape each word.
   *
   * With `breakAtMaqaf`, a word is cut after each maqaf (U+05BE, kept with the
   * piece before it) and the pieces are marked `joinNext`, so the line breaker may
   * break there without adding a space. By default a maqaf-joined word is one unit.
   */
  shapeText(
    text: string,
    direction: TextDirection = 'auto',
    options: { breakAtMaqaf?: boolean } = {}
  ): ShapedWord[] {
    const out: ShapedWord[] = [];
    for (const token of text.split(/\s+/)) {
      if (token.length === 0) continue;
      const pieces = options.breakAtMaqaf ? token.split(/(?<=\u05BE)/) : [token];
      pieces.forEach((piece, i) => {
        const word = this.shapeWord(piece, direction);
        // copy: the cached word is shared, joinNext depends on position in the token
        out.push(i < pieces.length - 1 ? { ...word, joinNext: true } : word);
      });
    }
    return out;
  }
}
