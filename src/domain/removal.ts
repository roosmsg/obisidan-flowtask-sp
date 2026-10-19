// Tracks which linked tasks have disappeared from the vault. A marker counts
// as removed only after it has been missing from every note for a number of
// consecutive scans, so a line that is being retyped or moved to another note
// is not mistaken for a deletion.
export interface RemovalState {
  known: Set<string>;
  missing: Map<string, number>;
}

export function createRemovalState(): RemovalState {
  return { known: new Set(), missing: new Map() };
}

// Updates the state with the markers present in this scan and returns the ids
// whose markers have now been missing for `graceScans` scans in a row.
export function findRemovedMarkers(state: RemovalState, present: Set<string>, graceScans = 2): string[] {
  const removed: string[] = [];
  for (const id of state.known) {
    if (present.has(id)) { state.missing.delete(id); continue; }
    const count = (state.missing.get(id) ?? 0) + 1;
    if (count >= graceScans) {
      removed.push(id);
      state.known.delete(id);
      state.missing.delete(id);
    } else {
      state.missing.set(id, count);
    }
  }
  for (const id of present) state.known.add(id);
  return removed;
}
