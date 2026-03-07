# Current Focus

## Purpose

Short-lived priorities that matter right now.

## Current Priorities

- Keep admin and API deploys aligned with the active remote schema version.
- Continue reducing drift between:
  - admin UI expectations
  - API contracts
  - D1 schema state
- Prefer fixes that preserve current production behavior while improving diagnostics.

## Active Risks

- Dirty local worktrees in app repos can leak unrelated changes into deploys if not isolated.
- Admin and API schema/version drift causes false health warnings and confusing UI status.
- Legacy compatibility paths still exist in parts of the stack and should be removed carefully.

## Immediate Backlog Sources

- `docs/TASKS.md`
- `docs/MAINTENANCE_CHECKLIST.md`

## Update Triggers

- A new top priority replaces these
- A risk is resolved or a higher-risk issue emerges

