/**
 * Core type definitions for the layout engine
 * Follows specification v0.5, sections 4, 12
 */

import type { Coord, Distance, Rect } from './units.js';

/** Document metadata */
export interface Meta {
  title?: string;
  subtitle?: string;
  author?: string;
  language?: string;
  direction?: 'rtl' | 'ltr';
}

/** Page specification (section 5) */
export interface PageSpec {
  /** Page width in mpt */
  width: Distance;
  /** Page height in mpt */
  height: Distance;
  /** Inner margin (binding side) in mpt */
  marginInner: Distance;
  /** Outer margin in mpt */
  marginOuter: Distance;
  /** Top margin in mpt */
  marginTop: Distance;
  /** Bottom margin in mpt */
  marginBottom: Distance;
  /** Number of columns (default: 2) */
  columns: number;
  /** Gap between columns in mpt */
  columnGap: Distance;
  /** Baseline grid step in mpt */
  baselineGrid: Distance;
}

/** Style properties */
export interface Style {
  font: string;
  size: number; // pt
  lineHeight: number; // pt
  align: 'start' | 'end' | 'center' | 'justify';
  bold?: boolean;
  italic?: boolean;
  lastLine?: 'start' | 'end' | 'center' | 'justify';
  spaceBefore?: number; // pt
  spaceAfter?: number; // pt;
  indent?: number; // pt
  keepWithNext?: boolean;
  keepTogether?: boolean;
  widows?: number;
  orphans?: number;
  pageBreakBefore?: 'any' | 'odd';
  toc?: number; // level, or undefined
}

/** Text run with inline formatting */
export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  small?: boolean;
  font?: string;
}

/** Anchor: generic marker in text */
export interface Anchor {
  id: string;
  type: 'note' | 'heading' | 'xref' | 'index' | 'mark';
  blockId: string;
  offset: number; // character offset in block's text
}

/** Note reference (footnote/endnote) */
export interface NoteRef {
  noteId: string;
  offset: number;
}

/** Opening word flags */
export interface OpeningFlags {
  words: number; // how many words
  bold?: boolean;
  windowLines?: number; // height of window in lines (default: 1)
}

/** Block flags */
export interface BlockFlags {
  opening?: OpeningFlags;
  tocEntry?: {
    targetBlockId: string;
    level: number;
  };
}

/** Content block (paragraph, heading, etc.) */
export interface Block {
  id: string;
  style: string; // reference to styles dictionary
  runs: Run[];
  noteRefs?: NoteRef[];
  flags?: BlockFlags;
}

/** Section of document */
export interface Section {
  kind: 'front' | 'body' | 'back';
  numbering?: string;
  blocks: Block[];
}

/** Note (footnote or endnote) */
export interface Note {
  id: string;
  kind: 'foot' | 'end';
  series?: string;
  blocks: Block[];
}

/** Complete document model */
export interface Document {
  meta: Meta;
  styles: Record<string, Style>;
  pageSpec: PageSpec;
  sections: Section[];
  notes: Note[];
}

// ============================================================================
// Layout Result Types (section 12)
// ============================================================================

/** Diagnostic severity */
export type DiagnosticSeverity = 'info' | 'warning' | 'error';

/** Diagnostic code (section 12.1) */
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

/** Diagnostic message */
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

/** Waiver record (section 13) */
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

/** Glyph with position */
export interface PositionedGlyph {
  glyphId: number;
  x: Coord; // relative to run origin
  y: Coord; // relative to run origin (baseline)
  advance: Distance;
}

/** Shaped run (after HarfBuzz) */
export interface ShapedRun {
  font: string;
  size: Distance; // mpt
  glyphs: PositionedGlyph[];
  direction: 'ltr' | 'rtl';
  width: Distance; // mpt
}

/** Line in layout */
export interface Line {
  rect: Rect;
  baseline: Coord; // Y coordinate of baseline
  blockId: string;
  range: { start: number; end: number }; // character range in block
  runs: ShapedRun[];
  justify: boolean;
  flags?: {
    lastLine?: boolean;
    opening?: boolean;
  };
}

/** Note layout */
export interface NoteLayout {
  noteId: string;
  rect: Rect;
  lines: Line[];
}

/** Column layout */
export interface ColumnLayout {
  columnIndex: number;
  blocks: string[]; // block IDs
  lines: Line[];
  firstBaselineY: Coord | null;
  lastBaselineY: Coord | null;
  lineCount: number;
  occupiedHeight: Distance;
}

/** Page balance information (section 8) */
export interface BalanceInfo {
  applicable: boolean;
  targetDelta: Distance; // mpt
  actualDelta: Distance | null; // mpt
  actualDeltaLines: number | null; // derived, not a coordinate
  balanced: boolean;
  policyId: string;
}

/** Page layout */
export interface PageLayout {
  pageIndex: number; // 0-based
  pageNumberLabel: string;
  masterId: string;
  sectionId: string;
  columns: ColumnLayout[];
  notes: NoteLayout[];
  balance: BalanceInfo;
}

/** Layout metrics */
export interface LayoutMetrics {
  totalPages: number;
  balancedPages: number;
  averageBalanceDelta: number; // mpt
  worstBalanceDelta: number; // mpt
  processingTimeMs: number;
}

/** Decision trace (section 22) */
export interface DecisionTrace {
  pageIndex: number;
  decision: string;
  candidates: number;
  chosen: string;
  reason: string;
  metrics: Record<string, number>;
}

/** Layout result (section 12) */
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
