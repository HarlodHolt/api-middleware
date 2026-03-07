# DRY Refactoring Process

**Version:** 1.0.0
**Created:** 2026-03-08
**Owner:** Engineering
**Scope:** Identifying and extracting duplicated code across `olive_and_ivory_api`, `admin_olive_and_ivory_gifts`, and `olive_and_ivory_gifts`.

---

## 1. Overview

This document outlines the methodological process for DRYing (Don't Repeat Yourself) the codebase.
The goal is to reduce technical debt, prevent bugs caused by inconsistent updates to duplicated logic, and reduce the overall maintenance burden.

**Crucial Principle:** We must ensure this work is fully resumable. Any engineer (or agent) picking this up must be able to read the register, see exactly what is in progress, what has been completed, and what is planned, without needing context from previous conversational sessions.

## 2. The Process

### Step 1: Identification & Cataloging
1. **Discover:** Search for duplicated patterns (e.g., duplicated API error handling, identical DB query patterns, duplicate type definitions across repos, copied utility functions like `slugify` or `formatCurrency`).
2. **Evaluate:** Ask "Is this *true* duplication or *incidental* duplication?"
   - *True duplication:* The code represents the same concept. If the business rule changes, all instances must change. (Candidate for DRY).
   - *Incidental duplication:* The code happens to look the same right now, but represents different concepts that will likely evolve independently. (Leave alone).
3. **Catalog:** Add the identified duplication to `docs/DRY_REGISTER.md` with a status of `PLANNED`.

### Step 2: Planning the Abstraction
1. **Determine the home:**
   - If it spans all three repos (Admin, Storefront, API) -> Extract to `api-middleware` (workspace root).
   - If it spans Admin and Storefront -> Extract to `api-middleware` or a shared UI package if created.
   - If it is duplicated within a single repo -> Extract to `src/lib/` or `src/utils/` of that repo.
2. **Design the abstraction:** Ensure the shared function/component takes the necessary parameters to satisfy all existing callers without becoming an unmaintainable "god function" filled with `if/else` flags.

### Step 3: Execution (The "One at a Time" Rule)
To ensure the process is resumable and safe:
1. Pick **ONE** item from the `DRY_REGISTER.md`.
2. Update its status to `IN_PROGRESS` in the register.
3. Extract the logic to the planned shared location.
4. Refactor the *first* caller to use the new shared logic. Run typechecks (`npm run typecheck` or `npx tsc --noEmit`).
5. Refactor subsequent callers one by one, committing or checkpointing along the way.
6. Verify no behaviour has changed.

### Step 4: Finalisation
1. Update `DRY_REGISTER.md` status to `COMPLETED`.
2. Add a short note about the extraction (where it lives now).
3. Move to the next item.

---

## 3. The Central Register

All state for this effort is stored in `docs/DRY_REGISTER.md`.
If execution is interrupted, the next assignee MUST read `docs/DRY_REGISTER.md` and resume from the item marked `IN_PROGRESS`. If none are in progress, pick the highest priority `PLANNED` item.
