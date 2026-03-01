#!/usr/bin/env node
/**
 * docs_writer.selftest.ts — In-process tests for docs_writer helpers.
 *
 * Run with:
 *   npx tsx scripts/docs_writer.selftest.ts
 *   node --experimental-strip-types scripts/docs_writer.selftest.ts
 *
 * Exits 0 on pass, 1 on failure.
 * Does NOT touch any real docs files — all tests operate on in-memory strings.
 */

// ---------------------------------------------------------------------------
// Inline copies of the helpers under test (avoids import path issues in the
// self-test context; keep in sync with docs_writer.ts).
// ---------------------------------------------------------------------------

function headingLevel(line: string): number {
  const m = line.match(/^(#{1,6})\s/);
  return m ? m[1].length : 0;
}

function headingText(line: string): string {
  return line.replace(/^#+\s*/, "").trim();
}

function findHeadingRange(lines: string[], heading: string): { start: number; end: number } | null {
  const targetText = headingText(heading);
  const targetLevel = headingLevel(heading) || 2;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingLevel(lines[i]) === targetLevel && headingText(lines[i]) === targetText) {
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

const HEADER_RE = /^>\s*Last updated:\s*.+$/m;

function ensureHeaderMeta(content: string, scope: string, owner = "repo agent / Yuri"): string {
  const today = new Date().toISOString().slice(0, 10);
  const block = `> Last updated: ${today}\n> Owner: ${owner}\n> Scope: ${scope}\n\n`;
  if (HEADER_RE.test(content)) {
    return content.replace(HEADER_RE, `> Last updated: ${today}`);
  }
  const lines = content.split("\n");
  const h1Idx = lines.findIndex((l) => /^#\s/.test(l));
  if (h1Idx !== -1) {
    lines.splice(h1Idx + 1, 0, "", block.trimEnd());
    return lines.join("\n");
  }
  return block + content;
}

function updateHeaderDate(content: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return content.replace(HEADER_RE, `> Last updated: ${today}`);
}

function taskExists(content: string, title: string): boolean {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^- \\[[ x]\\] \\*\\*${escaped}\\*\\*`, "m").test(content);
}

function formatTask(task: {
  title: string;
  repos: string;
  area: string;
  why: string;
  acceptance: string[];
  notes?: string;
  priority: string;
}): string {
  const acceptanceLines =
    task.acceptance.length > 0 ? task.acceptance.map((a) => `    - ${a}`).join("\n") : "    - (to be defined)";
  const notesPart = task.notes ? `\n  - **Notes:** ${task.notes}` : "";
  return [
    `- [ ] **${task.title}**`,
    `  - **Repo(s):** ${task.repos}`,
    `  - **Area:** ${task.area}`,
    `  - **Why:** ${task.why}`,
    "  - **Acceptance:**",
    acceptanceLines,
    `  - **Priority:** ${task.priority}${notesPart}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗  ${name}\n     ${msg}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertIncludes(haystack: string, needle: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`Expected to find:\n  ${needle}\nIn:\n  ${haystack.slice(0, 300)}`);
  }
}

function assertNotIncludes(haystack: string, needle: string): void {
  if (haystack.includes(needle)) {
    throw new Error(`Expected NOT to find:\n  ${needle}`);
  }
}

// ---------------------------------------------------------------------------
// Tests: findHeadingRange
// ---------------------------------------------------------------------------

test("findHeadingRange: finds h2 by text", () => {
  const lines = ["# Doc", "## Alpha", "content", "## Beta", "more"];
  const r = findHeadingRange(lines, "## Alpha");
  assert(r !== null, "range should not be null");
  assert(r?.start === 1, `start should be 1, got ${r?.start}`);
  assert(r?.end === 3, `end should be 3, got ${r?.end}`);
});

test("findHeadingRange: returns null for missing heading", () => {
  const lines = ["# Doc", "## Alpha"];
  const r = findHeadingRange(lines, "## Missing");
  assert(r === null, "should return null");
});

test("findHeadingRange: section ends at same-level heading", () => {
  const lines = ["## A", "aaa", "### A.1", "detail", "## B", "bbb"];
  const r = findHeadingRange(lines, "## A");
  assert(r?.end === 4, `end should be 4, got ${r?.end}`);
});

test("findHeadingRange: range extends to EOF when no next heading", () => {
  const lines = ["## Only", "content line 1", "content line 2"];
  const r = findHeadingRange(lines, "## Only");
  assert(r?.end === 3, `end should be 3, got ${r?.end}`);
});

test("findHeadingRange: h3 sub-heading inside h2 block", () => {
  const lines = ["## High Priority", "", "### Admin", "- [ ] **task**", "### API", "stuff"];
  const r = findHeadingRange(lines, "### Admin");
  assert(r?.start === 2, `start should be 2, got ${r?.start}`);
  assert(r?.end === 4, `end should be 4, got ${r?.end}`);
});

// ---------------------------------------------------------------------------
// Tests: ensureHeaderMeta
// ---------------------------------------------------------------------------

test("ensureHeaderMeta: inserts block when missing", () => {
  const input = "# My Doc\n\nSome content.\n";
  const out = ensureHeaderMeta(input, "test scope");
  assertIncludes(out, "> Last updated:");
  assertIncludes(out, "> Owner: repo agent / Yuri");
  assertIncludes(out, "> Scope: test scope");
});

test("ensureHeaderMeta: updates existing date", () => {
  const input = "# Doc\n\n> Last updated: 2020-01-01\n> Owner: x\n> Scope: y\n\ncontent";
  const out = ensureHeaderMeta(input, "y");
  const today = new Date().toISOString().slice(0, 10);
  assertIncludes(out, `> Last updated: ${today}`);
  assertNotIncludes(out, "2020-01-01");
});

test("ensureHeaderMeta: inserts before content when no h1", () => {
  const input = "No heading here.\n";
  const out = ensureHeaderMeta(input, "scope");
  assert(out.startsWith("> Last updated:"), "should start with header");
});

// ---------------------------------------------------------------------------
// Tests: updateHeaderDate
// ---------------------------------------------------------------------------

test("updateHeaderDate: only changes the date line", () => {
  const input = "# Doc\n> Last updated: 2021-06-15\n> Owner: Yuri\ncontent";
  const out = updateHeaderDate(input);
  const today = new Date().toISOString().slice(0, 10);
  assertIncludes(out, `> Last updated: ${today}`);
  assertIncludes(out, "> Owner: Yuri");
  assertIncludes(out, "content");
});

// ---------------------------------------------------------------------------
// Tests: taskExists
// ---------------------------------------------------------------------------

test("taskExists: detects unchecked task", () => {
  const content = "## High\n\n- [ ] **My Task**\n  - **Repo(s):** all\n";
  assert(taskExists(content, "My Task"), "should find task");
});

test("taskExists: detects checked task", () => {
  const content = "## High\n\n- [x] **Done Task**\n  - **Repo(s):** all\n";
  assert(taskExists(content, "Done Task"), "should find checked task");
});

test("taskExists: returns false for missing task", () => {
  const content = "## High\n\n- [ ] **Other Task**\n";
  assert(!taskExists(content, "My Task"), "should not find task");
});

test("taskExists: requires exact title match", () => {
  const content = "- [ ] **My Task Extra**\n";
  assert(!taskExists(content, "My Task"), "should not match partial title");
});

// ---------------------------------------------------------------------------
// Tests: formatTask
// ---------------------------------------------------------------------------

test("formatTask: renders all fields", () => {
  const task = {
    title: "Do the thing",
    repos: "olive_and_ivory_api",
    area: "Security",
    why: "Prevent replay attacks",
    acceptance: ["Nonce stored in D1", "Duplicate nonce returns 401"],
    notes: "See SECURITY.md#hmac",
    priority: "high",
  };
  const out = formatTask(task);
  assertIncludes(out, "- [ ] **Do the thing**");
  assertIncludes(out, "**Repo(s):** olive_and_ivory_api");
  assertIncludes(out, "**Area:** Security");
  assertIncludes(out, "**Why:** Prevent replay attacks");
  assertIncludes(out, "- Nonce stored in D1");
  assertIncludes(out, "- Duplicate nonce returns 401");
  assertIncludes(out, "**Notes:** See SECURITY.md#hmac");
});

test("formatTask: uses placeholder when acceptance empty", () => {
  const task = {
    title: "Empty acceptance",
    repos: "all",
    area: "DX",
    why: "needed",
    acceptance: [],
    priority: "low",
  };
  const out = formatTask(task);
  assertIncludes(out, "(to be defined)");
});

test("formatTask: omits Notes line when notes undefined", () => {
  const task = {
    title: "No notes",
    repos: "all",
    area: "DX",
    why: "test",
    acceptance: ["done"],
    priority: "medium",
  };
  const out = formatTask(task);
  assertNotIncludes(out, "**Notes:**");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
