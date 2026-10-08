#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Simple PDF to PNG converter using Node.js built-in capabilities
// For Windows without external dependencies, we'll create a PowerShell script instead

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node pdf-to-png.js <input.pdf> <output-prefix>');
  process.exit(1);
}

const pdfPath = path.resolve(args[0]);
const outputPrefix = args[1];

// Generate PowerShell script for PDF to PNG conversion
const psScript = `
# PDF to PNG conversion using Windows built-in capabilities
# Requires: Windows 10+ with PDF rendering capabilities

$pdfPath = "${pdfPath.replace(/\\/g, '\\\\')}"
$outputDir = Split-Path -Parent $pdfPath
$outputBase = "${outputPrefix}"

Write-Host "Converting PDF to PNG..."
Write-Host "PDF: $pdfPath"
Write-Host "Output prefix: $outputBase"

# Check if PDF exists
if (-not (Test-Path $pdfPath)) {
    Write-Error "PDF file not found: $pdfPath"
    exit 1
}

# Try using magick (ImageMagick) if available
$magickPath = (Get-Command magick -ErrorAction SilentlyContinue)
if ($magickPath) {
    Write-Host "Using ImageMagick..."
    & magick convert -density 150 "$pdfPath" "$outputDir\\$outputBase-%d.png"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Conversion successful"
        exit 0
    }
}

# Try using pdftoppm if available
$pdftoppmPath = (Get-Command pdftoppm -ErrorAction SilentlyContinue)
if ($pdftoppmPath) {
    Write-Host "Using pdftoppm..."
    & pdftoppm -r 150 -png "$pdfPath" "$outputDir\\$outputBase"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Conversion successful"
        exit 0
    }
}

Write-Host "⚠ No PDF conversion tool found (magick or pdftoppm)"
Write-Host "Please install ImageMagick or Poppler utils, or convert manually"
Write-Host "For manual conversion:"
Write-Host "1. Open $pdfPath in a PDF reader"
Write-Host "2. Export/save each page as PNG"
Write-Host "3. Name files: $outputBase-1.png, $outputBase-2.png, etc."
exit 1
`;

// Write and execute PowerShell script
const psScriptPath = path.join(__dirname, 'pdf-to-png-temp.ps1');
fs.writeFileSync(psScriptPath, psScript);

console.log('Generated PowerShell conversion script');
console.log(`Run: powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`);

// Try to execute
const { execSync } = require('child_process');
try {
  execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, {
    stdio: 'inherit'
  });
} catch (err) {
  console.error('Conversion failed or tool not available');
  console.error('Please convert PDF pages to PNG manually or install ImageMagick');
}

// Cleanup
try {
  fs.unlinkSync(psScriptPath);
} catch (e) {
  // Ignore cleanup errors
}
