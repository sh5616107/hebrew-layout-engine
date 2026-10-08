// Typst layout for Hebrew religious book
// Generated from sample.json

// Gematria conversion function
#let gematria(num) = {
  if num < 1 or num > 999 {
    return str(num)
  }
  
  let ones = ("", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט")
  let tens = ("", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ")
  let hundreds = ("", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק")
  
  // Special cases for 15 and 16 (avoid yud-heh and yud-vav)
  if num == 15 { return "ט״ו" }
  if num == 16 { return "ט״ז" }
  
  let h = calc.quo(num, 100)
  let t = calc.quo(calc.rem(num, 100), 10)
  let o = calc.rem(num, 10)
  
  let result = hundreds.at(h) + tens.at(t) + ones.at(o)
  
  // Add geresh for single letter or gershayim for multiple
  if result.len() == 1 {
    result = result + "׳"
  } else if result.len() > 1 {
    let chars = result.clusters()
    result = chars.slice(0, -1).join() + "״" + chars.at(-1)
  }
  
  return result
}



// Page setup
#set page(
  width: 498.9pt,
  height: 708.66pt,
  margin: (
    inside: 56.7pt,
    outside: 42.5pt,
    top: 56.7pt,
    bottom: 56.7pt,
  ),
  header: context {
    let page-num = here().page()
    set text(size: 10pt)
    if calc.even(page-num) {
      // Left page
      align(left)[#text("בְּרֵאשִׁית")]
    } else {
      // Right page  
      align(right)[#text(style: "italic")[בְּרֵאשִׁית]]
    }
  },
  footer: context {
    let page-num = here().page()
    set text(size: 10pt)
    if calc.even(page-num) {
      align(left)[#gematria(page-num)]
    } else {
      align(right)[#gematria(page-num)]
    }
  },
)

// Text direction and language
#set text(
  font: "Ezra SIL",
  size: 12pt,
  lang: "he",
  dir: rtl,
)

// Paragraph settings
#set par(
  justify: true,
  leading: 6pt,
)

// Footnote styling
#show footnote: set text(size: 10pt)
#set footnote.entry(
  separator: line(length: 30%, stroke: 0.5pt),
  clearance: 6pt,
  gap: 4pt,
)

// TYPST-LIMITATION: Full-width footnotes above two-column text not supported
// Footnotes will appear at bottom of each column, not spanning both columns

// Custom style for centered last line
// TYPST-LIMITATION: Centering only the last line of a paragraph requires complex show rule
// This attempts to create the effect but may not work perfectly

// Chapter heading style
#let chapter-heading(content) = {
  pagebreak(to: "odd", weak: false)
  v(18pt)
  align(center)[
    #text(size: 24pt, weight: "bold")[
      #content
    ]
  ]
  v(18pt)
}

// Subheading style
#let subheading(content) = {
  v(18pt)
  text(size: 14pt, weight: "bold")[
    #content
  ]
  v(9pt)
}

// Opening with bold words and window
// TYPST-LIMITATION: Creating exact word-width window is complex
#let opening-para(opening-text, rest-text, window-lines: 2) = {
  // Bold opening words
  text(weight: "bold")[#opening-text]
  rest-text
  // Window effect approximation using spacing
  // Exact implementation would require measuring word width
}

// Table of Contents
#page[
  #align(center)[
    #text(size: 18pt, weight: "bold")[תוכן עניינים]
  ]
  #v(18pt)
  
  #outline(
    title: none,
    indent: auto,
  )
]

// Main content - two columns
#columns(2, gutter: 28.35pt)[

] // end columns

#chapter-heading[בְּרֵאשִׁית]

// Resume columns
#columns(2, gutter: 28.35pt)[

#opening-para[בְּרֵאשִׁית בָּרָא אֱלֹהִים][ אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ]

וְהָאָרֶץ הָיְתָה תֹהוּ ו#footnote[תהו ובהו - פירוש: תוהה ובוהה על התוהו שבה. ולשון תרגום: צדיא וריקניא. תֹּהוּ הוא דבר התוהה שהאדם תוהה ומתבוהל על חורבן הארץ. זוהי הערת שוליים ארוכה יותר שנועדה לבדוק את המשכיות ההערה לעמוד הבא. ההערה צריכה להכיל מספיק טקסט כדי שלא תיכנס בעמוד אחד ותמשיך לעמוד השני. לכן מוסיפים כאן עוד טקסט הסבר: רש"י מבאר שהארץ היתה בלי צורה ובלי תוכן, ורוח אלהים - רוח המלך המשיח, שהיא עתידה לבוא על פני המים ולהחיות את העולם. וכך נמשכת ההערה על פני מספר שורות רבות כדי לבדוק את יכולת המנוע לפצל הערות בין עמודים.]ָבֹהוּ וְחֹשֶׁךְ עַל־פְּנֵי תְהוֹם וְרוּחַ אֱלֹהִים מְרַחֶפֶת עַל־פְּנֵי הַמָּיִם

#subheading[יום ראשון: אור וחושך]

וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי־אוֹר

וַיַּרְא אֱלֹהִים אֶת־הָאוֹר כִּי־טוֹב וַיַּבְדֵּל אֱלֹהִים בֵּין הָאוֹר וּבֵין הַחֹשֶׁךְ

וַיִּקְרָא אֱלֹהִים לָאוֹר יוֹם וְלַחֹשֶׁךְ ק#footnote[יום אחד - למה לא נאמר יום ראשון? מפני שלא היה עדיין שני או שלישי, והיה הקב"ה יחיד בעולמו.]ָרָא לָיְלָה וַיְהִי־עֶרֶב וַיְהִי־בֹקֶר יוֹם אֶחָד

#subheading[יום שני: הרקיע]

וַיֹּאמֶר אֱלֹהִים יְהִי רָקִיעַ בְּתוֹךְ הַמָּיִם וִיהִי מַבְדִּיל בֵּין מַיִם לָמָיִם

וַיַּעַשׂ אֱלֹהִים אֶת־הָרָקִיעַ וַיַּבְדֵּל בֵּין הַמַּיִם אֲשֶׁר מִתַּחַת לָרָקִיעַ וּבֵין הַמַּיִם אֲשֶׁר מֵעַל לָרָקִיעַ וַיְהִי־כֵן

וַיִּקְרָא אֱלֹהִים לָרָקִיעַ שָׁמָיִם וַיְהִי־עֶרֶב וַיְהִי־בֹקֶר יוֹם שֵׁנִי

וַיֹּאמֶר אֱלֹהִים יִקָּווּ הַמַּיִם מִתַּחַת הַשָּׁמַיִם אֶל־מָקוֹם אֶחָד וְתֵרָאֶה הַיַּבָּשָׁה וַיְהִי־כֵן

וַיִּקְרָא אֱלֹהִים לַיַּבָּשָׁה אֶרֶץ וּלְמִקְוֵה הַמַּיִם קָרָא יַמִּים וַיַּרְא אֱלֹהִים כִּי־טוֹב

] // end columns
