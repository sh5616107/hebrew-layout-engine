# PDF Verification Script
# Checks basic properties of generated PDFs

$vivPdf = "c:\proyecys\layout engine\poc\out\vivliostyle.pdf"
$typstPdf = "c:\proyecys\layout engine\poc\out\typst.pdf"

Write-Host "=== PDF Verification ===" -ForegroundColor Cyan
Write-Host ""

# Check if files exist
Write-Host "Checking PDF files..." -ForegroundColor Yellow
if (Test-Path $vivPdf) {
    $vivSize = (Get-Item $vivPdf).Length
    Write-Host "✓ Vivliostyle PDF exists: $vivPdf" -ForegroundColor Green
    Write-Host "  Size: $($vivSize / 1KB) KB" -ForegroundColor Gray
} else {
    Write-Host "✗ Vivliostyle PDF not found" -ForegroundColor Red
}

if (Test-Path $typstPdf) {
    $typstSize = (Get-Item $typstPdf).Length
    Write-Host "✓ Typst PDF exists: $typstPdf" -ForegroundColor Green
    Write-Host "  Size: $($typstSize / 1KB) KB" -ForegroundColor Gray
} else {
    Write-Host "✗ Typst PDF not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "Note: For detailed visual verification, open PDFs manually in:" -ForegroundColor Yellow
Write-Host "  - Adobe Acrobat Reader" -ForegroundColor Gray
Write-Host "  - SumatraPDF" -ForegroundColor Gray
Write-Host "  - Or your preferred PDF viewer" -ForegroundColor Gray
Write-Host ""
Write-Host "To convert to PNG for inspection, use external tools:" -ForegroundColor Yellow
Write-Host "  - ImageMagick: magick convert -density 150 input.pdf output-%d.png" -ForegroundColor Gray
Write-Host "  - Poppler pdftoppm: pdftoppm -png -r 150 input.pdf output" -ForegroundColor Gray
Write-Host ""
