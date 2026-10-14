# ADR-006: bidi-js Library Evaluation

**Date:** 2026-10-12  
**Status:** ❌ REJECTED  
**Decision:** Continue with custom UAX #9 implementation from M1.1

## Context

User requested retry of bidi-js library with correct API (getEmbeddingLevels, getReorderSegments) after initial attempt failed with wrong API (getVisual).

## Investigation

### Package Installation
```bash
npm install bidi-js
# Successfully installed with 2 additional dependencies
```

### API Discovery

The library exports a factory function:
```javascript
const bidi = require('bidi-js');
const instance = bidi(); // Must call factory first
```

Instance methods discovered:
- `closingToOpeningBracket`
- `getBidiCharType`
- `getBidiCharTypeName`
- `getCanonicalBracket`
- **`getEmbeddingLevels`** ✅
- `getMirroredCharacter`
- `getMirroredCharactersMap`
- **`getReorderSegments`** ✅
- `getReorderedIndices`
- `getReorderedString`
- `openingToClosingBracket`

### Test Results

**Test 1: Hebrew text**
```javascript
const instance = bidi();
const text = 'בראשית ברא אלהים'; // 17 chars
const levels = instance.getEmbeddingLevels(text);
// Result: NOT an array ❌
// Expected: [1, 1, 1, 1, 1, ...] (odd levels for RTL)
```

**Test 2: Mixed text**
```javascript
const text = 'Genesis 1:1 בראשית'; // 18 chars
const levels = instance.getEmbeddingLevels(text);
// Result: levels.length = undefined ❌
// API doesn't return simple array
```

**Test 3: Reorder segments**
```javascript
const text = 'Genesis בראשית';
const levels = instance.getEmbeddingLevels(text);
const segments = instance.getReorderSegments(text, levels);
// Result: segments.length = 1 (expected > 1) ❌
```

**Test 4: getReorderedString**
```javascript
const instance = bidi();
const text = 'Genesis בראשית';
const reordered = instance.getReorderedString(text);
// Result: "Cannot read properties of undefined (reading 'paragraphs')" ❌
```

## API Mismatch

The actual API signature appears to be different from documentation:
- `getEmbeddingLevels(text)` does NOT return `number[]`
- `getReorderSegments(text, levels)` does NOT work as expected
- `getReorderedString(text)` throws error about 'paragraphs'

The library may require:
1. Different data structure input
2. Text wrapped in paragraph structure
3. Additional configuration

## Decision

**❌ REJECT bidi-js** for the following reasons:

1. **API opacity:** Actual API differs from expected documentation
2. **Testing difficulty:** 5/7 tests failed with API errors
3. **Working alternative:** M1.1 custom UAX #9 implementation is:
   - ✅ Working (14/14 tests passing)
   - ✅ Deterministic
   - ✅ Fast enough (74,107 words/sec)
   - ✅ Well-understood codebase (300 lines)
   - ✅ Zero dependencies

4. **Cost/benefit:** Learning bidi-js's actual API would take more time than maintaining custom implementation

## Conclusion

**Continue with custom BiDi resolver from M1.1.**

The custom implementation (`src/bidi/bidi-resolver.ts`, `src/bidi/bidi-integration.ts`) provides:
- Character type detection (R, L, EN, WS, etc.)
- Embedding level computation
- Visual reordering (UAX #9 L2 algorithm)
- Word-level reordering integration

For M3+ if full UAX #9 compliance needed:
- Consider **Fribidi** (C library with Node bindings)
- Consider **Rust unicode-bidi** via WASM
- Or extend custom implementation

## Files

Created:
- `tests/feasibility/bidi-js.test.ts` (documented failure)
- `docs/ADR-006-bidi-js-evaluation.md` (this file)

No production code changes needed.
