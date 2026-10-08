// PDF to PNG converter helper
// Usage: node tools/pdf-to-png.js <pdf-path> <output-prefix>
// Example: node tools/pdf-to-png.js out/vivliostyle.pdf out/vivliostyle-page

const pdfToImg = require('pdf-to-img');
const fs = require('fs');
const path = require('path');

async function convertPdfToPng(pdfPath, outputPrefix) {
  try {
    console.log(`Converting ${pdfPath} to PNG images...`);
    
    const document = pdfToImg.pdfToPng(pdfPath, {
      disableFontFace: false,
      useSystemFonts: false,
      viewportScale: 2.0, // 2x resolution for better quality
    });
    
    let pageNum = 1;
    for await (const image of document) {
      const outputPath = `${outputPrefix}-${pageNum}.png`;
      fs.writeFileSync(outputPath, image);
      console.log(`  Page ${pageNum} -> ${outputPath}`);
      pageNum++;
    }
    
    console.log(`✓ Converted ${pageNum - 1} pages`);
  } catch (error) {
    console.error('Error converting PDF:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node pdf-to-png.js <pdf-path> <output-prefix>');
  process.exit(1);
}

const pdfPath = args[0];
const outputPrefix = args[1];

if (!fs.existsSync(pdfPath)) {
  console.error(`Error: PDF file not found: ${pdfPath}`);
  process.exit(1);
}

convertPdfToPng(pdfPath, outputPrefix);
