/**
 * Check GPOS positioning with different mark combinations
 */

import * as hb from 'harfbuzzjs';
import { readFileSync } from 'fs';
import { join } from 'path';

const fontPath = join(process.cwd(), 'fonts', 'SILEOT.ttf');
const fontBuffer = readFileSync(fontPath).buffer;

const blob = new hb.Blob(fontBuffer);
const face = new hb.Face(blob);
const font = new hb.Font(face);

// Test different mark combinations
const tests = [
  { name: 'Patah above', text: 'בַ' },
  { name: 'Qamatz below', text: 'בָ' },
  { name: 'Shva below', text: 'בְ' },
  { name: 'Segol below', text: 'בֶ' },
  { name: 'Hiriq below', text: 'בִ' },
  { name: 'Complex (bet+shva+dagesh)', text: 'בְּ' },
  { name: 'With taam above', text: 'בָּ֣' },
];

console.log('Testing GPOS positioning with Ezra SIL:\n');

for (const test of tests) {
  const buffer = new hb.Buffer();
  buffer.addText(test.text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);
  
  const infos = buffer.getGlyphInfos();
  const positions = buffer.getGlyphPositions();
  
  console.log(`${test.name}: "${test.text}"`);
  console.log(`  Glyphs: ${infos.length}`);
  
  for (let i = 0; i < infos.length; i++) {
    const pos = positions[i];
    console.log(`    [${i}] xAdv=${pos.xAdvance} yAdv=${pos.yAdvance} xOff=${pos.xOffset} yOff=${pos.yOffset}`);
  }
  
  const hasXOff = positions.some(p => p.xOffset !== 0);
  const hasYOff = positions.some(p => p.yOffset !== 0);
  console.log(`  Offsets: X=${hasXOff}, Y=${hasYOff}\n`);
}

console.log('Conclusion:');
console.log('  If Y offsets are all 0, Ezra SIL may use attachment positioning');
console.log('  or marks are rendered as separate glyphs with zero advance.');
