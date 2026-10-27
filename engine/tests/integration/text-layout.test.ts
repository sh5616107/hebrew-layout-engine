import { describe, expect, it } from 'vitest';
import { layoutText } from '../../src/core/text-layout';

describe('text layout entry point', () => {
  it('shapes Hebrew paragraphs and produces a renderable page layout', () => {
    const result = layoutText('שלום עולם\n\nבראשית ברא', {
      fontPath: 'fonts/SILEOT.ttf',
      fontSize: 12,
      layout: {
        pageWidth: 240,
        pageHeight: 200,
        leftMargin: 10,
        rightMargin: 10,
        topMargin: 10,
        bottomMargin: 10,
        columnGap: 10,
        lineHeight: 14,
        wordSpacing: 3.5,
      },
    });

    expect(result.pageCount).toBe(1);
    const words = result.pages.flatMap((page) => [
      ...page.rightColumn.lines.flatMap((line) => line.words),
      ...page.leftColumn.lines.flatMap((line) => line.words),
    ]);
    expect(words).toHaveLength(4);
    expect(words.every((word) => word.glyphIds.length > 0)).toBe(true);
    expect(words.filter((word) => word.endsParagraph)).toHaveLength(2);
  });
});
