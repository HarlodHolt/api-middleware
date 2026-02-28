#!/usr/bin/env node
/**
 * docs_writer.ts — Docs maintenance utility for the Olive & Ivory Gifts monorepo.
 *
 * Usage:
 *   npx tsx scripts/docs_writer.ts add-task [options]
 *   npx tsx scripts/docs_writer.ts update-doc [options]
 *
 * Node 22+:  node --experimental-strip-types scripts/docs_writer.ts <cmd> [options]
 *
 * Commands
 * --------
 * add-task
 *   --title       Task title (required)
 *   --repos       Repo scope, e.g. "admin_olive_and_ivory_gifts" or "all" (required)
 *   --area        Feature area, e.g. "AI Assist", "Security", "DX" (required)
 *   --why         Short reason / risk / opportunity (required)
 *   --acceptance  Done condition; repeat flag for multiple, e.g. --acceptance "foo" --acceptance "bar"
 *   --notes       Optional refs / file paths
 *   --priority    high | medium | low  (default: medium)
 *   --section     Sub-heading to insert under, e.g. "Admin", "API Worker" (optional)
 *
 * update-doc
 *   --file        ARCHITECTURE | SECURITY | DEPENDENCIES | PROJECT_OVERVIEW | MAINTENANCE_CHECKLIST
 *   --section     Exact markdown heading text to replace (required)
 *   --content     Replacement body (if omitted, reads from stdin)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOCS_DIR = resolve(import.meta.dirname ?? ".", "../docs");

const FILE_MAP: Record<string, string> = {
  ARCHITECTURE: "ARCHITECTURE.md",
  SECURITY: "SECURITY.md",
  DEPENDENCIES: "DEPENDENCIES.md",
  PROJECT_OVERVIEW: "PROJECT_OVERVIEW.md",
  MAINTENANCE_CHECKLIST: "MAINTENANCE_CHECKLIST.md",
  TASKS: "TASKS.md",
};

const PRIORITY_HEADING: Record<string, string> = {
  high: "## High Priority",
  medium: "## Medium Priority",
  low: "## Low Priority / Polish",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskDef {
  title: string;
  repos: string;
  area: string;
  why: string;
  acceptance: string[];
  notes?: string;
  priority: "high" | "medium" | "low";
  section?: string;
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function readDoc(filePath: string): string {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return readFileSync(filePath, "utf8");
}

function writeDoc(filePath: string, content: string): void {
  writeFileSync(filePath, content, "utf8");
}

// ---------------------------------------------------------------------------
// Header meta helpers
// ---------------------------------------------------------------------------

const HEADER_RE = /^>\s*Last updated:\s*.+$/m;

/**
 * Inserts or updates the "Last updated / Owner / Scope" block at the top of a
 * doc file.  The block sits between the first `# Heading` and the content, or
 * at the very top if no heading is found.
 */
function ensureHeaderMeta(
  content: string,
  scope: string,
  owner = "repo agent / Yuri"
): string {
  const today = new Date().toISOString().slice(0, 10);
  const block = `> Last updated: ${today}\n> Owner: ${owner}\n> Scope: ${scope}\n\n`;

  if (HEADER_RE.test(content)) {
    return updateHeaderDate(content);
  }

  // Insert after the first `# Heading` line if one exists.
  const lines = content.split("\n");
  const h1Idx = lines.findIndex((l) => /^#\s/.test(l));
  if (h1Idx !== -1) {
    lines.splice(h1Idx + 1, 0, "", block.trimEnd());
    return lines.join("\n");
  }
  return block + content;
}

/** Updates the date on an existing "Last updated:" line. */
function updateHeaderDate(content: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return content.replace(HEADER_RE, `> Last updated: ${today}`);
}

// ---------------------------------------------------------------------------
// Heading utilities
// ---------------------------------------------------------------------------

function headingLevel(line: string): number {
  const m = line.match(/^(#{1,6})\s/);
  return m ? m[1].length : 0;
}

function headingText(line: string): string {
  return line.replace(/^#+\s*/, "").trim();
}

/**
 * Returns the [startLine, endLine) range for a heading in `lines`.
 * `endLine` is the index of the first line that is a heading of equal or
 * higher importance, or lines.length if none found.
 * Returns null when the heading is not found.
 */
function findHeadingRange(
  lines: string[],
  heading: string
): { start: number; end: number } | null {
  // Accept bare text ("High Priority") or prefixed ("## High Priority").
  const targetText = headingText(heading);
  const targetLevel = headingLevel(heading) || 2; // default h2

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const lvl = headingLevel(lines[i]);
    if (lvl === targetLevel && headingText(lines[i]) === targetText) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const lvl = headingLevel(lines[i]);
    if (lvl > 0 && lvl <= targetLevel) {
      end = i;
      break;
    }
  }
  return { start, end };
}

// ---------------------------------------------------------------------------
// Task formatting
// ---------------------------------------------------------------------------

function formatTask(task: TaskDef): string {
  const acceptanceLines =
    task.acceptance.length > 0
      ? task.acceptance.map((a) => `    - ${a}`).join("\n")
      : "    - (to be defined)";

  const notesPart = task.notes ? `\n  - **Notes:** ${task.notes}` : "";

  return [
    `- [ ] **${task.title}**`,
    `  - **Repo(s):** ${task.repos}`,
    `  - **Area:** ${task.area}`,
    `  - **Why:** ${task.why}`,
    `  - **Acceptance:**`,
    acceptanceLines,
    `  - **Priority:** ${task.priority}${notesPart}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Task deduplication
// ---------------------------------------------------------------------------

/** Returns true if a task with this exact title already exists in the content. */
function taskExists(content: string, title: string): boolean {
  // Match "- [ ] **<title>**" or "- [x] **<title>**"
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^- \\[[ x]\\] \\*\\*${escaped}\\*\\*`, "m").test(content);
}

/**
 * Replaces an existing task block (from its `- [ ] **title**` line through
 * the next blank line or next task/heading) with the new formatted task.
 */
function replaceExistingTask(content: string, task: TaskDef): string {
  const escaped = task.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match the task item: from the checklist line to the next blank line
  // (or next checklist item or heading).
  const taskRe = new RegExp(
    `(- \\[[ x]\\] \\*\\*${escaped}\\*\\*[\\s\\S]*?)(?=\\n\\n- \\[|\\n\\n##|\\n\\n###|$)`,
    "m"
  );
  return content.replace(taskRe, formatTask(task));
}

// ---------------------------------------------------------------------------
// insertOrUpdateTask
// ---------------------------------------------------------------------------

/**
 * Inserts a new task (or updates an existing one) in docs/TASKS.md.
 *
 * Insertion logic:
 * 1. If a task with the same title exists anywhere → update in place.
 * 2. Find the priority heading (`## High Priority` etc.)
 * 3. If `section` is given, find the `### <section>` sub-heading within the
 *    priority block and append there; create the sub-heading if missing.
 * 4. Otherwise append directly after the priority heading.
 */
function insertOrUpdateTask(content: string, task: TaskDef): string {
  // 1. Update in place if already exists.
  if (taskExists(content, task.title)) {
    console.log(`  ↻  Updating existing task: "${task.title}"`);
    return replaceExistingTask(content, task);
  }

  const lines = content.split("\n");
  const priorityHeading = PRIORITY_HEADING[task.priority];

  // 2. Find priority section.
  const priorityRange = findHeadingRange(lines, priorityHeading);
  if (!priorityRange) {
    // Append priority section at end.
    const formatted = `\n${priorityHeading}\n\n${formatTask(task)}\n`;
    return content + formatted;
  }

  // 3. If section requested, find or create sub-heading inside priority range.
  if (task.section) {
    const sectionHeading = `### ${task.section}`;
    // Search only within the priority block.
    const blockLines = lines.slice(priorityRange.start, priorityRange.end);
    const sectionIdx = blockLines.findIndex(
      (l) =>
        headingLevel(l) === 3 && headingText(l) === task.section
    );

    if (sectionIdx !== -1) {
      // Section exists — find its end within the block.
      const absStart = priorityRange.start + sectionIdx;
      const sectionRange = findHeadingRange(lines, sectionHeading);
      if (sectionRange) {
        // Insert task before the section's end.
        const insertAt = findTaskInsertPoint(lines, sectionRange.start + 1, sectionRange.end);
        lines.splice(insertAt, 0, "", formatTask(task));
        return lines.join("\n");
      }
    }

    // Section doesn't exist — create it before the priority section ends.
    const insertAt = priorityRange.end;
    lines.splice(insertAt, 0, "", sectionHeading, "", formatTask(task), "");
    return lines.join("\n");
  }

  // 4. Insert after the priority heading line.
  const insertAt = findTaskInsertPoint(lines, priorityRange.start + 1, priorityRange.end);
  lines.splice(insertAt, 0, "", formatTask(task));
  return lines.join("\n");
}

/**
 * Finds the best insertion point: after the last existing task in a range,
 * but before the next sub-heading.
 */
function findTaskInsertPoint(lines: string[], from: number, to: number): number {
  let lastTaskLine = from;
  for (let i = from; i < to; i++) {
    if (/^- \[[ x]\]/.test(lines[i])) {
      // Scan forward to the end of this task block.
      let j = i + 1;
      while (j < to && lines[j] !== "" && !lines[j].startsWith("#")) j++;
      lastTaskLine = j;
    }
  }
  return lastTaskLine;
}

// ---------------------------------------------------------------------------
// update-doc command
// ---------------------------------------------------------------------------

function updateDocSection(
  filePath: string,
  section: string,
  newBody: string
): void {
  let content = readDoc(filePath);
  const lines = content.split("\n");

  // Normalise heading search: allow with or without # prefix.
  const targetLevel = headingLevel(section) || 2;
  const fullHeading =
    headingLevel(section) > 0 ? section : `${"#".repeat(targetLevel)} ${section}`;

  const range = findHeadingRange(lines, fullHeading);
  if (!range) {
    throw new Error(`Heading not found in ${filePath}: "${section}"`);
  }

  // Replace lines from start+1 to end with new body.
  const headingLine = lines[range.start];
  const afterLines = lines.slice(range.end);
  const bodyLines = newBody.trimEnd().split("\n");

  const updated = [
    ...lines.slice(0, range.start),
    headingLine,
    "",
    ...bodyLines,
    "",
    ...afterLines,
  ].join("\n");

  writeDoc(filePath, updateHeaderDate(updated));
  console.log(`  ✓  Updated section "${section}" in ${filePath}`);
}

// ---------------------------------------------------------------------------
// Argument parser
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      const existing = result[key];
      if (existing !== undefined) {
        result[key] = Array.isArray(existing)
          ? [...existing, value]
          : [existing as string, value];
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

function str(v: string | string[] | undefined, fallback = ""): string {
  if (v === undefined) return fallback;
  return Array.isArray(v) ? v[0] : v;
}

function arr(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function main(): void {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);

  switch (command) {
    case "add-task": {
      const title = str(args.title);
      const repos = str(args.repos);
      const area = str(args.area);
      const why = str(args.why);
      const acceptance = arr(args.acceptance);
      const notes = str(args.notes) || undefined;
      const priority = (str(args.priority, "medium") as TaskDef["priority"]);
      const section = str(args.section) || undefined;

      if (!title || !repos || !area || !why) {
        console.error("Error: --title, --repos, --area and --why are required.");
        process.exit(1);
      }

      const tasksPath = resolve(DOCS_DIR, "TASKS.md");
      let content = readDoc(tasksPath);
      content = insertOrUpdateTask(content, {
        title,
        repos,
        area,
        why,
        acceptance,
        notes,
        priority,
        section,
      });
      content = updateHeaderDate(content);
      writeDoc(tasksPath, content);
      console.log(`  ✓  Task "${title}" written to docs/TASKS.md`);
      break;
    }

    case "update-doc": {
      const fileKey = str(args.file).toUpperCase();
      const section = str(args.section);
      let newContent = str(args.content);

      if (!fileKey || !section) {
        console.error("Error: --file and --section are required.");
        process.exit(1);
      }

      if (!newContent) {
        // Read from stdin.
        newContent = readFileSync("/dev/stdin", "utf8");
      }

      const fileName = FILE_MAP[fileKey];
      if (!fileName) {
        console.error(`Error: unknown --file "${fileKey}". Valid: ${Object.keys(FILE_MAP).join(", ")}`);
        process.exit(1);
      }

      const filePath = resolve(DOCS_DIR, fileName);
      updateDocSection(filePath, section, newContent);
      break;
    }

    case "ensure-headers": {
      // Utility: adds/updates header meta on all docs files.
      const entries: Array<[string, string]> = [
        ["TASKS.md", "Task backlog for the Olive & Ivory Gifts project"],
        ["ARCHITECTURE.md", "System architecture and request flows"],
        ["SECURITY.md", "Vulnerability and security posture tracking"],
        ["DEPENDENCIES.md", "Inter-repo and external service dependency map"],
        ["PROJECT_OVERVIEW.md", "Top-level project summary"],
        ["MAINTENANCE_CHECKLIST.md", "Recurring dev and deploy checklists"],
      ];
      for (const [fileName, scope] of entries) {
        const filePath = resolve(DOCS_DIR, fileName);
        if (!existsSync(filePath)) continue;
        let content = readDoc(filePath);
        content = ensureHeaderMeta(content, scope);
        writeDoc(filePath, content);
        console.log(`  ✓  Header meta ensured: ${fileName}`);
      }
      break;
    }

    default:
      console.log(`
docs_writer.ts — Olive & Ivory Gifts docs utility

Commands:
  add-task      Add or update a task in docs/TASKS.md
  update-doc    Replace a section in a docs file
  ensure-headers  Add/update "Last updated" blocks on all docs files

Run with --help on any command for options, or see file header for full docs.
`);
  }
}

main();
