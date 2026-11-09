// Geometry for the marked-up plan sheet (launch plan Phase 7.5). Pure, in sheet pixels.
export type Pt = [number, number];

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function polylineLength(points: Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/** The point at distance `d` along the polyline (clamped to its ends). */
export function pointAt(points: Pt[], d: number): Pt {
  if (points.length === 0) return [0, 0];
  if (d <= 0) return points[0];
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = dist(points[i - 1], points[i]);
    if (walked + seg >= d) {
      const t = seg === 0 ? 0 : (d - walked) / seg;
      return [points[i - 1][0] + t * (points[i][0] - points[i - 1][0]), points[i - 1][1] + t * (points[i][1] - points[i - 1][1])];
    }
    walked += seg;
  }
  return points[points.length - 1];
}

/** Pixels per foot from two clicked points and the real distance between them. */
export function scaleFromCalibration(a: Pt, b: Pt, feet: number): number {
  if (!(feet > 0)) throw new Error("Enter the real distance in feet");
  const px = dist(a, b);
  if (px < 10) throw new Error("Click two points farther apart");
  return px / feet;
}

/**
 * Anchor-bolt marks along a traced run: one at `endIn` from each end, then evenly spaced no farther
 * apart than `spacingIn` (same count rule as the takeoff math, so marks and quantities agree).
 */
export function boltMarks(points: Pt[], pxPerFt: number, spacingIn: number, endIn: number | null): Pt[] {
  const len = polylineLength(points);
  if (len <= 0 || !(spacingIn > 0) || !(pxPerFt > 0)) return [];
  const pxPerIn = pxPerFt / 12;
  if (endIn == null) {
    const n = Math.floor(len / (spacingIn * pxPerIn)) + 1;
    return Array.from({ length: n }, (_, i) => pointAt(points, i * spacingIn * pxPerIn));
  }
  const start = endIn * pxPerIn;
  const inner = Math.max(0, len - 2 * start);
  const gaps = Math.ceil(inner / (spacingIn * pxPerIn));
  if (gaps === 0) return [pointAt(points, len / 2)];
  return Array.from({ length: gaps + 1 }, (_, i) => pointAt(points, start + (i * inner) / gaps));
}

/** Evenly placed break marks that split a traced run into `pours` pours. */
export function pourBreakMarks(points: Pt[], pours: number): Pt[] {
  if (pours < 2) return [];
  const len = polylineLength(points);
  return Array.from({ length: pours - 1 }, (_, i) => pointAt(points, ((i + 1) * len) / pours));
}

/** Traced length vs the plan's dimension, as a percent difference (positive = trace is longer). */
export function traceDifferencePct(points: Pt[], pxPerFt: number, planFt: number | null): number | null {
  if (!planFt || !(pxPerFt > 0)) return null;
  const tracedFt = polylineLength(points) / pxPerFt;
  return Math.round(((tracedFt - planFt) / planFt) * 1000) / 10;
}
