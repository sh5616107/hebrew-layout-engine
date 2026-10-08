#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Read sample.json
const inputPath = path.join(__dirname, '..', 'input', 'sample.json');
const doc = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Generate Typst file
let typ = `// Typst source for Hebrew Book Layout POC
// Generated from sample.json

// Gematria conversion function
#let gematria(n) = {
  if n == 15 { return "ט״ו" }
  if n == 16 { return "ט״ז" }
  
  let ones = ("", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט")
  let tens = ("", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ")
  let hundreds = ("", "ק", "ר", "ש", "ת")
  
  let h = calc.quo(n, 100)
  let t = calc.quo(calc.rem(n, 100), 10)
  let o = calc.rem(n, 10)
  
  let result = ""
  if h > 0 and h < hundreds.len() { result = result + hundreds.at(h) }
  if t > 0 and t < tens.len() { result = result + tens.at(t) }
  if o > 0 and o < ones.len() { result = result + ones.at(o) }
  
  // Add gershayim or geresh
  if result.clusters().len() > 1 {
    let chars = result.clusters()
    let last-char = chars.last()
    let rest = chars.slice(0, chars.len() - 1).join()
    result = rest + "״" + last-char
  } else if result.clusters().len() == 1 {
    result = result + "׳"
  }
  
  result
}

#set page(
  width: 176mm,
  height: 250mm,
  margin: (
    inside: ${doc.pageSpec.marginInner / 2.835}mm,
    outside: ${doc.pageSpec.marginOuter / 2.835}mm,
    top: ${doc.pageSpec.marginTop / 2.835}mm,
    bottom: ${doc.pageSpec.marginBottom / 2.835}mm,
  ),
  header: context {
    set text(size: 9pt, font: "David")
    set align(center)
    
    let page-num = gematria(here().page())
    if calc.odd(here().page()) {
      [#page-num | ${doc.meta.title}]
    } else {
      [${doc.meta.title} | #page-num]
    }
    v(0.5em)
    line(length: 100%, stroke: 0.5pt)
  },
  numbering: "1",
)

#set text(
  font: "David",
  size: ${doc.styles.body.size}pt,
  lang: "he",
  dir: rtl,
)

#set par(
  leading: ${doc.styles.body.lineHeight - doc.styles.body.size}pt,
  justify: true,
)

// Custom paragraph styling for centered last line
// TYPST-LIMITATION: Centering only the last line of a paragraph is not directly supported.
// This attempts to approximate it, but Typst's paragraph model doesn't have ::last-line selector.
#let centered-last-par(body) = {
  body
}

`;

// Process sections and blocks
let footnoteCounter = 0;
const footnoteMap = new Map();

let columnContent = '';
let isFirstHeading1 = true;

for (const section of doc.sections) {
  // Special handling for TOC section
  if (section.kind === 'front') {
    // Output TOC title as heading
    for (const block of section.blocks) {
      if (block.style === 'heading1') {
        columnContent += `#heading(level: 1, numbering: none, outlined: false)[\n`;
        columnContent += `  ${block.runs[0].text}\n`;
        columnContent += `]\n\n`;
        break;
      }
    }
    // Use native Typst outline
    columnContent += `#outline(title: none, depth: 2, indent: 1em)\n\n`;
    columnContent += `#colbreak()\n\n`;
    continue;
  }
  
  columnContent += `// Section: ${section.kind}\n`;
  
  for (const block of section.blocks) {
    const style = doc.styles[block.style];
    
    // Headings
    if (block.style === 'heading1') {
      // Don't pagebreak before first heading, use colbreak for others
      if (!isFirstHeading1) {
        columnContent += `\n#colbreak()\n`;
      }
      isFirstHeading1 = false;
      columnContent += `#heading(level: 1, numbering: none)[\n`;
      columnContent += `  ${block.runs[0].text}\n`;
      columnContent += `]\n\n`;
    } else if (block.style === 'heading2') {
      columnContent += `\n#v(${style.lineHeight}pt)\n`;
      columnContent += `#heading(level: 2, numbering: none)[\n`;
      columnContent += `  ${block.runs[0].text}\n`;
      columnContent += `]\n`;
      columnContent += `#v(${style.lineHeight / 2}pt)\n\n`;
    } else {
      // Body paragraph
      columnContent += `#par[\n`;
      
      // Handle opening with window
      if (block.flags.opening) {
        const text = block.runs[0].text;
        const words = text.split(/\s+/);
        const openingWords = words.slice(0, block.flags.opening.words);
        const restWords = words.slice(block.flags.opening.words);
        
        // TYPST-LIMITATION: Cannot create window effect (empty space below bold opening).
        // Emitting bold text inline instead.
        columnContent += `  #text(weight: "bold", size: ${style.size * 1.1}pt)[${openingWords.join(' ')}] ${restWords.join(' ')}\n`;
      } else {
        // Normal text
        for (const run of block.runs) {
          let textContent = run.text;
          if (run.bold) textContent = `#text(weight: "bold")[${textContent}]`;
          if (run.italic) textContent = `#text(style: "italic")[${textContent}]`;
          columnContent += `  ${textContent}`;
        }
      }
      
      // Add footnote references
      for (const noteRef of block.noteRefs) {
        footnoteCounter++;
        footnoteMap.set(noteRef.noteId, footnoteCounter);
        
        const note = doc.notes.find(n => n.id === noteRef.noteId);
        if (note) {
          const noteText = note.blocks[0].runs[0].text;
          columnContent += `#footnote[\n`;
          columnContent += `    #text(size: ${doc.styles.footnote.size}pt)[\n`;
          columnContent += `      ${noteText}\n`;
          columnContent += `    ]\n`;
          columnContent += `  ]`;
        }
      }
      
      columnContent += `\n]\n\n`;
    }
  }
}

// Add two-column layout wrapper
typ += `\n// Two-column layout\n#columns(2, gutter: ${doc.pageSpec.columnGap / 2.835}mm)[\n\n` + columnContent + `\n]\n`;

// TYPST-LIMITATION: Footnotes in two-column layout appear at bottom of each column,
// not as full-width footnotes above both columns as specified.
// See: https://forum.typst.app/t/double-column-footnotes/8231
typ += `\n// Note: Footnotes appear at bottom of each column, not full-width above columns.\n`;

// TYPST-LIMITATION: Columns are not balanced by default. The last page may have uneven columns.
typ += `// Note: Typst does not balance columns by default. Last page may have uneven column heights.\n`;

// Write file
const outDir = path.join(__dirname, '..', 'typst');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'main.typ'), typ);

console.log('✓ Generated Typst source');
console.log(`  File: ${path.join(outDir, 'main.typ')}`);
console.log('  Note: Known limitations documented in comments');
