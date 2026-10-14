import { describe, it, expect } from 'vitest';
import {
  ptToMpt,
  mptToPt,
  mmToMpt,
  mptToMm,
  validateMpt,
  MPT_PER_MM,
} from '../../../src/core/units.js';

describe('Unit conversions', () => {
  describe('ptToMpt', () => {
    it('converts points to milli-points', () => {
      expect(ptToMpt(1)).toBe(1000);
      expect(ptToMpt(11)).toBe(11000);
      expect(ptToMpt(14)).toBe(14000);
    });

    it('rounds to nearest integer', () => {
      expect(ptToMpt(1.5)).toBe(1500);
      expect(ptToMpt(1.4)).toBe(1400);
      expect(ptToMpt(1.6)).toBe(1600);
    });

    it('throws on values exceeding safe integer', () => {
      expect(() => ptToMpt(Number.MAX_SAFE_INTEGER)).toThrow();
    });
  });

  describe('mptToPt', () => {
    it('converts milli-points to points', () => {
      expect(mptToPt(1000)).toBe(1);
      expect(mptToPt(11000)).toBe(11);
      expect(mptToPt(14000)).toBe(14);
    });

    it('handles fractional points', () => {
      expect(mptToPt(1500)).toBe(1.5);
      expect(mptToPt(1234)).toBeCloseTo(1.234, 3);
    });
  });

  describe('mmToMpt', () => {
    it('converts millimeters to milli-points', () => {
      const mm1 = mmToMpt(1);
      expect(mm1).toBeCloseTo(MPT_PER_MM, 0);
      
      // B5 width: 176mm
      const b5Width = mmToMpt(176);
      expect(mptToPt(b5Width)).toBeCloseTo(498.9, 1);
    });
  });

  describe('mptToMm', () => {
    it('converts milli-points to millimeters', () => {
      const mpt = mmToMpt(176);
      expect(mptToMm(mpt)).toBeCloseTo(176, 1);
    });
  });

  describe('validateMpt', () => {
    it('accepts safe integers', () => {
      expect(validateMpt(1000, 'test')).toBe(1000);
      expect(validateMpt(0, 'test')).toBe(0);
      expect(validateMpt(-1000, 'test')).toBe(-1000);
    });

    it('rejects non-integers', () => {
      expect(() => validateMpt(1.5, 'test')).toThrow('not a safe integer');
    });

    it('rejects unsafe integers', () => {
      expect(() => validateMpt(Number.MAX_SAFE_INTEGER + 1, 'test')).toThrow();
    });
  });

  describe('Determinism', () => {
    it('repeated conversions yield same result', () => {
      const pt = 11.5;
      const mpt1 = ptToMpt(pt);
      const mpt2 = ptToMpt(pt);
      expect(mpt1).toBe(mpt2);
    });

    it('round-trip conversion is stable', () => {
      const original = 11000; // mpt
      const pt = mptToPt(original);
      const back = ptToMpt(pt);
      expect(back).toBe(original);
    });
  });
});
