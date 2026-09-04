# One-Click Recovery Import QA — v0.22.0

Scope: one verified text/structured-data package, staged in memory and committed once only after a single user confirmation. The importer does not open the production media database or write media.

## Package

- File: `recovery-all-data-v0220.json`
- SHA-256: `cfbcf4643a8d500ed64c08b987afb6d21782b4827717b10df59109c6d0d8250f`
- schemaVersion: 12
- Legacy Journal: 497
- Daily logical text blocks: 482
- Orders / Batches: 22 / 9
- Inventory: 3
- Subscriptions: 8
- No Spend / Challenges: 1 / 1

## Merge contract

- Current-only records preserve.
- Recovery-only stable IDs insert.
- Exact records skip.
- Same stable ID with different content preserves the current record.
- The only live replacement is the confirmed 2026-08-29 `Test` / `Test test` data. The approved 2026-08-14 through 2026-08-16 One Line decisions are source selections and insert when absent.
- The 2026-09-04 empty Daily container and both current block metadata IDs preserve.

## Media contract

The package keeps 347 Five Years attachment metadata rows, marked `missing_media`, but removes every `mediaId` and `companionMediaId`. No media payload or media-store operation is part of the importer. Dangling media references: 0.

## Safety contract

The import preview stages the complete candidate in memory. Selecting a verified package triggers a download of the small current canonical backup. Confirming import makes exactly one canonical `save()` call, then reads it back and checks it against the staged candidate. A failed save restores the in-memory prior state and does not attempt any fallback write.

## Regression

`recovery-one-click-regression-v0220.js`: 19/19 PASS, including package hash, deterministic preview, current preservation, approved text selections, 8/29 replacement, integrity, duplicate rejection, idempotent second import, and simulated quota failure preservation.
