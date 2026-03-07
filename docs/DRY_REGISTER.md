# DRY Register

> Last updated: 2026-03-08
> Companion to: `DRY_REFACTORING_PROCESS.md`

This document tracks all identified duplication and their remediation status.

## Status Definitions
- ⏳ **PLANNED**: Identified, verified as true duplication, extraction home decided.
- 🏗️ **IN_PROGRESS**: Currently being refactored. (Only ONE should be in progress at a time).
- ✅ **COMPLETED**: Refactored, typed, and callers updated.

---

## Backlog

| ID | Status | Name / Description | Current Locations | Target Home |
|----|--------|--------------------|-------------------|-------------|
| DRY-001 | ✅ COMPLETED | Extract Currency Formatter (Cents to AUD) | `admin.../orderUtils.ts`, `sf.../currency.ts` | `api-middleware/src/currency.ts` |
| DRY-002 | ✅ COMPLETED | Extract Shared Types (`Order`, `DeliveryZone`, `Faq` etc.) | `admin.../types.ts`, `sf.../types.ts` | `api-middleware/src/models.ts` |
| DRY-003 | ✅ COMPLETED | Extract HTTP JSON Fetch Wrapper (`fetchJson`) | `admin.../fetchJson.ts`, `sf.../fetchJson.ts` | `api-middleware/src/fetch-json.ts` |

---

## Completed

**DRY-001: Extract Currency Formatter (Cents to AUD)**
- **Extracted to:** `api-middleware/src/currency.ts`
- **Re-exported in:** `api-middleware/src/index.ts`

**DRY-002: Extract Shared Types (Order, DeliveryZone, Faq)**
- **Extracted to:** `api-middleware/src/models.ts`
- **Re-exported in:** `api-middleware/src/index.ts`

**DRY-003: Extract HTTP JSON Fetch Wrapper (fetchJson)**
- **Extracted to:** `api-middleware/src/fetch-json.ts`
- **Re-exported in:** `api-middleware/src/index.ts`

> **Note to next assignee regarding DRY-001, DRY-002, & DRY-003:** The shared package (`v0.1.2`) is built and tested locally. The applications pull `api-middleware` remotely via GitHub URLs (currently `v0.1.1`). 
> **To Finalise:**
> 1. Commit and push `api-middleware` upstream. 
> 2. Create a `v0.1.2` git tag.
> 3. Update `package.json` in both repos to depend on `#v0.1.2`.
> 4. Delete the duplicated `fetchJson.ts` files from the NextJS applications entirely and refactor imports to pull from `api-middleware`. Do the same for `formatCurrency` and the shared Data Models.
