const fs = require('fs');
const path = require('path');

// Read original sample
const originalPath = path.join(__dirname, '..', 'input', 'sample.json');
const doc = JSON.parse(fs.readFileSync(originalPath, 'utf8'));

// Duplicate body sections to create ~30 pages
const bodySection = doc.sections.find(s => s.kind === 'body');
const repeatedBlocks = [];

// Repeat the body blocks 10 times (3 pages * 10 = ~30 pages)
for (let i = 0; i < 10; i++) {
  for (const block of bodySection.blocks) {
    const newBlock = JSON.parse(JSON.stringify(block));
    newBlock.id = `${block.id}-rep${i}`;
    repeatedBlocks.push(newBlock);
  }
}

// Create new document
const doc30 = JSON.parse(JSON.stringify(doc));
const bodyIdx = doc30.sections.findIndex(s => s.kind === 'body');
doc30.sections[bodyIdx].blocks = repeatedBlocks;

// Write to file
const outPath = path.join(__dirname, '..', 'input', 'sample-30p.json');
fs.writeFileSync(outPath, JSON.stringify(doc30, null, 2));

console.log(`✓ Created 30-page sample: ${outPath}`);
console.log(`  Blocks: ${repeatedBlocks.length}`);
