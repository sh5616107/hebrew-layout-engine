/**
 * Text shaping using HarfBuzz (harfbuzzjs v1 API).
 *
 * Converts text + font into positioned glyphs. Marks (nikud, teamim) come back
 * with xAdvance = 0 and a non-zero xOffset/yOffset from GPOS; callers must
 * draw glyph i at (pen + xOffset, baseline - yOffset) and then advance the pen
 * by xAdvance.
 *
 * Notes on harfbuzzjs 1.x (verified against 1.6.3):
 * - A Font's default scale is 0, which makes every advance/offset 0.
 *   We always call setScale(upem, upem) so results are in font units.
 * - Buffer.setDirection() takes the numeric Direction enum (RTL = 5), not a
 *   string. A string is silently ignored and the run is shaped as LTR.
 * - For RTL runs HarfBuzz returns glyphs in *visual* order (left to right).
 *   Do not reverse them again when drawing.
 */

import * as hb from 'harfbuzzjs';
import type { PositionedGlyph, ShapedRun } from '../core/types.js';
import { ptToMpt } from '../core/units.js';

/** One glyph as returned by HarfBuzz, in font units (1 em = `upem`). */
export interface RawGlyph {
  glyphId: number;
  /** UTF-16 index into the shaped text of the first character of the cluster */
  cluster: number;
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
}

export type TextDirection = 'rtl' | 'ltr' | 'auto';

/** A loaded font that can shape many strings without re-parsing the font file. */
export class HbFont {
  readonly upem: number;
  readonly ascender: number;
  readonly descender: number;
  private readonly font: hb.Font;

  constructor(fontData: ArrayBuffer | Uint8Array) {
    const bytes = fontData instanceof Uint8Array ? fontData : new Uint8Array(fontData);
    // Copy into a standalone ArrayBuffer: a Node Buffer's .buffer is a shared pool.
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const blob = new hb.Blob(ab);
    const face = new hb.Face(blob);
    this.font = new hb.Font(face);
    this.upem = face.upem;
    this.font.setScale(this.upem, this.upem);
    const ext = this.font.hExtents();
    this.ascender = ext.ascender;
    this.descender = ext.descender;
  }

  /** Shape `text`; result is in visual (left-to-right drawing) order. */
  shapeRaw(text: string, direction: TextDirection = 'auto'): { glyphs: RawGlyph[]; direction: 'rtl' | 'ltr' } {
    const buffer = new hb.Buffer();
    buffer.addText(text);
    if (direction === 'rtl') {
      buffer.setDirection(hb.Direction.RTL);
      buffer.setScript('Hebr');
      buffer.setLanguage('he');
    } else if (direction === 'ltr') {
      buffer.setDirection(hb.Direction.LTR);
      buffer.guessSegmentProperties();
      buffer.setDirection(hb.Direction.LTR);
    } else {
      buffer.guessSegmentProperties();
    }
    hb.shape(this.font, buffer);
    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    const glyphs: RawGlyph[] = infos.map((info, i) => {
      const p = positions[i];
      return {
        glyphId: info.codepoint,
        cluster: info.cluster,
        xAdvance: p?.xAdvance ?? 0,
        yAdvance: p?.yAdvance ?? 0,
        xOffset: p?.xOffset ?? 0,
        yOffset: p?.yOffset ?? 0,
      };
    });
    const first = glyphs[0];
    const last = glyphs[glyphs.length - 1];
    // Visual order with descending clusters means the run was shaped RTL.
    const resolved: 'rtl' | 'ltr' =
      direction === 'auto'
        ? first && last && first.cluster > last.cluster
          ? 'rtl'
          : 'ltr'
        : direction;
    return { glyphs, direction: resolved };
  }
}

const fontCache = new WeakMap<object, HbFont>();

function fontFor(fontData: ArrayBuffer | Uint8Array): HbFont {
  const cached = fontCache.get(fontData);
  if (cached) return cached;
  const created = new HbFont(fontData);
  fontCache.set(fontData, created);
  return created;
}

/**
 * Shape text into a ShapedRun (millipoint units).
 *
 * @param text - Text to shape (Hebrew with nikud/teamim)
 * @param fontBuffer - Font file bytes. The parsed font is cached per buffer object.
 * @param fontSize - Font size in points
 */
export async function shape(
  text: string,
  fontBuffer: ArrayBuffer | Uint8Array,
  fontSize: number
): Promise<ShapedRun> {
  const font = fontFor(fontBuffer);
  const { glyphs: raw, direction } = font.shapeRaw(text);
  const k = fontSize / font.upem;

  const glyphs: PositionedGlyph[] = raw.map((g) => ({
    glyphId: g.glyphId,
    x: ptToMpt(g.xOffset * k),
    y: ptToMpt(g.yOffset * k),
    advance: ptToMpt(g.xAdvance * k),
  }));

  return {
    font: 'unknown', // TODO: Extract from font metadata
    size: ptToMpt(fontSize),
    glyphs,
    direction,
    width: glyphs.reduce((sum, g) => sum + g.advance, 0),
  };
}

/** Kept for existing callers; identical to shape(). */
export async function shapeSync(
  text: string,
  fontBuffer: ArrayBuffer | Uint8Array,
  fontSize: number
): Promise<ShapedRun> {
  return shape(text, fontBuffer, fontSize);
}

/** HarfBuzz version info */
export async function getVersion(): Promise<string> {
  return `harfbuzzjs-${hb.versionString()}`;
}
