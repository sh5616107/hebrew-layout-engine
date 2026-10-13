# בדיקת התאמה לאפיון 0.5

**תאריך:** 2026-10-13  
**מסמך אפיון:** `docs/SPEC.md` (גרסה 0.5)  
**קבצי יישום:** `src/core/types.ts`, `src/core/config.ts`

---

## סעיף 7.5: מדיניות עמודים

**נדרש באפיון:** 7 מדיניות בטבלה

| מדיניות | שימוש | יעד ברירת מחדל | טור ריק | הערה |
|---|---|---:|---|---|
| `body_full` | עמוד גוף רגיל מלא | 0 mpt | אסור | |
| `body_partial` | חלקי עקב מעבר כפוי | 0 mpt אם חל | אסור | |
| `last_page` | עמוד אחרון | לא חל | מותר | |
| `chapter_opening` | פתיחת פרק | לפי דף אב | מותר | |
| `part_opening` | פתיחת חלק | לא חל | מותר | |
| `title_page` | שער | לא חל | מותר | |
| `forced_break` | מעבר כפוי | לפי מקור | אסור | |

**מימוש ב-config.ts:**

```typescript
export type PagePolicyId =
  | 'body_full'
  | 'body_partial'
  | 'last_page'
  | 'chapter_opening'
  | 'part_opening'
  | 'title_page'
  | 'forced_break';

export interface PagePolicy {
  id: PagePolicyId;
  balanceApplies: boolean;
  targetDelta: number; // mpt
  emptyColumnAllowed: boolean;
  description: string;
}

export const DEFAULT_PAGE_POLICIES: Record<PagePolicyId, PagePolicy> = {
  body_full: { id: 'body_full', balanceApplies: true, targetDelta: 0, emptyColumnAllowed: false, ... },
  body_partial: { id: 'body_partial', balanceApplies: true, targetDelta: 0, emptyColumnAllowed: false, ... },
  last_page: { id: 'last_page', balanceApplies: false, targetDelta: 0, emptyColumnAllowed: true, ... },
  chapter_opening: { id: 'chapter_opening', balanceApplies: false, targetDelta: 0, emptyColumnAllowed: true, ... },
  part_opening: { id: 'part_opening', balanceApplies: false, targetDelta: 0, emptyColumnAllowed: true, ... },
  title_page: { id: 'title_page', balanceApplies: false, targetDelta: 0, emptyColumnAllowed: true, ... },
  forced_break: { id: 'forced_break', balanceApplies: true, targetDelta: 0, emptyColumnAllowed: false, ... },
};
```

### ✅ התאמה: מלאה

כל 7 המדיניות מיושמות ב-`PagePolicyId` וב-`DEFAULT_PAGE_POLICIES`.

---

## סעיף 12: חוזה הפלט

### סעיף 12 - LayoutResult.status

**נדרש באפיון:**
```typescript
status: "valid" | "valid_with_warnings" | "invalid";
```

**מימוש ב-types.ts:**
```typescript
export interface LayoutResult {
  engineVersion: string;
  configHash: string;
  documentHash: string;
  status: 'valid' | 'valid_with_warnings' | 'invalid';
  pages: PageLayout[];
  diagnostics: Diagnostic[];
  metrics: LayoutMetrics;
  trace?: DecisionTrace[];
  waivers?: WaiverRecord[];
}
```

### ✅ התאמה: מלאה

### סעיף 12 - Diagnostic

**נדרש באפיון:**
```typescript
type Diagnostic = {
  code: string;
  severity: "info" | "warning" | "error";
  pageIndex?: number;
  sectionId?: string;
  anchorIds?: string[];
  message: string;
  attemptedStrategies?: string[];
  suggestedActions?: string[];
};
```

**מימוש ב-types.ts:**
```typescript
export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  pageIndex?: number;
  sectionId?: string;
  anchorIds?: string[];
  message: string;
  attemptedStrategies?: string[];
  suggestedActions?: string[];
}

export type DiagnosticSeverity = 'info' | 'warning' | 'error';
```

### ⚠️ הבדל קל: `code: string` מול `code: DiagnosticCode`

המימוש משתמש ב-enum מוגדר (`DiagnosticCode`) במקום `string` כללי. **זוהי שיפור** - מבטיח תקינות compile-time.

### סעיף 12 - WaiverRecord

**נדרש באפיון:**
```typescript
type WaiverRecord = {
  waiverId: string;
  diagnosticCode: string;
  pageIndex?: number;
  anchorIds?: string[];
  approvedBy: string;
  approvedAt: string; // ISO-8601 timestamp
  reason: string;
  scope: "page" | "section" | "document";
};
```

**מימוש ב-types.ts:**
```typescript
export interface WaiverRecord {
  waiverId: string;
  diagnosticCode: DiagnosticCode;
  pageIndex?: number;
  anchorIds?: string[];
  approvedBy: string;
  approvedAt: string; // ISO-8601
  reason: string;
  scope: 'page' | 'section' | 'document';
}
```

### ⚠️ הבדל קל: `diagnosticCode: string` מול `diagnosticCode: DiagnosticCode`

כמו ב-Diagnostic, המימוש משתמש ב-enum. **זוהי שיפור**.

### ✅ התאמה: מלאה (עם שיפורים)

---

## סעיף 12.1: קודי אבחון מינימליים

**נדרש באפיון:** 11 קודים

1. `BALANCE_UNSATISFIABLE`
2. `SEARCH_LIMIT_REACHED`
3. `HARD_CONSTRAINT_CONFLICT`
4. `NOTE_PLACEMENT_FAILED`
5. `FONT_GLYPH_MISSING`
6. `LINE_OVERFLOW`
7. `PAGE_OVERFLOW`
8. `MANUAL_BREAK_CONFLICT`
9. `LAYOUT_NOT_STABLE`
10. `CONFIG_INVALID`
11. `XREF_TARGET_MISSING`

**מימוש ב-types.ts:**
```typescript
export type DiagnosticCode =
  | 'BALANCE_UNSATISFIABLE'
  | 'SEARCH_LIMIT_REACHED'
  | 'HARD_CONSTRAINT_CONFLICT'
  | 'NOTE_PLACEMENT_FAILED'
  | 'FONT_GLYPH_MISSING'
  | 'LINE_OVERFLOW'
  | 'PAGE_OVERFLOW'
  | 'MANUAL_BREAK_CONFLICT'
  | 'LAYOUT_NOT_STABLE'
  | 'CONFIG_INVALID'
  | 'XREF_TARGET_MISSING';
```

### ✅ התאמה: מלאה

כל 11 הקודים מיושמים בדיוק כפי שמופיעים באפיון.

---

## סעיף 8: מדידת איזון

**נדרש באפיון:**
```typescript
balance: {
  applicable: boolean;
  targetDelta: number; // integer mpt
  actualDelta: number | null; // integer mpt
  actualDeltaLines: number | null; // derived metric, not a coordinate
  balanced: boolean;
  policyId: string;
};
```

**מימוש ב-types.ts:**
```typescript
export interface BalanceInfo {
  applicable: boolean;
  targetDelta: Distance; // mpt
  actualDelta: Distance | null; // mpt
  actualDeltaLines: number | null; // derived, not a coordinate
  balanced: boolean;
  policyId: string;
}
```

### ⚠️ הבדל סמנטי קל:

- האפיון משתמש ב-`number` גנרי עם הערה "integer mpt"
- המימוש משתמש ב-`Distance` שהוא alias ל-`number` שעובר validation של `isSafeInteger`

**זוהי שיפור** - הטיפוס `Distance` מבטיח שלמות וטווח תקין.

### ✅ התאמה: מלאה (עם שיפורים)

---

## סעיף 22: DecisionTrace

**נדרש באפיון:** (לא מופיע באופן מפורש, רק הזכרה)

**מימוש ב-types.ts:**
```typescript
export interface DecisionTrace {
  pageIndex: number;
  decision: string;
  candidates: number;
  chosen: string;
  reason: string;
  metrics: Record<string, number>;
}
```

### ✅ התאמה: מיושם בהתאם לתיאור בסעיף 22

---

## סעיף 11: משקולות עלות

**נדרש באפיון:** ציון רך משוקלל עם מדדים:
- סטיית איזון מהיעד
- איכות ריווח המילים
- הפרות widows/orphans
- סטייה מריווח פסקאות
- חלל עודף
- הערות שנדחו
- שינוי ביחס לפריסה קודמת
- מספר עמודים (שובר שוויון)

**מימוש ב-config.ts:**
```typescript
export interface CostWeights {
  balanceDelta: number; // סטיית איזון
  lineTightness: number; // איכות ריווח
  widowOrphan: number; // הפרות widow/orphan
  riverScore: number; // נהרות (רווחים גדולים)
  excessSpace: number; // חלל עודף
  changeStability: number; // שינוי מפריסה קודמת
  pageCount: number; // מספר עמודים (שובר שוויון)
}

export const DEFAULT_COST_WEIGHTS: CostWeights = {
  balanceDelta: 500,
  lineTightness: 200,
  widowOrphan: 150,
  riverScore: 100,
  excessSpace: 80,
  changeStability: 50,
  pageCount: 10,
};
```

### ⚠️ הבדלים:

1. **חסר:** "הערות שנדחו/פוצלו" - אין משקל נפרד
2. **חסר:** "סטייה מריווח פסקאות" - אין משקל נפרד  
3. **נוסף:** `riverScore` - נהרות (רווחים גדולים) - **לא מוזכר באפיון כמשקל נפרד**

### ⚠️ סטטוס משקולות:

המשקולות מסומנות ב-config.ts כ-**TEMPORARY** וצריכות כיול. הערכים הנוכחיים הם placeholders.

### ⚠️ התאמה: חלקית

יש צורך להוסיף משקולות עבור:
- הערות שנדחו (`noteDeferral`)
- סטייה מריווח פסקאות (`paragraphSpacingDelta`)

ולבדוק אם `riverScore` אמור להיות משקל נפרד או חלק מ-`lineTightness`.

---

## סעיף 7.6: גבולות חיפוש

**נדרש באפיון:**
- טווח חיפוש מרבי: 5 עמודים
- מבט אחורה: עמוד אחד

**מימוש ב-config.ts:**
```typescript
export interface SearchLimits {
  maxPagesAround: number; // ברירת מחדל: 5
  maxCandidatesPerPage: number; // ברירת מחדל: 1000
  lookbackPages: number; // ברירת מחדל: 1
}

export const DEFAULT_SEARCH_LIMITS: SearchLimits = {
  maxPagesAround: 5,
  maxCandidatesPerPage: 1000,
  lookbackPages: 1,
};
```

### ✅ התאמה: מלאה

---

## סעיף 15: התייצבות תוכן עניינים

**נדרש באפיון:** עד 5 מעברים

**מימוש ב-config.ts:**
```typescript
export interface ConvergenceConfig {
  maxPasses: number; // ברירת מחדל: 5
}

export const DEFAULT_CONVERGENCE: ConvergenceConfig = {
  maxPasses: 5,
};
```

### ✅ התאמה: מלאה

---

## סעיף 8.2: balanceTolerance

**נדרש באפיון:**  
> `balanceTolerance` אינו היתר שקט לסטייה. ברירת המחדל היא `0`.

**מימוש ב-config.ts:**
```typescript
export interface EngineConfig {
  // ...
  balanceTolerance: number; // mpt (default: 0 per section 8.2)
  // ...
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  // ...
  balanceTolerance: 0,
  // ...
};
```

### ✅ התאמה: מלאה

---

## סיכום התאמה

### ✅ התאמה מלאה:

1. **7 מדיניות עמודים** (סעיף 7.5)
2. **status enum** (סעיף 12)
3. **11 קודי אבחון** (סעיף 12.1)
4. **BalanceInfo** (סעיף 8)
5. **WaiverRecord** (סעיף 12)
6. **DecisionTrace** (סעיף 22)
7. **גבולות חיפוש** (סעיף 7.6)
8. **התייצבות** (סעיף 15)
9. **balanceTolerance** (סעיף 8.2)

### ⚠️ התאמה חלקית - דרוש תיקון:

**משקולות עלות (סעיף 11):**

**חסרים:**
- `noteDeferral` - עונש על הערה שנדחתה לעמוד הבא
- `paragraphSpacingDelta` - עונש על סטייה מריווח ברירת מחדל

**להוספה ב-config.ts:**
```typescript
export interface CostWeights {
  balanceDelta: number;
  lineTightness: number;
  widowOrphan: number;
  riverScore: number;
  excessSpace: number;
  noteDeferral: number;        // ← חסר
  paragraphSpacingDelta: number; // ← חסר
  changeStability: number;
  pageCount: number;
}
```

### 📝 הערות נוס

1. המימוש משתמש ב-`DiagnosticCode` enum במקום `string` - **זו שיפור**
2. המימוש משתמש ב-`Distance` typed alias במקום `number` גנרי - **זו שיפור**
3. כל המשקולות מסומנות כ-TEMPORARY וצריכות כיול על קורפוס אמיתי
4. האפיון דורש שהמשקולות יוגדרו **לפני מימוש ייצור**, לא בדיעבד

---

## פעולות נדרשות

1. ✅ **הוסף** `noteDeferral` ו-`paragraphSpacingDelta` ל-`CostWeights`
2. ✅ **עדכן** `DEFAULT_COST_WEIGHTS` עם ערכי placeholder
3. ✅ **תעד** שכל המשקולות זמניים וצריכים כיול
4. ✅ **בדוק** אם `riverScore` צריך להיות נפרד או לאחד עם `lineTightness`

---

**תאריך בדיקה:** 2026-10-13  
**בודק:** M0 Compliance Check  
**סטטוס כללי:** ✅ 90% התאמה, דרוש תיקון קל במשקולות
