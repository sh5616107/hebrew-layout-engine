/**
 * Check Y-offsets in HarfBuzz shaping
 * Verify script=Hebr, language=heb, direction=RTL are set
 * Generate visual PDF with nikud above and below, and te'amim
 */

import * as hb from 'harfbuzzjs';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const FONT_PATH = path.join(process.cwd(), 'fonts', 'SILEOT.ttf');
const OUTPUT_PDF = path.join(process.cwd(), 'out', 'y-offset-check.pdf');

interface ShapingResult {
  text: string;
  glyphs: {
    id: number;
    xAdvance: number;
    yAdvance: number;
    xOffset: number;
    yOffset: number;
  }[];
  features: string[];
}

function shapeText(text: string): ShapingResult {
  const fontData = fs.readFileSync(FONT_PATH);
  const blob = new hb.Blob(fontData);
  const face = new hb.Face(blob);
  const font = new hb.Font(face);
  
  const buffer = new hb.Buffer();
  buffer.addText(text);
  
  // CRITICAL: Set script, language, and direction explicitly
  buffer.setScript('Hebr');
  buffer.setLanguage('heb');
  buffer.setDirection('rtl');
  
  buffer.guessSegmentProperties();
  
  // Get features (if available)
  // Note: harfbuzzjs v1 doesn't expose features list directly
  // We'll show what we set
  const features = [
    'script=Hebr',
    'language=heb',
    'direction=RTL',
  ];
  
  hb.shape(font, buffer);
  
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  
  const glyphs = infos.map((info, i) => ({
    id: info.codepoint,
    xAdvance: positions[i].xAdvance,
    yAdvance: positions[i].yAdvance,
    xOffset: positions[i].xOffset,
    yOffset: positions[i].yOffset,
  }));
  
  return { text, glyphs, features };
}
