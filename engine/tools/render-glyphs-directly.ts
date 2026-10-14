/**
 * Render Glyphs Directly from HarfBuzz
 * 
 * Attempt to render glyphs at exact HarfBuzz coordinates using PDFKit's API.
 * Tests whether PDFKit exposes glyph-level drawing capabilities.
 */

import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { readFileSync } from 'fs';
import * as hb from 'harfbuzzjs';

async function renderGlyphsDirect() {
  console.log('=== Glyph-Level Rendering Test ===\n');

  // Load font
  const fontPath = 'fonts/SILEOT.ttf';
  const fontBuffer = readFileSync(fontPath).buffer;
  
  // Shape with HarfBuzz
  const blob = new hb.Blob(fontBuffer);
  const face = new hb.Face(blob);
  const font = new hb.Font(face);
  
  const buffer = new hb.Buffer();
  const text = 'בְּרֵאשִׁית בָּרָא';
  buffer.addText(text);
  buffer.guessSegmentProperties();
  
  hb.shape(font, buffer);
  
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  
  console.log(`Shaped text: "${text}"`);
  console.log(`Total glyphs: ${infos.length}\n`);
  
  // Display glyph data
  infos.forEach((info, i) => {
    const pos = positions[i];
    console.log(`Glyph ${i}: ID=${info.codepoint}, xAdv=${pos.xAdvance}, xOff=${pos.xOffset}, yOff=${pos.yOffset}`);
  });
  
  // Create PDF
  const doc = new PDFDocument({ size: 'A4' });
  const stream = createWriteStream('out/glyph-render-test.pdf');
  doc.pipe(stream);
  
  doc.fontSize(16);
  doc.font(fontPath);
  
  // Test 1: Check if PDFKit has low-level glyph drawing methods
  console.log('\n=== PDFKit API Inspection ===');
  console.log('doc._write methods:', Object.keys(doc).filter(k => k.includes('write') || k.includes('glyph') || k.includes('Glyph')));
  console.log('doc.page methods:', Object.keys(doc.page).filter(k => k.includes('write') || k.includes('glyph')));
  
  // Check for addContent method
  const hasAddContent = typeof (doc as any).addContent === 'function';
  console.log('doc.addContent exists:', hasAddContent);
  
  // Test 2: Try doc.text() approach (baseline)
  doc.text('Baseline (doc.text):', 50, 50);
  doc.text(text, 50, 70);
  
  // Test 3: Try to draw glyphs directly
  let cursorX = 50;
  const cursorY = 150;
  
  doc.text('Attempt glyph-level drawing:', 50, 120);
  
  if (hasAddContent) {
    console.log('\n=== Attempting Direct Glyph Drawing ===');
    
    try {
      // Try to write PDF operators directly
      (doc as any).addContent('BT'); // Begin text
      (doc as any).addContent(`/F1 16 Tf`); // Set font (may not work - font ref unknown)
      (doc as any).addContent(`${cursorX} ${cursorY} Td`); // Move to position
      
      for (let i = 0; i < Math.min(3, infos.length); i++) {
        const gid = infos[i].codepoint;
        const xAdv = positions[i].xAdvance;
        const xOff = positions[i].xOffset;
        
        // Try to show glyph (hex format)
        const glyphHex = gid.toString(16).padStart(4, '0');
        (doc as any).addContent(`<${glyphHex}> Tj`);
        (doc as any).addContent(`${(xAdv + xOff) / 64} 0 Td`); // Advance
      }
      
      (doc as any).addContent('ET'); // End text
      
      console.log('✓ Direct PDF operators executed');
      doc.text('(above: direct glyph drawing attempt)', 50, cursorY + 30, { continued: false });
    } catch (err) {
      console.log('✗ Direct glyph drawing failed:', (err as Error).message);
      doc.text('(direct glyph drawing FAILED)', 50, cursorY + 30);
    }
  } else {
    console.log('\n✗ doc.addContent() not available - cannot write raw PDF operators');
    doc.text('(no addContent method available)', 50, cursorY + 30);
  }
  
  // Test 4: Try word-by-word positioning
  doc.text('Word-by-word positioning:', 50, 200);
  
  const words = text.split(' ');
  let wordX = 50;
  const wordY = 220;
  
  for (const word of words) {
    // Shape word
    const wordBuffer = new hb.Buffer();
    wordBuffer.addText(word);
    wordBuffer.guessSegmentProperties();
    hb.shape(font, wordBuffer);
    
    const wordPositions = wordBuffer.getGlyphPositions();
    const wordWidth = wordPositions.reduce((sum, p) => sum + p.xAdvance, 0) / 64; // HarfBuzz units to points
    
    doc.text(word, wordX, wordY, { lineBreak: false, width: undefined });
    
    wordX += wordWidth + 10; // Add space
  }
  
  // Summary
  doc.moveDown(3);
  doc.fontSize(12);
  doc.text('Summary:', 50, 280);
  doc.fontSize(10);
  doc.text('1. doc.text() works (baseline)', 50, 300);
  doc.text(`2. doc.addContent() ${hasAddContent ? 'exists' : 'NOT available'} ${hasAddContent ? '(direct PDF write possible)' : '(cannot write raw operators)'}`, 50, 315);
  doc.text('3. Word-by-word positioning works (measure with HarfBuzz, place with PDFKit)', 50, 330);
  
  doc.end();
  
  return new Promise<void>((resolve) => {
    stream.on('finish', () => {
      console.log('\n✓ PDF created: out/glyph-render-test.pdf');
      resolve();
    });
  });
}

// Main
renderGlyphsDirect().catch(console.error);
