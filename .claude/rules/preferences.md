# Preferences

## Purpose

Execution defaults and working style for this workspace.

## Communication Defaults

- Be direct and concise.
- Prefer actionable summaries over long explanation.
- State concrete next steps when there is a blocker.
- Separate what is done, what is risky, and what still needs deployment.

## Working Defaults

- Reuse existing code and shared primitives before introducing new abstractions.
- Prefer minimal, reviewable changes over rewrites.
- Keep Cloudflare runtime paths edge-safe.
- Preserve existing contracts unless the task explicitly calls for contract changes.
- Use migrations for persistent data changes instead of ad hoc runtime mutation.
- New components and feature files should stay under 500 lines where practical.
- A single feature module should do one thing well; split mixed-responsibility files before they become god components.
- If logic already exists in a shared primitive, helper, or hook, reuse it instead of duplicating it.
- If you find an existing file that exceeds 500 lines or mixes multiple responsibilities, either refactor it now or log it as a backlog item in `docs/TASKS.md`.

## Git Defaults

- Avoid mixing unrelated local changes into a fix.
- Use clean detached worktrees when deploying from a dirty repo.
- Push to `main` without force.

## Memory Defaults

- Capture durable changes as they happen.
- Keep `session-log.md` short and current.
- Promote repeated patterns into `decisions.md`.

## Do Not Store

- Temporary deploy failures
- Resolved transient build issues
- Raw command transcripts
