#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

const REPOS = [
  {
    key: "api",
    migrationsDir: resolve(root, "olive_and_ivory_api/migrations"),
  },
  {
    key: "admin",
    migrationsDir: resolve(root, "admin_olive_and_ivory_gifts/migrations"),
  },
];

const CANONICAL_EVENT_LOG_COLUMNS = [
  "id",
  "created_at",
  "level",
  "source",
  "action",
  "correlation_id",
  "user_email",
  "user_id",
  "entity_type",
  "entity_id",
  "message",
  "data_json",
  "request_id",
  "event_type",
  "ip_address",
  "duration_ms",
  "method",
  "path",
  "status_code",
  "metadata",
];

const LOGGER_SQL_SOURCES = [
  resolve(root, "src/runtime/logging.ts"),
  resolve(root, "olive_and_ivory_api/src/lib/logger.ts"),
  resolve(root, "admin_olive_and_ivory_gifts/src/lib/logging.ts"),
];

function sortedSqlFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => resolve(dir, name));
}

function parseCreateTableColumns(tableBody) {
  return tableBody
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/,$/, ""))
    .map((line) => line.split(/\s+/)[0])
    .filter((token) => {
      const upper = token.toUpperCase();
      return upper !== "PRIMARY" && upper !== "UNIQUE" && upper !== "CONSTRAINT" && upper !== "FOREIGN";
    });
}

function extractEventLogColumnsFromMigrations(migrationFiles) {
  const columns = new Set();

  for (const file of migrationFiles) {
    const sql = readFileSync(file, "utf8");

    const createMatches = [...sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+event_logs\s*\(([^;]+?)\);/gis)];
    for (const match of createMatches) {
      const createdColumns = parseCreateTableColumns(match[1]);
      for (const column of createdColumns) {
        columns.add(column);
      }
    }

    for (const match of sql.matchAll(/ALTER TABLE\s+event_logs\s+ADD COLUMN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)) {
      columns.add(match[1]);
    }
  }

  return columns;
}

function extractInsertColumnLists(file) {
  const text = readFileSync(file, "utf8");
  const matches = [...text.matchAll(/INSERT INTO\s+event_logs\s*\(([^)]+)\)/gis)];
  return matches.map((match) =>
    match[1]
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean),
  );
}

function fail(message) {
  console.error(`DB schema check failed: ${message}`);
  process.exit(1);
}

const repoColumns = new Map();
for (const repo of REPOS) {
  const files = sortedSqlFiles(repo.migrationsDir);
  if (files.length === 0) {
    fail(`No SQL migration files found for ${repo.key} (${repo.migrationsDir})`);
  }

  const columns = extractEventLogColumnsFromMigrations(files);
  if (columns.size === 0) {
    fail(`No event_logs table definition found in ${repo.key} migrations`);
  }

  repoColumns.set(repo.key, columns);
}

const canonicalSet = new Set(CANONICAL_EVENT_LOG_COLUMNS);
for (const [repoKey, columns] of repoColumns.entries()) {
  const missingCanonical = CANONICAL_EVENT_LOG_COLUMNS.filter((column) => !columns.has(column));
  if (missingCanonical.length > 0) {
    fail(`${repoKey} event_logs is missing canonical columns: ${missingCanonical.join(", ")}`);
  }
}

const apiColumns = repoColumns.get("api");
const adminColumns = repoColumns.get("admin");
if (!apiColumns || !adminColumns) {
  fail("Missing repo column sets for comparison");
}

const apiMissingFromAdmin = [...apiColumns].filter((column) => !adminColumns.has(column));
const adminMissingFromApi = [...adminColumns].filter((column) => !apiColumns.has(column));
if (apiMissingFromAdmin.length > 0 || adminMissingFromApi.length > 0) {
  fail(
    `event_logs drift detected. api-only: [${apiMissingFromAdmin.join(", ")}], admin-only: [${adminMissingFromApi.join(", ")}]`,
  );
}

for (const sourceFile of LOGGER_SQL_SOURCES) {
  const insertColumnLists = extractInsertColumnLists(sourceFile);
  if (insertColumnLists.length === 0) {
    fail(`No event_logs INSERT statements found in ${sourceFile}`);
  }

  for (const columns of insertColumnLists) {
    const unknownColumns = columns.filter((column) => !canonicalSet.has(column));
    if (unknownColumns.length > 0) {
      fail(`${sourceFile} references unknown event_logs columns: ${unknownColumns.join(", ")}`);
    }

    const required = ["level", "source", "action", "correlation_id", "message", "data_json"];
    const missingRequired = required.filter((column) => !columns.includes(column));
    if (missingRequired.length > 0) {
      fail(`${sourceFile} has INSERT missing required log columns: ${missingRequired.join(", ")}`);
    }
  }
}

console.log("DB schema drift guard passed (event_logs migrations + logger INSERT columns).\n");
console.log(`Canonical columns checked: ${CANONICAL_EVENT_LOG_COLUMNS.length}`);
console.log(`Repos checked: ${REPOS.map((repo) => repo.key).join(", ")}`);
console.log(`Logger sources checked: ${LOGGER_SQL_SOURCES.length}`);
