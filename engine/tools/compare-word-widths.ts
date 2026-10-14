/**
 * Compare word widths between HarfBuzz and PDFKit
 * Tests whether PDFKit.doc.text() produces the same widths as HarfBuzz
 */

import * as hb from 'harfbuzzjs';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const FONT_PATH = path.join(process.cwd(), 'fonts', 'SILEOT.ttf');
const CORPUS_PATH = path.join(process.cwd(), '..', 'poc', 'input', 'sample.json');

interface ComparisonResult {
  word: string;
  harfbuzzWidth: number; // in pt
  pdfkitWidth: number; // in pt
  delta: number; // absolute difference
  deltaPercent: number; // percentage
}

async function loadCorpus(): Promise<string[]> {
  const json = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf-8'));
  const words: string[] = [];
  
  // Extract all words from blocks
  for (const section of json.sections || []) {
    for (const block of section.blocks || []) {
      for (const run of block.runs || []) {
        const text = run.text || '';
        // Split on whitespace and filter empty
        const blockWords = text.split(/\s+/).filter(w => w.length > 0);
        words.push(...blockWords);
      }
    }
  }
  
  return words;
}

function measureWithHarfBuzz(text: string, fontSize: number): number {
  const fontData = fs.readFileSync(FONT_PATH);
  const blob = new hb.Blob(fontData);
  const face = new hb.Face(blob);
  const font = new hb.Font(face);
  
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.setDirection('rtl');
  buffer.setScript('Hebr');
  buffer.setLanguage('heb');
  buffer.guessSegmentProperties();
  
  hb.shape(font, buffer);
  
  const positions = buffer.getGlyphPositions();
  
  // Sum advances (in font units)
  let totalAdvance = 0;
  for (const pos of positions) {
    totalAdvance += pos.xAdvance || 0;
  }
  
  // Convert from font units to points
  // fontSize is in points, face.upem is units per em
  const widthInPoints = (totalAdvance * fontSize) / face.upem;
  
  // HarfBuzz v1 uses automatic GC, no destroy() methods
  
  return widthInPoints;
}

function measureWithPDFKit(text: string, fontSize: number): number {
  const doc = new PDFDocument({ size: 'A4' });
  
  // Register font
  doc.registerFont('Ezra', FONT_PATH);
  doc.font('Ezra');
  doc.fontSize(fontSize);
  
  // Measure width
  const width = doc.widthOfString(text);
  
  return width;
}

async function compareCorpus(): Promise<void> {
  console.log('Loading corpus...');
  const words = await loadCorpus();
  console.log(`Loaded ${words.length} words\n`);
  
  // Take first 100 unique words for comparison
  const uniqueWords = [...new Set(words)].slice(0, 100);
  console.log(`Testing ${uniqueWords.length} unique words\n`);
  
  const fontSize = 12; // pt
  const results: ComparisonResult[] = [];
  
  console.log('Comparing widths...\n');
  
  for (let i = 0; i < uniqueWords.length; i++) {
    const word = uniqueWords[i];
    
    if (i % 20 === 0) {
      console.log(`Progress: ${i}/${uniqueWords.length}`);
    }
    
    try {
      const hbWidth = measureWithHarfBuzz(word, fontSize);
      const pdfWidth = measureWithPDFKit(word, fontSize);
      const delta = Math.abs(hbWidth - pdfWidth);
      const deltaPercent = (delta / hbWidth) * 100;
      
      results.push({
        word,
        harfbuzzWidth: hbWidth,
        pdfkitWidth: pdfWidth,
        delta,
        deltaPercent,
      });
    } catch (error) {
      console.error(`Error measuring "${word}":`, error);
    }
  }
  
  console.log(`\nCompleted ${results.length} measurements\n`);
  
  // Analyze results
  const maxDelta = Math.max(...results.map(r => r.delta));
  const maxDeltaPercent = Math.max(...results.map(r => r.deltaPercent));
  const avgDelta = results.reduce((sum, r) => sum + r.delta, 0) / results.length;
  const avgDeltaPercent = results.reduce((sum, r) => sum + r.deltaPercent, 0) / results.length;
  
  const largeDeltas = results.filter(r => r.deltaPercent > 1.0).length;
  const perfectMatches = results.filter(r => r.delta < 0.01).length;
  
  console.log('='.repeat(80));
  console.log('COMPARISON RESULTS');
  console.log('='.repeat(80));
  console.log(`Font size: ${fontSize} pt`);
  console.log(`Words tested: ${results.length}`);
  console.log();
  console.log('STATISTICS:');
  console.log(`  Perfect matches (Δ < 0.01pt): ${perfectMatches} (${(perfectMatches/results.length*100).toFixed(1)}%)`);
  console.log(`  Large deltas (Δ > 1%): ${largeDeltas} (${(largeDeltas/results.length*100).toFixed(1)}%)`);
  console.log();
  console.log(`  Average delta: ${avgDelta.toFixed(3)} pt (${avgDeltaPercent.toFixed(2)}%)`);
  console.log(`  Maximum delta: ${maxDelta.toFixed(3)} pt (${maxDeltaPercent.toFixed(2)}%)`);
  console.log();
  
  // Show worst cases
  const worst = results.sort((a, b) => b.delta - a.delta).slice(0, 10);
  console.log('WORST 10 CASES:');
  console.log('-'.repeat(80));
  console.log('Word                   HarfBuzz    PDFKit      Delta       Delta%');
  console.log('-'.repeat(80));
  for (const r of worst) {
    console.log(
      `${r.word.padEnd(20)} ${r.harfbuzzWidth.toFixed(3).padStart(10)} ${r.pdfkitWidth.toFixed(3).padStart(10)} ${r.delta.toFixed(3).padStart(10)} ${r.deltaPercent.toFixed(2).padStart(10)}%`
    );
  }
  console.log('='.repeat(80));
  console.log();
  
  // Conclusion
  if (maxDeltaPercent < 0.1) {
    console.log('✅ CONCLUSION: PDFKit matches HarfBuzz within 0.1% - doc.text() is sufficient');
  } else if (maxDeltaPercent < 1.0) {
    console.log('⚠️  CONCLUSION: PDFKit deviates up to 1% - doc.text() may be acceptable');
  } else {
    console.log('❌ CONCLUSION: PDFKit deviates significantly - need word-level or glyph-level drawing');
  }
  
  // Save detailed results
  const outputPath = path.join(process.cwd(), 'out', 'width-comparison.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed results saved to: ${outputPath}`);
}

compareCorpus().catch(console.error);
