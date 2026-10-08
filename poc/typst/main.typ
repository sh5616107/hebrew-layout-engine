// Typst source for Hebrew Book Layout POC
// Generated from sample.json

// Gematria conversion function
#let gematria(n) = {
  if n == 15 { return "ט״ו" }
  if n == 16 { return "ט״ז" }
  
  let ones = ("", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט")
  let tens = ("", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ")
  let hundreds = ("", "ק", "ר", "ש", "ת")
  
  let h = calc.quo(n, 100)
  let t = calc.quo(calc.rem(n, 100), 10)
  let o = calc.rem(n, 10)
  
  let result = ""
  if h > 0 and h < hundreds.len() { result = result + hundreds.at(h) }
  if t > 0 and t < tens.len() { result = result + tens.at(t) }
  if o > 0 and o < ones.len() { result = result + ones.at(o) }
  
  // Add gershayim or geresh
  if result.len() > 1 {
    let chars = result.clusters()
    let last-char = chars.last()
    let rest = chars.slice(0, chars.len() - 1).join()
    result = rest + "״" + last-char
  } else if result.len() == 1 {
    result = result + "׳"
  }
  
  result
}

#set page(
  width: 176mm,
  height: 250mm,
  margin: (
    inside: 19.99647266313933mm,
    outside: 14.998236331569666mm,
    top: 19.99647266313933mm,
    bottom: 19.99647266313933mm,
  ),
  header: context {
    set text(size: 9pt, font: "David")
    set align(center)
    
    let page-num = gematria(here().page())
    if calc.odd(here().page()) {
      [#page-num | בראשית]
    } else {
      [בראשית | #page-num]
    }
    v(0.5em)
    line(length: 100%, stroke: 0.5pt)
  },
  numbering: "1",
)

#set text(
  font: "David",
  size: 11pt,
  lang: "he",
  dir: rtl,
)

#set par(
  leading: 3pt,
  justify: true,
)

// Custom paragraph styling for centered last line
// TYPST-LIMITATION: Centering only the last line of a paragraph is not directly supported.
// This attempts to approximate it, but Typst's paragraph model doesn't have ::last-line selector.
#let centered-last-par(body) = {
  body
}


// Two-column layout
#columns(2, gutter: 10mm)[

// Section: body
#align(center)[
  #text(size: 18pt, weight: "bold")[
    בְּרֵאשִׁית
  ]
]

#par[
  #box([
    #place(top + right, float: true, clearance: 0pt)[
      #box(width: auto, height: 42pt)[
        #text(weight: "bold", size: 12.100000000000001pt)[בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים]
      ]
    ]
    בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃
  ])
#footnote[
    #text(size: 9pt)[
      ראה רש״י: בראשית ברא. לא אמר הכתוב בראשונה ברא, שאם אתה אומר כן, תצטרך להמר: עשה לו שמים למעלה ממנו, והכתוב לא בא ללמד על סדר הבריאה.
    ]
  ]
]

#par[
  וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙ וָבֹ֔הוּ וְחֹ֖שֶׁךְ עַל־פְּנֵ֣י תְה֑וֹם וְר֣וּחַ אֱלֹהִ֔ים מְרַחֶ֖פֶת עַל־פְּנֵ֥י הַמָּֽיִם׃#footnote[
    #text(size: 9pt)[
      תהו ובהו – פירוש רש״י: שממון ובהול שאדם משתומם ומבהיל על השממון. בלעז: אסטורדיסון. וחשך – לא פירש הכתוב מה טיב המים, החשך והתהום, לפי שאינם עיקר הכתוב, אלא בא לגלות על סדר הבריאה, ושמים וארץ הם העיקר שבהן. המים הם בריאה אבל לא הוזכרו מפני שהם נכללים בהבנת הארץ.
    ]
  ]
]


#v(28pt)
#align(center)[
  #text(size: 14pt, weight: "bold")[
    יום ראשון
  ]
]
#v(14pt)

#par[
  וַיֹּ֥אמֶר אֱלֹהִ֖ים יְהִ֣י א֑וֹר וַֽיְהִי־אֽוֹר׃ וַיַּ֧רְא אֱלֹהִ֛ים אֶת־הָא֖וֹר כִּי־ט֑וֹב וַיַּבְדֵּ֣ל אֱלֹהִ֔ים בֵּ֥ין הָא֖וֹר וּבֵ֥ין הַחֹֽשֶׁךְ׃ וַיִּקְרָ֨א אֱלֹהִ֤ים לָאוֹר֙ י֔וֹם וְלַחֹ֖שֶׁךְ קָ֣רָא לָ֑יְלָה וַֽיְהִי־עֶ֥רֶב וַֽיְהִי־בֹ֖קֶר י֥וֹם אֶחָֽד׃
]


#v(28pt)
#align(center)[
  #text(size: 14pt, weight: "bold")[
    יום שני
  ]
]
#v(14pt)

#par[
  וַיֹּ֣אמֶר אֱלֹהִ֔ים יְהִ֥י רָקִ֖יעַ בְּת֣וֹךְ הַמָּ֑יִם וִיהִ֣י מַבְדִּ֔יל בֵּ֥ין מַ֖יִם לָמָֽיִם׃ וַיַּ֣עַשׂ אֱלֹהִים֮ אֶת־הָרָקִיעַ֒ וַיַּבְדֵּ֗ל בֵּ֤ין הַמַּ֙יִם֙ אֲשֶׁר֙ מִתַּ֣חַת לָרָקִ֔יעַ וּבֵ֣ין הַמַּ֔יִם אֲשֶׁ֖ר מֵעַ֣ל לָרָקִ֑יעַ וַֽיְהִי־כֵֽן׃ וַיִּקְרָ֧א אֱלֹהִ֛ים לָֽרָקִ֖יעַ שָׁמָ֑יִם וַֽיְהִי־עֶ֥רֶב וַֽיְהִי־בֹ֖קֶר י֥וֹם שֵׁנִֽי׃#footnote[
    #text(size: 9pt)[
      הרקיע – פירוש: השמים, ונקרא רקיע על שם שהוא רקוע ודק ועומד על גבי האויר. והוא מתוח כאוהל שנאמר: הנוטה כדוק שמים וימתחם כאוהל לשבת. וכן כתיב בתהלים: רוקע הארץ על המים, שהשמים פרושים על פני הארץ כתקרה על גבי הבית. ורבותינו ז״ל דרשו: מלמד שתפס הקב״ה את הרקיע ביום השני והחזיקו במקומו ורקעו כחייט המותח את הבגד ורוקעו בידו, ועל שם כך נקרא רקיע. הרב אברהם אבן עזרא מפרש: רקיע, מלשון רוקע הארץ, שהוא מהפכו, כלומר: שהשמים מקיפים את הארץ מכל צד כמו שהרקע מקיף את הדבר הנרקע, ולפיכך נקרא רקיע.
    ]
  ]
]


#v(28pt)
#align(center)[
  #text(size: 14pt, weight: "bold")[
    יום שלישי
  ]
]
#v(14pt)

#par[
  וַיֹּ֣אמֶר אֱלֹהִ֗ים יִקָּו֨וּ הַמַּ֜יִם מִתַּ֤חַת הַשָּׁמַ֙יִם֙ אֶל־מָק֣וֹם אֶחָ֔ד וְתֵרָאֶ֖ה הַיַּבָּשָׁ֑ה וַֽיְהִי־כֵֽן׃ וַיִּקְרָ֨א אֱלֹהִ֤ים לַיַּבָּשָׁה֙ אֶ֔רֶץ וּלְמִקְוֵ֥ה הַמַּ֖יִם קָרָ֣א יַמִּ֑ים וַיַּ֥רְא אֱלֹהִ֖ים כִּי־טֽוֹב׃
]

#par[
  וַיֹּ֣אמֶר אֱלֹהִ֗ים תַּֽדְשֵׁ֤א הָאָ֙רֶץ֙ דֶּ֔שֶׁא עֵ֚שֶׂב מַזְרִ֣יעַ זֶ֔רַע עֵ֣ץ פְּרִ֞י עֹ֤שֶׂה פְּרִי֙ לְמִינ֔וֹ אֲשֶׁ֥ר זַרְעוֹ־ב֖וֹ עַל־הָאָ֑רֶץ וַֽיְהִי־כֵֽן׃ וַתּוֹצֵ֨א הָאָ֜רֶץ דֶּ֠שֶׁא עֵ֣שֶׂב מַזְרִ֤יעַ זֶ֙רַע֙ לְמִינֵ֔הוּ וְעֵ֧ץ עֹֽשֶׂה־פְּרִ֛י אֲשֶׁ֥ר זַרְעוֹ־ב֖וֹ לְמִינֵ֑הוּ וַיַּ֥רְא אֱלֹהִ֖ים כִּי־טֽוֹב׃ וַֽיְהִי־עֶ֥רֶב וַֽיְהִי־בֹ֖קֶר י֥וֹם שְׁלִישִֽׁי׃
]


]

// Note: Footnotes appear at bottom of each column, not full-width above columns.
