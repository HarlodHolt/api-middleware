# CLAUDE.md

This file is a router, not a knowledge dump.

Read this first, then load only the files needed for the task.

## Priority Order

1. Hard constraints in this file
2. Relevant files in `.claude/rules/`
3. Architecture and repo docs in `docs/`
4. Task backlog in `docs/TASKS.md`

## Hard Rules

- Keep this file short. Do not turn it into a long-running notes file.
- Prefer reading the smallest relevant file set for the task.
- For complex or ambiguous work, plan first, then execute.
- Update memory files during the task when something durable changes, not only at the end.
- Put stable facts in `profile.md`, durable technical choices in `decisions.md`, and short-lived work in `session-log.md`.
- Do not store transient debugging noise, stack traces, or one-off command output in memory files.
- When creating new components or features, keep each single feature module focused on one responsibility.
- Do not let a single feature file grow beyond 500 lines unless there is a clear, justified exception.
- Reuse existing code and shared primitives where possible before creating new code paths.
- If you encounter an existing component or feature file over 500 lines, or one that clearly does more than one thing, treat it as technical debt.
- When that technical debt is identified and not fixed immediately, add or update a task in `docs/TASKS.md`.
- When creating or editing a file with cross-file dependencies, include or update a `@dependencies` comment block at the top listing related files that must be checked. When editing a file that has a `@dependencies` block, read and update the listed files as needed in the same change.

## Auto-Update Memory (MANDATORY)

Update memory files as you go, not only at the end.

| Trigger | Action |
|---------|--------|
| User shares a stable fact | Update `.claude/rules/profile.md` |
| User states a repeated preference | Update `.claude/rules/preferences.md` |
| A durable technical/product decision is made | Update `.claude/rules/decisions.md` |
| A priority changes this week | Update `.claude/rules/current-focus.md` |
| A task leaves an unresolved follow-up | Add one concise note to `.claude/rules/session-log.md` |

Skip trivial one-off questions and resolved transient failures.

## Routing

- Product/repo context: `.claude/rules/profile.md`
- Working style and execution defaults: `.claude/rules/preferences.md`
- Durable technical choices and platform constraints: `.claude/rules/decisions.md`
- Current priorities and active platform risks: `.claude/rules/current-focus.md`
- Recent work and unresolved follow-up: `.claude/rules/session-log.md`
- Private/local-only memory: `.claude/rules/memory-private.md` (optional, gitignored)

- System architecture: `docs/ARCHITECTURE.md`
- Project summary: `docs/PROJECT_OVERVIEW.md`
- Security context: `docs/SECURITY.md`
- Dependency map: `docs/DEPENDENCIES.md`
- Maintenance workflow: `docs/MAINTENANCE_CHECKLIST.md`
- Backlog: `docs/TASKS.md`

## Update Rules

- If a stable repo fact changes, update `.claude/rules/profile.md`.
- If a repeated working preference or expectation becomes clear, update `.claude/rules/preferences.md`.
- If a technical choice changes future implementation, update `.claude/rules/decisions.md`.
- If priorities change this week, update `.claude/rules/current-focus.md`.
- If a task creates follow-up work, add one concise entry to `.claude/rules/session-log.md`.
- Do not ask for permission to update these memory files when the change is clearly durable.
- If you identify oversized or mixed-responsibility components that need later refactoring, record that follow-up in `docs/TASKS.md`.

## Do Not Store Here

- Full task transcripts
- Raw logs
- Stack traces
- Temporary branch names
- One-off failures that have been resolved
