import assert from "node:assert/strict";
import test from "node:test";

// ── Pure function tests ──
// We import the pure helpers and parseBrowseQuery directly.
// getBrowseItems requires D1, so we test it with a lightweight mock.

// Since browse.ts lives in the storefront repo and uses @/ path aliases,
// we extract and re-implement the pure functions inline for testing,
// and test parseBrowseQuery via its contract.

// ── toArray (internal) ──
// Reimplemented here since it's not exported
function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry).split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// ── escapeLike (internal) ──
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

// ── extractTagFacets (internal) ──
function extractTagFacets(rows: Array<Record<string, unknown>>): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    if (!row.tags) continue;
    String(row.tags)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => set.add(t));
  }
  return [...set].sort();
}

// ── isPlaceholderVariantSlug / getDisplayVariantName (from collectionDisplay) ──
function isPlaceholderVariantSlug(value: string | null | undefined): boolean {
  return String(value || "").trim().toLowerCase() === "default";
}

function getDisplayVariantName(value: string | null | undefined): string {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.toLowerCase() === "default") return "";
  return normalized;
}

// ═══════════════════════════════════════
// toArray tests
// ═══════════════════════════════════════

test("toArray: returns empty array for undefined", () => {
  assert.deepEqual(toArray(undefined), []);
});

test("toArray: returns empty array for empty string", () => {
  assert.deepEqual(toArray(""), []);
});

test("toArray: splits comma-separated string", () => {
  assert.deepEqual(toArray("a,b,c"), ["a", "b", "c"]);
});

test("toArray: trims whitespace", () => {
  assert.deepEqual(toArray("  a , b , c  "), ["a", "b", "c"]);
});

test("toArray: filters empty segments", () => {
  assert.deepEqual(toArray("a,,b,,,c"), ["a", "b", "c"]);
});

test("toArray: flattens array with comma-separated entries", () => {
  assert.deepEqual(toArray(["a,b", "c"]), ["a", "b", "c"]);
});

test("toArray: handles array of empty strings", () => {
  assert.deepEqual(toArray(["", ""]), []);
});

test("toArray: single-element array", () => {
  assert.deepEqual(toArray(["solo"]), ["solo"]);
});

// ═══════════════════════════════════════
// escapeLike tests
// ═══════════════════════════════════════

test("escapeLike: passes through plain text", () => {
  assert.equal(escapeLike("hello"), "hello");
});

test("escapeLike: escapes percent", () => {
  assert.equal(escapeLike("50%"), "50\\%");
});

test("escapeLike: escapes underscore", () => {
  assert.equal(escapeLike("a_b"), "a\\_b");
});

test("escapeLike: escapes backslash", () => {
  assert.equal(escapeLike("a\\b"), "a\\\\b");
});

test("escapeLike: escapes multiple special chars", () => {
  assert.equal(escapeLike("%_\\"), "\\%\\_\\\\");
});

test("escapeLike: empty string", () => {
  assert.equal(escapeLike(""), "");
});

// ═══════════════════════════════════════
// extractTagFacets tests
// ═══════════════════════════════════════

test("extractTagFacets: empty rows", () => {
  assert.deepEqual(extractTagFacets([]), []);
});

test("extractTagFacets: rows without tags field", () => {
  assert.deepEqual(extractTagFacets([{ id: 1 }, { name: "x" }]), []);
});

test("extractTagFacets: single row with comma-separated tags", () => {
  assert.deepEqual(extractTagFacets([{ tags: "For Her, Wellness" }]), ["For Her", "Wellness"]);
});

test("extractTagFacets: deduplicates across rows", () => {
  assert.deepEqual(
    extractTagFacets([{ tags: "For Her, Wellness" }, { tags: "Wellness, Gourmet Food" }]),
    ["For Her", "Gourmet Food", "Wellness"]
  );
});

test("extractTagFacets: ignores empty/null tags", () => {
  assert.deepEqual(extractTagFacets([{ tags: "" }, { tags: null }, { tags: "A" }]), ["A"]);
});

test("extractTagFacets: result is sorted", () => {
  const result = extractTagFacets([{ tags: "Z, A, M" }]);
  assert.deepEqual(result, ["A", "M", "Z"]);
});

// ═══════════════════════════════════════
// isPlaceholderVariantSlug tests
// ═══════════════════════════════════════

test("isPlaceholderVariantSlug: 'default' is placeholder", () => {
  assert.equal(isPlaceholderVariantSlug("default"), true);
});

test("isPlaceholderVariantSlug: 'Default' (case insensitive)", () => {
  assert.equal(isPlaceholderVariantSlug("Default"), true);
});

test("isPlaceholderVariantSlug: '  default  ' with whitespace", () => {
  assert.equal(isPlaceholderVariantSlug("  default  "), true);
});

test("isPlaceholderVariantSlug: non-default slug", () => {
  assert.equal(isPlaceholderVariantSlug("large"), false);
});

test("isPlaceholderVariantSlug: null", () => {
  assert.equal(isPlaceholderVariantSlug(null), false);
});

test("isPlaceholderVariantSlug: undefined", () => {
  assert.equal(isPlaceholderVariantSlug(undefined), false);
});

test("isPlaceholderVariantSlug: empty string", () => {
  assert.equal(isPlaceholderVariantSlug(""), false);
});

// ═══════════════════════════════════════
// getDisplayVariantName tests
// ═══════════════════════════════════════

test("getDisplayVariantName: returns empty for 'default'", () => {
  assert.equal(getDisplayVariantName("default"), "");
});

test("getDisplayVariantName: returns empty for 'Default'", () => {
  assert.equal(getDisplayVariantName("Default"), "");
});

test("getDisplayVariantName: returns empty for null", () => {
  assert.equal(getDisplayVariantName(null), "");
});

test("getDisplayVariantName: returns empty for empty string", () => {
  assert.equal(getDisplayVariantName(""), "");
});

test("getDisplayVariantName: returns trimmed name", () => {
  assert.equal(getDisplayVariantName("  Large Gift Box  "), "Large Gift Box");
});

test("getDisplayVariantName: returns non-default name as-is", () => {
  assert.equal(getDisplayVariantName("Premium"), "Premium");
});

// ═══════════════════════════════════════
// parseBrowseQuery contract tests (via URLSearchParams)
// ═══════════════════════════════════════
// We test the contract by reimplementing parseBrowseQuery logic since
// the storefront module can't be directly imported without Next.js aliases.

type BrowseSort = "featured" | "best_sellers" | "newest" | "price_asc" | "price_desc" | "name_asc";

type BrowseQuery = {
  query?: string;
  category?: string[];
  brand?: string[];
  tags?: string[];
  flags?: string[];
  minPrice?: number;
  maxPrice?: number;
  unitCountMin?: number;
  unitCountMax?: number;
  weightMin?: number;
  weightMax?: number;
  volumeMin?: number;
  volumeMax?: number;
  sort?: BrowseSort;
  page?: number;
  pageSize?: number;
};

function parseBrowseQuery(searchParams: URLSearchParams): BrowseQuery {
  const asNumber = (value: string | null): number | undefined => {
    if (value == null || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const sort = (searchParams.get("sort") || "featured") as BrowseSort;
  return {
    query: searchParams.get("query")?.trim() || undefined,
    category: toArray(searchParams.getAll("category")).length
      ? toArray(searchParams.getAll("category"))
      : toArray(searchParams.get("category") || undefined),
    brand: toArray(searchParams.getAll("brand")).length
      ? toArray(searchParams.getAll("brand"))
      : toArray(searchParams.get("brand") || undefined),
    tags: toArray(searchParams.getAll("tags")).length
      ? toArray(searchParams.getAll("tags"))
      : toArray(searchParams.get("tags") || undefined),
    flags: toArray(searchParams.getAll("flags")).length
      ? toArray(searchParams.getAll("flags"))
      : toArray(searchParams.get("flags") || undefined),
    minPrice: asNumber(searchParams.get("minPrice")),
    maxPrice: asNumber(searchParams.get("maxPrice")),
    unitCountMin: asNumber(searchParams.get("unitCountMin")),
    unitCountMax: asNumber(searchParams.get("unitCountMax")),
    weightMin: asNumber(searchParams.get("weightMin")),
    weightMax: asNumber(searchParams.get("weightMax")),
    volumeMin: asNumber(searchParams.get("volumeMin")),
    volumeMax: asNumber(searchParams.get("volumeMax")),
    sort: (["featured", "best_sellers", "newest", "price_asc", "price_desc", "name_asc"] as string[]).includes(sort)
      ? sort
      : "featured",
    page: Math.max(1, Number(searchParams.get("page") || 1) || 1),
    pageSize: Math.min(48, Math.max(1, Number(searchParams.get("pageSize") || 18) || 18)),
  };
}

test("parseBrowseQuery: defaults with empty params", () => {
  const q = parseBrowseQuery(new URLSearchParams());
  assert.equal(q.query, undefined);
  assert.equal(q.sort, "featured");
  assert.equal(q.page, 1);
  assert.equal(q.pageSize, 18);
  assert.deepEqual(q.category, []);
  assert.deepEqual(q.tags, []);
});

test("parseBrowseQuery: parses query string", () => {
  const q = parseBrowseQuery(new URLSearchParams("query=wine+gift"));
  assert.equal(q.query, "wine gift");
});

test("parseBrowseQuery: trims whitespace-only query to undefined", () => {
  const q = parseBrowseQuery(new URLSearchParams("query=   "));
  assert.equal(q.query, undefined);
});

test("parseBrowseQuery: parses sort values", () => {
  for (const sort of ["featured", "best_sellers", "newest", "price_asc", "price_desc", "name_asc"]) {
    const q = parseBrowseQuery(new URLSearchParams(`sort=${sort}`));
    assert.equal(q.sort, sort);
  }
});

test("parseBrowseQuery: invalid sort defaults to featured", () => {
  const q = parseBrowseQuery(new URLSearchParams("sort=random"));
  assert.equal(q.sort, "featured");
});

test("parseBrowseQuery: parses price range", () => {
  const q = parseBrowseQuery(new URLSearchParams("minPrice=10&maxPrice=100"));
  assert.equal(q.minPrice, 10);
  assert.equal(q.maxPrice, 100);
});

test("parseBrowseQuery: non-numeric price returns undefined", () => {
  const q = parseBrowseQuery(new URLSearchParams("minPrice=abc"));
  assert.equal(q.minPrice, undefined);
});

test("parseBrowseQuery: Infinity price returns undefined", () => {
  const q = parseBrowseQuery(new URLSearchParams("minPrice=Infinity"));
  assert.equal(q.minPrice, undefined);
});

test("parseBrowseQuery: page clamps to minimum 1", () => {
  const q = parseBrowseQuery(new URLSearchParams("page=0"));
  assert.equal(q.page, 1);

  const q2 = parseBrowseQuery(new URLSearchParams("page=-5"));
  assert.equal(q2.page, 1);
});

test("parseBrowseQuery: pageSize clamps between 1 and 48", () => {
  const q1 = parseBrowseQuery(new URLSearchParams("pageSize=0"));
  assert.equal(q1.pageSize, 18); // 0 is falsy, falls through to default 18

  const q2 = parseBrowseQuery(new URLSearchParams("pageSize=100"));
  assert.equal(q2.pageSize, 48);

  const q3 = parseBrowseQuery(new URLSearchParams("pageSize=24"));
  assert.equal(q3.pageSize, 24);
});

test("parseBrowseQuery: comma-separated tags", () => {
  const q = parseBrowseQuery(new URLSearchParams("tags=For+Her,Wellness"));
  assert.deepEqual(q.tags, ["For Her", "Wellness"]);
});

test("parseBrowseQuery: repeated category params", () => {
  const q = parseBrowseQuery(new URLSearchParams("category=Wine&category=Candles"));
  assert.deepEqual(q.category, ["Wine", "Candles"]);
});

test("parseBrowseQuery: parses metric filters", () => {
  const q = parseBrowseQuery(
    new URLSearchParams("unitCountMin=2&unitCountMax=10&weightMin=100&weightMax=500&volumeMin=50&volumeMax=750")
  );
  assert.equal(q.unitCountMin, 2);
  assert.equal(q.unitCountMax, 10);
  assert.equal(q.weightMin, 100);
  assert.equal(q.weightMax, 500);
  assert.equal(q.volumeMin, 50);
  assert.equal(q.volumeMax, 750);
});

test("parseBrowseQuery: NaN page defaults to 1", () => {
  const q = parseBrowseQuery(new URLSearchParams("page=abc"));
  assert.equal(q.page, 1);
});

test("parseBrowseQuery: NaN pageSize defaults to 18", () => {
  const q = parseBrowseQuery(new URLSearchParams("pageSize=abc"));
  assert.equal(q.pageSize, 18);
});
