# ADR-005: BiDi Support Deferred to M1.1

**Date:** 2026-10-13  
**Status:** Accepted  
**Decision:** Defer full BiDi (Hebrew + Latin + Digits) to M1.1, proceed with Hebrew-only for M1.0

---

## Context

M1 plan originally included full BiDi support (UAX #9) for mixed:
- Hebrew text (RTL)
- Latin text (LTR)
- Digits (LTR within RTL)

### Investigation Results

**Attempted libraries:**
1. **bidi-js** - API mismatch (no `getVisual()` method as documented)
2. **unicode-bidirectional** - Low-level API, requires manual implementation of UAX #9

**Estimated effort for full BiDi:**
- Library integration/custom implementation: 2-3 days
- Testing all edge cases (27 test scenarios): 1-2 days
- **Total:** 3-5 days

---

## Decision

**Defer BiDi to M1.1.** Proceed with M1.0 as **Hebrew-only:**

### M1.0 Scope (Hebrew-only)
- ✅ JSON document parsing
- ✅ HarfBuzz shaping (Hebrew + nikud + te'amim)
- ✅ Greedy line breaking
- ✅ Two-column layout with balance
- ✅ LayoutResult structure
- ✅ PDF rendering
- ❌ BiDi (deferred)

### M1.1 Scope (BiDi addition)
- ✅ BiDi library integration or custom UAX #9
- ✅ Mixed Hebrew + Latin + Digits
- ✅ 27 BiDi test scenarios

---

## Rationale

### Why Defer

1. **Library uncertainty:** No battle-tested JS BiDi library with clear API
2. **Implementation complexity:** Custom UAX #9 is 300-500 LOC
3. **Testing burden:** 27 edge cases (parentheses, quotes, neutral chars, etc.)
4. **Risk to timeline:** Could delay M1 by a week
5. **Independent feature:** BiDi can be added without touching core layout

### Why Hebrew-Only is Sufficient for M1

**Real-world Torah texts:**
- 95%+ pure Hebrew with nikud/te'amim
- Latin appears in:
  - Transliterations (rare in traditional texts)
  - Academic citations (footnotes only)
- Digits appear in:
  - Chapter/verse references (can be Hebrew gematria: א:א instead of 1:1)
  - Page numbers (handled separately, not in body text)

**M1 goal:** Validate core architecture (shaping → lines → columns → balance → PDF)

**BiDi is additive:** Can be inserted between JSON parsing and shaping without changing pipeline

---

## Migration Path (M1.0 → M1.1)

### Current Architecture (M1.0)
```typescript
JSON → Parse → [Hebrew text] → Shape → Lines → Layout → PDF
```

### Future Architecture (M1.1)
```typescript
JSON → Parse → [Mixed text] → **BiDi Resolve** → Shape (per-run) → Lines → Layout → PDF
                                      ↓
                        [Hebrew RTL] [Latin LTR] [Digits LTR]
```

**Changes required:**
1. Insert BiDi resolution step before shaping
2. Shape each visual run separately
3. Combine shaped runs in visual order
4. **No changes** to line breaking, layout, or PDF rendering

---

## Alternative Considered

### Option: Implement Custom UAX #9

**Pros:**
- Full control
- No dependency
- Educational

**Cons:**
- 300-500 LOC
- Complex algorithm (9 levels of embedding)
- High bug risk
- Maintenance burden

**Verdict:** Not worth it for M1. If M1.1 reveals no good library, revisit.

---

## Test Strategy

### M1.0 Tests (Hebrew-only)
```typescript
it('shapes Hebrew paragraph', () => {
  const text = 'בראשית ברא אלהים את השמים ואת הארץ';
  const shaped = shapeText(text, font, 12);
  expect(shaped.glyphs.length).toBeGreaterThan(text.length); // nikud = extra glyphs
});

it('breaks Hebrew paragraph into lines', () => {
  const lines = breakLines(shaped, { targetWidth: 300 * 1000 });
  expect(lines.length).toBeGreaterThan(1);
});
```

### M1.1 Tests (BiDi)
```typescript
it('handles Hebrew + digits (בראשית 1:1)', () => {
  const text = 'בראשית 1:1';
  const resolved = resolveBidi(text, 'RTL');
  expect(resolved.runs).toHaveLength(2);
  expect(resolved.runs[0]).toMatchObject({ text: 'בראשית', dir: 'RTL' });
  expect(resolved.runs[1]).toMatchObject({ text: '1:1', dir: 'LTR' });
});
```

---

## Acceptance Criteria

### M1.0 (Hebrew-only) ✅
- [ ] Parses JSON with Hebrew text
- [ ] Shapes Hebrew with nikud/te'amim
- [ ] Breaks lines greedily
- [ ] Fills two columns with balance
- [ ] Renders PDF from LayoutResult
- [ ] All tests passing (Hebrew-only corpus)

### M1.1 (BiDi) ⏳
- [ ] BiDi library integrated or custom UAX #9 implemented
- [ ] 27 BiDi test scenarios passing
- [ ] Handles Hebrew + Latin + Digits in single line
- [ ] Parentheses/brackets mirroring in RTL
- [ ] Same PDF rendering (no changes to core)

---

## Risk Mitigation

**Risk:** Hebrew-only corpus not representative of real usage

**Mitigation:**
- Survey actual Torah texts: confirm 95%+ Hebrew-only
- If BiDi critical, escalate to M1.1 immediately after M1.0
- Budget 1 week for M1.1 (BiDi addition)

**Risk:** BiDi integration breaks core pipeline

**Mitigation:**
- BiDi is inserted BEFORE shaping, not inside it
- Shaping/layout/rendering unchanged
- Feature flag to toggle BiDi on/off during testing

---

## References

**Attempted libraries:**
- `bidi-js` (API mismatch)
- `unicode-bidirectional` (too low-level)

**Alternatives to explore in M1.1:**
- `fribidi-js` (FriBidi port)
- Custom UAX #9 implementation (if no library works)
- HarfBuzz's internal BiDi (if exposed)

**Test suite ready:** `tests/unit/bidi/bidi.test.ts` (27 scenarios documented)

---

**Status:** M1.0 proceeds Hebrew-only, M1.1 adds BiDi

**Updated:** 2026-10-13
