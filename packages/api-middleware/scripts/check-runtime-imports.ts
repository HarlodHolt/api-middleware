import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const runtimeDirectory = join(process.cwd(), "src/runtime");
const blockedPatterns: Array<{ label: string; matcher: RegExp }> = [
  { label: 'from "node:', matcher: /from\s+["']node:/ },
  { label: 'from "fs"', matcher: /from\s+["']fs["']/ },
  { label: 'from "path"', matcher: /from\s+["']path["']/ },
  { label: 'from "crypto"', matcher: /from\s+["']crypto["']/ },
  { label: 'from "buffer"', matcher: /from\s+["']buffer["']/ },
  { label: 'from "stream"', matcher: /from\s+["']stream["']/ },
  { label: 'from "util"', matcher: /from\s+["']util["']/ },
  { label: 'from "os"', matcher: /from\s+["']os["']/ },
  { label: 'from "child_process"', matcher: /from\s+["']child_process["']/ },
  { label: "process.", matcher: /\bprocess\./ },
  { label: "Buffer", matcher: /\bBuffer\b/ },
];

function collectFiles(directory: string): string[] {
  const collected: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const entryStats = statSync(fullPath);
    if (entryStats.isDirectory()) {
      collected.push(...collectFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      collected.push(fullPath);
    }
  }
  return collected;
}

const runtimeFiles = collectFiles(runtimeDirectory);
const violations: Array<{ filePath: string; pattern: string }> = [];

for (const filePath of runtimeFiles) {
  const sourceText = readFileSync(filePath, "utf8");
  for (const blockedPattern of blockedPatterns) {
    if (blockedPattern.matcher.test(sourceText)) {
      violations.push({ filePath, pattern: blockedPattern.label });
    }
  }
}

if (violations.length > 0) {
  console.error("Runtime import guard failed. Node-only usage found in src/runtime:");
  for (const violation of violations) {
    console.error(`- ${violation.filePath} (pattern: ${violation.pattern})`);
  }
  process.exit(1);
}

console.log(`Runtime import guard passed (${runtimeFiles.length} files checked).`);
