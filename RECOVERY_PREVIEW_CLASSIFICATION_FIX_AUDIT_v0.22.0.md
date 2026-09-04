# Recovery Preview Classification Fix — v0.22.0

Only the in-memory merge summary labels changed. The recovery payload, record arrays, ID resolution, merge ordering, duplicate handling, schema version, and commit path were not changed.

## Correct preview

- Orders: 22 inserted / 0 preserved / 0 skipped
- Sellers: 14 inserted / 0 preserved / 0 skipped
- Pickup Locations: 0 inserted / 0 preserved / 0 skipped
- Recurring definitions: 4 inserted / 0 preserved / 0 skipped
- Forwarding Batches: 8 inserted / 0 preserved / 1 skipped

The former `Orders: 40` was the sum of Orders (22), Sellers (14), and Recurring definitions (4). It was a presentation classification defect only.

Payload file SHA-256 remains `4CA3393E18148ACEBFB144C06C95E695BBA6E8B73372915EEAF3139FD7C2CF79`; package-declared canonical payload hash remains unchanged. No canonical state was read or written by this fix.
