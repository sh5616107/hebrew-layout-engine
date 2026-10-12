# ADR-001: TypeScript as Implementation Language

**Status:** Accepted  
**Date:** 2026-10-12  
**Deciders:** Project team

## Context

The Hebrew Book Layout Engine requires:
- Deterministic calculations (no floating-point errors)
- Integration with existing POC (JavaScript adapters)
- Rich ecosystem for typography (HarfBuzz bindings, PDF generation)
- Developer productivity (type safety, tooling, testing)
- Cross-platform deployment (Windows, macOS, Linux)

Alternatives considered:
1. **C# with HarfBuzzSharp** - Excellent performance, good .NET ecosystem, but heavier runtime
2. **Rust** - Maximum performance and safety, but steeper learning curve and less mature typography ecosystem
3. **TypeScript/JavaScript** - Good performance, rich ecosystem, matches POC

## Decision

We will use **TypeScript** (target ES2022, strict mode) with Node.js 22+ LTS runtime.

## Rationale

**Pros:**
- ✅ POC already in JavaScript - can reuse findings and fixtures
- ✅ Rich ecosystem: `pdfkit`, potential HarfBuzz WASM bindings
- ✅ Excellent tooling: Vitest (fast tests), tsup (fast builds), ESLint/Prettier
- ✅ Type safety without runtime overhead
- ✅ Easy to test: pure functions, mocking, fixtures
- ✅ Cross-platform: single binary with pkg or bun compile
- ✅ Fast enough: V8 JIT, worker threads for parallelism if needed

**Cons:**
- ❌ Not as fast as C#/Rust (mitigated: layout is CPU-bound, not I/O)
- ❌ HarfBuzz native binding may be complex (start with WASM)
- ❌ Large dependency trees (mitigated: minimal deps, tree-shaking)

**Why not C#:**
- Heavier .NET runtime (~200 MB)
- POC work (Typst/Vivliostyle evaluation) can't be directly reused
- Fewer Hebrew/RTL layout examples in .NET ecosystem

**Why not Rust:**
- Longer development time (team familiarity with TS >> Rust)
- Harder to test and debug (ownership, lifetimes)
- PDF ecosystem less mature than Node.js

## Consequences

**Positive:**
- Fast iteration: write → test → refactor cycle < 5 seconds
- Easy CI/CD: GitHub Actions, no build matrix complexity
- Portable: engine as npm package, CLI as single binary

**Negative:**
- May hit performance limits at scale (e.g., 1000+ page books) → profile and optimize later
- Dependent on Node.js ecosystem stability

**Mitigation:**
- Use integer math (mpt) to avoid floating-point non-determinism
- Profile early (M2 onward)
- Keep door open for rewrite: clean architecture, well-tested

## Notes

- All coordinates stored as integers (mpt = milli-points = 1/1000 pt)
- No `any` types allowed (enforced by ESLint)
- Strict null checks enabled
- Target modern Node.js only (no browser, no Webpack)
