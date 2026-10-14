# ADR-007: איזון טורים לפי מקטע

**תאריך:** 2026-10-14  
**סטטוס:** מוצע (ממתין לאישור)  
**החלטה:** מימוש איזון טורים ברמת המקטע עם סולם התאמות ומנגנון אבחון

---

## הקשר

### מצב נוכחי (M1.0-M1.1)

הפונקציה `layoutTwoColumnsBalanced` מבצעת איזון של שורות בין שני טורים בעמוד בודד:
- מקבלת מערך שורות (`ShapedWord[][]`) ללא מידע על פסקאות או מקטעים
- מחפשת נקודת חלוקה (split point) שממזערת את ההפרש בגובה בין הטורים
- מחזירה `balanceInfo` עם מדדי איכות: `bottomDelta`, `isBalanced`, `quality`
- מופעלת לכל עמוד לפי `pagePolicy='balanced'`
- אין מידע על גבולות פסקאות, שורות אחרונות, או אפשרויות שבירה חלופיות

**בעיות:**
1. **הפרת גבולות פסקאות:** חלוקת השורות יכולה לחתוך פסקה באמצע, בלי להתחשב בשורות אחרונות ממורכזות או בכללי widows/orphans
2. **אין אלטרנטיבות:** אם החלוקה הנוכחית לא מאוזנת, אין דרך לשבור מחדש פסקה עם ריווח שונה או להזיז שורות בין עמודים
3. **איזון מקומי בלבד:** כל עמוד מאוזן בנפרד, בלי מבט קדימה על המקטע כולו

### דרישות מוצר

לפי סעיף 7 בספק:
- **אילוץ קשיח:** בכל עמוד דו-טורי, שני הטורים **חייבים** להסתיים באותו גובה, גם בעמוד האחרון של המקטע
- **סולם התאמות:** ניסיונות מדורגים להשגת איזון (חלוקה אחרת → שבירה חלופית → ריווח בין פסקאות → הזזת שורות בין עמודים → אבחון error)
- **טווח חיפוש:** עד 5 עמודים קדימה, מבט אחורה של עמוד אחד
- **מקטע:** יחידת העימוד היא מקטע (section ב-Word), והאיזון מבוצע בתוך המקטע בלבד

---

## החלטה

### שלב 1: הרחבת מודל הנתונים

**הוספת מבנה `Paragraph`:**
```typescript
interface Paragraph {
  id: string;                    // מזהה יציב
  lines: ShapedWord[][];         // שורות כפי שנשברו בניסיון הנוכחי
  style: ParagraphStyle;         // סגנון: lastLine, widows, orphans
  alternativeBreaks?: LineBreakAlternative[]; // אפשרויות שבירה חלופיות
}

interface LineBreakAlternative {
  lines: ShapedWord[][];         // שורות מחולקות בצורה שונה
  wordSpacing: number;           // ריווח המילים ששימש
  quality: number;               // 0-1, איכות השבירה (ע״פ Knuth-Plass)
  penaltyInfo?: {                // מידע על עונשים
    rivers?: number;             // נהרות
    tightLines?: number;         // שורות צפופות
    looseLines?: number;         // שורות רפויות
  };
}
```

**הוספת מבנה `Section`:**
```typescript
interface Section {
  id: string;                    // מזהה המקטע
  kind: 'front' | 'body' | 'back'; // סוג המקטע
  paragraphs: Paragraph[];       // הפסקאות במקטע
  balancePolicy: 'fill' | 'balanced'; // מדיניות עימוד למקטע זה
}
```

**שינוי ב-API:**
- במקום `layoutTwoColumns(lines: ShapedWord[][])`
- → `layoutSection(section: Section, config: LayoutConfig): SectionLayout`

### שלב 2: אלגוריתם איזון מקטעים

```
פונקציה: layoutSection(section, config)

1. יצירת עמודים ראשונית (fill mode):
   - מילוי עמודים כרגיל עד תום המקטע
   - שמירת מפת פסקה→עמוד לכל פסקה

2. זיהוי עמודים לא מאוזנים:
   - עמוד אחרון של מקטע חייב איזון
   - עמודים אחרים: לפי balancePolicy

3. לכל עמוד לא מאוזן, סולם ההתאמות:
   
   א. חלוקה אחרת (טווח: ±3 שורות מנקודת החלוקה הנוכחית)
      - אם מצליח: סיום
   
   ב. שבירה חלופית של פסקאות באותו העמוד:
      - עבור כל פסקה בעמוד שיש לה alternativeBreaks
      - בחר חלופה עם מספר שורות שונה (±1 או ±2)
      - ריווח בטווח המותר (85%-140% מהריווח הטבעי)
      - אם מצליח: עדכן את הפסקה וסיום
   
   ג. ריווח בין פסקאות (interparagraphSpacing):
      - הוסף מרווח בכפולות של lineHeight (0, L, 2L)
      - עד פי 2 מברירת המחדל
      - אם מצליח: סיום
   
   ד. הזזת שורות בין עמודים (טווח: 1 עמוד אחורה, 5 קדימה):
      - העבר את הפסקה האחרונה של העמוד הנוכחי לעמוד הבא
      - או: משוך את הפסקה הראשונה של העמוד הבא לעמוד הנוכחי
      - הגבלה: לא לשבור פסקה באמצע (כל הפסקה עוברת)
      - אם מצליח: עדכן עמודים ו-goto שלב 3 (בדוק עמוד חדש)
   
   ה. כשלון:
      - צור Diagnostic ברמת error
      - קוד: SECTION_BALANCE_FAILED
      - מידע: sectionId, pageNumber, bottomDelta
      - המשך לעמוד הבא (לא "לאזן בכוח")

4. החזרת SectionLayout:
   - pages: PageLayout[]
   - diagnostics: Diagnostic[]
   - balanceInfo per page
```

### שלב 3: מבנה Diagnostic

```typescript
interface Diagnostic {
  level: 'error' | 'warning' | 'info';
  code: string;                  // קוד יציב לפילטור/waiver
  sectionId?: string;            // מקטע רלוונטי
  pageNumber?: number;           // עמוד רלוונטי (1-indexed)
  message: string;               // תיאור קצר בעברית
  details?: Record<string, unknown>; // נתונים נוספים
}

// דוגמאות לקודים:
// - SECTION_BALANCE_FAILED: לא הצליח לאזן עמוד אחרון של מקטע
// - PARAGRAPH_SPACING_EXCEEDED: ריווח בין פסקאות חרג מהמקסימום
// - ALTERNATIVE_BREAK_USED: נעשה שימוש בשבירה חלופית (info)
// - LINES_MOVED_BETWEEN_PAGES: שורות הוזזו בין עמודים (info)
```

**שילוב ב-LayoutResult:**
```typescript
interface LayoutResult {
  pages: PageLayout[];
  pageCount: number;
  config: LayoutConfig;
  diagnostics: Diagnostic[];     // רשימת כל האבחונים
}
```

### שלב 4: הטמעת שבירה חלופית

שבירת השורות (`breakLines`) תחזיר לא רק את השבירה הטובה ביותר אלא גם 2-3 חלופות:
- חלופה עם ריווח רחב יותר (fewer lines, looser spacing)
- חלופה עם ריווח צר יותר (more lines, tighter spacing)
- כל חלופה כוללת מידע על איכות ועונשים

זה מאפשר לאלגוריתם האיזון לבחור שבירה שונה בלי לחשב מחדש את כל הפסקה.

---

## מודל נתונים מוצע - סיכום שינויי API

### לפני (M1.1):
```typescript
layoutDocument(
  shapedWords: ShapedWord[],
  config: LayoutConfig
): LayoutResult
```

### אחרי (M2 - section balancing):
```typescript
// שלב 1: שבירת שורות (ברמת פסקה)
breakParagraph(
  words: ShapedWord[],
  options: LineBreakOptions
): ParagraphBreakResult {
  primary: ShapedWord[][];
  alternatives: LineBreakAlternative[];
}

// שלב 2: עימוד מקטע
layoutSection(
  section: Section,
  config: LayoutConfig
): SectionLayout {
  pages: PageLayout[];
  diagnostics: Diagnostic[];
}

// שלב 3: עימוד מסמך (מרכיב מקטעים)
layoutDocument(
  sections: Section[],
  config: LayoutConfig
): LayoutResult {
  pages: PageLayout[];
  pageCount: number;
  config: LayoutConfig;
  diagnostics: Diagnostic[];
}
```

**מעבר הדרגתי:**
1. M1.1: API הנוכחי נשמר (backward compatible)
2. M2: API חדש מתווסף, הישן deprecated
3. M3: API הישן מוסר

---

## אלגוריתם מפורט - סולם התאמות

### שלב א': חלוקה אחרת של השורות

```
עבור כל offset ב-range(-3, +4):
  splitPoint = currentSplit + offset
  אם splitPoint חוקי:
    rightLines = lines[0:splitPoint]
    leftLines = lines[splitPoint:]
    rightHeight = len(rightLines) * lineHeight
    leftHeight = len(leftLines) * lineHeight
    delta = abs(rightHeight - leftHeight)
    
    אם delta <= balanceTolerance:
      החזר פתרון
```

### שלב ב': שבירה חלופית

```
עבור כל paragraph ב-currentPage:
  אם יש לפסקה alternatives:
    עבור כל alt ב-alternatives:
      newLineCount = len(alt.lines)
      deltaLines = newLineCount - len(paragraph.lines)
      
      אם deltaLines מסייע לאיזון (מקטין את bottomDelta):
        נסה את החלופה:
          החלף paragraph.lines ב-alt.lines
          חשב מחדש את page layout
          אם balanced: החזר פתרון
```

### שלב ג': ריווח בין פסקאות

```
maxSpacingMultiple = 2.0
defaultSpacing = config.paragraphSpacing  // ברירת מחדל: L (lineHeight)

עבור multiplier ב-[0, 1, 2]:
  extraSpacing = multiplier * defaultSpacing
  אם extraSpacing <= maxSpacingMultiple * defaultSpacing:
    הוסף extraSpacing בין פסקאות בעמוד
    חשב מחדש heights
    אם balanced: החזר פתרון
```

### שלב ד': הזזת שורות בין עמודים

```
lookBack = 1 עמוד
lookAhead = 5 עמודים

// ניסיון 1: משוך פסקה מהעמוד הבא
אם currentPage < lastPage:
  firstParagraphOfNext = pages[currentPage + 1].firstParagraph
  נסה להזיז את firstParagraphOfNext לסוף currentPage
  אם נכנס ו-balanced: החזר פתרון

// ניסיון 2: דחוף פסקה לעמוד הבא
lastParagraphOfCurrent = currentPage.lastParagraph
נסה להזיז את lastParagraphOfCurrent לתחילת pages[currentPage + 1]
אם balanced בשני העמודים: החזר פתרון
```

---

## בדיקות מוצעות

### יחידה (unit):

1. **Section creation:**
   - `should create section with paragraphs`
   - `should preserve paragraph IDs`

2. **Paragraph breaking with alternatives:**
   - `should generate primary break and 2-3 alternatives`
   - `should maintain quality scores for alternatives`
   - `should respect wordSpacing range (85%-140%)`

3. **Balance with different split:**
   - `should find balanced split within search range`
   - `should prefer split with smaller delta`

4. **Balance with alternative break:**
   - `should use alternative with fewer lines to balance`
   - `should use alternative with more lines to balance`
   - `should not use alternative if quality too low`

5. **Balance with paragraph spacing:**
   - `should add 0, L, or 2L spacing between paragraphs`
   - `should not exceed 2x default spacing`

6. **Balance with line movement:**
   - `should move last paragraph to next page`
   - `should pull first paragraph from next page`
   - `should respect look-ahead limit (5 pages)`

7. **Diagnostic generation:**
   - `should create error diagnostic when balance fails`
   - `should include section ID and page number`
   - `should create info diagnostic when alternative used`

### אינטגרציה (integration):

1. **Multi-page section:**
   - `should balance last page of section`
   - `should not balance middle pages in fill mode`
   - `should balance all pages in balanced mode`

2. **Multi-section document:**
   - `should balance each section independently`
   - `should not move lines between sections`

3. **Edge cases:**
   - `should handle section with single paragraph`
   - `should handle section shorter than one page`
   - `should handle very long section (>10 pages)`

### מקרי קצה (edge cases):

1. **Paragraph at page boundary:**
   - פסקה שמתחילה בעמוד אחד ומסתיימת באחר
   - וידוא שלא נשברת באמצע בשלב ההזזה

2. **Last line centered:**
   - פסקה עם `lastLine: 'center'`
   - וידוא שהשורה האחרונה נשארת ממורכזת גם אחרי איזון

3. **Widows and orphans:**
   - פסקה עם `widows: 2, orphans: 2`
   - וידוא שהאיזון לא מפר את הכללים

4. **Keep with next:**
   - כותרת עם `keepWithNext: true`
   - וידוא שלא מופרדת מהפסקה הבאה

5. **No alternatives available:**
   - פסקה שיש לה רק שבירה אחת (מילה אחת, או ריווח בקצה הטווח)
   - וידוא שהאלגוריתם עובר לשלב הבא

6. **Balance tolerance = 0:**
   - `balanceTolerance: 0` (איזון מושלם נדרש)
   - וידוא שלא חוזר אינסוף loop ולא division by zero

---

## שאלות פתוחות (דורשות החלטה)

### 1. מה קורה כאשר אין חלופות שבירה?

**תרחיש:** פסקה קצרה (3 שורות) שאין לה אלטרנטיבות (כל הריווחים כבר בקצה הטווח).

**אפשרויות:**
- **A:** דלג על שלב ב' והמשך לשלב ג' (ריווח בין פסקאות)
- **B:** צור חלופה מלאכותית עם ריווח מחוץ לטווח (עם עונש)
- **C:** סמן את הפסקה כ-"unbrakeable" וטפל בה בנפרד

**המלצה שלי:** A (פשוט יותר, עונש יטופל בשלבים הבאים)

### 2. האם להתיר שבירת פסקה באמצע בשלב ד'?

**תרחיש:** פסקה ארוכה (20 שורות) שמשתרעת על פני שני עמודים.

**אפשרויות:**
- **A:** לא לשבור - רק פסקאות שלמות עוברות בין עמודים
- **B:** לאפשר שבירה - העבר חלק מהפסקה (5 שורות אחרונות למשל)
- **C:** תלוי בסגנון הפסקה (אפשרות `allowMidPageBreak`)

**המלצה שלי:** A בשלב ראשון, B כשדרוג עתידי

### 3. כיצד לטפל בהערות שוליים באיזון?

**תרחיש:** עמוד עם הערת שוליים שתופסת מקום בתחתית.

**אפשרויות:**
- **A:** התעלם מההערות באיזון - רק הגוף מאוזן
- **B:** קח בחשבון גובה ההערות - האיזון מתייחס לחלל כולו
- **C:** אזן את הגוף והערות בנפרד

**המלצה שלי:** A בשלב ראשון (הערות בתחתית לא משפיעות על האיזון החזותי של הטורים)

### 4. מה עדיפות השאלות שנשאלו למעלה?

כאשר מספר התאמות אפשריות, איך לבחור?

**אפשרויות:**
- **A:** עדיפות קבועה (חלוקה → שבירה → ריווח → הזזה)
- **B:** פונקציית עלות משוקללת (כל פתרון מקבל ציון, ובוחרים המינימום)
- **C:** תלוי במדיניות המסמך (הגדרה `balanceStrategy`)

**המלצה שלי:** A בשלב ראשון (פשוט יותר), B כשדרוג עתידי

### 5. האם לתמוך בעמודים עם יותר משני טורים?

**תרחיש:** `columnCount: 3` (שלושה טורים).

**אפשרויות:**
- **A:** רק 2 טורים נתמכים בשלב זה
- **B:** תמיכה כללית ב-N טורים מיום ראשון
- **C:** הכן את המבנה ל-N אבל מימוש רק עבור 2

**המלצה שלי:** C (האלגוריתם מוכלל, אבל בדיקות רק ל-2)

### 6. מהו גובה החלון (window) בפתיחה מודגשת?

לפי סעיף 6 בספק: "גובה החלון בשורות עדיין פתוח".

**אפשרויות:**
- **A:** מספר קבוע (2-3 שורות)
- **B:** מחושב לפי רוחב המילה המודגשת
- **C:** נקבע בסגנון הפסקה (`opening.windowLines`)

**המלצה שלי:** C (גמישות מקסימלית, ברירת מחדל 2)

### 7. איך מטפלים בעמוד ריק שנוצר כתוצאה מאיזון?

**תרחיש:** הזזת פסקאות בין עמודים יכולה להשאיר עמוד ריק באמצע המקטע.

**אפשרויות:**
- **A:** אסור - אל תאפשר התאמה שיוצרת עמוד ריק
- **B:** מותר - הסר את העמוד הריק אוטומטית
- **C:** הוסף אבחון warning ותן למשתמש להחליט

**המלצה שלי:** A (עמוד ריק באמצע מקטע הוא באג, לא פיצ'ר)

---

## הערות מימוש

### ביצועים

- **מורכבות זמן:** O(P × A × S) כאשר P = מספר עמודים במקטע, A = מספר חלו, S = גודל טווח החיפוש
- **אופטימיזציה:** cache של page layouts, עצירה מוקדמת כאשר נמצא פתרון מושלם (delta=0)

### דטרמיניזם

- חייב לשמור על דטרמיניזם: אותו קלט → אותו פלט
- סדר הבדיקה של החלופות חייב להיות יציב (לא תלוי ב-hash או ב-timing)
- אין randomization או heuristics לא דטרמיניסטיות

### תאימות לאחור

- API הקיים (`layoutDocument(words, config)`) ממשיך לעבוד
- מימוש פנימי: העטפה שיוצרת Section אחד עם Paragraph אחד
- דגל `config.useLegacyBalancing = true` כדי לכבות את האיזון המקטעי

---

## אסטרטגיית מימוש

### שלב 1: תשתית (לא משנה התנהגות)
1. הוסף `Paragraph` ו-`Section` types
2. שנה `breakLines` להחזיר `ParagraphBreakResult` עם alternatives
3. הוסף `Diagnostic` type ו-`diagnostics[]` ל-`LayoutResult`
4. כל הבדיקות הקיימות עוברות

### שלב 2: איזון בסיסי (רק חלוקה אחרת)
1. מימוש `layoutSection` פשוט (fill mode + balance last page)
2. שלב א' של הסולם (חלוקה אחרת)
3. בדיקות עבור איזון פשוט

### שלב 3: שבירה חלופית
1. שלב ב' של הסולם
2. בדיקות עבור alternatives

### שלב 4: ריווח והזזה
1. שלבים ג' ו-ד' של הסולם
2. בדיקות מקיפות
3. בדיקות edge cases

### שלב 5: אבחון ותיעוד
1. מנגנון waiver (ידני או אוטומטי)
2. תיעוד מלא של diagnostics
3. דוגמאות שימוש

---

## הפניות

- **SPEC.md:** סעיף 7 (מילוי עמודים), סעיף 6 (פתיחה וחלון)
- **ADR-001:** TypeScript - דטרמיניזם ומספרים שלמים
- **ADR-005:** BiDi - כיצד מטופלות שורות מעורבות

---

**סטטוס:** ממתין לאישור לפני שלב 2 (מימוש)

**עדכון אחרון:** 2026-10-14
