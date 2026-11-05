# Test Plan

## Levels
1. Unit: pure validation, state machines, formatting.
2. Contract: access control, batch integrity, replay protection.
3. eERC integration: SDK and token operations on supported environment.
4. Backend: schema, auth, idempotency, privacy-safe logs.
5. Frontend: wallet, network, forms, state, error cases.
6. E2E: employer -> confidential payment -> employee -> auditor -> public observer.
7. Security/privacy: adversarial and disclosure tests.
8. Demo rehearsal: repeatability and fallback.

## Required scenarios
- Valid batch
- Invalid address
- Zero/negative/overflow amount
- Duplicate recipient
- Unauthorized employer
- Wrong chain
- Wallet rejection
- RPC timeout
- Reverted transaction
- Pending/unknown transaction
- Retry without duplicate payment
- Unauthorized balance read
- Employee verifies own balance
- Auditor verifies permitted scope
- Unauthorized observer cannot reveal amounts
- Public metadata leakage review

## Exit criteria
All P0 scenarios pass; test evidence captured; no critical/high issue unresolved; limitations documented.
