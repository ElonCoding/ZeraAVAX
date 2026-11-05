# Agent Instructions — Project-wide

## Read first
Before work, read `MASTER_CONTEXT.md`, `PRD.md`, `TRD.md`, and the relevant specification/task.

## Rules
1. Do not invent CashLayer details, chain IDs, RPCs, contract addresses, SDK methods, or protocol behavior.
2. Verify eERC APIs against pinned official docs/source.
3. Mark unknowns `TBD`; ask before making consequential assumptions.
4. Never implement cryptographic or auditor semantics from intuition.
5. Do not store or log private keys, seed phrases, plaintext confidential balances, or salary amounts unnecessarily.
6. Keep eERC integration behind a small adapter.
7. Prefer minimal scope and working end-to-end milestones.
8. Add tests for every behavior; security/privacy tests are mandatory.
9. Never claim a transaction is confirmed without receipt evidence.
10. Update docs and ADRs when decisions change.
11. Do not modify unrelated files.
12. Report files changed, commands/tests run, results, and known limitations.

## Definition of done
Requirements met, tests pass, privacy reviewed, protocol usage source-verified, documentation updated, and limitations disclosed.
