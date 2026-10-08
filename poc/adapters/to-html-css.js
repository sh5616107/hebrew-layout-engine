// Vivliostyle adapter: converts sample.json to HTML + CSS
const fs = require('fs');
const path = require('path');

// Gematria conversion function
function toGematria(num) {
  if (num < 1 || num > 999) return num.toString();
  
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  
  // Special cases for 15 and 16
  if (num === 15) return 'ט״ו';
  if (num === 16) return 'ט״ז';
  
  const h = Math.floor(num / 100);
  const t = Math.floor((num % 100) / 10);
  const o = num % 10;
  
  let result = hundreds[h] + tens[t] + ones[o];
  
  // Add geresh for single letter or gershayim for multiple
  if (result.length === 1) {
    result += '׳';
  } else if (result.length > 1) {
    result = result.slice(0, -1) + '״' + result.slice(-1);
  }
  
  return result;
}

// Load sample.json
const inputPath = path.join(__dirname, '..', 'input', 'sample.json');
const doc = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Generate HTML
let html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.meta.title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
`;

// Table of contents
html += `<section class="toc">
  <h2 class="toc-title">תוכן עניינים</h2>
  <nav role="doc-toc">
`;

let tocEntries = [];
for (const section of doc.sections) {
  for (const block of section.blocks) {
    const style = doc.styles[block.style];
    if (style && style.toc) {
      const level = style.toc;
      const text = block.runs.map(r => r.text).join('');
      tocEntries.push({ id: block.id, text, level });
    }
  }
}

for (const entry of tocEntries) {
  html += `    <div class="toc-entry toc-level-${entry.level}">
      <a href="#${entry.id}">${entry.text}</a>
      <span class="toc-leader"></span>
      <span class="toc-page"><a href="#${entry.id}"></a></span>
    </div>\n`;
}

html += `  </nav>
</section>

`;

// Main content
for (const section of doc.sections) {
  html += `<section class="section section-${section.kind}">\n`;
  
  for (const block of section.blocks) {
    const style = doc.styles[block.style] || doc.styles.body;
    let className = block.style;
    
    // Check for opening with window
    const hasOpening = block.flags && block.flags.opening;
    if (hasOpening) {
      className += ' has-opening';
    }
    
    // Collect footnote references
    const noteRefs = block.noteRefs || [];
    
    // Build text with footnote markers
    let text = '';
    let lastOffset = 0;
    const fullText = block.runs.map(r => r.text).join('');
    
    // Sort note refs by offset
    noteRefs.sort((a, b) => a.offset - b.offset);
    
    for (let i = 0; i < noteRefs.length; i++) {
      const ref = noteRefs[i];
      text += fullText.substring(lastOffset, ref.offset);
      
      // Find note number
      const noteIndex = doc.notes.findIndex(n => n.id === ref.noteId);
      text += `<a href="#${ref.noteId}" class="footnote-ref" id="ref-${ref.noteId}">${noteIndex + 1}</a>`;
      lastOffset = ref.offset;
    }
    text += fullText.substring(lastOffset);
    
    // Apply opening formatting
    if (hasOpening) {
      const opening = block.flags.opening;
      const words = text.split(/\s+/);
      const numWords = Math.min(opening.words || 3, words.length);
      const openingWords = words.slice(0, numWords).join(' ');
      const restText = words.slice(numWords).join(' ');
      
      html += `  <p id="${block.id}" class="${className}" data-window-lines="${opening.windowLines || 2}">`;
      html += `<span class="opening-words">${openingWords}</span>`;
      if (restText) {
        html += ` ${restText}`;
      }
      html += `</p>\n`;
    } else {
      html += `  <${style.textAlign === 'center' ? 'h1' : 'p'} id="${block.id}" class="${className}">${text}</${style.textAlign === 'center' ? 'h1' : 'p'}>\n`;
    }
  }
  
  html += `</section>\n\n`;
}

// Footnotes section
if (doc.notes && doc.notes.length > 0) {
  html += `<section class="footnotes-section" aria-label="הערות שוליים">
`;
  
  for (let i = 0; i < doc.notes.length; i++) {
    const note = doc.notes[i];
    if (note.kind === 'footnote') {
      const text = note.blocks.map(b => b.runs.map(r => r.text).join('')).join(' ');
      html += `  <aside id="${note.id}" class="footnote">
    <a href="#ref-${note.id}">${i + 1}</a> ${text}
  </aside>\n`;
    }
  }
  
  html += `</section>\n`;
}

html += `</body>
</html>`;

// Generate CSS
let css = `/* Vivliostyle Hebrew Layout - Generated from sample.json */

/* Font face - using locally installed font */
body {
  font-family: "Ezra SIL", "Taamey David CLM", "David Libre", "Times New Roman", serif;
  font-size: ${doc.styles.body.fontSize}pt;
  line-height: ${doc.styles.body.lineHeight}pt;
  direction: rtl;
  unicode-bidi: embed;
}

/* Page setup */
@page {
  size: ${doc.pageSpec.width}pt ${doc.pageSpec.height}pt;
  margin-top: ${doc.pageSpec.marginTop}pt;
  margin-bottom: ${doc.pageSpec.marginBottom}pt;
  
  @footnote {
    border-top: 1pt solid black;
    padding-top: 6pt;
    margin-top: 12pt;
  }
}

@page :left {
  margin-left: ${doc.pageSpec.marginOuter}pt;
  margin-right: ${doc.pageSpec.marginInner}pt;
  
  @top-left {
    content: string(chapter-title);
    font-size: 10pt;
    text-align: left;
  }
  
  @bottom-left {
    content: counter(page, hebrew);
    font-size: 10pt;
  }
}

@page :right {
  margin-left: ${doc.pageSpec.marginInner}pt;
  margin-right: ${doc.pageSpec.marginOuter}pt;
  
  @top-right {
    content: "${doc.meta.title}";
    font-size: 10pt;
    text-align: right;
  }
  
  @bottom-right {
    content: counter(page, hebrew);
    font-size: 10pt;
  }
}

/* Gematria page numbers */
/* Note: CSS counter(page, hebrew) uses built-in Hebrew numbering */
/* For custom gematria with tet-vav/tet-zayin, JavaScript or custom counter needed */
/* VIVLIOSTYLE-LIMITATION: Custom gematria (טו/טז) requires JavaScript counter-style */

/* Two-column layout */
.section-body {
  column-count: ${doc.pageSpec.columns};
  column-gap: ${doc.pageSpec.columnGap}pt;
  column-fill: auto;
  text-align: justify;
}

/* RTL column order - right column first */
/* VIVLIOSTYLE-LIMITATION: RTL column ordering may need manual verification */

/* Table of Contents */
.toc {
  page-break-after: always;
  column-count: 1;
}

.toc-title {
  font-size: 18pt;
  font-weight: bold;
  text-align: center;
  margin-bottom: 18pt;
}

.toc-entry {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6pt;
  text-align: right;
}

.toc-level-1 {
  font-weight: bold;
  margin-right: 0;
}

.toc-level-2 {
  margin-right: 18pt;
}

.toc-leader {
  flex-grow: 1;
  border-bottom: 1pt dotted #999;
  margin: 0 6pt;
  align-self: flex-end;
  margin-bottom: 3pt;
}

.toc-page {
  text-align: left;
}

/* Use target-counter for page numbers */
.toc-page a::after {
  content: target-counter(attr(href url), page, hebrew);
}

/* Chapter heading */
.chapter {
  font-size: ${doc.styles.chapter.fontSize}pt;
  line-height: ${doc.styles.chapter.lineHeight}pt;
  font-weight: bold;
  text-align: center;
  margin-bottom: ${doc.styles.chapter.spaceAfter}pt;
  page-break-before: right;
  column-span: all;
  string-set: chapter-title content();
}

/* Subheading */
.subheading {
  font-size: ${doc.styles.subheading.fontSize}pt;
  line-height: ${doc.styles.subheading.lineHeight}pt;
  font-weight: bold;
  text-align: right;
  margin-top: ${doc.styles.subheading.spaceBefore}pt;
  margin-bottom: ${doc.styles.subheading.spaceAfter}pt;
  page-break-after: avoid;
  column-span: all;
}

/* Body paragraphs */
.body {
  text-align: justify;
  text-align-last: center;
  margin: 0;
  padding: 0;
  text-indent: 0;
}

/* Opening words with bold and window */
.opening-words {
  font-weight: bold;
  float: right;
}

/* Window effect - empty space below opening */
/* VIVLIOSTYLE-LIMITATION: Shape-outside for exact word-width window is complex */
/* This creates a window using shape-outside, but width may not match exactly */
.has-opening {
  position: relative;
}

.has-opening::before {
  content: "";
  float: right;
  /* Window dimensions - approximation */
  width: 80pt; /* Approximate width - should measure actual opening word width */
  height: calc(2 * ${doc.styles.body.lineHeight}pt); /* windowLines * lineHeight */
  shape-outside: inset(0);
  clear: right;
}

/* VIVLIOSTYLE-LIMITATION: Exact window width matching bold word requires JavaScript measurement */

/* Footnotes */
.footnote {
  float: footnote;
  font-size: ${doc.styles.footnote.fontSize}pt;
  line-height: ${doc.styles.footnote.lineHeight}pt;
  text-align: justify;
  margin-top: 4pt;
}

.footnote-ref {
  font-size: 0.8em;
  vertical-align: super;
  text-decoration: none;
  padding: 0 2pt;
}

/* Footnote area styling */
@page {
  @footnote {
    border-top: 1pt solid #000;
    padding-top: 8pt;
    margin-top: 12pt;
    /* Full width across both columns */
    column-span: all;
  }
}

/* Baseline grid attempt */
/* VIVLIOSTYLE-LIMITATION: Shared baseline grid between columns is a known limitation */
/* See: https://github.com/vivliostyle/vivliostyle.js/issues/1157 */
/* This sets line-height but doesn't guarantee alignment across columns */

/* Widows and orphans */
p {
  orphans: 2;
  widows: 2;
}

h1, h2, h3 {
  page-break-after: avoid;
}

/* Print refinements */
a {
  color: inherit;
}
`;

// Write files
const outDir = path.join(__dirname, '..', 'out', 'vivliostyle');
fs.mkdirSync(outDir, { recursive: true });

const htmlPath = path.join(outDir, 'index.html');
const cssPath = path.join(outDir, 'style.css');

fs.writeFileSync(htmlPath, html, 'utf8');
fs.writeFileSync(cssPath, css, 'utf8');

console.log('✓ Generated Vivliostyle HTML and CSS');
console.log(`  HTML: ${htmlPath}`);
console.log(`  CSS: ${cssPath}`);
console.log('');
console.log('Font used: Ezra SIL (with fallbacks: Taamey David CLM, David Libre)');
console.log('Note: Font must be installed locally on the system.');
