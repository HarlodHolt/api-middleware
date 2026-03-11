# AI Readiness Task Backlog

> Last updated: 2026-03-11  
> Owner: Yuri + repo agents  
> Scope: Cross-repo tasks to improve AI-assisted coding safety, consistency, and refactorability.

## Task Format

```
- [ ] <Task title>
  - Repo(s): <repo names>
  - Priority: <P0|P1|P2>
  - Why it matters for AI: <short reason>
  - Acceptance criteria:
    - <measurable done condition>
```

---

## P0 - Must do first (safety + enforcement)

- [x] Standardize CI quality gates across all repos
  - Repo(s): api-middleware, olive_and_ivory_api, olive_and_ivory_gifts, admin_olive_and_ivory_gifts
  - Priority: P0
  - Why it matters for AI: Inconsistent CI lets AI-generated changes pass in one repo and fail in another.
  - Acceptance criteria:
    - Every repo CI runs `lint`, `typecheck`, `test`, and `build`.
    - API repo also runs route contract/smoke tests.
    - CI fails on any missing step or non-zero exit.

- [x] Add CI enforcement for "tests required on feature changes"
  - Repo(s): all repos
  - Priority: P0
  - Why it matters for AI: Prevents untested AI changes from being merged.
  - Acceptance criteria:
    - Workflow detects changed feature files and verifies matching test changes.
    - PR fails if feature code changes without required test layer updates.
    - Rule is documented in repo contributing docs.

- [x] Add CI contract checks for API feature modules
  - Repo(s): olive_and_ivory_api
  - Priority: P0
  - Why it matters for AI: Contract drift is a top regression risk for generated code.
  - Acceptance criteria:
    - Route registry/contract tests run on each push/PR.
    - CI fails if endpoint behavior changes without contract updates.
    - Coverage matrix is regenerated/validated in CI.

- [x] Enforce file-size guardrail (major edits blocked above 400 LOC unless split)
  - Repo(s): all repos
  - Priority: P0
  - Why it matters for AI: Large mixed-concern files cause unsafe local patching.
  - Acceptance criteria:
    - Guard script checks touched files for >400 LOC.
    - If over threshold and significant change, CI fails with split instruction.
    - Threshold and exceptions are documented.

- [x] Add PR template with mandatory "logic location" and "test evidence"
  - Repo(s): all repos (or root templates mirrored into each repo)
  - Priority: P0
  - Why it matters for AI: Forces explicit architecture intent and proof of behavior.
  - Acceptance criteria:
    - PR template includes sections:
      - Where logic lives
      - Why this location matches architecture
      - Test evidence (unit/integration/e2e/contract)
    - CI verifies template sections are not empty.

---

## P1 - Structural improvements (reduce ambiguity)

- [ ] Refactor storefront checkout into feature modules
  - Repo(s): olive_and_ivory_gifts
  - Priority: P1
  - Why it matters for AI: Checkout is high-risk and currently too large for safe context.
  - Acceptance criteria:
    - Checkout orchestration file remains thin and focused.
    - Business logic/state hooks extracted into named modules.
    - Unit tests cover pricing, delivery rule, and submission branching.

- [ ] Refactor API order write path into controller/service/repository split
  - Repo(s): olive_and_ivory_api
  - Priority: P1
  - Why it matters for AI: Route-level business logic invites drift and duplicate behavior.
  - Acceptance criteria:
    - Route handlers only parse/validate/respond.
    - Business decisions move to service layer.
    - Data persistence isolated in repository module(s).
    - Existing route tests remain green.

- [ ] Refactor admin logs page into container + filters + table + query hook
  - Repo(s): admin_olive_and_ivory_gifts
  - Priority: P1
  - Why it matters for AI: Current mixed concerns increase edit collisions and UI regressions.
  - Acceptance criteria:
    - View preset/filter/query state extracted to hook(s).
    - Rendering split into focused components.
    - Existing behavior preserved with tests for presets and filters.

- [ ] Remove/ban new generic code buckets (`misc`, broad `helpers`, broad `utils`)
  - Repo(s): all repos
  - Priority: P1
  - Why it matters for AI: Ambiguous folders make generated code placement inconsistent.
  - Acceptance criteria:
    - Add lint or review rule to block new files in forbidden generic folders.
    - Existing generic files get migration plan to domain-specific modules.
    - Naming convention examples added to docs.

- [ ] Create "golden path" feature template per repo
  - Repo(s): all repos
  - Priority: P1
  - Why it matters for AI: Gives a deterministic pattern for adding new features safely.
  - Acceptance criteria:
    - Templates added for:
      - API endpoint module
      - Storefront feature module
      - Admin dashboard module
    - Each template includes required tests and contracts.

---

## P2 - Conventions and long-term scaling

- [ ] Publish and enforce architecture + AI contribution guide
  - Repo(s): root docs + all repos
  - Priority: P2
  - Why it matters for AI: Conventions must be explicit to avoid architectural hallucination.
  - Acceptance criteria:
    - `ARCHITECTURE.md` has canonical layering and dependency rules.
    - `CONTRIBUTING_AI.md` defines:
      - placement rules
      - naming conventions
      - test requirements
      - file-size/splitting policy
    - Linked from every repo README.

- [ ] Build cross-repo shared contracts/types package
  - Repo(s): api-middleware + app repos
  - Priority: P2
  - Why it matters for AI: Single contract source reduces divergence bugs.
  - Acceptance criteria:
    - Shared package exports core DTOs/schemas.
    - API + admin + storefront consume same contract types.
    - Contract versioning process is documented.

- [ ] Add pre-merge "clean tree" and generated-artifact policy
  - Repo(s): all repos
  - Priority: P2
  - Why it matters for AI: Dirty trees and stale generated files create hidden coupling.
  - Acceptance criteria:
    - Pre-push/CI check rejects unexpected untracked generated artifacts.
    - Generated files have explicit owner scripts and update commands.

---

## Tasks Derived From AI-Generated Code Repo Rules

- [x] Rule 1: No feature code in generic folders
  - Repo(s): all repos
  - Priority: P0
  - Why it matters for AI: Prevents junk-drawer architecture and ambiguous code placement.
  - Acceptance criteria:
    - Define disallowed folders/patterns (`misc`, generic `helpers`, generic `utils` for feature logic).
    - Add lint/check script to fail on new feature files in disallowed locations.
    - Document approved feature module locations by repo.

- [x] Rule 2: New endpoint/feature must include tests in required layers
  - Repo(s): all repos
  - Priority: P0
  - Why it matters for AI: AI frequently adds code paths without complete test coverage.
  - Acceptance criteria:
    - Define required test layers per feature type:
      - API endpoint: unit + contract/smoke
      - Storefront UI behavior: unit + e2e path
      - Admin dashboard behavior: unit/integration + e2e for critical flows
    - CI enforces test presence when feature files change.

- [x] Rule 3: Files over 300-400 LOC must be split before major logic additions
  - Repo(s): all repos
  - Priority: P0
  - Why it matters for AI: Limits context-window misses and accidental regressions.
  - Acceptance criteria:
    - Add script to report touched files over threshold.
    - Fail CI when over-threshold file receives major logic additions without extraction.
    - Provide an exception label process for emergency hotfixes.

- [x] Rule 4: CI must fail on missing tests/contracts for changed feature modules
  - Repo(s): all repos
  - Priority: P0
  - Why it matters for AI: Converts architectural intent into enforceable controls.
  - Acceptance criteria:
    - CI maps changed files to required verification checks.
    - Build fails when required tests/contracts are absent or skipped.
    - Status check names are consistent across repos.

- [x] Rule 5: PR template must include "where logic lives" and "test evidence"
  - Repo(s): all repos
  - Priority: P0
  - Why it matters for AI: Makes design intent and validation explicit for reviewers and agents.
  - Acceptance criteria:
    - Update `.github/pull_request_template.md` in each repo (or shared template flow).
    - Required sections are present and non-empty before merge.
    - Include example entries for API, storefront, and admin changes.

---

## Suggested Execution Order

1. P0 CI standardization + enforcement scripts  
2. P0 PR template enforcement  
3. P1 large-file and separation refactors in highest-risk flows  
4. P1 naming/folder convention migration  
5. P2 shared contracts and long-term governance hardening
