#!/usr/bin/env node
import fs from "node:fs";

if (process.env.GITHUB_EVENT_NAME !== "pull_request") {
  console.log("[pr-template] Not a pull_request event; skipping.");
  process.exit(0);
}

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath || !fs.existsSync(eventPath)) {
  console.error("[pr-template] GITHUB_EVENT_PATH is not available.");
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
const body = payload.pull_request?.body ?? "";

function sectionContent(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`##\\s*${escaped}\\s*\\n([\\s\\S]*?)(\\n##\\s|$)`, "i");
  const match = markdown.match(re);
  if (!match) return "";
  return match[1].replace(/[`*_>\-\[\]\(\)]/g, "").trim();
}

const requiredHeadings = ["Where logic lives", "Test evidence"];
const failures = [];

for (const heading of requiredHeadings) {
  const content = sectionContent(body, heading);
  if (!content || content.length < 10) {
    failures.push(`Section "## ${heading}" is missing or empty.`);
  }
}

if (failures.length > 0) {
  console.error("[pr-template] FAILED");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[pr-template] OK");
