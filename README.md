# Hebrew Book Layout Engine

Professional typesetting engine for Hebrew religious books with precise column balancing.

## Status: M0 - Infrastructure Setup

Currently at Milestone 0: project structure, type definitions, and configuration scaffold.

**Implemented:**
- ✅ TypeScript project setup
- ✅ Core type definitions (Document, LayoutResult, etc.)
- ✅ Unit system (mpt - milli-points for deterministic calculations)
- ✅ Configuration system with default policies
- ✅ Test infrastructure (Vitest)
- ✅ Build tooling (tsup)

**Next (M1):** Typography pipeline, basic line breaking, single-column page filling, PDF output.

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

# Build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
```

## License

MIT

## References

- Specification: `../docs/SPEC.md` (v0.1) and `../- - - - - - 0-5.md` (v0.5)
- POC evaluation: `../poc/RESULTS.md`
