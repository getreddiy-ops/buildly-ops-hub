import { describe, expect, it } from "vitest";
import { boltMarks, pointAt, polylineLength, pourBreakMarks, scaleFromCalibration, traceDifferencePct, type Pt } from "./markup";

const L: Pt[] = [[0, 0], [300, 0], [300, 400]]; // an L-shaped run, 700 px long

describe("markup geometry", () => {
  it("measures and walks a polyline", () => {
    expect(polylineLength(L)).toBe(700);
    expect(pointAt(L, 150)).toEqual([150, 0]);
    expect(pointAt(L, 500)).toEqual([300, 200]);
    expect(pointAt(L, 9999)).toEqual([300, 400]);
  });
  it("sets scale from two clicks and a known distance", () => {
    expect(scaleFromCalibration([0, 0], [0, 250], 25)).toBe(10);
    expect(() => scaleFromCalibration([0, 0], [3, 0], 5)).toThrow(/farther apart/);
  });
  it("places bolts with the same count rule as the takeoff: 70' run, 72\" O.C., 12\" ends → 13 bolts", () => {
    // 10 px/ft → 700 px = 70 ft. Inner = 70' - 2' = 68' = 816"; ceil(816/72) = 12 gaps → 13 bolts.
    const marks = boltMarks(L, 10, 72, 12);
    expect(marks).toHaveLength(13);
    expect(marks[0]).toEqual([10, 0]);              // 12" = 10 px from the start
    expect(marks[marks.length - 1]).toEqual([300, 390]); // 12" from the far end
  });
  it("splits a run into equal pours", () => {
    expect(pourBreakMarks(L, 2)).toEqual([[300, 50]]);
    expect(pourBreakMarks(L, 1)).toEqual([]);
  });
  it("compares the traced length to the plan dimension", () => {
    expect(traceDifferencePct(L, 10, 70)).toBe(0);
    expect(traceDifferencePct(L, 10, 72)).toBe(-2.8);
    expect(traceDifferencePct(L, 10, null)).toBeNull();
  });
});
