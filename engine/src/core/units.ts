/**
 * Unit system: All coordinates and distances are stored as integers
 * representing thousands of points (mpt = milli-points).
 * 
 * 1 point (pt) = 1000 mpt
 * 1 inch = 72 pt = 72000 mpt
 * 1 mm ≈ 2.834646 pt ≈ 2834.646 mpt
 * 
 * This approach ensures:
 * - Deterministic calculations (no floating-point errors)
 * - Consistent precision across all operations
 * - Easy conversion to/from points only at I/O boundaries
 */

/** Coordinate in milli-points (integer) */
export type Coord = number;

/** Distance in milli-points (integer) */
export type Distance = number;

/** Point (standard typographic unit) */
export type Point = number;

/** Constants */
export const MPT_PER_PT = 1000;
export const PT_PER_INCH = 72;
export const MPT_PER_INCH = PT_PER_INCH * MPT_PER_PT;
export const PT_PER_MM = 72 / 25.4;
export const MPT_PER_MM = PT_PER_MM * MPT_PER_PT;

/**
 * Convert points to milli-points (for input)
 */
export function ptToMpt(pt: Point): Distance {
  const mpt = Math.round(pt * MPT_PER_PT);
  if (!Number.isSafeInteger(mpt)) {
    throw new Error(`ptToMpt: value ${pt}pt exceeds safe integer range`);
  }
  return mpt;
}

/**
 * Convert milli-points to points (for output)
 */
export function mptToPt(mpt: Distance): Point {
  return mpt / MPT_PER_PT;
}

/**
 * Convert millimeters to milli-points
 */
export function mmToMpt(mm: number): Distance {
  const mpt = Math.round(mm * MPT_PER_MM);
  if (!Number.isSafeInteger(mpt)) {
    throw new Error(`mmToMpt: value ${mm}mm exceeds safe integer range`);
  }
  return mpt;
}

/**
 * Convert milli-points to millimeters
 */
export function mptToMm(mpt: Distance): number {
  return mpt / MPT_PER_MM;
}

/**
 * Validate that a value is a safe integer (mpt)
 */
export function validateMpt(value: number, context: string): Distance {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${context}: ${value} is not a safe integer`);
  }
  return value;
}

/**
 * Rectangle in milli-points
 */
export interface Rect {
  x: Coord;
  y: Coord;
  width: Distance;
  height: Distance;
}

/**
 * Point (position) in 2D space
 */
export interface Position {
  x: Coord;
  y: Coord;
}
