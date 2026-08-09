import { describe, expect, it } from "vitest";
import { cylinderProfile } from "./mockup";
import { mirrorPoints, smoothPathD, type Point } from "./croquis";

/**
 * The drawing itself needs eyes, but the geometry under it does not: the
 * spline must emit valid path data and the cylinder profile must behave like
 * a cylinder, or the "wrap" reads as a smear.
 */

describe("the cylinder profile", () => {
  const profile = cylinderProfile(44, 0.8);

  it("is symmetric about the centre of the panel", () => {
    for (let i = 0; i < profile.length; i += 1) {
      const twin = profile[profile.length - 1 - i]!;
      expect(profile[i]!.wrapCos).toBeCloseTo(twin.wrapCos, 10);
    }
  });

  it("faces the viewer at the centre and turns away at the edges", () => {
    const centre = profile[Math.floor(profile.length / 2)]!;
    const edge = profile[0]!;
    expect(centre.wrapCos).toBeGreaterThan(edge.wrapCos);
    // The edge consumes visibly more pattern than it displays.
    expect(edge.sourceScale).toBeGreaterThan(1.5);
    // The centre is almost face-on.
    expect(centre.sourceScale).toBeLessThan(1.05);
  });

  it("never divides by a vanishing surface", () => {
    // Even at full curvature the foreshortening is clamped above zero.
    for (const slice of cylinderProfile(44, 1)) {
      expect(slice.wrapCos).toBeGreaterThan(0);
      expect(Number.isFinite(slice.sourceScale)).toBe(true);
    }
  });
});

describe("the spline", () => {
  const square: readonly Point[] = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ];

  it("emits one cubic segment per point on a closed path", () => {
    const d = smoothPathD(square);
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.match(/C /g)?.length).toBe(square.length);
  });

  it("leaves an open path open", () => {
    const d = smoothPathD(square, false);
    expect(d.endsWith("Z")).toBe(false);
    expect(d.match(/C /g)?.length).toBe(square.length - 1);
  });

  it("mirrors across the figure's centre line and reverses the winding", () => {
    const mirrored = mirrorPoints([
      [200, 10],
      [250, 20],
    ]);
    expect(mirrored).toEqual([
      [350, 20],
      [400, 10],
    ]);
  });
});
