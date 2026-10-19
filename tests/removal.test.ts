import { describe, expect, it } from "vitest";
import { createRemovalState, findRemovedMarkers } from "../src/domain/removal";

describe("removed task detection", () => {
  it("never reports a marker it has not seen before", () => {
    const state = createRemovalState();
    expect(findRemovedMarkers(state, new Set(["a", "b"]))).toEqual([]);
    expect(state.known).toEqual(new Set(["a", "b"]));
  });

  it("reports a marker only after it has been missing for two scans", () => {
    const state = createRemovalState();
    findRemovedMarkers(state, new Set(["a", "b"]));
    expect(findRemovedMarkers(state, new Set(["b"]))).toEqual([]);
    expect(findRemovedMarkers(state, new Set(["b"]))).toEqual(["a"]);
    expect(state.known).toEqual(new Set(["b"]));
    expect(state.missing.size).toBe(0);
  });

  it("forgets a miss when the marker comes back, such as after a move", () => {
    const state = createRemovalState();
    findRemovedMarkers(state, new Set(["a"]));
    findRemovedMarkers(state, new Set());
    findRemovedMarkers(state, new Set(["a"]));
    expect(findRemovedMarkers(state, new Set())).toEqual([]);
    expect(findRemovedMarkers(state, new Set())).toEqual(["a"]);
  });

  it("does not report the same removal twice", () => {
    const state = createRemovalState();
    findRemovedMarkers(state, new Set(["a"]));
    findRemovedMarkers(state, new Set());
    expect(findRemovedMarkers(state, new Set())).toEqual(["a"]);
    expect(findRemovedMarkers(state, new Set())).toEqual([]);
  });

  it("respects a custom grace period", () => {
    const state = createRemovalState();
    findRemovedMarkers(state, new Set(["a"]), 1);
    expect(findRemovedMarkers(state, new Set(), 1)).toEqual(["a"]);
  });
});
