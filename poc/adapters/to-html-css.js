#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read sample.json
const inputPath = path.join(__dirname, '..', 'input', 'sample.json');
const doc = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Helper: convert gematria number (1-999) with טו/טז special cases
function gematria(n) {
  if (n === 15) return 'ט״ו';
  if (n === 16) return 'ט״ז';
  
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  
  let result = '';
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  
  if (h > 0 && h < hundreds.length) result += hundreds[h];
  if (t > 0 && t < tens.length) result += tens[t];
  if (o > 0 && o < ones.length) result += ones[o];
  
  // Add gershayim or geresh
  if (result.length > 1) {
    // Insert gereshayim before last letter
    return result.slice(0, -1) + '״' + result.slice(-1);
  } else if (result.length === 1) {
    return result + '׳';
  }
  return result;
}

// Generate HTML
let html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${doc.meta.title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
`;

// Add sections
for (const section of doc.sections) {
  html += `<section class="section-${section.kind}">\n`;
  
  for (const block of section.blocks) {
    const style = doc.styles[block.style];
    const tagName = block.style === 'heading1' ? 'h1' : 
                    block.style === 'heading2' ? 'h2' : 'p';
    
    let blockClass = `block-${block.style}`;
    if (block.flags.opening) {
      blockClass += ' has-opening';
    }
    
    html += `  <${tagName} id="${block.id}" class="${blockClass}">`;
    
    // Handle opening words
    if (block.flags.opening) {
      const text = block.runs[0].text;
      const words = text.split(/\s+/);
      const openingWords = words.slice(0, block.flags.opening.words);
      const restWords = words.slice(block.flags.opening.words);
      
      // Add data attribute for window lines
      const windowLines = block.flags.opening.windowLines || 0;
      html += `<span class="opening" data-window-lines="${windowLines}">${openingWords.join(' ')}</span> ${restWords.join(' ')}`;
    } else {
      // Normal text
      for (const run of block.runs) {
        let spanClass = '';
        if (run.bold) spanClass += 'bold ';
        if (run.italic) spanClass += 'italic ';
        
        if (spanClass) {
          html += `<span class="${spanClass.trim()}">${run.text}</span>`;
        } else {
          html += run.text;
        }
      }
    }
    
    // Add footnote references
    for (const noteRef of block.noteRefs) {
      const noteIndex = doc.notes.findIndex(n => n.id === noteRef.noteId);
      html += `<a href="#${noteRef.noteId}" class="footnote-ref">${noteIndex + 1}</a>`;
    }
    
    html += `</${tagName}>\n`;
  }
  
  html += `</section>\n`;
}

// Add footnotes section
html += `\n<section class="footnotes">\n`;
for (const note of doc.notes) {
  const noteIndex = doc.notes.indexOf(note);
  html += `  <div id="${note.id}" class="footnote">\n`;
  html += `    <span class="footnote-marker">${noteIndex + 1}</span> `;
  
  for (const block of note.blocks) {
    for (const run of block.runs) {
      html += run.text;
    }
  }
  
  html += `\n  </div>\n`;
}
html += `</section>\n`;

html += `</body>
</html>`;

// Generate CSS
const css = `/* Vivliostyle CSS for Hebrew Book Layout */

/* Page setup: B5 (176mm × 250mm) */
@page {
  size: 176mm 250mm;
  margin-top: ${doc.pageSpec.marginTop / 2.835}mm;
  margin-bottom: ${doc.pageSpec.marginBottom / 2.835}mm;
  
  @footnote {
    border-top: 1pt solid black;
    padding-top: 6pt;
    margin-top: 12pt;
  }
}

@page :left {
  margin-left: ${doc.pageSpec.marginOuter / 2.835}mm;
  margin-right: ${doc.pageSpec.marginInner / 2.835}mm;
  
  @top-left {
    content: "${doc.meta.title} | " counter(page, hebrew);
    font-family: "David", serif;
    font-size: 9pt;
    direction: rtl;
  }
}

@page :right {
  margin-left: ${doc.pageSpec.marginInner / 2.835}mm;
  margin-right: ${doc.pageSpec.marginOuter / 2.835}mm;
  
  @top-right {
    content: counter(page, hebrew) " | ${doc.meta.title}";
    font-family: "David", serif;
    font-size: 9pt;
    direction: rtl;
  }
}

/* Hebrew counter style with gematria */
@counter-style hebrew {
  system: additive;
  range: 1 999;
  additive-symbols: 
    900 תת, 800 תת, 700 תש, 600 תר, 500 ת,
    400 ת, 300 ש, 200 ר, 100 ק,
    90 צ, 80 פ, 70 ע, 60 ס, 50 נ,
    40 מ, 30 ל, 20 כ,
    19 יט, 18 יח, 17 יז, 16 טז, 15 טו,
    10 י, 9 ט, 8 ח, 7 ז, 6 ו,
    5 ה, 4 ד, 3 ג, 2 ב, 1 א;
  suffix: " ";
}

/* Body setup */
body {
  font-family: "David", serif;
  font-size: ${doc.styles.body.size}pt;
  line-height: ${doc.styles.body.lineHeight}pt;
  direction: rtl;
  unicode-bidi: embed;
  text-align: justify;
  hyphens: none;
}

/* Two-column layout */
section {
  columns: ${doc.pageSpec.columns};
  column-gap: ${doc.pageSpec.columnGap / 2.835}mm;
  column-fill: balance;
  direction: rtl;
}

/* Footnotes */
.footnote-ref {
  font-size: 0.75em;
  vertical-align: super;
  text-decoration: none;
}

.footnote {
  float: footnote;
  font-size: ${doc.styles.footnote.size}pt;
  line-height: ${doc.styles.footnote.lineHeight}pt;
  text-align: justify;
  margin-bottom: 4pt;
}

.footnote-marker {
  font-weight: bold;
  margin-left: 2pt;
}

/* Headings */
h1 {
  font-size: ${doc.styles.heading1.size}pt;
  line-height: ${doc.styles.heading1.lineHeight}pt;
  text-align: ${doc.styles.heading1.align};
  font-weight: bold;
  break-before: page;
  page-break-after: avoid;
  margin-top: 0;
  margin-bottom: ${doc.styles.heading1.lineHeight}pt;
  column-span: all;
}

h2 {
  font-size: ${doc.styles.heading2.size}pt;
  line-height: ${doc.styles.heading2.lineHeight}pt;
  text-align: ${doc.styles.heading2.align};
  font-weight: bold;
  page-break-after: avoid;
  break-after: avoid;
  margin-top: ${doc.styles.heading2.lineHeight}pt;
  margin-bottom: ${doc.styles.heading2.lineHeight / 2}pt;
}

/* Paragraphs */
p {
  margin: 0;
  margin-bottom: ${doc.styles.body.lineHeight / 2}pt;
  text-align: justify;
  text-align-last: center;
  orphans: 2;
  widows: 2;
}

/* Opening words with window below */
/* Simple approach: float the opening word with fixed height to create window */
.has-opening .opening {
  font-weight: bold;
  font-size: 1.1em;
  float: inline-start; /* RTL: floats to the right */
  width: fit-content;
  /* Height = (windowLines + 1) * baselineGrid */
  /* For windowLines=2: (2+1) * 14pt = 42pt */
  height: calc((attr(data-window-lines number, 0) + 1) * ${doc.styles.body.lineHeight}pt);
}

/* Fallback if attr() doesn't work in height - use fixed value for windowLines=2 */
.has-opening .opening[data-window-lines="2"] {
  height: ${(2 + 1) * doc.styles.body.lineHeight}pt;
}

.has-opening .opening[data-window-lines="3"] {
  height: ${(3 + 1) * doc.styles.body.lineHeight}pt;
}

.has-opening .opening[data-window-lines="1"] {
  height: ${(1 + 1) * doc.styles.body.lineHeight}pt;
}

/* VIVLIOSTYLE-LIMITATION: Baseline grid alignment between columns is not fully supported.
   See https://github.com/vivliostyle/vivliostyle.js/issues/1157
   Line-height is set but cross-column alignment is not guaranteed. */

/* Bold and italic */
.bold {
  font-weight: bold;
}

.italic {
  font-style: italic;
}

/* Last section balancing */
section:last-of-type {
  column-fill: balance;
}
`;

// Write files
const outDir = path.join(__dirname, '..', 'vivliostyle');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'index.html'), html);
fs.writeFileSync(path.join(outDir, 'style.css'), css);

console.log('✓ Generated HTML and CSS for Vivliostyle');
console.log(`  HTML: ${path.join(outDir, 'index.html')}`);
console.log(`  CSS: ${path.join(outDir, 'style.css')}`);
