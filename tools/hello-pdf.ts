/**
 * Hello World PDF Test
 * Creates a simple PDF with Hebrew text using HarfBuzz + PDFKit
 */

import * as hb from 'harfbuzzjs';
import PDFDocument from 'pdfkit';
import { createWriteStream, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Find David font
const fontPaths = [
  'C:\\Windows\\Fonts\\david.ttf',
  'C:\\Windows\\Fonts\\arial.ttf',
];

let fontPath: string | null = null;
for (const path of fontPaths) {
  if (existsSync(path)) {
    fontPath = path;
    console.log(`Using font: ${path}`);
    break;
  }
}

if (!fontPath) {
  console.error('No font found!');
  process.exit(1);
}

// Load font
const fontBuffer = readFileSync(fontPath).buffer;

// Shape Hebrew text
const blob = new hb.Blob(fontBuffer);
const face = new hb.Face(blob);
const font = new hb.Font(face);

const buffer = new hb.Buffer();
const text = 'בְּרֵאשִׁית בָּרָא אֱלֹהִים'; // Genesis 1:1 opening
buffer.addText(text);
buffer.guessSegmentProperties();

hb.shape(font, buffer);

const infos = buffer.getGlyphInfos();
const positions = buffer.getGlyphPositions();

console.log(`Shaped ${infos.length} glyphs from text: "${text}"`);

// Create PDF
const doc = new PDFDocument({
  size: [176 * 2.834646, 250 * 2.834646], // B5 in points (mm to pt)
  margins: { top: 56.69, bottom: 56.69, left: 42.52, right: 56.69 },
});

const outputPath = join(process.cwd(), 'out', 'hello-world.pdf');
doc.pipe(createWriteStream(outputPath));

// Register font
doc.registerFont('Hebrew', fontPath);
doc.font('Hebrew');
doc.fontSize(14);

// Write text (PDFKit handles RTL automatically with proper fonts)
doc.text(text, {
  align: 'right', // RTL alignment
  lineGap: 4,
});

// Add info
doc.moveDown(2);
doc.fontSize(10);
doc.text(`Shaped glyphs: ${infos.length}`, { align: 'left' });
doc.text(`Font: ${fontPath.split('\\').pop()}`, { align: 'left' });
doc.text(`HarfBuzz version: harfbuzzjs v1.6.3`, { align: 'left' });

// Finalize
doc.end();

console.log(`PDF created: ${outputPath}`);
console.log('✅ Hello World PDF test complete');
