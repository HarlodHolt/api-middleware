import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import test from "node:test";

test("runtime import guard script passes", () => {
  const output = execSync("npm run guard:runtime", {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.match(output, /Runtime import guard passed/);
});
