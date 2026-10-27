/**
 * Hebrew Book Layout Engine
 * Main entry point
 * 
 * Specification: v0.5 (October 2026)
 */

export * from './core/types.js';
export * from './core/units.js';
export * from './core/config.js';

import type { Document, LayoutResult } from './core/types.js';
import type { EngineConfig } from './core/config.js';
import { DEFAULT_ENGINE_CONFIG, hashConfig } from './core/config.js';

// Export section balancing types and functions
export type {
  LayoutParagraph,
  LayoutSection,
  ParagraphStyle,
  ParagraphOpening,
  LineBreakAlternative,
  FootnoteRef,
  FootnoteNote,
  SectionDiagnostic,
} from './core/types.js';

export type {
  SectionBalancingConfig,
  WordSpacingRangeConfig,
} from './core/config.js';

export {
  DEFAULT_SECTION_BALANCING_CONFIG,
  DEFAULT_WORD_SPACING_CONFIG,
} from './core/config.js';

export { layoutDocumentWithSections } from './core/layout-engine.js';
export { layoutText, type TextLayoutOptions } from './core/text-layout.js';
export { renderToPDF, type PDFRenderOptions } from './rendering/pdf-renderer.js';

/**
 * Main layout function
 * 
 * Takes a Document model and configuration, returns precise page layout.
 * 
 * @param document - Document model (section 4)
 * @param config - Engine configuration (optional, uses defaults)
 * @returns LayoutResult with pages, diagnostics, and metrics (section 12)
 * 
 * @example
 * ```typescript
 * const doc: Document = loadFromJSON('sample.json');
 * const result: LayoutResult = layout(doc);
 * 
 * if (result.status === 'valid') {
 *   console.log(`Laid out ${result.pages.length} pages`);
 *   renderToPDF(result, 'output.pdf');
 * } else {
 *   console.error('Layout failed:', result.diagnostics);
 * }
 * ```
 */
export function layout(
  _document: Document,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG
): LayoutResult {
  const startTime = performance.now();

  // TODO: Implement layout pipeline
  // 1. Import/validation
  // 2. Typography (shaping, bidi)
  // 3. Line breaking
  // 4. Page filling and balancing
  // 5. Refinement (TOC, xrefs, convergence)
  
  // Placeholder implementation
  const result: LayoutResult = {
    engineVersion: config.version,
    configHash: hashConfig(config),
    documentHash: 'placeholder',
    status: 'invalid',
    pages: [],
    diagnostics: [
      {
        code: 'CONFIG_INVALID',
        severity: 'error',
        message: 'Engine not yet implemented - M0 scaffold only',
      },
    ],
    metrics: {
      totalPages: 0,
      balancedPages: 0,
      averageBalanceDelta: 0,
      worstBalanceDelta: 0,
      processingTimeMs: performance.now() - startTime,
    },
  };

  return result;
}

/** Engine version */
export const ENGINE_VERSION = '0.1.0';

/** Engine name */
export const ENGINE_NAME = '@hebrew-layout/engine';
