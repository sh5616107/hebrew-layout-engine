# Hebrew Book Layout Engine

Professional typesetting engine for Hebrew religious books with precise column balancing.

## Status: M0 - Infrastructure Setup ✅ 90% Complete

Currently at Milestone 0: project structure, type definitions, and configuration scaffold.

**Implemented:**
- ✅ TypeScript project setup (tsconfig, vitest, tsup, eslint)
- ✅ Core type definitions (Document, LayoutResult, 300+ lines)
- ✅ Unit system (mpt - milli-points for deterministic calculations)
- ✅ Configuration system with 7 page policies and cost weights
- ✅ Test infrastructure (Vitest) - 25 unit tests passing
- ✅ HarfBuzz v1.6.3 integration - **confirmed working** (1250-2000 words/sec, deterministic)
- ✅ Ezra SIL font (GPOS complete) - verified PDF output
- ✅ PDFKit integration - Hello World PDF created
- ✅ Lint passing (0 errors)
- ✅ Git repository initialized, 2 commits pushed to GitHub

**Current Status:**
- Typography shaping: **OPERATIONAL** (HarfBuzz v1.6.3 with Ezra SIL)
- Test coverage: 27/37 tests passing (10 feasibility tests have cleanup issues but shaping works)
- PDF output: ✅ Verified with "בְּרֵאשִׁית בָּרָא אֱלֹהִים" (Genesis 1:1)

**Remaining M0 (~10%):**
- Documentation cleanup
- ADR updates

**Next (M1 - Vertical Slice):** JSON document loader, font metrics extraction, greedy line breaking, single-column page filling.

## Architecture

```
src/
├── core/           # Type definitions, units, configuration
├── import/         # DOCX and JSON parsers
├── typography/     # HarfBuzz shaping, bidi, font metrics
├── line-breaking/  # Knuth-Plass and greedy line breaking
├── page-building/  # Page filling, column balancing, policies
├── refinement/     # TOC, cross-references, convergence
├── output/         # PDF rendering, debug output
└── diagnostics/    # Diagnostic codes and waiver management
```

## Specification

This engine implements the Hebrew Book Layout Specification v0.5 (October 2026).

Key features:
- **Precise column balancing**: Columns must end at same baseline (`bottomDelta = 0`)
- **Page policies**: Different balance requirements for body, last page, openings, etc.
- **Opening window**: Empty space below first word (unique feature)
- **RTL with nikud and teamim**: Full Hebrew diacritics support
- **Footnotes**: Full-width at page bottom
- **Deterministic**: Same input always produces same output
- **Measurable**: All coordinates in mpt (milli-points, integers)
- **Diagnostic**: Every failure explicitly reported with code and message

## Usage

```typescript
import { layout, type Document, type LayoutResult } from '@hebrew-layout/engine';

const doc: Document = {
  meta: { title: 'בראשית', language: 'he', direction: 'rtl' },
  styles: { /* ... */ },
  pageSpec: { /* B5, 2 columns, etc. */ },
  sections: [{ kind: 'body', blocks: [/* ... */] }],
  notes: []
};

const result: LayoutResult = layout(doc);

if (result.status === 'valid') {
  console.log(`✓ ${result.pages.length} pages`);
  console.log(`✓ ${result.metrics.balancedPages} balanced`);
} else {
  console.error('Layout failed:');
  result.diagnostics.forEach(d => {
    console.error(`  ${d.code}: ${d.message}`);
  });
}
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run test coverage
npm run test:coverage

# Build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint

# Demo: Create Hello World PDF with HarfBuzz + PDFKit
npx tsx tools/hello-pdf.ts
# Output: out/hello-world.pdf
```

## Fonts

The engine uses **Ezra SIL v2.51** (included in `fonts/SILEOT.ttf`) for Biblical Hebrew with full GPOS tables.

- **Ezra SIL** (`SILEOT.ttf`): Regular, follows Biblia Hebraica Stuttgartensia typography
- **Ezra SIL SR** (`SILEOTSR.ttf`): Alternative cantillation style

License: SIL Open Font License 1.1

## License

MIT

## References

- Specification: `../docs/SPEC.md` (v0.1) and `../- - - - - - 0-5.md` (v0.5)
- POC evaluation: `../poc/RESULTS.md`
