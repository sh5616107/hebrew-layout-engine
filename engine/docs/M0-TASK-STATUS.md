# M0 Task Status

## Checklist Progress

### ✅ Task 1: Git Remote/Branch/Log Verification
**Status:** COMPLETED

- Root repo (POC): `master` branch, 15 commits
- Engine repo: `main` branch, 5 commits
- **Issue identified:** Both repos point to same GitHub URL
  - Root: `https://github.com/sh5616107/hebrew-layout-engine.git` (master)
  - Engine: `https://github.com/sh5616107/hebrew-layout-engine.git` (main)
- **Resolution:** Needs decision - separate repo or monorepo structure

### ✅ Task 2: Fix Failing Tests
**Status:** COMPLETED

- Initial: 30 tests passing
- Fixed: HarfBuzz v1 API (removed `.destroy()` calls)
- Current: **33/33 tests passing**
- Coverage: 76% overall (core 99.6%, typography 0%)
- **Note:** No tests were deleted; 3 tests were added

### ✅ Task 3: ADR Status Update
**Status:** COMPLETED

- ADR-001: TypeScript → **Proposed**
- ADR-002: HarfBuzz → **Proposed**
- ADR-003: Ezra SIL → **Proposed**
- ADR-004: Rendering Strategy → **Proposed**

### ⚠️ Task 4: Align Types to Spec 0.5
**Status:** PARTIALLY COMPLETED

**Completed:**
- ✅ `PagePolicy` and `PagePolicyId` added to config.ts (7 policies)
- ✅ `status: 'valid' | 'valid_with_warnings' | 'invalid'` in LayoutResult
- ✅ `DiagnosticCode` enum with 11 codes
- ✅ `CostWeights` marked as **TEMPORARY placeholders** (need calibration)
- ✅ `BalanceInfo` added to PageLayout
- ✅ `DecisionTrace` added for tracing
- ✅ `WaiverRecord` added for approved exceptions

**Pending:**
- ⏳ **Spec Section 25 does NOT EXIST** - spec ends at section 18
- ⏳ Assumed reference is **Section 16 ("Milestones")** which describes M1
- ⏳ M1-PLAN.md already matches Section 16.1 ("vertical slice")

### ✅ Task 5: Measure Shaping 40K Words with Reuse
**Status:** COMPLETED

**Results:**
- **Median time:** 1,392.54ms (5 runs)
- **Throughput:** 28,725 words/sec
- **Per-word:** 0.035ms
- **Hardware:**
  - CPU: Intel Core i5-1240P (12th Gen, 12 cores)
  - RAM: 7,877 MB
  - Model: ASUS Vivobook X1402ZA
  - OS: Windows 11
- **Method:** 
  - Blob, Face, Font created once
  - Buffer reused with `clearContents()`
  - Real Hebrew corpus (20 unique words × 2000 iterations)

### ⚠️ Task 6: POC Rendering Comparison
**Status:** PARTIALLY COMPLETED

**Width Comparison (HarfBuzz vs PDFKit):**
- ✅ Test created: `tools/compare-word-widths.ts`
- ✅ **70% perfect matches** (Δ < 0.01pt)
- ✅ **13% large deltas** (Δ > 1%)
- ✅ Average delta: **0.103pt (0.34%)**
- ✅ Maximum delta: **1.465pt (5.91%)** on "וַיַּ֧רְא" (te'amim)
- ❌ **Conclusion:** PDFKit.doc.text() **NOT SUFFICIENT** - need word/glyph-level drawing

**Y-Offset Verification:**
- ✅ Test created: `tools/check-y-offsets.ts`
- ✅ PDF generated: `out/y-offset-check.pdf`
- ✅ Script=Hebr, Language=heb, Direction=RTL confirmed
- ✅ **No Y-offsets found** - Ezra SIL uses **X-offsets only** (valid strategy)
- ✅ X-offsets range: 100-1000 font units
- ⏳ **Visual inspection needed** - PDF contains:
  - Plain text (no marks)
  - Nikud above (segol)
  - Nikud below (shva)
  - Te'amim above (etnachta)
  - Te'amim below (merkha)
  - Complex text (Gen 1:1)

**ADR-004 Update Needed:**
- Current: "PDFKit.doc.text() sufficient for M0-M1"
- **Revised conclusion:** Need word-level or glyph-level positioning
- **Reason:** Up to 5.91% deviation in words with te'amim
- **Recommendation:** 
  - M0-M1: Use PDFKit with awareness of limitations
  - M2+: Implement direct glyph drawing or fork PDFKit

### ⏳ Task 7: Redefine M1 per Section 25
**Status:** BLOCKED

**Issue:** **Section 25 does not exist** in specification v0.5 (SPEC.md)
- Specification ends at Section 18
- Likely reference: **Section 16 ("אבני דרך" / Milestones)**
- Section 16.1 describes M1: "vertical slice" with import, shaping, 2 columns, 1 footnote, PDF

**Current M1-PLAN.md:**
- ✅ Already matches Section 16.1 requirements
- ✅ Components: JSON→Document, HarfBuzz shaping, 2 columns, 1 footnote, PDF output
- ✅ Duration: 10 days
- ✅ Verification: end-to-end test

**Awaiting clarification:** Which section should M1 follow?

---

## M0 Completion Status

### Criteria Met
- ✅ TypeScript project with strict tsconfig
- ✅ Core types (Document→LayoutResult)
- ✅ mpt unit system with validation
- ✅ Engine config with page policies and cost weights
- ✅ HarfBuzz v1.6.3 integration verified
- ✅ Ezra SIL v2.51 font downloaded and tested
- ✅ PDFKit integration working
- ✅ 33/33 tests passing (76% coverage)
- ✅ Performance: 28,725 words/sec median
- ✅ Rendering POC completed with findings
- ✅ ADRs 001-004 written (all Proposed)
- ✅ M1 plan written (matches spec section 16.1)
- ✅ 5 commits pushed to GitHub

### Blockers / Issues
1. **Repository structure:** Both root and engine/ point to same GitHub URL
   - **Decision needed:** Separate repos or monorepo
2. **Spec section 25:** Does not exist - assumed reference is section 16
   - **Needs clarification:** Confirm M1 scope
3. **Visual verification:** `out/y-offset-check.pdf` needs visual inspection
4. **ADR-004:** Needs update based on width comparison results

### Ready for M1
- ⏳ **Awaiting:** 
  1. Repo structure decision
  2. M1 scope confirmation (if not section 16)
  3. Visual approval of nikud/te'amim positioning

---

## Next Steps (Post-M0)
1. Resolve repo structure (task 5)
2. Update ADR-004 with rendering strategy revision
3. Visual inspection of `out/y-offset-check.pdf`
4. Get approval to start M1 implementation
