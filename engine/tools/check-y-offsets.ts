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

function generateReport() {
  console.log('='.repeat(80));
  console.log('Y-OFFSET AND FEATURES CHECK');
  console.log('='.repeat(80));
  console.log();
  
  const testCases = [
    { label: 'Plain (no nikud)', text: 'בראשית' },
    { label: 'Nikud BELOW - Shva (בְּ)', text: 'בְּרְאְשִׁית' },
    { label: 'Nikud BELOW - Segol (בֶּ)', text: 'בֶּרֶשֶת' },
    { label: 'Nikud ABOVE - Holam (בֹּ)', text: 'בֹּקֶר' },
    { label: 'Nikud ABOVE - Shin dot (שׁ/שׂ)', text: 'שָׁמַיִם שָׂדֶה' },
    { label: 'Mixed nikud', text: 'בְּרֵאשִׁית' },
    { label: 'Te\'amim ABOVE - Zaqef', text: 'בָּרָא֔' },
    { label: 'Te\'amim BELOW - Etnachta (֑)', text: 'אֱלֹהִ֑ים' },
    { label: 'Te\'amim BELOW - Merkha', text: 'בָּרָ֥א' },
    { label: 'Complex (Gen 1:1)', text: 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים' },
  ];
  
  console.log('TEST CASES:');
  console.log('-'.repeat(80));
  
  for (const testCase of testCases) {
    const result = shapeText(testCase.text);
    
    console.log();
    console.log(`${testCase.label}: "${testCase.text}"`);
    console.log(`  Glyphs: ${result.glyphs.length}`);
    console.log(`  Features: ${result.features.join(', ')}`);
    
    const hasYOffset = result.glyphs.some(g => g.yOffset !== 0);
    const hasXOffset = result.glyphs.some(g => g.xOffset !== 0);
    const hasYAdvance = result.glyphs.some(g => g.yAdvance !== 0);
    
    console.log(`  Has Y-offsets: ${hasYOffset ? '✅ YES' : '❌ NO'}`);
    console.log(`  Has X-offsets: ${hasXOffset ? '✅ YES' : '❌ NO'}`);
    console.log(`  Has Y-advance: ${hasYAdvance ? '✅ YES' : '❌ NO'}`);
    
    if (hasYOffset) {
      const yOffsets = result.glyphs
        .filter(g => g.yOffset !== 0)
        .map(g => g.yOffset);
      const minY = Math.min(...yOffsets);
      const maxY = Math.max(...yOffsets);
      console.log(`  Y-offset range: ${minY} to ${maxY} font units`);
    }
    
    if (hasXOffset) {
      const xOffsets = result.glyphs
        .filter(g => g.xOffset !== 0)
        .map(g => g.xOffset);
      const minX = Math.min(...xOffsets);
      const maxX = Math.max(...xOffsets);
      console.log(`  X-offset range: ${minX} to ${maxX} font units`);
    }
  }
  
  console.log();
  console.log('='.repeat(80));
  console.log('GENERATING VISUAL PDF...');
  console.log('='.repeat(80));
  
  // Generate PDF
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(OUTPUT_PDF);
  doc.pipe(stream);
  
  doc.registerFont('Ezra', FONT_PATH);
  
  // Title
  doc.fontSize(20).font('Helvetica-Bold').text('Y-Offset Visual Check', { align: 'center' });
  doc.moveDown(1);
  
  doc.fontSize(10).font('Helvetica')
    .text('Font: Ezra SIL', { align: 'center' })
    .text('Script: Hebr, Language: heb, Direction: RTL', { align: 'center' });
  
  doc.moveDown(2);
  
  // Test cases in RTL visual order (right to left)
  for (const testCase of testCases) {
    const result = shapeText(testCase.text);
    
    doc.fontSize(12).font('Helvetica-Bold').text(testCase.label, { continued: false, align: 'left' });
    
    const hasYOffset = result.glyphs.some(g => g.yOffset !== 0);
    const hasXOffset = result.glyphs.some(g => g.xOffset !== 0);
    
    doc.fontSize(9).font('Helvetica')
      .text(`Glyphs: ${result.glyphs.length} | Y-offset: ${hasYOffset ? 'YES' : 'NO'} | X-offset: ${hasXOffset ? 'YES' : 'NO'}`, 
        { continued: false, align: 'left' });
    
    doc.moveDown(0.3);
    
    // Render at large size for visual inspection (RTL alignment)
    doc.fontSize(48).font('Ezra').text(testCase.text, { align: 'right' });
    
    doc.moveDown(1);
    
    // Add grid line for baseline reference
    const y = doc.y;
    doc.moveTo(50, y).lineTo(545, y).stroke('#cccccc');
    doc.moveDown(0.8);
  }
  
  doc.end();
  
  stream.on('finish', () => {
    console.log(`PDF saved to: ${OUTPUT_PDF}`);
    console.log();
    console.log('INSTRUCTIONS:');
    console.log('  1. Open the PDF');
    console.log('  2. Check that nikud appears ABOVE letters (e.g., segol)');
    console.log('  3. Check that nikud appears BELOW letters (e.g., shva)');
    console.log('  4. Check that te\'amim appear in correct positions');
    console.log('  5. Take a screenshot and attach to ADR-004');
    console.log();
    console.log('='.repeat(80));
  });
}

generateReport();
