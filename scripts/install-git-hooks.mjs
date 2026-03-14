#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const hooksDir = resolve(root, ".githooks");
const prePushHook = resolve(hooksDir, "pre-push");

if (!existsSync(prePushHook)) {
  console.error(`Missing hook file: ${prePushHook}`);
  process.exit(1);
}

execSync("git config --local core.hooksPath .githooks", {
  cwd: root,
  stdio: "inherit",
});

console.log("Git hooks installed.");
console.log("Configured core.hooksPath=.githooks");
console.log("pre-push will now run: npm run test:prepush");
