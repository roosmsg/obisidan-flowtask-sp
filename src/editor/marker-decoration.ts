import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { findMarkerRanges } from "../domain/markers";

const markerMark = Decoration.mark({ class: "flowtask-marker" });

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (const range of findMarkerRanges(text)) builder.add(from + range.from, from + range.to, markerMark);
  }
  return builder.finish();
}

// Tags every %%sp-id%% marker in the editor with the class "flowtask-marker".
// The stylesheet hides tagged markers until the line is hovered or active when
// the body carries the class "flowtask-hide-markers".
export const markerDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) this.decorations = buildDecorations(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
