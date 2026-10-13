# ADR-002: HarfBuzz WASM for Text Shaping

**Status:** Accepted (with caveat)  
**Date:** 2026-10-12  
**Deciders:** Project team

## Context

Hebrew text with nikud (vowel marks) and teamim (cantillation marks) requires proper OpenType shaping via HarfBuzz. The layout engine must:
- Position marks correctly above/below base characters (GPOS features)
- Handle complex ligatures and contextual forms
- Support RTL text direction
- Be deterministic across platforms

Options for integrating HarfBuzz in Node.js/TypeScript:
1. **Native binding** (`harfbuzz` npm package, N-API)
2. **WASM** (`@harfbuzz-wasm/wasm`, emscripten build)
3. **Pure JS implementation** (not feasible - too complex)

## Decision

We will use **`@harfbuzz-wasm/wasm`** for M0-M2 (MVP), with native binding as future optimization if needed.

## Rationale

**WASM pros:**
- ✅ Cross-platform: single .wasm file, no native compilation
- ✅ Sandboxed: no memory corruption bugs
- ✅ Same binary on all platforms → deterministic
- ✅ Easy installation: `npm install`, no build step

**WASM cons:**
- ❌ ~20-30% slower than native (acceptable for POC/MVP)
- ❌ Immature ecosystem (package version 0.0.1)

**Native pros:**
- ✅ Maximum performance
- ✅ Proven stability (HarfBuzz is industry standard)

**Native cons:**
- ❌ Platform-specific binaries (macOS arm64, Windows x64, Linux x64, etc.)
- ❌ Compilation required (node-gyp, Python, C++ toolchain)
- ❌ Harder CI/CD (cross-platform builds)

## Decision Path

**Phase 1 (M0-M2):** Use WASM
- Verify it works with Ezra SIL font + nikud + teamim
- Measure performance on 100-page document
- If acceptable → ship with WASM

**Phase 2 (post-M2):** Evaluate native if needed
- If WASM too slow (e.g., >5 seconds for 100 pages shaping alone)
- Then migrate to native binding (`harfbuzz` npm package or custom N-API)
- Keep same API → drop-in replacement

## Consequences

**Positive:**
- Fast development: no build toolchain hell
- Easier testing: same binary in CI and local
- Portable: single npm package works everywhere

**Negative:**
- Performance ceiling (mitigated: profile before optimizing)
- Dependency on young package (mitigated: can vendor .wasm if needed)

**Verification Plan:**
- **M0:** "Hello World" shaping test: `בְּרֵאשִׁית` → glyphs with GPOS positions
- **M1:** 10 paragraphs of Genesis 1 → PDF with correct nikud
- **M2:** 100-page corpus → measure shaping time (target: <2 sec)

## Fallback Plan

If `@harfbuzz-wasm/wasm` fails or doesn't exist:
1. Use `harfbuzz` native package (accept platform binaries)
2. Vendor HarfBuzz WASM from Harfbuzz.js project
3. Write minimal N-API binding ourselves (last resort)

## Notes

- Font files must include GPOS tables (Ezra SIL does)
- We may need to load fonts into WASM memory (TBD during M0 feasibility test)
- Shaping results must be cached by (text, font, size, features) tuple
