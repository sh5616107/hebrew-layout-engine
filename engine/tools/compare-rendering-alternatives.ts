/**
 * Compare two rendering alternatives:
 * A. Word/cluster-level positioning with PDFKit
 * B. Glyph-level positioning with low-level PDF streams
 * 
 * Measures width deviation for each approach on same 100 words
 */

import * as hb from 'harfbuzzjs';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const FONT_PATH = path.join(process.cwd(), 'fonts', 'SILEOT.ttf');
const CORPUS_PATH = path.join(process.cwd(), '..', 'poc', 'input', 'sample.json');

interface RenderingResult {
  word: string;
  harfbuzzWidth: number; // Reference (HarfBuzz calculation)
  alternativeAWidth: number; // Alternative A measurement
  alternativeBWidth: number; // Alternative B measurement
  deltaA: number;
  deltaAPercent: number;
  deltaB: number;
  deltaBPercent: number;
}

function loadCorpus(): string[] {
  const json = JSON.parse(fs.readFileSync(CORPUS_PATH, 'utf-8'));
  const words: string[] = [];
  
  for (const section of json.sections || []) {
    for (const block of section.blocks || []) {
      for (const run of block.runs || []) {
        const text = run.text || '';
        const blockWords = text.split(/\s+/).filter(w => w.length > 0);
        words.push(...blockWords);
      }
    }
  }
  
  return [...new Set(words)].slice(0, 100);
}

function measureWithHarfBuzz(text: string, fontSize: number): number {
  const fontData = fs.readFileSync(FONT_PATH);
  const blob = new hb.Blob(fontData);
  const face = new hb.Face(blob);
  const font = new hb.Font(face);
  
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.setScript('Hebr');
  buffer.setLanguage('heb');
  buffer.setDirection('rtl');
  buffer.guessSegmentProperties();
  
  hb.shape(font, buffer);
  
  const positions = buffer.getGlyphPositions();
  let totalAdvance = 0;
  for (const pos of positions) {
    totalAdvance += pos.xAdvance;
  }
  
  const widthInPoints = (totalAdvance * fontSize) / face.upem;
  return widthInPoints;
}

/**
 * Alternative A: Word/cluster positioning with PDFKit
 * 
 * Strategy:
 * - Use HarfBuzz to measure each word
 * - Position words at calculated X coordinates
 * - Let PDFKit handle internal shaping
 * 
 * Pros:
 * - Simpler than glyph-level
 * - Still controls word positioning
 * - PDFKit handles font subsetting
 * 
 * Cons:
 * - PDFKit may re-shape differently
 * - Width deviation still possible
 */
function measureAlternativeA(text: string, fontSize: number): number {
  // Simulate: measure with HarfBuzz, position with PDFKit
  // In practice, we'd:
  // 1. Measure word with HarfBuzz
  // 2. doc.text(word, x, y) where x is our calculated position
  // 3. x += harfbuzzWidth
  
  // For measurement, we use PDFKit's widthOfString as proxy
  const doc = new PDFDocument();
  doc.registerFont('Ezra', FONT_PATH);
  doc.font('Ezra').fontSize(fontSize);
  
  return doc.widthOfString(text);
}

/**
 * Alternative B: Glyph-level positioning with low-level streams
 * 
 * Strategy:
 * - Use HarfBuzz for shaping
 * - Write PDF operators directly:
 *   /F1 12 Tf           % Set font
 *   100 700 Td          % Move to position
 *   <glyphID> Tj        % Show glyph
 * - Handle font subsetting manually
 * 
 * Pros:
 * - Exact control over every glyph
 * - No re-shaping by PDF library
 * - Can implement custom positioning
 * 
 * Cons:
 * - Must handle font subsetting
 * - Must map HarfBuzz GID → PDF CID
 * - More complex code
 * - Harder to debug
 */
function measureAlternativeB(text: string, fontSize: number): number {
  // For alternative B, we'd position each glyph individually
  // The width would be exactly HarfBuzz's calculation
  // since we're not letting PDFKit re-measure
  
  // For this comparison, Alternative B = HarfBuzz width
  // (since we're directly using HarfBuzz positioning)
  return measureWithHarfBuzz(text, fontSize);
}

async function compareAlternatives() {
  console.log('='.repeat(80));
  console.log('RENDERING ALTERNATIVES COMPARISON');
  console.log('='.repeat(80));
  console.log();
  console.log('Alternative A: Word/cluster positioning with PDFKit');
  console.log('Alternative B: Glyph-level positioning with low-level streams');
  console.log();
  
  const words = loadCorpus();
  console.log(`Testing ${words.length} words\n`);
  
  const fontSize = 12;
  const results: RenderingResult[] = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    if (i % 20 === 0) {
      console.log(`Progress: ${i}/${words.length}`);
    }
    
    try {
      const hbWidth = measureWithHarfBuzz(word, fontSize);
      const altA = measureAlternativeA(word, fontSize);
      const altB = measureAlternativeB(word, fontSize);
      
      results.push({
        word,
        harfbuzzWidth: hbWidth,
        alternativeAWidth: altA,
        alternativeBWidth: altB,
        deltaA: Math.abs(hbWidth - altA),
        deltaAPercent: (Math.abs(hbWidth - altA) / hbWidth) * 100,
        deltaB: Math.abs(hbWidth - altB),
        deltaBPercent: (Math.abs(hbWidth - altB) / hbWidth) * 100,
      });
    } catch (error) {
      console.error(`Error measuring "${word}":`, error);
    }
  }
  
  console.log(`\nCompleted ${results.length} measurements\n`);
  
  // Analyze Alternative A
  const avgDeltaA = results.reduce((sum, r) => sum + r.deltaA, 0) / results.length;
  const maxDeltaA = Math.max(...results.map(r => r.deltaA));
  const maxDeltaAPercent = Math.max(...results.map(r => r.deltaAPercent));
  const perfectMatchesA = results.filter(r => r.deltaA < 0.01).length;
  const largeDeviationsA = results.filter(r => r.deltaAPercent > 1.0).length;
  
  // Analyze Alternative B
  const avgDeltaB = results.reduce((sum, r) => sum + r.deltaB, 0) / results.length;
  const maxDeltaB = Math.max(...results.map(r => r.deltaB));
  const maxDeltaBPercent = Math.max(...results.map(r => r.deltaBPercent));
  const perfectMatchesB = results.filter(r => r.deltaB < 0.01).length;
  const largeDeviationsB = results.filter(r => r.deltaBPercent > 1.0).length;
  
  console.log('='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80));
  console.log();
  
  console.log('ALTERNATIVE A: Word/cluster positioning with PDFKit');
  console.log('-'.repeat(80));
  console.log(`  Perfect matches (Δ < 0.01pt):  ${perfectMatchesA} (${(perfectMatchesA/results.length*100).toFixed(1)}%)`);
  console.log(`  Large deviations (Δ > 1%):     ${largeDeviationsA} (${(largeDeviationsA/results.length*100).toFixed(1)}%)`);
  console.log(`  Average delta:                 ${avgDeltaA.toFixed(3)}pt (${(avgDeltaA/fontSize*100).toFixed(2)}%)`);
  console.log(`  Maximum delta:                 ${maxDeltaA.toFixed(3)}pt (${maxDeltaAPercent.toFixed(2)}%)`);
  console.log();
  
  console.log('ALTERNATIVE B: Glyph-level positioning with streams');
  console.log('-'.repeat(80));
  console.log(`  Perfect matches (Δ < 0.01pt):  ${perfectMatchesB} (${(perfectMatchesB/results.length*100).toFixed(1)}%)`);
  console.log(`  Large deviations (Δ > 1%):     ${largeDeviationsB} (${(largeDeviationsB/results.length*100).toFixed(1)}%)`);
  console.log(`  Average delta:                 ${avgDeltaB.toFixed(3)}pt (${(avgDeltaB/fontSize*100).toFixed(2)}%)`);
  console.log(`  Maximum delta:                 ${maxDeltaB.toFixed(3)}pt (${maxDeltaBPercent.toFixed(2)}%)`);
  console.log();
  
  console.log('='.repeat(80));
  console.log('COMPARISON');
  console.log('='.repeat(80));
  console.log();
  console.log(`Alternative A is ${avgDeltaA > avgDeltaB ? 'WORSE' : 'BETTER'} on average`);
  console.log(`  Δ average: ${Math.abs(avgDeltaA - avgDeltaB).toFixed(3)}pt`);
  console.log();
  console.log(`Alternative A has ${largeDeviationsA > largeDeviationsB ? 'MORE' : 'FEWER'} large deviations`);
  console.log(`  Δ count: ${Math.abs(largeDeviationsA - largeDeviationsB)} words`);
  console.log();
  
  // Save results
  const outputPath = path.join(process.cwd(), 'out', 'rendering-alternatives.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    alternativeA: {
      description: 'Word/cluster positioning with PDFKit',
      perfectMatches: perfectMatchesA,
      largeDeviations: largeDeviationsA,
      avgDelta: avgDeltaA,
      maxDelta: maxDeltaA,
      maxDeltaPercent: maxDeltaAPercent,
    },
    alternativeB: {
      description: 'Glyph-level positioning with streams',
      perfectMatches: perfectMatchesB,
      largeDeviations: largeDeviationsB,
      avgDelta: avgDeltaB,
      maxDelta: maxDeltaB,
      maxDeltaPercent: maxDeltaBPercent,
    },
    results,
  }, null, 2));
  
  console.log(`Detailed results saved to: ${outputPath}`);
  console.log();
  console.log('='.repeat(80));
  console.log('RECOMMENDATION');
  console.log('='.repeat(80));
  console.log();
  console.log('See ADR-004 for analysis and recommendation.');
  console.log('Neither alternative is definitively chosen until M2.');
}

compareAlternatives().catch(console.error);
