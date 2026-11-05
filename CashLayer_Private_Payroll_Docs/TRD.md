# Technical Requirements Document (TRD)

## Principles
- Source-verified integration over assumptions.
- Separate product logic from eERC cryptographic operations.
- Minimize sensitive off-chain data.
- Prefer deterministic, testable modules.
- Pin compiler, SDK, and dependency versions.
- Keep protocol secrets client-side/in wallet where required by official design.

## Proposed logical layers
1. Presentation: web app and role-specific screens.
2. Application: batch validation, workflow state, display logic.
3. Blockchain adapter: wallet, RPC, transaction submission, receipts.
4. Confidential adapter: eERC SDK, encryption/proof, encrypted balance operations.
5. Contracts: authorization, batch integrity, minimal on-chain workflow support.
6. Metadata store/indexer: optional, non-sensitive records and status reconciliation.

## Stack candidates (not final until validated)
- Frontend: React / Next.js + TypeScript
- UI: Tailwind CSS
- EVM interaction: official eERC SDK plus compatible viem/wagmi where appropriate
- Contracts: Solidity + Foundry
- Backend: Node.js/TypeScript only if necessary
- Database: Supabase/Postgres only for minimum metadata, if needed
- Tests: Foundry, unit/integration/E2E harness
- CI: GitHub Actions

## Technical gates
- Gate 1: confirm CashLayer network and deployment environment.
- Gate 2: run official eERC minimal transfer and balance demo.
- Gate 3: prove auditor behavior and unauthorized observer limitations.
- Gate 4: define contract boundaries and data persistence.
- Gate 5: implement payroll MVP.
- Gate 6: security, failure recovery, and demo rehearsal.

## Required engineering artifacts
Architecture diagrams, ADRs, pinned dependency matrix, deployment manifest, test evidence, threat model, and known limitations.
