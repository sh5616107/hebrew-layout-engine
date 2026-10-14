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
4. **עמודים לא מאוזנים במצב fill:** כאשר `pagePolicy='fill'`, טורים עלולים להסתיים בגבהים שונים בגלל ריווח בין פסקאות או אורכי פסקאות שונים

### דרישות מוצר

לפי החלטות מוצר מחייבות:
- **אילוץ קשיח:** בכל עמוד דו-טורי, שני הטורים **חייבים** להסתיים באותו גובה, כולל העמוד האחרון של המקטע
- **סולם התאמות:** ניסיונות מדורגים להשגת איזון (חלוקה אחרת → שבירה חלופית → ריווח בין פסקאות → הזזת שורות בין עמודים → אבחון error)
- **טווח חיפוש:** עד 5 עמודים קדימה, מבט אחורה של עמוד אחד (דטרמיניסטי, ללא הגבלת זמן)
- **מקטע:** יחידת העימוד היא מקטע (section ב-Word), והאיזון מבוצע בתוך המקטע בלבד
- **פיצול פסקאות:** מותר לפצל פסקה בין עמודים (כמו בכל ספר), בתנאים מוגדרים

---

## החלטה

### שלב 1: הרחבת מודל הנתונים

**הוספת מבנה `Paragraph`:**
```typescript
interface Paragraph {
  id: string;                    // מזהה יציב לאבחון ול-waiver
  lines: ShapedWord[][];         // שורות כפי שנשברו בניסיון הנוכחי
  style: ParagraphStyle;         // סגנון: lastLine, widows, orphans, opening
  opening?: {                    // פתיחה מודגשת עם חלון
    wordCount: number;           // מספר מילים בפתיחה
    windowLines: number;         // גובה החלון בשורות (ברירת מחדל: 1)
    windowWidth: number;         // רוחב החלון (רוחב המילה המודגשת, במילי-נקודות)
  };
  alternativeBreaks?: LineBreakAlternative[]; // אפשרויות שבירה חלופיות
  footnoteRefs?: FootnoteRef[];  // הפניות להערות שוליים בפסקה זו
}

interface ParagraphStyle {
  lastLine: 'justify' | 'start' | 'center'; // יישור שורה אחרונה
  widows: number;                // מינימום שורות בתחילת עמוד (ברירת מחדל: 2)
  orphans: number;               // מינימום שורות בסוף עמוד (ברירת מחדל: 2)
  keepWithNext?: boolean;        // צמוד לפסקה הבאה (כותרות)
}

interface LineBreakAlternative {
  lines: ShapedWord[][];         // שורות מחולקות בצורה שונה
  wordSpacingPercent: number;    // אחוז ריווח המילים מהרווח הטבעי (80-130)
  quality: number;               // 0-1, איכות השבירה
  penaltyInfo?: {                // מידע על עונשים
    rivers?: number;             // נהרות
    tightLines?: number;         // שורות צפו90%)
    looseLines?: number;         // שורות רפויות (>115%)
  };
}

interface FootnoteRef {
  footnoteId: string;            // מזהה הערת השוליים
  lineIndex: number;             // אינדקס השורה בפסקה שבה מופיעה ההפניה
}
```

**השפעת החלון על שבירת השורות:**

החלון (window) הוא אזור ריק מתחת לפתיחה המודגשת, ברוחב המילה המודגשת עצמה. הוא ממומש על ידי **קיצור השורות בתחילת הפסקה**:

- השורות הראשונות (עד `windowLines`) מקוצרות ב-`windowWidth`
- זה משפיע על נקודות השבירה והחלוילים נכנסות בשורות הללו
- אם הפסקה קצרה מ-`windowLines + 2` שורות, אין חלון (לא הגיוני מבחינה טיפוגרפית)

**דוגמה:**
```
פסקה רגילה: רוחב שורה = 250pt, 10 שורות
פסקה עם חלון: 
  - שורה 1: רוחב = 250pt - 80pt = 170pt (המילה המודגשת: 80pt)
  - שורות 2-10: רוחב = 250pt (רגיל)
```

זה מוביל ליצירת חלופות שונות בעת שבירת השורות: חלופה עם ריווח רחב יותר עשויה ליצור 11 שורות במקום 10.

**הוספת מבנה `Section`:**
```typescript
interface Section {
  id: string;                    // מזהה המקטע (יציב לאבחון)
  kind: 'front' | 'body' | 'back'; // סוג המקטע
  paragraphs: Paragraph[];       // הפסקאות במקטע
  balancePolicy: 'fill' | 'balanced'; // מדיניות עימוד למקטע זה
  footnotes?: Footnote[];        // הערות שוליים למקטע זה
}

interface Footnote {
  id: string;                    // מזהה ההערה
  blocks: Paragraph[];           // תוכן ההערה (יכול להיות כמה פסקאות)
  numberingStyle: 'digits' | 'asterisks'; // סגנון מספור
}
```

**שינוי ב-API:**
- במקום `layoutTwoColumns(lines: ShapedWord[][])`
- → `layoutSection(section: Section, config: LayoutConfig): SectionLayout`

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
  options: LineBreakOptions & { 
    opening?: ParagraphOpening;  // חלון משפיע על רוחב השורות הראשונות
  }
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

**מעבר מ-M1.1 ל-M2:**

למשתמשים קיימים, ניתן לעטוף את הקריאה הישנה בפונקציה שיוצרת `Section` אחד עם `Paragraph` אחד:

```typescript
// Wrapper פנימי (לא API ציבורי)
function layoutDocumentLegacy(
  shapedWords: ShapedWord[],
  config: LayoutConfig
): LayoutResult {
  const section: Section = {
    id: 'default-section',
    kind: 'body',
    paragraphs: [{
      id: 'default-paragraph',
      lines: breakLines(shapedWords, config),  // שבירה רגילה
      style: { lastLine: 'justify', widows: 2, orphans: 2 },
    }],
    balancePolicy: config.pagePolicy || 'fill',
  };
  
  return layoutDocument([section], config);
}
```

---

## אלגוריתם איזון מקטעים

```
פונקציה: layoutSection(section, config)

1. יצירת עמודים ראשונית (fill mode):
   - מילוי עמודים כרגיל עד תום המקטע
   - שמירת מפת paragraph→page לכל פסקה
   - שמירת מפת footnote→page לכל הערת שוליים

2. זיהוי עמודים שדורשים איזון:
   - עמוד אחרון של מקטע: **חייב איזון** (אילוץ קשיח)
   - עמודים אחרים: תלוי ב-balancePolicy
     * balanced: כל העמודים מאוזנים
     * fill: רק עמוד אחרון מאוזן
   
   - עמודים לא מאוזנים במצב fill: אם delta > lineHeight
     * צור Diagnostic ברמת warning
     * קוד: UNBALANCED_FILL_PAGE
     * לא עוצרים את התהליך

3. לכל עמוד שדורש איזון, סולם ההתאמות:
   
   א. חלוקה אחרת של השורות
      - עבור עמוד אחרון של מקטע: בדוק את **כל** נקודות החלוקה האפשריות
      - עבור עמודים אחרים: טווח הצעה ±5 שורות (לאישור)
      - אם מצליח: סיום
   
   ב. שבירה חלופית של פסקאות באותו העמוד:
      - עבור כל פסקה בעמוד שיש לה alternativeBreaks
      - בחר חלופה עם מספר שורות שונה שמסייע לאיזון
      - ריווח בטווח המותר (ראה פירוט בהמשך)
      - אם מצליח: עדכן את הפסקה וסיום
   
   ג. ריווח בין פסקאות:
      - הוסף מרווח נוסף בכפולות של lineHeight
      - עד **תוספת** של פי 2 מברירת המחדל (לא סך הכול)
      - הוספה לטור הקצר יותר (שמירה על רשת)
      - אם מצליח: סיום
   
   ד. הזזת שורות/פסקאות בין עמודים:
      - טווח: עד 5 עמודים קדימה, עמוד אחד אחורה
      - תומך בפיצול פסקאות (ראה כללים בהמשך)
      - חסם: מקסימום 100 ניסיונות לכל עמוד (דטרמיניסטי)
      - אם מצליח: חזור לשלב 3 ובדוק עמודים מחדש
   
   ה. כשלון:
      - צור Diagnostic ברמת error
      - קוד: SECTION_BALANCE_FAILED
      - מזהה: sectionId + paragraphId + code (לא pageNumber)
      - המשך לעמוד הבא (לא "לאזן בכוח")

4. החזרת SectionLayout:
   - pages: PageLayout[]
   - diagnostics: Diagnostic[]
   - balanceInfo per page
```

---

## אלגוריתם מפורט - סולם התאמות

### שלב א': חלוקה אחרת של השורות

**עמוד אחרון של מקטע (אילוץ קשיח):**
```
totalLines = סה״כ שורות בעמוד
maxLinesPerColumn = floor((pageHeight - topMargin - bottomMargin) / lineHeight)

// בדוק את כל נקודות החלוקה האפשריות
עבור splitPoint מ-0 עד totalLines:
  rightLines = lines[0:splitPoint]
  leftLines = lines[splitPoint:totalLines]
  
  // וודא שלא חורגים מגבול העמוד
  אם len(rightLines) <= maxLinesPerColumn AND len(leftLines) <= maxLinesPerColumn:
    delta = abs(len(rightLines) - len(leftLines)) * lineHeight
    
    אם delta <= balanceTolerance:
      החזר פתרון עם splitPoint
```

**עמודים אחרים (balanced mode):**
```
// הצעה לאישור: טווח ±5 שורות
searchRange = 5
currentSplit = נקודת החלוקה הנוכחית

עבור offset ב-range(-searchRange, searchRange + 1):
  splitPoint = currentSplit + offset
  // ... אותו חישוב כמו למעלה
```

**נימוק להגבלת ±5 בעמודים רגילים:** 
- למנוע חיפוש יקר על כל עמוד
- 5 שורות = כ-70pt = שינוי משמעותי אבל לא קיצוני
- אם לא מספיק, שלבים ב'-ד' יטפלו

**אם ההגבלה נשארת:** יש לבדוק על קורפוס אמיתי האם 5 מספיק או צריך להרחיב.

### שלב ב': שבירה חלופית

**טווחי ריווח מילים (מוגדרים בקונפיגורציה, ערכים מוצעים לבדיקה):**

```typescript
interface WordSpacingConfig {
  preferred: { min: 90, max: 115 };  // אחוז מהרווח הטבעי של Ezra SIL
  allowed: { min: 80, max: 130 };    // גבולות קיצוניים
}
```

**חישוב חל`
עבור כל paragraph ב-currentPage:
  אם יש לפסקה alternatives:
    עבור כל alt ב-alternatives:
      spacingPercent = alt.wordSpacingPercent
      
      // בדוק אם החלופה בטווח המותר
      אם spacingPercent < 80 OR spacingPercent > 130:
        דלג (חורג מהגבול)
      
      newLineCount = len(alt.lines)
      deltaLines = newLineCount - len(paragraph.lines)
      
      // בדוק אם החלופה מסייעת לאיזון
      אם deltaLines מקטין את bottomDelta:
        החלף paragraph.lines ב-alt.lines
        חשב מחדש page layout
        
        // צור אבחון אם מחוץ לטווח המועדף
        אם spacingPercent < 90 OR spacingPercent > 115:
          הוסף Diagnostic:
            level: info
            code: WORD_SPACING_OUTSIDE_PREFERRED
            sectionId: section.id
            paragraphId: paragraph.id
            details: { spacing: spacingPercent, preferred: "90-115%" }
        
        אם balanced:
          החזר פתרון
```

**תוכנית בדיקה לאישור הערכים:**

לפני נעילת הערכים 90-115% ו-80-130%, יש לבצע בדיקות על:
1. טקסט עברי עם ניקוד (תנ״ך, סידור)
2. טקסט עברי בלי ניקוד (מאמרים מודרניים)
3. מדידה: באיזה אחוז מהפסקאות נדרש ריווח מחוץ ל-90-115%
4. בדיקה ויזואלית: האם 80% או 130% נראים "שבורים" או מקובלים

**הערה לגבי Knuth-Plass:**

השובר הנוכחי ב-M1.1 הוא **חמדני** (`greedy-breaker.ts`). אלגוריתם Knuth-Plass הוא **יעד עתידי** למי שרוצה אופטימיזציה גלובלית של כל הפסקה. כאשר יש Knuth-Plass, ה-`quality` ו-`penaltyInfo` יהיו מדויקים יותר. בינתיים, החלופות מחושבות על ידי הרצת השובר החמדני עם ערכי ריווח שונים.

### שלב ג': ריווח בין פסקאות

**הוספת ריווח נוסף בין פסקאות:**

```
defaultSpacing = config.paragraphSpacing  // ברירת מחדל: L (lineHeight)
maxAdditionalSpacing = 2.0 * defaultSpacing  // תוספת מקסימלית (לא סך הכול)

// קבע לאיזה טור להוסיף ריווח (הקצר יותר)
shorterColumn = אם rightColumnHeight < leftColumnHeight אז right אחרת left
delta = abs(rightColumnHeight - leftColumnHeight)

// נסה להוסיף ריווח במכפלות של lineHeight
עבור multiplier ב-[1, 2]:  // מוסיף L או 2L
  additionalSpacing = multiplier * lineHeight
  
  אם additionalSpacing <= maxAdditionalSpacing:
    // הוסף את הריווח בין הפסקאות בטור הקצר
    הוסף additionalSpacing בין פסקאות ב-shorterColumn
    חשב מחדש heights
    
    אם abs(newRightHeight - newLeftHeight) <= balanceTolerance:
      // שמור על רשת: הריווח תמיד במכפלות של lineHeight
      החזר פתרון
```

**הבהרה: "פי 2 מברירת המחדל":**
- **תוספת** (addition): אם ברירת המחדל היא L, מוסיפים עד 2L (סך הכול: 3L)
- זה המשמעות: ריווח של L + תוספת של עד 2L

**שמירת רשת הבסיס:**
- כל התוספות הן במכפלות שלמות של `lineHeight`
- זה מבטיח ששורות הבסיס נשארות מיושרות בין הטורים
- הטור שמקבל ריווח נוסף ירד במכפלות של L, והטור השני נשאר על אותן שורות רשת

### שלב ד': הזזת שורות/פסקאות בין עמודים

**כללי פיצול פסקאות (החלטה ח'):**

פיצול פסקה בין עמודים מותר, אבל בתנאים:

1. **מינימום widows/orphans:** לפחות `widows` שורות בתחילת העמוד הבא, לפחות `orphans` שורות בסוף העמוד הנוכחי
   - ברירת מחדל: `widows=2, orphans=2`
   - ניתן להגדרה בסגנון הפסקה

2. **פסקה קצרה:** פסקה בת פחות מ-4 שורות **לא** מתפצלת (לא הגיוני)

3. **אזור החלון:** אין לפצל פסקה בתוך אזור החלון (השורות הראשונות עד `opening.windowLines`)
   - פיצול אחרי החלון: מותר

4. **שורה אחרונה ממורכזת:** אם `lastLine='center'`, השורה האחרונה חייבת להישאר עם הפסקה
   - אין לפצל כך שהשורה הממורכזת תישאר לבדה

5. **הערת שוליים:** הערה חייבת להופיע בעמוד שורת ההפניה אליה
   - אם פיצול הפסקה מעביר את שורת ההפניה לעמוד אחר, ההערה עוברת איתה

**אלגוריתם מפורט:**

```
maxAttempts = 100  // חסם דטרמיניסטי לכל עמוד
attemptsCount = 0
lookBack = 1  // עמוד אחד אחורה
lookAhead = 5  // עד 5 עמודים קדימה

while attemptsCount < maxAttempts:
  attemptsCount += 1
  
  // אסטרטגיה 1: משוך תוכן מהעמוד הבא
  אם currentPageIndex + 1 <= lastPageIndex:
    nextPage = pages[currentPageIndex + 1]
    
    // נסה למשוך פסקה שלמה
    אם nextPage.firstParagraph קיימת:
      אם firstParagraph נכנסת ב-currentPage:
        העבר firstParagraph לסוף currentPage
        חשב מחדש layout של שני העמודים
        אם balanced: החזר פתרון, עצור
    
    // נסה למשוך חלק מפסקה (פיצול)
    אם nextPage.firstParagraph.lines.length >= 4:  // פסקה ארוכה מספיק
      עבור splitLine מ-widows עד (len(lines) - orphans):
        // בדוק שלא בתוך חלון
        אם opening קיים AND splitLine <= opening.windowLines:
          דלג
        
        // בדוק שורה אחרונה
        אם lastLine == 'center' AND splitLine == len(lines) - 1:
          דלג
        
        // בדוק הערות שוליים
        אם יש footnoteRefs בשורות שעוברות:
          וודא שההערות עוברות עם השורות
        
        // נסה את הפיצול
        partToMove = lines[0:splitLine]
        אם partToMove נכנס ב-currentPage:
          העבר partToMove לסוף currentPage
          עדכן את nextPage עם lines[splitLine:]
          חשב מחדש layout
          אם balanced: החזר פתרון, עצור
  
  // אסטרטגיה 2: דחוף תוכן לעמוד הבא
  אם currentPage.lastParagraph קיימת:
    // נסה לדחוף פסקה שלמה
    lastParagraph = currentPage.lastParagraph
    אם nextPage קיים ו-lastParagraph נכנסת בו:
      העבר lastParagraph לתחילת nextPage
      חשב מחדש layout
      אם balanced בשני העמודים: החזר פתרון, עצור
    
    // נסה לדחוף חלק מפסקה (פיצול)
    אם lastParagraph.lines.length >= 4:
      עבור splitLine מ-orphans עד (len(lines) - widows):
        // אותן בדיקות כמו למעלה (חלון, שורה אחרונה, הערות)
        ...
        
        partToMove = lines[splitLine:]
        אם partToMove נכנס ב-nextPage:
          העבר partToMove לתחילת nextPage
          עדכן currentPage עם lines[0:splitLine]
          חשב מחדש layout
          אם balanced: החזר פתרון, עצור
  
  // אסטרטגיה 3: הסתכל רחוק יותר (עד 5 עמודים)
  עבור offset מ-2 עד lookAhead:
    targetPageIndex = currentPageIndex + offset
    אם targetPageIndex > lastPageIndex: break
    
    targetPage = pages[targetPageIndex]
    // ... נסה להעביר פסקאות בין currentPage ל-targetPage
    // (אותה לוגיקה, אבל עם פער גדול יותר)
  
  // אסטרטגיה 4: הסתכל אחורה (עמוד אחד)
  אם currentPageIndex - 1 >= 0:
    prevPage = pages[currentPageIndex - 1]
    // ... נסה להעביר תוכן מ-currentPage ל-prevPage
    // (אותה לוגיקה, אבל בכיוון הפוך)
  
  // אם הגענו לכאן, לא מצאנו פתרון בניסיון הזה
  // המשך ל-attempt הבא או צא מה-loop

// אם יצאנו מה-loop בלי פתרון: כשלון
```

**תנאי עצירה:**
1. מצאנו פתרון מאוזן → עצור והחזר
2. הגענו ל-`maxAttempts` → עצור וצור אבחון error
3. אין יותר אסטרטגיות לנסות → עצור וצור אבחון error

**למה 100 ניסיונות:**
- הצעה שמבטיחה דטרמיניזם
- עם 5 עמודים look-ahead ו-4 אסטרטגיות, 100 ניסיונות צריכים להספיק
- אם לא מספיק בפועל, אפשר להגדיל (עם נימוק מבדיקות)

---

## מבנה Diagnostic

```typescript
interface Diagnostic {
  level: 'error' | 'warning' | 'info';
  code: string;                  // קוד יציב (לא משתנה בין גרסאות)
  
  // מזהה יציב (לא תלוי במספר עמוד)
  sectionId: string;             // מקטע רלוונטי
  paragraphId?: string;          // פסקה רלוונטית (אם רלוונטי)
  
  // מידע הקשרי (יכול להשתנות בעריכה)
  pageNumber?: number;           // עמוד רלוונטי (1-indexed) - להצגה בלבד
  
  message: string;               // תיאור קצר בעברית
  details?: Record<string, unknown>; // נתונים נוספים
}

// דוגמאות לקודים:
// - SECTION_BALANCE_FAILED: לא הצליח לאזן עמוד אחרון של מקטע
// - UNBALANCED_FILL_PAGE: עמוד fill עם טורים בגבהים שונים (warning)
// - WORD_SPACING_OUTSIDE_PREFERRED: ריווח מילים מחוץ לטווח 90-115% (info)
// - PARAGRAPH_SPACING_EXCEEDED: ריווח בין פסקאות חרג מהמקסימום (warning)
// - ALTERNATIVE_BREAK_USED: נעשה שימוש בשבירה חלופית (info)
// - LINES_MOVED_BETWEEN_PAGES: שורות הוזזו בין עמודים (info)
// - PARAGRAPH_SPLIT_ACROSS_PAGES: פסקה פוצלה בין עמודים (info)
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

**מנגנון Waiver (ידני בלבד):**

Waiver הוא אישור מפורש של המשתמש לאבחון ברמת error. **אין waiver אוטומטי.**

**מפתח יציב לאבחון:**
```typescript
// מזהה ייחודי לכל אבחון, עמיד בעריכות
const diagnosticKey = `${sectionId}:${paragraphId || 'section'}:${code}`;

// דוגמה: "chapter-3:para-42:SECTION_BALANCE_FAILED"
```

**למה לא לפי pageNumber:**
- מספר עמוד משתנה בעריכה (הוספת/הסרת תוכן)
- `sectionId` + `paragraphId` יציבים לאורך עריכות
- Waiver נשמר בקובץ נפרד ומתייחס למזהים יציבים

**תהליך Waiver:**
1. המשתמש רואה אבחון error
2. המשתמש מחליט לקבל את האבחון (waive)
3. המערכת שומרת `diagnosticKey` ברשימת waivers
4. בעימודים הבאים, אבחון עם אותו key לא חוסם ייצוא PDF

**ייצוא PDF:**
- מותר רק אם **כל** האבחונים ברמת error קיבלו waiver ידני
- אבחונים ברמת warning/info לא חוסמים ייצוא

---

## בדיקות מוצעות

### יחידה (unit):

1. **Section creation:**
   - `should create section with paragraphs`
   - `should preserve paragraph IDs`
   - `should include opening with window in paragraph`

2. **Paragraph breaking with alternatives:**
   - `should generate primary break and 2-3 alternatives`
   - `should maintain quality scores for alternatives`
   - `should respect wordSpacing range (80%-130%)`
   - `should adjust line breaking for window width`

3. **Balance with different split:**
   - `should find balanced split within search range`
   - `should prefer split with smaller delta`
   - `should check all splits for last page of section`

4. **Balance with alternative break:**
   - `should use alternative with fewer lines to balance`
   - `should use alternative with more lines to balance`
   - `should not use alternative if spacing out of range`
   - `should create info diagnostic for spacing outside preferred range`

5. **Balance with paragraph spacing:**
   - `should add L or 2L spacing between paragraphs`
   - `should add spacing to shorter column only`
   - `should maintain baseline grid with lineHeight multiples`

6. **Balance with line movement and splitting:**
   - `should move entire paragraph to next page`
   - `should pull entire paragraph from next page`
   - `should split paragraph respecting widows/orphans`
   - `should not split paragraph shorter than 4 lines`
   - `should not split within window area`
   - `should keep centered last line with paragraph`
   - `should move footnote with its reference line`
   - `should respect look-ahead limit (5 pages)`
   - `should stop at maxAttempts (100)`

7. **Diagnostic generation:**
   - `should create error diagnostic when balance fails`
   - `should use stable key (sectionId + paragraphId + code)`
   - `should create warning for unbalanced fill page`
   - `should create info diagnostic when alternative used`

### אינטגרציה (integration):

1. **Multi-page section:**
   - `should balance last page of section (hard constraint)`
   - `should not balance middle pages in fill mode`
   - `should balance all pages in balanced mode`
   - `should create warning for unbalanced fill pages`

2. **Multi-section document:**
   - `should balance each section independently`
   - `should not move lines between sections`

3. **Footnotes integration:**
   - `should place footnote on same page as reference`
   - `should move footnote when paragraph splits`
   - `should reduce column height for footnotes`

4. **Edge cases:**
   - `should handle section with single paragraph`
   - `should handle section shorter than one page`
   - `should handle very long section (>10 pages)`
   - `should handle paragraph with opening and window`

### מקרי קצה (edge cases):

1. **Paragraph at page boundary:**
   - פסקה שמתחילה בעמוד אחד ומסתיימת באחר
   - וידוא פיצול נכון לפי widows/orphans

2. **Last line centered:**
   - פסקה עם `lastLine: 'center'`
   - וידוא שהשורה האחרונה נשארת ממורכזת ולא מתפצלת

3. **Widows and orphans:**
   - פסקה עם `widows: 2, orphans: 2`
   - וידוא שפיצול לא מפר את הכללים

4. **Keep with next:**
   - כותרת עם `keepWithNext: true`
   - וידוא שלא מופרדת מהפסקה הבאה

5. **No alternatives available:**
   - פסקה שיש לה רק שבירה אחת
   - וידוא שהאלגוריתם עובר לשלב הבא

6. **Balance tolerance = 0:**
   - `balanceTolerance: 0` (איזון מושלם נדרש)
   - וידוא שלא חוזר אינסוף loop

7. **Opening with window:**
   - פסקה עם חלון גדול (3 שורות)
   - וידוא שהחלת את השורות המקוצרות

---

## שאלות פתוחות (דורשות החלטה)

### 1. מה קורה כאשר אין חלופות שבירה?

**תרחיש:** פסקה קצרה (3 שורות) שאין לה אלטרנטיבות (כל הריווחים כבר בקצה הטווח).

**אפשרויות:**
- **A:** דלג על שלב ב' והמשך לשלב ג' (ריווח בין פסקאות)
- **B:** צור חלופה מלאכותית עם ריווח מחוץ לטווח (עם עונש)
- **C:** סמן את הפסקה כ-"unbreakable" וטפל בה בנפרד

**המלצה:** A (פשוט יותר, עונש יטופל בשלבים הבאים)

### 2. איך מטפלים בעמוד ריק שנוצר כתוצאה מאיזון?

**תרחיש:** הזזת פסקאות בין עמודים יכולה להשאיר עמוד ריק באמצע המקטע.

**אפשרויות:**
- **A:** אסור - אל תאפשר התאמה שיוצרת עמוד ריק
- **B:** מותר - הסר את העמוד הריק אוטומטית
- **C:** הוסף אבחון warning ותן למשתמש להחליט

**המלצה:** A (עמוד ריק באמצע מקטע הוא באג, לא פיצ'ר)

---

## החלטות שהתקבלו

### השאלות הבאות הוכרעו בהחלטות המוצר:

**שאלה לשעבר 2 (פיצול פסקאות):** ✅ **הוכרעה**

החלטה ח' קובעת: **מותר לפצל פסקה בין עמודים**, בתנאים:
- מינימום widows/orphans (ברירת מחדל: 2+2)
- לא לפצל פסקה קצרה מ-4 שורות
- לא לפצל בתוך אזור החלון
- שורה אחרונה ממורכזת נשארת עם הפסקה
- הערת שוליים נעה עם שורת ההפניה

**שאלה לשעבר 6 (גובה החלון):** ✅ **הוכרעה**

החלטה ה' קובעת: **גובה שורה אחת כברירת מחדל**, רוחב החלון כרוחב המילה המודגשת בפועל.

במודל `Paragraph`:
```typescript
opening?: {
  wordCount: number;
  windowLines: number;  // ברירת מחדל: 1
  windowWidth: number;  // רוחב המילה, חישוב דינמי
}
```

**שאלה לשעבר 3 (הערות שוליים):** ✅ **תוקנה**

החלטה ו' קובעת: **הערות שוליים ברוחב מלא כברירת מחדל**, מספור ספרות ברצף בכל הספר.

הערות **אינן מתעלמות** מהן באיזון:
- הערות שוליים ברוחב מלא מקטינות את גובה אזור הטורים
- הן קובעות את קיבולת העמוד
- האיזון הוא של גוף הטורים בתוך החלל שנשאר מעל ההערות
- הערה חייבת להופיע בעמוד שורת ההפניה אליה

**שאלה לשעבר 4 (עדיפות):** ✅ **הוכרעה**

החלטה ב' קובעת: **עדיפות קבועה** (סולם ההתאמות לפי הסדר):
1. חלוקה אחרת
2. שבירה חלופית
3. ריווח בין פסקאות
4. הזזת שורות

**שאלה לשעבר 5 (מספר טורים):** ✅ **לא רלוונטית**

הספק והדרישות מתייחסים ל-**שני טורים בלבד**. תמיכה ב-N טורים אינה בתחום בשלב זה.

---

## הערות מימוש

### ביצועים

- **מורכבות זמן:** O(P × A × S × T) כאשר:
  - P = מספר עמודים במקטע
  - A = מספר חלוסקה
  - S = גודל טווח החיפוש (5 עמודים)
  - T = מספר ניסיונות מקסימלי (100)
  
- **אופטימיזציה:** 
  - Cache של page layouts (למנוע חישוב חוזר)
  - עצירה מוקדמת כאשר נמצא פתרון מושלם (delta=0)
  - דילוג על פסקאות/חלופות שברור שלא יעזרו

### דטרמיניזם

כל החיפושים והחישובים חייבים להיות דטרמיניסטיים:
- סדר בדיקת החלופות יציב (ממוין לפי wordSpacingPercent)
- סדר בדיקת הפסקאות יציב (לפי סדר בטקסט)
- אין randomization או heuristics לא דטרמיניסטיות
- חסמים מבוססי מספרים (100 ניסיונות), לא זמן
- אותו קלט → אותו פלט, תמיד

### עטיפה פשוטה למעבר מ-M1.1

למשתמשים קיימים, די ליצור `Section` אחד עם `Paragraph` אחד:

```typescript
// פונקציה עוזרת
function wrapLegacyInput(
  shapedWords: ShapedWord[],
  config: LayoutConfig
): Section {
  const lines = breakLines(shapedWords, config);  // שבירה רגילה
  
  return {
    id: 'default-section',
    kind: 'body',
    paragraphs: [{
      id: 'default-paragraph',
      lines,
      style: {
        lastLine: 'justify',
        widows: 2,
        orphans: 2,
      },
    }],
    balancePolicy: config.pagePolicy || 'fill',
  };
}
```

**אין צורך בדגל** `useLegacyBalancing`. העטיפה היא פשוטה ושקופה.

---

## אסטרטגיית מימוש

### שלב 1: תשתית (לא משנה התנהגות)
1. הוסף `Paragraph`, `Section`, `Footnote` types
2. הוסף תמיכה ב-`opening` + `window` ב-`Paragraph`
3. שנה `breakLines` להחזיר `ParagraphBreakResult` עם alternatives
4. הוסף `Diagnostic` type ו-`diagnostics[]` ל-`LayoutResult`
5. כל הבדיקות הקיימות עוברות

### שלב 2: איזון בסיסי (רק חלוקה אחרת)
1. מימוש `layoutSection` פשוט (fill mode + balance last page)
2. שלב א' של הסולם (חלוקה אחרת)
3. אילוץ קשיח על עמוד אחרון
4. אבחון SECTION_BALANCE_FAILED ו-UNBALANCED_FILL_PAGE
5. בדיקות עבור איזון פשוט

### שלב 3: שבירה חלופית
1. מימוש יצירת חלווחי ריווח (80-130%)
2. שלב ב' של הסולם
3. אבחון WORD_SPACING_OUTSIDE_PREFERRED
4. בדיקות עבור alternatives

### שלב 4: ריווח והזזה
1. שלב ג': ריווח בין פסקאות (שמירת רשת)
2. שלב ד': הזזת פסקאות ופיצול (כללי widows/orphans/חלון/הערות)
3. חסם 100 ניסיונות
4. בדיקות מקיפות
5. בדיקות edge cases

### שלב 5: אבחון ו-waiver
1. מנגנון waiver ידני עם מפתח יציב
2. חסימת ייצוא PDF ללא waivers
3. תיעוד מלא של diagnostics
4. דוגמאות שימוש

### שלב 6: אינטגרציית הערות שוליים
1. הוספת Footnote types
2. קישור בין FootnoteRef ל-Footnote
3. חישוב גובה אזור הערות
4. העברת הערות עם פיצול פסקאות
5. בדיקות integration

---

## הפניות

- **SPEC.md:** סעיף 7 (מילוי עמודים), סעיף 6 (פתיחה וחלון)
- **ADR-001:** TypeScript - דטרמיניזם ומספרים שלמים
- **ADR-005:** BiDi - כיצד מטופלות שורות מעורבות
- **החלטות מוצר מחייבות:** סעיפים א'-ח' בראש המסמך

---

**סטטוס:** ממתין לאישור לפני שלב 2 (מימוש)

**עדכון אחרון:** 2026-10-14
