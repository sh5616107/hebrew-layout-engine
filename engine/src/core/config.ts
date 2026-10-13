/**
 * Engine configuration
 * Default values and constraints per specification v0.5
 */

/** Cost function weights (section 11, to be calibrated) */
export interface CostWeights {
  balanceDelta: number; // Critical: deviation from targetDelta
  lineTightness: number; // Word spacing deviation
  widowOrphan: number; // Widow/orphan violations
  riverScore: number; // Rivers (3+ lines with wide spacing)
  excessSpace: number; // Empty space at page/column bottom
  noteDeferral: number; // Note deferred to next page
  paragraphSpacingDelta: number; // Deviation from default paragraph spacing
  changeStability: number; // Changes from previous layout
  pageCount: number; // Tiebreaker only
}

/** Default cost weights (TEMPORARY placeholders, needs calibration per spec section 11) */
export const DEFAULT_COST_WEIGHTS: CostWeights = {
  balanceDelta: 500, // Most critical
  lineTightness: 200,
  widowOrphan: 150,
  riverScore: 100,
  excessSpace: 80,
  noteDeferral: 120, // Note placement failure
  paragraphSpacingDelta: 60, // Spacing deviation
  changeStability: 50,
  pageCount: 10, // Tiebreaker
};

/** Line breaking configuration */
export interface LineBreakConfig {
  mode: 'optimal' | 'greedy'; // Knuth-Plass or greedy
  minWordSpacing: number; // % of natural (default: 85)
  maxWordSpacing: number; // % of natural (default: 120)
  looseness?: -1 | 0 | 1; // Try to break paragraph with N fewer/more lines
}

/** Page policy configuration */
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
  targetDelta: number; // mpt (usually 0)
  emptyColumnAllowed: boolean;
  description: string;
}

/** Default page policies (section 7.5) */
export const DEFAULT_PAGE_POLICIES: Record<PagePolicyId, PagePolicy> = {
  body_full: {
    id: 'body_full',
    balanceApplies: true,
    targetDelta: 0,
    emptyColumnAllowed: false,
    description: 'Regular full body page',
  },
  body_partial: {
    id: 'body_partial',
    balanceApplies: true,
    targetDelta: 0,
    emptyColumnAllowed: false,
    description: 'Partial page due to forced break/section end',
  },
  last_page: {
    id: 'last_page',
    balanceApplies: false,
    targetDelta: 0,
    emptyColumnAllowed: true,
    description: 'Last page of document/section',
  },
  chapter_opening: {
    id: 'chapter_opening',
    balanceApplies: false, // Per master definition
    targetDelta: 0,
    emptyColumnAllowed: true,
    description: 'Chapter opening page',
  },
  part_opening: {
    id: 'part_opening',
    balanceApplies: false,
    targetDelta: 0,
    emptyColumnAllowed: true,
    description: 'Part opening page',
  },
  title_page: {
    id: 'title_page',
    balanceApplies: false,
    targetDelta: 0,
    emptyColumnAllowed: true,
    description: 'Title page',
  },
  forced_break: {
    id: 'forced_break',
    balanceApplies: true, // Inherited from original policy unless overridden
    targetDelta: 0,
    emptyColumnAllowed: false,
    description: 'Page cut by forced break',
  },
};

/** Search limits (section 7.6) */
export interface SearchLimits {
  maxPagesAround: number; // Maximum search window (default: 5)
  maxCandidatesPerPage: number; // Maximum cutpoint candidates (default: 1000)
  lookbackPages: number; // Lookback when section starts mid-page (default: 1)
}

/** Default search limits */
export const DEFAULT_SEARCH_LIMITS: SearchLimits = {
  maxPagesAround: 5,
  maxCandidatesPerPage: 1000,
  lookbackPages: 1,
};

/** Convergence configuration */
export interface ConvergenceConfig {
  maxPasses: number; // Default: 5 (section 15)
}

export const DEFAULT_CONVERGENCE: ConvergenceConfig = {
  maxPasses: 5,
};

/** Engine configuration */
export interface EngineConfig {
  version: string;
  costWeights: CostWeights;
  lineBreak: LineBreakConfig;
  pagePolicies: Record<PagePolicyId, PagePolicy>;
  searchLimits: SearchLimits;
  convergence: ConvergenceConfig;
  balanceTolerance: number; // mpt (default: 0 per section 8.2)
  trace: boolean; // Enable decision trace (section 22)
}

/** Default engine configuration */
export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  version: '0.1.0',
  costWeights: DEFAULT_COST_WEIGHTS,
  lineBreak: {
    mode: 'greedy', // Start with greedy, upgrade to optimal later
    minWordSpacing: 85,
    maxWordSpacing: 120,
  },
  pagePolicies: DEFAULT_PAGE_POLICIES,
  searchLimits: DEFAULT_SEARCH_LIMITS,
  convergence: DEFAULT_CONVERGENCE,
  balanceTolerance: 0,
  trace: false,
};

/**
 * Create a configuration hash (for LayoutResult.configHash)
 */
export function hashConfig(config: EngineConfig): string {
  // Simple JSON-based hash for now
  // TODO: Use proper hash function (crypto.subtle.digest)
  const json = JSON.stringify(config);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
