# Decisions

## Purpose

Durable technical and product decisions that should keep future work consistent.

## Current Decisions

### Platform

- `api-middleware` is the shared middleware layer used across the other repos.
- Runtime code must remain Cloudflare/Edge-safe.

### API Contracts

- Preserve and propagate `x-correlation-id` and `x-request-id`.
- Standard error shape is:
  - `{ ok: false, error: { code, message, correlation_id }, details? }`

### Data Ownership

- The API worker is the primary writer for business entities.
- Frontend apps may proxy to the API rather than writing directly.

### AI

- AI schema ownership is entity-driven, not prompt-driven.
- Prompt text should define behaviour and tone, not output structure.
- Prompt library content should stay in D1-backed settings rather than editor-local hardcoded lists.

### Deploy Safety

- Deploy from clean worktrees when the local repo has unrelated unstaged changes.

## Update Triggers

- Any change that alters future implementation across more than one task
- Any new platform or contract rule that should be applied consistently

