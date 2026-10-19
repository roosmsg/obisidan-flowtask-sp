// Locates every task identity marker (%%sp-id:…%% or the legacy
// <!--sp-id:…-->) in a piece of text, as [from, to) offsets in document order.
const MARKER_RE = /%%\s*sp-id:[\w-]+\s*%%|<!--\s*sp-id:[\w-]+\s*-->/gi;

export function findMarkerRanges(text: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  for (const match of text.matchAll(MARKER_RE)) {
    ranges.push({ from: match.index, to: match.index + match[0].length });
  }
  return ranges;
}
