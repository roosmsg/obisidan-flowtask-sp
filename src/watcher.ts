import { Notice, TFile, type App, type EventRef, type Vault } from "obsidian";
import { parseCheckboxLine } from "./domain/parser";
import { nearestHeadings, resolveHeadingTag } from "./domain/heading";
import type { BridgeSettings, FlowTask } from "./types";
import { TransportManager } from "./transport/manager";

const MARKER_RE = /(?:<!--\s*sp-id:|%%\s*sp-id:)([\w-]+)(?:\s*-->|%%)/i;
const LEGACY_MARKER_RE = /<!--\s*sp-id:([\w-]+)\s*-->/i;

type WatcherOptions = Pick<BridgeSettings, "importTag" | "tagWithHeading">;

export class CheckboxWatcher {
  private readonly timers = new Map<string, number>();
  private readonly processing = new Set<string>();
  private readonly syncedStates = new Map<string, boolean>();

  private importTag = "sp";
  private tagWithHeading = false;

  constructor(private readonly app: App, private readonly transport: TransportManager, options?: WatcherOptions) {
    if (options) this.configure(options);
  }

  configure(options: WatcherOptions): void {
    this.importTag = options.importTag.replace(/^#/, "").trim() || "sp";
    this.tagWithHeading = options.tagWithHeading;
  }

  register(vault: Vault, registerEvent: (event: EventRef) => void): void {
    registerEvent(vault.on("modify", (file) => {
      if (!(file instanceof TFile) || file.extension !== "md" || this.processing.has(file.path)) return;
      this.schedule(file);
    }));
    registerEvent(this.app.workspace.on("active-leaf-change", () => {
      const file = this.app.workspace.getActiveFile();
      if (file?.extension === "md") this.schedule(file);
    }));
  }

  async syncCurrentLine(): Promise<void> {
    const editor = this.app.workspace.activeEditor?.editor;
    const file = this.app.workspace.getActiveFile();
    if (!editor || !file) { new Notice("Open a note to sync the current line."); return; }
    const lineNumber = editor.getCursor().line;
    const heading = nearestHeadings(editor.getValue().split("\n"))[lineNumber];
    await this.processLine(file, editor.getLine(lineNumber), lineNumber, undefined, true, heading);
  }

  private schedule(file: TFile): void {
    const previous = this.timers.get(file.path);
    if (previous) window.clearTimeout(previous);
    this.timers.set(file.path, window.setTimeout(() => { void this.scanFile(file); }, 1500));
  }

  private async scanFile(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);
    const stack: Array<{ indent: number; id: string; rootId: string }> = [];
    const lines = content.split("\n");
    const headings = nearestHeadings(lines);
    for (const [lineNumber, line] of lines.entries()) {
      const match = parseCheckboxLine(line);
      if (!match) continue;
      while (stack.length && stack[stack.length - 1].indent >= match.indent.length) stack.pop();
      const parent = stack[stack.length - 1];
      const taskId = await this.processLine(file, line, lineNumber, parent?.rootId, false, headings[lineNumber]);
      if (taskId) stack.push({ indent: match.indent.length, id: taskId, rootId: parent?.rootId ?? taskId });
    }
  }

  private async processLine(file: TFile, line: string, lineNumber: number, parentId?: string, allowShortTitle = false, heading?: string): Promise<string | undefined> {
    const match = parseCheckboxLine(line);
    if (!match || !match.parsed.title) return undefined;
    const marker = line.match(MARKER_RE)?.[1];
    if (marker) {
      const stateKey = `${file.path}:${lineNumber}:${marker}`;
      const previous = this.syncedStates.get(stateKey);
      if (previous !== match.checked) {
        await this.transport.updateTask(marker, { status: match.checked ? "done" : "open" });
        this.syncedStates.set(stateKey, match.checked);
      }
      return marker;
    }

    if (!parentId && !hasImportTag(match.parsed.tagNames, this.importTag)) return undefined;
    if (!allowShortTitle && match.parsed.title.trim().length < 3) return undefined;

    const tagNames = match.parsed.tagNames.filter((tag) => tag.toLocaleLowerCase() !== this.importTag.toLocaleLowerCase());
    // Subtasks inherit from their parent, so the heading tag is only resolved
    // for top-level tasks. The tag is fixed at import time.
    if (this.tagWithHeading && heading && !parentId) {
      const headingTag = resolveHeadingTag(heading, await this.transport.listTags());
      if (headingTag && !tagNames.some((tag) => tag.toLocaleLowerCase() === headingTag.name.toLocaleLowerCase())) tagNames.push(headingTag.name);
    }

    const task = await this.transport.createTask({
      title: match.parsed.title,
      parentId,
      projectName: match.parsed.projectName,
      tagNames,
      dueDate: match.parsed.dueDate,
      estimateMinutes: match.parsed.estimateMinutes,
      notes: `Created from ${file.path}`,
    });
    if (!task) return undefined;

    const markerText = ` %%sp-id:${task.id}%%`;
    this.processing.add(file.path);
    try {
      await this.app.vault.process(file, (content) => {
        const lines = content.split("\n");
        if (lineNumber >= lines.length || lines[lineNumber].match(MARKER_RE)) return content;
        lines[lineNumber] = `${lines[lineNumber]}${markerText}`;
        return lines.join("\n");
      });
      if (match.checked) await this.transport.updateTask(task.id, { status: "done" });
      new Notice(`FlowTask: ${match.checked ? "task completed" : "task synced"}.`);
    } finally {
      this.processing.delete(file.path);
    }
    return task.id;
  }

  async syncRemoteCompletions(tasks: FlowTask[]): Promise<void> {
    const states = new Map(tasks.map((task) => [task.id, task.status === "done"]));
    // Required to find linked checkboxes in any note when completion changes in SP.
    for (const file of this.app.vault.getMarkdownFiles()) {
      const original = await this.app.vault.read(file);
      const lines = original.split("\n");
      let changed = false;
      const hierarchy: Array<{ indent: number; done: boolean }> = [];
      lines.forEach((line, index) => {
        const marker = line.match(MARKER_RE)?.[1];
        const local = parseCheckboxLine(line);
        if (!local) return;
        while (hierarchy.length && hierarchy[hierarchy.length - 1].indent >= local.indent.length) hierarchy.pop();
        const parentDone = hierarchy[hierarchy.length - 1]?.done === true;
        const directRemoteDone = marker ? states.get(marker) : undefined;
        // SP may return a child as open while the completed parent is still
        // propagating. The parent's completed state must win for its subtree.
        const remoteDone = resolveRemoteDone(parentDone, directRemoteDone);
        if (marker) hierarchy.push({ indent: local.indent.length, done: remoteDone === true });
        if (remoteDone === undefined) return;
        const migrated = line.replace(LEGACY_MARKER_RE, `%%sp-id:${marker}%%`);
        if (migrated !== line) { lines[index] = migrated; changed = true; }
        if (!local || local.checked === remoteDone) return;
        lines[index] = lines[index].replace(/^(\s*-\s+\[)[ xX](\])/, `$1${remoteDone ? "x" : " "}$2`);
        changed = true;
      });
      if (changed) {
        this.processing.add(file.path);
        try { await this.app.vault.process(file, () => lines.join("\n")); }
        finally { this.processing.delete(file.path); }
      }
    }
  }
}

export function findTaskIdInLine(line: string): string | undefined { return line.match(MARKER_RE)?.[1]; }

export function hasImportTag(tags: string[], importTag: string): boolean {
  const normalized = importTag.replace(/^#/, "").trim().toLocaleLowerCase();
  return tags.some((tag) => tag.toLocaleLowerCase() === normalized);
}

export function resolveRemoteDone(parentDone: boolean, directChildState: boolean | undefined): boolean | undefined {
  return parentDone ? true : directChildState;
}
