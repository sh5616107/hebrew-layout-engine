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

// Unused function - kept for reference
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _generateReport(): void {
  console.log('='.repeat(80));
  console.log('בדיקת Y-offset ו-RTL');
  console.log('='.repeat(80));
  console.log();
  
  const testCases = [
    { label: 'רגיל (ללא ניקוד)', text: 'בראשית' },
    { label: 'ניקוד מתחת - שבא (בְּ)', text: 'בְּרְאְשִׁית' },
    { label: 'ניקוד מתחת - סגול (בֶּ)', text: 'בֶּרֶשֶת' },
    { label: 'ניקוד מעל - חולם (בֹּ)', text: 'בֹּקֶר' },
    { label: 'ניקוד מעל - נקודת שין (שׁ/שׂ)', text: 'שָׁמַיִם שָׂדֶה' },
    { label: 'ניקוד מעורב', text: 'בְּרֵאשִׁית' },
    { label: 'טעם מעל - זקף', text: 'בָּרָא֔' },
    { label: 'טעם מתחת - אתנחתא (֑)', text: 'אֱלֹהִ֑ים' },
    { label: 'טעם מתחת - מרכא', text: 'בָּרָ֥א' },
    { label: 'מורכב (בראשית א:א)', text: 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים' },
  ];
  
  console.log('מקרי בדיקה:');
  console.log('-'.repeat(80));
  
  let autoCheckPassed = 0;
  let autoCheckFailed = 0;
  
  for (const testCase of testCases) {
    const result = shapeText(testCase.text);
    
    console.log();
    console.log(`${testCase.label}: "${testCase.text}"`);
    console.log(`  גליפים: ${result.glyphs.length}`);
    console.log(`  תכונות: ${result.features.join(', ')}`);
    
    const hasYOffset = result.glyphs.some(g => g.yOffset !== 0);
    const hasXOffset = result.glyphs.some(g => g.xOffset !== 0);
    const hasYAdvance = result.glyphs.some(g => g.yAdvance !== 0);
    
    console.log(`  יש Y-offsets: ${hasYOffset ? '✅ כן' : '❌ לא'}`);
    console.log(`  יש X-offsets: ${hasXOffset ? '✅ כן' : '❌ לא'}`);
    console.log(`  יש Y-advance: ${hasYAdvance ? '✅ כן' : '❌ לא'}`);
    
    // Auto-check: words with nikud should have spacing
    const wordsInText = testCase.text.split(' ');
    if (wordsInText.length > 1) {
      // Check that glyphs have proper spacing (xAdvance > 0 for non-marks)
      const baseGlyphs = result.glyphs.filter(g => g.xAdvance > 0);
      const hasProperSpacing = baseGlyphs.length >= wordsInText.length;
      
      if (hasProperSpacing) {
        console.log(`  רווחים בין מילים: ✅ תקין (${baseGlyphs.length} בסיסים)`);
        autoCheckPassed++;
      } else {
        console.log(`  רווחים בין מילים: ❌ חסר (${baseGlyphs.length} < ${wordsInText.length})`);
        autoCheckFailed++;
      }
    }
    
    if (hasYOffset) {
      const yOffsets = result.glyphs
        .filter(g => g.yOffset !== 0)
        .map(g => g.yOffset);
      const minY = Math.min(...yOffsets);
      const maxY = Math.max(...yOffsets);
      console.log(`  טווח Y-offset: ${minY} עד ${maxY} יחידות גופן`);
    }
    
    if (hasXOffset) {
      const xOffsets = result.glyphs
        .filter(g => g.xOffset !== 0)
        .map(g => g.xOffset);
      const minX = Math.min(...xOffsets);
      const maxX = Math.max(...xOffsets);
      console.log(`  טווח X-offset: ${minX} עד ${maxX} יחידות גופן`);
    }
  }
  
  console.log();
  console.log('='.repeat(80));
  console.log('בדיקה אוטומטית:');
  console.log(`  עבר: ${autoCheckPassed}/${testCases.length}`);
  console.log(`  נכשל: ${autoCheckFailed}/${testCases.length}`);
  console.log('='.repeat(80));
  console.log('יוצר PDF ויזואלי...');
  console.log('='.repeat(80));
  
  // Generate PDF
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(OUTPUT_PDF);
  doc.pipe(stream);
  
  doc.registerFont('Ezra', FONT_PATH);
  
  // Title in Hebrew
  doc.fontSize(20).font('Ezra').text('בדיקת מיקום אנכי של ניקוד וטעמים', { align: 'center' });
  doc.moveDown(0.5);
  
  doc.fontSize(10).font('Helvetica')
    .text('גופן: Ezra SIL (SILEOT.ttf)', { align: 'center' })
    .text('Script: Hebr, Language: heb, Direction: RTL', { align: 'center' });
  
  doc.moveDown(2);
  
  // Test cases - display text in RTL order (right to left)
  for (const testCase of testCases) {
    const result = shapeText(testCase.text);
    
    // Label in Hebrew (left-aligned for readability)
    doc.fontSize(12).font('Helvetica').text(testCase.label, { continued: false, align: 'left' });
    
    const hasYOffset = result.glyphs.some(g => g.yOffset !== 0);
    const hasXOffset = result.glyphs.some(g => g.xOffset !== 0);
    
    doc.fontSize(9).font('Helvetica')
      .text(`גליפים: ${result.glyphs.length} | Y-offset: ${hasYOffset ? 'כן' : 'לא'} | X-offset: ${hasXOffset ? 'כן' : 'לא'}`, 
        { continued: false, align: 'left' });
    
    doc.moveDown(0.3);
    
    // Render Hebrew text in RTL (right-aligned)
    doc.fontSize(48).font('Ezra').text(testCase.text, { align: 'right' });
    
    doc.moveDown(1);
    
    // Add grid line for baseline reference
    const y = doc.y;
    doc.moveTo(50, y).lineTo(545, y).stroke('#cccccc');
    doc.moveDown(0.8);
  }
  
  doc.end();
  
  stream.on('finish', () => {
    console.log(`PDF נשמר ב: ${OUTPUT_PDF}`);
    console.log();
    console.log('הוראות:');
    console.log('  1. פתח את ה-PDF');
    console.log('  2. בדוק שהניקוד מופיע מעל האותיות (חולם, קמץ)');
    console.log('  3. בדוק שהניקוד מופיע מתחת האותיות (שבא, סגול)');
    console.log('  4. בדוק שהטעמים במיקומים נכונים');
    console.log('  5. בדוק שסדר המילים נכון (מימין לשמאל: בראשית ברא אלהים)');
    console.log('  6. בדוק שיש רווחים בין המילים');
    console.log();
    console.log('='.repeat(80));
  });
}
