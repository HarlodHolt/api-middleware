#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoName = path.basename(process.cwd());

const configByRepo = {
  dev: {
    disallowedAdded: [/^src\/.*\/misc\//, /^src\/.*\/helpers\//, /^src\/.*\/utils\//],
    endpointPatterns: [/^src\/runtime\/middlewares\/.*\.(ts|tsx|js|jsx)$/],
    featurePatterns: [/^src\/.*\.(ts|tsx|js|jsx)$/],
    testPatterns: [/^tests\/.*\.(test|spec)\.(ts|tsx|js|jsx)$/],
    contractPatterns: [/^README\.md$/, /^docs\/ARCHITECTURE\.md$/, /^docs\/LOGGING\.md$/],
  },
  olive_and_ivory_api: {
    disallowedAdded: [/^src\/routes\/misc\//, /^src\/.*\/helpers\//, /^src\/.*\/utils\//],
    endpointPatterns: [/^src\/routes\/.*\.(ts|tsx|js|jsx)$/],
    featurePatterns: [/^src\/.*\.(ts|tsx|js|jsx)$/],
    testPatterns: [/^tests\/.*\.(test|spec)\.(ts|tsx|js|jsx)$/, /^scripts\/generate-route-verbose-tests\.mts$/],
    contractPatterns: [/^src\/lib\/apiRouteRegistry\.ts$/, /^tests\/TEST_COVERAGE_MATRIX\.md$/, /^tests\/README\.md$/],
  },
  olive_and_ivory_gifts: {
    disallowedAdded: [/^src\/.*\/misc\//, /^src\/.*\/helpers\//, /^src\/.*\/utils\//],
    endpointPatterns: [/^src\/app\/api\/.*\/route\.(ts|tsx|js|jsx)$/],
    featurePatterns: [/^src\/(app|components|hooks|lib)\/.*\.(ts|tsx|js|jsx)$/],
    testPatterns: [/^src\/.*\.(test|spec)\.(ts|tsx|js|jsx)$/, /^tests\/.*\.(test|spec)\.(ts|tsx|js|jsx)$/],
    contractPatterns: [/^src\/lib\/apiContract.*\.(ts|tsx|js|jsx)$/],
  },
  admin_olive_and_ivory_gifts: {
    disallowedAdded: [/^src\/.*\/misc\//, /^src\/.*\/helpers\//, /^src\/.*\/utils\//],
    endpointPatterns: [/^src\/app\/api\/.*\/route\.(ts|tsx|js|jsx)$/],
    featurePatterns: [/^src\/(app|components|hooks|lib)\/.*\.(ts|tsx|js|jsx)$/],
    testPatterns: [/^src\/.*\.(test|spec)\.(ts|tsx|js|jsx)$/, /^tests\/.*\.(test|spec)\.(ts|tsx|js|jsx)$/],
    contractPatterns: [/^src\/lib\/systemHealth\.ts$/, /^tests\/dashboard-health\.spec\.ts$/],
  },
};

const active = configByRepo[repoName];
if (!active) {
  console.log(`[ai-rules] No config for repo "${repoName}", skipping.`);
  process.exit(0);
}

const maxFileLines = Number.parseInt(process.env.AI_MAX_FILE_LINES || "400", 10);
const majorAdditionThreshold = Number.parseInt(process.env.AI_MAJOR_ADDITIONS || "25", 10);

function run(command) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function pickBaseRef() {
  const prBase = process.env.GITHUB_BASE_REF;
  if (prBase) return `origin/${prBase}`;
  return process.env.AI_BASE_REF || "origin/main";
}

function getMergeBase() {
  const baseRef = pickBaseRef();
  try {
    return run(`git merge-base HEAD ${baseRef}`);
  } catch {
    return run("git rev-parse HEAD~1");
  }
}

function isMatch(patterns, value) {
  return patterns.some((pattern) => pattern.test(value));
}

const mergeBase = getMergeBase();

const nameStatus = run(`git diff --name-status ${mergeBase}...HEAD`)
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [status, ...rest] = line.split("\t");
    const filePath = rest.at(-1);
    return { status, filePath };
  })
  .filter((entry) => entry.filePath && !entry.status.startsWith("D"));

const files = nameStatus.map((entry) => entry.filePath);
const addedFiles = nameStatus.filter((entry) => entry.status.startsWith("A")).map((entry) => entry.filePath);

const addedInDisallowed = addedFiles.filter((filePath) => isMatch(active.disallowedAdded, filePath));
const endpointAdds = addedFiles.filter((filePath) => isMatch(active.endpointPatterns, filePath));
const featureChanged = files.filter((filePath) => isMatch(active.featurePatterns, filePath));
const testsChanged = files.filter((filePath) => isMatch(active.testPatterns, filePath));
const contractsChanged = files.filter((filePath) => isMatch(active.contractPatterns, filePath));

const failures = [];

if (addedInDisallowed.length > 0) {
  failures.push(
    [
      "New feature code is not allowed in generic folders.",
      ...addedInDisallowed.map((filePath) => `  - ${filePath}`),
      "Move code to a domain-specific feature module path.",
    ].join("\n"),
  );
}

if (endpointAdds.length > 0 && testsChanged.length === 0) {
  failures.push(
    [
      "New endpoint/feature files were added without any test changes.",
      ...endpointAdds.map((filePath) => `  - ${filePath}`),
      "Add required unit/contract/e2e coverage in this PR.",
    ].join("\n"),
  );
}

if (featureChanged.length > 0 && testsChanged.length === 0 && contractsChanged.length === 0) {
  failures.push(
    [
      "Feature code changed without test or contract updates.",
      `Changed feature files: ${featureChanged.length}`,
      "Add tests and/or update contracts for changed modules.",
    ].join("\n"),
  );
}

const numstat = run(`git diff --numstat ${mergeBase}...HEAD`)
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [added, removed, ...rest] = line.split("\t");
    const filePath = rest.join("\t");
    return { added, removed, filePath };
  });

for (const entry of numstat) {
  if (!entry.filePath) continue;
  if (entry.added === "-") continue;
  if (!/\.(ts|tsx|js|jsx)$/.test(entry.filePath)) continue;
  if (/\.test\.|\.spec\./.test(entry.filePath)) continue;

  const additions = Number.parseInt(entry.added, 10);
  if (!Number.isFinite(additions) || additions < majorAdditionThreshold) continue;
  if (!fs.existsSync(entry.filePath)) continue;

  const loc = fs.readFileSync(entry.filePath, "utf8").split("\n").length;
  if (loc > maxFileLines) {
    failures.push(
      `Large file guardrail violated: ${entry.filePath} has ${loc} LOC with +${additions} additions. Split before major logic changes.`,
    );
  }
}

if (failures.length > 0) {
  console.error("[ai-rules] FAILED\n");
  for (const failure of failures) {
    console.error(`- ${failure}\n`);
  }
  process.exit(1);
}

console.log(
  `[ai-rules] OK (base=${mergeBase.slice(0, 8)} files=${files.length} testsChanged=${testsChanged.length} contractsChanged=${contractsChanged.length})`,
);
