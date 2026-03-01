# Deep-Dive Review Schedule

**Version:** 1.0.0
**Created:** 2026-03-01
**Owner:** Engineering
**Review Cycle:** One target per calendar day

---

## 1. Overview

This document defines a systematic, security-first daily review programme for the Olive & Ivory platform.

Each day, exactly one target — a single function or a single route — is reviewed with full depth: usage mapping, database tracing, security audit, observability assessment, and documentation update requirements. Findings are written to a dedicated daily review record. Improvement tasks are always prioritised and added to `docs/TASKS.md`.

The programme is permanent. It does not pause between feature cycles. It runs even if no feature work is scheduled. It is the primary mechanism for managing architectural debt, surfacing security issues before exploitation, and maintaining documentation accuracy.

### What this is not

- It is not a code review for a PR. It is an independent audit of production code already running.
- It is not a "fix everything now" exercise. Most findings become prioritised backlog tasks.
- It is not optional. A missed day slides to the next day; the target is not skipped.

### Scope: Repos Under Review

| Repo | Runtime | Description |
|------|---------|-------------|
| `olive_and_ivory_api` | Cloudflare Workers / Hono | Core API worker — business logic, payments, orders, collections |
| `admin_olive_and_ivory_gifts` | Cloudflare Pages / Next.js (edge) | Internal admin dashboard and admin API routes |
| `olive_and_ivory_gifts` | Cloudflare Pages / Next.js (nodejs) | Public storefront and storefront API routes |
| `api-middleware` (workspace root) | Edge-safe TypeScript library | Shared middleware: HMAC auth, rate limiting, logging, request context |

---

## 2. Review Principles

**Security-first.** Every review starts with the threat model, not the feature spec. Assume the target is already being probed.

**Minimal blast radius.** Findings result in controlled, minimal refactors. No rewrites. No "while I'm here" expansions. Changes must be independently reviewable.

**Evidence-based.** Every finding cites a line number, file, and concrete risk. No speculation.

**Cross-repo awareness.** No function or route exists in isolation. Map all callers, all callees, all trust boundaries crossed.

**Documentation as output.** The review record is a permanent artefact. It updates `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `docs/DATABASE_DESIGN.md` where content has drifted.

**No hero-complete.** The reviewer identifies issues and generates prioritised tasks. They do not fix everything in the same session unless a P0 demands immediate remediation.

---

## 3. The 500 LOC Rule

No single file — route, page, component, module, service, worker, or shared library — may exceed 500 lines of code. Comments count toward the line total.

### Consequences of violation

If the primary file of a review target exceeds 500 LOC:

1. **Document mixed responsibilities.** List every distinct concern the file owns.
2. **Produce a safe split plan.** Define new module boundaries and proposed file paths.
3. **Define extraction steps.** Incremental steps, each independently testable.
4. **Define acceptance criteria.** What must be true before each step is "done"?
5. **Write risk and rollback notes.** What could break? How would you revert?
6. **Create a P1 task** in `docs/TASKS.md` tracking the split.

The review does not pause because of a violation. The review continues in full. The split plan is a deliverable alongside the security audit and improvement tasks.

### Counting

- Blank lines count as 0.
- Comment-only lines count as 1.
- Inline comments on code lines: the line counts once.
- Generated files are excluded from the rule.

---

## 4. Daily Review Template

Each daily review record is a single markdown file written to `docs/reviews/`. Copy this template exactly for each new day.

```markdown
# Deep-Dive Review — Day NNN

**Date:** YYYY-MM-DD
**Target type:** Route | Function
**Target:** [descriptive name]
**Primary file:** path/to/file.ts (NNN LOC)
**Reviewer:** [name or "unassigned"]
**Status:** Draft | Complete

---

## Target Summary

[1–3 sentences: what this target does, why it exists, how it fits into the product.]

---

## A. Usage Mapping

### A1. Entry Points

| Caller | Repo | Runtime | Method | Trust Level |
|--------|------|---------|--------|-------------|

### A2. Import / Reference Map

| Symbol | File | Line | Purpose |
|--------|------|------|---------|

### A3. Call Graph (abbreviated)

```
[Mermaid or ASCII call graph]
```

### A4. Data Flow Summary

[Prose: what data comes in, what decisions are made, what leaves the system.]

### A5. Trust Boundaries Crossed

[List each boundary: public internet → storefront, storefront → API worker, admin → API worker, worker → Stripe, etc.]

---

## B. Database and Data Flow

### B1. D1 Tables Accessed

| Table | Operation | Fields Read | Fields Written | Notes |
|-------|-----------|-------------|----------------|-------|

### B2. Transactions and Atomicity

[Are all writes atomic? Are there partial-write failure scenarios?]

### B3. External APIs Touched

| Service | Endpoint | Auth Method | Idempotency | Failure Handling |
|---------|----------|-------------|-------------|-----------------|

### B4. R2 / KV / Cache Usage

[None | describe]

### B5. Legacy Schema Observations

[Any tables/fields that appear to be legacy, duplicate, or unused.]

### B6. Index and Performance Observations

[Missing indexes, per-request schema introspection, N+1 patterns, expensive queries.]

---

## C. Security Review

### C1. Authentication

[How is the caller authenticated? What token/secret? What is the attack surface?]

### C2. Authorisation

[What access controls exist? Any IDOR risk?]

### C3. Input Validation

[Field-by-field: what is validated, what is not, what is silently coerced.]

### C4. Injection Risks

[SQL injection (parameterised?), command injection, template injection, prompt injection.]

### C5. SSRF / Open Redirect

[Any user-controlled URLs passed to fetch(), redirects, or external APIs?]

### C6. Webhook Abuse

[Signature verification, replay protection, event type allowlisting.]

### C7. Rate Limiting

[What limits apply? Are they bypassable? In-memory vs durable?]

### C8. PII Handling

[What personal data is processed? Is it logged? Is it redacted? Retention?]

### C9. Secrets Handling

[How are secrets accessed? Any risk of exposure in logs or responses?]

### C10. Edge / Runtime Exposure

[Any Node-only APIs in an edge/worker context? Any side-effects in edge middleware?]

### C11. Multi-Tenant Leakage

[Could one customer see another's data? Any unscoped queries?]

### C12. Abuse Vectors

[Enumerate realistic abuse: repeated calls, negative amounts, malformed payloads, timing attacks.]

---

## D. Observability and Operations

### D1. Logging Completeness

[What is logged on success? On failure? Are correlation IDs propagated?]

### D2. Error Handling

[Are all errors caught? Are error messages safe to return to callers? Any silent failures?]

### D3. Retry Logic

[Are idempotent operations retried? Are non-idempotent operations protected?]

### D4. Performance Hotspots

[Latency: DB round trips, external API calls, cold-start impact.]

### D5. Failure Scenarios

[What happens if Stripe is down? DB unreachable? Partial write? Describe the failure mode for each.]

---

## E. Documentation Gaps

### E1. Architecture Doc Updates Required

[Changes needed in docs/ARCHITECTURE.md]

### E2. Security Doc Updates Required

[Changes needed in docs/SECURITY.md]

### E3. Database Doc Updates Required

[Changes needed in docs/DATABASE_DESIGN.md]

---

## F. 500 LOC Assessment

**Primary file LOC:** NNN
**Violation:** Yes | No

[If violation: split plan below. If no violation: "Within limits."]

### Split Plan (if applicable)

| Proposed File | Responsibility | Extracted From | LOC Estimate |
|--------------|---------------|----------------|--------------|

**Risk notes:**
**Rollback notes:**

---

## G. Improvement Backlog

| ID | Priority | Title | Effort | Owner | Acceptance Criteria | Risk |
|----|----------|-------|--------|-------|---------------------|------|
| RVW-NNN-001 | P0/P1/P2 | [title] | S/M/L | — | [criteria] | [risk] |

---

## H. Definition of Done — This Review

- [ ] All sections A–G completed
- [ ] All P0 findings have an immediate action or escalation note
- [ ] Tasks added to docs/TASKS.md
- [ ] Relevant documentation sections updated or update tasks created
- [ ] Review record committed to docs/reviews/
```

---

## 5. Thirty-Day Starter Review Plan

The schedule below covers the highest-risk candidates first. Day 1 starts with the most critical path in the system: order creation and Stripe checkout initiation.

Each entry shows the target type, primary file, and why it was ranked at that position.

| Day | Date | Type | Target | Primary File | Risk Rationale |
|-----|------|------|--------|-------------|----------------|
| 001 | 2026-03-01 | Route | `POST /api/orders` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | Stripe checkout creation + order insert. Money at risk. Non-atomic writes. SSRF vector. Public-facing. |
| 002 | 2026-03-02 | Route | `POST /api/stripe/webhook` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | Payment confirmation. Order fulfilment trigger. Signature verification. Replay risk. |
| 003 | 2026-03-03 | Route | `POST /api/admin/auth/login` | `admin_olive_and_ivory_gifts/src/app/api/auth/login/route.ts` | Admin session creation. Compromised auth = full platform access. |
| 004 | 2026-03-04 | Route | `POST /api/orders/:id/refund` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | Direct money movement via Stripe. Authorisation scope. Idempotency. |
| 005 | 2026-03-05 | Function | `createStripeCheckoutSession()` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | Stripe API call construction. URL injection into Stripe session. Error handling. |
| 006 | 2026-03-06 | Route | `POST /api/checkout/create` (storefront) | `olive_and_ivory_gifts/src/app/api/checkout/create/route.ts` | Rate limiting (in-memory, not durable). Auth bypass risk. Payload forwarding. |
| 007 | 2026-03-07 | Route | `PUT /api/orders/:id/status` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | Admin-only status mutation. Email trigger on status change. Auth enforcement. |
| 008 | 2026-03-08 | Route | `POST /api/uploads` (admin) | `admin_olive_and_ivory_gifts/src/app/api/uploads/route.ts` | R2 media upload. MIME validation. Size limits. Filename injection. |
| 009 | 2026-03-09 | Route | `POST /api/ai/items/generate-image` | `admin_olive_and_ivory_gifts/src/app/api/ai/items/generate-image/route.ts` | OpenAI API. Cost exposure. Prompt injection. Rate limiting. |
| 010 | 2026-03-10 | Route | `POST /api/receipts/parse` | `admin_olive_and_ivory_gifts/src/app/api/receipts/parse/route.ts` | PII exposure (customer receipts). AI/OCR pipeline. Data retention. |
| 011 | 2026-03-11 | Route | `GET /api/orders` + `GET /api/orders/:id` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | PII leakage. Authorisation scope. Missing filters. Order enumeration. |
| 012 | 2026-03-12 | Route | `PUT /api/collections/:id` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | Admin mutation of storefront content. Slug collision. R2 image lifecycle. |
| 013 | 2026-03-13 | Route | `DELETE /api/collections/:id` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | Cascade impact on active orders. Soft-delete vs hard-delete logic. |
| 014 | 2026-03-14 | Route | `POST /api/collections/:id/ai-suggest` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | OpenAI API call. Prompt injection via DB-stored prompts. Cost exposure. |
| 015 | 2026-03-15 | Route | `GET/PUT/DELETE /api/admin/items/:id` | `admin_olive_and_ivory_gifts/src/app/api/items/[id]/route.ts` | Admin inventory mutation. Auth enforcement. Slug uniqueness. |
| 016 | 2026-03-16 | Function | `validateCreateOrderInput()` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | Input validation completeness. Email format, address length, cart bounds. |
| 017 | 2026-03-17 | Function | `withAuthHmac()` | `api-middleware` (workspace root) | HMAC verification. Nonce replay protection. Skip-condition logic. |
| 018 | 2026-03-18 | Function | `withRateLimit()` | `api-middleware` (workspace root) | Rate limit enforcement. Durable vs in-memory. Bypass vectors. |
| 019 | 2026-03-19 | Route | `GET/POST /api/admin/ai-prompts` + `PUT/DELETE /api/admin/ai-prompts/:id` | `admin_olive_and_ivory_gifts/src/app/api/ai-prompts/[id]/route.ts` | DB-backed prompt library. Prompt injection surface area. Schema versioning risk. |
| 020 | 2026-03-20 | Route | `GET/PUT /api/admin/ai-entity-schemas/:entity` | `admin_olive_and_ivory_gifts/src/app/api/ai-entity-schemas/[entity]/route.ts` | AI output schema control. Schema versioning ambiguity per TASKS.md item. |
| 021 | 2026-03-21 | Route | `POST /api/admin/items/bulk` | `admin_olive_and_ivory_gifts/src/app/api/admin/items/bulk/route.ts` | Bulk write path. Max item enforcement. Slug conflict handling. Partial failure. |
| 022 | 2026-03-22 | Route | `GET /api/admin/logs` + `GET /api/admin/logs/:id` | `admin_olive_and_ivory_gifts/src/app/api/logs/route.ts` | PII in event logs. Log query injection. Pagination. Access control. |
| 023 | 2026-03-23 | Route | `GET/PUT /api/admin/settings` | `admin_olive_and_ivory_gifts/src/app/api/settings/route.ts` | Global settings mutation. Cached vs live reads. Auth enforcement. |
| 024 | 2026-03-24 | Route | `GET /api/delivery-options` | `olive_and_ivory_gifts/src/app/api/delivery-options/route.ts` | Delivery zone lookup. State input injection. Publicly accessible. |
| 025 | 2026-03-25 | Route | `GET /api/places/autocomplete` + `GET /api/places/details` | `olive_and_ivory_gifts/src/app/api/places/*.ts` | SSRF via proxied Google Places. API key exposure. Rate limiting. |
| 026 | 2026-03-26 | Function | `getDeliveryQuote()` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | Delivery fee calculation. Zone matching. Default fallback behaviour. |
| 027 | 2026-03-27 | Route | `PUT /api/collections/:id/gifts/reorder` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | Sort order mutation. Auth enforcement. Race condition risk. |
| 028 | 2026-03-28 | Function | `logAction()` / `writeAuditLog()` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | Audit log completeness. PII in payloads. Failure handling. Correlation IDs. |
| 029 | 2026-03-29 | Route | `GET /api/health/*` | `olive_and_ivory_api/src/index.ts` | Health endpoint leakage. Config exposure. Auth on diagnostic routes. |
| 030 | 2026-03-30 | Function | `coreRoutes.ts` — 500 LOC split planning session | `olive_and_ivory_api/src/routes/coreRoutes.ts` | This file is 4,300+ LOC. Day 30 is dedicated to producing the full module split plan. |

---

## 6. Definition of Done

A daily review is **Done** when all of the following are true:

- [ ] Sections A through G of the review template are fully completed — no "TODO" or "N/A" placeholders without explanation.
- [ ] Every P0 finding has one of: (a) an immediate fix committed, (b) a hotfix task with severity note in `docs/TASKS.md`, or (c) an escalation note in the review record explaining why it was deferred.
- [ ] All improvement tasks from Section G are added to `docs/TASKS.md` with correct priority, effort, and acceptance criteria.
- [ ] Sections E1, E2, E3 are completed: either documentation has been updated inline, or update tasks have been added to the backlog.
- [ ] The review record file is committed to `docs/reviews/` with the correct filename (see Section 9).
- [ ] If the 500 LOC rule is violated: the split plan is present in Section F and a P1 task exists in `docs/TASKS.md`.

---

## 7. Task Generation Rubric

Every task generated by a review must follow this rubric.

### Priority Definitions

| Priority | Definition | Expected Response |
|----------|-----------|-------------------|
| **P0** | Active or imminent security risk, data loss, money at risk, or complete functional failure | Same day: escalate immediately. Fix or mitigate before next deploy. |
| **P1** | Significant vulnerability or reliability risk that is not yet exploited, or a 500 LOC violation | Within 5 business days. Blocks next release if untreated. |
| **P2** | Quality, observability, performance, or architectural debt with no immediate security impact | Backlog, scheduled within current quarter. |

### Task Record Format

Each task added to `docs/TASKS.md` must include:

```
### [REVIEW-DDD-NNN] Title

**Source:** Review Day NNN — Target
**Priority:** P0 | P1 | P2
**Effort:** S (< 2h) | M (half-day) | L (> 1 day)
**Owner:** —
**Status:** Open

**Problem:**
[What is wrong and why it matters.]

**Acceptance Criteria:**
- [ ] criterion 1
- [ ] criterion 2

**Suggested Tests:**
- [test description]

**Risk Notes:**
[What could go wrong when fixing this. Rollback path if needed.]
```

### Effort Size Guide

| Size | Definition |
|------|-----------|
| S | Isolated change, single file, no schema change, low regression risk. Under 2 hours. |
| M | Multi-file change or requires careful testing. Half a day. |
| L | Cross-repo change, schema migration, or significant refactor. More than one day. |

---

## 8. Escalation Guidance

### When to escalate immediately (same day)

- A live authentication bypass is found that is accessible without credentials.
- An SSRF vector exists that can reach internal Cloudflare infrastructure or the D1 API directly.
- Customer PII (name, email, address, payment reference) is being written to unprotected logs or returned in API responses to unauthenticated callers.
- A Stripe webhook endpoint is not verifying signatures — meaning arbitrary order fulfilment is possible.
- A secret key (Stripe, HMAC, OpenAI) is reachable from logs, error responses, or health endpoints.
- A deletion operation has no auth guard in production.

### Escalation steps

1. Stop. Do not commit any changes that might change the evidence.
2. Write a brief private note with: endpoint, attack vector, evidence (file + line), severity estimate.
3. Notify the responsible engineer / owner directly (not via public channels).
4. Create a P0 task in `docs/TASKS.md` with `[SECURITY-CRITICAL]` prefix.
5. Add an escalation note in Section G of the daily review record: describe the finding and that it was escalated, without publishing the full exploit detail in the markdown file until mitigated.
6. Follow up to confirm mitigation before next deploy.

### When NOT to escalate immediately

- A missing rate limit on a low-value, non-financial endpoint.
- A missing index causing slow queries.
- A 500 LOC violation with no security implication.
- A logging gap (no correlationId) on an internal utility function.

These are P1 or P2 tasks. Prioritise and add to `docs/TASKS.md`.

---

## 9. File Naming Convention

All daily review records are stored in `docs/reviews/`.

### Format

```
YYYY-MM-DD-dayNNN-[TYPE]-[TARGET-SLUG].md
```

### Components

| Part | Description | Example |
|------|-------------|---------|
| `YYYY-MM-DD` | Calendar date of the review | `2026-03-01` |
| `dayNNN` | Three-digit zero-padded day number | `day001` |
| `[TYPE]` | `fn` for function, route method + path slug for route | `POST`, `GET`, `fn` |
| `[TARGET-SLUG]` | Kebab-case description of the target | `api-orders`, `createStripeCheckoutSession` |

### Examples

```
docs/reviews/2026-03-01-day001-POST-api-orders.md
docs/reviews/2026-03-02-day002-POST-api-stripe-webhook.md
docs/reviews/2026-03-03-day003-POST-admin-auth-login.md
docs/reviews/2026-03-05-day005-fn-createStripeCheckoutSession.md
docs/reviews/2026-03-30-day030-fn-coreRoutes-split-plan.md
```

### Index file

Maintain `docs/reviews/README.md` as a running index. Add one line per completed review:

```
| Day | Date | Type | Target | Status |
```

---

## 10. Versioning Approach for Documentation Updates

### Architecture, Security, and Database docs

These documents (`docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DATABASE_DESIGN.md`) are versioned by git. Each review that changes them must include in the commit message:

```
docs: update [ARCHITECTURE|SECURITY|DATABASE] — Review Day NNN ([target])
```

### Review records

Review records are immutable once committed. Corrections are made by appending an **Amendment** section at the bottom of the file:

```markdown
---

## Amendment — YYYY-MM-DD

**Author:**
**Reason:**
[description of what was corrected and why]
```

### Schedule document (this file)

This file is versioned. Increment the version header at the top when:

- The template (Section 4) changes — increment minor version (1.0 → 1.1).
- The 30-day schedule is replaced with a new quarter's plan — increment minor version.
- A principle or hard rule changes — increment major version (1.x → 2.0).

Do not amend completed daily review records retroactively. Amend only if a finding was materially wrong (e.g. a false positive was reported as a vulnerability).
