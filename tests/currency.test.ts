import assert from "node:assert/strict";
import test from "node:test";

import { formatCurrency } from "../src/currency";

test("formatCurrency formats cents to AUD dollars", () => {
  assert.equal(formatCurrency(1234), "$12.34");
});

test("formatCurrency handles zero", () => {
  assert.equal(formatCurrency(0), "$0.00");
});

test("formatCurrency handles null and undefined", () => {
  assert.equal(formatCurrency(null), "$0.00");
  assert.equal(formatCurrency(undefined), "$0.00");
});

test("formatCurrency handles sub-dollar amounts", () => {
  assert.equal(formatCurrency(99), "$0.99");
  assert.equal(formatCurrency(1), "$0.01");
});

test("formatCurrency handles large amounts", () => {
  const result = formatCurrency(1_500_000);
  assert.ok(result.includes("15,000.00") || result.includes("15000.00"));
});
