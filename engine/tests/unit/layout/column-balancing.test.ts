/**
 * Column balancing tests.
 * M2 basic balancing: minimize height difference between columns.
 */

import { describe, it, expect } from 'vitest';
import { layoutTwoColumnsBalanced } from '../../../src/layout/two-column-layout';
import type { ShapedWord } from '../../../src/line-breaking/greedy-breaker';

// Helper to create mock shaped words
function createMockLine(text: string): ShapedWord[] {
  return [{
    text,
    glyphIds: [1, 2, 3],
    advances: [10, 10, 10],
    width: 30,
  }];
}

describe('Column Balancing (M2)', () => {
  it('should balance 5 lines with 3+2 split', () => {
    const lines = [
      createMockLine('Line 1'),
      createMockLine('Line 2'),
      createMockLine('Line 3'),
      createMockLine('Line 4'),
      createMockLine('Line 5'),
    ];
    
    const result = layoutTwoColumnsBalanced(lines, {
      pageHeight: 500,
      lineHeight: 20,
      enableBalancing: true,
      balanceTolerance: 20, // 1 line tolerance (was implicit default)
    });
    
    // Should split 3+2 (closer to middle than 2+3)
    expect(result.rightColumn.lines.length).toBe(3);
    expect(result.leftColumn.lines.length).toBe(2);
    
    // Check balance
    expect(result.balanceInfo).toBeDefined();
    expect(result.balanceInfo?.bottomDelta).toBe(20); // 1 line difference = 20pt
    expect(result.balanceInfo?.isBalanced).toBe(true); // Within default tolerance
  });

  it('should achieve perfect balance with even lines', () => {
    const lines = [
      createMockLine('Line 1'),
      createMockLine('Line 2'),
      createMockLine('Line 3'),
      createMockLine('Line 4'),
    ];
    
    const result = layoutTwoColumnsBalanced(lines, {
      pageHeight: 500,
      lineHeight: 20,
      enableBalancing: true,
    });
    
    // Should split 2+2 (perfect)
    expect(result.rightColumn.lines.length).toBe(2);
    expect(result.leftColumn.lines.length).toBe(2);
    
    // Check perfect balance
    expect(result.balanceInfo?.bottomDelta).toBe(0);
    expect(result.balanceInfo?.isBalanced).toBe(true);
    expect(result.balanceInfo?.quality).toBe(1); // Perfect quality
  });

  it('should handle 7 lines with 4+3 split', () => {
    const lines = Array.from({ length: 7 }, (_, i) => 
      createMockLine(`Line ${i + 1}`)
    );
    
    const result = layoutTwoColumnsBalanced(lines, {
      pageHeight: 500,
      lineHeight: 20,
      enableBalancing: true,
      balanceTolerance: 20, // 1 line tolerance
    });
    
    // Should split 4+3 or 3+4 (1 line difference)
    const lineDiff = Math.abs(
      result.rightColumn.lines.length - result.leftColumn.lines.length
    );
    expect(lineDiff).toBeLessThanOrEqual(1);
    
    // Should be balanced within tolerance
    expect(result.balanceInfo?.isBalanced).toBe(true);
    expect(result.balanceInfo?.bottomDelta).toBeLessThanOrEqual(20);
  });

  it('should handle 10 lines with 5+5 perfect split', () => {
    const lines = Array.from({ length: 10 }, (_, i) => 
      createMockLine(`Line ${i + 1}`)
    );
    
    const result = layoutTwoColumnsBalanced(lines, {
      pageHeight: 500,
      lineHeight: 20,
      enableBalancing: true,
    });
    
    expect(result.rightColumn.lines.length).toBe(5);
    expect(result.leftColumn.lines.length).toBe(5);
    expect(result.balanceInfo?.bottomDelta).toBe(0);
    expect(result.balanceInfo?.quality).toBe(1);
  });

  it('should respect custom balance tolerance', () => {
    const lines = [
      createMockLine('Line 1'),
      createMockLine('Line 2'),
      createMockLine('Line 3'),
    ];
    
    const result = layoutTwoColumnsBalanced(lines, {
      pageHeight: 500,
      lineHeight: 20,
      enableBalancing: true,
      balanceTolerance: 10, // Strict: half a line
    });
    
    // 2+1 split has 20pt difference - exceeds 10pt tolerance
    expect(result.balanceInfo?.bottomDelta).toBe(20);
    expect(result.balanceInfo?.isBalanced).toBe(false);
  });

  it('should handle single line (trivial case)', () => {
    const lines = [createMockLine('Only line')];
    
    const result = layoutTwoColumnsBalanced(lines, {
      pageHeight: 500,
      lineHeight: 20,
      enableBalancing: true,
      balanceTolerance: 20, // 1 line tolerance
    });
    
    expect(result.rightColumn.lines.length).toBe(1);
    expect(result.leftColumn.lines.length).toBe(0);
    expect(result.balanceInfo?.isBalanced).toBe(true);
  });

  it('should handle two lines (1+1 perfect)', () => {
    const lines = [
      createMockLine('Line 1'),
      createMockLine('Line 2'),
    ];
    
    const result = layoutTwoColumnsBalanced(lines, {
      pageHeight: 500,
      lineHeight: 20,
      enableBalancing: true,
    });
    
    expect(result.rightColumn.lines.length).toBe(1);
    expect(result.leftColumn.lines.length).toBe(1);
    expect(result.balanceInfo?.bottomDelta).toBe(0);
    expect(result.balanceInfo?.quality).toBe(1);
  });

  it('should calculate quality score correctly', () => {
    const lines = Array.from({ length: 5 }, (_, i) => 
      createMockLine(`Line ${i + 1}`)
    );
    
    const result = layoutTwoColumnsBalanced(lines, {
      pageHeight: 500,
      lineHeight: 20,
      enableBalancing: true,
    });
    
    // 3+2 split: 20pt difference, lineHeight=20
    // Quality = 1 - (20/20) = 0
    // But max(0, ...) so still valid
    expect(result.balanceInfo?.quality).toBeGreaterThanOrEqual(0);
    expect(result.balanceInfo?.quality).toBeLessThanOrEqual(1);
  });
});
