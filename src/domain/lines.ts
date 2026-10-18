// Finds the line a marker belongs to after the note may have changed while a
// task was being created. The expected index is tried first; otherwise the
// nearest line with the same text wins, then the nearest line that continues
// the original text (the user kept typing on it). Returns undefined when the
// line is gone, so the marker is never appended to an unrelated line.
export function locateLine(lines: string[], expectedIndex: number, original: string): number | undefined {
  if (lines[expectedIndex] === original) return expectedIndex;
  const matches = (predicate: (line: string) => boolean): number | undefined => {
    for (let distance = 0; distance < lines.length; distance++) {
      for (const index of [expectedIndex - distance, expectedIndex + distance]) {
        if (index >= 0 && index < lines.length && predicate(lines[index])) return index;
      }
    }
    return undefined;
  };
  const trimmed = original.trimEnd();
  return matches((line) => line === original) ?? matches((line) => trimmed.length > 0 && line.startsWith(trimmed) && line.length > trimmed.length);
}
