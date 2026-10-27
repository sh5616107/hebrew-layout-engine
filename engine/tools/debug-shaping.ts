
import { readFileSync } from 'node:fs';
import { HbFont } from '../src/typography/shaper';

const [fontPath, textArg = 'שָׁלוֹם', directionArg = 'rtl', sizeArg = '12'] =
  process.argv.slice(2);

if (!fontPath) {
  console.error(
    'Usage: npm run debug:shaping -- <font-file.ttf|otf> [text] [rtl|ltr] [font-size-pt]',
  );
  process.exit(1);
}

const direction = directionArg === 'ltr' ? 'ltr' : 'rtl';
const fontSize = Number(sizeArg);

if (!Number.isFinite(fontSize) || fontSize <= 0) {
  console.error(`Invalid font size: ${sizeArg}`);
  process.exit(1);
}

try {
  const fontData = new Uint8Array(readFileSync(fontPath));
  const font = new HbFont(fontData);
  const result = font.shapeRaw(textArg, direction);
  const scalePt = fontSize / font.upem;
  const advances = result.glyphs.map((glyph) => glyph.xAdvance * scalePt);
  const widthPt = advances.reduce((sum, advance) => sum + advance, 0);

  console.log(
    JSON.stringify(
      {
        fontPath,
        text: textArg,
        requestedDirection: direction,
        resolvedDirection: result.direction,
        textLength: textArg.length,
        textChars: Array.from(textArg).map(c => `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`),
        upem: font.upem,
        fontSizePt: fontSize,
        glyphCount: result.glyphs.length,
        advancesPt: advances,
        advanceSigns: {
          positive: advances.filter((value) => value > 0).length,
          negative: advances.filter((value) => value < 0).length,
          zero: advances.filter((value) => value === 0).length,
        },
        widthPt: Number(widthPt.toFixed(4)),
        glyphs: result.glyphs.map((glyph, index) => ({
          visualIndex: index,
          glyphId: glyph.glyphId,
          cluster: glyph.cluster,
          xAdvanceFontUnits: glyph.xAdvance,
          yAdvanceFontUnits: glyph.yAdvance,
          xOffsetFontUnits: glyph.xOffset,
          yOffsetFontUnits: glyph.yOffset,
        })),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error('Shaping diagnostic failed:', error);
  process.exit(1);
}
