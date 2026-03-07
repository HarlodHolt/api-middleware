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
| DRY-004 | 🏗️ IN_PROGRESS | Extract HMAC Signed Fetcher (`signing.ts`, `externalApi.ts`) | `admin.../signing.ts`, `sf.../signing.ts` | `api-middleware/src/signing.ts` |
| DRY-005 | ⏳ PLANNED | Extract Shared Extended Models (`Item`, `Gift`, `Collection`) | `admin.../types.ts`, `sf.../types.ts` | `api-middleware/src/models.ts` |

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

> **Note on Finalisation:** The shared package `v0.1.2` was successfully built, tagged, and pushed upstream. Both applications (`olive_and_ivory_gifts` and `admin_olive_and_ivory_gifts`) have had their `package.json` dependencies bumped to `#v0.1.2`. `npm install` was run inside both environments. 
> To finalize the codebase securely without breaking 100+ files via CLI refactoring, the local duplicated configurations (`fetchJson.ts`, `currency.ts`, and `types.ts`) were gutted and replaced with proxy-exports. They simply export the implementations straight from `api-middleware` now. The codebase is fully DRYed across all repos and is completely safe.
