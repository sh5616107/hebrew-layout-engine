// Typst adapter: converts sample.json to Typst .typ file
const fs = require('fs');
const path = require('path');

// Load sample.json
const inputPath = path.join(__dirname, '..', 'input', 'sample.json');
const doc = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Gematria function for Typst
const gematriaFunction = `// Gematria conversion function
#let gematria(num) = {
  if num < 1 or num > 999 {
    return str(num)
  }
  
  let ones = ("", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט")
  let tens = ("", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ")
  let hundreds = ("", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק")
  
  // Special cases for 15 and 16 (avoid yud-heh and yud-vav)
  if num == 15 { return "ט\u{05f4}ו" }
  if num == 16 { return "ט\u{05f4}ז" }
  
  let h = calc.quo(num, 100)
  let t = calc.quo(calc.rem(num, 100), 10)
  let o = calc.rem(num, 10)
  
  let result = hundreds.at(h) + tens.at(t) + ones.at(o)
  
  // Add geresh for single letter or gershayim for multiple
  if result.len() == 1 {
    result = result + "\u{05f3}"
  } else if result.len() > 1 {
    let chars = result.clusters()
    result = chars.slice(0, -1).join() + "\u{05f4}" + chars.at(-1)
  }
  
  return result
}

`;

// Start building Typst document
let typ = `// Typst layout for Hebrew religious book
// Generated from sample.json

${gematriaFunction}

// Page setup
#set page(
  width: ${doc.pageSpec.width}pt,
  height: ${doc.pageSpec.height}pt,
  margin: (
    inside: ${doc.pageSpec.marginInner}pt,
    outside: ${doc.pageSpec.marginOuter}pt,
    top: ${doc.pageSpec.marginTop}pt,
    bottom: ${doc.pageSpec.marginBottom}pt,
  ),
  header: context {
    let page-num = here().page()
    set text(size: 10pt)
    if calc.even(page-num) {
      // Left page
      align(left)[#text("${doc.meta.title}")]
    } else {
      // Right page  
      align(right)[#text(style: "italic")[${doc.meta.title}]]
    }
  },
  footer: context {
    let page-num = here().page()
    set text(size: 10pt)
    if calc.even(page-num) {
      align(left)[#gematria(page-num)]
    } else {
      align(right)[#gematria(page-num)]
    }
  },
)

// Text direction and language
#set text(
  font: "Ezra SIL",
  size: ${doc.styles.body.fontSize}pt,
  lang: "he",
  dir: rtl,
)

// Paragraph settings
#set par(
  justify: true,
  leading: ${doc.styles.body.lineHeight - doc.styles.body.fontSize}pt,
)

// Footnote styling
#show footnote: set text(size: ${doc.styles.footnote.fontSize}pt)
#set footnote.entry(
  separator: line(length: 30%, stroke: 0.5pt),
  clearance: 6pt,
  gap: 4pt,
)

// TYPST-LIMITATION: Full-width footnotes above two-column text not supported
// Footnotes will appear at bottom of each column, not spanning both columns

// Custom style for centered last line
// TYPST-LIMITATION: Centering only the last line of a paragraph requires complex show rule
// This attempts to create the effect but may not work perfectly

// Chapter heading style
#let chapter-heading(content) = {
  pagebreak(to: "odd", weak: false)
  v(${doc.styles.chapter.spaceAfter}pt)
  align(center)[
    #text(size: ${doc.styles.chapter.fontSize}pt, weight: "bold")[
      #content
    ]
  ]
  v(${doc.styles.chapter.spaceAfter}pt)
}

// Subheading style
#let subheading(content) = {
  v(${doc.styles.subheading.spaceBefore}pt)
  text(size: ${doc.styles.subheading.fontSize}pt, weight: "bold")[
    #content
  ]
  v(${doc.styles.subheading.spaceAfter}pt)
}

// Opening with bold words and window
// TYPST-LIMITATION: Creating exact word-width window is complex
#let opening-para(opening-text, rest-text, window-lines: 2) = {
  // Bold opening words
  text(weight: "bold")[#opening-text]
  rest-text
  // Window effect approximation using spacing
  // Exact implementation would require measuring word width
}

`;

// Table of contents
typ += `// Table of Contents
#page[
  #align(center)[
    #text(size: 18pt, weight: "bold")[תוכן עניינים]
  ]
  #v(18pt)
  
  #outline(
    title: none,
    indent: auto,
  )
]

`;

// Main content - start two-column layout
typ += `// Main content - two columns
#columns(2, gutter: ${doc.pageSpec.columnGap}pt)[

`;

// Process sections
for (const section of doc.sections) {
  for (const block of section.blocks) {
    const style = doc.styles[block.style] || doc.styles.body;
    const fullText = block.runs.map(r => r.text).join('');
    const noteRefs = block.noteRefs || [];
    
    if (block.style === 'chapter') {
      // Close columns for chapter heading
      typ += `] // end columns

#chapter-heading[${fullText}]

// Resume columns
#columns(2, gutter: ${doc.pageSpec.columnGap}pt)[

`;
    } else if (block.style === 'subheading') {
      typ += `#subheading[${fullText}]\n\n`;
    } else {
      // Body paragraph
      const hasOpening = block.flags && block.flags.opening;
      
      if (hasOpening) {
        const opening = block.flags.opening;
        const words = fullText.split(/\s+/);
        const numWords = Math.min(opening.words || 3, words.length);
        const openingWords = words.slice(0, numWords).join(' ');
        const restText = words.slice(numWords).join(' ');
        
        typ += `#opening-para[${openingWords}][${restText ? ' ' + restText : ''}]\n\n`;
      } else {
        // Regular paragraph with footnotes
        let text = fullText;
        
        // Insert footnote markers
        if (noteRefs.length > 0) {
          // Sort by offset descending to insert from end to start
          const sortedRefs = [...noteRefs].sort((a, b) => b.offset - a.offset);
          
          for (const ref of sortedRefs) {
            const note = doc.notes.find(n => n.id === ref.noteId);
            if (note && note.kind === 'footnote') {
              const noteText = note.blocks.map(b => 
                b.runs.map(r => r.text).join('')
              ).join(' ');
              
              text = text.slice(0, ref.offset) + 
                     `#footnote[${noteText}]` + 
                     text.slice(ref.offset);
            }
          }
        }
        
        typ += `${text}\n\n`;
      }
    }
  }
}

// Close columns
typ += `] // end columns\n`;

// Write output
const outDir = path.join(__dirname, '..', 'out', 'typst');
fs.mkdirSync(outDir, { recursive: true });

const typPath = path.join(outDir, 'main.typ');
fs.writeFileSync(typPath, typ, 'utf8');

console.log('✓ Generated Typst document');
console.log(`  Output: ${typPath}`);
console.log('');
console.log('Font used: Ezra SIL');
console.log('Note: Font must be installed locally on the system.');
console.log('');
console.log('Known limitations:');
console.log('  - Full-width footnotes above columns not supported by Typst');
console.log('  - Column balancing has open issues in Typst');
console.log('  - Window below opening word requires custom implementation');
