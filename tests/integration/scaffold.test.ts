import { describe, it, expect } from 'vitest';
import { layout, type Document } from '../../src/index.js';
import { ptToMpt } from '../../src/core/units.js';

describe('Scaffold integration', () => {
  it('layout function exists and returns result', () => {
    const minimalDoc: Document = {
      meta: { title: 'Test', language: 'he', direction: 'rtl' },
      styles: {
        body: {
          font: 'Ezra SIL',
          size: 11,
          lineHeight: 14,
          align: 'justify',
        },
      },
      pageSpec: {
        width: ptToMpt(498.9),
        height: ptToMpt(708.66),
        marginInner: ptToMpt(56.69),
        marginOuter: ptToMpt(42.52),
        marginTop: ptToMpt(56.69),
        marginBottom: ptToMpt(56.69),
        columns: 2,
        columnGap: ptToMpt(28.35),
        baselineGrid: ptToMpt(14),
      },
      sections: [
        {
          kind: 'body',
          blocks: [
            {
              id: 'block-1',
              style: 'body',
              runs: [{ text: 'בראשית ברא אלוהים' }],
            },
          ],
        },
      ],
      notes: [],
    };

    const result = layout(minimalDoc);

    expect(result).toBeDefined();
    expect(result.status).toBe('invalid'); // Expected: not implemented yet
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe('CONFIG_INVALID');
    expect(result.diagnostics[0].message).toContain('not yet implemented');
    expect(result.metrics.processingTimeMs).toBeGreaterThan(0);
  });

  it('accepts custom configuration', () => {
    const doc: Document = {
      meta: {},
      styles: {},
      pageSpec: {
        width: ptToMpt(500),
        height: ptToMpt(700),
        marginInner: ptToMpt(50),
        marginOuter: ptToMpt(50),
        marginTop: ptToMpt(50),
        marginBottom: ptToMpt(50),
        columns: 2,
        columnGap: ptToMpt(20),
        baselineGrid: ptToMpt(14),
      },
      sections: [],
      notes: [],
    };

    const config = {
      ...DEFAULT_ENGINE_CONFIG,
      trace: true,
    };

    const result = layout(doc, config);
    
    expect(result.configHash).toBeDefined();
    // Trace should be undefined because no pages were generated
    expect(result.trace).toBeUndefined();
  });
});

// Re-export to avoid unused import warning
import { DEFAULT_ENGINE_CONFIG } from '../../src/core/config.js';
