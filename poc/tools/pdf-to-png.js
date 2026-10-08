#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// PDF to PNG converter using pdf-to-img npm package

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node pdf-to-png.js <input.pdf> <output-prefix>');
  process.exit(1);
}

const pdfPath = path.resolve(args[0]);
const outputPrefixArg = args[1];
// Extract directory and filename from the prefix if it contains a path
const outputDir = path.dirname(path.resolve(outputPrefixArg));
const outputPrefix = path.basename(outputPrefixArg);

console.log(`Converting PDF: ${pdfPath}`);
console.log(`Output directory: ${outputDir}`);
console.log(`Output prefix: ${outputPrefix}`);

// Check if PDF exists
if (!fs.existsSync(pdfPath)) {
  console.error(`Error: PDF file not found: ${pdfPath}`);
  process.exit(1);
}

async function convertPdfToPng() {
  try {
    // Import pdf-to-img dynamically since it's ES module
    const { pdf } = await import('pdf-to-img');
    
    let pageNum = 1;
    
    console.log('Converting pages...');
    
    // Convert PDF to images
    const document = await pdf(pdfPath, { scale: 2.0 }); // 2.0 = ~150 DPI for letter size
    
    for await (const image of document) {
      const outputPath = path.join(outputDir, `${outputPrefix}-${pageNum}.png`);
      fs.writeFileSync(outputPath, image);
      console.log(`✓ Page ${pageNum}: ${outputPath}`);
      pageNum++;
    }
    
    console.log(`\n✓ Conversion successful: ${pageNum - 1} page(s)`);
  } catch (err) {
    console.error('Error converting PDF:', err.message);
    console.error('\nFallback options:');
    console.error('1. Install ImageMagick: https://imagemagick.org/');
    console.error('2. Install Poppler: https://github.com/oschwartz10612/poppler-windows/releases');
    console.error('3. Convert manually: Open PDF, export each page as PNG');
    process.exit(1);
  }
}

convertPdfToPng();
