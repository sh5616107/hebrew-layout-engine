/**
 * Real HarfBuzz shaping with Ezra SIL. These tests pin the harfbuzzjs 1.x
 * pitfalls that previously made every width 0 (default font scale) and every
 * run LTR (string direction ignored).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { HbFont, shape } from '../../../src/typography/shaper';
import { WordShaper } from '../../../src/typography/word-shaper';

const fontBytes = readFileSync('fonts/SILEOT.ttf');
const font = new HbFont(fontBytes);

describe('HbFont', () => {
  it('returns non-zero advances (font scale is set)', () => {
    const { glyphs } = font.shapeRaw('בראשית', 'rtl');
    expect(glyphs.length).toBeGreaterThan(0);
    expect(glyphs.every((g) => g.xAdvance > 0)).toBe(true);
  });

  it('shapes Hebrew as RTL: glyphs come in visual order (clusters descend)', () => {
    const { glyphs, direction } = font.shapeRaw('בראשית', 'auto');
    expect(direction).toBe('rtl');
    const clusters = glyphs.map((g) => g.cluster);
    expect(clusters).toEqual([...clusters].sort((a, b) => b - a));
  });

  it('places nikud/teamim as zero-advance marks with GPOS offsets', () => {
    const { glyphs } = font.shapeRaw('וַיַּ֧רְא', 'rtl');
    const marks = glyphs.filter((g) => g.xAdvance === 0);
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.some((g) => g.xOffset !== 0)).toBe(true);
  });

  it('is deterministic', () => {
    const a = font.shapeRaw('בְּרֵאשִׁית', 'rtl');
    const b = font.shapeRaw('בְּרֵאשִׁית', 'rtl');
    expect(b).toEqual(a);
  });
});

describe('WordShaper', () => {
  const shaper = new WordShaper(font, 12);

  it('matches the HarfBuzz width documented in ADR-004 (24.803pt for וַיַּ֧רְא at 12pt)', () => {
    const w = shaper.shapeWord('וַיַּ֧רְא', 'rtl');
    expect(w.width).toBeCloseTo(24.803, 2);
  });

  it('fills glyph data used by the glyph renderer', () => {
    const w = shaper.shapeWord('בְּרֵאשִׁית', 'rtl');
    expect(w.offsets).toHaveLength(w.glyphIds.length);
    expect(w.clusters).toHaveLength(w.glyphIds.length);
    expect(w.advances).toHaveLength(w.glyphIds.length);
    expect(w.fontSize).toBe(12);
    expect(w.width).toBeCloseTo(
      w.advances.reduce((s, a) => s + a, 0),
      10
    );
  });

  it('keeps maqaf-joined words together and splits on whitespace', () => {
    const words = shaper.shapeText('עַל־פְּנֵי  תְהוֹם', 'rtl');
    expect(words.map((w) => w.text)).toEqual(['עַל־פְּנֵי', 'תְהוֹם']);
  });

  it('caches by text', () => {
    expect(shaper.shapeWord('אלהים', 'rtl')).toBe(shaper.shapeWord('אלהים', 'rtl'));
  });
});

describe('shape() (ShapedRun, millipoints)', () => {
  it('returns a non-empty RTL run with positive width', async () => {
    const run = await shape('בראשית', fontBytes, 12);
    expect(run.direction).toBe('rtl');
    expect(run.width).toBeGreaterThan(0);
    expect(run.glyphs.length).toBeGreaterThan(0);
  });
});
