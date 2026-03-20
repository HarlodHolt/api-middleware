#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const argv = new Set(process.argv.slice(2));
const isFull = argv.has("--full");
const scopeArg = [...argv].find((value) => value.startsWith("--scope="));
const selectedScopes = scopeArg
  ? new Set(
      scopeArg
        .replace("--scope=", "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    )
  : null;

const workspaces = [
  {
    key: "root",
    label: "api-middleware (root)",
    cwd: root,
    quick: ["npm run lint", "npm run typecheck", "npm run db:check", "npm run test", "npm run guard:runtime"],
    full: [
      "npm run build",
      "npm run lint",
      "npm run typecheck",
      "npm run db:check",
      "npm run test",
      "npm run guard:runtime",
      "npm run pack:check",
    ],
  },
  {
    key: "api",
    label: "olive_and_ivory_api",
    cwd: resolve(root, "olive_and_ivory_api"),
    quick: [
      "npx tsc --noEmit",
      "npm run test:routes-contract",
      "npm run test:routes-smoke",
      "npm run test:routes-verbose",
      "npm run test:collection-ai-schema",
      "npm run test:gift-item-relations",
    ],
    full: [
      "npx tsc --noEmit",
      "npm run build",
      "npm run test:routes-contract",
      "npm run test:routes-smoke",
      "npm run test:routes-verbose",
      "npm run test:collection-ai-schema",
      "npm run test:gift-item-relations",
    ],
  },
  {
    key: "storefront",
    label: "olive_and_ivory_gifts",
    cwd: resolve(root, "olive_and_ivory_gifts"),
    quick: ["npm run lint", "npm run test:unit", "npm run test:e2e:smoke"],
    full: [
      "npm run lint",
      "npm run build:next",
      "npm run pages:verify-output",
      "npm run test:unit",
      "npm run test:e2e",
    ],
  },
  {
    key: "admin",
    label: "admin_olive_and_ivory_gifts",
    cwd: resolve(root, "admin_olive_and_ivory_gifts"),
    quick: [
      "npm run lint",
      "npm run migrations:validate",
      "npm run test:ai-copy",
      "npm run test:logs-endpoint",
      "npm run test:editor-platform-contracts",
    ],
    full: [
      "npm run lint",
      "npm run migrations:validate",
      "npm run migrations:apply:local:schema",
      "npm run build",
      "npm run pages:build",
      "npm run test:ai-copy",
      "npm run test:logs-endpoint",
      "npm run test:editor-platform-contracts",
    ],
  },
];

const filtered = selectedScopes ? workspaces.filter((workspace) => selectedScopes.has(workspace.key)) : workspaces;

if (filtered.length === 0) {
  console.error("No matching scope selected. Use --scope=root,api,storefront,admin");
  process.exit(1);
}

const results = [];
const startedAt = Date.now();

console.log(`Running local test harness (${isFull ? "full" : "quick"} mode)`);

for (const workspace of filtered) {
  if (!existsSync(workspace.cwd)) {
    console.log(`\n=== ${workspace.label} [${workspace.key}] ===`);
    console.log(`SKIP: directory not found (${workspace.cwd})`);
    results.push({ workspace: workspace.key, command: "(directory missing)", ok: true, durationSeconds: "0.0" });
    continue;
  }
  const commands = isFull ? workspace.full : workspace.quick;
  console.log(`\n=== ${workspace.label} [${workspace.key}] ===`);

  for (const command of commands) {
    const runStartedAt = Date.now();
    console.log(`\n$ ${command}`);
    const run = spawnSync(command, {
      cwd: workspace.cwd,
      stdio: "inherit",
      shell: true,
      env: process.env,
    });

    const durationSeconds = ((Date.now() - runStartedAt) / 1000).toFixed(1);
    if (run.status !== 0) {
      results.push({ workspace: workspace.key, command, ok: false, durationSeconds });
      console.error(`FAILED (${durationSeconds}s): ${workspace.key} -> ${command}`);
      process.exitCode = 1;
      break;
    }

    console.log(`PASS (${durationSeconds}s): ${workspace.key} -> ${command}`);
    results.push({ workspace: workspace.key, command, ok: true, durationSeconds });
  }

  if (process.exitCode) break;
}

const totalSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\n=== Summary (${totalSeconds}s) ===`);
for (const result of results) {
  const icon = result.ok ? "PASS" : "FAIL";
  console.log(`${icon}: ${result.workspace} :: ${result.command} (${result.durationSeconds}s)`);
}

if (process.exitCode) {
  console.error("\nLocal harness failed.");
} else {
  console.log("\nLocal harness passed.");
}
