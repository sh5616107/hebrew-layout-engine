#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read sample.json (or from env variable)
const inputFile = process.env.INPUT_FILE || 'sample.json';
const inputPath = path.join(__dirname, '..', 'input', inputFile);
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
    if (block.flags.tocEntry) {
      blockClass += ' toc-entry';
    }
    
    html += `  <${tagName} id="${block.id}" class="${blockClass}">`;
    
    // Handle TOC entry with target link
    if (block.flags.tocEntry) {
      const targetId = block.flags.tocEntry.targetBlockId;
      html += `<a href="#${targetId}" class="toc-link">`;
      for (const run of block.runs) {
        html += run.text;
      }
      html += `</a>`;
    }
    // Handle opening words - just the first word for window test
    else if (block.flags.opening) {
      const text = block.runs[0].text;
      const words = text.split(/\s+/);
      const firstWord = words[0];
      const restWords = words.slice(1);
      
      // Add data attribute for window lines - using just first word
      const windowLines = block.flags.opening.windowLines || 0;
      html += `<span class="opening-window" data-window-lines="${windowLines}">${firstWord}</span> ${restWords.join(' ')}`;
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
    
    // Add footnote references with inline footnote content
    for (const noteRef of block.noteRefs) {
      const noteIndex = doc.notes.findIndex(n => n.id === noteRef.noteId);
      const note = doc.notes.find(n => n.id === noteRef.noteId);
      
      html += `<a href="#${noteRef.noteId}" class="footnote-ref">${noteIndex + 1}</a>`;
      
      // Inline the footnote content with float: footnote
      if (note) {
        html += `<span id="${note.id}" class="footnote">`;
        // Don't add manual marker - float: footnote provides it automatically
        for (const noteBlock of note.blocks) {
          for (const run of noteBlock.runs) {
            html += run.text;
          }
        }
        html += `</span>`;
      }
    }
    
    html += `</${tagName}>\n`;
  }
  
  html += `</section>\n`;
}

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

/* Opening word with window below (Round 4 Test) */
/* ATTEMPT: float: inline-start with height = (N+1) lines to create window effect.
   For RTL text, inline-start is the RIGHT side.
   Using shape-outside: inset(0) to encourage tight wrapping.
   Expected: First word floats right, next N lines wrap around it leaving space below.
*/
.opening-window {
  float: inline-start; /* RTL: floats to the right */
  font-weight: bold;
  font-size: 1.1em;
  line-height: inherit;
  /* Height = (N+1) lines where N = data-window-lines attribute */
  /* For N=1: (1+1) * line-height = 2 lines */
  /* For N=2: (2+1) * line-height = 3 lines */
  height: calc(${doc.styles.body.lineHeight}pt * 2); /* Default for N=1 */
  margin-inline-end: 0.3em; /* Space between floated word and text */
  shape-outside: inset(0);
}

/* Remove old opening styles */
.has-opening .opening {
  font-weight: bold;
  font-size: 1.1em;
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

/* TOC entries */
.toc-entry {
  position: relative;
}

.toc-entry .toc-link {
  text-decoration: none;
  color: inherit;
  display: flex;
  justify-content: space-between;
  direction: rtl;
}

.toc-entry .toc-link::before {
  content: leader(dotted) " ";
  flex: 1;
  margin: 0 0.5em;
}

.toc-entry .toc-link::after {
  content: target-counter(attr(href url), page, hebrew);
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
