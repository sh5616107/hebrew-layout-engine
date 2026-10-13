import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ENGINE_CONFIG,
  DEFAULT_PAGE_POLICIES,
  hashConfig,
} from '../../../src/core/config.js';

describe('Configuration', () => {
  describe('DEFAULT_PAGE_POLICIES', () => {
    it('body_full requires exact balance', () => {
      const policy = DEFAULT_PAGE_POLICIES.body_full;
      expect(policy.balanceApplies).toBe(true);
      expect(policy.targetDelta).toBe(0);
      expect(policy.emptyColumnAllowed).toBe(false);
    });

    it('last_page allows imbalance', () => {
      const policy = DEFAULT_PAGE_POLICIES.last_page;
      expect(policy.balanceApplies).toBe(false);
      expect(policy.emptyColumnAllowed).toBe(true);
    });

    it('all policies have IDs matching their keys', () => {
      Object.entries(DEFAULT_PAGE_POLICIES).forEach(([key, policy]) => {
        expect(policy.id).toBe(key);
      });
    });
  });

  describe('DEFAULT_ENGINE_CONFIG', () => {
    it('has version 0.1.0', () => {
      expect(DEFAULT_ENGINE_CONFIG.version).toBe('0.1.0');
    });

    it('balance tolerance is 0 (section 8.2)', () => {
      expect(DEFAULT_ENGINE_CONFIG.balanceTolerance).toBe(0);
    });

    it('search limit is 5 pages (section 7.6)', () => {
      expect(DEFAULT_ENGINE_CONFIG.searchLimits.maxPagesAround).toBe(5);
    });

    it('convergence max is 5 passes (section 15)', () => {
      expect(DEFAULT_ENGINE_CONFIG.convergence.maxPasses).toBe(5);
    });

    it('cost weights prioritize balance', () => {
      const weights = DEFAULT_ENGINE_CONFIG.costWeights;
      expect(weights.balanceDelta).toBeGreaterThan(weights.lineTightness);
      expect(weights.balanceDelta).toBeGreaterThan(weights.widowOrphan);
    });
  });

  describe('hashConfig', () => {
    it('returns deterministic hash', () => {
      const hash1 = hashConfig(DEFAULT_ENGINE_CONFIG);
      const hash2 = hashConfig(DEFAULT_ENGINE_CONFIG);
      expect(hash1).toBe(hash2);
    });

    it('different configs yield different hashes', () => {
      const config1 = DEFAULT_ENGINE_CONFIG;
      const config2 = {
        ...DEFAULT_ENGINE_CONFIG,
        balanceTolerance: 100,
      };
      const hash1 = hashConfig(config1);
      const hash2 = hashConfig(config2);
      expect(hash1).not.toBe(hash2);
    });

    it('hash is 8-character hex string', () => {
      const hash = hashConfig(DEFAULT_ENGINE_CONFIG);
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });
  });
});
